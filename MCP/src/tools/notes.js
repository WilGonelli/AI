import { z } from "zod";

const notes = [];

export const createNoteTool = {
  name: "create_note",
  description: "Cria uma nova nota com titulo e conteudo",
  inputSchema: {
    title: z.string().min(1).describe("Titulo da nota"),
    content: z.string().min(1).describe("Conteudo da nota"),
  },
  async execute(args) {
    const { title, content } = args;

    const note = {
      id: notes.length + 1,
      title,
      content,
      createdAt: new Date().toISOString(),
    };

    notes.push(note);

    return {
      content: [
        {
          type: "text",
          text: `Nota criada com sucesso!\nID: ${note.id}\nTitulo: ${note.title}\nCriada em: ${note.createdAt}`,
        },
      ],
    };
  },
};

export const listNotesTool = {
  name: "list_notes",
  description: "Lista todas as notas salvas",
  inputSchema: {},
  async execute() {
    if (notes.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Nenhuma nota salva.",
          },
        ],
      };
    }

    const list = notes
      .map((n) => `[${n.id}] ${n.title} - ${n.createdAt}`)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Notas salvas:\n${list}`,
        },
      ],
    };
  },
};

export const deleteNoteTool = {
  name: "delete_note",
  description: "Deleta uma nota pelo ID",
  inputSchema: {
    id: z.number().int().positive().describe("ID da nota a ser deletada"),
  },
  async execute(args) {
    const { id } = args;
    const index = notes.findIndex((n) => n.id === id);

    if (index === -1) {
      throw new Error(`Nota com ID ${id} nao encontrada`);
    }

    const deleted = notes.splice(index, 1)[0];

    return {
      content: [
        {
          type: "text",
          text: `Nota "${deleted.title}" (ID: ${id}) deletada com sucesso!`,
        },
      ],
    };
  },
};
