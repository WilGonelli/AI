# Fluxo de Comunicação

## Quem comanda quem?

A hierarquia de comando é:

```
USUÁRIO → AGENTE (LangGraph) → LLM (decide) → TOOLS (executam)
```

**Detalhando:**

| Quem | Papel | Quem controla |
|------|-------|---------------|
| **Usuário** | Fornece input | Ninguém (independente) |
| **Agente (LangGraph)** | Orquestra o fluxo | Programador (código) |
| **LLM** | Decide qual tool usar | Agente (envia mensagens) |
| **Tools** | Executam ações reais | LLM (escolhe qual chamar) |

### O LLM não "comanda" - ele sugere

O LLM **não executa** ferramentas diretamente. Ele retorna algo como:

```json
{
  "tool_calls": [{
    "name": "registrar_gasto",
    "args": { "valor": 15, "categoria": "Alimentação", "descricao": "café" }
  }]
}
```

É o **Agente (LangGraph)** que:
1. Recebe essa sugestão do LLM
2. Executa a ferramenta via MCP
3. Retorna o resultado ao LLM
4. O LLM gera a resposta final para o usuário

---

## Fluxo Completo: Exemplo Prático

**Usuário digita:** "Gastei 15 reais com café hoje"

```
┌─────────────────────────────────────────────────────────────────────┐
│ PASSO 1: INPUT DO USUÁRIO                                          │
│                                                                     │
│ readline captura: "Gastei 15 reais com café hoje"                  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASSO 2: AGENTE INVOKE                                             │
│                                                                     │
│ agente.invoke({                                                    │
│   messages: [{ role: "user", content: "Gastei 15 reais..." }]      │
│ })                                                                  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASSO 3: LLM ANALISA E DECIDE                                      │
│                                                                     │
│ O LLM recebe:                                                      │
│ - System prompt (você é um assistente financeiro)                  │
│ - Lista de tools disponíveis (registrar_gasto, obter_gastos_mes)   │
│ - Mensagem do usuário                                              │
│                                                                     │
│ LLM decide: "Preciso usar registrar_gasto"                         │
│ Retorna: AIMessage com tool_calls                                  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASSO 4: LANGGRAPH EXECUTA A TOOL                                  │
│                                                                     │
│ LangGraph vê que há tool_calls no AIMessage                        │
│ Invoca DynamicStructuredTool.func({                                │
│   valor: 15,                                                       │
│   categoria: "Alimentação",                                        │
│   descricao: "café"                                                │
│ })                                                                  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASSO 5: MCP CLIENT → MCP SERVER                                   │
│                                                                     │
│ client.callTool({                                                  │
│   name: "registrar_gasto",                                         │
│   arguments: { valor: 15, categoria: "Alimentação", ... }          │
│ })                                                                  │
│                                                                     │
│ Enviado via JSON-RPC sobre stdin do processo filho                 │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASSO 6: SERVIDOR EXECUTA                                          │
│                                                                     │
│ servidor_financeiro.js recebe a requisição                         │
│ Lê financas.md                                                     │
│ Adiciona: | 2026-07-22 | R$ 15.00 | Alimentação | café |          │
│ Salva financas.md                                                  │
│ Retorna: { content: [{ text: "Sucesso: R$ 15.00 registrado..." }] }│
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASSO 7: RESULTADO VOLTA AO AGENTE                                 │
│                                                                     │
│ O resultado do MCP volta via stdout                                │
│ DynamicStructuredTool extrai o texto                               │
│ ToolMessage é adicionada ao histórico de mensagens                 │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASSO 8: LLM GERA RESPOSTA FINAL                                   │
│                                                                     │
│ LangGraph envia ao LLM:                                            │
│ - Histórico completo (incluindo resultado da tool)                 │
│                                                                     │
│ LLM gera: "Pronto! Registrei R$ 15.00 em 'café' para hoje."      │
│                                                                     │
│ Não há mais tool_calls → resposta final                            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PASSO 9: RESPOSTA AO USUÁRIO                                       │
│                                                                     │
│ console.log("Assistente: Pronto! Registrei R$ 15.00...")          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Tool Calling (Loop)

O LLM pode chamar **múltiplas tools** em sequência:

```
Usuário: "Quanto gastei este mês? E também gastei 50 no almoço"

