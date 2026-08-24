import { prisma } from "@/lib/prisma";

/**
 * Quando uma tarefa recorrente é concluída, já deixa a próxima ocorrência criada.
 * Extraído de /api/tasks pra ser reaproveitado pela API externa (/api/external e MCP).
 */
export async function createNextOccurrence(task: any) {
    if (!task?.isRecurring) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const atNoon = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return new Date(`${y}-${m}-${day}T12:00:00`);
    };

    let nextDueDate: Date | null = null;

    if (task.recurrencePattern === "DAILY") {
        const next = new Date(today);
        next.setDate(next.getDate() + 1);
        nextDueDate = atNoon(next);
    } else if (task.recurrencePattern === "WEEKLY") {
        const next = new Date(today);
        next.setDate(next.getDate() + 7);
        nextDueDate = atNoon(next);
    } else if (task.recurrencePattern === "MONTHLY") {
        const next = new Date(today);
        next.setMonth(next.getMonth() + 1);
        nextDueDate = atNoon(next);
    } else if (task.recurrencePattern === "CUSTOM_DAYS" && task.recurrenceDays) {
        const selectedDays = task.recurrenceDays.split(",").map(Number);
        if (selectedDays.length > 0) {
            let daysToAdd = 1;
            while (daysToAdd <= 7) {
                const checkDate = new Date(today);
                checkDate.setDate(checkDate.getDate() + daysToAdd);
                if (selectedDays.includes(checkDate.getDay())) {
                    nextDueDate = atNoon(checkDate);
                    break;
                }
                daysToAdd++;
            }
        } else {
            const next = new Date(today);
            next.setDate(next.getDate() + 1);
            nextDueDate = atNoon(next);
        }
    }

    if (!nextDueDate) return null;

    return prisma.task.create({
        data: {
            title: task.title,
            description: task.description,
            dueDate: nextDueDate,
            status: "TODO",
            estimatedTime: task.estimatedTime,
            isMandatory: task.isMandatory,
            isRecurring: task.isRecurring,
            recurrencePattern: task.recurrencePattern,
            recurrenceDays: task.recurrenceDays,
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            assignedToId: task.assignedToId,
            userId: task.userId, // Maintain the original creator
        } as any,
    });
}
