import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET: List all members of the current user's workspace
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const workspaceId = (session.user as any).workspaceId as string | null;
        if (!workspaceId) return NextResponse.json([]);

        const members = await prisma.user.findMany({
            where: { workspaceId },
            select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json(members);
    } catch (error) {
        console.error("GET /api/team Error:", error);
        return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
    }
}

// POST: Add a member to the workspace by email (MANAGER only)
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const role = (session.user as any).role as string;
        const workspaceId = (session.user as any).workspaceId as string | null;

        if (role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { email, memberRole } = await req.json();
        if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

        const targetUser = await prisma.user.findUnique({ where: { email } });
        if (!targetUser) {
            return NextResponse.json({ error: "User not found. They must register first." }, { status: 404 });
        }

        if (targetUser.workspaceId && targetUser.workspaceId !== workspaceId) {
            return NextResponse.json({ error: "User already belongs to another workspace." }, { status: 409 });
        }

        const updated = await prisma.user.update({
            where: { id: targetUser.id },
            data: {
                workspaceId: workspaceId!,
                role: memberRole || "EMPLOYEE",
            },
            select: { id: true, name: true, email: true, image: true, role: true },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("POST /api/team Error:", error);
        return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
    }
}

// DELETE: Remove a member from the workspace (MANAGER only, cannot remove themselves)
export async function DELETE(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const role = (session.user as any).role as string;
        const workspaceId = (session.user as any).workspaceId as string | null;

        if (role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");
        if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

        if (userId === session.user.id) {
            return NextResponse.json({ error: "Cannot remove yourself from workspace" }, { status: 400 });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser || targetUser.workspaceId !== workspaceId) {
            return NextResponse.json({ error: "User not in your workspace" }, { status: 404 });
        }

        await prisma.user.update({
            where: { id: userId },
            data: { workspaceId: null, role: "EMPLOYEE" },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }
}
