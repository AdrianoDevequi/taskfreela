import { handleMcpRequest, MCP_CORS } from "@/lib/mcp-server";

/**
 * Endpoint MCP padrão: a chave vai no header
 * (`x-api-key: <chave>` ou `Authorization: Bearer <chave>`).
 */
export async function POST(req: Request) {
    return handleMcpRequest(req);
}

/** O transporte permite um canal SSE só de servidor→cliente; aqui não é usado. */
export async function GET() {
    return new Response("Method Not Allowed", { status: 405, headers: MCP_CORS });
}

export async function DELETE() {
    return new Response(null, { status: 204, headers: MCP_CORS });
}

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: MCP_CORS });
}
