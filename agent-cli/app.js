import readline from "readline";
import dotenv from "dotenv";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

dotenv.config();

const PROVIDERS = {
  hf: {
    name: "HuggingFace",
    model: "Qwen/Qwen2.5-72B-Instruct",
    apiKey: process.env.HF_API_KEY,
    baseURL: "https://router.huggingface.co/v1/",
  },
  gemini: {
    name: "Google Gemini",
    model: "gemini-2.5-flash",
    apiKey: process.env.GOOGLE_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  gemini3: {
    name: "Google Gemini 3.5",
    model: "gemini-3.5-flash",
    apiKey: process.env.GOOGLE_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
};

const promptSistema = `Você é um assistente de controle financeiro pessoal.
Ajude o usuário a registrar gastos e consultar finanças.
Use as ferramentas disponíveis para registrar gastos e consultar gastos por mês.
Sempre confirme o que foi registrado ao usuário de forma clara e amigável.
Data de hoje: ${new Date().toISOString().split("T")[0]}.`;

function jsonSchemaParaZod(schema) {
  const shape = {};
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    let zodType;
    switch (prop.type) {
      case "string": zodType = z.string(); break;
      case "number": zodType = z.number(); break;
      case "boolean": zodType = z.boolean(); break;
      default: zodType = z.any();
    }
    if (prop.description) zodType = zodType.describe(prop.description);
    if (!schema.required?.includes(key)) zodType = zodType.optional();
    shape[key] = zodType;
  }
  return z.object(shape);
}

async function criarFerramentasMcp() {
  console.log("  [1/3] Iniciando processo MCP...");
  const transport = new StdioClientTransport({
    command: "node",
    args: ["servidor_financeiro.js"],
  });

  console.log("  [2/3] Conectando ao servidor MCP...");
  const client = new Client({ name: "agent-cli", version: "1.0.0" });
  await client.connect(transport);
  console.log("       Conexão MCP estabelecida!");

  console.log("  [3/3] Listando ferramentas disponíveis...");
  const { tools } = await client.listTools();
  console.log(`       Encontradas: ${tools.map((t) => t.name).join(", ")}`);

  return tools.map(
    (tool) =>
      new DynamicStructuredTool({
        name: tool.name,
        description: tool.description,
        schema: jsonSchemaParaZod(tool.inputSchema),
        func: async (args) => {
          console.log(`       >> Chamando ferramenta: ${tool.name}`);
          console.log(`          Argumentos: ${JSON.stringify(args)}`);
          const result = await client.callTool({
            name: tool.name,
            arguments: args,
          });
          const texto = result.content.map((c) => c.text).join("\n");
          console.log(`       << Resultado: ${texto}`);
          return texto;
        },
      }),
  );
}

function selecionarProvider() {
  const arg = process.argv[2]?.toLowerCase();
  if (arg && PROVIDERS[arg]) {
    return arg;
  }

  console.log("\nSelecione o provedor de IA:");
  console.log("  [1] HuggingFace (Qwen 72B)");
  console.log("  [2] Google Gemini 2.5 (Flash)");
  console.log("  [3] Google Gemini 3.5 (Flash)");
  console.log("");

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Opção (1, 2 ou 3): ", (resposta) => {
      rl.close();
      const choices = { "1": "hf", "2": "gemini", "3": "gemini3" };
      resolve(choices[resposta.trim()] || "hf");
    });
  });
}

async function rodarApp() {
  const providerKey = await selecionarProvider();
  const provider = PROVIDERS[providerKey];

  if (!provider.apiKey) {
    console.error(`\nErro: Chave API não encontrada para ${provider.name}.`);
    console.error(`Configure a variável de ambiente no arquivo .env`);
    process.exit(1);
  }

  console.log(`\nConectando ao Servidor MCP via ${provider.name}...`);
  const ferramentas = await criarFerramentasMcp();
  console.log(`✓ ${ferramentas.length} ferramenta(s) carregada(s): ${ferramentas.map((f) => f.name).join(", ")}`);

  const modelo = new ChatOpenAI({
    model: provider.model,
    apiKey: provider.apiKey,
    temperature: 0.1,
    configuration: {
      baseURL: provider.baseURL,
    },
  });

  console.log("  Criando agente LangGraph...");
  const agente = createReactAgent({
    llm: modelo,
    tools: ferramentas,
    prompt: promptSistema,
  });
  console.log("  Agente criado com sucesso!");

  console.log(`\nControle Financeiro Local (${provider.name}) Iniciado!`);
  console.log(
    "Experimente falar:\n -> 'Gastei 15 reais com café hoje'\n -> 'Mostra as finanças deste mês'\n -> 'sair' para encerrar\n",
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const fazerPergunta = () => {
    rl.question("Você: ", async (entrada) => {
      if (entrada.toLowerCase() === "sair") {
        rl.close();
        process.exit(0);
      }
      if (!entrada.trim()) {
        fazerPergunta();
        return;
      }

      try {
        console.log("\n  [Processando...] Enviando para o LLM...");
        const respostaAgente = await agente.invoke({
          messages: [{ role: "user", content: entrada }],
        });
        const mensagens = respostaAgente.messages;
        const ultimaMensagem = mensagens[mensagens.length - 1];
        console.log("  [Concluído!]");
        console.log(`\nAssistente: ${ultimaMensagem.content}\n`);
      } catch (erro) {
        console.error(`\nErro: ${erro.message}\n`);
      }

      fazerPergunta();
    });
  };

  fazerPergunta();
}

rodarApp().catch(console.error);
