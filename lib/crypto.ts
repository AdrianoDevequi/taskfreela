import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from "node:crypto";

/**
 * Criptografia simétrica para segredos guardados em repouso (ex.: a apiKey do
 * servidor Evolution de cada usuário). Usa AES-256-GCM.
 *
 * A chave deriva de WHATSAPP_ENC_KEY (recomendado) com fallback para AUTH_SECRET,
 * normalizada para 32 bytes via SHA-256. Em produção, defina WHATSAPP_ENC_KEY.
 */

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getKey(): Buffer {
    const secret = process.env.WHATSAPP_ENC_KEY || process.env.AUTH_SECRET;
    if (!secret) {
        throw new Error(
            "Segredo de criptografia ausente: defina WHATSAPP_ENC_KEY ou AUTH_SECRET."
        );
    }
    return createHash("sha256").update(secret).digest();
}

/**
 * Cifra um texto. Resultado: "enc:v1:<iv>:<authTag>:<ciphertext>" (tudo em base64).
 * Strings vazias/nulas retornam "" para simplificar o uso nos forms.
 */
export function encrypt(plain: string | null | undefined): string {
    if (!plain) return "";
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    const ciphertext = Buffer.concat([
        cipher.update(plain, "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return (
        PREFIX +
        [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":")
    );
}

/**
 * Decifra um valor produzido por encrypt(). Por compatibilidade, valores que
 * não tenham o prefixo são devolvidos como estão (assumidos texto puro legado).
 */
export function decrypt(value: string | null | undefined): string {
    if (!value) return "";
    if (!value.startsWith(PREFIX)) return value;
    try {
        const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(":");
        const iv = Buffer.from(ivB64, "base64");
        const authTag = Buffer.from(tagB64, "base64");
        const data = Buffer.from(dataB64, "base64");
        const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
        decipher.setAuthTag(authTag);
        const plain = Buffer.concat([decipher.update(data), decipher.final()]);
        return plain.toString("utf8");
    } catch (error) {
        console.error("[crypto] Falha ao decifrar valor:", error);
        return "";
    }
}

/** Mascara um segredo para exibição segura na UI (ex.: "ab12••••••wxyz"). */
export function maskSecret(plain: string | null | undefined): string {
    if (!plain) return "";
    if (plain.length <= 8) return "••••••••";
    return `${plain.slice(0, 4)}${"•".repeat(6)}${plain.slice(-4)}`;
}
