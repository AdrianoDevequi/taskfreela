import { getSettings } from "@/app/actions/settings";

export class EvolutionService {
    private formatNumber(number: string) {
        let cleaned = number.replace(/\D/g, "");
        // If it looks like a Brazilian number without country code (10 or 11 digits)
        if (cleaned.length === 10 || cleaned.length === 11) {
            cleaned = `55${cleaned}`;
        }
        return cleaned;
    }

    private async getConfig() {
        const settings = await getSettings();
        let baseUrl = settings?.apiUrl?.replace(/\/+$/, "") || "";
        
        if (baseUrl && !baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
            baseUrl = `https://${baseUrl}`;
        }

        return {
            baseUrl,
            apiKey: settings?.apiKey || "",
        };
    }

    async sendText(instanceName: string, number: string, text: string) {
        const { baseUrl, apiKey } = await this.getConfig();
        if (!baseUrl || !apiKey) {
            return { success: false, error: "Configuração da API Evolution ausente" };
        }

        const formattedNumber = this.formatNumber(number);

        try {
            const url = `${baseUrl}/message/sendText/${instanceName}`;
            console.log(`[Evolution] Sending message to ${formattedNumber}...`);

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": apiKey
                },
                body: JSON.stringify({
                    number: formattedNumber,
                    options: {
                        delay: 1200,
                        presence: "composing",
                        linkPreview: false
                    },
                    text: text,
                    textMessage: {
                        text
                    }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                console.error(`[Evolution] Error sending message to ${formattedNumber}: ${response.status} - ${error}`);
                return { success: false, error: `API Error ${response.status}: ${error}`, status: response.status };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error: any) {
            console.error(`[Evolution] Exception sending message to ${formattedNumber}:`, error);
            return { success: false, error: error.message || "Erro desconhecido" };
        }
    }
}

export const evolutionService = new EvolutionService();
