import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { evolutionService } from "@/services/evolution";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function getSession() {
    return auth();
}

async function sendTaskAssignmentNotification(taskId: number, assignedToId: string) {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!settings || !settings.instanceName) return;

        const task = await (prisma.task as any).findUnique({
            where: { id: taskId },
            include: {
                assignedTo: { select: { name: true, whatsapp: true, notifyNewTasks: true } },
                project: { select: { name: true } }
            }
        });

        if (!task || !task.assignedTo?.whatsapp || !task.assignedTo.notifyNewTasks) return;

        const date = format(task.dueDate, "dd/MM/yyyy", { locale: ptBR });
        const projectInfo = task.project ? `\n*Projeto:* ${task.project.name}` : "";
        
        const message = `👋 Olá ${task.assignedTo.name}!\n\nUma nova tarefa foi atribuída a você:\n\n*Título:* ${task.title}${projectInfo}\n*Data de Entrega:* ${date}\n\nBoa sorte! 🚀\n\nhttps://www.taskfreela.com.br/`;

        await evolutionService.sendText(
            settings.instanceName,
            task.assignedTo.whatsapp,
            message
        );
    } catch (error) {
        console.error("Error sending WhatsApp notification:", error);
    }
}

// GET: Fetch all tasks for the user's workspace
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const workspaceId = (session.user as any).workspaceId as string | null;
        if (!workspaceId) return NextResponse.json([]);

        const tasks = await prisma.task.findMany({
            where: { workspaceId },
            orderBy: [
                { dueDate: "asc" },
                { createdAt: "desc" }
            ],
            include: {
                assignedTo: {
                    select: { id: true, name: true, email: true, image: true },
                },
                project: {
                    select: { id: true, name: true },
                }
            },
        });

        return NextResponse.json(tasks);
    } catch (error) {
        console.error("GET /api/tasks Error:", error);
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }
}

// POST: Create a new task — MANAGER only
export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const role = (session.user as any).role as string;
        const workspaceId = (session.user as any).workspaceId as string | null;

        if (role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden: Only managers can create tasks" }, { status: 403 });
        }
        if (!workspaceId) {
            return NextResponse.json({ error: "No workspace assigned" }, { status: 400 });
        }

        const body = await req.json();
        const { title, description, dueDate, status, estimatedTime, assignedToId, projectId, isMandatory, isRecurring, recurrencePattern, recurrenceDays } = body;

        const task = await prisma.task.create({
            data: {
                title,
                description,
                dueDate: new Date(dueDate),
                status: status || "TODO",
                estimatedTime,
                userId: session.user.id,
                workspaceId,
                assignedToId: assignedToId || session.user.id,
                projectId: projectId || null,
                isMandatory: typeof isMandatory === 'boolean' ? isMandatory : false,
                isRecurring: typeof isRecurring === 'boolean' ? isRecurring : false,
                recurrencePattern: recurrencePattern || null,
                recurrenceDays: recurrenceDays || null,
            } as any,
            include: {
                assignedTo: { select: { id: true, name: true, email: true, image: true } },
                project: { select: { id: true, name: true } },
            },
        });

        if (task.assignedToId && task.assignedToId !== session.user.id) {
            // Await is required on Vercel so the serverless function doesn't termianate early
            await sendTaskAssignmentNotification(task.id, task.assignedToId);
        }

        return NextResponse.json(task);
    } catch (error) {
        console.error("POST /api/tasks Error:", error);
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }
}

