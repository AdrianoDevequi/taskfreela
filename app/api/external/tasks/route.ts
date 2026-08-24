import { NextResponse } from "next/server";
import { withDB } from "@/lib/prisma";
import {
    ApiError,
    createTask,
    deleteTask,
    getTask,
    listTasks,
    requireApiKey,
    updateTask,
} from "@/lib/external-api";

/**
 * API externa de tarefas — autenticada por TASKFRELA_API_KEY, sem sessão.
 * Todas as chamadas aceitam a chave em `Authorization: Bearer`, `x-api-key` ou `?key=`.
 *
 *   POST   /api/external/tasks      cria      { title, description, dueDate, assignee, project, ... }
 *   GET    /api/external/tasks      lista     ?status=&assignee=&project=&search=&overdue=&limit=
 *   GET    /api/external/tasks?id=12          detalhe da tarefa (com comentários)
 *   PUT    /api/external/tasks      edita     { id, title?, status?, dueDate?, assignee?, ... }
 *   DELETE /api/external/tasks?id=12          exclui
 */

function fail(scope: string, error: unknown) {
    if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(`[external/tasks:${scope}]`, error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}

export function POST(req: Request) {
    return withDB(async () => {
        try {
            requireApiKey(req);
            const body = await req.json().catch(() => ({}));
            const task = await createTask({
                title: body.title,
                description: body.description,
                dueDate: body.dueDate,
                assignee: body.assignee ?? body.assignedTo,
                project: body.project,
                estimatedTime: body.estimatedTime,
                status: body.status,
                isMandatory: body.isMandatory,
                source: body.source,
            });
            return NextResponse.json({ ok: true, tarefa: task });
        } catch (error) {
            return fail("POST", error);
        }
    });
}

export function GET(req: Request) {
    return withDB(async () => {
        try {
            requireApiKey(req);
            const { searchParams } = new URL(req.url);

            const id = searchParams.get("id");
            if (id) return NextResponse.json({ ok: true, tarefa: await getTask(id) });

            const tasks = await listTasks({
                status: searchParams.get("status"),
                assignee: searchParams.get("assignee"),
                project: searchParams.get("project"),
                search: searchParams.get("search"),
                overdue: searchParams.get("overdue") === "true",
                limit: Number(searchParams.get("limit")) || undefined,
            });
            return NextResponse.json({ ok: true, tarefas: tasks });
        } catch (error) {
            return fail("GET", error);
        }
    });
}

export function PUT(req: Request) {
    return withDB(async () => {
        try {
            requireApiKey(req);
            const body = await req.json().catch(() => ({}));
            if (!body.id) throw new ApiError("id é obrigatório");
            const task = await updateTask({
                id: body.id,
                title: body.title,
                description: body.description,
                dueDate: body.dueDate,
                status: body.status,
                assignee: body.assignee ?? body.assignedTo,
                project: body.project,
                estimatedTime: body.estimatedTime,
                isMandatory: body.isMandatory,
            });
            return NextResponse.json({ ok: true, tarefa: task });
        } catch (error) {
            return fail("PUT", error);
        }
    });
}

export function DELETE(req: Request) {
    return withDB(async () => {
        try {
            requireApiKey(req);
            const id = new URL(req.url).searchParams.get("id");
            if (!id) throw new ApiError("id é obrigatório");
            const removed = await deleteTask(id);
            return NextResponse.json({ ok: true, excluida: removed });
        } catch (error) {
            return fail("DELETE", error);
        }
    });
}
