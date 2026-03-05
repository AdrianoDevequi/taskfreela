
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const reminders = await prisma.reminder.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(reminders);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const reminder = await prisma.reminder.create({
            data: {
                content: body.content,
                userId: session.user.id,
            },
        });
        return NextResponse.json(reminder);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { id, isCompleted, content } = body;

        // Ensure ownership
        const existing = await prisma.reminder.findUnique({ where: { id } });
        if (!existing || existing.userId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const reminder = await prisma.reminder.update({
            where: { id },
            data: {
                isCompleted: isCompleted !== undefined ? isCompleted : undefined,
                content: content !== undefined ? content : undefined
            },
        });
        return NextResponse.json(reminder);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        // Ensure ownership
        const existing = await prisma.reminder.findUnique({ where: { id } });
        if (!existing || existing.userId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await prisma.reminder.delete({
            where: { id },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
    }
}
