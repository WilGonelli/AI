# API com Endpoints vs MCP

## Visão Geral

O projeto atual usa **MCP via stdio** (comunicação entre processos). Mas e se você quisesse expor isso como uma **API HTTP** com endpoints REST?

### Comparação

| Abordagem | Como funciona | Quando usar |
|-----------|---------------|-------------|
| **MCP stdio** (atual) | Dois processos Node se comunicam via stdin/stdout | CLI local, desktop apps |
| **MCP HTTP** | MCP Server roda como servidor HTTP | Múltiplos clientes, rede |
| **API REST** | Endpoints HTTP tradicionais | Integração com web, mobile |

---

## Arquitetura com API HTTP

```
┌─────────────┐     HTTP      ┌─────────────┐     MCP      ┌─────────────┐
│   Cliente   │ <============> │  API HTTP   │ <===========> │  MCP Server │
│  (Web/Mobile)│   REST/JSON   │  (Express)  │   stdio/HTTP  │ (ferramentas)│
└─────────────┘               └─────────────┘               └─────────────┘
                                    │
                                    │ HTTP
                                    ▼
                              ┌─────────────┐
                              │    LLM      │
                              │  (Gemini)   │
                              └─────────────┘
```

---

## Exemplo: API com Express + MCP

### Estrutura de arquivos

```
api-server.js          ← Novo: servidor HTTP
servidor_financeiro.js ← Existente: MCP server
app.js                 ← Existente: CLI (mantido)
```

### Código: api-server.js

```javascript
import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// ── Conectar ao MCP Server ──────────────────────────────────
const transport = new StdioClientTransport({
  command: "node",
  args: ["servidor_financeiro.js"],
});

const mcpClient = new Client({ name: "api-server", version: "1.0.0" });
await mcpClient.connect(transport);

// ── Descobrir tools do MCP ──────────────────────────────────
const { tools: mcpTools } = await mcpClient.listTools();

// ── Converter MCP → LangChain tools ─────────────────────────
function jsonSchemaParaZod(schema) {
  const shape = {};
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    let zodType;
    switch (prop.type) {
      case "string": zodType = z.string(); break;
      case "number": zodType = z.number(); break;
      default: zodType = z.any();
    }
    if (prop.description) zodType = zodType.describe(prop.description);
    if (!schema.required?.includes(key)) zodType = zodType.optional();
    shape[key] = zodType;
  }
  return z.object(shape);
}

const ferramentas = mcpTools.map(tool => new DynamicStructuredTool({
  name: tool.name,
  description: tool.description,
  schema: jsonSchemaParaZod(tool.inputSchema),
  func: async (args) => {
    const result = await mcpClient.callTool({ name: tool.name, arguments: args });
    return result.content.map(c => c.text).join("\n");
  },
}));

// ── Criar agente ────────────────────────────────────────────
const modelo = new ChatOpenAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0.1,
  configuration: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
});

const agente = createReactAgent({
  llm: modelo,
  tools: ferramentas,
  prompt: "Você é um assistente financeiro. Use as ferramentas para ajudar.",
});

// ── Endpoints da API ────────────────────────────────────────

// Chat - envia mensagem e recebe resposta
app.post("/api/chat", async (req, res) => {
  try {
    const { mensagem } = req.body;
    
    const resposta = await agente.invoke({
      messages: [{ role: "user", content: mensagem }],
    });
    
    const ultimaMsg = resposta.messages[resposta.messages.length - 1];
    
    res.json({
      resposta: ultimaMsg.content,
      sucesso: true,
    });
  } catch (erro) {
    res.status(500).json({
      erro: erro.message,
      sucesso: false,
    });
  }
});

// Listar tools disponíveis
app.get("/api/tools", async (req, res) => {
  const lista = mcpTools.map(t => ({
    nome: t.name,
    descricao: t.description,
    parametros: t.inputSchema,
  }));
  res.json(lista);
});

// Chamar tool diretamente (sem LLM)
app.post("/api/tools/:nome", async (req, res) => {
  try {
    const { nome } = req.params;
    const { arguments: args } = req.body;
    
    const result = await mcpClient.callTool({ name: nome, arguments: args });
    
    res.json({
      resultado: result.content.map(c => c.text).join("\n"),
      sucesso: true,
    });
  } catch (erro) {
    res.status(500).json({
      erro: erro.message,
      sucesso: false,
    });
  }
});

// Obter gastos de um mês
app.get("/api/gastos/:anoMes", async (req, res) => {
  try {
    const { anoMes } = req.params;
    
    const result = await mcpClient.callTool({
      name: "obter_gastos_mes",
      arguments: { ano_mes: anoMes },
    });
    
    res.json({
      dados: result.content.map(c => c.text).join("\n"),
      sucesso: true,
    });
  } catch (erro) {
    res.status(500).json({
      erro: erro.message,
      sucesso: false,
    });
  }
});

// ── Iniciar servidor ────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
  console.log(`Endpoints disponíveis:`);
  console.log(`  POST /api/chat              - Chat com IA`);
  console.log(`  GET  /api/tools             - Listar ferramentas`);
  console.log(`  POST /api/tools/:nome       - Chamar tool diretamente`);
  console.log(`  GET  /api/gastos/:anoMes    - Obter gastos do mês`);
});
```

