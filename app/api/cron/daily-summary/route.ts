import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionService } from "@/services/evolution";
import { pushService } from "@/services/push";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function GET(req: Request) {
    // Basic security: check for a secret token if you want to prevent unauthorized calls
    // In cron-job.org you can add a custom header or a query param
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get("Authorization");
    
    // For now keeping it simple as per request, but a secret would be good
    // if (searchParams.get("key") !== process.env.CRON_SECRET) {
    //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!settings || !settings.instanceName) {
            return NextResponse.json({ error: "Settings not configured" }, { status: 500 });
        }

        const users = await (prisma.user as any).findMany({
            where: {
                whatsapp: { not: null },
                notifyDailySummary: true,
                assignedTasks: {
                    some: {
                        status: { not: "DONE" }
                    }
                }
            },
            include: {
                assignedTasks: {
                    where: { status: { not: "DONE" } },
                    include: { project: { select: { name: true } } },
                    orderBy: { dueDate: "asc" }
                }
            }
        }) as any[];

        const results = {
            totalUsers: users.length,
            successCount: 0,
            failureCount: 0,
            errors: [] as string[]
        };

        for (const user of users) {
            if (!user.whatsapp) continue;

            console.log(`[Cron] Processing user: ${user.name} (${user.whatsapp})`);

            let message = `📝 *Resumo Diário de Tarefas* - ${format(new Date(), "dd/MM/yyyy")}\n\nOlá ${user.name || "Colaborador"}, aqui está o seu resumo de hoje:\n\n`;

            const threeDaysFromNow = new Date();
            threeDaysFromNow.setHours(23, 59, 59, 999);
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

            const overdue = user.assignedTasks.filter((t: any) => isPast(t.dueDate) && !isToday(t.dueDate));
            const upcoming = user.assignedTasks.filter((t: any) => {
                const isFuture = !isPast(t.dueDate) || isToday(t.dueDate);
                if (!isFuture) return false;
                
                // For recurring tasks, only show them on the EXACT due date
                if (t.isRecurring) {
                    return isToday(t.dueDate);
                }
                
                // For normal tasks, show only up to 3 days ahead to avoid spam
                const taskDate = new Date(t.dueDate);
                return taskDate <= threeDaysFromNow;
            });

            if (overdue.length > 0) {
                message += `🚨 *ATRASADAS:*\n`;
                overdue.forEach((task: any) => {
                    const date = format(task.dueDate, "dd/MM", { locale: ptBR });
                    const project = task.project ? `[${task.project.name}] ` : "";
                    message += `• ${project}${task.title} - *${date}*\n`;
                });
                message += `\n`;
            }

            if (upcoming.length > 0) {
                message += `📅 *PRÓXIMAS:*\n`;
                upcoming.forEach((task: any) => {
                    const date = format(task.dueDate, "dd/MM", { locale: ptBR });
                    const project = task.project ? `[${task.project.name}] ` : "";
                    message += `• ${project}${task.title} - ${date}\n`;
                });
            } else if (overdue.length === 0) {
                message += `✅ Você não tem tarefas pendentes!`;
            }

            message += `\n\n_Acesse o sistema para mais detalhes._ 🚀\n\nhttps://www.taskfreela.com.br/`;

            const result = await evolutionService.sendText(
                settings.instanceName,
                user.whatsapp,
                message
            );

            await pushService.sendToUser(user.id, {
                title: "Resumo Diário de Tarefas 📝",
                body: "O seu resumo diário já está disponível.",
                url: "https://www.taskfreela.com.br/dashboard"
            });

            if (result.success) {
                results.successCount++;
            } else {
                results.failureCount++;
                results.errors.push(`Failed to send to ${user.whatsapp}: ${result.error}`);
            }
        }

        console.log(`[Cron] Daily Summary finished. Results:`, results);

        return NextResponse.json({ 
            success: results.failureCount === 0, 
            ...results 
        });
    } catch (error) {
        console.error("[Cron] Daily Summary Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
