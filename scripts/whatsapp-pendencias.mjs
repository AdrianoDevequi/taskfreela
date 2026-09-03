/**
 * Levanta as conversas de WhatsApp dos últimos dias que podem estar esperando
 * uma resposta ou um retorno seu. Só LÊ o banco — não envia nada.
 *
 * Uso:
 *   node scripts/whatsapp-pendencias.mjs [dias]     (padrão: 3)
 *
 * Saída: texto puro, pensado para o Claude ler e resumir na rotina diária.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// .env do projeto (o Prisma Client não carrega sozinho fora do CLI)
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DIAS = Number(process.argv[2]) || 3;
// Frases que indicam que VOCÊ ficou de fazer/enviar algo.
const PROMESSAS = /\b(vou|já|depois|amanh[ãa]|mais tarde|te (passo|mando|envio|aviso)|assim que|qualquer coisa|verifico|confiro|dou uma olhada|fa[çc]o)\b/i;

const prisma = new PrismaClient();
const fmt = (d) =>
    d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
const espera = (d) => {
    if (!d) return "-";
    const h = (Date.now() - new Date(d).getTime()) / 36e5;
    return h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
};

async function main() {
    const desde = new Date(Date.now() - DIAS * 864e5);
    const instancias = await prisma.whatsappInstance.findMany({ select: { id: true, instanceName: true, connectionStatus: true } });
    const nomeInstancia = Object.fromEntries(instancias.map((i) => [i.id, i.instanceName]));

    const chats = await prisma.whatsappChat.findMany({
        where: { archived: false, ignored: false, lastMessageAt: { gte: desde } },
        orderBy: { lastMessageAt: "desc" },
    });

    const aguardando = []; // última mensagem é deles → a bola está com você
    const promessas = []; // última é sua, mas você prometeu algo e ninguém voltou

    for (const c of chats) {
        const msgs = await prisma.whatsappMessage.findMany({
            where: { chatId: c.id },
            orderBy: { timestamp: "desc" },
            take: 6,
            select: { fromMe: true, preview: true, timestamp: true },
        });
        const item = {
            nome: c.customName || c.name || c.remoteJid.split("@")[0],
            instancia: nomeInstancia[c.instanceId] || "?",
            tipo: c.type,
            prioridade: c.priority,
            status: c.status,
            taskId: c.taskId,
            ultima: c.lastMessageAt,
            espera: espera(c.firstPendingAt || c.lastMessageAt),
            naoLidas: c.unreadCount,
            msgs: msgs.reverse(),
        };
        if (!c.lastFromMe) aguardando.push(item);
        else if (PROMESSAS.test(c.lastPreview || "")) promessas.push(item);
    }

    const bloco = (titulo, lista) => {
        console.log(`\n=== ${titulo} (${lista.length}) ===`);
        for (const i of lista) {
            console.log(
                `\n## ${i.nome} [${i.tipo}] conta=${i.instancia} prioridade=${i.prioridade} status=${i.status} espera=${i.espera} nao_lidas=${i.naoLidas} tarefa=${i.taskId ?? "-"}`
            );
            for (const m of i.msgs) {
                console.log(`   ${m.fromMe ? "EU " : "ELE"} ${fmt(m.timestamp)} :: ${(m.preview || "").replace(/\s+/g, " ").slice(0, 200)}`);
            }
        }
    };

    console.log(`JANELA: últimos ${DIAS} dias (desde ${fmt(desde)}) | agora ${fmt(new Date())}`);
    console.log(
        `INSTÂNCIAS: ${instancias.map((i) => `${i.instanceName}=${i.connectionStatus}`).join(", ")}`
    );
    console.log(`CONVERSAS COM MOVIMENTO: ${chats.length}`);
    bloco("AGUARDANDO VOCÊ (última mensagem é do contato)", aguardando);
    bloco("VOCÊ FICOU DE FAZER ALGO (última mensagem é sua, com promessa)", promessas);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
