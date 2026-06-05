"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { encrypt, decrypt } from "@/lib/crypto";
import { createWhatsappClient } from "@/services/whatsapp-client";
import {
    getInstanceWithClient,
    syncInstance as runSyncInstance,
    ingestWebhookEvent,
    extractPreview,
    isGroupJid,
} from "@/services/whatsapp-sync";

const WEBHOOK_EVENTS = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "CONTACTS_UPSERT"];

type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };

async function requireUserId(): Promise<string> {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Não autorizado.");
    return session.user.id;
}

function appBaseUrl(): string {
    const raw =
        process.env.WHATSAPP_WEBHOOK_BASE_URL ||
        process.env.AUTH_URL ||
        process.env.NEXTAUTH_URL ||
        "https://www.taskfreela.com.br";
    const cleaned = raw.replace(/\/+$/, "");
    // o webhook precisa de URL pública — nunca apontar para localhost
    if (/localhost|127\.0\.0\.1/.test(cleaned)) return "https://www.taskfreela.com.br";
    return cleaned;
}

function webhookUrlFor(instanceId: string, secret: string): string {
    return `${appBaseUrl()}/api/whatsapp/webhook/${instanceId}?secret=${secret}`;
}

function extractQr(data: any): string | null {
    return (
        data?.qrcode?.base64 ||
        data?.base64 ||
        data?.qrcode?.code ||
        data?.code ||
        null
    );
}

// ── Servidores ───────────────────────────────────────────────────────────────

export async function listServers() {
    const userId = await requireUserId();
    const servers = await prisma.whatsappServer.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { instances: { orderBy: { createdAt: "asc" } } },
    });
    // nunca devolve a apiKey decifrada para o cliente
    return servers.map((s) => ({
        id: s.id,
        label: s.label,
        baseUrl: s.baseUrl,
        createdAt: s.createdAt,
        instances: s.instances.map((i) => ({
            id: i.id,
            instanceName: i.instanceName,
            number: i.number,
            profileName: i.profileName,
            connectionStatus: i.connectionStatus,
            lastSyncAt: i.lastSyncAt,
        })),
    }));
}

export async function addServer(formData: FormData): Promise<ActionResult<{ id: string; found: number }>> {
    try {
        const userId = await requireUserId();
        const label = ((formData.get("label") as string) || "").trim() || null;
        const baseUrl = ((formData.get("baseUrl") as string) || "").trim();
        const apiKey = ((formData.get("apiKey") as string) || "").trim();

        if (!baseUrl || !apiKey) {
            return { success: false, error: "Informe a URL e a chave (apikey) do servidor." };
        }

        // valida com um endpoint AUTENTICADO (fetchInstances), não só o GET / público
        const client = createWhatsappClient({ baseUrl, apiKey });
        const probe = await client.fetchInstances();
        if (!probe.success) {
            const msg = /unauthor|forbidden|401|403|apikey/i.test(probe.error || "")
                ? "Chave (apikey) inválida ou sem permissão. Use a API Key global do servidor Evolution."
                : `Não foi possível conectar: ${probe.error}`;
            return { success: false, error: msg };
        }

        const found = Array.isArray(probe.data) ? probe.data.length : 0;
        const server = await prisma.whatsappServer.create({
            data: { userId, label, baseUrl, apiKey: encrypt(apiKey) },
        });

        revalidatePath("/whatsapp/conexoes");
        return { success: true, data: { id: server.id, found } };
    } catch (error: any) {
        console.error("[whatsapp] addServer:", error);
        return { success: false, error: error?.message || "Erro ao salvar servidor." };
    }
}

export async function updateServer(
    serverId: string,
    formData: FormData
): Promise<ActionResult<{ found: number }>> {
    try {
        const userId = await requireUserId();
        const server = await prisma.whatsappServer.findFirst({ where: { id: serverId, userId } });
        if (!server) return { success: false, error: "Servidor não encontrado." };

        const label = ((formData.get("label") as string) || "").trim() || null;
        const baseUrl = ((formData.get("baseUrl") as string) || "").trim() || server.baseUrl;
        const apiKeyInput = ((formData.get("apiKey") as string) || "").trim();
        // se não informar nova chave, mantém a atual
        const apiKey = apiKeyInput || decrypt(server.apiKey);

        const client = createWhatsappClient({ baseUrl, apiKey });
        const probe = await client.fetchInstances();
        if (!probe.success) {
            const msg = /unauthor|forbidden|401|403|apikey/i.test(probe.error || "")
                ? "Chave (apikey) inválida ou sem permissão. Use a API Key global do servidor Evolution."
                : `Não foi possível conectar: ${probe.error}`;
            return { success: false, error: msg };
        }

        await prisma.whatsappServer.update({
            where: { id: serverId },
            data: { label, baseUrl, apiKey: encrypt(apiKey) },
        });

        revalidatePath("/whatsapp/conexoes");
        return { success: true, data: { found: Array.isArray(probe.data) ? probe.data.length : 0 } };
    } catch (error: any) {
        console.error("[whatsapp] updateServer:", error);
        return { success: false, error: error?.message || "Erro ao atualizar servidor." };
    }
}

