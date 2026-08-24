import { NextResponse } from "next/server";
import {
    openai,
    OPENAI_MODEL,
    assertOpenAIKey,
    transcribeAudio,
    stripJsonFences,
} from "@/lib/openai";

const SYSTEM_PROMPT = `
Você é um assistente pessoal.
Receberá a transcrição de um áudio com anotações e deve extrair os lembretes/tarefas distintos.
O usuário pode dizer coisas como "Primeiro comprar leite, depois ligar para o João".
Separe isso em itens diferentes.

Responda SOMENTE com um objeto JSON no formato:
{"reminders": ["Comprar leite", "Ligar para o João"]}

Escreva tudo em Português (Brasil).
Seja conciso. Não use markdown.
`;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        assertOpenAIKey();

        const transcript = await transcribeAudio(file);

        const completion = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Transcrição:\n\n"""${transcript}"""` },
            ],
        });

        const text = completion.choices[0]?.message?.content || "";
        const parsed = JSON.parse(stripJsonFences(text));
        const reminders = Array.isArray(parsed) ? parsed : parsed.reminders || [];

        return NextResponse.json({ reminders });
    } catch (error) {
        console.error("AI processing error:", error);
        return NextResponse.json(
            {
                error: "Failed to process audio",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
