import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { llm } from "./llm.js";

const GraphState = Annotation.Root({
  texto: String,
  resumo: String,
  perguntas: String,
});

async function nodeResumo(state) {
  const res = await llm.invoke(
    `Resuma o seguinte texto em 3 linhas:\n${state.texto}`
  );
  return { resumo: res.content };
}

async function nodePerguntas(state) {
  const res = await llm.invoke(
    `Crie 3 perguntas de estudo sobre:\n${state.resumo}`
  );
  return { perguntas: res.content };
}

const graph = new StateGraph(GraphState)
  .addNode("resumo", nodeResumo)
  .addNode("perguntas", nodePerguntas)
  .addEdge(START, "resumo")
  .addEdge("resumo", "perguntas")
  .addEdge("perguntas", END);

const compiledGraph = graph.compile();

export { compiledGraph as graph };
