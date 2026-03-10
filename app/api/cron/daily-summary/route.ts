import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionService } from "@/services/evolution";
import { format, isPast, isToday, startOfDay } from "date-fns";
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

        const users = await prisma.user.findMany({
            where: {
                whatsapp: { not: null },
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
        });

        console.log(`[Cron] Found ${users.length} users with pending tasks for summary.`);

        for (const user of users) {
            if (!user.whatsapp) continue;

            let message = `📝 *Resumo Diário de Tarefas* - ${format(new Date(), "dd/MM/yyyy")}\n\nOlá ${user.name || "Colaborador"}, aqui está o seu resumo de hoje:\n\n`;

            const overdue = user.assignedTasks.filter(t => isPast(t.dueDate) && !isToday(t.dueDate));
            const upcoming = user.assignedTasks.filter(t => !isPast(t.dueDate) || isToday(t.dueDate));

            if (overdue.length > 0) {
                message += `🚨 *ATRASADAS:*\n`;
                overdue.forEach(task => {
                    const date = format(task.dueDate, "dd/MM", { locale: ptBR });
                    const project = task.project ? `[${task.project.name}] ` : "";
                    message += `• ${project}${task.title} - *${date}*\n`;
                });
                message += `\n`;
            }

            if (upcoming.length > 0) {
                message += `📅 *PRÓXIMAS:*\n`;
                upcoming.forEach(task => {
                    const date = format(task.dueDate, "dd/MM", { locale: ptBR });
                    const project = task.project ? `[${task.project.name}] ` : "";
                    message += `• ${project}${task.title} - ${date}\n`;
                });
            } else if (overdue.length === 0) {
                message += `✅ Você não tem tarefas pendentes!`;
            }

            message += `\n\n_Acesse o sistema para mais detalhes._ 🚀`;

            await evolutionService.sendText(
                settings.instanceName,
                user.whatsapp,
                message
            );
        }

        return NextResponse.json({ success: true, usersNotified: users.length });
    } catch (error) {
        console.error("[Cron] Daily Summary Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