export async function removeServer(serverId: string): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const server = await prisma.whatsappServer.findFirst({ where: { id: serverId, userId } });
        if (!server) return { success: false, error: "Servidor não encontrado." };
        await prisma.whatsappServer.delete({ where: { id: serverId } });
        revalidatePath("/whatsapp/conexoes");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] removeServer:", error);
        return { success: false, error: error?.message || "Erro ao remover servidor." };
    }
}

export async function testServer(serverId: string): Promise<ActionResult<{ instances: number }>> {
    try {
        const userId = await requireUserId();
        const server = await prisma.whatsappServer.findFirst({ where: { id: serverId, userId } });
        if (!server) return { success: false, error: "Servidor não encontrado." };
        const client = createWhatsappClient({ baseUrl: server.baseUrl, apiKey: decrypt(server.apiKey) });
        const res = await client.fetchInstances();
        if (!res.success) return { success: false, error: res.error || "Falha no teste." };
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return { success: true, data: { instances: count } };
    } catch (error: any) {
        console.error("[whatsapp] testServer:", error);
        return { success: false, error: error?.message || "Erro no teste." };
    }
}

// ── Instâncias ───────────────────────────────────────────────────────────────

/** Normaliza um item de fetchInstances (lida com formato direto ou aninhado). */
function mapFetchedInstance(item: any): {
    name: string;
    connectionStatus: string;
    number: string | null;
    profileName: string | null;
} {
    const inst = item?.instance || item || {};
    const name = inst.name || inst.instanceName || "";
    const connectionStatus = inst.connectionStatus || inst.state || "close";
    const number = inst.number || (inst.ownerJid ? String(inst.ownerJid).split("@")[0] : null);
    const profileName = inst.profileName || null;
    return { name, connectionStatus, number, profileName };
}

export type FetchedInstance = {
    name: string;
    connectionStatus: string;
    number: string | null;
    profileName: string | null;
    alreadyImported: boolean;
};

/** Lista as instâncias existentes no servidor Evolution, marcando as já importadas. */
export async function fetchServerInstances(
    serverId: string
): Promise<ActionResult<{ instances: FetchedInstance[] }>> {
    try {
        const userId = await requireUserId();
        const server = await prisma.whatsappServer.findFirst({ where: { id: serverId, userId } });
        if (!server) return { success: false, error: "Servidor não encontrado." };

        const client = createWhatsappClient({ baseUrl: server.baseUrl, apiKey: decrypt(server.apiKey) });
        const res = await client.fetchInstances();
        if (!res.success) return { success: false, error: res.error || "Falha ao listar instâncias." };

        const existing = await prisma.whatsappInstance.findMany({
            where: { serverId },
            select: { instanceName: true },
        });
        const existingNames = new Set(existing.map((e) => e.instanceName));

        const instances = (Array.isArray(res.data) ? res.data : [])
            .map(mapFetchedInstance)
            .filter((x) => x.name)
            .map((x) => ({ ...x, alreadyImported: existingNames.has(x.name) }));

        return { success: true, data: { instances } };
    } catch (error: any) {
        console.error("[whatsapp] fetchServerInstances:", error);
        return { success: false, error: error?.message || "Erro ao listar instâncias." };
    }
}

