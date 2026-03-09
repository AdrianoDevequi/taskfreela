/**
 * Script de seed: cria o Workspace padrão e associa todos os usuários existentes
 * sem workspace a ele, definindo o primeiro como MANAGER.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Verificar se já existe um Workspace padrão
  let ws = await prisma.workspace.findUnique({ where: { slug: 'default' } });

  if (!ws) {
    ws = await prisma.workspace.create({
      data: { name: 'Empresa Padrão', slug: 'default' },
    });
    console.log(`✅ Workspace criado: ${ws.name} (${ws.id})`);
  } else {
    console.log(`ℹ️  Workspace já existe: ${ws.name} (${ws.id})`);
  }

  // 2. Associar todos os usuários sem workspaceId ao workspace padrão
  const usersWithoutWs = await prisma.user.findMany({ where: { workspaceId: null } });

  for (let i = 0; i < usersWithoutWs.length; i++) {
    const u = usersWithoutWs[i];
    await prisma.user.update({
      where: { id: u.id },
      data: {
        workspaceId: ws.id,
        // Primeiro usuário vira MANAGER, restantes EMPLOYEE
        role: i === 0 ? 'MANAGER' : 'EMPLOYEE',
      },
    });
    console.log(`👤 ${u.email} → role: ${i === 0 ? 'MANAGER' : 'EMPLOYEE'}`);
  }

  // 3. Associar todas as tasks sem workspaceId ao workspace padrão
  const taskUpdate = await prisma.task.updateMany({
    where: { workspaceId: null },
    data: { workspaceId: ws.id },
  });
  console.log(`📋 ${taskUpdate.count} tarefa(s) associada(s) ao Workspace.`);

  // 4. Associar reminders sem workspaceId
  const reminderUpdate = await prisma.reminder.updateMany({
    where: { workspaceId: null },
    data: { workspaceId: ws.id },
  });
  console.log(`🔔 ${reminderUpdate.count} lembrete(s) associado(s) ao Workspace.`);

  console.log('\n✅ Seed concluído!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
