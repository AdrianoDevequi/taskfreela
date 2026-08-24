import { NextResponse } from "next/server";
import {
    openai,
    OPENAI_MODEL,
    assertOpenAIKey,
    fileToDataUrl,
    transcribeAudio,
    stripJsonFences,
} from "@/lib/openai";

const SYSTEM_PROMPT = `
Você é um assistente que transforma prints de conversa ou áudios em tarefas.

Extraia os detalhes da tarefa e devolva SOMENTE um objeto JSON válido com os campos:
- title: um resumo conciso da tarefa (máx. 50 caracteres).
- description: uma descrição clara do que precisa ser feito, com base na conversa/texto. Formate de forma legível.
- estimatedTime: um palpite baseado na complexidade ("Rápido", "Mediano" ou "Demorado"). Padrão: "Mediano".

Escreva tudo em Português (Brasil).
Não use formatação markdown. Apenas o JSON puro.
`;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        assertOpenAIKey();

        const isAudio = (file.type || "").startsWith("audio/");

        const userContent = isAudio
            ? [
                  {
                      type: "text" as const,
                      text: `Transcrição do áudio enviado pelo usuário:\n\n"""${await transcribeAudio(
                          file
                      )}"""`,
                  },
              ]
            : [
                  {
                      type: "text" as const,
                      text: "Analise esta imagem (print de conversa, anotação ou documento) e extraia a tarefa.",
                  },
                  {
                      type: "image_url" as const,
                      image_url: { url: await fileToDataUrl(file) },
                  },
              ];

        const completion = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userContent },
            ],
        });

        const text = completion.choices[0]?.message?.content || "";
        const data = JSON.parse(stripJsonFences(text));

        // Enforce Rule: Due Date is always 2 days from now
        const today = new Date();
        today.setDate(today.getDate() + 2);
        data.dueDate = today.toISOString().split("T")[0];

        return NextResponse.json(data);
    } catch (error) {
        console.error("AI processing error:", error);
        return NextResponse.json(
            {
                error: "Failed to process file",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
