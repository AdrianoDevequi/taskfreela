import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { workspaceId } = body;

        if (!workspaceId) return NextResponse.json({ error: "Workspace ID required" }, { status: 400 });

        // Verify if the user is actually a member of this workspace
        const membership = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: session.user.id,
                    workspaceId,
                }
            }
        });

        if (!membership) {
            return NextResponse.json({ error: "Forbidden: Not a member of this workspace" }, { status: 403 });
        }

        // Update active workspace
        await prisma.user.update({
            where: { id: session.user.id },
            data: { activeWorkspaceId: workspaceId }
        });

        return NextResponse.json({ success: true, workspaceId });
    } catch (error) {
        console.error("POST /api/workspaces/switch Error:", error);
        return NextResponse.json({ error: "Failed to switch workspace" }, { status: 500 });
    }
}
