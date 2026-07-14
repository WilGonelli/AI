import { z } from "zod";

export const greetingPrompt = {
  name: "greeting",
  description: "Gera uma mensagem de boas-vindas personalizada",
  argsSchema: {
    name: z.string().min(1).describe("Nome do usuario"),
  },
  async generate(args) {
    const { name } = args;

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Ola, ${name}! Bem-vindo ao servidor MCP de estudo. Posso ajudar com calculos, previsao do tempo e gerenciamento de notas.`,
          },
        },
      ],
    };
  },
};
