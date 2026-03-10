const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "mysql://taskfrela_user:LW%5E0Ub8la%23e2qcrg@104.156.48.234:3306/taskfrela_bd"
        }
    }
});

async function main() {
    console.log("Querying raw tasks on the board to see whose ID they have...");
    const tasks = await prisma.task.findMany({
        where: { title: { contains: "Apresentação" } },
        select: {
            title: true,
            status: true,
            dueDate: true,
            userId: true,
            assignedToId: true,
            assignedTo: { select: { name: true } }
        },
        take: 3
    });

    console.dir(tasks, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
