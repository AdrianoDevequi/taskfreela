import { NextResponse } from "next/server";
import { prisma, withDB } from "@/lib/prisma";
import { auth } from "@/auth";
import {
    sendTaskAssignmentNotification,
    sendTaskApprovalNotification,
    sendApprovalRequestNotification,
    sendTaskRejectionNotification,
} from "@/lib/task-notifications";
import { createNextOccurrence } from "@/lib/task-recurrence";

function getSession() {
    return auth();
}

// GET: Fetch all tasks for the user's workspace
export function GET() {
    return withDB(async () => { try {
        const session = await getSession();
        console.log("GET /api/tasks -> session:", JSON.stringify(session, null, 2));

        if (!session?.user?.id) {
            console.log("GET /api/tasks -> Missing session.user.id");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const workspaceId = (session.user as any).workspaceId as string | null;
        console.log("GET /api/tasks -> workspaceId:", workspaceId);

        if (!workspaceId) {
            console.log("GET /api/tasks -> Missing workspaceId, returning []");
            return NextResponse.json([]);
        }

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
                user: {
                    select: { id: true, name: true },
                },
                project: {
                    select: { id: true, name: true },
                }
            },
        });

        console.log("GET /api/tasks -> Found tasks count:", tasks.length);
        // Remap `user` to `createdBy` so the frontend can use it cleanly
        const mapped = tasks.map((t: any) => ({ ...t, createdBy: t.user, user: undefined }));
        return NextResponse.json(mapped);
    } catch (error) {
        console.error("GET /api/tasks Error:", error);
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    } });
}

// POST: Create a new task — MANAGER only
export function POST(req: Request) {
    return withDB(async () => { try {
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
                project: { select: { id: true, name: true, url: true } },
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
    } });
}

// PUT: Update a task
// - Status change: ALL workspace members can do this (moving Kanban cards)
// - Full edit (title, description, date): MANAGER only
export function PUT(req: Request) {
    return withDB(async () => { try {
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

        // Employees can only update status (move card on Kanban or request approval)
        if (!isStatusOnlyUpdate && role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden: Only managers can edit task details" }, { status: 403 });
        }

        // PENDING_APPROVAL: only the assignee can request approval
        if (status === 'PENDING_APPROVAL' && existing.assignedToId !== session.user.id) {
            return NextResponse.json({ error: "Only the assignee can request approval" }, { status: 403 });
        }

        // Approve/Reject: only the creator can do it
        if (existing.status === 'PENDING_APPROVAL' && (status === 'DONE' || status === 'APPROVED' || status === 'TODO') && existing.userId !== session.user.id) {
            // Allow managers and the creator
            if (role !== 'MANAGER' && role !== 'ADMIN') {
                return NextResponse.json({ error: "Only the task creator can approve or reject" }, { status: 403 });
            }
        }

        const updateData: any = {};
        if (status !== undefined) updateData.status = status;
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
        if (estimatedTime !== undefined) updateData.estimatedTime = estimatedTime;
        if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;
        if (projectId !== undefined) updateData.projectId = projectId || null;
        if (isMandatory !== undefined) updateData.isMandatory = isMandatory;
        if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
        if (recurrencePattern !== undefined) updateData.recurrencePattern = recurrencePattern;
        if (recurrenceDays !== undefined) updateData.recurrenceDays = recurrenceDays;

        const existingAny = existing as any;
        const isMovingToPending = status === 'PENDING_APPROVAL' && existing.status !== 'PENDING_APPROVAL';
        const isResolvingApproval = existing.status === 'PENDING_APPROVAL' && (status === 'APPROVED' || status === 'TODO');

        if (isMovingToPending) {
            // Muda responsável para o aprovador (criador da tarefa)
            updateData.originalAssignedToId = existing.assignedToId;
            updateData.assignedToId = existing.userId;
        } else if (isResolvingApproval) {
            // Restaura o responsável original
            updateData.assignedToId = existingAny.originalAssignedToId || existing.assignedToId;
            updateData.originalAssignedToId = null;

            if (status === 'TODO') {
                // Recusada: ajusta prazo para o próximo dia
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(12, 0, 0, 0);
                updateData.dueDate = tomorrow;
            }
        }

        const task = await prisma.task.update({
            where: { id: Number(id) },
            data: updateData,
            include: {
                assignedTo: { select: { id: true, name: true, email: true, image: true } },
                project: { select: { id: true, name: true, url: true } },
            },
        });

        // Notify if assignee changed manually (not via approval flow)
        if (!isMovingToPending && !isResolvingApproval && assignedToId && assignedToId !== existing.assignedToId && assignedToId !== session.user.id) {
            await sendTaskAssignmentNotification(task.id, assignedToId);
        }

        // Notify assignee when task is approved
        if (status === 'APPROVED' && existing.status !== 'APPROVED') {
            await sendTaskApprovalNotification(task.id);
        }

        // Notify original assignee when task is rejected
        if (status === 'TODO' && existing.status === 'PENDING_APPROVAL' && existingAny.originalAssignedToId) {
            await sendTaskRejectionNotification(task.id, existingAny.originalAssignedToId);
        }

        // Notify creator when assignee requests approval
        if (isMovingToPending) {
            await sendApprovalRequestNotification(task.id);
        }

        // Automatic Recurrence Logic: If marked as DONE and it's a recurring task
        if (status === "DONE" && existing.status !== "DONE") {
            await createNextOccurrence(task);
        }

        return NextResponse.json(task);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    } });
}

// DELETE: Remove a task — MANAGER only
export function DELETE(req: Request) {
    return withDB(async () => { try {
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
    } });
}