// PUT: Update a task
// - Status change: ALL workspace members can do this (moving Kanban cards)
// - Full edit (title, description, date): MANAGER only
export async function PUT(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const role = (session.user as any).role as string;
        const workspaceId = (session.user as any).workspaceId as string | null;

        const body = await req.json();
        const { id, status, title, description, dueDate, estimatedTime, assignedToId, projectId, isMandatory, isRecurring, recurrencePattern, recurrenceDays } = body;

        // Ensure task belongs to same workspace
        const existing = await prisma.task.findUnique({ where: { id: Number(id) } });
        if (!existing || existing.workspaceId !== workspaceId) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        const isStatusOnlyUpdate = status !== undefined && !title && !description && !dueDate;

        // Employees can only update status (move card on Kanban)
        if (!isStatusOnlyUpdate && role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden: Only managers can edit task details" }, { status: 403 });
        }

        const task = await prisma.task.update({
            where: { id: Number(id) },
            data: {
                ...(status !== undefined && { status }),
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
                ...(estimatedTime !== undefined && { estimatedTime }),
                ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
                ...(projectId !== undefined && { projectId: projectId || null }),
                ...(isMandatory !== undefined && { isMandatory }),
                ...(isRecurring !== undefined && { isRecurring }),
                ...(recurrencePattern !== undefined && { recurrencePattern }),
                ...(recurrenceDays !== undefined && { recurrenceDays }),
            } as any,
            include: {
                assignedTo: { select: { id: true, name: true, email: true, image: true } },
                project: { select: { id: true, name: true } },
            },
        });

        // Trigger notification if assignedTo was changed and it's not a self-assignment
        if (assignedToId && assignedToId !== existing.assignedToId && assignedToId !== session.user.id) {
            // Await is required on Vercel
            await sendTaskAssignmentNotification(task.id, assignedToId);
        }

        // Automatic Recurrence Logic: If marked as DONE and it's a recurring task
        const t = task as any;
        if (status === "DONE" && existing.status !== "DONE" && t.isRecurring) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let nextDueDate: Date | null = null;
            const formatDateLocal = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return new Date(`${y}-${m}-${day}T12:00:00`);
            };

            if (t.recurrencePattern === "DAILY") {
                const next = new Date(today);
                next.setDate(next.getDate() + 1);
                nextDueDate = formatDateLocal(next);
            } else if (t.recurrencePattern === "WEEKLY") {
                const next = new Date(today);
                next.setDate(next.getDate() + 7);
                nextDueDate = formatDateLocal(next);
            } else if (t.recurrencePattern === "MONTHLY") {
                const next = new Date(today);
                next.setMonth(next.getMonth() + 1);
                nextDueDate = formatDateLocal(next);
            } else if (t.recurrencePattern === "CUSTOM_DAYS" && t.recurrenceDays) {
                const selectedDays = t.recurrenceDays.split(',').map(Number);
                if (selectedDays.length > 0) {
                    let daysToAdd = 1;
                    while (daysToAdd <= 7) {
                        const checkDate = new Date(today);
                        checkDate.setDate(checkDate.getDate() + daysToAdd);
                        if (selectedDays.includes(checkDate.getDay())) {
                            nextDueDate = formatDateLocal(checkDate);
                            break;
                        }
                        daysToAdd++;
                    }
                } else {
                    const next = new Date(today);
                    next.setDate(next.getDate() + 1);
                    nextDueDate = formatDateLocal(next);
                }
            }

            if (nextDueDate) {
                // Create the next occurrence
                await prisma.task.create({
                    data: {
                        title: t.title,
                        description: t.description,
                        dueDate: nextDueDate,
                        status: "TODO",
                        estimatedTime: t.estimatedTime,
                        isMandatory: t.isMandatory,
                        isRecurring: t.isRecurring,
                        recurrencePattern: t.recurrencePattern,
                        recurrenceDays: t.recurrenceDays,
                        workspaceId: t.workspaceId,
                        projectId: t.projectId,
                        assignedToId: t.assignedToId,
                        userId: t.userId, // Maintain the original creator
                    } as any
                });
            }
        }

        return NextResponse.json(task);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }
}

// DELETE: Remove a task — MANAGER only
export async function DELETE(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const role = (session.user as any).role as string;
        const workspaceId = (session.user as any).workspaceId as string | null;

        if (role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden: Only managers can delete tasks" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        const existing = await prisma.task.findUnique({ where: { id: Number(id) } });
        if (!existing || existing.workspaceId !== workspaceId) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        await prisma.task.delete({ where: { id: Number(id) } });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }
}
