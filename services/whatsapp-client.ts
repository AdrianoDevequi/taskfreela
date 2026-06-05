/**
 * Cliente da Evolution API parametrizado por { baseUrl, apiKey }.
 *
 * Diferente de services/evolution.ts (que lê a config global de `Settings` e só
 * envia notificações de tarefa), este cliente recebe as credenciais do servidor
 * Evolution de CADA usuário, permitindo multi-instância por usuário.
 *
 * Endpoints conforme PROMPT-NOVO-PROJETO-WHATSAPP.md (seção 3).
 */

export type WhatsappClientConfig = {
    baseUrl: string;
    apiKey: string;
};

export type EvolutionResult<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
    status?: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;

function normalizeBaseUrl(raw: string): string {
    let url = (raw || "").trim().replace(/\/+$/, "");
    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
    }
    return url;
}

/** Normaliza número para o formato esperado pela Evolution (DDI 55 p/ BR). */
export function formatNumber(number: string): string {
    let cleaned = (number || "").replace(/\D/g, "");
    if (cleaned.length === 10 || cleaned.length === 11) {
        cleaned = `55${cleaned}`;
    }
    return cleaned;
}

export class WhatsappClient {
    private baseUrl: string;
    private apiKey: string;

    constructor(config: WhatsappClientConfig) {
        this.baseUrl = normalizeBaseUrl(config.baseUrl);
        this.apiKey = config.apiKey || "";
    }

    private async request<T = any>(
        method: string,
        path: string,
        body?: unknown,
        opts?: { timeoutMs?: number }
    ): Promise<EvolutionResult<T>> {
        if (!this.baseUrl || !this.apiKey) {
            return { success: false, error: "Servidor Evolution não configurado (URL/chave ausente)." };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

        try {
            const response = await fetch(`${this.baseUrl}${path}`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    apikey: this.apiKey,
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            const text = await response.text();
            let data: any = undefined;
            try {
                data = text ? JSON.parse(text) : undefined;
            } catch {
                data = text;
            }

            if (!response.ok) {
                const message =
                    (data && (data.message || data.error || data.response?.message)) ||
                    (typeof data === "string" ? data : "") ||
                    `HTTP ${response.status}`;
                return {
                    success: false,
                    error: Array.isArray(message) ? message.join(", ") : String(message),
                    status: response.status,
                    data,
                };
            }

            return { success: true, data, status: response.status };
        } catch (error: any) {
            const aborted = error?.name === "AbortError";
            return {
                success: false,
                error: aborted ? "Tempo limite excedido ao falar com a Evolution." : error?.message || "Erro de rede.",
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    /** GET / — status/versão da API (smoke test de credenciais/URL). */
    ping() {
        return this.request("GET", "/");
    }

    /** GET /instance/fetchInstances — lista instâncias + estado de conexão. */
    fetchInstances() {
        return this.request("GET", "/instance/fetchInstances");
    }

    /** POST /instance/create — cria nova instância (Baileys, com QR). */
    createInstance(instanceName: string) {
        return this.request("POST", "/instance/create", {
            instanceName,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
        });
    }

    /** GET /instance/connect/{instance} — inicia pareamento, retorna QR base64. */
    connect(instanceName: string) {
        return this.request("GET", `/instance/connect/${encodeURIComponent(instanceName)}`);
    }

    /** GET /instance/connectionState/{instance} — estado atual da conexão. */
    connectionState(instanceName: string) {
        return this.request("GET", `/instance/connectionState/${encodeURIComponent(instanceName)}`);
    }

    /** DELETE /instance/logout/{instance} — desconecta a sessão (mantém a instância). */
    logout(instanceName: string) {
        return this.request("DELETE", `/instance/logout/${encodeURIComponent(instanceName)}`);
    }

    /** DELETE /instance/delete/{instance} — remove a instância no servidor. */
    deleteInstance(instanceName: string) {
        return this.request("DELETE", `/instance/delete/${encodeURIComponent(instanceName)}`);
    }

    /** POST /chat/findChats/{instance} — lista conversas. */
    findChats(instanceName: string) {
        return this.request("POST", `/chat/findChats/${encodeURIComponent(instanceName)}`, {});
    }

    /** POST /chat/findContacts/{instance} — lista contatos. */
    findContacts(instanceName: string) {
        return this.request("POST", `/chat/findContacts/${encodeURIComponent(instanceName)}`, {});
    }

    /** GET /group/fetchAllGroups/{instance} — lista grupos com o `subject` (nome real do grupo). */
    fetchAllGroups(instanceName: string, getParticipants = false) {
        return this.request(
            "GET",
            `/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=${getParticipants}`
        );
    }

    /** POST /chat/findMessages/{instance} — histórico de um chat. */
    findMessages(instanceName: string, remoteJid: string, limit = 50) {
        return this.request("POST", `/chat/findMessages/${encodeURIComponent(instanceName)}`, {
            where: { key: { remoteJid } },
            limit,
        });
    }

    /** POST /chat/fetchProfilePictureUrl/{instance} — URL da foto de perfil de um número/jid. */
    fetchProfilePictureUrl(instanceName: string, number: string, timeoutMs = 5000) {
        return this.request("POST", `/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`, { number }, { timeoutMs });
    }

    /** POST /chat/getBase64FromMediaMessage/{instance} — baixa a mídia (base64) de uma mensagem. */
    getBase64FromMediaMessage(
        instanceName: string,
        messageKey: { id: string; remoteJid: string; fromMe: boolean }
    ) {
        return this.request("POST", `/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`, {
            message: { key: messageKey },
            convertToMp4: false,
        });
    }

    /** POST /chat/markMessageAsRead/{instance} — marca mensagens como lidas. */
    markMessageAsRead(instanceName: string, readMessages: Array<{ remoteJid: string; fromMe: boolean; id: string }>) {
        return this.request("POST", `/chat/markMessageAsRead/${encodeURIComponent(instanceName)}`, {
            readMessages,
        });
    }

    /** POST /message/sendText/{instance} — envia texto (USAR só com confirmação). */
    sendText(instanceName: string, number: string, text: string) {
        return this.request("POST", `/message/sendText/${encodeURIComponent(instanceName)}`, {
            number: formatNumber(number),
            text,
            options: { delay: 1200, presence: "composing", linkPreview: false },
        });
    }

    /** POST /webhook/set/{instance} — configura webhook de eventos (formato Evolution v2.2+). */
    setWebhook(instanceName: string, url: string, events: string[]) {
        return this.request("POST", `/webhook/set/${encodeURIComponent(instanceName)}`, {
            webhook: {
                enabled: true,
                url,
                webhookByEvents: false,
                webhookBase64: false,
                events,
            },
        });
    }
}

export function createWhatsappClient(config: WhatsappClientConfig) {
    return new WhatsappClient(config);
}
