const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "mysql://taskfrela_user:LW%5E0Ub8la%23e2qcrg@104.156.48.234:3306/taskfrela_bd"
        }
    }
});

const ADRIANO_ID = "fc8c3008-828d-45c1-a328-d78a4241beb5";

async function main() {
    console.log("Busca tarefas que o Adriano criou mas que estão sem assignedToId...");
    
    // Find tasks created by Adriano but currently unassigned
    const unassignedTasks = await prisma.task.findMany({
        where: {
            userId: ADRIANO_ID, // Created by Adriano
            assignedToId: null  // But not specifically assigned
        },
        select: {
            id: true,
            title: true
        }
    });

    console.log(`Found ${unassignedTasks.length} unassigned tasks created by Adriano:`);
    unassignedTasks.forEach(t => console.log(`- [${t.id}] ${t.title}`));

    if (unassignedTasks.length > 0) {
        console.log("\nUpdating these tasks to be assigned to Adriano...");
        const result = await prisma.task.updateMany({
            where: {
                id: { in: unassignedTasks.map(t => t.id) }
            },
            data: {
                assignedToId: ADRIANO_ID
            }
        });
        console.log(`Successfully updated ${result.count} tasks.`);
    }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