/** Importa instâncias já existentes no servidor (sem recriar/parear), configurando o webhook. */
export async function importInstances(
    serverId: string,
    names: string[]
): Promise<ActionResult<{ imported: number }>> {
    try {
        const userId = await requireUserId();
        const server = await prisma.whatsappServer.findFirst({ where: { id: serverId, userId } });
        if (!server) return { success: false, error: "Servidor não encontrado." };
        if (!names || names.length === 0) return { success: true, data: { imported: 0 } };

        const client = createWhatsappClient({ baseUrl: server.baseUrl, apiKey: decrypt(server.apiKey) });
        const res = await client.fetchInstances();
        const fetched = (Array.isArray(res.data) ? res.data : []).map(mapFetchedInstance);
        const byName = new Map(fetched.map((f) => [f.name, f]));

        let imported = 0;
        for (const name of names) {
            const f = byName.get(name);
            if (!f) continue;
            const webhookSecret = randomBytes(16).toString("hex");
            const inst = await prisma.whatsappInstance.upsert({
                where: { serverId_instanceName: { serverId, instanceName: name } },
                update: { number: f.number, profileName: f.profileName, connectionStatus: f.connectionStatus },
                create: {
                    serverId,
                    userId,
                    instanceName: name,
                    webhookSecret,
                    number: f.number,
                    profileName: f.profileName,
                    connectionStatus: f.connectionStatus,
                },
            });
            await client
                .setWebhook(name, webhookUrlFor(inst.id, inst.webhookSecret), WEBHOOK_EVENTS)
                .catch(() => {});
            imported++;
        }

        revalidatePath("/whatsapp/conexoes");
        return { success: true, data: { imported } };
    } catch (error: any) {
        console.error("[whatsapp] importInstances:", error);
        return { success: false, error: error?.message || "Erro ao importar instâncias." };
    }
}

export async function createInstance(
    serverId: string,
    instanceName: string
): Promise<ActionResult<{ instanceId: string; qr: string | null }>> {
    try {
        const userId = await requireUserId();
        const cleanName = (instanceName || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
        if (!cleanName) return { success: false, error: "Informe um nome para a instância." };

        const server = await prisma.whatsappServer.findFirst({ where: { id: serverId, userId } });
        if (!server) return { success: false, error: "Servidor não encontrado." };

        const client = createWhatsappClient({ baseUrl: server.baseUrl, apiKey: decrypt(server.apiKey) });

        // cria/garante o registro local primeiro (precisamos do id p/ a URL de webhook)
        const webhookSecret = randomBytes(16).toString("hex");
        const instance = await prisma.whatsappInstance.upsert({
            where: { serverId_instanceName: { serverId, instanceName: cleanName } },
            update: {},
            create: { serverId, userId, instanceName: cleanName, webhookSecret, connectionStatus: "connecting" },
        });

        // cria na Evolution (ignora erro de "já existe")
        const created = await client.createInstance(cleanName);
        if (!created.success && !/exist|use|already/i.test(created.error || "")) {
            return { success: false, error: `Falha ao criar instância: ${created.error}` };
        }

        // configura webhook (best-effort)
        await client.setWebhook(cleanName, webhookUrlFor(instance.id, instance.webhookSecret), WEBHOOK_EVENTS);

        // QR: tenta do create, senão chama connect
        let qr = extractQr(created.data);
        if (!qr) {
            const conn = await client.connect(cleanName);
            qr = extractQr(conn.data);
        }

        revalidatePath("/whatsapp/conexoes");
        return { success: true, data: { instanceId: instance.id, qr } };
    } catch (error: any) {
        console.error("[whatsapp] createInstance:", error);
        return { success: false, error: error?.message || "Erro ao criar instância." };
    }
}

export async function getQrCode(instanceId: string): Promise<ActionResult<{ qr: string | null; status: string }>> {
    try {
        const userId = await requireUserId();
        const ctx = await getInstanceWithClient(instanceId, userId);
        if (!ctx) return { success: false, error: "Instância não encontrada." };

        const state = await ctx.client.connectionState(ctx.instance.instanceName);
        const status = state.data?.instance?.state || state.data?.state || "close";
        if (status === "open") {
            await prisma.whatsappInstance.update({ where: { id: instanceId }, data: { connectionStatus: "open" } });
            return { success: true, data: { qr: null, status: "open" } };
        }

        const conn = await ctx.client.connect(ctx.instance.instanceName);
        return { success: true, data: { qr: extractQr(conn.data), status: "connecting" } };
    } catch (error: any) {
        console.error("[whatsapp] getQrCode:", error);
        return { success: false, error: error?.message || "Erro ao obter QR." };
    }
}

export async function refreshConnectionState(instanceId: string): Promise<ActionResult<{ status: string }>> {
    try {
        const userId = await requireUserId();
        const ctx = await getInstanceWithClient(instanceId, userId);
        if (!ctx) return { success: false, error: "Instância não encontrada." };

        const state = await ctx.client.connectionState(ctx.instance.instanceName);
        const status = state.data?.instance?.state || state.data?.state || "close";

        // ao conectar, captura número/perfil
        const update: any = { connectionStatus: status };
        if (status === "open") {
            const list = await ctx.client.fetchInstances();
            const found = Array.isArray(list.data)
                ? list.data.find((x: any) => (x.name || x.instance?.instanceName) === ctx.instance.instanceName)
                : null;
            if (found) {
                update.number = found.number || found.ownerJid?.split("@")[0] || null;
                update.profileName = found.profileName || null;
            }
        }
        await prisma.whatsappInstance.update({ where: { id: instanceId }, data: update });

        revalidatePath("/whatsapp/conexoes");
        return { success: true, data: { status } };
    } catch (error: any) {
        console.error("[whatsapp] refreshConnectionState:", error);
        return { success: false, error: error?.message || "Erro ao atualizar estado." };
    }
}

export async function logoutInstance(instanceId: string): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const ctx = await getInstanceWithClient(instanceId, userId);
        if (!ctx) return { success: false, error: "Instância não encontrada." };
        await ctx.client.logout(ctx.instance.instanceName);
        await prisma.whatsappInstance.update({ where: { id: instanceId }, data: { connectionStatus: "close" } });
        revalidatePath("/whatsapp/conexoes");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] logoutInstance:", error);
        return { success: false, error: error?.message || "Erro ao desconectar." };
    }
}

