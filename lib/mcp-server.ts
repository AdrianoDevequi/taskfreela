import { withDB } from "@/lib/prisma";
import {
    addComment,
    ApiError,
    checkApiKey,
    createTask,
    deleteTask,
    extractToken,
    getTask,
    getWorkspaceContext,
    listTasks,
    updateTask,
} from "@/lib/external-api";

/**
 * Servidor MCP (Streamable HTTP) do Taskfreela — implementado na mão
 * (JSON-RPC 2.0) pra não trazer dependência nova e rodar bem em serverless.
 *
 * É isso que permite falar "cria uma tarefa disso aí no Taskfreela" dentro de
 * um chat com o Claude. Duas formas de cadastrar o conector:
 *
 *   1. https://www.taskfreela.com.br/api/mcp  + header `x-api-key: <chave>`
 *      (preferível: a chave não fica exposta na URL)
 *   2. https://www.taskfreela.com.br/api/mcp/<chave>
 *      (pra clientes que não deixam configurar header)
 */

const PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18"];
const DEFAULT_PROTOCOL = "2025-06-18";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
};

const TOOLS = [
    {
        name: "criar_tarefa",
        description:
            "Cria uma tarefa no Taskfreela. Use quando o usuário pedir para criar/anotar/lembrar uma tarefa. " +
            "Se o responsável não for informado, a tarefa fica com o dono da conta. " +
            "Sem prazo informado, o padrão é hoje + 2 dias.",
        inputSchema: {
            type: "object",
            properties: {
                title: { type: "string", description: "Título curto e objetivo (até ~60 caracteres)" },
                description: {
                    type: "string",
                    description: "O que precisa ser feito, com o contexto útil da conversa",
                },
                dueDate: {
                    type: "string",
                    description:
                        'Prazo. Aceita "2026-08-30", "30/08", "hoje", "amanhã", "em 3 dias". Padrão: hoje + 2 dias.',
                },
                assignee: {
                    type: "string",
                    description: "Nome ou e-mail do responsável (membro do workspace). Padrão: o dono da conta.",
                },
                project: { type: "string", description: "Nome do projeto, se a tarefa pertencer a um" },
                estimatedTime: {
                    type: "string",
                    enum: ["Rápido", "Mediano", "Demorado"],
                    description: "Esforço estimado. Padrão: Mediano.",
                },
                isMandatory: {
                    type: "boolean",
                    description: "Marca como obrigatória (dispara lembretes extras). Padrão: false.",
                },
            },
            required: ["title"],
        },
    },
    {
        name: "listar_tarefas",
        description:
            "Lista tarefas do workspace no Taskfreela. Sem filtro de status, traz só as que ainda estão abertas. " +
            "Use antes de editar/excluir para descobrir o id da tarefa.",
        inputSchema: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    enum: ["TODO", "IN_PROGRESS", "PENDING_APPROVAL", "DONE", "APPROVED"],
                    description: "Filtra por status",
                },
                assignee: { type: "string", description: "Nome ou e-mail do responsável" },
                project: { type: "string", description: "Nome do projeto" },
                search: { type: "string", description: "Trecho do título para buscar" },
                overdue: { type: "boolean", description: "Só as atrasadas (prazo já passou)" },
                limit: { type: "number", description: "Quantas tarefas trazer (padrão 20, máx 100)" },
            },
        },
    },
    {
        name: "ver_tarefa",
        description: "Mostra os detalhes completos de uma tarefa, incluindo descrição e comentários.",
        inputSchema: {
            type: "object",
            properties: { id: { type: "number", description: "ID da tarefa" } },
            required: ["id"],
        },
    },
    {
        name: "atualizar_tarefa",
        description:
            "Edita uma tarefa: título, descrição, prazo, responsável, projeto, esforço ou status. " +
            'Para concluir, mande status "DONE". Envie só os campos que mudam.',
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "number", description: "ID da tarefa" },
                title: { type: "string" },
                description: { type: "string" },
                dueDate: {
                    type: "string",
                    description: 'Novo prazo: "2026-08-30", "30/08", "hoje", "amanhã", "em 3 dias"',
                },
                status: {
                    type: "string",
                    enum: ["TODO", "IN_PROGRESS", "PENDING_APPROVAL", "DONE", "APPROVED"],
                },
                assignee: { type: "string", description: "Novo responsável (nome ou e-mail)" },
                project: { type: "string", description: 'Nome do projeto (string vazia tira do projeto)' },
                estimatedTime: { type: "string", enum: ["Rápido", "Mediano", "Demorado"] },
                isMandatory: { type: "boolean" },
            },
            required: ["id"],
        },
    },
    {
        name: "excluir_tarefa",
        description:
            "Exclui uma tarefa em definitivo. Confirme com o usuário (mostrando o título) antes de chamar.",
        inputSchema: {
            type: "object",
            properties: { id: { type: "number", description: "ID da tarefa" } },
            required: ["id"],
        },
    },
    {
        name: "comentar_tarefa",
        description: "Adiciona um comentário na tarefa, útil para registrar contexto ou decisões.",
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "number", description: "ID da tarefa" },
                content: { type: "string", description: "Texto do comentário" },
            },
            required: ["id", "content"],
        },
    },
    {
        name: "contexto_taskfreela",
        description:
            "Mostra o workspace, os membros (possíveis responsáveis), os projetos e a data de hoje. " +
            "Útil antes de criar uma tarefa quando há dúvida sobre nome de pessoa ou de projeto.",
        inputSchema: { type: "object", properties: {} },
    },
];

