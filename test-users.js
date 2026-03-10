const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log("Querying users...");
    const users = await prisma.user.findMany({
        where: {},
        select: { id: true, name: true, whatsapp: true, notifyOverdueTasks: true }
    });
    console.log(users.filter(u => u.name && u.name.includes("Adriano")));
}
main().finally(() => prisma.$disconnect());
