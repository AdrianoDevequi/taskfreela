import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

function getSession() {
    return auth();
}

// GET: Fetch all projects for the user's workspace
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const workspaceId = (session.user as any).workspaceId as string | null;

        // If user has no workspace yet, return empty
        if (!workspaceId) return NextResponse.json([]);

        const projects = await prisma.project.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
            include: {
                _count: {
                    select: { tasks: true }
                }
            }
        });

        return NextResponse.json(projects);
    } catch (error) {
        console.error("GET /api/projects Error:", error);
        return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }
}

// POST: Create a new project — MANAGER/ADMIN only
export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const role = (session.user as any).role as string;
        const workspaceId = (session.user as any).workspaceId as string | null;

        if (role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden: Only managers can create projects" }, { status: 403 });
        }
        if (!workspaceId) {
            return NextResponse.json({ error: "No workspace assigned" }, { status: 400 });
        }

        const body = await req.json();
        const { name, description, status } = body;

        // name is required
        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const project = await prisma.project.create({
            data: {
                name,
                description,
                status: status || "ACTIVE",
                workspaceId,
            },
        });

        return NextResponse.json(project);
    } catch (error) {
        console.error("POST /api/projects Error:", error);
        return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }
}

// PUT: Update a project — MANAGER/ADMIN only
export async function PUT(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const role = (session.user as any).role as string;
        const workspaceId = (session.user as any).workspaceId as string | null;

        if (role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden: Only managers can edit projects" }, { status: 403 });
        }

        const body = await req.json();
        const { id, name, description, status } = body;

        // Ensure project belongs to same workspace
        const existing = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!existing || existing.workspaceId !== workspaceId) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const project = await prisma.project.update({
            where: { id: String(id) },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(status !== undefined && { status }),
            },
        });

        return NextResponse.json(project);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }
}

// DELETE: Remove a project — MANAGER/ADMIN only
export async function DELETE(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const role = (session.user as any).role as string;
        const workspaceId = (session.user as any).workspaceId as string | null;

        if (role !== "MANAGER" && role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden: Only managers can delete projects" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        // Ensure project belongs to same workspace
        const existing = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!existing || existing.workspaceId !== workspaceId) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        await prisma.project.delete({ where: { id: String(id) } });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    }
}
