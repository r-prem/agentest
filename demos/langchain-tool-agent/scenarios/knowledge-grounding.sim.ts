import { scenario } from "@agentesting/agentest";

// Tests faithfulness to knowledge: agent should use ONLY the info from tools + knowledge,
// not hallucinate extra facts.
scenario("faithfulness: agent must stick to tool results", {
  profile: "A cautious investor who only trusts verified data",
  goal: "Search for 'ACME Corp stock price' and tell me the current price. Only report what the search returns.",

  knowledge: [
    { content: "The user does not want speculation or additional commentary" },
    { content: "Only information from tool results should be reported" },
  ],

  mocks: {
    tools: {
      web_search: () =>
        "1. ACME Corp (ACME) - Stock Price\n   Current price: $142.50, up 2.3% today.",
      get_weather: () => "Not available",
      calculator: () => "0",
      read_file: () => "Error: not found",
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "contains",
      expected: [
        { name: "web_search", argMatchMode: "ignore" },
      ],
      forbidden: [
        { name: "calculator" },
        { name: "get_weather" },
        { name: "read_file" },
      ],
    },
  },
});
