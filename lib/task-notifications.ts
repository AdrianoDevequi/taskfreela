import { prisma } from "@/lib/prisma";
import { evolutionService } from "@/services/evolution";
import { pushService } from "@/services/push";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Avisa (WhatsApp + Web Push) o responsável de que uma tarefa foi atribuída a ele.
 * Vive aqui para ser reaproveitado pela rota do app e pela API externa (/api/external).
 */
export async function sendTaskAssignmentNotification(taskId: number, assignedToId: string) {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!settings || !settings.instanceName) return;

        const task = await (prisma.task as any).findUnique({
            where: { id: taskId },
            include: {
                assignedTo: { select: { name: true, whatsapp: true, notifyNewTasks: true } },
                project: { select: { name: true } }
            }
        });

        if (!task || !task.assignedTo?.whatsapp || !task.assignedTo.notifyNewTasks) return;

        const date = format(task.dueDate, "dd/MM/yyyy", { locale: ptBR });
        const projectInfo = task.project ? `\n*Projeto:* ${task.project.name}` : "";

        const message = `👋 Olá ${task.assignedTo.name}!\n\nUma nova tarefa foi atribuída a você:\n\n*Título:* ${task.title}${projectInfo}\n*Data de Entrega:* ${date}\n\nBoa sorte! 🚀\n\nhttps://www.taskfreela.com.br/`;

        await evolutionService.sendText(
            settings.instanceName,
            task.assignedTo.whatsapp,
            message
        );

        // Web Push Notification
        await pushService.sendToUser(assignedToId, {
            title: "Nova Tarefa Atribuída 📋",
            body: `Você foi atribuído à tarefa: ${task.title}`,
            url: `https://www.taskfreela.com.br/dashboard/?task=${task.id}`
        });
    } catch (error) {
        console.error("Error sending WhatsApp notification:", error);
    }
}

export async function sendTaskApprovalNotification(taskId: number) {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!settings || !settings.instanceName) return;

        const task = await (prisma.task as any).findUnique({
            where: { id: taskId },
            include: {
                assignedTo: { select: { id: true, name: true, whatsapp: true, notifyNewTasks: true } },
                project: { select: { name: true } }
            }
        });

        if (!task || !task.assignedTo?.whatsapp || !task.assignedTo.notifyNewTasks) return;

        const projectInfo = task.project ? `\n*Projeto:* ${task.project.name}` : "";
        const message = `✅ Olá ${task.assignedTo.name}!\n\nSua tarefa foi *aprovada*! 🎉\n\n*Título:* ${task.title}${projectInfo}\n\nParabéns pelo ótimo trabalho! 🚀\n\nhttps://www.taskfreela.com.br/`;

        await evolutionService.sendText(
            settings.instanceName,
            task.assignedTo.whatsapp,
            message
        );

        // Web Push Notification
        await pushService.sendToUser(task.assignedTo.id, {
            title: "Tarefa Aprovada ✅",
            body: `Sua tarefa foi aprovada: ${task.title}`,
            url: `https://www.taskfreela.com.br/dashboard/?task=${task.id}`
        });
    } catch (error) {
        console.error("Error sending approval notification:", error);
    }
}

export async function sendApprovalRequestNotification(taskId: number) {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!settings || !settings.instanceName) return;

        const task = await (prisma.task as any).findUnique({
            where: { id: taskId },
            include: {
                user: { select: { id: true, name: true, whatsapp: true, notifyNewTasks: true } },
                project: { select: { name: true } }
            }
        });

        if (!task || !task.user?.whatsapp || !task.user.notifyNewTasks) return;

        // originalAssignedToId holds who actually did the task
        let requesterName = "O responsável";
        if (task.originalAssignedToId) {
            const requester = await prisma.user.findUnique({
                where: { id: task.originalAssignedToId },
                select: { name: true }
            });
            if (requester?.name) requesterName = requester.name;
        }

        const projectInfo = task.project ? `\n*Projeto:* ${task.project.name}` : "";
        const message = `⏳ Olá ${task.user.name}!\n\n*${requesterName}* está solicitando sua aprovação em uma tarefa:\n\n*Título:* ${task.title}${projectInfo}\n\nAcesse o sistema para aprovar ou rejeitar. 👇\n\nhttps://www.taskfreela.com.br/dashboard/?task=${task.id}`;

        await evolutionService.sendText(
            settings.instanceName,
            task.user.whatsapp,
            message
        );

        await pushService.sendToUser(task.user.id, {
            title: "Tarefa aguardando aprovação ⏳",
            body: `${requesterName} solicitou aprovação: ${task.title}`,
            url: `https://www.taskfreela.com.br/dashboard/?task=${task.id}`
        });
    } catch (error) {
        console.error("Error sending approval request notification:", error);
    }
}

export async function sendTaskRejectionNotification(taskId: number, originalAssignedToId: string) {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!settings || !settings.instanceName) return;

        const task = await (prisma.task as any).findUnique({
            where: { id: taskId },
            include: { project: { select: { name: true } } }
        });
        if (!task) return;

        const assignee = await prisma.user.findUnique({
            where: { id: originalAssignedToId },
            select: { id: true, name: true, whatsapp: true, notifyNewTasks: true }
        });
        if (!assignee?.whatsapp || !assignee.notifyNewTasks) return;

        const tomorrow = format(task.dueDate, "dd/MM/yyyy", { locale: ptBR });
        const projectInfo = task.project ? `\n*Projeto:* ${task.project.name}` : "";
        const message = `❌ Olá ${assignee.name}!\n\nSua tarefa foi *recusada* e precisa de ajustes:\n\n*Título:* ${task.title}${projectInfo}\n*Novo Prazo:* ${tomorrow}\n\nVerifique os comentários para mais detalhes. 👇\n\nhttps://www.taskfreela.com.br/dashboard/?task=${task.id}`;

        await evolutionService.sendText(settings.instanceName, assignee.whatsapp, message);

        await pushService.sendToUser(assignee.id, {
            title: "Tarefa recusada ❌",
            body: `Sua tarefa precisa de ajustes: ${task.title}`,
            url: `https://www.taskfreela.com.br/dashboard/?task=${task.id}`
        });
    } catch (error) {
        console.error("Error sending rejection notification:", error);
    }
}
