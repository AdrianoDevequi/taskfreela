import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

function getSession() {
    return auth();
}

export async function GET(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const taskId = searchParams.get("taskId");

        if (!taskId) {
            return NextResponse.json({ error: "taskId is required" }, { status: 400 });
        }

        // Verify that the task belongs to the user's active workspace
        const activeWorkspaceId = (session.user as any).workspaceId as string | null;
        if (!activeWorkspaceId) {
            return NextResponse.json({ error: "No active workspace" }, { status: 400 });
        }

        const task = await prisma.task.findFirst({
            where: {
                id: parseInt(taskId),
                workspaceId: activeWorkspaceId
            }
        });

        if (!task) {
            return NextResponse.json({ error: "Task not found or access denied" }, { status: 404 });
        }

        // Fetch comments
        const comments = await prisma.comment.findMany({
            where: { taskId: task.id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        return NextResponse.json(comments);

    } catch (error) {
        console.error("GET /api/tasks/comments Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { taskId, content } = body;

        if (!taskId || !content) {
            return NextResponse.json({ error: "taskId and content are required" }, { status: 400 });
        }

        // Verify that the task belongs to the user's active workspace
        const activeWorkspaceId = (session.user as any).workspaceId as string | null;
        if (!activeWorkspaceId) {
            return NextResponse.json({ error: "No active workspace" }, { status: 400 });
        }

        const task = await prisma.task.findFirst({
            where: {
                id: parseInt(taskId),
                workspaceId: activeWorkspaceId
            }
        });

        if (!task) {
            return NextResponse.json({ error: "Task not found or access denied" }, { status: 404 });
        }

        const comment = await prisma.comment.create({
            data: {
                content,
                taskId: task.id,
                userId: session.user.id
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    }
                }
            }
        });

        return NextResponse.json({ success: true, comment });

    } catch (error) {
        console.error("POST /api/tasks/comments Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
