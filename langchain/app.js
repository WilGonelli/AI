import express from "express";
import { hfQuery, llm } from "./llm.js";

const app = express();
app.use(express.json());

app.post("/llm", async (req, res) => {
  try {
    const { pergunta } = req.body;
    const resposta = await llm.invoke(pergunta);
    res.json({ resposta: resposta.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/hf", async (req, res) => {
  try {
    const { pergunta } = req.body;
    const resposta = await hfQuery(pergunta);
    res.json({ resposta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
