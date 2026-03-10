import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: { workspaceMembers: true }
    });

    let fixedCount = 0;

    for (const user of users) {
        if (user.workspaceMembers.length === 0) {
            console.log(`Fixing user ${user.email}...`);
            let workspaceId = user.activeWorkspaceId;

            if (!workspaceId) {
                // Find or create a default workspace
                let workspace = await prisma.workspace.findFirst();
                if (!workspace) {
                    workspace = await prisma.workspace.create({
                        data: {
                            name: "Meu Workspace",
                            slug: "meu-workspace-" + Date.now(),
                        }
                    });
                }
                workspaceId = workspace.id;
                
                await prisma.user.update({
                    where: { id: user.id },
                    data: { activeWorkspaceId: workspaceId }
                });
            }

            await prisma.workspaceMember.create({
                data: {
                    userId: user.id,
                    workspaceId: workspaceId,
                    role: "MANAGER" // Default to MANAGER for existing users to prevent lock-outs
                }
            });
            console.log(`Fixed user ${user.email} -> workspaceId: ${workspaceId} as MANAGER`);
            fixedCount++;
        }
    }
    console.log(`Migration complete! Fixed ${fixedCount} users.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
