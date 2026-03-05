import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET: Fetch all tasks
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        let tasks = await prisma.task.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
        });

        // Auto-migration for legacy tasks (Single user migration)
        if (tasks.length === 0) {
            const unassignedCount = await prisma.task.count({ where: { userId: null } });
            if (unassignedCount > 0) {
                await prisma.task.updateMany({
                    where: { userId: null },
                    data: { userId: session.user.id },
                });
                // Refetch after migration
                tasks = await prisma.task.findMany({
                    where: { userId: session.user.id },
                    orderBy: { createdAt: "desc" },
                });
            }
        }

        return NextResponse.json(tasks);
    } catch (error) {
        console.error("GET /api/tasks Error:", error);
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }
}

// POST: Create a new task
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { title, description, dueDate, status, estimatedTime } = body;

        const task = await prisma.task.create({
            data: {
                title,
                description,
                dueDate: new Date(dueDate), // Ensure Date object
                status: status || "TODO",
                estimatedTime,
                userId: session.user.id,
            },
        });

        return NextResponse.json(task);
    } catch (error) {
        console.error("POST /api/tasks Error:", error);
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }
}

// PUT: Update a task (Status only for now, can be expanded)
export async function PUT(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { id, status, title, description, dueDate, estimatedTime } = body;

        // Ensure ownership
        const existing = await prisma.task.findUnique({ where: { id: Number(id) } });
        if (!existing || existing.userId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const task = await prisma.task.update({
            where: { id: Number(id) },
            data: {
                status,
                title,
                description,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                estimatedTime
            },
        });

        return NextResponse.json(task);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }
}

// DELETE: Remove a task
export async function DELETE(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        // Ensure ownership
        const existing = await prisma.task.findUnique({ where: { id: Number(id) } });

        if (!existing || existing.userId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await prisma.task.delete({
            where: { id: Number(id) }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }
}
