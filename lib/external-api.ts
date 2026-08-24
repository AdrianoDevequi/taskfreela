import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
    sendTaskAssignmentNotification,
    sendTaskApprovalNotification,
    sendApprovalRequestNotification,
    sendTaskRejectionNotification,
} from "@/lib/task-notifications";
import { createNextOccurrence } from "@/lib/task-recurrence";

/**
 * Núcleo da API externa do Taskfreela — usada tanto pelas rotas REST
 * (/api/external/*) quanto pelo servidor MCP (/api/mcp/<token>), que é o que
 * permite pedir "cria uma tarefa pra mim" direto num chat com o Claude.
 *
 * Autenticação: chave única em TASKFRELA_API_KEY.
 * Autor das tarefas: usuário de TASKFRELA_API_USER_EMAIL (ou o primeiro
 * superadmin, se a variável não estiver setada).
 */

const TZ_OFFSET = "-03:00"; // America/Sao_Paulo (sem horário de verão desde 2019)
const TZ = "America/Sao_Paulo";
const DEFAULT_DUE_DAYS = 2; // mesma regra do "print/áudio vira tarefa"
const APP_URL = "https://www.taskfreela.com.br";

export class ApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

/* ---------------------------------------------------------------- auth --- */

export function checkApiKey(token: string | null | undefined): boolean {
    const expected = process.env.TASKFRELA_API_KEY;
    if (!expected || !token) return false;
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/** Aceita `Authorization: Bearer <key>`, `x-api-key: <key>` ou `?key=<key>`. */
export function extractToken(req: Request): string | null {
    const auth = req.headers.get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

    const header = req.headers.get("x-api-key");
    if (header) return header.trim();

    return new URL(req.url).searchParams.get("key");
}

export function requireApiKey(req: Request) {
    if (!process.env.TASKFRELA_API_KEY) {
        throw new ApiError("TASKFRELA_API_KEY não está configurada no servidor", 500);
    }
    if (!checkApiKey(extractToken(req))) {
        throw new ApiError("Unauthorized", 401);
    }
}

export type Actor = {
    userId: string;
    name: string;
    email: string | null;
    workspaceId: string;
    workspaceName: string;
    role: string;
};

/** Descobre em nome de quem a API cria/lê tarefas. */
export async function getActor(): Promise<Actor> {
    const email = process.env.TASKFRELA_API_USER_EMAIL;

    const user = email
        ? await prisma.user.findUnique({ where: { email }, include: { workspaceMembers: true } })
        : await prisma.user.findFirst({
              where: { isSuperAdmin: true },
              include: { workspaceMembers: true },
              orderBy: { createdAt: "asc" },
          });

    if (!user) {
        throw new ApiError(
            email
                ? `Usuário ${email} (TASKFRELA_API_USER_EMAIL) não encontrado`
                : "Nenhum superadmin encontrado — configure TASKFRELA_API_USER_EMAIL",
            500
        );
    }

    const workspaceId = user.activeWorkspaceId || user.workspaceMembers[0]?.workspaceId;
    if (!workspaceId) throw new ApiError("Usuário da API não pertence a nenhum workspace", 500);

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    const member = user.workspaceMembers.find((m) => m.workspaceId === workspaceId);
    const role = member?.role || "EMPLOYEE";

    if (!(user as any).isSuperAdmin && role !== "MANAGER" && role !== "ADMIN") {
        throw new ApiError("O usuário da API precisa ser MANAGER ou ADMIN no workspace", 403);
    }

    return {
        userId: user.id,
        name: user.name || user.email || "API",
        email: user.email,
        workspaceId,
        workspaceName: workspace?.name || "",
        role,
    };
}

/* --------------------------------------------------------------- datas --- */

const pad = (n: number) => String(n).padStart(2, "0");

/** Hoje, às 12h de Brasília — mesma convenção de horário usada no app. */
function todayAtNoon(): Date {
    const iso = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    return new Date(`${iso}T12:00:00${TZ_OFFSET}`);
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

/** minúsculas e sem acento, pra casar nome digitado de qualquer jeito */
const deburr = (s: string) =>
    s
        .normalize("NFD")
        .split("")
        .filter((ch) => {
            const code = ch.charCodeAt(0);
            return code < 0x0300 || code > 0x036f; // descarta acentos combinantes
        })
        .join("")
        .toLowerCase()
        .trim();

/**
 * Converte o prazo em Date. Aceita ISO ("2026-08-30"), dd/mm, dd/mm/aaaa e
 * expressões soltas ("hoje", "amanhã", "em 3 dias", "+5d", "semana que vem").
 * Sem prazo informado, cai no padrão do app: hoje + 2 dias.
 */
export function parseDueDate(input?: string | null): Date {
    if (!input) return addDays(todayAtNoon(), DEFAULT_DUE_DAYS);

    const raw = String(input).trim();
    const text = deburr(raw);
    const today = todayAtNoon();

    if (text === "hoje") return today;
    if (text === "amanha") return addDays(today, 1);
    if (text === "depois de amanha") return addDays(today, 2);
    if (text === "semana que vem" || text === "proxima semana") return addDays(today, 7);

    const relative = text.match(/^(?:em\s+|daqui\s+a\s+|\+)?(\d+)\s*(?:d|dias?)$/);
    if (relative) return addDays(today, Number(relative[1]));

    const isoDate = raw.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoDate) return new Date(`${raw}T12:00:00${TZ_OFFSET}`);

    const br = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
    if (br) {
        const day = Number(br[1]);
        const month = Number(br[2]);
        let year = br[3] ? Number(br[3]) : today.getFullYear();
        if (year < 100) year += 2000;
        const parsed = new Date(`${year}-${pad(month)}-${pad(day)}T12:00:00${TZ_OFFSET}`);
        // "10/01" digitado em dezembro quase sempre quer dizer o ano seguinte
        if (!br[3] && parsed.getTime() < today.getTime()) {
            return new Date(`${year + 1}-${pad(month)}-${pad(day)}T12:00:00${TZ_OFFSET}`);
        }
        return parsed;
    }

    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed;

    return addDays(today, DEFAULT_DUE_DAYS);
}

export function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short" }).format(date);
}

