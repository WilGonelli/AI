# Tutorial: Servidor MCP com Node.js

Projeto de estudo para entender o **Model Context Protocol (MCP)** - um protocolo padronizado para conectar LLMs a ferramentas, recursos e prompts externos.

---

## Sumario

1. [Visao Geral](#1-visao-geral)
2. [Arquitetura do Projeto](#2-arquitetura-do-projeto)
3. [Configuracao](#3-configuracao)
4. [Arquivo por Arquivo](#4-arquivo-por-arquivo)
   - [server/config.js - Configuracao](#41-serverconfigjs---configuracao)
   - [server/index.js - Servidor Principal](#42-serverindexjs---servidor-principal)
   - [utils/logger.js - Logging](#43-utilsloggerjs---logging)
   - [tools/calculator.js - Calculadora](#44-toolscalculatorjs---calculadora)
   - [tools/weather.js - Previsao do Tempo](#45-toolsweatherjs---previsao-do-tempo)
   - [tools/notes.js - Notas](#46-toolsnotesjs---notas)
   - [resources/system-info.js - Info do Sistema](#47-resourcessystem-infojs---info-do-sistema)
   - [prompts/greeting.js - Prompt de Saudacao](#48-promptsgreetingjs---prompt-de-saudacao)
5. [Conceitos Teoricos](#5-conceitos-teoricos)
6. [Execucao e Testes](#6-execucao-e-testes)

---

## 1. Visao Geral

### O que e MCP?

MCP (Model Context Protocol) e um protocolo aberto criado pela Anthropic para padronizar a comunicacao entre LLMs e ferramentas externas. Ele permite que um modelo de linguagem acesse:

- **Tools** (Ferramentas): Funcoes que o LLM pode chamar (calcular, buscar, salvar)
- **Resources** (Recursos): Dados que o LLM pode ler (arquivos, informacoes do sistema)
- **Prompts** (Prompts): Templates de prompts reutilizaveis

### Por que usar MCP?

```
Sem MCP:                        Com MCP:
  LLM1 -> Ferramenta A            LLM1 ─┐
  LLM1 -> Ferramenta B                    ├─> Servidor MCP ─> Tools/Resources
  LLM2 -> Ferramenta A            LLM2 ─┘     (protocolo padronizado)
  LLM2 -> Ferramenta C
  (cada LLM integra cada API      (um servidor serve qualquer LLM)
   de forma diferente)
```

### Como funciona a comunicacao

```
┌──────────────┐         stdio/HTTP         ┌──────────────┐
│   Cliente    │  ◄──────────────────────►  │  Servidor    │
│   (LLM)      │     JSON-RPC 2.0          │  MCP         │
└──────────────┘                            └──────────────┘
                                                  │
                                           ┌──────┴──────┐
                                           │  Tools      │
                                           │  Resources  │
                                           │  Prompts    │
                                           └─────────────┘
```

O protocolo usa **JSON-RPC 2.0** como formato de mensagem. O cliente envia requisicoes e o servidor responde.

---

## 2. Arquitetura do Projeto

```
MCP/
├── .env                      # Variaveis de ambiente
├── .gitignore                # Arquivos ignorados pelo Git
├── package.json              # Dependencias e scripts
├── TUTORIAL.md               # Este arquivo
└── src/
    ├── server/
    │   ├── config.js         # Configuracao do servidor
    │   └── index.js          # Entrypoint + registro de tools/resources/prompts
    ├── tools/
    │   ├── index.js          # Registro centralizado de tools
    │   ├── calculator.js     # Tool de calculadora
    │   ├── weather.js        # Tool de previsao do tempo
    │   └── notes.js          # Tool de gerenciamento de notas
    ├── resources/
    │   ├── index.js          # Registro centralizado de resources
    │   └── system-info.js    # Resource de informacoes do sistema
    ├── prompts/
    │   ├── index.js          # Registro centralizado de prompts
    │   └── greeting.js       # Prompt de saudacao
    └── utils/
        └── logger.js         # Utilitario de logging
```

### Princpios de Design

| Principio | Aplicacao |
|-----------|-----------|
| **Separacao de responsabilidades** | Cada pasta cuida de um conceito (tools, resources, prompts) |
| **Registro centralizado** | Pasta `index.js` em cada modulo exporta tudo junto |
| **Combinacao modular** | `server/index.js` importa e registra cada componente |
| **Configuracao externa** | Variaveis de ambiente via `.env` |

### Fluxo de Dependencias

```
src/server/index.js (entrypoint)
  ├── src/server/config.js        (carrega .env)
  ├── src/tools/index.js           (exporta todas as tools)
  │   ├── calculator.js
  │   ├── weather.js
  │   └── notes.js
  ├── src/resources/index.js       (exporta todos os resources)
  │   └── system-info.js
  ├── src/prompts/index.js         (exporta todos os prompts)
  │   └── greeting.js
  └── src/utils/logger.js          (logging)
```

---

## 3. Configuracao

### Dependencias

| Pacote | Funcao |
|--------|--------|
| `@modelcontextprotocol/sdk` | SDK oficial do MCP para Node.js |
| `dotenv` | Carrega variaveis de ambiente do `.env` |
| `zod` | Validacao de schemas (usado pelas tools) |

### Scripts

```bash
npm install       # Instala dependencias
npm start         # Inicia o servidor MCP
npm run dev       # Inicia com auto-reload (--watch)
```

### Variaveis de Ambiente

```env
MCP_SERVER_NAME=mcp-study-server    # Nome do servidor
MCP_SERVER_VERSION=1.0.0            # Versao do servidor
LOG_LEVEL=info                      # Nivel de log: debug, info, warn, error
```

---

## 4. Arquivo por Arquivo

### 4.1 `server/config.js` - Configuracao

> **Conceito**: Centraliza todas as configuracoes do servidor em um objeto unico, carregado via variaveis de ambiente.

```js
import dotenv from "dotenv";
dotenv.config();

export const config = {
  serverName: process.env.MCP_SERVER_NAME || "mcp-study-server",
  serverVersion: process.env.MCP_SERVER_VERSION || "1.0.0",
  logLevel: process.env.LOG_LEVEL || "info",
};
```

**Por que separar a configuracao?**
- Evita espalhar `process.env` pelo codigo
- Facilita testes (basta sobrescrever o objeto)
- Um unico lugar para documentar as variaveis

---

### 4.2 `server/index.js` - Servidor Principal

> **Conceito**: O entrypoint do servidor. Cria a instancia MCP, registra todos os componentes (tools, resources, prompts) e conecta via stdio.

#### Fluxo de Inicializacao

```
1. Criar McpServer com nome e versao
   │
2. Registrar Tools
   │   → calculator, get_weather, create_note, list_notes, delete_note
   │
3. Registrar Resources
   │   → system-info
   │
4. Registrar Prompts
   │   → greeting
   │
5. Conectar ao StdioServerTransport
   │
6. Pronto para receber requisicoes via stdio
```

#### Como funciona o Registro

Cada tool e registrada com `registerTool`:
```js
server.registerTool(name, { description, inputSchema }, handler)
```

| Parametro | Descricao |
|-----------|-----------|
| `name` | Nome unico da tool (o LLM usa para referenciar) |
| `description` | Descricao em linguagem natural (o LLM usa para decidir quando usar) |
| `inputSchema` | **Objeto Zod** que define e valida os parametros de entrada |
| `handler` | Funcao async que executa a tool e retorna o resultado |

**Exemplo pratico:**
```js
import { z } from "zod";

server.registerTool(
  "calculator",                          // nome
  {
    description: "Resolve calculos matematicos",  // descricao
    inputSchema: {                               // schema Zod
      expression: z.string().describe("A expressao matematica"),
    },
  },
  async (args) => {                      // handler
    const result = Function('"use strict"; return (' + args.expression + ")")();
    return { content: [{ type: "text", text: `Resultado: ${result}` }] };
  }
);
```

**Por que Zod e nao JSON Schema?**
O SDK converte automaticamente o schema Zod para JSON Schema. Isso garante validacao em tempo de execucao e tipos inferidos no handler.

#### Formato de Resposta de uma Tool

```js
{
  content: [
    {
      type: "text",
      text: "Texto com o resultado"
    }
  ]
}
```

O campo `content` e um array que pode conter multiplos items. O tipo mais comum e `"text"`.

#### Transporte (Transport)

O `StdioServerTransport` usa **entrada/saida padrao** (stdin/stdout) para comunicacao. Isso significa que o servidor MCP e um programa CLI que recebe JSON-RPC via stdin e responde via stdout.

```
Cliente (LLM)                    Servidor MCP
     │                                │
     │  {"jsonrpc":"2.0",             │
     │   "method":"tools/call",       │
     │   "params":{...}}              │
     │  ──────────────────────────►   │
     │                                │ processa
     │  {"jsonrpc":"2.0",             │
     │   "result":{...}}              │
     │  ◄──────────────────────────   │
```

---

### 4.3 `utils/logger.js` - Logging

> **Conceito**: Utilitario simples de logging que suporta niveis (debug, info, warn, error) e formatacao com timestamp e contexto.

```js
const logger = createLogger("server");
logger.info("Servidor iniciado");
// [2026-07-14T12:00:00.000Z] [INFO] [server] Servidor iniciado
```

**Por que criar um logger proprio?**
- `console.log` nao tem niveis nem contexto
- Facilita desabilitar logs de debug em producao
- O parametro `context` identifica de qual modulo veio a mensagem

---

### 4.4 `tools/calculator.js` - Calculadora

> **Conceito**: Uma **tool** e uma funcao que o LLM pode chamar. Ela recebe argumentos, processa e retorna um resultado textual.

#### Fluxo

```
LLM decide: "Preciso calcular 2 + 2"
    │
    ├── Chama tool: calculator({ expression: "2 + 2" })
    │
    ├── Tool processa: eval("2 + 2") = 4
    │
    └── Retorna: "Resultado: 4"
```

#### Seguranca

A tool faz sanitizacao da expressao antes de evaluar:
```js
const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
if (sanitized !== expression) {
  throw new Error("Expressao contem caracteres invalidos");
}
```

Isso impede injecao de codigo JavaScript arbitrario.

#### Definicao da Tool

```js
import { z } from "zod";

export const calculatorTool = {
  name: "calculator",
  description: "Resolve calculos matematicos",
  inputSchema: {                              // Schema Zod (nao JSON Schema)
    expression: z.string().describe("A expressao matematica"),
  },
  async execute(args) { ... }                 // Handler
};
```

**Cada tool e um objeto com 4 propriedades obrigatorias:**

| Propriedade | Tipo | Descricao |
|-------------|------|-----------|
| `name` | string | Identificador unico |
| `description` | string | Descricao para o LLM |
| `inputSchema` | object (Zod) | Schema Zod dos parametros (SDK converte para JSON Schema) |
| `execute` | async function | Funcao que processa a requisicao |

---

### 4.5 `tools/weather.js` - Previsao do Tempo

> **Conceito**: Tool que busca dados de uma fonte (simulada) e retorna formatados. Em producao, poderia chamar uma API real.

#### Dados Simulados

```js
const WEATHER_DATA = {
  "Sao Paulo": { temp: 28, condition: "Ensolarado", humidity: 65 },
  "Rio de Janeiro": { temp: 32, condition: "Parcialmente nublado", humidity: 70 },
  // ...
};
```

**Por que simulado?**
- Demonstra o conceito sem depender de API externa
- Não precisa de chave de API
- Facil de testar e entender

#### Tratamento de Erro

Quando a cidade nao e encontrada, a tool retorna as cidades disponiveis:
```js
throw new Error(`Cidade "${city}" nao encontrada. Cidades disponiveis: ${availableCities}`);
```

Isso ajuda o LLM a corrigir automaticamente a requisicao.

---

### 4.6 `tools/notes.js` - Notas

> **Conceito**: Tool com **estado** (armazena notas em memoria). Demonstra como tools podem manter dados entre chamadas.

#### Tools Disponiveis

| Tool | Funcao |
|------|--------|
| `create_note` | Cria uma nota com titulo e conteudo |
| `list_notes` | Lista todas as notas salvas |
| `delete_note` | Deleta uma nota pelo ID |

#### Armazenamento em Memoria

```js
const notes = [];  // Array compartilhado entre as 3 tools
```

**Importante**: Este e um array em memoria. As notas serao perdidas quando o servidor reiniciar. Em producao, usaria um banco de dados.

#### Compartilhamento de Estado

As tres tools (`create_note`, `list_notes`, `delete_note`) estao no mesmo arquivo e compartilham o array `notes`. Isso e possivel porque sao exportadas separadamente mas capturam a mesma variavel no closure.

---

### 4.7 `resources/system-info.js` - Info do Sistema

> **Conceito**: Uma **resource** e um dado que o LLM pode **ler** (nao executar). Diferente de tools, resources retornam dados passivos.

#### Diferenca: Tool vs Resource

```
Tool:  "Faça algo"     → calculator("2+2")    → "Resultado: 4"
Resource: "Leia algo"  → system://info         → "{ platform: 'win32', ... }"
```

| Aspecto | Tool | Resource |
|---------|------|----------|
| Acao | Executa uma operacao | Fornece dados |
| Modificador | Pode alterar estado | Apenas leitura |
| Exemplo | Calculadora, salvar nota | Ler arquivo, info do sistema |

#### URI (Identificador Uniforme de Recurso)

```js
uri: "system://info"
```

Cada resource tem um URI unico. O cliente usa esse URI para acessar o recurso.

#### Conteudo Retornado

```js
{
  contents: [
    {
      uri: "system://info",
      mimeType: "application/json",
      text: '{"platform":"win32","arch":"x64",...}'
    }
  ]
}
```

O formato e padronizado: um array `contents` com objetos contendo `uri`, `mimeType` e `text`.

---

### 4.8 `prompts/greeting.js` - Prompt de Saudacao

> **Conceito**: Um **prompt** e um template reutilizave que o cliente pode listar e usar. E util para prompts complexos que o usuario pode querer reaproveitar.

#### Definicao

```js
import { z } from "zod";

export const greetingPrompt = {
  name: "greeting",
  description: "Gera uma mensagem de boas-vindas personalizada",
  argsSchema: {                                    // Schema Zod dos argumentos
    name: z.string().min(1).describe("Nome do usuario"),
  },
  async generate(args) { ... }
};
```

#### Como o LLM usa Prompts

O cliente MCP lista os prompts disponiveis e os apresenta ao usuario. O usuario escolhe um e preenche os argumentos. O servidor gera as mensagens formatadas.

---

## 5. Conceitos Teoricos

### Os 3 Pilares do MCP

```
                    ┌─────────────────────┐
                    │      Servidor       │
                    │        MCP          │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              v               v               v
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  Tools   │   │Resources │   │ Prompts  │
        │          │   │          │   │          │
        │ "Faca"   │   │ "Leia"   │   │ "Use"    │
        └──────────┘   └──────────┘   └──────────┘
```

| Pilar | Acao | Analogia |
|-------|------|----------|
| **Tools** | O LLM executa uma funcao | Um botao que o LLM pode clicar |
| **Resources** | O LLM le um dado | Um arquivo que o LLM pode abrir |
| **Prompts** | O LLM usa um template | Um formulario pre-preenchido |

### Protocolo JSON-RPC 2.0

Toda comunicacao MCP usa JSON-RPC 2.0:

**Requisicao do cliente:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "calculator",
    "arguments": { "expression": "2 + 2" }
  }
}
```

**Resposta do servidor:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "Resultado: 4" }
    ]
  }
}
```

### Metodos Principais do MCP

| Metodo | Descricao |
|--------|-----------|
| `tools/list` | Lista todas as tools disponiveis |
| `tools/call` | Chama uma tool especifica |
| `resources/list` | Lista todos os resources |
| `resources/read` | Le um resource pelo URI |
| `prompts/list` | Lista todos os prompts |
| `prompts/get` | Obtem um prompt formatado |
| `initialize` | Handshake inicial cliente-servidor |

### Transporte

| Transporte | Descricao | Uso |
|------------|-----------|-----|
| **Stdio** | stdin/stdout | CLI, integracao com IDEs |
| **HTTP** | HTTP com SSE | Servidor remoto, web |

Este projeto usa **Stdio** (padrao para ferramentas de desenvolvimento local).

---

## 6. Execucao e Testes

### Instalacao

```bash
cd MCP
npm install
```

### Iniciar o Servidor

```bash
# Producao
npm start

# Desenvolvimento (com auto-reload)
npm run dev
```

### Como Testar

#### Com o Inspector do MCP (Recomendado)

```bash
# Instale o inspector globalmente
npx @anthropic-ai/mcp-inspector

# Aponte para o servidor
npx @anthropic-ai/mcp-inspector node src/server/index.js
```

O Inspector abre uma interface web onde voce pode:
- Listar e chamar tools
- Ler resources
- Usar prompts

#### Com o Claude Desktop

1. Instale o Claude Desktop
2. Adicione a configuracao em `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-study": {
      "command": "node",
      "args": ["C:/caminho/para/MCP/src/server/index.js"]
    }
  }
}
```

3. Reinicie o Claude Desktop
4. O servidor aparecera como ferramenta disponivel

#### Com Claude Code (CLI)

Adicione no seu `~/.claude.json`:
```json
{
  "mcpServers": {
    "mcp-study": {
      "command": "node",
      "args": ["C:/caminho/para/MCP/src/server/index.js"]
    }
  }
}
```

### Estrutura de uma Tool

Para adicionar uma nova tool:

1. Crie o arquivo em `src/tools/minha-tool.js`
2. Exporte um objeto com `name`, `description`, `inputSchema` (Zod), `execute`
3. Adicione o import em `src/tools/index.js`

```js
// src/tools/minha-tool.js
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

### Estrutura de uma Resource

1. Crie o arquivo em `src/resources/meu-recurso.js`
2. Exporte um objeto com `name`, `description`, `uri`, `mimeType`, `read`
3. Adicione o import em `src/resources/index.js`

```js
// src/resources/meu-recurso.js
export const meuRecurso = {
  name: "meu-recurso",
  description: "Descricao do recurso",
  uri: "meu://recurso",
  mimeType: "application/json",
  async read() {
    return {
      contents: [
        {
          uri: "meu://recurso",
          mimeType: "application/json",
          text: JSON.stringify({ dado: "valor" }),
        },
      ],
    };
  },
};
```

---

*Projeto de estudo - MCP (Model Context Protocol) com Node.js*
