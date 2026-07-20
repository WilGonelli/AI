import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

import express from "express";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";

const SERVER_PATH = join(__dirname, "../server/index.js");
const PORT = process.env.PORT || 3000;

let agent;

async function setupAgent() {
  console.log("Conectando ao servidor MCP...");

  const mcpClient = new MultiServerMCPClient({
    mcpServer: {
      transport: "stdio",
      command: "node",
      args: [SERVER_PATH],
    },
  });

  const tools = await mcpClient.getTools();
  console.log(`Tools MCP carregadas: ${tools.map((t) => t.name).join(", ")}`);

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0,
  });

  agent = createAgent({
    model,
    tools,
  });

  console.log("Agente LangChain pronto\n");
  return mcpClient;
}

async function main() {
  const mcpClient = await setupAgent();

  const app = express();
  app.use(express.json());

  app.post("/chat", async (req, res) => {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Campo 'message' obrigatorio" });
      }

      const response = await agent.invoke({
        messages: [{ role: "user", content: message }],
      });

      const lastMessage = response.messages[response.messages.length - 1];

      res.json({ response: lastMessage.content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", tools: agent ? "loaded" : "not loaded" });
  });

  app.listen(PORT, () => {
    console.log(`Servidor HTTP rodando em http://localhost:${PORT}`);
    console.log("Endpoints:");
    console.log("  POST /chat    - Enviar mensagem ao agente");
    console.log("  GET  /health  - Verificar status");
  });

  process.on("SIGINT", async () => {
    console.log("\nEncerrando...");
    await mcpClient.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(`Erro fatal: ${err.message}`);
  process.exit(1);
});
