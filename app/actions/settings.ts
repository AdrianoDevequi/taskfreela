"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { evolutionService } from "@/services/evolution";

export async function saveSettings(formData: FormData) {
    const apiUrl = formData.get("apiUrl") as string;
    const apiKey = formData.get("apiKey") as string;
    const instanceName = formData.get("instanceName") as string;
    const notificationPhone = formData.get("notificationPhone") as string;

    try {
        await prisma.settings.upsert({
            where: { id: 1 },
            update: {
                apiUrl,
                apiKey,
                instanceName,
                notificationPhone
            },
            create: {
                id: 1,
                apiUrl,
                apiKey,
                instanceName,
                notificationPhone
            }
        });

        revalidatePath("/configuracoes");
        return { success: true };
    } catch (error) {
        console.error("Failed to save settings:", error);
        return { success: false, error: "Failed to save settings" };
    }
}

export async function getSettings() {
    try {
        const settings = await prisma.settings.findUnique({
            where: { id: 1 }
        });
        return settings;
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return null;
    }
}

export async function sendTestMessage() {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });

        if (!settings || !settings.notificationPhone || !settings.instanceName) {
            return { success: false, error: "Configurações incompletas." };
        }

        const message = "🔔 *Teste de Conexão - TaskFlow*\n\nSe você recebeu esta mensagem, a integração com o Evolution API está funcionando corretamente! 🚀";

        const result = await evolutionService.sendText(
            settings.instanceName,
            settings.notificationPhone,
            message
        );

        if (result) {
            return { success: true };
        } else {
            return { success: false, error: "Falha ao enviar mensagem (Verifique logs)." };
        }
    } catch (error) {
        console.error("Test message failed:", error);
        return { success: false, error: "Erro interno ao enviar teste." };
    }
}

export async function triggerManualNotifications() {
    try {
        const { checkOverdueTasks } = await import("@/services/scheduler");
        return await checkOverdueTasks();
    } catch (error) {
        console.error("Manual trigger failed:", error);
        return { success: false, error: "Erro ao executar disparo manual." };
    }
}
