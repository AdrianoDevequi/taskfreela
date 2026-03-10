import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// GET: List all members of the current user's workspace
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const workspaceId = (session.user as any).workspaceId as string | null;
        if (!workspaceId) return NextResponse.json([]);

        const workspaceMembers = await prisma.workspaceMember.findMany({
            where: { workspaceId },
            include: { user: { select: { id: true, name: true, email: true, image: true, createdAt: true } } },
            orderBy: { createdAt: "asc" },
        });

        const members = workspaceMembers.map(wm => ({
            ...wm.user,
            role: wm.role
        }));

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

        // Always check DB to prevent stale session token issues
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaceMembers: true }
        });
        
        const workspaceId = currentUser?.activeWorkspaceId;
        const activeMember = currentUser?.workspaceMembers.find(m => m.workspaceId === workspaceId);
        const role = activeMember?.role;

        if (role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { email, memberRole } = await req.json();
        if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

        const targetUser = await prisma.user.findUnique({ where: { email } });
        if (!targetUser) {
            return NextResponse.json({ error: "User not found. They must register first." }, { status: 404 });
        }

        const existingMember = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: targetUser.id, workspaceId: workspaceId! } }
        });

        if (existingMember) {
            return NextResponse.json({ error: "User already belongs to this workspace." }, { status: 409 });
        }

        const newMember = await prisma.workspaceMember.create({
            data: {
                userId: targetUser.id,
                workspaceId: workspaceId!,
                role: memberRole || "EMPLOYEE",
            },
        });

        // Switch the invited user automatically to this new team
        // This solves the issue of users being stuck in their auto-generated workspace upon registration
        await prisma.user.update({
            where: { id: targetUser.id },
            data: { activeWorkspaceId: workspaceId! }
        });

        return NextResponse.json({
            id: targetUser.id,
            name: targetUser.name,
            email: targetUser.email,
            image: targetUser.image,
            role: newMember.role
        });
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

        // Always check DB to prevent stale session token issues
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaceMembers: true }
        });
        
        const workspaceId = currentUser?.activeWorkspaceId;
        const activeMember = currentUser?.workspaceMembers.find(m => m.workspaceId === workspaceId);
        const role = activeMember?.role;

        if (role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");
        if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

        if (userId === session.user.id) {
            return NextResponse.json({ error: "Cannot remove yourself from workspace" }, { status: 400 });
        }

        const existingMember = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId, workspaceId: workspaceId! } }
        });
        
        if (!existingMember) {
            return NextResponse.json({ error: "User not in your workspace" }, { status: 404 });
        }

        await prisma.workspaceMember.delete({
            where: { id: existingMember.id },
        });

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (targetUser?.activeWorkspaceId === workspaceId) {
            const remaining = await prisma.workspaceMember.findFirst({ where: { userId }});
            await prisma.user.update({
                where: { id: userId },
                data: { activeWorkspaceId: remaining ? remaining.workspaceId : null }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }
}

// PATCH: Update member's role (MANAGER only)
export async function PATCH(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Check DB for current user role
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaceMembers: true }
        });
        
        const workspaceId = currentUser?.activeWorkspaceId;
        const activeMember = currentUser?.workspaceMembers.find(m => m.workspaceId === workspaceId);
        const currentUserRole = activeMember?.role;

        if (currentUserRole !== "MANAGER" && currentUserRole !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { userId, role } = await req.json();

        if (!userId || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Prevent changing own role
        if (userId === session.user.id) {
            return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
        }

        const existingMember = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId, workspaceId: workspaceId! } }
        });

        if (!existingMember) {
            return NextResponse.json({ error: "User not in your workspace" }, { status: 404 });
        }

        await prisma.workspaceMember.update({
            where: { id: existingMember.id },
            data: { role }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("PATCH /api/team Error:", error);
        return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
    }
}