---

## Endpoints Explicados

### POST /api/chat

O endpoint principal. Envia uma mensagem e o LLM decide se precisa usar tools.

**Request:**
```json
{
  "mensagem": "Gastei 800 reais em 3x com o cabeçote do carro"
}
```

**Fluxo interno:**
```
Recebe mensagem
    │
    ▼
agente.invoke(mensagem)
    │
    ├──→ LLM analisa
    │       │
    │       ▼
    │    "Preciso usar registrar_parcela"
    │       │
    │       ▼
    │    client.callTool() → MCP Server → financas.md
    │       │
    │       ▼
    │    Resultado volta ao LLM
    │       │
    │       ▼
    │    LLM gera resposta final
    │
    ▼
 Retorna JSON
```

**Response:**
```json
{
  "resposta": "Pronto! Registrei 3x de R$ 266.67 para 'cabeçote do carro'. Parcelas: 22/07, 22/08, 22/09.",
  "sucesso": true
}
```

---

### GET /api/tools

Lista todas as ferramentas disponíveis no MCP Server.

**Response:**
```json
[
  {
    "nome": "registrar_gasto",
    "descricao": "Registra um novo gasto no arquivo Markdown...",
    "parametros": {
      "type": "object",
      "properties": {
        "valor": { "type": "number" },
        "categoria": { "type": "string" },
        "descricao": { "type": "string" }
      }
    }
  },
  {
    "nome": "obter_gastos_mes",
    "descricao": "Lê a tabela de gastos de um mês específico...",
    "parametros": { ... }
  },
  {
    "nome": "registrar_parcela",
    "descricao": "Registra uma compra parcelada...",
    "parametros": { ... }
  }
]
```

---

### POST /api/tools/:nome

Chama uma tool diretamente, sem passar pelo LLM.

**Request:**
```json
POST /api/tools/registrar_gasto

{
  "arguments": {
    "valor": 15,
    "categoria": "Alimentação",
    "descricao": "café"
  }
}
```

**Response:**
```json
{
  "resultado": "Sucesso: R$ 15.00 registrado em 'Alimentação' para o mês 2026-07.",
  "sucesso": true
}
```

---

### GET /api/gastos/:anoMes

Busca os gastos de um mês específico.

**Request:**
```
GET /api/gastos/2026-07
```

**Response:**
```json
{
  "dados": "## Conteúdo de 2026-07\n| Data | Valor | Categoria | Descrição |\n| 2026-07-22 | R$ 15.00 | Alimentação | café |",
  "sucesso": true
}
```

---

## Comparação: CLI vs API

| Aspecto | CLI (app.js atual) | API (api-server.js) |
|---------|-------------------|---------------------|
| **Interface** | Terminal (readline) | HTTP (curl, Postman, browser) |
| **Acesso** | Local apenas | Rede (local ou internet) |
| **Usuários** | 1 por vez | Múltiplos simultâneos |
| **Autenticação** | Nenhuma | JWT, API Key, OAuth |
| **Persistência** | Sessão do terminal | Stateless (cada request独立) |
| **Complexidade** | Simples | Média |

---

## Exemplos de Uso da API

### Com curl

```bash
# Chat com o assistente
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"mensagem": "Gastei 50 reais no almoço"}'

# Listar tools
curl http://localhost:3000/api/tools

# Chamar tool diretamente
curl -X POST http://localhost:3000/api/tools/registrar_gasto \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"valor": 50, "categoria": "Alimentação", "descricao": "almoço"}}'

# Obter gastos de julho
curl http://localhost:3000/api/gastos/2026-07
```

### Com JavaScript (fetch)

```javascript
// Chat
const response = await fetch("http://localhost:3000/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mensagem: "Quanto gastei este mês?" }),
});
const data = await response.json();
console.log(data.resposta);
```

### Com Python (requests)

```python
import requests

# Chat
response = requests.post("http://localhost:3000/api/chat", json={
    "mensagem": "Registre 100 reais de transporte"
})
print(response.json()["resposta"])
```

---

## Deploy em Produção

Para produção, considere:

```
┌─────────────┐     HTTPS     ┌─────────────┐
│   Nginx     │ <============> │   API       │
│   (reverse  │                │   (Express) │
│    proxy)   │                │   :3000     │
└─────────────┘                └──────┬──────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
              │ MCP Server│    │   LLM     │    │  Banco    │
              │ (tools)   │    │ (Gemini)  │    │ de Dados  │
              └───────────┘    └───────────┘    └───────────┘
```

**Dicas:**
1. Use **PM2** ou **Docker** para gerenciar o processo
2. Adicione **rate limiting** para proteger o LLM
3. Implemente **autenticação** (API Key ou JWT)
4. Use **cache** para reduzir chamadas ao LLM
5. Monitore **latência** e **erros**
