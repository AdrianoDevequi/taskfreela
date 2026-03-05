import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const range = searchParams.get('range') || '30'; // Default 30 days
        const days = parseInt(range);

        const startDate = startOfDay(subDays(new Date(), days));

        // 1. Fetch Tasks within range
        const tasks = await prisma.task.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                },
            },
        });

        // 2. Metrics Calculation
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'DONE').length;
        const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
        const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

        // 3. Status Distribution (for Pie/Bar Chart)
        const statusDistribution = [
            { name: 'A Fazer', value: tasks.filter(t => t.status === 'TODO').length, fill: '#a855f7' },
            { name: 'Em Progresso', value: inProgressTasks, fill: '#3b82f6' },
            { name: 'Concluído', value: completedTasks, fill: '#22c55e' },
        ];

        // 4. Activity Over Time (for Area Chart)
        // Create map of last X days initialized to 0
        const activityMap = new Map();
        for (let i = days; i >= 0; i--) {
            const date = subDays(new Date(), i);
            const key = format(date, 'dd/MM', { locale: ptBR });
            activityMap.set(key, { name: key, created: 0, completed: 0 });
        }

        // Populate map
        tasks.forEach(task => {
            const createdKey = format(new Date(task.createdAt), 'dd/MM', { locale: ptBR });
            if (activityMap.has(createdKey)) {
                activityMap.get(createdKey).created += 1;
            }

            // Note: This approximates completion date as updated_at if status is done, 
            // which is "good enough" for prototype if we didn't track completedAt explicitly.
            if (task.status === 'DONE') {
                const completeKey = format(new Date(task.updatedAt), 'dd/MM', { locale: ptBR });
                if (activityMap.has(completeKey)) {
                    activityMap.get(completeKey).completed += 1;
                }
            }
        });

        const activityData = Array.from(activityMap.values());

        return NextResponse.json({
            metrics: {
                total: totalTasks,
                completed: completedTasks,
                inProgress: inProgressTasks,
                rate: completionRate,
            },
            statusDistribution,
            activityData
        });

    } catch (error) {
        console.error("Reports API Error:", error);
        return NextResponse.json({ error: "Failed to fetch report data" }, { status: 500 });
    }
}
