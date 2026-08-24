import OpenAI, { toFile } from "openai";

/**
 * Cliente compartilhado da OpenAI (usado pelas rotas de IA).
 * Substitui a antiga integração com o Gemini.
 */
/** Aceita os dois nomes de variável: OPEN_AI_KEY ou OPENAI_API_KEY. */
export function getOpenAIKey() {
    return process.env.OPEN_AI_KEY || process.env.OPENAI_API_KEY || "";
}

export const openai = new OpenAI({ apiKey: getOpenAIKey() });

/** Modelo de texto/visão. Configurável por env. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

/** Modelo de transcrição de áudio. Configurável por env. */
export const OPENAI_TRANSCRIBE_MODEL =
    process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

export function assertOpenAIKey() {
    if (!getOpenAIKey()) {
        throw new Error(
            "Chave da OpenAI não configurada. Adicione OPEN_AI_KEY (ou OPENAI_API_KEY) no arquivo .env."
        );
    }
}

/** Converte o arquivo enviado no form-data para um Buffer. */
export async function fileToBuffer(file: File) {
    return Buffer.from(await file.arrayBuffer());
}

/** Transcreve um áudio (webm, mp3, wav, m4a...) para texto. */
export async function transcribeAudio(file: File) {
    const buffer = await fileToBuffer(file);
    const upload = await toFile(buffer, file.name || "audio.webm", {
        type: file.type || "audio/webm",
    });

    const transcription = await openai.audio.transcriptions.create({
        file: upload,
        model: OPENAI_TRANSCRIBE_MODEL,
        language: "pt",
    });

    return transcription.text;
}

/** Monta uma data URL base64 para enviar imagem ao modelo de visão. */
export async function fileToDataUrl(file: File) {
    const buffer = await fileToBuffer(file);
    const mimeType = file.type || "image/png";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/** Remove cercas de markdown que o modelo eventualmente devolve. */
export function stripJsonFences(text: string) {
    return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}
