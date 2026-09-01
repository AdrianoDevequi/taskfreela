import { NextResponse } from "next/server";
import { withDB } from "@/lib/prisma";
import { ApiError, getWhatsappSummary, requireApiKey } from "@/lib/external-api";

/**
 * GET /api/external/whatsapp — conversas aguardando resposta.
 * Serve para painéis externos mostrarem quantas conversas estão pendentes.
 */
export function GET(req: Request) {
    return withDB(async () => {
        try {
            requireApiKey(req);
            return NextResponse.json({ ok: true, ...(await getWhatsappSummary()) });
        } catch (error) {
            if (error instanceof ApiError) {
                return NextResponse.json({ error: error.message }, { status: error.status });
            }
            console.error("[external/whatsapp]", error);
            return NextResponse.json({ error: "Erro interno" }, { status: 500 });
        }
    });
}
