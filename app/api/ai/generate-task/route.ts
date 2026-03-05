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

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({
                error: "GEMINI_API_KEY not configured",
                details: "Please add your API Key to the .env file"
            }, { status: 500 });
        }

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString("base64");

        // Prepare Prompt
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
            Analyze this media (image or audio).
            If it's an audio, transcribe it and extract the task details.
            If it's an image, extract text/context.

            Extract the task details and return ONLY a valid JSON object with the following fields:
            - title: A concise summary of the task (max 50 chars).
            - description: A clear description of what needs to be done based on the conversation/text. Format it nicely.
            - estimatedTime: Make a best guess based on complexity ("Rápido", "Mediano", or "Demorado"). defaults to "Mediano".
            
            Do NOT return markdown formatting (like \`\`\`json). Just the raw JSON string.
            Translate everything to Portuguese (Brazil).
        `;

        const mediaPart = {
            inlineData: {
                data: base64Image,
                mimeType: file.type,
            },
        };

        const result = await model.generateContent([prompt, mediaPart]);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown if present
        const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(jsonString);

        // Enforce Rule: Due Date is always 2 days from now
        const today = new Date();
        today.setDate(today.getDate() + 2);
        data.dueDate = today.toISOString().split('T')[0];

        return NextResponse.json(data);

    } catch (error) {
        console.error("AI processing error:", error);
        return NextResponse.json({ error: "Failed to process image", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
