import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestWebhookEvent } from "@/services/whatsapp-sync";

/**
 * Recebe os eventos da Evolution API para UMA instância.
 *
 * URL configurada via setWebhook:
 *   POST /api/whatsapp/webhook/<instanceId>?secret=<webhookSecret>
 *
 * Validação: o `secret` da query precisa bater com WhatsappInstance.webhookSecret.
 * Responde 200 rapidamente (mesmo em erro de processamento) para evitar retries
 * em massa da Evolution; erros são logados.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ instanceId: string }> }
) {
    const { instanceId } = await params;
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    const instance = await prisma.whatsappInstance.findUnique({
        where: { id: instanceId },
        select: { id: true, webhookSecret: true },
    });

    if (!instance || !secret || secret !== instance.webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const payload = await req.json();
        await ingestWebhookEvent(instanceId, payload);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error(`[whatsapp webhook] erro ao processar instância ${instanceId}:`, error);
        return NextResponse.json({ ok: false }, { status: 200 });
    }
}
