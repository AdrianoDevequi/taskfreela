const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tasks = await prisma.task.findMany({
        where: { id: { in: [19, 20, 22, 24] } },
        select: { id: true, title: true, assignedToId: true }
    });
    console.log(JSON.stringify(tasks, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
