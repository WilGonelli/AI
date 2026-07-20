import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "./config.js";
import { createLogger } from "../utils/logger.js";
import { tools } from "../tools/index.js";

const logger = createLogger("server");

const server = new McpServer({
  name: config.serverName,
  version: config.serverVersion,
});

for (const tool of tools) {
  server.registerTool(tool.name, {
    description: tool.description,
    inputSchema: tool.inputSchema,
  }, async (args) => {
    logger.info(`Tool chamada: ${tool.name}(${JSON.stringify(args)})`);
    return await tool.execute(args);
  });
  logger.debug(`Tool registrada: ${tool.name}`);
}

async function start() {
  const transport = new StdioServerTransport();

  logger.info(`Iniciando ${config.serverName} v${config.serverVersion}`);
  await server.connect(transport);
  logger.info("Servidor MCP rodando via stdio");
  logger.info(`${tools.length} tools registradas`);
}

start().catch((err) => {
  logger.error(`Falha ao iniciar: ${err.message}`);
  process.exit(1);
});