type JsonRpcRequest = { jsonrpc?: string; id?: unknown; method?: string; params?: any };

function result(id: unknown, data: unknown) {
    return { jsonrpc: "2.0", id, result: data };
}

function failure(id: unknown, code: number, message: string) {
    return { jsonrpc: "2.0", id, error: { code, message } };
}

function textResult(id: unknown, payload: unknown, isError = false) {
    return result(id, {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        isError,
    });
}

async function callTool(name: string, args: any) {
    switch (name) {
        case "criar_tarefa": {
            const task = await createTask({
                title: args?.title,
                description: args?.description,
                dueDate: args?.dueDate,
                assignee: args?.assignee,
                project: args?.project,
                estimatedTime: args?.estimatedTime,
                isMandatory: args?.isMandatory,
                source: "claude",
            });
            return { ok: true, mensagem: `Tarefa #${task.id} criada.`, tarefa: task };
        }
        case "listar_tarefas":
            return { ok: true, tarefas: await listTasks(args || {}) };
        case "ver_tarefa":
            return { ok: true, tarefa: await getTask(args?.id) };
        case "atualizar_tarefa": {
            const task = await updateTask(args);
            return { ok: true, mensagem: `Tarefa #${task.id} atualizada.`, tarefa: task };
        }
        case "excluir_tarefa": {
            const removed = await deleteTask(args?.id);
            return { ok: true, mensagem: `Tarefa #${removed.id} ("${removed.titulo}") excluída.` };
        }
        case "comentar_tarefa":
            return { ok: true, comentario: await addComment(args?.id, args?.content) };
        case "contexto_taskfreela":
            return { ok: true, ...(await getWorkspaceContext()) };
        default:
            throw new ApiError(`Ferramenta desconhecida: ${name}`, 404);
    }
}

async function handleMessage(message: JsonRpcRequest): Promise<object | null> {
    const { id, method, params } = message;

    switch (method) {
        case "initialize": {
            const requested = params?.protocolVersion;
            return result(id, {
                protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : DEFAULT_PROTOCOL,
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: "taskfreela", version: "1.0.0" },
                instructions:
                    "Ferramentas do Taskfreela (gestão de tarefas). Use criar_tarefa quando o usuário pedir " +
                    "para virar algo da conversa em tarefa e confirme título e prazo na resposta. Para editar, " +
                    "concluir ou excluir, ache o id com listar_tarefas antes. Excluir é definitivo: confirme " +
                    "com o usuário, mostrando o título, antes de chamar excluir_tarefa.",
            });
        }

        case "ping":
            return result(id, {});

        case "tools/list":
            return result(id, { tools: TOOLS });

        case "resources/list":
            return result(id, { resources: [] });

        case "prompts/list":
            return result(id, { prompts: [] });

        case "tools/call": {
            const toolName = params?.name;
            try {
                return textResult(id, await callTool(toolName, params?.arguments));
            } catch (error) {
                const message = error instanceof ApiError ? error.message : "Erro ao falar com o Taskfreela";
                if (!(error instanceof ApiError)) console.error("[mcp] tools/call", error);
                return textResult(id, { ok: false, erro: message }, true);
            }
        }

        default:
            // Notificações (notifications/*) não têm id e não esperam resposta
            if (id === undefined || id === null) return null;
            return failure(id, -32601, `Método não suportado: ${method}`);
    }
}

function respond(req: Request, payload: object | null) {
    if (!payload) return new Response(null, { status: 202, headers: CORS });

    const wantsStream = (req.headers.get("accept") || "").includes("text/event-stream");

    if (wantsStream) {
        const body = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
        return new Response(body, {
            headers: {
                ...CORS,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
            },
        });
    }

    return new Response(JSON.stringify(payload), {
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}

export const MCP_CORS = CORS;

function unauthorized() {
    return new Response(JSON.stringify(failure(null, -32001, "Unauthorized")), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}

/**
 * Trata uma requisição MCP. A chave pode vir no caminho da URL (`pathToken`)
 * ou, de preferência, em `Authorization: Bearer` / `x-api-key`.
 */
export async function handleMcpRequest(req: Request, pathToken?: string) {
    const token = pathToken ? decodeURIComponent(pathToken) : extractToken(req);
    if (!checkApiKey(token)) return unauthorized();

    let message: JsonRpcRequest | JsonRpcRequest[];
    try {
        message = await req.json();
    } catch {
        return new Response(JSON.stringify(failure(null, -32700, "JSON inválido")), {
            status: 400,
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    }

    return withDB(async () => {
        if (Array.isArray(message)) {
            const results = (await Promise.all(message.map(handleMessage))).filter(Boolean);
            return respond(req, results.length ? (results as object[] as any) : null);
        }
        return respond(req, await handleMessage(message));
    });
}

