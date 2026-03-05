
import { prisma } from "@/lib/prisma";
import { evolutionService } from "@/services/evolution";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function checkOverdueTasks() {
    console.log("[Scheduler] Checking for overdue tasks...");

    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });

        if (!settings || !settings.notificationPhone || !settings.instanceName) {
            console.log("[Scheduler] Notification settings not configured.");
            return { success: false, error: "Settings missing" };
        }

        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999); // End of yesterday

        // Find tasks due before today (so, strictly yesterday or older) that are NOT done
        const overdueTasks = await prisma.task.findMany({
            where: {
                dueDate: {
                    lt: new Date(new Date().setHours(0, 0, 0, 0)) // Less than today start
                },
                status: {
                    not: "DONE"
                }
            }
        });

        if (overdueTasks.length === 0) {
            console.log("[Scheduler] No overdue tasks found.");
            return { success: true, count: 0 };
        }

        console.log(`[Scheduler] Found ${overdueTasks.length} overdue tasks.`);

        let message = `🤖 *Relatório de Tarefas Atrasadas* 📅 ${format(now, "dd/MM/yyyy")}\n\n`;

        overdueTasks.forEach(task => {
            const date = format(task.dueDate, "dd/MM/yyyy", { locale: ptBR });
            message += `A tarefa ID: ${task.id} - ${task.title} [Data: ${date}] está em atraso, por favor verifique\n\n`;
        });

        message += `⚠️ _Acesse o sistema para regularizar._`;

        await evolutionService.sendText(
            settings.instanceName,
            settings.notificationPhone,
            message
        );

        return { success: true, count: overdueTasks.length };

    } catch (error) {
        console.error("[Scheduler] Error:", error);
        return { success: false, error: String(error) };
    }
}
