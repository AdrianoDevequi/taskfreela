import { NextResponse } from "next/server";
import { withDB } from "@/lib/prisma";
import { ApiError, getWorkspaceContext, requireApiKey } from "@/lib/external-api";

/**
 * GET /api/external/context — membros, projetos e data de hoje.
 * Serve pra IA saber pra quem atribuir e em qual projeto encaixar a tarefa.
 */
export function GET(req: Request) {
    return withDB(async () => {
        try {
            requireApiKey(req);
            return NextResponse.json({ ok: true, ...(await getWorkspaceContext()) });
        } catch (error) {
            if (error instanceof ApiError) {
                return NextResponse.json({ error: error.message }, { status: error.status });
            }
            console.error("[external/context]", error);
            return NextResponse.json({ error: "Erro interno" }, { status: 500 });
        }
    });
}
