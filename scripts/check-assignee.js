const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const task30 = await prisma.task.findUnique({
        where: { id: 30 },
        include: { assignedTo: true }
    });
    console.log("TASK 30 ASSIGNEE:", task30?.assignedToId, "Name:", task30?.assignedTo?.name);

    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true }
    });
    console.log("ALL USERS:", users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
