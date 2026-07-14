import { z } from "zod";

export const calculatorTool = {
  name: "calculator",
  description: "Resolve calculos matematicos. Ex: 2 + 2, 10 * 5, 2 ** 8",
  inputSchema: {
    expression: z.string().describe("A expressao matematica a calcular"),
  },
  async execute(args) {
    const { expression } = args;

    const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
    if (sanitized !== expression) {
      throw new Error("Expressao contem caracteres invalidos");
    }

    try {
      const result = Function('"use strict"; return (' + expression + ")")();
      return {
        content: [
          {
            type: "text",
            text: `Resultado: ${result}`,
          },
        ],
      };
    } catch (err) {
      throw new Error(`Erro ao calcular "${expression}": ${err.message}`);
    }
  },
};