┌─────────┐    ┌─────────┐    ┌─────────────────┐    ┌─────────┐
│  LLM    │───>│ Tool 1  │───>│ obter_gastos_mes │───>│  LLM    │
│ decide  │    │         │    │ (retorna lista)  │    │ recebe  │
└─────────┘    └─────────┘    └─────────────────┘    └────┬────┘
                                                          │
┌─────────┐    ┌─────────┐    ┌─────────────────┐         │
│  LLM    │<───│ Tool 2  │<───│ registrar_gasto  │<────────┘
│ decide  │    │         │    │ (salva gasto)    │   decide chamar
└────┬────┘    └─────────┘    └─────────────────┘   mais uma tool
     │
     ▼
┌─────────┐
│ Resposta│  "Você gastei R$ X este mês. 
│ Final   │   E registrei R$ 50.00 no almoço."
└─────────┘
```

---

## Sequência de Inicialização

```
1. app.js inicia
   │
2. spawn("node servidor_financeiro.js")
   │  → Processo filho criado
   │  → Servidor MCP começa a ouvir stdin
   │
3. client.connect(transport)
   │  → Handshake MCP via stdio
   │  → Conexão estabelecida
   │
4. client.listTools()
   │  → Request: { method: "tools/list" }
   │  → Response: { tools: [registrar_gasto, obter_gastos_mes, registrar_parcela] }
   │
5. jsonSchemaParaZod() converte cada tool
   │  → JSON Schema (MCP) → Zod Schema (LangChain)
   │  → Cria DynamicStructuredTool para cada uma
   │
6. createReactAgent({ llm, tools, prompt })
   │  → LangGraph cria o grafo ReAct
   │  → Agente pronto para receber mensagens
   │
7. REPL inicia (readline)
   │  → Aguarda input do usuário
   │
8. agente.invoke() → LLM → Tool → LLM → Resposta
   │  → Loop ReAct executado
   │
9. Usuário digita "sair"
   │  → Processo encerrado
```

---

## Comunicação Interna: Stdio

```
┌───────────────────────────────────────────────────────────────┐
│                     PROCESSO PAI (app.js)                     │
│                                                               │
│  StdioClientTransport                                        │
│    │                                                          │
│    │  Escreve no stdin do filho:                             │
│    │  {"jsonrpc":"2.0","method":"tools/list","id":1}\n       │
│    │                                                          │
│    │  Lê do stdout do filho:                                 │
│    │  {"jsonrpc":"2.0","result":{"tools":[...]},"id":1}\n    │
│    │                                                          │
├─────────────────────── stdin/stdout ──────────────────────────┤
│                     PROCESSO FILHO (servidor.js)              │
│                                                               │
│  StdioServerTransport                                        │
│    │                                                          │
│    │  Lê do stdin:                                            │
│    │  {"jsonrpc":"2.0","method":"tools/list","id":1}\n       │
│    │                                                          │
│    │  Responde no stdout:                                     │
│    │  {"jsonrpc":"2.0","result":{"tools":[...]},"id":1}\n    │
│    │                                                          │
└───────────────────────────────────────────────────────────────┘
```

**Formato JSON-RPC 2.0:**

Request:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "registrar_gasto",
    "arguments": { "valor": 15, "categoria": "Alimentação", "descricao": "café" }
  },
  "id": 1
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      { "type": "text", "text": "Sucesso: R$ 15.00 registrado em 'Alimentação'." }
    ]
  },
  "id": 1
}
```
