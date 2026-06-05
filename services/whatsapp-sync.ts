import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { createWhatsappClient, WhatsappClient } from "@/services/whatsapp-client";

/**
 * Sincronização e ingestão de eventos do WhatsApp.
 *
 * - syncInstance: puxa chats + contatos da Evolution e persiste (upsert),
 *   cruzando nome salvo / isSaved e calculando prioridade e status.
 * - ingestWebhookEvent: processa eventos em tempo real (MESSAGES_UPSERT,
 *   MESSAGES_UPDATE, CONNECTION_UPDATE, CONTACTS_UPSERT), recalculando
 *   pendência e tempo de resposta.
 *
 * Não importa histórico em massa (respeita o limite de ~30s do serverless):
 * mensagens antigas são carregadas sob demanda ao abrir a conversa.
 */

const BROADCAST_JID = "status@broadcast";
/** Conversas pendentes sem atividade há mais que isto viram "resolved" automaticamente. */
export const AUTO_RESOLVE_DAYS = 90;

export function isGroupJid(jid: string): boolean {
    return typeof jid === "string" && jid.endsWith("@g.us");
}

/** Extrai um preview de texto do objeto `message` conforme o messageType. */
export function extractPreview(messageType?: string, message?: any): string {
    if (!message) return messageTypeFallback(messageType);
    switch (messageType) {
        case "conversation":
            return message.conversation || "";
        case "extendedTextMessage":
            return message.extendedTextMessage?.text || "";
        case "imageMessage":
            return message.imageMessage?.caption || "[imagem]";
        case "videoMessage":
            return message.videoMessage?.caption || "[vídeo]";
        case "audioMessage":
            return "[áudio]";
        case "documentMessage":
            return message.documentMessage?.fileName ? `[documento] ${message.documentMessage.fileName}` : "[documento]";
        case "stickerMessage":
            return "[figurinha]";
        case "locationMessage":
            return "[localização]";
        case "contactMessage":
            return "[contato]";
        default:
            // tenta os campos mais comuns antes do fallback
            return (
                message.conversation ||
                message.extendedTextMessage?.text ||
                messageTypeFallback(messageType)
            );
    }
}

function messageTypeFallback(messageType?: string): string {
    if (!messageType) return "";
    if (messageType.includes("image")) return "[imagem]";
    if (messageType.includes("video")) return "[vídeo]";
    if (messageType.includes("audio")) return "[áudio]";
    if (messageType.includes("document")) return "[documento]";
    if (messageType.includes("sticker")) return "[figurinha]";
    return "[mídia]";
}

/** Classifica a prioridade: salvo+individual = alta; grupo = média; resto = baixa. */
export function classifyPriority(opts: { isGroup: boolean; isSaved: boolean }): string {
    if (opts.isGroup) return "medium";
    if (opts.isSaved) return "high";
    return "low";
}

function tsToDate(messageTimestamp?: number | string | null): Date {
    if (!messageTimestamp) return new Date();
    const n = typeof messageTimestamp === "string" ? parseInt(messageTimestamp, 10) : messageTimestamp;
    // unix em segundos → ms
    return new Date(n * 1000);
}

export type InstanceWithClient = {
    instance: {
        id: string;
        userId: string;
        instanceName: string;
        webhookSecret: string;
        serverId: string;
    };
    client: WhatsappClient;
};

/**
 * Carrega uma instância (opcionalmente garantindo o dono) e devolve um cliente
 * Evolution pronto, com a apiKey já decifrada.
 */
