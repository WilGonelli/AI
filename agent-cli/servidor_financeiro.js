import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";

const ARQUIVO_FINANCAS = path.join(process.cwd(), "financas.md");

// Inicializa o arquivo Markdown se ele não existir
function inicializarArquivo() {
  if (!fs.existsSync(ARQUIVO_FINANCAS)) {
    fs.writeFileSync(
      ARQUIVO_FINANCAS,
      "# 💰 Meu Controle Financeiro Local\n\n",
      "utf-8",
    );
  }
}

// Cria o servidor MCP
const server = new Server(
  { name: "gerenciador-financeiro", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// 1. Define as ferramentas disponíveis no servidor
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "registrar_gasto",
        description:
          "Registra um novo gasto no arquivo Markdown de finanças. Data deve ser YYYY-MM-DD.",
        inputSchema: {
          type: "object",
          properties: {
            valor: { type: "number", description: "O valor numérico do gasto" },
            categoria: {
              type: "string",
              description: "A categoria (ex: Alimentação, Transporte)",
            },
            descricao: {
              type: "string",
              description: "O detalhe do que foi comprado",
            },
            data: {
              type: "string",
              description: "Data no formato YYYY-MM-DD. Opcional.",
            },
          },
          required: ["valor", "categoria", "descricao"],
        },
      },
      {
        name: "obter_gastos_mes",
        description:
          "Lê a tabela de gastos de um mês específico (Formato: YYYY-MM) do arquivo.",
        inputSchema: {
          type: "object",
          properties: {
            ano_mes: {
              type: "string",
              description: "O mês alvo no formato YYYY-MM",
            },
          },
          required: ["ano_mes"],
        },
      },
      {
        name: "registrar_parcela",
        description:
          "Registra uma compra parcelada, criando entradas para cada parcela nos próximos meses. Pode informar o valor total (será dividido) ou o valor da parcela diretamente.",
        inputSchema: {
          type: "object",
          properties: {
            valor_total: {
              type: "number",
              description: "Valor total da compra (será dividido pelo número de parcelas). Use este OU valor_parcela.",
            },
            valor_parcela: {
              type: "number",
              description: "Valor de cada parcela. Use este OU valor_total.",
            },
            parcelas: {
              type: "number",
              description: "Número de parcelas (ex: 10 para 10x)",
            },
            categoria: {
              type: "string",
              description: "Categoria (ex: Transporte, Serviços, Eletrônicos)",
            },
            descricao: {
              type: "string",
              description: "Descrição da compra (ex: Moto Honda, Mecânica do carro)",
            },
            data: {
              type: "string",
              description: "Data da primeira parcela no formato YYYY-MM-DD. Opcional (padrão: hoje).",
            },
          },
          required: ["parcelas", "categoria", "descricao"],
        },
      },
    ],
  };
});

