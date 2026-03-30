import { tool } from "@langchain/core/tools";
import * as z from "zod";

export const webSearch = tool(
  ({ query, maxResults }) => {
    const limit = maxResults ?? 3;
    const mockResults = [
      { title: `${query} - Wikipedia`, snippet: `Overview article about ${query} with detailed information.` },
      { title: `Understanding ${query} | Blog`, snippet: `A comprehensive guide to ${query} and its applications.` },
      { title: `${query} explained simply`, snippet: `Simple explanation of ${query} for beginners.` },
      { title: `Latest news on ${query}`, snippet: `Recent developments and updates related to ${query}.` },
      { title: `${query} - official docs`, snippet: `Official documentation and reference for ${query}.` },
    ];

    return mockResults
      .slice(0, limit)
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}`)
      .join("\n");
  },
  {
    name: "web_search",
    description: "Search the web for information on a given query",
    schema: z.object({
      query: z.string().describe("The search query"),
      maxResults: z.number().optional().describe("Maximum number of results to return (default: 3)"),
    }),
  }
);
