import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

export const config = {
  serverName: process.env.MCP_SERVER_NAME || "langchain-mcp-server",
  serverVersion: process.env.MCP_SERVER_VERSION || "1.0.0",
  logLevel: process.env.LOG_LEVEL || "info",
};
