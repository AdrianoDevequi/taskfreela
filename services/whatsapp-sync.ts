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
 * Sincroniza contatos + chats de uma instância, cruzando nome salvo e isSaved e
 * recalculando prioridade/status. Preserva status "resolved"/"mute" manual.
 *
 * Otimizado para escala (instâncias com milhares de chats / limite de 30s no
 * serverless): grava em LOTE (createMany) e, em re-syncs, só atualiza os chats
 * que realmente mudaram — em vez de uma query por conversa.
 */
export async function syncInstance(instanceId: string): Promise<{ chats: number; contacts: number }> {
    const ctx = await getInstanceWithClient(instanceId);
    if (!ctx) throw new Error("Instância não encontrada.");
    const { instance, client } = ctx;

    // 1) Contatos — snapshot: limpa e regrava em lote (são apenas cache de nome/isSaved)
    const contactsRes = await client.findContacts(instance.instanceName);
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

    // 2) Chats — dedupe, compara com o existente e separa em create/update
    const chatsRes = await client.findChats(instance.instanceName);
    const chatsRaw: any[] = Array.isArray(chatsRes.data) ? chatsRes.data : chatsRes.data?.chats || [];

    const incoming = new Map<string, any>();
    for (const ch of chatsRaw) {
        const remoteJid: string = ch.remoteJid || ch.id;
        if (!remoteJid || remoteJid === BROADCAST_JID) continue;
        incoming.set(remoteJid, ch);
    }

    const existingChats = await prisma.whatsappChat.findMany({ where: { instanceId } });
    const existingByJid = new Map(existingChats.map((c) => [c.remoteJid, c]));

    // Nome real dos grupos (subject) — em findChats o pushName de grupo é o do último
    // remetente, não o nome do grupo. Buscamos via fetchAllGroups (best-effort).
    const groupNames = new Map<string, string>();
    if ([...incoming.keys()].some(isGroupJid)) {
        const gRes = await client.fetchAllGroups(instance.instanceName, false);
        const groups: any[] = Array.isArray(gRes.data) ? gRes.data : gRes.data?.groups || [];
        for (const g of groups) {
            const jid = g?.id || g?.jid;
            if (jid && g?.subject) groupNames.set(jid, g.subject);
        }
    }

    const creates: any[] = [];
    const updates: { id: string; data: any }[] = [];

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

        // Status: derivado de lastFromMe, preservando "resolved" manual se não houver
        // entrada mais nova que a resolução.
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

        const unreadCount = ch.unreadCount ?? existing?.unreadCount ?? 0;
        const type = isGroup ? "group" : "person";

        if (!existing) {
            creates.push({
                instanceId,
                remoteJid,
                type,
                name,
                lastMessageAt,
                lastFromMe,
                lastPreview,
                unreadCount,
                priority,
                status,
                firstPendingAt,
            });
        } else {
            const changed =
                (existing.lastMessageAt?.getTime() || 0) !== (lastMessageAt?.getTime() || 0) ||
                existing.lastFromMe !== lastFromMe ||
                existing.unreadCount !== unreadCount ||
                existing.status !== status ||
                existing.name !== name ||
                existing.priority !== priority;
            if (changed) {
                updates.push({
                    id: existing.id,
                    data: { type, name, lastMessageAt, lastFromMe, lastPreview, unreadCount, priority, status, firstPendingAt },
                });
            }
        }
    }

    for (const batch of chunk(creates, 500)) {
        if (batch.length) await prisma.whatsappChat.createMany({ data: batch, skipDuplicates: true });
    }
    for (const u of updates) {
        await prisma.whatsappChat.update({ where: { id: u.id }, data: u.data });
    }

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

    // grupos: nunca usar o pushName do remetente como nome do chat; preserva o subject já salvo
    const name = isGroup
        ? existing?.name || contact?.pushName || null
        : contact?.pushName || m?.pushName || null;

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