// 2. Implementa a lógica das ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  inicializarArquivo();
  const { name, arguments: args } = request.params;

  if (name === "registrar_gasto") {
    const valor = args.valor;
    const categoria = args.categoria;
    const descricao = args.descricao;
    const data = args.data || new Date().toISOString().split("T")[0];
    const anoMes = data.substring(0, 7);

    let conteudo = fs.readFileSync(ARQUIVO_FINANCAS, "utf-8");
    const secaoMes = `## Conteúdo de ${anoMes}`;
    const novaLinha = `| ${data} | R$ ${valor.toFixed(2)} | ${categoria} | ${descricao} |\n`;

    // Se o mês não existir no arquivo, cria a estrutura da tabela
    if (!conteudo.includes(secaoMes)) {
      const templateSecao = `\n${secaoMes}\n| Data | Valor | Categoria | Descrição |\n| :--- | :--- | :--- | :--- |\n`;
      conteudo += templateSecao;
    }

    // Injeta a nova linha logo abaixo dos cabeçalhos da tabela correspondente
    const alvoBusca = `${secaoMes}\n| Data | Valor | Categoria | Descrição |\n| :--- | :--- | :--- | :--- |\n`;
    conteudo = conteudo.replace(alvoBusca, alvoBusca + novaLinha);

    fs.writeFileSync(ARQUIVO_FINANCAS, conteudo, "utf-8");
    return {
      content: [
        {
          type: "text",
          text: `Sucesso: R$ ${valor.toFixed(2)} registrado em '${categoria}' para o mês ${anoMes}.`,
        },
      ],
    };
  }

  if (name === "obter_gastos_mes") {
    const { ano_mes } = args;
    const conteudo = fs.readFileSync(ARQUIVO_FINANCAS, "utf-8");
    const secaoMes = `## Conteúdo de ${ano_mes}`;

    if (!conteudo.includes(secaoMes)) {
      return {
        content: [
          {
            type: "text",
            text: `Nenhum gasto encontrado para o mês ${ano_mes}.`,
          },
        ],
      };
    }

    // Fatia o texto para pegar a tabela desse mês específico
    const partes = conteudo.split(secaoMes);
    const blocoTabela = partes[1].split("##")[0].trim();

    return {
      content: [
        {
          type: "text",
          text: `Aqui estão os dados encontrados para ${ano_mes}:\n\n${blocoTabela}`,
        },
      ],
    };
  }

  if (name === "registrar_parcela") {
    const { valor_total, valor_parcela, parcelas, categoria, descricao, data: dataInicio } = args;
    
    // Calcula valor da parcela
    let valorParcela;
    if (valor_parcela) {
      valorParcela = valor_parcela;
    } else if (valor_total) {
      valorParcela = valor_total / parcelas;
    } else {
      return {
        content: [{
          type: "text",
          text: "Erro: Informe valor_total ou valor_parcela.",
        }],
      };
    }

    // Data inicial (padrão: hoje)
    const dataBase = dataInicio ? new Date(dataInicio + "T00:00:00") : new Date();
    let mesAtual = dataBase.getMonth();
    let anoAtual = dataBase.getFullYear();
    
    let conteudo = fs.readFileSync(ARQUIVO_FINANCAS, "utf-8");
    const registros = [];

    // Gera cada parcela
    for (let i = 0; i < parcelas; i++) {
      const mes = String(mesAtual + 1).padStart(2, "0");
      const anoMes = `${anoAtual}-${mes}`;
      const dia = String(dataBase.getDate()).padStart(2, "0");
      const dataParcela = `${anoMes}-${dia}`;
      const secaoMes = `## Conteúdo de ${anoMes}`;
      const numParcela = i + 1;
      const descricaoParcela = `Parcela ${numParcela}/${parcelas} - ${descricao}`;
      const novaLinha = `| ${dataParcela} | R$ ${valorParcela.toFixed(2)} | ${categoria} | ${descricaoParcela} |\n`;

      // Cria seção do mês se não existir
      if (!conteudo.includes(secaoMes)) {
        const templateSecao = `\n${secaoMes}\n| Data | Valor | Categoria | Descrição |\n| :--- | :--- | :--- | :--- |\n`;
        conteudo += templateSecao;
      }

      // Injeta linha na tabela
      const alvoBusca = `${secaoMes}\n| Data | Valor | Categoria | Descrição |\n| :--- | :--- | :--- | :--- |\n`;
      conteudo = conteudo.replace(alvoBusca, alvoBusca + novaLinha);

      registros.push(`${dataParcela}: R$ ${valorParcela.toFixed(2)}`);

      // Avança para próximo mês
      mesAtual++;
      if (mesAtual > 11) {
        mesAtual = 0;
        anoAtual++;
      }
    }

    fs.writeFileSync(ARQUIVO_FINANCAS, conteudo, "utf-8");
    
    return {
      content: [{
        type: "text",
        text: `Sucesso: ${parcelas}x R$ ${valorParcela.toFixed(2)} registrado para "${descricao}".\n\nParcelas criadas:\n${registros.join("\n")}`,
      }],
    };
  }

  throw new Error(`Ferramenta não encontrada: ${name}`);
});

// Conecta o servidor usando o transporte STDIO (padrão do protocolo MCP)
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
