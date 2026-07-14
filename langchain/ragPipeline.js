import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0,
});

let vectorStore;

async function initVectorStore() {
  if (vectorStore) return vectorStore;

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const indexName = "juridico-index";
  const embeddings = new OpenAIEmbeddings();

  vectorStore = await PineconeStore.fromExistingIndex(
    pinecone.index(indexName),
    { embedding: embeddings }
  );

  return vectorStore;
}

export async function ragQuery(pergunta) {
  const store = await initVectorStore();
  const docs = await store.similaritySearch(pergunta, 3);
  const context = docs.map((d) => d.pageContent).join("\n");
  const resposta = await llm.invoke(
    `Com base nos documentos:\n${context}\nPergunta: ${pergunta}`
  );
  return resposta.content;
}
