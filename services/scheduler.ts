import { prisma } from "@/lib/prisma";
import { evolutionService } from "@/services/evolution";
import { pushService } from "@/services/push";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function checkOverdueTasks() {
    console.log("[Scheduler] Checking for overdue tasks...");

    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!settings || !settings.instanceName) {
            console.log("[Scheduler] WhatsApp instance not configured.");
            return { success: false, error: "Settings missing" };
        }

        const now = new Date();

        // 1. Fetch users who have WhatsApp configured AND want overdue notifications
        const users = await (prisma.user as any).findMany({
            where: {
                whatsapp: { not: null },
                notifyOverdueTasks: true,
                assignedTasks: {
                    some: {
                        status: { not: "DONE" },
                        dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } // Overdue (before today)
                    }
                }
            },
            include: {
                assignedTasks: {
                    where: {
                        status: { not: "DONE" },
                        dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) }
                    },
                    orderBy: { dueDate: "asc" },
                    include: { project: { select: { name: true } } }
                }
            }
        });

        if (users.length === 0) {
            console.log("[Scheduler] No overdue tasks found for notified users.");
            return { success: true, count: 0, message: "No overdue tasks sent" };
        }

        console.log(`[Scheduler] Found ${users.length} users with overdue tasks.`);
        let totalMessagesSent = 0;

        // 2. Send individualized message to each user
        for (const user of users) {
            if (!user.whatsapp) continue;

            const overdueCount = user.assignedTasks.length;
            
            let message = `⚠️ Olá ${user.name},\n\n`;
            message += `Você possui *${overdueCount}* tarefa(s) ATRASADA(S) no momento.\n\n`;
            
            user.assignedTasks.forEach((task: any) => {
                const date = format(new Date(task.dueDate), "dd/MM/yyyy", { locale: ptBR });
                const projectTag = task.project ? `[${task.project.name}] ` : "";
                message += `🚨 ${projectTag}*${task.title}* (Venceu em: ${date})\n`;
            });

            message += `\nPor favor, atualize o status ou a data de entrega no sistema.\n\nhttps://www.taskfreela.com.br/`;

            try {
                await evolutionService.sendText(
                    settings.instanceName,
                    user.whatsapp,
                    message
                );

                await pushService.sendToUser(user.id, {
                    title: "Tarefas Atrasadas 🚨",
                    body: `Você possui ${overdueCount} tarefa(s) atrasada(s).`,
                    url: "https://www.taskfreela.com.br/dashboard"
                });

                totalMessagesSent++;

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`[Scheduler] Failed to send overdue notification to ${user.email}:`, error);
            }
        }

        return { success: true, count: totalMessagesSent, message: "Individual overdue notifications sent" };

    } catch (error) {
        console.error("[Scheduler] Error:", error);
        return { success: false, error: String(error) };
    }
}

export async function checkMandatoryTasks() {
    console.log("[Scheduler] Checking for mandatory tasks...");

    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!settings || !settings.instanceName) {
            console.log("[Scheduler] WhatsApp instance not configured.");
            return { success: false, error: "Settings missing" };
        }

        // Time check: only run between 08:00 and 20:00 (Brazil Time UTC-3)
        const now = new Date();
        const brazilFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            hour: 'numeric',
            hour12: false
        });
        const brazilHour = parseInt(brazilFormatter.format(now));

        if (brazilHour < 8 || brazilHour >= 20) {
            console.log(`[Scheduler] Outside allowed time window (${brazilHour}h, allowed: 08:00 - 20:00). Aborting.`);
            return { success: true, count: 0, message: "Outside allowed time window" };
        }

        // We want tasks due *today*
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch users who have WhatsApp configured AND want mandatory task notifications
        const users = await (prisma.user as any).findMany({
            where: {
                whatsapp: { not: null },
                notifyMandatoryTasks: true,
                assignedTasks: {
                    some: {
                        isMandatory: true,
                        status: { not: "DONE" },
                        dueDate: {
                            gte: startOfDay,
                            lte: endOfDay
                        }
                    }
                }
            },
            include: {
                assignedTasks: {
                    where: {
                        isMandatory: true,
                        status: { not: "DONE" },
                        dueDate: {
                            gte: startOfDay,
                            lte: endOfDay
                        }
                    },
                    orderBy: { estimatedTime: "asc" },
                    include: { project: { select: { name: true } } }
                }
            }
        });

        if (users.length === 0) {
            console.log("[Scheduler] No mandatory tasks found for today for notified users.");
            return { success: true, count: 0, message: "No mandatory tasks sent" };
        }

        console.log(`[Scheduler] Found ${users.length} users with mandatory tasks today.`);
        let totalMessagesSent = 0;

        for (const user of users) {
            if (!user.whatsapp) continue;

            const mandatoryCount = user.assignedTasks.length;
            
            let message = `⚠️ Olá ${user.name},\n\n`;
            message += `Você possui *${mandatoryCount}* tarefa(s) COM PRAZO OBRIGATÓRIO PARA HOJE.\n\n`;
            
            user.assignedTasks.forEach((task: any) => {
                const projectTag = task.project ? `[${task.project.name}] ` : "";
                message += `⏳ ${projectTag}*${task.title}* (Para hoje!)\n`;
            });

            message += `\nEssa tarefa precisa ser entregue hoje, verifique por favor.\n\nhttps://www.taskfreela.com.br/`;

            try {
                await evolutionService.sendText(
                    settings.instanceName,
                    user.whatsapp,
                    message
                );

                await pushService.sendToUser(user.id, {
                    title: "Tarefas Obrigatórias de Hoje 📌",
                    body: `Você possui ${mandatoryCount} tarefa(s) obrigatória(s) para hoje.`,
                    url: "https://www.taskfreela.com.br/dashboard"
                });

                totalMessagesSent++;

                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`[Scheduler] Failed to send mandatory notification to ${user.email}:`, error);
            }
        }

        return { success: true, count: totalMessagesSent, message: "Individual mandatory notifications sent" };

    } catch (error) {
        console.error("[Scheduler] Error:", error);
        return { success: false, error: String(error) };
    }
}