export async function deleteInstance(instanceId: string): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const ctx = await getInstanceWithClient(instanceId, userId);
        if (!ctx) return { success: false, error: "Instância não encontrada." };
        await ctx.client.logout(ctx.instance.instanceName).catch(() => {});
        await ctx.client.deleteInstance(ctx.instance.instanceName).catch(() => {});
        await prisma.whatsappInstance.delete({ where: { id: instanceId } });
        revalidatePath("/whatsapp/conexoes");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] deleteInstance:", error);
        return { success: false, error: error?.message || "Erro ao remover instância." };
    }
}

export async function syncInstance(instanceId: string): Promise<ActionResult<{ chats: number; contacts: number }>> {
    try {
        const userId = await requireUserId();
        const ctx = await getInstanceWithClient(instanceId, userId);
        if (!ctx) return { success: false, error: "Instância não encontrada." };
        // reaponta o webhook para a URL pública atual (corrige instâncias importadas antes do deploy)
        await ctx.client
            .setWebhook(ctx.instance.instanceName, webhookUrlFor(ctx.instance.id, ctx.instance.webhookSecret), WEBHOOK_EVENTS)
            .catch(() => {});
        const result = await runSyncInstance(instanceId);
        revalidatePath("/whatsapp");
        return { success: true, data: result };
    } catch (error: any) {
        console.error("[whatsapp] syncInstance:", error);
        return { success: false, error: error?.message || "Erro ao sincronizar." };
    }
}

// ── Inbox ────────────────────────────────────────────────────────────────────

export type ChatFilters = {
    instanceIds?: string[];
    type?: "person" | "group" | "unsaved";
    status?: "pending" | "answered" | "resolved" | "unread" | "archived";
    search?: string;
    includeLow?: boolean;
    /** Se true (default), fixadas aparecem no topo. Se false, ordena só por mais recente. */
    pinnedOnTop?: boolean;
};

export async function listChats(filters: ChatFilters = {}) {
    const userId = await requireUserId();
    const instances = await prisma.whatsappInstance.findMany({
        where: { userId },
        select: { id: true, instanceName: true, profileName: true },
    });
    const instanceIds = instances.map((i) => i.id);
    if (instanceIds.length === 0) return { chats: [], instances };

    const where: any = { instanceId: { in: instanceIds } };
    if (filters.instanceIds && filters.instanceIds.length) {
        where.instanceId = { in: filters.instanceIds.filter((id) => instanceIds.includes(id)) };
    }
    if (filters.type === "person") where.type = "person";
    if (filters.type === "group") where.type = "group";
    // arquivadas só aparecem no filtro "archived"; nos demais, ficam escondidas
    if (filters.status === "archived") {
        where.archived = true;
    } else {
        where.archived = false;
        if (filters.status === "pending") where.status = "pending";
        else if (filters.status === "answered") where.status = "answered";
        else if (filters.status === "resolved") where.status = "resolved";
        else if (filters.status === "unread") where.unreadCount = { gt: 0 };
    }
    if (!filters.includeLow) where.priority = { not: "low" };
    if (filters.search) {
        where.OR = [
            { name: { contains: filters.search } },
            { remoteJid: { contains: filters.search } },
            { lastPreview: { contains: filters.search } },
        ];
    }

    const pinnedOnTop = filters.pinnedOnTop !== false; // default true
    const chats = await prisma.whatsappChat.findMany({
        where,
        orderBy: pinnedOnTop
            ? [{ pinnedAt: "desc" }, { lastMessageAt: "desc" }]
            : [{ lastMessageAt: "desc" }],
        take: 200,
    });

    const labelById = new Map(instances.map((i) => [i.id, i.profileName || i.instanceName]));
    return {
        instances,
        chats: chats.map((c) => ({
            id: c.id,
            instanceId: c.instanceId,
            instanceLabel: labelById.get(c.instanceId) || "",
            remoteJid: c.remoteJid,
            type: c.type,
            name: c.name,
            lastMessageAt: c.lastMessageAt,
            lastFromMe: c.lastFromMe,
            lastPreview: c.lastPreview,
            unreadCount: c.unreadCount,
            priority: c.priority,
            status: c.status,
            firstPendingAt: c.firstPendingAt,
            lastResponseSeconds: c.lastResponseSeconds,
            isMuted: c.isMuted,
            ignored: c.ignored,
            archived: c.archived,
            customName: c.customName,
            profilePicUrl: c.profilePicUrl,
            pinnedAt: c.pinnedAt,
            color: c.color,
        })),
    };
}

