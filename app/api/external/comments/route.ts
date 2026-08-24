import { NextResponse } from "next/server";
import { withDB } from "@/lib/prisma";
import { addComment, ApiError, requireApiKey } from "@/lib/external-api";

/**
 * POST /api/external/comments — comenta numa tarefa.
 * Body: { "id": 12, "content": "..." }
 */
export function POST(req: Request) {
    return withDB(async () => {
        try {
            requireApiKey(req);
            const body = await req.json().catch(() => ({}));
            if (!body.id) throw new ApiError("id é obrigatório");
            const comment = await addComment(body.id, body.content);
            return NextResponse.json({ ok: true, comentario: comment });
        } catch (error) {
            if (error instanceof ApiError) {
                return NextResponse.json({ error: error.message }, { status: error.status });
            }
            console.error("[external/comments]", error);
            return NextResponse.json({ error: "Erro interno" }, { status: 500 });
        }
    });
}
