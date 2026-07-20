# Tutorial: Integracao LangChain + MCP Server

Projeto de estudo para entender como o **Model Context Protocol (MCP)** se integra com o **LangChain**, permitindo que agentes LangChain consumam tools expostas por um servidor MCP.

---

## Sumario

1. [Visao Geral](#1-visao-geral)
2. [Como Funciona a Integracao](#2-como-funciona-a-integracao)
3. [Arquitetura do Projeto](#3-arquitetura-do-projeto)
4. [Configuracao](#4-configuracao)
5. [Arquivo por Arquivo](#5-arquivo-por-arquivo)
6. [Conceitos Teoricos](#6-conceitos-teoricos)
7. [Execucao e Testes](#7-execucao-e-testes)

---

## 1. Visao Geral

### O problema

Imagine que voce tem um servidor MCP com tools (calculator, weather, notes) e quer que um agente LangChain use essas tools. Sem o adapter, voce precisaria:

1. Reimplementar cada tool no formato LangChain
2. Manter duas versoes da mesma logica
3. Sincronizar mudancas entre MCP e LangChain

### A solucao

O pacote `@langchain/mcp-adapters` resolve isso automaticamente:

```
Servidor MCP                    LangChain
(calculator,    ── adapter ──>  Agent com tools
 weather, notes)                (calculator, weather, notes)
```

O adapter:
1. Conecta ao servidor MCP via stdio
2. Descobre as tools disponiveis (`tools/list`)
3. Converte cada tool MCP para o formato LangChain
4. Permite que o agente use as tools normalmente

### Dependencias

| Pacote | Funcao |
|--------|--------|
| `@langchain/mcp-adapters` | Converte tools MCP para tools LangChain |
| `@langchain/openai` | Wrapper OpenAI para LangChain |
| `@langchain/core` | Core do LangChain |
| `langchain` | Framework de agentes |
| `@modelcontextprotocol/sdk` | SDK oficial MCP (servidor) |
| `dotenv` | Variaveis de ambiente |
| `express` | Servidor HTTP (para a API) |
| `zod` | Validacao de schemas |

---

## 2. Como Funciona a Integracao

### Fluxo completo

```
┌──────────────────────────────────────────────────────────┐
│                     Sua Aplicacao                        │
│                                                          │
│  1. MultiServerMCPClient.connect()                       │
│     │                                                    │
│     ├── 2. Lanca MCP Server como subprocesso             │
│     │      (node src/server/index.js)                    │
│     │                                                    │
│     ├── 3. Handshake via stdio (initialize)              │
│     │                                                    │
│     ├── 4. Lista tools (tools/list)                      │
│     │      → calculator, get_weather, create_note, ...   │
│     │                                                    │
│     └── 5. Converte tools MCP → LangChain tools          │
│            │                                             │
│  6. createAgent({ model, tools })                        │
│     │                                                    │
│  7. agent.invoke({ messages: [...] })                    │
│     │                                                    │
│     ├── LLM decide usar tool?                            │
│     │   ├── Sim → chama tool via MCP → retorna resultado │
│     │   └── Nao → responde diretamente                   │
│     │                                                    │
│  8. Retorna resposta ao usuario                          │
└──────────────────────────────────────────────────────────┘
```

### O que e `MultiServerMCPClient`

E uma classe do `@langchain/mcp-adapters` que:

- Gerencia conexoes com um ou mais servidores MCP
- Lanca servidores como subprocessos (stdio)
- Descobre tools automaticamente
- Converte tools MCP para tools LangChain
- Gerencia lifecycle (conexao/desconexao)

```js
const client = new MultiServerMCPClient({
  // Chave arbitraria para identificar o servidor
  mcpServer: {
    transport: "stdio",           // Comunicacao via stdin/stdout
    command: "node",              // Comando para iniciar o servidor
    args: ["src/server/index.js"], // Argumentos do comando
  },
});

const tools = await client.getTools(); // Tools convertidas para LangChain
```

### Como a conversao funciona

O adapter converte automaticamente:

| MCP | LangChain |
|-----|-----------|
| `tool.name` | `tool.name` |
| `tool.description` | `tool.description` |
| `tool.inputSchema` (JSON Schema) | `tool.schema` (Zod) |
| `tool.execute(args)` | `tool.invoke(args)` |

O formato de retorno tambem e convertido:

```js
// MCP retorna:
{
  content: [{ type: "text", text: "Resultado: 4" }]
}

// LangChain recebe:
"Resultado: 4"  // (string direta)
```

---

## 3. Arquitetura do Projeto

```
langchain-mcp/
├── .env                      # Variaveis de ambiente (OPENAI_API_KEY)
├── .env.example              # Template do .env
├── .gitignore                # Arquivos ignorados pelo Git
├── package.json              # Dependencias e scripts
├── TUTORIAL.md               # Este arquivo
└── src/
    ├── server/
    │   ├── config.js         # Configuracao do servidor MCP
    │   └── index.js          # Entrypoint do servidor MCP
    ├── tools/
    │   ├── index.js          # Registro centralizado de tools
    │   ├── calculator.js     # Tool de calculadora
    │   ├── weather.js        # Tool de previsao do tempo
    │   └── notes.js          # Tool de gerenciamento de notas
    ├── client/
    │   ├── agent.js          # CLI interativo com o agente
    │   └── app.js            # API HTTP com Express
    └── utils/
        └── logger.js         # Utilitario de logging
```

### Fluxo de Dependencias

```
src/client/agent.js (CLI interativo)
  ├── MultiServerMCPClient
  │   └── src/server/index.js (MCP Server como subprocesso)
  │       └── src/tools/*.js (Tools MCP)
  ├── ChatOpenAI (OpenAI)
  └── createAgent (LangChain)

src/client/app.js (API HTTP)
  ├── MultiServerMCPClient
  │   └── src/server/index.js (MCP Server como subprocesso)
  │       └── src/tools/*.js (Tools MCP)
  ├── ChatOpenAI (OpenAI)
  ├── createAgent (LangChain)
  └── Express
```

---

## 4. Configuracao

### Variaveis de Ambiente

```env
# Obrigatorio
OPENAI_API_KEY=sk-proj-...

# Opcional
LOG_LEVEL=info          # debug, info, warn, error
PORT=3000               # Porta do servidor HTTP (app.js)
MCP_SERVER_NAME=langchain-mcp-server
MCP_SERVER_VERSION=1.0.0
```

### Scripts

```bash
npm start         # Inicia o agente CLI interativo
npm run api       # Inicia o servidor HTTP com Express
npm run server    # Inicia apenas o MCP server (para testes)
```

---

## 5. Arquivo por Arquivo

### 5.1 `server/config.js` - Configuracao do MCP Server

```js
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

export const config = {
  serverName: process.env.MCP_SERVER_NAME || "langchain-mcp-server",
  serverVersion: process.env.MCP_SERVER_VERSION || "1.0.0",
  logLevel: process.env.LOG_LEVEL || "info",
};
```

**Por que carregar .env aqui?**
O servidor MCP roda como subprocesso. Ele precisa carregar o .env de forma independente, ja que nao herda as variaveis do processo pai.

---

### 5.2 `server/index.js` - Servidor MCP

```js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// ...

const server = new McpServer({
  name: config.serverName,
  version: config.serverVersion,
});

for (const tool of tools) {
  server.registerTool(tool.name, {
    description: tool.description,
    inputSchema: tool.inputSchema,
  }, async (args) => {
    return await tool.execute(args);
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Fluxo:**
1. Cria `McpServer` com nome e versao
2. Registra cada tool com `registerTool`
3. Conecta via `StdioServerTransport`
4. Pronto para receber requisicoes via stdin

**Por que StdioServerTransport?**
O `MultiServerMCPClient` lança o servidor como subprocesso e comunica via stdin/stdout. Isso e o padrao para ferramentas de desenvolvimento local.

---

### 5.3 `tools/calculator.js` - Calculadora

```js
import { z } from "zod";

export const calculatorTool = {
  name: "calculator",
  description: "Resolve calculos matematicos",
  inputSchema: {
    expression: z.string().describe("A expressao matematica"),
  },
  async execute(args) {
    const sanitized = args.expression.replace(/[^0-9+\-*/().%\s]/g, "");
    if (sanitized !== args.expression) {
      throw new Error("Expressao contem caracteres invalidos");
    }
    const result = Function('"use strict"; return (' + args.expression + ")")();
    return {
      content: [{ type: "text", text: `Resultado: ${result}` }],
    };
  },
};
```

**Seguranca:** A tool sanitiza a expressao antes de avaliar, impedindo injecao de codigo.

---

### 5.4 `tools/weather.js` - Previsao do Tempo

Dados simulados para 8 cidades brasileiras. Em producao, poderia chamar uma API real.

---

### 5.5 `tools/notes.js` - Notas

CRUD em memoria com 3 tools: `create_note`, `list_notes`, `delete_note`. Demonstra como tools podem manter estado entre chamadas.

---

### 5.6 `client/agent.js` - CLI Interativo

```js
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";

// 1. Conectar ao MCP Server
const mcpClient = new MultiServerMCPClient({
  mcpServer: {
    transport: "stdio",
    command: "node",
    args: [SERVER_PATH],
  },
});

// 2. Obter tools convertidas
const tools = await mcpClient.getTools();

// 3. Criar agente LangChain com tools MCP
const agent = createAgent({ model: llm, tools });

// 4. Usar o agente
const response = await agent.invoke({
  messages: [{ role: "user", content: "Quanto e 2 + 2?" }],
});
```

**Fluxo do CLI:**
1. Inicia e conecta ao MCP Server
2. Lista tools disponiveis
3. Entra em loop de leitura
4. Para cada pergunta, invoca o agente
5. O agente decide se usa tool MCP ou responde direto

---

### 5.7 `client/app.js` - API HTTP

```js
app.post("/chat", async (req, res) => {
  const { message } = req.body;
  const response = await agent.invoke({
    messages: [{ role: "user", content: message }],
  });
  res.json({ response: lastMessage.content });
});
```

**Endpoints:**
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/chat` | Enviar mensagem ao agente |
| GET | `/health` | Verificar status |

---

## 6. Conceitos Teoricos

### MCP vs LangChain

| Aspecto | MCP | LangChain |
|---------|-----|-----------|
| O que e | Protocolo padronizado | Framework de aplicacao |
| Papel | Expoe tools/resources | Constroi agentes/chains |
| Comunicacao | JSON-RPC 2.0 via stdio/HTTP | Chamadas diretas em JS |
| Onde roda | Servidor (subprocesso) | Cliente (app principal) |

### Por que usar os dois?

```
Sem MCP:
  LangChain agent -> Tool A (implementada em JS)
  LangChain agent -> Tool B (implementada em JS)
  (cada tool e feita sob medida para LangChain)

Com MCP:
  LangChain agent -> MCP Server -> Tool A (qualquer linguagem)
                                 -> Tool B (qualquer linguagem)
                                 -> Tool C (reutilizavel)
  (tools sao reutilizaveis por qualquer cliente MCP)
```

### O adapter `@langchain/mcp-adapters`

O pacote fornece duas formas de usar:

#### 1. MultiServerMCPClient (recomendado)

Gerencia tudo automaticamente:
```js
const client = new MultiServerMCPClient({
  server1: { transport: "stdio", command: "node", args: ["..."] },
  server2: { transport: "http", url: "http://localhost:8000/mcp" },
});
const tools = await client.getTools();
```

#### 2. loadMcpTools (controle manual)

Voce gerencia o cliente MCP:
```js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadMcpTools } from "@langchain/mcp-adapters";

const client = new Client({ name: "my-client", version: "1.0.0" });
const transport = new StdioClientTransport({ command: "node", args: ["..."] });
await client.connect(transport);

const tools = await loadMcpTools("server-name", client);
```

### Stateless vs Stateful

`MultiServerMCPClient` e **stateless por padrao**. Cada chamada de tool cria uma nova sessao MCP, executa, e limpa. Isso e ideal para tools sem estado (calculator, weather).

Para tools com estado (notes), o servidor MCP mantem o estado independentemente. O cliente so envia comandos.

---

## 7. Execucao e Testes

### Instalacao

```bash
cd langchain-mcp
npm install
```

### Configuracao

1. Copie `.env.example` para `.env`
2. Adicione sua `OPENAI_API_KEY` no `.env`

### Opcao 1: CLI Interativo

```bash
npm start
```

Exemplo de interacao:
```
=== LangChain + MCP Agent ===
Conectando ao servidor MCP...
Tools MCP carregadas: calculator, get_weather, create_note, list_notes, delete_note

Digite sua pergunta (ou 'sair' para encerrar):

Voce: Quanto e 25 * 4?
Agente: O resultado de 25 * 4 e 100.

Voce: Como esta o tempo em Sao Paulo?
Agente: Em Sao Paulo esta ensolarado com temperatura de 28°C e umidade de 65%.

Voce: Crie uma nota sobre reuniao
Agente: Nota criada com sucesso! ID: 1, Titulo: reuniao

Voce: Quais minhas notas?
Agente: Notas salvas: [1] reuniao - 2026-07-20T...

Voce: sair
Encerrando...
```

### Opcao 2: API HTTP

```bash
npm run api
```

Teste com curl:
```bash
# Chat
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Quanto e 10 + 5?"}'

# Health check
curl http://localhost:3000/health
```

### Opcao 3: Apenas MCP Server

```bash
npm run server
```

Isso inicia o servidor MCP isoladamente (util para testes com MCP Inspector).

### Testando com MCP Inspector

```bash
npx @modelcontextprotocol/inspector node src/server/index.js
```

---

## Adicionando Novas Tools

1. Crie o arquivo em `src/tools/minha-tool.js`:

```js
import { z } from "zod";

export const minhaTool = {
  name: "minha_tool",
  description: "Descricao da tool",
  inputSchema: {
    param1: z.string().describe("Descricao do parametro"),
  },
  async execute(args) {
    return {
      content: [{ type: "text", text: `Resultado: ${args.param1}` }],
    };
  },
};
```

2. Adicione o import em `src/tools/index.js`:

```js
import { minhaTool } from "./minha-tool.js";

export const tools = [
  // ... tools existentes
  minhaTool,
];
```

3. Reinicie a aplicacao. A nova tool aparece automaticamente no agente.

---

## Solucao de Problemas

### Erro: "OPENAI_API_KEY not set"
Verifique se o `.env` esta configurado corretamente.

### Erro: "spawn node ENOENT"
O caminho para o `src/server/index.js` esta incorreto. Verifique a constante `SERVER_PATH`.

### Erro: "Tool execution failed"
Verifique se o servidor MCP esta funcionando com `npm run server`.

### Tools nao aparecem no agente
Verifique se `@langchain/mcp-adapters` esta instalado: `npm ls @langchain/mcp-adapters`.

---

*Projeto de estudo - Integracao LangChain + MCP (Model Context Protocol) com Node.js*
