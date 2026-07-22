# Referência Rápida

## Diagrama Geral do Sistema

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          agent-cli                                       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         app.js (Cliente)                           │ │
│  │                                                                     │ │
│  │  ┌──────────┐    ┌──────────────┐    ┌───────────────────────────┐ │ │
│  │  │ readline │───>│ LangGraph    │───>│ ChatOpenAI (LLM)          │ │ │
│  │  │ (input)  │    │ Agent        │    │ Gemini / HuggingFace      │ │ │
│  │  └──────────┘    │ (ReAct)      │    └───────────────────────────┘ │ │
│  │                  │              │                                    │ │
│  │                  │  ┌─────────┐ │                                    │ │
│  │                  │  │ Dynamic │ │                                    │ │
│  │                  │  │Structur.│─┼──── client.callTool() ──────────┐ │ │
│  │                  │  │  Tool   │ │                                  │ │ │
│  │                  │  └─────────┘ │                                  │ │ │
│  │                  └──────────────┘                                  │ │ │
│  └───────────────────────────────────┬────────────────────────────────┘ │
│                                      │                                  │
│                          StdioClientTransport                           │
│                                      │ stdin/stdout                     │
│                          StdioServerTransport                           │
│                                      │                                  │
│  ┌───────────────────────────────────▼────────────────────────────────┐ │
│  │                  servidor_financeiro.js (Servidor MCP)             │ │
│  │                                                                     │ │
│  │  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  │                    MCP Server                                │ │ │
│  │  │                                                               │ │ │
│  │  │  listTools()  →  [{name, description, inputSchema}, ...]     │ │ │
│  │  │  callTool()   →  {content: [{type: "text", text: "..."}]}    │ │ │
│  │  └───────────────────────────────────────────────────────────────┘ │ │
│  │                              │                                     │ │
│  │                              ▼                                     │ │
│  │  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  │                    financas.md                                │ │ │
│  │  │                    (Dados persistentes)                       │ │ │
│  │  └───────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados

```
Usuário: "Gastei 15 reais com café"
    │
    ▼
readline → app.js
    │
    ▼
agente.invoke()
    │
    ▼
┌─────────────────────────────────────────────────┐
│ LLM (Gemini) analisa e decide:                  │
│ "Preciso usar registrar_gasto"                  │
│                                                 │
│ Retorna: tool_calls: [{                         │
│   name: "registrar_gasto",                      │
│   args: { valor: 15, categoria: "Alimentação" } │
│ }]                                              │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ LangGraph executa DynamicStructuredTool         │
│                                                 │
│ func() chama: client.callTool({                 │
│   name: "registrar_gasto",                      │
│   arguments: { valor: 15, ... }                 │
│ })                                              │
└────────────────────┬────────────────────────────┘
                     │ JSON-RPC via stdin
                     ▼
┌─────────────────────────────────────────────────┐
│ servidor_financeiro.js recebe                   │
│                                                 │
│ 1. Lê financas.md                              │
│ 2. Adiciona linha: | 2026-07-22 | R$15 | ...   │
│ 3. Salva financas.md                           │
│ 4. Retorna: "Sucesso: R$ 15.00 registrado..."  │
└────────────────────┬────────────────────────────┘
                     │ JSON-RPC via stdout
                     ▼
┌─────────────────────────────────────────────────┐
│ Resultado volta ao LLM                          │
│                                                 │
│ LLM gera resposta final:                       │
│ "Pronto! Registrei R$ 15.00 em café."          │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
              console.log()
              Usuário vê a resposta
```

---

## Hierarquia de Comando

```
┌─────────────────────────────────────────────────────────────┐
│                     NÍVEL 1: USUÁRIO                        │
│                  (digita comandos)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │ input
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     NÍVEL 2: AGENTE                         │
│               LangGraph (orchestrator)                      │
│                                                             │
│  • Recebe input do usuário                                 │
│  • Envia para o LLM                                        │
│  • Executa tools que o LLM pede                            │
│  • Retorna resultado ao LLM                                │
│  • Gera resposta final                                     │
└────────┬────────────────────────────────┬───────────────────┘
         │                                │
         ▼                                ▼
┌────────────────────┐          ┌────────────────────┐
│    NÍVEL 3: LLM    │          │   NÍVEL 3: TOOLS   │
│   (decide qual     │──escolhe─>│   (executam        │
│    tool usar)      │          │    ações reais)    │
└────────────────────┘          └────────┬───────────┘
                                         │
                                         ▼
                              ┌────────────────────┐
                              │  NÍVEL 4: DADOS    │
                              │  financas.md       │
                              │  (persistência)    │
                              └────────────────────┘
```

---

## Glossário

| Termo | O que é | Exemplo no projeto |
|-------|---------|-------------------|
| **LLM** | Modelo de linguagem (IA que entende/gera texto) | Gemini 2.5 Flash, Qwen 72B |
| **MCP** | Protocolo para conectar LLMs a ferramentas | `@modelcontextprotocol/sdk` |
| **LangChain** | Framework para aplicações com LLMs | `@langchain/core` |
| **LangGraph** | Extensão do LangChain para grafos de estado | `@langchain/langgraph` |
| **Agent** | Loop que decide qual tool usar | `createReactAgent()` |
| **Tool** | Função que o LLM pode chamar | `registrar_gasto`, `obter_gastos_mes` |
| **ReAct** | Padrão: Reason + Act (pensar + agir) | Padrão do agente |
| **Stdio** | Comunicação via stdin/stdout | Transporte MCP |
| **JSON-RPC** | Formato de mensagem | Protocolo MCP |
| **Zod** | Biblioteca de validação de schemas | Conversão JSON Schema → Zod |
| **DynamicStructuredTool** | Tool do LangChain com schema | Wrapper das tools MCP |

---

## Comandos Úteis

```bash
# Iniciar com menu de seleção
node app.js

# Iniciar direto com Gemini
node app.js gemini

# Iniciar direto com HuggingFace
node app.js hf

# Verificar dependências
npm list

# Reinstalar dependências
npm install
```

---

## Estrutura do Projeto

```
agent-cli/
├── app.js                    # Cliente CLI + Agente LangGraph
├── servidor_financeiro.js    # Servidor MCP (ferramentas)
├── financas.md               # Dados financeiros (Markdown)
├── package.json              # Dependências
├── .env                      # Chaves de API
└── docs/                     # Documentação
    ├── 01-conceitos.md       # O que é LLM, MCP, LangChain
    ├── 02-fluxo-comunicacao.md  # Fluxo e hierarquia
    ├── 03-api-endpoints.md   # Como seria uma API REST
    └── 04-referencia.md      # Este arquivo
```