/* ------------------------------------------------------------- lookups --- */

type Member = { id: string; name: string; email: string };

async function listMembers(workspaceId: string): Promise<Member[]> {
    const members = await prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, name: true, email: true } } },
    });
    return members.map((m) => ({
        id: m.user.id,
        name: m.user.name || m.user.email || "(sem nome)",
        email: m.user.email || "",
    }));
}

/** Casa o texto livre ("joão", "maria@x.com") com um membro do workspace. */
function matchMember(members: Member[], query: string): Member | null {
    const q = deburr(query);
    if (!q) return null;

    return (
        members.find((m) => m.id === query) ||
        members.find((m) => deburr(m.email) === q) ||
        members.find((m) => deburr(m.name) === q) ||
        members.find((m) => deburr(m.name).split(/\s+/)[0] === q) ||
        members.find((m) => deburr(m.name).includes(q)) ||
        null
    );
}

async function resolveProject(workspaceId: string, query?: string | null) {
    if (!query) return null;
    const projects = await prisma.project.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
    });
    const q = deburr(query);
    const found =
        projects.find((p) => p.id === query) ||
        projects.find((p) => deburr(p.name) === q) ||
        projects.find((p) => deburr(p.name).includes(q));

    if (!found) {
        const names = projects.map((p) => p.name).join(", ") || "nenhum";
        throw new ApiError(`Projeto "${query}" não encontrado. Projetos: ${names}`);
    }
    return found;
}

/* ------------------------------------------------------------ contexto --- */

/** Quem existe e o que existe no workspace — ajuda a IA a preencher os campos. */
export async function getWorkspaceContext() {
    const actor = await getActor();
    const [members, projects, openTasks] = await Promise.all([
        listMembers(actor.workspaceId),
        prisma.project.findMany({
            where: { workspaceId: actor.workspaceId },
            select: { id: true, name: true, status: true },
            orderBy: { createdAt: "desc" },
        }),
        prisma.task.count({
            where: { workspaceId: actor.workspaceId, status: { notIn: ["DONE", "APPROVED"] } },
        }),
    ]);

    return {
        hoje: new Date().toLocaleDateString("en-CA", { timeZone: TZ }),
        workspace: { id: actor.workspaceId, nome: actor.workspaceName },
        usuarioDaApi: { id: actor.userId, nome: actor.name, email: actor.email },
        membros: members.map((m) => ({ id: m.id, nome: m.name, email: m.email })),
        projetos: projects.map((p) => ({ id: p.id, nome: p.name, status: p.status })),
        tarefasAbertas: openTasks,
        statusPossiveis: ["TODO", "IN_PROGRESS", "PENDING_APPROVAL", "DONE", "APPROVED"],
        temposEstimados: ["Rápido", "Mediano", "Demorado"],
    };
}

/* ------------------------------------------------------------- tarefas --- */

export type CreateTaskInput = {
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    assignee?: string | null;
    project?: string | null;
    estimatedTime?: string | null;
    status?: string | null;
    isMandatory?: boolean;
    source?: string | null;
};

