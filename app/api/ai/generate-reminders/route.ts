
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Audio = buffer.toString("base64");

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
            You are a personal assistant.
            Listen to this audio notes and extract distinct reminders/tasks.
            The user might say things like "First buy milk, then call John".
            Split these into separate items.

            Return ONLY a valid JSON Array of strings.
            Example: ["Comprar leite", "Ligar para o João"]

            Translate everything to Portuguese (Brazil).
            Keep it concise.
            Do NOT return markdown. Just the raw JSON array.
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Audio,
                    mimeType: file.type,
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();
        const cleanedText = text.replace(/```json|```/g, "").trim();
        const reminders = JSON.parse(cleanedText);

        return NextResponse.json({ reminders });

    } catch (error) {
        console.error("AI processing error:", error);
        return NextResponse.json({ error: "Failed to process audio" }, { status: 500 });
    }
}