export async function getInstanceWithClient(
    instanceId: string,
    userId?: string
): Promise<InstanceWithClient | null> {
    const instance = await prisma.whatsappInstance.findUnique({
        where: { id: instanceId },
        include: { server: true },
    });
    if (!instance) return null;
    if (userId && instance.userId !== userId) return null;

    const client = createWhatsappClient({
        baseUrl: instance.server.baseUrl,
        apiKey: decrypt(instance.server.apiKey),
    });

    return {
        instance: {
            id: instance.id,
            userId: instance.userId,
            instanceName: instance.instanceName,
            webhookSecret: instance.webhookSecret,
            serverId: instance.serverId,
        },
        client,
    };
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/**
 * Busca fotos de perfil em paralelo para chats individuais ainda não tentados
 * (profilePicUrl IS NULL). Cap=50 simultâneos, timeout 5s por chamada, deadline
 * total de ~15s. Quem não tem foto fica com "" (já tentado).
 */
export async function fetchProfilePicsInBatch(
    client: WhatsappClient,
    instanceName: string,
    instanceId: string,
    opts: { take?: number; concurrency?: number; deadlineMs?: number } = {}
): Promise<{ tried: number; got: number }> {
    const take = opts.take ?? 200;
    const concurrency = opts.concurrency ?? 50;
    const deadline = Date.now() + (opts.deadlineMs ?? 15_000);

    const need = await prisma.whatsappChat.findMany({
        where: { instanceId, type: "person", profilePicUrl: null, archived: false },
        select: { id: true, remoteJid: true, priority: true },
        take,
    });
    if (!need.length) return { tried: 0, got: 0 };
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    need.sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3));

    let i = 0;
    let got = 0;
    async function worker() {
        while (i < need.length && Date.now() < deadline) {
            const me = i++;
            const c = need[me];
            try {
                const res = await client.fetchProfilePictureUrl(instanceName, c.remoteJid.split("@")[0]);
                const url = (res.success && (res.data?.profilePictureUrl || res.data?.url)) || "";
                await prisma.whatsappChat.update({ where: { id: c.id }, data: { profilePicUrl: url } });
                if (url) got++;
            } catch {
                // ignora; tenta de novo em sync futuro (mantém null)
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, need.length) }, () => worker()));
    return { tried: i, got };
}

type ChatUpsertRow = {
    id: string;
    instanceId: string;
    remoteJid: string;
    type: string;
    name: string | null;
    lastMessageAt: Date | null;
    lastFromMe: boolean;
    lastPreview: string | null;
    unreadCount: number;
    priority: string;
    status: string;
    firstPendingAt: Date | null;
};

/**
 * Grava todos os chats em LOTE com um único INSERT ... ON DUPLICATE KEY UPDATE por
 * batch (em vez de um UPDATE por conversa). Não toca em colunas de estado manual
 * (resolvedAt, isMuted, ignored, taskId, slaAlertedAt, lastResponseSeconds).
 */
async function bulkUpsertChats(rows: ChatUpsertRow[]) {
    const now = new Date();
    for (const batch of chunk(rows, 200)) {
        if (!batch.length) continue;
        const values = batch.map(
            (r) =>
                Prisma.sql`(${r.id}, ${r.instanceId}, ${r.remoteJid}, ${r.type}, ${r.name}, ${r.lastMessageAt}, ${r.lastFromMe ? 1 : 0}, ${r.lastPreview}, ${r.unreadCount}, ${r.priority}, ${r.status}, ${r.firstPendingAt}, ${now})`
        );
        await prisma.$executeRaw`
            INSERT INTO WhatsappChat
                (id, instanceId, remoteJid, type, name, lastMessageAt, lastFromMe, lastPreview, unreadCount, priority, status, firstPendingAt, updatedAt)
            VALUES ${Prisma.join(values)}
            ON DUPLICATE KEY UPDATE
                type = VALUES(type),
                name = VALUES(name),
                lastMessageAt = VALUES(lastMessageAt),
                lastFromMe = VALUES(lastFromMe),
                lastPreview = VALUES(lastPreview),
                unreadCount = VALUES(unreadCount),
                priority = VALUES(priority),
                status = VALUES(status),
                firstPendingAt = VALUES(firstPendingAt),
                updatedAt = VALUES(updatedAt)
        `;
    }
}

/**
 * Sincroniza contatos + chats de uma instância, cruzando nome salvo e isSaved e
 * recalculando prioridade/status. Preserva status "resolved"/"mute"/"ignored" manual.
 *
 * Otimizado para o limite de 30s do serverless: busca contatos/chats/grupos da
 * Evolution em PARALELO e grava os chats num único bulk upsert.
 */