export async function createTask(input: CreateTaskInput) {
    const actor = await getActor();

    const title = (input.title || "").trim();
    if (!title) throw new ApiError("title é obrigatório");

    let assignedToId = actor.userId;
    let assigneeName = actor.name;

    if (input.assignee) {
        const members = await listMembers(actor.workspaceId);
        const member = matchMember(members, input.assignee);
        if (!member) {
            const names = members.map((m) => m.name).join(", ");
            throw new ApiError(`Responsável "${input.assignee}" não encontrado. Membros: ${names}`);
        }
        assignedToId = member.id;
        assigneeName = member.name;
    }

    const project = await resolveProject(actor.workspaceId, input.project);
    const dueDate = parseDueDate(input.dueDate);

    const task = await prisma.task.create({
        data: {
            title,
            description: input.description || null,
            dueDate,
            status: input.status || "TODO",
            estimatedTime: input.estimatedTime || "Mediano",
            isMandatory: input.isMandatory === true,
            source: input.source || "claude",
            userId: actor.userId,
            workspaceId: actor.workspaceId,
            assignedToId,
            projectId: project?.id || null,
        } as any,
        include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true } },
        },
    });

    if (assignedToId !== actor.userId) {
        await sendTaskAssignmentNotification(task.id, assignedToId);
    }

    return {
        id: task.id,
        titulo: task.title,
        descricao: task.description,
        prazo: formatDate(task.dueDate),
        responsavel: assigneeName,
        projeto: task.project?.name || null,
        status: task.status,
        url: `${APP_URL}/dashboard/?task=${task.id}`,
    };
}

export type ListTasksInput = {
    status?: string | null;
    assignee?: string | null;
    project?: string | null;
    search?: string | null;
    overdue?: boolean;
    limit?: number;
};

export async function listTasks(input: ListTasksInput = {}) {
    const actor = await getActor();
    const where: any = { workspaceId: actor.workspaceId };

    if (input.status) {
        where.status = String(input.status).toUpperCase();
    } else {
        where.status = { notIn: ["DONE", "APPROVED"] };
    }

    if (input.search) where.title = { contains: input.search };
    if (input.overdue) where.dueDate = { lt: todayAtNoon() };

    if (input.assignee) {
        const members = await listMembers(actor.workspaceId);
        const member = matchMember(members, input.assignee);
        if (!member) throw new ApiError(`Responsável "${input.assignee}" não encontrado`);
        where.assignedToId = member.id;
    }

    if (input.project) {
        const project = await resolveProject(actor.workspaceId, input.project);
        where.projectId = project?.id;
    }

    const tasks = await prisma.task.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: Math.min(Math.max(Number(input.limit) || 20, 1), 100),
        include: {
            assignedTo: { select: { name: true } },
            project: { select: { name: true } },
        },
    });

    return tasks.map((t: any) => ({
        id: t.id,
        titulo: t.title,
        status: t.status,
        prazo: formatDate(t.dueDate),
        responsavel: t.assignedTo?.name || null,
        projeto: t.project?.name || null,
        url: `${APP_URL}/dashboard/?task=${t.id}`,
    }));
}

/** Carrega a tarefa garantindo que ela é do workspace da API. */
async function findTaskInWorkspace(id: number | string, workspaceId: string) {
    const taskId = Number(id);
    if (!taskId || isNaN(taskId)) throw new ApiError("id da tarefa inválido");

    const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
            assignedTo: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
        },
    });

    if (!task || task.workspaceId !== workspaceId) {
        throw new ApiError(`Tarefa #${taskId} não encontrada`, 404);
    }
    return task as any;
}

export async function getTask(id: number | string) {
    const actor = await getActor();
    const task = await findTaskInWorkspace(id, actor.workspaceId);

    const comments = await prisma.comment.findMany({
        where: { taskId: task.id },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
    });

    return {
        id: task.id,
        titulo: task.title,
        descricao: task.description,
        status: task.status,
        prazo: formatDate(task.dueDate),
        responsavel: task.assignedTo?.name || null,
        criadaPor: task.user?.name || null,
        projeto: task.project?.name || null,
        tempoEstimado: task.estimatedTime,
        obrigatoria: task.isMandatory,
        recorrente: task.isRecurring,
        criadaEm: formatDate(task.createdAt),
        comentarios: comments.map((c: any) => ({
            autor: c.user?.name || null,
            quando: formatDate(c.createdAt),
            texto: c.content,
        })),
        url: `${APP_URL}/dashboard/?task=${task.id}`,
    };
}

export type UpdateTaskInput = {
    id: number | string;
    title?: string | null;
    description?: string | null;
    dueDate?: string | null;
    status?: string | null;
    assignee?: string | null;
    project?: string | null;
    estimatedTime?: string | null;
    isMandatory?: boolean;
};