export async function getChatMessages(chatId: string, skipRemote = false) {
    const userId = await requireUserId();
    const chat = await prisma.whatsappChat.findUnique({
        where: { id: chatId },
        include: { instance: { include: { server: true } } },
    });
    if (!chat || chat.instance.userId !== userId) throw new Error("Conversa não encontrada.");

    let profilePicUrl = chat.profilePicUrl;
    // lazy load do histórico via Evolution e persiste (best-effort).
    // skipRemote = true no polling em tempo real (lê só do banco, alimentado pelo webhook).
    if (!skipRemote) try {
        const client = createWhatsappClient({
            baseUrl: chat.instance.server.baseUrl,
            apiKey: decrypt(chat.instance.server.apiKey),
        });
        const res = await client.findMessages(chat.instance.instanceName, chat.remoteJid, 50);
        const records: any[] =
            res.data?.messages?.records || res.data?.records || (Array.isArray(res.data) ? res.data : []);

        const seen = new Set<string>();
        const rows = records
            .map((m) => {
                const messageId = m?.key?.id;
                if (!messageId || seen.has(messageId)) return null;
                seen.add(messageId);
                const messageType = m?.messageType || Object.keys(m?.message || {})[0] || "unknown";
                return {
                    instanceId: chat.instanceId,
                    chatId: chat.id,
                    messageId,
                    remoteJid: chat.remoteJid,
                    fromMe: Boolean(m?.key?.fromMe),
                    type: messageType,
                    preview: extractPreview(messageType, m?.message),
                    timestamp: m?.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000) : new Date(),
                };
            })
            .filter(Boolean) as any[];

        if (rows.length) {
            await prisma.whatsappMessage.createMany({ data: rows, skipDuplicates: true });
        }

        // foto de perfil — busca uma vez e cacheia (só conversas individuais)
        if (!chat.profilePicUrl && chat.type === "person") {
            const picRes = await client.fetchProfilePictureUrl(chat.instance.instanceName, chat.remoteJid.split("@")[0]);
            const url = picRes.data?.profilePictureUrl || picRes.data?.url || null;
            if (url) {
                profilePicUrl = url;
                await prisma.whatsappChat.update({ where: { id: chat.id }, data: { profilePicUrl: url } });
            }
        }
    } catch (error) {
        console.error("[whatsapp] getChatMessages lazy load:", error);
    }

    const messages = await prisma.whatsappMessage.findMany({
        where: { chatId },
        orderBy: { timestamp: "asc" },
        take: 200,
    });

    return {
        chat: {
            id: chat.id,
            name: chat.name,
            customName: chat.customName,
            profilePicUrl,
            remoteJid: chat.remoteJid,
            type: chat.type,
            status: chat.status,
            instanceId: chat.instanceId,
        },
        messages: messages.map((m) => ({
            id: m.id,
            fromMe: m.fromMe,
            preview: m.preview,
            type: m.type,
            timestamp: m.timestamp,
        })),
    };
}

