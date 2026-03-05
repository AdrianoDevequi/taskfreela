import { getSettings } from "@/app/actions/settings";

export class EvolutionService {
    private async getConfig() {
        const settings = await getSettings();
        return {
            baseUrl: settings?.apiUrl?.replace(/\/+$/, "") || "",
            apiKey: settings?.apiKey || "",
        };
    }

    async sendText(instanceName: string, number: string, text: string) {
        const { baseUrl, apiKey } = await this.getConfig();
        if (!baseUrl || !apiKey) {
            console.error("Evolution API Configuration missing");
            return false;
        }

        try {
            // Evolution API v2/v1 generic endpoint construction
            // Typically: /message/sendText/{instanceName}
            const url = `${baseUrl}/message/sendText/${instanceName}`;

            console.log(`[Evolution] Sending message to ${number}...`);

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": apiKey
                },
                body: JSON.stringify({
                    number,
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
                console.error(`[Evolution] Error sending message: ${response.status} - ${error}`);
                return false;
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`[Evolution] Exception sending message to ${number}:`, error);
            return false;
        }
    }
}

export const evolutionService = new EvolutionService();
