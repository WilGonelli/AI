import os from "node:os";

export const systemInfoResource = {
  name: "system-info",
  description: "Informacoes do sistema operacional e runtime",
  uri: "system://info",
  mimeType: "application/json",
  async read() {
    return {
      contents: [
        {
          uri: "system://info",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              platform: os.platform(),
              arch: os.arch(),
              hostname: os.hostname(),
              uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
              totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`,
              freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB`,
              cpus: os.cpus().length,
              nodeVersion: process.version,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