/** Baixa a mídia (base64) de uma mensagem sob demanda (imagem/áudio/vídeo/documento). */
export async function getMessageMedia(
    messageId: string
): Promise<ActionResult<{ base64: string; mimetype: string; fileName?: string }>> {
    try {
        const userId = await requireUserId();
        const msg = await prisma.whatsappMessage.findUnique({
            where: { id: messageId },
            include: { instance: { include: { server: true } } },
        });
        if (!msg || msg.instance.userId !== userId) return { success: false, error: "Mensagem não encontrada." };

        const client = createWhatsappClient({
            baseUrl: msg.instance.server.baseUrl,
            apiKey: decrypt(msg.instance.server.apiKey),
        });
        const res = await client.getBase64FromMediaMessage(msg.instance.instanceName, {
            id: msg.messageId,
            remoteJid: msg.remoteJid,
            fromMe: msg.fromMe,
        });
        if (!res.success) {
            const detail = Array.isArray(res.data?.response?.message)
                ? res.data.response.message.join(" ")
                : String(res.data?.response?.message || res.error || "");
            const friendly = /fetch stream|expired|expirou|not found|410|404/i.test(detail)
                ? "Mídia indisponível — o link do WhatsApp expirou."
                : res.error || "Falha ao baixar mídia.";
            return { success: false, error: friendly };
        }

        const base64 = res.data?.base64 || res.data?.media || "";
        const mimetype = res.data?.mimetype || res.data?.mimeType || "application/octet-stream";
        const fileName = res.data?.fileName || res.data?.filename || undefined;
        if (!base64) return { success: false, error: "Mídia indisponível." };

        return { success: true, data: { base64, mimetype, fileName } };
    } catch (error: any) {
        console.error("[whatsapp] getMessageMedia:", error);
        return { success: false, error: error?.message || "Erro ao baixar mídia." };
    }
}

/** Envia resposta. SEMPRE acionado por ação explícita do usuário (confirmação na UI). */
export async function sendReply(chatId: string, text: string): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const body = (text || "").trim();
        if (!body) return { success: false, error: "Mensagem vazia." };

        const chat = await prisma.whatsappChat.findUnique({
            where: { id: chatId },
            include: { instance: { include: { server: true } } },
        });
        if (!chat || chat.instance.userId !== userId) return { success: false, error: "Conversa não encontrada." };

        const client = createWhatsappClient({
            baseUrl: chat.instance.server.baseUrl,
            apiKey: decrypt(chat.instance.server.apiKey),
        });
        // grupos usam o jid completo; conversas individuais usam só o número
        const number = isGroupJid(chat.remoteJid) ? chat.remoteJid : chat.remoteJid.split("@")[0];
        const res = await client.sendText(chat.instance.instanceName, number, body);
        if (!res.success) return { success: false, error: res.error || "Falha no envio." };

        // reflete imediatamente no estado local (não depende do webhook chegar)
        const messageId = res.data?.key?.id || `local-${Date.now()}`;
        await ingestWebhookEvent(chat.instanceId, {
            event: "messages.upsert",
            data: {
                key: { remoteJid: chat.remoteJid, fromMe: true, id: messageId },
                message: { conversation: body },
                messageType: "conversation",
                messageTimestamp: Math.floor(Date.now() / 1000),
            },
        });

        revalidatePath("/whatsapp");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] sendReply:", error);
        return { success: false, error: error?.message || "Erro ao enviar." };
    }
}

export async function markChatRead(chatId: string): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const chat = await prisma.whatsappChat.findUnique({
            where: { id: chatId },
            include: { instance: { include: { server: true } } },
        });
        if (!chat || chat.instance.userId !== userId) return { success: false, error: "Conversa não encontrada." };

        const inbound = await prisma.whatsappMessage.findMany({
            where: { chatId, fromMe: false },
            orderBy: { timestamp: "desc" },
            take: 20,
        });
        if (inbound.length > 0) {
            const client = createWhatsappClient({
                baseUrl: chat.instance.server.baseUrl,
                apiKey: decrypt(chat.instance.server.apiKey),
            });
            await client
                .markMessageAsRead(
                    chat.instance.instanceName,
                    inbound.map((m) => ({ remoteJid: chat.remoteJid, fromMe: false, id: m.messageId }))
                )
                .catch(() => {});
        }

        await prisma.whatsappChat.update({ where: { id: chatId }, data: { unreadCount: 0 } });
        revalidatePath("/whatsapp");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] markChatRead:", error);
        return { success: false, error: error?.message || "Erro ao marcar como lido." };
    }
}

