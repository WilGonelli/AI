import { calculatorTool } from "./calculator.js";
import { weatherTool } from "./weather.js";
import { createNoteTool, listNotesTool, deleteNoteTool } from "./notes.js";

export const tools = [
  calculatorTool,
  weatherTool,
  createNoteTool,
  listNotesTool,
  deleteNoteTool,
];
