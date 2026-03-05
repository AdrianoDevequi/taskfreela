# 🚀 Guia de Integração Rápida: Google Gemini AI

Este guia resume a forma mais robusta de integrar o Gemini (Google AI) em seus projetos Next.js/Node.js, evitando os erros comuns de versão e cota que enfrentamos.

## 1. Instalação

```bash
npm install @google/generative-ai
```

## 2. Configuração (.env)

Obtenha sua chave no [Google AI Studio](https://aistudio.google.com/).

```env
GEMINI_API_KEY="sua_chave_aqui"
```

## 3. O Código "À Prova de Falhas" (Route Handler)

Copie este snippet para `app/api/ai/route.ts`. Ele já trata:
- **Seleção de Modelo**: Usa alias (`gemini-flash-latest`) para evitar erros de versão (404/429).
- **Tratamento de Erros**: Logs detalhados para debug.
- **Prompt Estruturado**: Força saída JSON limpa.

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Inicializa o cliente fora do handler para performance
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
    try {
        // 1. Receber Arquivo/Texto
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

        // 2. Converter para Buffer (necessário para Gemini)
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString("base64");

        // 3. Escolher o Modelo (O "Pulo do Gato" 🐈)
        // Use 'gemini-flash-latest' ou 'gemini-1.5-flash'.
        // Evite versões específicas (ex: -001) a menos que tenha certeza da cota.
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        // 4. O Prompt de Ouro (JSON Mode)
        const prompt = `
            Analise esta imagem/texto.
            Extraia as informações e retorne APENAS um objeto JSON válido.
            Não use markdown (\`\`\`json). Retorne apenas a string bruta do JSON.
            
            Campos esperados:
            {
                "titulo": "Resumo curto",
                "descricao": "Detalhes completos",
                "prioridade": "Alta/Media/Baixa"
            }
        `;

        // 5. Chamada à API
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: file.type,
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        // 6. Limpeza e Parse (Garante JSON válido)
        const cleanedText = text.replace(/```json|```/g, "").trim();
        const data = JSON.parse(cleanedText);

        return NextResponse.json(data);

    } catch (error) {
        // Log detalhado para não ficar cego no erro 500
        console.error("Gemini API Error:", error);
        
        return NextResponse.json({ 
            error: "Falha na IA", 
            details: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}
```

## 4. Dicas de Ouro 💡

*   **Modelos**: Se `gemini-flash-latest` der erro de cota (429), tente `gemini-2.0-flash-exp` (experimental gratuito) ou `gemini-1.5-flash-8b`.
*   **Prompt**: Sempre peça "APENAS JSON" e remova markdown no código (`replace(/```json|```/g, "")`). O Gemini adora colocar markdown em volta.
*   **Imagens**: Sempre converta para base64 antes de enviar (`inlineData`).