export async function setChatResolved(chatId: string, resolved: boolean): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const chat = await prisma.whatsappChat.findUnique({ where: { id: chatId }, include: { instance: true } });
        if (!chat || chat.instance.userId !== userId) return { success: false, error: "Conversa não encontrada." };
        await prisma.whatsappChat.update({
            where: { id: chatId },
            data: resolved
                ? { status: "resolved", resolvedAt: new Date(), firstPendingAt: null }
                : { status: chat.lastFromMe ? "answered" : "pending", resolvedAt: null },
        });
        revalidatePath("/whatsapp");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] setChatResolved:", error);
        return { success: false, error: error?.message || "Erro ao atualizar conversa." };
    }
}

export async function setChatMuted(chatId: string, muted: boolean): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const chat = await prisma.whatsappChat.findUnique({ where: { id: chatId }, include: { instance: true } });
        if (!chat || chat.instance.userId !== userId) return { success: false, error: "Conversa não encontrada." };
        await prisma.whatsappChat.update({ where: { id: chatId }, data: { isMuted: muted } });
        revalidatePath("/whatsapp");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] setChatMuted:", error);
        return { success: false, error: error?.message || "Erro ao atualizar conversa." };
    }
}

/** Marca/desmarca uma conversa como ignorada (fora do rastreio de tempo, métricas e alertas). */
export async function setChatIgnored(chatId: string, ignored: boolean): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const chat = await prisma.whatsappChat.findUnique({ where: { id: chatId }, include: { instance: true } });
        if (!chat || chat.instance.userId !== userId) return { success: false, error: "Conversa não encontrada." };
        await prisma.whatsappChat.update({ where: { id: chatId }, data: { ignored } });
        revalidatePath("/whatsapp");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] setChatIgnored:", error);
        return { success: false, error: error?.message || "Erro ao atualizar conversa." };
    }
}

/** Fixa/desafixa a conversa no topo da lista (quando o toggle "Fixadas no topo" está ligado). */
export async function setChatPinned(chatId: string, pinned: boolean): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const chat = await prisma.whatsappChat.findUnique({ where: { id: chatId }, include: { instance: true } });
        if (!chat || chat.instance.userId !== userId) return { success: false, error: "Conversa não encontrada." };
        await prisma.whatsappChat.update({ where: { id: chatId }, data: { pinnedAt: pinned ? new Date() : null } });
        revalidatePath("/whatsapp");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] setChatPinned:", error);
        return { success: false, error: error?.message || "Erro ao atualizar conversa." };
    }
}

const CHAT_COLORS = new Set(["", "red", "orange", "amber", "green", "blue", "purple"]);

/** Define/limpa a cor (etiqueta) da conversa. Valor "" limpa. */
export async function setChatColor(chatId: string, color: string): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const chat = await prisma.whatsappChat.findUnique({ where: { id: chatId }, include: { instance: true } });
        if (!chat || chat.instance.userId !== userId) return { success: false, error: "Conversa não encontrada." };
        const c = (color || "").trim();
        if (!CHAT_COLORS.has(c)) return { success: false, error: "Cor inválida." };
        await prisma.whatsappChat.update({ where: { id: chatId }, data: { color: c || null } });
        revalidatePath("/whatsapp");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] setChatColor:", error);
        return { success: false, error: error?.message || "Erro ao atualizar conversa." };
    }
}

/** Define/limpa um nome customizado da conversa (aparece só no sistema; o original fica menor). */
export async function setChatCustomName(chatId: string, customName: string): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const chat = await prisma.whatsappChat.findUnique({ where: { id: chatId }, include: { instance: true } });
        if (!chat || chat.instance.userId !== userId) return { success: false, error: "Conversa não encontrada." };
        const trimmed = (customName || "").trim();
        await prisma.whatsappChat.update({ where: { id: chatId }, data: { customName: trimmed || null } });
        revalidatePath("/whatsapp");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] setChatCustomName:", error);
        return { success: false, error: error?.message || "Erro ao atualizar conversa." };
    }
}

/** Arquiva/desarquiva uma conversa (some da lista, sai de métricas/alertas, fecha tarefa vinculada). */
export async function setChatArchived(chatId: string, archived: boolean): Promise<ActionResult> {
    try {
        const userId = await requireUserId();
        const chat = await prisma.whatsappChat.findUnique({ where: { id: chatId }, include: { instance: true } });
        if (!chat || chat.instance.userId !== userId) return { success: false, error: "Conversa não encontrada." };
        await prisma.whatsappChat.update({ where: { id: chatId }, data: { archived } });
        // ao arquivar, fecha a tarefa "Responder" vinculada (se houver)
        if (archived && chat.taskId) {
            await prisma.task.updateMany({ where: { id: chat.taskId, status: { not: "DONE" } }, data: { status: "DONE" } });
            await prisma.whatsappChat.update({ where: { id: chatId }, data: { taskId: null } });
        }
        revalidatePath("/whatsapp");
        return { success: true };
    } catch (error: any) {
        console.error("[whatsapp] setChatArchived:", error);
        return { success: false, error: error?.message || "Erro ao atualizar conversa." };
    }
}

