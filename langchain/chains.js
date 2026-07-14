import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { llm } from "./llm.js";

const resumoPrompt = ChatPromptTemplate.fromTemplate(
  "Resuma o seguinte texto em 3 linhas:\n{texto}"
);

const perguntasPrompt = ChatPromptTemplate.fromTemplate(
  "Crie 3 perguntas de estudo sobre:\n{resumo}"
);

const resumoChain = resumoPrompt.pipe(llm).pipe((res) => ({ resumo: res.content }));

const perguntasChain = perguntasPrompt.pipe(llm).pipe((res) => ({ perguntas: res.content }));

const chain = RunnableSequence.from([
  resumoChain,
  (input) => ({ resumo: input.resumo }),
  perguntasChain,
]);

export { resumoChain, perguntasChain, chain };
