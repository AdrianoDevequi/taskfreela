import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushService } from "@/services/push";
import { evolutionService } from "@/services/evolution";
import { AUTO_RESOLVE_DAYS, fetchProfilePicsInBatch, getInstanceWithClient } from "@/services/whatsapp-sync";

/**
 * Alerta de SLA: avisa (push) quando contatos SALVOS (prioridade alta, individuais)
 * ficam sem resposta além do limite. Pensado para ser chamado por um cron externo
 * (ex.: cron-job.org), tipo:
 *   GET /api/cron/whatsapp-sla?minutes=60
 *
 * Anti-ruído: não realerta a mesma conversa enquanto a espera atual não recomeçar
 * (compara slaAlertedAt com firstPendingAt). Ignora silenciadas (isMuted).
 */
// ── Horário comercial (America/Sao_Paulo = UTC-3 fixo desde 2019) ────────────
// Seg–Sex, 9h–18h. Ajuste estes valores se a regra mudar.
const BR_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3
const BIZ_START_HOUR = 9;
const BIZ_END_HOUR = 18;
const BIZ_DAYS = new Set([1, 2, 3, 4, 5]); // 0=Dom .. 6=Sáb
// Só vira tarefa depois de acumular 5h dentro do horário comercial sem resposta.
const BUSINESS_HOURS_FOR_TASK = 5;
const BUSINESS_TASK_MS = BUSINESS_HOURS_FOR_TASK * 60 * 60 * 1000;

// ── Janela de cobrança ───────────────────────────────────────────────────────
// Não incomodar de madrugada, depois das 19h, nem aos domingos.
const NOTIFY_START_HOUR = 8;
const NOTIFY_END_HOUR = 19;

/** Pode cobrar agora? (relógio de São Paulo; domingo nunca) */
function canNotifyNow(now: Date = new Date()): boolean {
    const br = new Date(now.getTime() - BR_OFFSET_MS);
    if (br.getUTCDay() === 0) return false; // domingo
    const hour = br.getUTCHours();
    return hour >= NOTIFY_START_HOUR && hour < NOTIFY_END_HOUR;
}

