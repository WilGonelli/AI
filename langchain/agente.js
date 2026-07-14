import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { llm } from "./llm.js";

const calculadora = tool(
  async ({ expression }) => {
    const result = Function('"use strict"; return (' + expression + ")")();
    return String(result);
  },
  {
    name: "Calculadora",
    description: "Resolve cálculos matemáticos. Ex: 2 + 2, 10 * 5",
    schema: z.object({
      expression: z.string().describe("A expressão matemática a calcular"),
    }),
  }
);

const agent = createAgent({
  model: llm,
  tools: [calculadora],
});

export { agent };
