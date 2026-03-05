# Sistema de Gestão de Tarefas e Agenda Inteligente 🧠📅

Este projeto é uma aplicação web moderna para gestão pessoal de tarefas, lembretes e organização de agenda, com foco em produtividade e integração com ferramentas do Google.

## ✨ Funcionalidades Principais

### 1. ✅ Gestão de Tarefas (Kanban)
*   **Quadro Interativo**: Visualize e mova tarefas entre colunas (A Fazer, Em Progresso, Concluído).
*   **Magic Mode com IA**: Crie tarefas complexas a partir de comandos de voz ou imagens (ex: foto de um caderno ou quadro branco) usando Inteligência Artificial.
*   **Metadados**: Adicione prazos, prioridades e descrições detalhadas.

### 2. 🔔 Lembretes Inteligentes
*   **Dashboard de Lembretes**: Visualize seus compromissos e lembretes em cards organizados.
*   **Integração com IA**: Sugestões automáticas de lembretes baseados no seu contexto.

### 3. 🌍 Multi-Contas Google Calendar (Novo!)
*   **Conexão Múltipla**: Conecte **múltiplas contas Google** (ex: Pessoal, Trabalho, Projetos) simultaneamente.
*   **Visualização Unificada**: Veja eventos de todas as suas contas em uma única tela, com identificação clara de qual conta/agenda pertence o evento.
*   **Filtros Personalizados**: Escolha quais agendas exibir no seu painel.
*   **Criação de Eventos**: Crie novos eventos diretamente pelo app, escolhendo em **qual agenda/conta** o evento será salvo.

## 🛠️ Tecnologias Utilizadas

*   **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS, Lucide Icons.
*   **Backend**: Next.js API Routes.
*   **Banco de Dados**: PostgreSQL (via Prisma ORM).
*   **Autenticação & Integrações**: Google OAuth 2.0, Google Calendar API.
*   **IA**: Integração com LLMs para processamento de voz e imagem.

## 🚀 Como Rodar o Projeto

1.  **Clone o repositório**:
    ```bash
    git clone https://github.com/AdrianoDevequi/sistema-de-tarefas.git
    cd sistema-de-tarefas
    ```

2.  **Instale as dependências**:
    ```bash
    npm install
    ```

3.  **Configure as Variáveis de Ambiente**:
    Crie um arquivo `.env` na raiz e adicione suas credenciais (Banco de Dados, Google Client ID/Secret, etc).

4.  **Execute o servidor de desenvolvimento**:
    ```bash
    npm run dev
    ```

5.  Acesse `http://localhost:3000`.

---
Desenvolvido com ❤️ e IA.
