import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: "Adriano" } },
                    { name: { contains: "Gustavo" } },
                    { email: { contains: "adriano" } },
                    { email: { contains: "gustavo" } }
                ]
            },
            select: {
                id: true,
                name: true,
                email: true,
                whatsapp: true,
                notifyOverdueTasks: true,
                notifyNewTasks: true,
                assignedTasks: {
                    where: {
                        status: { not: "DONE" }
                    },
                    select: {
                        id: true,
                        title: true,
                        dueDate: true,
                        status: true
                    }
                }
            }
        });
        
        return NextResponse.json(users);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
