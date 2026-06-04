import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushService } from "@/services/push";
import { AUTO_RESOLVE_DAYS } from "@/services/whatsapp-sync";

/**
 * Alerta de SLA: avisa (push) quando contatos SALVOS (prioridade alta, individuais)
 * ficam sem resposta além do limite. Pensado para ser chamado por um cron externo
 * (ex.: cron-job.org), tipo:
 *   GET /api/cron/whatsapp-sla?minutes=60
 *
 * Anti-ruído: não realerta a mesma conversa enquanto a espera atual não recomeçar
 * (compara slaAlertedAt com firstPendingAt). Ignora silenciadas (isMuted).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    if (process.env.CRON_SECRET && searchParams.get("key") !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const minutes = Math.max(5, parseInt(searchParams.get("minutes") || "60", 10) || 60);
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const human = minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}min`;

    try {
        // auto-resolve conversas pendentes muito antigas (> AUTO_RESOLVE_DAYS sem resposta)
        const staleCutoff = new Date(Date.now() - AUTO_RESOLVE_DAYS * 24 * 60 * 60 * 1000);
        const autoResolved = await prisma.whatsappChat.updateMany({
            where: { status: "pending", lastMessageAt: { lt: staleCutoff } },
            data: { status: "resolved", resolvedAt: new Date() },
        });

        const chats = await prisma.whatsappChat.findMany({
            where: {
                status: "pending",
                priority: "high",
                isMuted: false,
                ignored: false,
                firstPendingAt: { lt: cutoff },
            },
            include: { instance: { select: { userId: true } } },
        });

        // só alerta se ainda não alertou esta espera (slaAlertedAt anterior ao início da pendência)
        const eligible = chats.filter(
            (c) => !c.slaAlertedAt || (c.firstPendingAt != null && c.slaAlertedAt < c.firstPendingAt)
        );

        const byUser = new Map<string, typeof eligible>();
        for (const c of eligible) {
            const uid = c.instance.userId;
            if (!byUser.has(uid)) byUser.set(uid, []);
            byUser.get(uid)!.push(c);
        }

        let usersNotified = 0;
        let chatsAlerted = 0;

        for (const [userId, list] of byUser) {
            const count = list.length;
            const first = list[0];
            const body =
                count === 1
                    ? `${first.name || first.remoteJid.split("@")[0]} aguarda resposta há mais de ${human}.`
                    : `${count} contatos salvos aguardam resposta há mais de ${human}.`;

            await pushService.sendToUser(userId, {
                title: "WhatsApp: respostas pendentes ⏰",
                body,
                url: "https://www.taskfreela.com.br/whatsapp",
            });

            await prisma.whatsappChat.updateMany({
                where: { id: { in: list.map((c) => c.id) } },
                data: { slaAlertedAt: new Date() },
            });

            usersNotified++;
            chatsAlerted += count;
        }

        return NextResponse.json({
            success: true,
            minutes,
            autoResolved: autoResolved.count,
            scanned: chats.length,
            usersNotified,
            chatsAlerted,
        });
    } catch (error) {
        console.error("[cron whatsapp-sla] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