/**
 * Edita uma tarefa reproduzindo as mesmas regras da tela: fluxo de aprovação,
 * avisos ao responsável e criação da próxima ocorrência quando é recorrente.
 */
export async function updateTask(input: UpdateTaskInput) {
    const actor = await getActor();
    const existing = await findTaskInWorkspace(input.id, actor.workspaceId);

    const data: any = {};
    if (input.title !== undefined && input.title !== null) data.title = String(input.title).trim();
    if (input.description !== undefined) data.description = input.description;
    if (input.dueDate) data.dueDate = parseDueDate(input.dueDate);
    if (input.estimatedTime !== undefined) data.estimatedTime = input.estimatedTime;
    if (input.isMandatory !== undefined) data.isMandatory = input.isMandatory === true;

    if (input.project !== undefined) {
        const project = input.project ? await resolveProject(actor.workspaceId, input.project) : null;
        data.projectId = project?.id || null;
    }

    let newAssigneeId: string | null = null;
    if (input.assignee) {
        const members = await listMembers(actor.workspaceId);
        const member = matchMember(members, input.assignee);
        if (!member) {
            const names = members.map((m) => m.name).join(", ");
            throw new ApiError(`Responsável "${input.assignee}" não encontrado. Membros: ${names}`);
        }
        newAssigneeId = member.id;
        data.assignedToId = member.id;
    }

    const status = input.status ? String(input.status).toUpperCase() : undefined;
    if (status) {
        const allowed = ["TODO", "IN_PROGRESS", "PENDING_APPROVAL", "DONE", "APPROVED"];
        if (!allowed.includes(status)) {
            throw new ApiError(`Status inválido: ${input.status}. Use um de: ${allowed.join(", ")}`);
        }
        data.status = status;
    }

    // Mesmas transições do fluxo de aprovação da tela
    const isMovingToPending = status === "PENDING_APPROVAL" && existing.status !== "PENDING_APPROVAL";
    const isResolvingApproval =
        existing.status === "PENDING_APPROVAL" && (status === "APPROVED" || status === "TODO");

    if (isMovingToPending) {
        data.originalAssignedToId = existing.assignedToId;
        data.assignedToId = existing.userId;
    } else if (isResolvingApproval) {
        data.assignedToId = existing.originalAssignedToId || existing.assignedToId;
        data.originalAssignedToId = null;
        if (status === "TODO" && !input.dueDate) {
            data.dueDate = parseDueDate("amanha");
        }
    }

    if (Object.keys(data).length === 0) throw new ApiError("Nada para atualizar");

    const task = await prisma.task.update({
        where: { id: existing.id },
        data,
        include: {
            assignedTo: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
        },
    });

    if (
        !isMovingToPending &&
        !isResolvingApproval &&
        newAssigneeId &&
        newAssigneeId !== existing.assignedToId &&
        newAssigneeId !== actor.userId
    ) {
        await sendTaskAssignmentNotification(task.id, newAssigneeId);
    }
    if (isMovingToPending) await sendApprovalRequestNotification(task.id);
    if (status === "APPROVED" && existing.status !== "APPROVED") {
        await sendTaskApprovalNotification(task.id);
    }
    if (status === "TODO" && existing.status === "PENDING_APPROVAL" && existing.originalAssignedToId) {
        await sendTaskRejectionNotification(task.id, existing.originalAssignedToId);
    }
    if (status === "DONE" && existing.status !== "DONE") {
        await createNextOccurrence(task);
    }

    return {
        id: task.id,
        titulo: task.title,
        status: task.status,
        prazo: formatDate(task.dueDate),
        responsavel: (task as any).assignedTo?.name || null,
        projeto: (task as any).project?.name || null,
        url: `${APP_URL}/dashboard/?task=${task.id}`,
    };
}

export async function deleteTask(id: number | string) {
    const actor = await getActor();
    const task = await findTaskInWorkspace(id, actor.workspaceId);
    await prisma.task.delete({ where: { id: task.id } });
    return { id: task.id, titulo: task.title };
}

export async function addComment(id: number | string, content: string) {
    const actor = await getActor();
    const task = await findTaskInWorkspace(id, actor.workspaceId);

    const text = (content || "").trim();
    if (!text) throw new ApiError("O comentário não pode ser vazio");

    const comment = await prisma.comment.create({
        data: { content: text, taskId: task.id, userId: actor.userId },
    });

    return {
        id: comment.id,
        tarefa: { id: task.id, titulo: task.title },
        autor: actor.name,
        texto: comment.content,
        url: `${APP_URL}/dashboard/?task=${task.id}`,
    };
}
