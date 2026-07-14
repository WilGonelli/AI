import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "./config.js";
import { createLogger } from "../utils/logger.js";
import { tools } from "../tools/index.js";
import { resources } from "../resources/index.js";
import { prompts } from "../prompts/index.js";

const logger = createLogger("server");

export function createMcpServer() {
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

function registerTools(server) {
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
}

function registerResources(server) {
  for (const resource of resources) {
    server.registerResource(resource.name, resource.uri, {
      description: resource.description,
      mimeType: resource.mimeType,
    }, async (uri) => {
      logger.info(`Resource acessada: ${resource.name} (${uri})`);
      return await resource.read();
    });
    logger.debug(`Resource registrada: ${resource.name}`);
  }
}

function registerPrompts(server) {
  for (const prompt of prompts) {
    server.registerPrompt(prompt.name, {
      description: prompt.description,
      argsSchema: prompt.argsSchema,
    }, async (args) => {
      logger.info(`Prompt chamado: ${prompt.name}(${JSON.stringify(args)})`);
      return await prompt.generate(args);
    });
    logger.debug(`Prompt registrado: ${prompt.name}`);
  }
}

async function startServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  logger.info(`Iniciando ${config.serverName} v${config.serverVersion}`);

  await server.connect(transport);

  logger.info("Servidor MCP rodando via stdio");
  logger.info(`${tools.length} tools | ${resources.length} resources | ${prompts.length} prompts`);
}

startServer().catch((err) => {
  logger.error(`Falha ao iniciar servidor: ${err.message}`);
  process.exit(1);
});