export async function syncInstance(instanceId: string): Promise<{ chats: number; contacts: number }> {
    const ctx = await getInstanceWithClient(instanceId);
    if (!ctx) throw new Error("Instância não encontrada.");
    const { instance, client } = ctx;

    // Busca contatos e chats da Evolution em PARALELO + lê os chats existentes.
    const [contactsRes, chatsRes, existingChats] = await Promise.all([
        client.findContacts(instance.instanceName),
        client.findChats(instance.instanceName),
        prisma.whatsappChat.findMany({ where: { instanceId } }),
    ]);

    // 1) Contatos — snapshot: limpa e regrava em lote (cache de nome/isSaved)
    const contactsRaw: any[] = Array.isArray(contactsRes.data) ? contactsRes.data : contactsRes.data?.contacts || [];
    const savedMap = new Map<string, { pushName?: string; isSaved: boolean; isGroup: boolean }>();
    const contactRows: any[] = [];
    for (const c of contactsRaw) {
        const remoteJid: string = c.remoteJid || c.id;
        if (!remoteJid || remoteJid === BROADCAST_JID || savedMap.has(remoteJid)) continue;
        const isGroup = isGroupJid(remoteJid);
        const isSaved = Boolean(c.isSaved);
        const pushName = c.pushName || c.name || null;
        savedMap.set(remoteJid, { pushName: pushName || undefined, isSaved, isGroup });
        contactRows.push({ instanceId, remoteJid, pushName, isSaved, isGroup });
    }
    await prisma.whatsappContact.deleteMany({ where: { instanceId } });
    for (const batch of chunk(contactRows, 500)) {
        if (batch.length) await prisma.whatsappContact.createMany({ data: batch, skipDuplicates: true });
    }
    // 2) Chats — dedupe
    const incoming = new Map<string, any>();
    for (const ch of Array.isArray(chatsRes.data) ? chatsRes.data : chatsRes.data?.chats || []) {
        const remoteJid: string = ch.remoteJid || ch.id;
        if (!remoteJid || remoteJid === BROADCAST_JID) continue;
        incoming.set(remoteJid, ch);
    }
    const existingByJid = new Map(existingChats.map((c) => [c.remoteJid, c]));

    // 3) Nome real dos grupos (subject) — fetchAllGroups é LENTO (segundos): só busca
    // quando há grupo ainda sem nome no banco (novos). Em re-syncs já nomeados, pula.
    const groupNames = new Map<string, string>();
    const needsGroups = [...incoming.keys()].some((jid) => isGroupJid(jid) && !existingByJid.get(jid)?.name);
    if (needsGroups) {
        const groupsRes = await client.fetchAllGroups(instance.instanceName, false);
        const groups: any[] = Array.isArray(groupsRes.data) ? groupsRes.data : groupsRes.data?.groups || [];
        for (const g of groups) {
            const jid = g?.id || g?.jid;
            if (jid && g?.subject) groupNames.set(jid, g.subject);
        }
    }

    const rows: ChatUpsertRow[] = [];
    for (const [remoteJid, ch] of incoming) {
        const isGroup = isGroupJid(remoteJid);
        const saved = savedMap.get(remoteJid);
        const isSaved = saved?.isSaved ?? false;
        const existing = existingByJid.get(remoteJid);
        const name = isGroup
            ? groupNames.get(remoteJid) || ch.subject || ch.name || existing?.name || null
            : saved?.pushName || ch.pushName || ch.name || null;

        const lastMessage = ch.lastMessage;
        const lastFromMe = Boolean(lastMessage?.key?.fromMe);
        const lastPreview = lastMessage ? extractPreview(lastMessage.messageType, lastMessage.message) : null;
        const lastMessageAt = lastMessage?.messageTimestamp
            ? tsToDate(lastMessage.messageTimestamp)
            : ch.updatedAt
            ? new Date(ch.updatedAt)
            : null;
        const priority = classifyPriority({ isGroup, isSaved });

        // Status: derivado de lastFromMe, preservando "resolved" manual.
        let status: string;
        let firstPendingAt: Date | null;
        if (lastFromMe) {
            status = "answered";
            firstPendingAt = null;
        } else if (
            existing?.status === "resolved" &&
            existing.resolvedAt &&
            lastMessageAt &&
            existing.resolvedAt >= lastMessageAt
        ) {
            status = "resolved";
            firstPendingAt = existing.firstPendingAt;
        } else {
            status = "pending";
            firstPendingAt =
                existing?.status === "pending" && existing.firstPendingAt ? existing.firstPendingAt : lastMessageAt;
        }

        rows.push({
            id: existing?.id || randomUUID(),
            instanceId,
            remoteJid,
            type: isGroup ? "group" : "person",
            name,
            lastMessageAt,
            lastFromMe,
            lastPreview,
            unreadCount: ch.unreadCount ?? existing?.unreadCount ?? 0,
            priority,
            status,
            firstPendingAt,
        });
    }

    await bulkUpsertChats(rows);

    // 4) Fotos de perfil em LOTE — busca p/ chats individuais ainda não tentados.
    // Quem não tem foto fica com "" (já tentado), pra não tentar de novo.
    // Bench: cap=50 + timeout 5s/foto → ~80 fotos em ~6s.
    await fetchProfilePicsInBatch(client, instance.instanceName, instanceId);

    // auto-resolve conversas pendentes muito antigas (> AUTO_RESOLVE_DAYS sem resposta)
    const staleCutoff = new Date(Date.now() - AUTO_RESOLVE_DAYS * 24 * 60 * 60 * 1000);
    await prisma.whatsappChat.updateMany({
        where: { instanceId, status: "pending", lastMessageAt: { lt: staleCutoff } },
        data: { status: "resolved", resolvedAt: new Date() },
    });

    await prisma.whatsappInstance.update({
        where: { id: instanceId },
        data: { lastSyncAt: new Date() },
    });

    return { chats: incoming.size, contacts: savedMap.size };
}

