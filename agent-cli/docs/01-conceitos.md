# Conceitos Fundamentais

## O que é um LLM (Large Language Model)?

Um LLM é um modelo de inteligência artificial treinado com grandes volumes de texto. Ele consegue entender e gerar linguagem natural.

**Exemplos:** GPT-4, Claude, Gemini, Llama, Qwen

**O que faz:** Recebe uma pergunta/instrução e gera uma resposta em texto.

**Limitação sozinho:** LLMs só geram texto. Não conseguem:
- Acessar banco de dados
- Executar código
- Ler/escrever arquivos
- Chamar APIs externas

Para isso, precisam de **ferramentas (tools)**.

---

## O que é MCP (Model Context Protocol)?

MCP é um protocolo padronizado para conectar LLMs a ferramentas externas.

**Pense assim:** Se o LLM é um cérebro, MCP é o sistema nervoso que permite esse cérebro controlar mãos, olhos e ouvidos.

### Por que existe?

Cada ferramenta poderia ser conectada de um jeito diferente. MCP cria um **padrão único** para que qualquer LLM funcione com qualquer ferramenta.

### Como funciona?

```
┌─────────────────┐      JSON-RPC       ┌─────────────────┐
│   MCP Client    │ <=================> │   MCP Server    │
│   (app.js)      │     stdin/stdout    │ (servidor.js)   │
└─────────────────┘                     └─────────────────┘
```

**Duas operações principais:**

1. **listTools** - "Quais ferramentas você tem?"
   - Resposta: lista com nome, descrição e parâmetros de cada uma

2. **callTool** - "Execute esta ferramenta com estes dados"
   - Resposta: resultado da execução

### Transporte

O MCP suporta diferentes transportes:
- **stdio** (usado neste projeto) - Comunicação via stdin/stdout entre processos
- **HTTP** - Comunicação via rede
- **WebSocket** - Conexão persistente

---

## O que é LangChain?

LangChain é um framework para construir aplicações com LLMs.

**Pense assim:** Se o LLM é um motor, LangChain é o carro completo com volante, freio e câmbio.

### Principais componentes

| Componente | Função |
|------------|--------|
| **Models** | Wrapper para diferentes LLMs (OpenAI, Gemini, etc.) |
| **Tools** | Funções que o LLM pode chamar |
| **Agents** | "Cérebro" que decide qual ferramenta usar |
| **Chains** | Sequências de passos encadeados |

### O que é um Agent?

Um Agent é um loop que:
1. Envia a pergunta do usuário para o LLM
2. O LLM decide se precisa usar uma ferramenta
3. Se sim, executa a ferramenta e retorna o resultado ao LLM
4. O LLM gera a resposta final

**Padrão ReAct (Reason + Act):**
```
Pensar → Agir → Observar → Pensar → Agir → Observar → ... → Responder
```

### O que é LangGraph?

LangGraph é uma extensão do LangChain para criar **grafos de estado** - fluxos mais complexos que um simples loop.

O `createReactAgent` do LangGraph implementa o padrão ReAct como um grafo:

```
[Início] → [Chamar LLM] → [Usar Ferramenta?] → Sim → [Executar Tool] → [Chamar LLM]
                                    ↓
                                   Não
                                    ↓
                              [Responder] → [Fim]
```

---

## Resumo Visual

```
┌──────────────────────────────────────────────────────────┐
│                      USUÁRIO                             │
│                  "Gastei 15 reais"                       │
└─────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│                  LLM (Gemini/Qwen)                       │
│              Entende e gera texto                        │
│              Precisa de ajuda para                       │
│              executar ações reais                        │
└─────────────────────┬────────────────────────────────────┘
                      │ Preciso usar uma ferramenta
                      ▼
┌──────────────────────────────────────────────────────────┐
│               LangChain / LangGraph                      │
│           Gerencia o loop Agente                         │
│           Decide qual tool chamar                        │
│           Converte schemas (Zod ↔ JSON)                  │
└─────────────────────┬────────────────────────────────────┘
                      │ client.callTool()
                      ▼
┌──────────────────────────────────────────────────────────┐
│                MCP Client → MCP Server                   │
│              Protocolo padronizado                       │
│              Comunicação via stdio                       │
└─────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│             Servidor de Ferramentas                      │
│          Lê/escreve financas.md                          │
│          Executa a lógica de negócio                     │
└──────────────────────────────────────────────────────────┘
```
