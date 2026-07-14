# Tutorial: LangChain, LangGraph e RAG com JavaScript

Projeto de estudo para entender os conceitos fundamentais de **LLM**, **Chains**, **RAG**, **LangGraph** e **Agents** usando JavaScript (Node.js).

---

## Sumario

1. [Visao Geral](#1-visao-geral)
2. [Arquitetura do Projeto](#2-arquitetura-do-projeto)
3. [Configuracao](#3-configuracao)
4. [Arquivo por Arquivo](#4-arquivo-por-arquivo)
   - [llm.js - Modelos de Linguagem](#41-llmjs---modelos-de-linguagem)
   - [chains.js - Cadeias de Processamento](#42-chainsjs---cadeias-de-processamento)
   - [ragPipeline.js - Retrieval Augmented Generation](#43-ragpipelinejs---retrieval-augmented-generation)
   - [graph.js - LangGraph](#44-graphjs---langgraph)
   - [agente.js - Agents](#45-agentejs---agents)
   - [app.js - Servidor Express](#46-appjs---servidor-express)
5. [Conceitos Teoricos](#5-conceitos-teoricos)
6. [Execucao e Testes](#6-execucao-e-testes)

---

## 1. Visao Geral

### O que e LangChain?

LangChain e um framework open-source para construir aplicacoes com LLMs (Large Language Models). Ele fornece abstractions para:

- **Modelos**: Conectar com OpenAI, HuggingFace, etc.
- **Prompts**: Templates para instrucoes ao modelo
- **Chains**: Compor etapas de processamento em sequencia
- **RAG**: Buscar documentos relevantes antes de gerar uma resposta
- **Agents**: LLMs que decidem qual ferramenta usar dinamicamente
- **LangGraph**: Orquestrar fluxos complexos com grafos de estado

### O que e LangGraph?

LangGraph e uma biblioteca do ecossistema LangChain para criar **grafos de estado** que orquestram a execucao de LLMs. Diferente de chains lineares, grafos permitem:

- Ramificacao condicional
- Loops e ciclos
- Estados compartilhados entre nos
- Paralelismo

### O que e RAG?

RAG (Retrieval Augmented Generation) e uma tecnica que combina **busca em documentos** com **geracao de texto**:

1. O usuario faz uma pergunta
2. O sistema busca documentos relevantes em um banco de vetores
3. O contexto encontrado e injetado no prompt do LLM
4. O LLM gera uma resposta embasada nos documentos

---

## 2. Arquitetura do Projeto

```
langchain/
├── .env              # Variaveis de ambiente (API keys)
├── package.json      # Dependencias e scripts
├── llm.js            # Configuracao dos modelos de linguagem
├── chains.js         # Cadeias de processamento (RunnableSequence)
├── ragPipeline.js    # Pipeline de RAG com Pinecone
├── graph.js          # Grafo de estado com LangGraph
├── agente.js         # Agent com ferramentas
└── app.js            # Servidor Express com endpoints
```

### Fluxo de Dependencias

```
llm.js (exporta llm, hfQuery)
  ├── chains.js   (importa llm)
  ├── ragPipeline.js (usa ChatOpenAI diretamente)
  ├── graph.js    (importa llm)
  ├── agente.js   (importa llm)
  └── app.js      (importa llm, hfQuery)
```

---

## 3. Configuracao

### Dependencias Principais

| Pacote | Versao | Funcao |
|--------|--------|--------|
| `@langchain/core` | ^1.2.2 | Primitivas fundamentais (prompts, runnables, tools) |
| `@langchain/openai` | ^1.5.5 | Integracao com OpenAI (ChatOpenAI, embeddings) |
| `@langchain/pinecone` | ^1.0.3 | Integracao com Pinecone (banco de vetores) |
| `@pinecone-database/pinecone` | ^8.0.0 | Cliente oficial do Pinecone |
| `langchain` | ^1.5.3 | Framework principal (agents, tools) |
| `@langchain/langgraph` | (subdependencia) | Grafos de estado |
| `dotenv` | ^17.4.2 | Carregar variaveis de ambiente do `.env` |
| `express` | ^5.2.1 | Servidor HTTP |
| `openai` | ^6.46.0 | Cliente OpenAI (usado internamente) |
| `zod` | (subdependencia) | Validacao de schemas (usado por tools) |

### Arquivo `.env`

```env
OPENAI_API_KEY=sk-proj-...       # Chave da API OpenAI (necessita creditos)
HF_API_KEY=hf_...                # Chave da HuggingFace (gratuita)
PINECONE_API_KEY=...             # Chave do Pinecone (necessario para RAG)
```

### Scripts Disponiveis

```bash
npm run llm       # Roda llm.js diretamente
npm run chains    # Roda chains.js
npm run rag       # Roda ragPipeline.js
npm run graph     # Roda graph.js
npm run agent     # Roda agente.js
npm run app       # Inicia o servidor Express
```

---

## 4. Arquivo por Arquivo

### 4.1 `llm.js` - Modelos de Linguagem

> **Conceito**: Um LLM (Large Language Model) e o modelo de IA que processa texto e gera respostas. Cada provedor (OpenAI, HuggingFace, etc.) tem sua propria API.

#### O que o arquivo faz

Configura e exporta **duas formas** de usar LLMs:

#### Funcao: `llm` (ChatOpenAI - LangChain)

```js
const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",  // Modelo da OpenAI
  temperature: 0,               // 0 = respostas deterministicas, 1 = criativas
});
```

**Como usar:**
```js
const resposta = await llm.invoke("O que e JavaScript?");
console.log(resposta.content);  // Texto da resposta
```

`ChatOpenAI` e uma classe do LangChain que:
- Envelopa a API da OpenAI em uma interface padronizada
- Retorna objetos `AIMessage` com propriedade `.content`
- e compativel com `.pipe()`, `.invoke()`, `.stream()`

**Parametros importantes:**
- `modelName`: Qual modelo usar (gpt-3.5-turbo, gpt-4o, etc.)
- `temperature`: Controla aleatoriedade (0-1). Menor = mais preciso
- `apiKey`: Opcional se a variavel `OPENAI_API_KEY` estiver no `.env`

#### Funcao: `hfQuery(prompt)` (HuggingFace - API direta)

```js
const texto = await hfQuery("Quanto e 2+2?");
```

**Como funciona internamente:**

1. Faz um `POST` para `https://router.huggingface.co/v1/chat/completions`
2. Envia o prompt no formato OpenAI-compatible (`messages: [{role, content}]`)
3. Usa o modelo `Qwen/Qwen3-8B` (gratuito)
4. Retorna o texto da resposta

Esta funcao **nao usa LangChain** - e uma chamada HTTP direta a API do HuggingFace. Serve como comparacao para entender a diferenca entre usar a API crua vs. o LangChain.

**Formato da requisicao:**
```json
{
  "model": "Qwen/Qwen3-8B",
  "messages": [{ "role": "user", "content": "prompt aqui" }],
  "max_tokens": 512
}
```

**Formato da resposta:**
```json
{
  "choices": [{
    "message": { "content": "resposta aqui" }
  }]
}
```

#### Exportacoes

| Export | Tipo | Descricao |
|--------|------|-----------|
| `llm` | `ChatOpenAI` | Instancia do LangChain para OpenAI |
| `hfQuery` | `async function` | Funcao direta para HuggingFace |

---

### 4.2 `chains.js` - Cadeias de Processamento

> **Conceito**: Uma Chain (cadeia) e uma sequencia de etapas onde a saida de uma etapa e a entrada da proxima. E o conceito fundamental do LangChain.

#### O que o arquivo faz

Cria tres cadeias de processamento:

1. **resumoChain**: Recebe um texto e gera um resumo
2. **perguntasChain**: Recebe um resumo e gera perguntas de estudo
3. **chain**: Combina as duas em sequencia (texto -> resumo -> perguntas)

#### Componentes Usados

**`ChatPromptTemplate.fromTemplate()`** - Cria um template de prompt:
```js
const resumoPrompt = ChatPromptTemplate.fromTemplate(
  "Resuma o seguinte texto em 3 linhas:\n{texto}"
);
```
- `{texto}` e um placeholder que sera substituido pelo valor real
- Gera um objeto `ChatPromptTemplate` que pode ser combinado com LLMs

**`.pipe()`** - Conecta etapas em sequencia:
```js
const resumoChain = resumoPrompt       // 1. Preenche o template
  .pipe(llm)                           // 2. Envia ao LLM
  .pipe((res) => ({ resumo: res.content })); // 3. Extrai o texto
```

O operador `.pipe()` e a forma moderna do LangChain de encadear etapas. Cada `.pipe()` recebe a saida do anterior como entrada.

**`RunnableSequence.from()`** - Monta uma cadeia composta:
```js
const chain = RunnableSequence.from([
  resumoChain,                         // Etapa 1: gera resumo
  (input) => ({ resumo: input.resumo }), // Transforma o output
  perguntasChain,                      // Etapa 2: gera perguntas
]);
```

`RunnableSequence` e a classe base para cadeias sequenciais no LangChain. Ela:
- Recebe um array de etapas (runnables)
- Cada etapa recebe o output da anterior
- Pode incluir funcoes lambda para transformacao de dados

#### Fluxo Visual

```
chain:
  "Texto do usuario"
       |
       v
  [resumoPrompt]  -->  "Resuma: {texto}"
       |
       v
  [llm]           -->  AIMessage("Resumo em 3 linhas...")
       |
       v
  { resumo: "..." }
       |
       v
  [perguntasPrompt] --> "Crie perguntas sobre: {resumo}"
       |
       v
  [llm]           -->  AIMessage("1. Pergunta... 2. Pergunta...")
       |
       v
  { perguntas: "1... 2... 3..." }
```

#### Exportacoes

| Export | Tipo | Descricao |
|--------|------|-----------|
| `resumoChain` | `RunnableSequence` | Gera resumo de um texto |
| `perguntasChain` | `RunnableSequence` | Gera perguntas a partir de um resumo |
| `chain` | `RunnableSequence` | Pipeline completo: texto -> resumo -> perguntas |

---

### 4.3 `ragPipeline.js` - Retrieval Augmented Generation

> **Conceito**: RAG combina busca semantica (encontrar documentos relevantes) com geracao de texto (LLM). Em vez de o LLM responder apenas com seu treinamento, ele consulta uma base de conhecimento e responde com base nela.

#### O que o arquivo faz

Conecta ao **Pinecone** (banco de vetores) e busca documentos similares a uma pergunta antes de enviar ao LLM.

#### Fluxo do RAG

```
Pergunta: "O que e contrato?"
    |
    v
[Busca semantica no Pinecone]  -->  3 documentos mais similares
    |
    v
[Concatenar contextos]  -->  "Doc1: Um contrato e...\nDoc2: Contrato e..."
    |
    v
[LLM com contexto]  -->  "Com base nos documentos: ...\n Pergunta: ..."
    |
    v
Resposta fundamentada
```

#### Funcao: `initVectorStore()`

```js
async function initVectorStore() {
  if (vectorStore) return vectorStore;  // Cache: so inicializa uma vez

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const embeddings = new OpenAIEmbeddings();  // Converte texto em vetores

  vectorStore = await PineconeStore.fromExistingIndex(
    pinecone.index("juridico-index"),         // Index ja existente no Pinecone
    { embedding: embeddings }
  );

  return vectorStore;
}
```

**O que cada coisa faz:**

| Componente | Descricao |
|-----------|-----------|
| `Pinecone` | Cliente do banco de dados vetorial |
| `OpenAIEmbeddings` | Converte texto em vetores numericos (embedding) |
| `PineconeStore` | Interface do LangChain para Pinecone |
| `fromExistingIndex()` | Conecta a um index ja criado no Pinecone |

**Embeddings**: Uma representacao numerica do significado do texto. Textos com significado similar ficam proximos no "espaco vetorial". O Pinecone armazena e busca nesses vetores.

#### Funcao: `ragQuery(pergunta)`

```js
export async function ragQuery(pergunta) {
  const store = await initVectorStore();

  // 1. Busca os 3 documentos mais similares
  const docs = await store.similaritySearch(pergunta, 3);

  // 2. Junta o conteudo dos documentos
  const context = docs.map((d) => d.pageContent).join("\n");

  // 3. Envia ao LLM com o contexto
  const resposta = await llm.invoke(
    `Com base nos documentos:\n${context}\nPergunta: ${pergunta}`
  );

  return resposta.content;
}
```

**`similaritySearch(pergunta, k)`**: Busca os `k` documentos mais similares ao texto usando busca vetorial.

#### Exportacoes

| Export | Tipo | Descricao |
|--------|------|-----------|
| `ragQuery` | `async function` | Faz uma pergunta e retorna resposta baseada em documentos |

**Requisitos**: Chave do Pinecone (`PINECONE_API_KEY`) e um index chamado `juridico-index` ja criado com dados.

---

### 4.4 `graph.js` - LangGraph

> **Conceito**: LangGraph permite criar grafos de estado onde cada "no" e uma funcao que processa um estado compartilhado. Diferente de chains lineares, grafos podem ter ramificacoes, condicoes e ciclos.

#### O que o arquivo faz

Cria um grafo com dois nos em sequencia:

```
START --> [resumo] --> [perguntas] --> END
```

#### Definicao do Estado

```js
const GraphState = Annotation.Root({
  texto: String,      // Texto de entrada
  resumo: String,     // Resumo gerado
  perguntas: String,  // Perguntas geradas
});
```

`Annotation.Root()` define o **schema do estado** compartilhado entre todos os nos do grafo. Cada campo e uma string que os nos podem ler e escrever.

#### Funcoes dos Nos

**`nodeResumo(state)`** - No de resumo:
```js
async function nodeResumo(state) {
  const res = await llm.invoke(`Resuma o seguinte texto em 3 linhas:\n${state.texto}`);
  return { resumo: res.content };  // Atualiza o campo 'resumo' do estado
}
```

**`nodePerguntas(state)`** - No de perguntas:
```js
async function nodePerguntas(state) {
  const res = await llm.invoke(`Crie 3 perguntas de estudo sobre:\n${state.resumo}`);
  return { perguntas: res.content };  // Atualiza o campo 'perguntas' do estado
}
```

Cada funcao de no:
- Recebe o estado atual como parametro
- Le os dados que precisa (`state.texto`, `state.resumo`)
- Retorna um objeto com os campos que quer atualizar

#### Construcao do Grafo

```js
const graph = new StateGraph(GraphState)
  .addNode("resumo", nodeResumo)        // Adiciona o no "resumo"
  .addNode("perguntas", nodePerguntas)  // Adiciona o no "perguntas"
  .addEdge(START, "resumo")             // Inicio -> resumo
  .addEdge("resumo", "perguntas")       // resumo -> perguntas
  .addEdge("perguntas", END);           // perguntas -> fim

const compiledGraph = graph.compile();  // Compila o grafo para execucao
```

| Metodo | Descricao |
|--------|-----------|
| `addNode(nome, funcao)` | Registra um no no grafo |
| `addEdge(origem, destino)` | Cria uma conexao entre dois nos |
| `START` | No de entrada do grafo |
| `END` | No de saida do grafo |
| `compile()` | Compila o grafo (valida e otimiza) |

#### Como executar

```js
const resultado = await compiledGraph.invoke({
  texto: "Inteligencia artificial e a area da computacao que..."
});

console.log(resultado.resumo);    // "Resumo em 3 linhas..."
console.log(resultado.perguntas); // "1. O que e...? 2. Como...? 3. Por que...?"
```

#### Diferenca: Chain vs Grafo

```
Chain (linear):          Grafo (flexivel):
  A --> B --> C            A --> B
                           |     |
                           v     v
                           C --> D  (pode ramificar)
```

Grafos sao uteis quando voce precisa de:
- Condicoes (se X va para A, senao va para B)
- Loops (volte ao inicio se a resposta nao for boa)
- Nos paralelos (execute A e B ao mesmo tempo)

#### Exportacoes

| Export | Tipo | Descricao |
|--------|------|-----------|
| `graph` | `CompiledStateGraph` | Grafo compilado e pronto para execucao |

---

### 4.5 `agente.js` - Agents

> **Conceito**: Um Agent e um LLM que decide **dinamicamente** quais ferramentas usar para responder uma pergunta. Diferente de chains (fluxo fixo), o agente "pensa" (Reasoning) e "age" (Acting) iterativamente.

#### O que o arquivo faz

Cria um agente ReAct (Reasoning + Acting) com uma ferramenta de calculadora.

#### Ferramenta: `tool()`

```js
const calculadora = tool(
  async ({ expression }) => {
    const result = Function('"use strict"; return (' + expression + ")")();
    return String(result);
  },
  {
    name: "Calculadora",
    description: "Resolve calculos matematicos. Ex: 2 + 2, 10 * 5",
    schema: z.object({
      expression: z.string().describe("A expressao matematica a calcular"),
    }),
  }
);
```

**`tool(func, config)`** cria uma ferramenta que o agente pode chamar:

| Parametro | Descricao |
|-----------|-----------|
| `func` | Funcao async que executa a ferramenta |
| `name` | Nome da ferramenta (o LLM usa isso para referenciar) |
| `description` | Descricao em linguagem natural (o LLM usa para decidir quando usar) |
| `schema` | Schema Zod que define os parametros de entrada |

**Schema Zod** define a estrutura dos dados:
```js
z.object({
  expression: z.string().describe("A expressao matematica a calcular"),
})
```
O `.describe()` da contexto ao LLM sobre o que cada parametro significa.

#### Criacao do Agente

```js
const agent = createAgent({
  model: llm,              // LLM que vai "pensar"
  tools: [calculadora],    // Ferramentas disponiveis
});
```

**`createAgent()`** do LangChain cria um agente ReAct que:
1. Recebe a pergunta do usuario
2. O LLM "pensa" sobre qual ferramenta usar
3. Chama a ferramenta se necessario
4. Repete ate ter uma resposta final

**Fluxo interno do agente:**
```
Pergunta: "quanto e 2+2?"
  |
  v
[LLM pensa] "Preciso usar a Calculadora"
  |
  v
[Chama tool: Calculadora("2+2")]
  |
  v
[Tool retorna: "4"]
  |
  v
[LLM gera resposta] "2+2 = 4"
```

#### Como usar

```js
const resultado = await agent.invoke({
  messages: [{ role: "user", content: "quanto e 15 * 3?" }],
});
console.log(resultado.messages.at(-1).content);  // "15 * 3 = 45"
```

#### Exportacoes

| Export | Tipo | Descricao |
|--------|------|-----------|
| `agent` | `ReactAgent` | Agente pronto para uso com a ferramenta Calculadora |

**Requisito**: Chave OpenAI funcional (`OPENAI_API_KEY` com creditos).

---

### 4.6 `app.js` - Servidor Express

> **Conceito**: Uma API HTTP que expoe os recursos de LLM para serem consumidos por qualquer cliente (Insomnia, Postman, navegador, etc.).

#### O que o arquivo faz

Cria um servidor Express com dois endpoints de pergunta/resposta.

#### Endpoint: `POST /llm`

```js
app.post("/llm", async (req, res) => {
  const { pergunta } = req.body;
  const resposta = await llm.invoke(pergunta);
  res.json({ resposta: resposta.content });
});
```

- **Entrada**: `{ "pergunta": "O que e Node.js?" }`
- **Saida**: `{ "resposta": "Node.js e um runtime JavaScript..." }`
- **Usa**: ChatOpenAI via LangChain

#### Endpoint: `POST /hf`

```js
app.post("/hf", async (req, res) => {
  const { pergunta } = req.body;
  const resposta = await hfQuery(pergunta);
  res.json({ resposta });
});
```

- **Entrada**: `{ "pergunta": "quanto e 2+2?" }`
- **Saida**: `{ "resposta": "2 + 2 e 4." }`
- **Usa**: HuggingFace via API direta (gratuito)

#### Como testar com Insomnia/Postman

```
1. Inicie o servidor: npm run app
2. Crie um POST para http://localhost:3000/hf
3. Body (JSON): { "pergunta": "quanto é 2 + 2?" }
4. Envie e veja a resposta
```

---

## 5. Conceitos Teoricos

### Pipeline Completo de uma Aplicacao LLM

```
                    ┌──────────────┐
                    │   Usuario    │
                    └──────┬───────┘
                           │ pergunta
                           v
              ┌────────────────────────┐
              │   Prompt Template      │
              │   "Responda: {perg}"   │
              └────────────┬───────────┘
                           │ prompt formatado
                           v
              ┌────────────────────────┐
              │   LLM (GPT, Qwen...)  │
              │   Processa e gera      │
              └────────────┬───────────┘
                           │ resposta
                           v
              ┌────────────────────────┐
              │   Output Parser        │
              │   Extrai texto limpo   │
              └────────────┬───────────┘
                           │
                           v
                    ┌──────────────┐
                    │  Resposta    │
                    └──────────────┘
```

### Resumo dos Conceitos

| Conceito | Arquivo | Analogia |
|----------|---------|----------|
| **LLM** | `llm.js` | O "cerebro" que processa e gera texto |
| **Prompt Template** | `chains.js` | Um formulario preenchido com os dados do usuario |
| **Chain** | `chains.js` | Uma esteira de producao com etapas fixas |
| **RAG** | `ragPipeline.js` | Um consultor que consulta a biblioteca antes de responder |
| **Embedding** | `ragPipeline.js` | Converter texto em numeros para busca por significado |
| **Vector Store** | `ragPipeline.js` | Um banco de dados que busca por similaridade, nao por exato |
| **Graph** | `graph.js` | Um fluxograma executavel com nos e arestas |
| **Agent** | `agente.js` | Um assistente que decide sozinho quais ferramentas usar |
| **Tool** | `agente.js` | Uma funcao que o agente pode chamar (calculadora, busca, etc.) |

### Quando Usar Cada Abordagem

| Abordagem | Use Quando |
|-----------|-----------|
| **LLM direto** | Perguntas simples, sem necessidade de contexto |
| **Chain** | Pipeline pre-definido e fixo (resumo -> perguntas) |
| **RAG** | Precisa responder com base em documentos proprios |
| **Graph** | Fluxo complexo com condicoes ou ramificacoes |
| **Agent** | LLM precisa decidir dinamicamente quais ferramentas usar |

---

## 6. Execucao e Testes

### Instalacao

```bash
npm install
```

### Configuracao do `.env`

```env
# Obrigatorio para llm.js, chains.js, graph.js, agente.js
OPENAI_API_KEY=sk-proj-...

# Obrigatorio para hfQuery() e endpoint /hf
HF_API_KEY=hf_...

# Obrigatorio para ragPipeline.js
PINECONE_API_KEY=...
```

### Rodar

```bash
# Teste direto do LLM
npm run llm

# Teste das chains
npm run chains

# Teste do grafo
npm run graph

# Teste do agente
npm run agent

# Servidor HTTP (testar via Insomnia/Postman)
npm run app
```

### Endpoints HTTP

| Metodo | URL | Body | Descricao |
|--------|-----|------|-----------|
| POST | `/llm` | `{ "pergunta": "..." }` | Chama o LLM da OpenAI |
| POST | `/hf` | `{ "pergunta": "..." }` | Chama o HuggingFace (gratuito) |

---

*Projeto de estudo - LangChain + LangGraph + RAG em JavaScript*