/** Normaliza o nome do evento ("MESSAGES_UPSERT" / "messages.upsert" → "messages.upsert"). */
function normalizeEvent(event?: string): string {
    return (event || "").toLowerCase().replace(/_/g, ".");
}

/**
 * Processa um evento de webhook da Evolution para uma instância.
 * Idempotente por mensagem (unique [instanceId, messageId]).
 */
export async function ingestWebhookEvent(instanceId: string, payload: any): Promise<void> {
    const event = normalizeEvent(payload?.event);

    if (event === "connection.update") {
        const state = payload?.data?.state || payload?.data?.connection;
        if (state) {
            await prisma.whatsappInstance.update({
                where: { id: instanceId },
                data: { connectionStatus: String(state) },
            });
        }
        return;
    }

    if (event === "contacts.upsert" || event === "contacts.update") {
        const items: any[] = Array.isArray(payload?.data) ? payload.data : [payload?.data].filter(Boolean);
        for (const c of items) {
            const remoteJid: string = c?.remoteJid || c?.id;
            if (!remoteJid || remoteJid === BROADCAST_JID) continue;
            await prisma.whatsappContact.upsert({
                where: { instanceId_remoteJid: { instanceId, remoteJid } },
                update: { pushName: c.pushName || c.name || null, isSaved: Boolean(c.isSaved), isGroup: isGroupJid(remoteJid) },
                create: { instanceId, remoteJid, pushName: c.pushName || c.name || null, isSaved: Boolean(c.isSaved), isGroup: isGroupJid(remoteJid) },
            });
        }
        return;
    }

    if (event === "messages.upsert") {
        const items: any[] = Array.isArray(payload?.data) ? payload.data : [payload?.data].filter(Boolean);
        for (const m of items) {
            await ingestMessage(instanceId, m);
        }
        return;
    }

    // outros eventos (messages.update etc.) são ignorados na v1
}

