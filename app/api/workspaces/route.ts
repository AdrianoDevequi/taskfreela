import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const memberships = await prisma.workspaceMember.findMany({
            where: { userId: session.user.id },
            include: { workspace: true },
            orderBy: { workspace: { name: 'asc' } }
        });

        const workspaces = memberships.map(m => ({
            id: m.workspace.id,
            name: m.workspace.name,
            role: m.role
        }));

        return NextResponse.json(workspaces);
    } catch (error) {
        console.error("GET /api/workspaces Error:", error);
        return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
    }
}
