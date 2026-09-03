/**
 * Triagem de mensagens do WhatsApp: decide o que realmente precisa de resposta.
 *
 * Funções puras, sem banco nem rede — dá para rodar isoladamente
 * (`node --experimental-strip-types`) e é usado pelo `ingestWebhookEvent`.
 *
 * A ideia: uma mensagem recebida NEM SEMPRE abre uma pendência. "Blz",
 * "obrigado", uma figurinha ou um áudio mandado 30s depois de você falar são
 * fim de conversa, não cliente esperando. Só o que sobra vira pendência, SLA,
 * cobrança e tarefa.
 */

/** "Você acabou de falar": conversa ainda estava ao vivo. */
const LIVE_REPLY_MS = 15 * 60 * 1000;

/** Palavras que, sozinhas ou combinadas, fecham o assunto. */
const CLOSING_TOKENS = new Set([
    "ok", "okay", "oka", "okey", "blz", "beleza", "certo", "correto", "isso", "combinado", "fechou", "fechado",
    "show", "massa", "top", "perfeito", "otimo", "otima", "excelente", "maravilha", "maravilhoso", "joia",
    "valeu", "vlw", "obrigado", "obrigada", "obrigadao", "obg", "obgda", "brigado", "brigada", "agradeco",
    "agradecido", "agradecida", "grato", "grata", "disponha", "imagina", "magina", "tranquilo", "tranquila",
    "entendi", "entendido", "ciente", "anotado", "boa", "amei", "adorei", "legal", "otimoo", "sucesso",
    "abraco", "abracos", "att", "atenciosamente", "parabens",
]);

/** Palavras de enchimento que não mudam o sentido do fechamento. */
const FILLER_TOKENS = new Set([
    "muito", "mto", "mt", "e", "ai", "ta", "tah", "entao", "ja", "so", "sim", "pra", "por", "isso", "tudo",
    "bem", "certinho", "demais", "mesmo", "ate", "la", "ah", "oh", "opa", "eh", "ne", "viu", "hein", "vc",
    "voce", "voces", "vcs", "nos", "a", "o", "os", "as", "de", "do", "da", "com", "que", "meu", "amigo",
    "amiga", "cara", "mano", "gente", "boa", "bom",
]);

/** Frases de cortesia que encerram — mesmo contendo palavras de "pedido". */
const COURTESY_RE =
    /(a disposi[çc][ãa]o|no que precisar|qualquer (coisa|d[úu]vida|problema)|conte comigo|[àa]s ordens|bom (trabalho|feriado|descanso)|boa (noite|semana|sorte|viagem))/i;

/** Mensagens automáticas de atendimento/bot — ninguém está esperando resposta. */
const AUTOREPLY_RE =
    /(hor[áa]rio de atendimento|estamos (fora do hor[áa]rio|indispon[íi]ve)|n[ãa]o estamos dispon[íi]ve|retornaremos assim que|responderemos assim que|agradecemos (seu|o) contato|seu atendimento foi conclu[íi]do|pesquisa de satisfa[çc][ãa]o|avalie (o|nosso)|como podemos (te )?ajudar|seja bem[- ]vindo|escolha uma (das )?op[çc][õo]es|digite o n[úu]mero|informe o n[úu]mero do departamento|esta [ée] uma mensagem autom[áa]tica)/i;

/** Sinais de que a mensagem PEDE algo — nunca tratar como encerramento. */
const ASKING_RE =
    /\b(pode|poderia|consegue|conseguiria|precis\w*|quando|como|quanto|qual|onde|quem|manda|mande|envia|envie|passa|passe|faz|faça|faca|arrum\w*|corrig\w*|ajust\w*|resolv\w*|verific\w*|confir\w*|urgente|fora do ar|caiu|parou|deu erro|com erro|problema|or[çc]ament\w*|proposta|nota fiscal|boleto|pagamento|acesso|senha|prazo)\b/i;

/** Minúsculas, sem acento, sem pontuação/emoji. */
export function normalizeText(text: string): string {
    return (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** Só emoji/pontuação, ou risada ("kkkk", "rsrs", "hahaha"). */
export function isReaction(text: string): boolean {
    const t = (text || "").trim();
    if (!t) return false;
    const norm = normalizeText(t);
    if (norm === "") return true; // sobrou só emoji
    return /^(k+|rs+|ha+|he+|hue+)+$/.test(norm.replace(/\s/g, ""));
}

/** Frase curta feita só de agradecimento/confirmação ("beleza, obrigada!", "é isso aí"). */
export function isClosingPhrase(text: string): boolean {
    const norm = normalizeText(text);
    if (!norm || norm.length > 40) return false;
    const tokens = norm.split(" ");
    if (tokens.length > 5) return false;
    let temFechamento = false;
    for (const t of tokens) {
        if (CLOSING_TOKENS.has(t)) temFechamento = true;
        else if (!FILLER_TOKENS.has(t)) return false;
    }
    return temFechamento;
}

/**
 * A mensagem recebida dispensa resposta?
 *
 * Ordem: pergunta/pedido sempre precisa → cortesia e resposta automática não →
 * agradecimento/reação não → e, por fim, mensagem curta ou mídia enviada logo
 * depois de você falar (conversa ao vivo, ele só deu a última palavra).
 */
export function closesConversation(opts: {
    preview: string;
    messageType?: string;
    previousFromMe?: boolean;
    previousAt?: Date | null;
    when: Date;
}): boolean {
    const text = (opts.preview || "").trim();

    if (AUTOREPLY_RE.test(text)) return true;
    if (COURTESY_RE.test(text) && !text.includes("?")) return true;
    if (text.includes("?")) return false;
    if (ASKING_RE.test(text)) return false;

    if (isClosingPhrase(text)) return true;
    if (isReaction(text) || opts.messageType === "stickerMessage") return true;

    // conversa ao vivo: você falou por último há pouco e ele só reagiu/complementou
    const aoVivo =
        opts.previousFromMe === true &&
        opts.previousAt != null &&
        opts.when.getTime() - new Date(opts.previousAt).getTime() <= LIVE_REPLY_MS;
    const curtaOuMidia = normalizeText(text).length <= 40 || /^\[(áudio|figurinha|imagem|vídeo|mídia)\]$/.test(text);
    return aoVivo && curtaOuMidia;
}
