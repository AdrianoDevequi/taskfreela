# 🚀 Guia de Integração: OpenAI (ChatGPT)

Este guia resume como a IA que transforma **print ou voz em tarefa** está integrada no projeto.
A integração anterior era com o Google Gemini e foi migrada para a OpenAI.

## 1. Instalação

```bash
npm install openai
```

## 2. Configuração (.env)

Obtenha sua chave em [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

```env
OPEN_AI_KEY="sua_chave_aqui"   # OPENAI_API_KEY também funciona

# Opcionais (têm defaults no código)
OPENAI_MODEL="gpt-5.4-mini"           # modelo de texto/visão
OPENAI_TRANSCRIBE_MODEL="whisper-1"   # modelo de transcrição de áudio
```

## 3. Arquitetura

- `lib/openai.ts` — cliente compartilhado + helpers (`transcribeAudio`, `fileToDataUrl`, `stripJsonFences`).
- `app/api/ai/generate-task/route.ts` — recebe **imagem ou áudio** e devolve `{ title, description, estimatedTime, dueDate }`.
- `app/api/ai/generate-reminders/route.ts` — recebe **áudio** e devolve `{ reminders: string[] }`.

### Diferença importante em relação ao Gemini

O Gemini aceitava imagem **e** áudio no mesmo `generateContent`. Na OpenAI o fluxo é separado:

| Entrada | Como é processada |
| --- | --- |
| Imagem | Enviada como data URL base64 em `image_url` para o modelo de visão (`chat.completions`) |
| Áudio  | Transcrita antes com `audio.transcriptions` (Whisper) e só então o texto vai para o `chat.completions` |

O front grava áudio em `audio/webm`, formato suportado pelo Whisper — nenhuma conversão é necessária.

## 4. JSON garantido

Em vez de pedir "sem markdown" no prompt e torcer, usamos o JSON mode nativo:

```typescript
const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
    ],
});
```

O `response_format: { type: "json_object" }` exige que a palavra "JSON" apareça no prompt — ela já está
nos system prompts das duas rotas. O `stripJsonFences()` continua como rede de segurança.

## 5. Dicas 💡

*   **Modelo**: `gpt-5.4-mini` é o default (equivalente em custo/velocidade ao `gemini-flash`). Para prints difíceis,
    troque `OPENAI_MODEL` para `gpt-5.4` ou `gpt-4o` sem mexer no código.
*   **Transcrição**: `whisper-1` é o mais compatível. `gpt-4o-mini-transcribe` é mais barato e rápido.
*   **Erro 401**: chave ausente/inválida — a rota responde com a mensagem em `details`, visível no alert do front.
*   **Erro 429**: cota/créditos esgotados na conta OpenAI (é pré-pago, diferente do free tier do Gemini).
