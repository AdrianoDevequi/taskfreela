# 🤖 Claude ↔ Taskfreela

Conecte o Taskfreela ao Claude e converse normal: "cria uma tarefa disso aí",
"o que eu tenho pra hoje?", "muda o prazo da #312 pra sexta", "pode apagar aquela do banner".

Duas camadas, mesma base:

| Camada | Pra quê |
| --- | --- |
| **MCP** (`/api/mcp`) | plugar direto no chat do Claude (app/claude.ai e Claude Code) |
| **REST** (`/api/external/*`) | scripts, automações, n8n, Zapier, WhatsApp, o que for |

---

## 1. Configuração

Duas variáveis de ambiente — já estão no `.env` local; **replique na Vercel**
(Project → Settings → Environment Variables) e faça o redeploy:

```env
TASKFRELA_API_KEY="tf_..."                        # segredo: quem tem a chave manda no seu workspace
TASKFRELA_API_USER_EMAIL="adrianodevequi@gmail.com"  # em nome de quem as tarefas são criadas
```

`TASKFRELA_API_USER_EMAIL` é opcional: sem ela, o sistema usa o primeiro superadmin.
O usuário precisa ser MANAGER/ADMIN (ou superadmin) no workspace ativo — as tarefas
entram no workspace ativo dele.

Para trocar a chave depois, é só gerar outra e atualizar a variável:

```bash
node -e "console.log('tf_'+require('crypto').randomBytes(24).toString('hex'))"
```

## 2. Ligar no chat do Claude

### App do Claude / claude.ai

Configurações → **Conectores** → *Adicionar conector personalizado*:

- **URL:** `https://www.taskfreela.com.br/api/mcp`
- **Autenticação:** Nenhum
- **Cabeçalho de requisição:** nome `x-api-key`, valor a chave (`tf_...`)

### Claude Code

```bash
claude mcp add --scope user --transport http taskfreela https://www.taskfreela.com.br/api/mcp --header "x-api-key: SUA_CHAVE_AQUI"
```

> Para clientes MCP que não deixam configurar header, existe a variante com a chave
> no caminho: `https://www.taskfreela.com.br/api/mcp/SUA_CHAVE_AQUI`. Funciona igual,
> mas aí a URL inteira é segredo — evite print, issue e grupo de WhatsApp.

### Ferramentas que o Claude ganha

| Ferramenta | O que faz |
| --- | --- |
| `criar_tarefa` | cria a tarefa (título, descrição, prazo, responsável, projeto, esforço, obrigatória) |
| `listar_tarefas` | lista/filtra por status, responsável, projeto, busca no título, atrasadas |
| `ver_tarefa` | detalhe completo, com descrição e comentários |
| `atualizar_tarefa` | edita qualquer campo, inclusive concluir (`status: "DONE"`) |
| `excluir_tarefa` | exclui de vez (o Claude é instruído a confirmar antes) |
| `comentar_tarefa` | adiciona comentário |
| `contexto_taskfreela` | workspace, membros, projetos e a data de hoje |

Tudo respeita as regras do app: quem recebe tarefa é avisado por WhatsApp e push,
o fluxo de aprovação continua igual e tarefa recorrente concluída já gera a próxima.
Tarefas criadas por aí ficam marcadas com `source: "claude"`.

## 3. REST

Autenticação em qualquer uma das três formas:
`Authorization: Bearer <chave>`, `x-api-key: <chave>` ou `?key=<chave>`.

```bash
# criar
curl -X POST https://www.taskfreela.com.br/api/external/tasks \
  -H "Authorization: Bearer $TASKFRELA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Revisar proposta","description":"Cliente pediu ajuste no escopo","dueDate":"amanhã","assignee":"Gustavo","project":"dev.ferznunes.com","estimatedTime":"Rápido"}'

# listar (abertas por padrão)
curl "https://www.taskfreela.com.br/api/external/tasks?status=TODO&assignee=gustavo&limit=10" \
  -H "Authorization: Bearer $TASKFRELA_API_KEY"

# detalhe
curl "https://www.taskfreela.com.br/api/external/tasks?id=312" -H "Authorization: Bearer $TASKFRELA_API_KEY"

# editar / concluir
curl -X PUT https://www.taskfreela.com.br/api/external/tasks \
  -H "Authorization: Bearer $TASKFRELA_API_KEY" -H "Content-Type: application/json" \
  -d '{"id":312,"status":"DONE"}'

# comentar
curl -X POST https://www.taskfreela.com.br/api/external/comments \
  -H "Authorization: Bearer $TASKFRELA_API_KEY" -H "Content-Type: application/json" \
  -d '{"id":312,"content":"Cliente aprovou por e-mail"}'

# excluir
curl -X DELETE "https://www.taskfreela.com.br/api/external/tasks?id=312" \
  -H "Authorization: Bearer $TASKFRELA_API_KEY"

# contexto (membros, projetos, data de hoje)
curl https://www.taskfreela.com.br/api/external/context -H "Authorization: Bearer $TASKFRELA_API_KEY"

# whatsapp (conversas aguardando resposta)
curl https://www.taskfreela.com.br/api/external/whatsapp -H "Authorization: Bearer $TASKFRELA_API_KEY"
```

`GET /whatsapp` devolve `pendentes`, `prioridadeAlta` e `esperandoDesde` (o início da
espera mais antiga). O critério é o mesmo do cron de SLA: chat `pending`, fora os
silenciados, ignorados e arquivados. As instâncias são por usuário, então a contagem
é a do dono da chave, não a do workspace.

`GET /context` traz `tarefasAbertas` e `tarefasAtrasadas` como contagem real. Prefira
esses números a medir o tamanho da resposta de `GET /tasks`, que é paginada com teto
de 100 e satura em silêncio.

### Campos de `POST /tasks`

| Campo | Obrigatório | Observação |
| --- | --- | --- |
| `title` | sim | título curto |
| `description` | não | texto livre |
| `dueDate` | não | `2026-08-30`, `30/08`, `hoje`, `amanhã`, `em 3 dias`, `+5d`. Padrão: hoje + 2 dias |
| `assignee` | não | nome (aceita só o primeiro nome, sem acento) ou e-mail. Padrão: o dono da chave |
| `project` | não | nome do projeto, casa por trecho |
| `estimatedTime` | não | `Rápido` \| `Mediano` \| `Demorado` (padrão `Mediano`) |
| `status` | não | padrão `TODO` |
| `isMandatory` | não | dispara os lembretes obrigatórios |

Filtros de `GET /tasks`: `status`, `assignee`, `project`, `search`, `overdue=true`, `limit`, `id`.

## 4. Arquitetura

- `lib/external-api.ts` — regra de negócio (auth por chave, parsing de data, busca de membro/projeto, CRUD).
- `app/api/external/tasks/route.ts` — REST de tarefas (POST/GET/PUT/DELETE).
- `app/api/external/comments/route.ts` — comentários.
- `app/api/external/context/route.ts` — membros, projetos, data de hoje e os totais de tarefas.
- `app/api/external/whatsapp/route.ts` — conversas do WhatsApp aguardando resposta.
- `lib/mcp-server.ts` — servidor MCP (JSON-RPC sobre HTTP, sem dependência nova).
- `app/api/mcp/route.ts` — MCP com a chave no header; `app/api/mcp/[token]/route.ts` — chave na URL.
- `lib/task-notifications.ts` e `lib/task-recurrence.ts` — avisos e recorrência, compartilhados
  entre a tela (`/api/tasks`) e a API externa, pra não haver dois comportamentos diferentes.
