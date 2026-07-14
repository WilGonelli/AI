import dotenv from "dotenv";

dotenv.config();

export const config = {
  serverName: process.env.MCP_SERVER_NAME || "mcp-study-server",
  serverVersion: process.env.MCP_SERVER_VERSION || "1.0.0",
  logLevel: process.env.LOG_LEVEL || "info",
};
