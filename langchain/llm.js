import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";

dotenv.config();

const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0,
});

export async function hfQuery(prompt) {
  const response = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        model: "Qwen/Qwen3-8B",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 512,
      }),
    },
  );

  const result = await response.json();
  return result.choices?.[0]?.message?.content || JSON.stringify(result);
}

export { llm };
