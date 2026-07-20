import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import readline from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";

const SERVER_PATH = join(__dirname, "../server/index.js");

async function main() {
  console.log("=== LangChain + MCP Agent ===\n");
  console.log("Conectando ao servidor MCP...");

  const mcpClient = new MultiServerMCPClient({
    mcpServer: {
      transport: "stdio",
      command: "node",
      args: [SERVER_PATH],
    },
  });

  try {
    const tools = await mcpClient.getTools();
    console.log(`Tools MCP carregadas: ${tools.map((t) => t.name).join(", ")}\n`);

    const model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
    });

    const agent = createAgent({
      model,
      tools,
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = (question) =>
      new Promise((resolve) => rl.question(question, resolve));

    console.log("Digite sua pergunta (ou 'sair' para encerrar):\n");

    while (true) {
      const input = await ask("Voce: ");
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === "sair" || trimmed.toLowerCase() === "exit") {
        console.log("\nEncerrando...");
        break;
      }

      if (!trimmed) continue;

      try {
        const response = await agent.invoke({
          messages: [{ role: "user", content: trimmed }],
        });

        const lastMessage = response.messages[response.messages.length - 1];
        console.log(`\nAgente: ${lastMessage.content}\n`);
      } catch (err) {
        console.error(`\nErro: ${err.message}\n`);
      }
    }

    rl.close();
  } finally {
    await mcpClient.close();
  }
}

main().catch((err) => {
  console.error(`Erro fatal: ${err.message}`);
  process.exit(1);
});
