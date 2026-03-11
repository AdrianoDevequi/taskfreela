const fs = require('fs');

async function main() {
    console.log("Mocking a database fetch to see exactly what GET /api/tasks returns");
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const tasks = await prisma.task.findMany({
        orderBy: [
            { dueDate: "asc" },
            { createdAt: "desc" }
        ],
        include: {
            assignedTo: {
                select: { id: true, name: true, email: true, image: true },
            },
            project: {
                select: { id: true, name: true },
            }
        },
    });
    
    fs.writeFileSync('scripts/tasks-api-mock.json', JSON.stringify(tasks, null, 2));
    console.log("Wrote to scripts/tasks-api-mock.json");
    prisma.$disconnect();
}

main();
