import { scenario } from "@agentesting/agentest";

scenario("user searches for information", {
  profile: "A student researching for a school project",
  goal: "Search for 'climate change' and summarize what the search results say",

  maxTurns: 2,

  mocks: {
    tools: {
      web_search: () =>
        "1. Climate Change Overview - NASA\n   Comprehensive guide to climate science.\n2. IPCC Report Summary\n   Latest findings on global warming trends.",
      get_weather: () => "Not available",
      calculator: () => "0",
      read_file: () => "Error: not found",
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "contains",
      expected: [{ name: "web_search", argMatchMode: "ignore" }],
    },
  },
});
