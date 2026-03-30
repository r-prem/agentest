import { createAgent } from "langchain";
import { calculator } from "./tools/calculator.js";
import { getWeather } from "./tools/weather.js";
import { readFile } from "./tools/fileReader.js";
import { webSearch } from "./tools/search.js";

export const tools = [calculator, getWeather, readFile, webSearch];

export const agent = createAgent({
  model: "openai:gpt-5.4-nano",
  tools,
  systemPrompt: `You are a helpful assistant with access to the following tools:
- calculator: for arithmetic operations
- get_weather: for checking weather in cities
- read_file: for reading local files
- web_search: for searching the web

Use the appropriate tool(s) to answer the user's questions. Be concise in your responses.`,
});