// ── Métricas ─────────────────────────────────────────────────────────────────

export async function getWhatsappMetrics() {
    const userId = await requireUserId();
    const instances = await prisma.whatsappInstance.findMany({
        where: { userId },
        select: { id: true, instanceName: true, profileName: true },
    });
    const instanceIds = instances.map((i) => i.id);

    const empty = {
        instances: [] as { id: string; label: string }[],
        totals: { chats: 0, pending: 0, answered: 0, resolved: 0 },
        pendingByPriority: [] as { priority: string; label: string; count: number }[],
        pendingByInstance: [] as { label: string; count: number }[],
        avgResponseSeconds: null as number | null,
        respondedCount: 0,
    };
    if (instanceIds.length === 0) return empty;

    const baseWhere = { instanceId: { in: instanceIds }, ignored: false, archived: false };
    const [byStatus, byPriority, byInstance, respAgg, total] = await Promise.all([
        prisma.whatsappChat.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
        prisma.whatsappChat.groupBy({ by: ["priority"], where: { ...baseWhere, status: "pending" }, _count: { _all: true } }),
        prisma.whatsappChat.groupBy({ by: ["instanceId"], where: { ...baseWhere, status: "pending" }, _count: { _all: true } }),
        prisma.whatsappChat.aggregate({
            where: { ...baseWhere, lastResponseSeconds: { not: null } },
            _avg: { lastResponseSeconds: true },
            _count: { lastResponseSeconds: true },
        }),
        prisma.whatsappChat.count({ where: baseWhere }),
    ]);

    const statusCount = (s: string) => byStatus.find((x) => x.status === s)?._count._all ?? 0;
    const labelById = new Map(instances.map((i) => [i.id, i.profileName || i.instanceName]));
    const prioLabel: Record<string, string> = { high: "Alta", medium: "Média", low: "Baixa" };

    return {
        instances: instances.map((i) => ({ id: i.id, label: i.profileName || i.instanceName })),
        totals: {
            chats: total,
            pending: statusCount("pending"),
            answered: statusCount("answered"),
            resolved: statusCount("resolved"),
        },
        pendingByPriority: ["high", "medium", "low"].map((p) => ({
            priority: p,
            label: prioLabel[p],
            count: byPriority.find((x) => x.priority === p)?._count._all ?? 0,
        })),
        pendingByInstance: byInstance
            .map((x) => ({ label: labelById.get(x.instanceId) || "", count: x._count._all }))
            .sort((a, b) => b.count - a.count),
        avgResponseSeconds: respAgg._avg.lastResponseSeconds,
        respondedCount: respAgg._count.lastResponseSeconds,
    };
}

/** Resumo curto de SLA do WhatsApp para a dashboard. */
export async function getSlaSummary() {
    const userId = await requireUserId();
    const instances = await prisma.whatsappInstance.findMany({ where: { userId }, select: { id: true } });
    const ids = instances.map((i) => i.id);

    const empty = {
        hasInstances: false,
        pending: 0,
        pendingHigh: 0,
        oldestSeconds: null as number | null,
        oldestName: null as string | null,
        openTasks: 0,
    };
    if (ids.length === 0) return empty;

    const baseWhere = { instanceId: { in: ids }, ignored: false, archived: false };
    const [pending, pendingHigh, oldest, openTasks] = await Promise.all([
        prisma.whatsappChat.count({ where: { ...baseWhere, status: "pending" } }),
        prisma.whatsappChat.count({ where: { ...baseWhere, status: "pending", priority: "high" } }),
        prisma.whatsappChat.findFirst({
            where: { ...baseWhere, status: "pending", priority: "high", firstPendingAt: { not: null } },
            orderBy: { firstPendingAt: "asc" },
            select: { firstPendingAt: true, name: true, customName: true },
        }),
        prisma.task.count({ where: { assignedToId: userId, source: "whatsapp", status: { not: "DONE" } } }),
    ]);

    return {
        hasInstances: true,
        pending,
        pendingHigh,
        oldestSeconds: oldest?.firstPendingAt ? Math.round((Date.now() - oldest.firstPendingAt.getTime()) / 1000) : null,
        oldestName: oldest?.customName || oldest?.name || null,
        openTasks,
    };
}
