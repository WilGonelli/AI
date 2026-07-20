import { z } from "zod";

const WEATHER_DATA = {
  "Sao Paulo": { temp: 28, condition: "Ensolarado", humidity: 65 },
  "Rio de Janeiro": { temp: 32, condition: "Parcialmente nublado", humidity: 70 },
  "Curitiba": { temp: 18, condition: "Chuvoso", humidity: 80 },
  "Salvador": { temp: 30, condition: "Ensolarado", humidity: 75 },
  "Belo Horizonte": { temp: 26, condition: "Nublado", humidity: 60 },
  "Brasilia": { temp: 27, condition: "Ensolarado", humidity: 55 },
  "Manaus": { temp: 33, condition: "Chuvoso", humidity: 85 },
  "Porto Alegre": { temp: 22, condition: "Parcialmente nublado", humidity: 70 },
};

export const weatherTool = {
  name: "get_weather",
  description:
    "Obtem a previsao do tempo para uma cidade brasileira. Retorna temperatura, condicao e umidade.",
  inputSchema: {
    city: z.string().describe("Nome da cidade (ex: Sao Paulo, Rio de Janeiro)"),
  },
  async execute(args) {
    const { city } = args;

    const data = WEATHER_DATA[city];

    if (!data) {
      const availableCities = Object.keys(WEATHER_DATA).join(", ");
      throw new Error(
        `Cidade "${city}" nao encontrada. Cidades disponiveis: ${availableCities}`
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              city,
              temperature: `${data.temp}°C`,
              condition: data.condition,
              humidity: `${data.humidity}%`,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