async function ingestMessage(instanceId: string, m: any): Promise<void> {
    const key = m?.key;
    const remoteJid: string = key?.remoteJid;
    if (!remoteJid || remoteJid === BROADCAST_JID) return;

    const messageId: string = key?.id;
    const fromMe = Boolean(key?.fromMe);
    const messageType: string = m?.messageType || Object.keys(m?.message || {})[0] || "unknown";
    const preview = extractPreview(messageType, m?.message);
    const when = tsToDate(m?.messageTimestamp);
    const isGroup = isGroupJid(remoteJid);

    // resolve nome/isSaved a partir do contato persistido
    const contact = await prisma.whatsappContact.findUnique({
        where: { instanceId_remoteJid: { instanceId, remoteJid } },
    });
    const isSaved = contact?.isSaved ?? false;
    const priority = classifyPriority({ isGroup, isSaved });

    const existing = await prisma.whatsappChat.findUnique({
        where: { instanceId_remoteJid: { instanceId, remoteJid } },
    });

    // Nome do chat:
    // - grupos: nunca o pushName do remetente; preserva o subject salvo.
    // - pessoas: o pushName SÓ vale para mensagens recebidas (de entrada); em mensagens
    //   enviadas por nós (fromMe), o pushName é o NOSSO nome, então não pode virar o nome
    //   do contato. Preserva o nome já existente nesse caso.
    const name = isGroup
        ? existing?.name || contact?.pushName || null
        : contact?.pushName || (!fromMe ? m?.pushName || null : null) || existing?.name || null;

    // estado do chat + tempo de resposta
    let status: string;
    let firstPendingAt: Date | null = existing?.firstPendingAt ?? null;
    let lastResponseSeconds: number | null = existing?.lastResponseSeconds ?? null;
    let unreadCount = existing?.unreadCount ?? 0;

    if (fromMe) {
        // Nós respondemos → fecha a pendência e calcula o tempo de resposta.
        if (existing?.status === "pending" && existing.firstPendingAt) {
            const diff = Math.round((when.getTime() - existing.firstPendingAt.getTime()) / 1000);
            if (diff >= 0) lastResponseSeconds = diff;
        }
        status = existing?.status === "resolved" ? "resolved" : "answered";
        firstPendingAt = null;
        unreadCount = 0;
    } else {
        // Mensagem de entrada → abre/mantém pendência.
        status = "pending";
        if (!existing || existing.status !== "pending" || !existing.firstPendingAt) {
            firstPendingAt = when;
        }
        unreadCount = unreadCount + 1;
    }

    const chat = await prisma.whatsappChat.upsert({
        where: { instanceId_remoteJid: { instanceId, remoteJid } },
        update: {
            type: isGroup ? "group" : "person",
            name: name ?? existing?.name ?? null,
            lastMessageAt: when,
            lastFromMe: fromMe,
            lastPreview: preview,
            unreadCount,
            priority,
            status,
            firstPendingAt,
            lastResponseSeconds,
        },
        create: {
            instanceId,
            remoteJid,
            type: isGroup ? "group" : "person",
            name,
            lastMessageAt: when,
            lastFromMe: fromMe,
            lastPreview: preview,
            unreadCount,
            priority,
            status,
            firstPendingAt,
            lastResponseSeconds,
        },
    });

    // ao responder, fecha a tarefa "Responder" vinculada (se houver)
    if (fromMe && existing?.taskId) {
        await prisma.task.updateMany({
            where: { id: existing.taskId, status: { not: "DONE" } },
            data: { status: "DONE" },
        });
        await prisma.whatsappChat.update({ where: { id: chat.id }, data: { taskId: null } });
    }

    if (messageId) {
        await prisma.whatsappMessage.upsert({
            where: { instanceId_messageId: { instanceId, messageId } },
            update: { preview, type: messageType, fromMe, timestamp: when, chatId: chat.id },
            create: {
                instanceId,
                chatId: chat.id,
                messageId,
                remoteJid,
                fromMe,
                type: messageType,
                preview,
                timestamp: when,
            },
        });
    }
}