/** Milissegundos de horário comercial decorridos entre `start` e `end`. */
function businessMsBetween(start: Date, end: Date): number {
    if (!start || end <= start) return 0;
    const DAY = 24 * 60 * 60 * 1000;
    // trabalha no "relógio BR": desloca o UTC e depois lê com getUTC*
    const startBr = start.getTime() - BR_OFFSET_MS;
    const endBr = end.getTime() - BR_OFFSET_MS;
    let total = 0;
    for (let dayStart = Math.floor(startBr / DAY) * DAY; dayStart <= endBr; dayStart += DAY) {
        if (!BIZ_DAYS.has(new Date(dayStart).getUTCDay())) continue; // pula fim de semana
        const from = Math.max(dayStart + BIZ_START_HOUR * 60 * 60 * 1000, startBr);
        const to = Math.min(dayStart + BIZ_END_HOUR * 60 * 60 * 1000, endBr);
        if (to > from) total += to - from;
    }
    return total;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    if (process.env.CRON_SECRET && searchParams.get("key") !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const minutes = Math.max(5, parseInt(searchParams.get("minutes") || "60", 10) || 60);
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const human = minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}min`;

    try {
        // 1) auto-resolve conversas pendentes muito antigas (> AUTO_RESOLVE_DAYS sem resposta)
        const staleCutoff = new Date(Date.now() - AUTO_RESOLVE_DAYS * 24 * 60 * 60 * 1000);
        const autoResolved = await prisma.whatsappChat.updateMany({
            where: { status: "pending", lastMessageAt: { lt: staleCutoff } },
            data: { status: "resolved", resolvedAt: new Date() },
        });

        // 2) fecha as tarefas "Responder" de conversas que já saíram de pendente
        let tasksClosed = 0;
        const toClose = await prisma.whatsappChat.findMany({
            where: { taskId: { not: null }, OR: [{ status: { not: "pending" } }, { ignored: true }, { archived: true }] },
            select: { id: true, taskId: true },
        });
        for (const c of toClose) {
            const upd = await prisma.task.updateMany({
                where: { id: c.taskId!, status: { not: "DONE" } },
                data: { status: "DONE" },
            });
            await prisma.whatsappChat.update({ where: { id: c.id }, data: { taskId: null } });
            tasksClosed += upd.count;
        }

        // 3) conversas pendentes elegíveis (contatos salvos, individuais, além do limite)
        const pending = await prisma.whatsappChat.findMany({
            where: {
                status: "pending",
                priority: "high",
                isMuted: false,
                ignored: false,
                archived: false,
                firstPendingAt: { lt: cutoff },
            },
            include: { instance: { select: { userId: true } } },
        });

        const byUser = new Map<string, typeof pending>();
        for (const c of pending) {
            const uid = c.instance.userId;
            if (!byUser.has(uid)) byUser.set(uid, []);
            byUser.get(uid)!.push(c);
        }

        const dueDate = new Date();
        dueDate.setHours(23, 59, 59, 999);
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });

        let tasksCreated = 0;
        let usersNotified = 0;
        let chatsAlerted = 0;
        let quietSkipped = 0;
        const notifyAllowed = canNotifyNow();

        for (const [userId, list] of byUser) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, whatsapp: true, activeWorkspaceId: true },
            });
            if (!user) continue;

            // cria a tarefa "Responder [Nome]" para cada pendente sem tarefa aberta
            for (const c of list) {
                // só vira tarefa após 5h dentro do horário comercial (Seg–Sex 9h–18h)
                if (!c.firstPendingAt || businessMsBetween(c.firstPendingAt, new Date()) < BUSINESS_TASK_MS) continue;

                let hasOpenTask = false;
                if (c.taskId) {
                    const t = await prisma.task.findUnique({ where: { id: c.taskId }, select: { status: true } });
                    hasOpenTask = !!t && t.status !== "DONE";
                }
                if (hasOpenTask) continue;

                const name = c.name || c.remoteJid.split("@")[0];
                const task = await prisma.task.create({
                    data: {
                        title: `Responder ${name}`,
                        description: `💬 Conversa no WhatsApp sem resposta há mais de ${BUSINESS_HOURS_FOR_TASK}h de horário comercial.\n\nAbrir conversa: https://www.taskfreela.com.br/whatsapp?chat=${c.id}`,
                        dueDate,
                        status: "TODO",
                        isMandatory: true,
                        source: "whatsapp",
                        userId,
                        assignedToId: userId,
                        workspaceId: user.activeWorkspaceId || undefined,
                    },
                });
                await prisma.whatsappChat.update({ where: { id: c.id }, data: { taskId: task.id } });
                tasksCreated++;
            }

            // cobrança no WhatsApp/push: só dispara quando há conversa nova (anti-spam por espera)
            const fresh = list.filter(
                (c) => !c.slaAlertedAt || (c.firstPendingAt != null && c.slaAlertedAt < c.firstPendingAt)
            );
            if (fresh.length === 0) continue;

            // fora da janela (antes das 8h, depois das 19h, domingo): segura a cobrança.
            // Não marca slaAlertedAt de propósito — assim ela sai na próxima janela.
            if (!notifyAllowed) {
                quietSkipped += fresh.length;
                continue;
            }

            const namesList = list
                .slice(0, 10)
                .map((c) => `• ${c.name || c.remoteJid.split("@")[0]}`)
                .join("\n");

            await pushService.sendToUser(userId, {
                title: "WhatsApp: respostas pendentes ⏰",
                body: `${list.length} contato(s) salvo(s) aguardam resposta há +${human}.`,
                url: "https://www.taskfreela.com.br/whatsapp",
            });

            if (user.whatsapp && settings?.instanceName) {
                const msg =
                    `⏰ *Respostas pendentes no WhatsApp*\n\n` +
                    `Você tem *${list.length}* conversa(s) sem resposta há mais de ${human}:\n${namesList}\n\n` +
                    `Responda assim que puder 👉 https://www.taskfreela.com.br/whatsapp`;
                await evolutionService.sendText(settings.instanceName, user.whatsapp, msg).catch(() => {});
            }

            await prisma.whatsappChat.updateMany({
                where: { id: { in: fresh.map((c) => c.id) } },
                data: { slaAlertedAt: new Date() },
            });

            usersNotified++;
            chatsAlerted += fresh.length;
        }

        // 4) Backfill de fotos de perfil — todas as instâncias em PARALELO
        // (cada uma tem cap 25 simultâneos e janela de 12s; total cabe em 30s).
        const connectedInstances = await prisma.whatsappInstance.findMany({
            where: { connectionStatus: "open" },
            select: { id: true },
        });
        const picResults = await Promise.all(
            connectedInstances.map(async (inst) => {
                try {
                    const ctx = await getInstanceWithClient(inst.id);
                    if (!ctx) return { tried: 0, got: 0 };
                    return await fetchProfilePicsInBatch(ctx.client, ctx.instance.instanceName, inst.id, {
                        take: 80,
                        concurrency: 25,
                        deadlineMs: 12_000,
                    });
                } catch {
                    return { tried: 0, got: 0 };
                }
            })
        );
        const picsTried = picResults.reduce((s, r) => s + r.tried, 0);
        const picsGot = picResults.reduce((s, r) => s + r.got, 0);

        return NextResponse.json({
            success: true,
            minutes,
            autoResolved: autoResolved.count,
            picsTried,
            picsGot,
            tasksClosed,
            tasksCreated,
            scanned: pending.length,
            usersNotified,
            chatsAlerted,
            quietSkipped,
            notifyAllowed,
        });
    } catch (error) {
        console.error("[cron whatsapp-sla] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
