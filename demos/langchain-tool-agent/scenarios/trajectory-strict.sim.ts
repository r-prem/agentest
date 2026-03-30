import { scenario } from "@agentesting/agentest";

// Tests STRICT trajectory matching: exact tools in exact order, exact count.
scenario("strict: weather then calculate in order", {
  profile: "A tourist who always asks about weather first, then does budget math",
  goal: "Check the weather in Tokyo, then calculate 4 nights at 150 dollars per night",

  knowledge: [
    { content: "Hotel costs 150 dollars per night" },
    { content: "Trip is 4 nights in Tokyo" },
  ],

  mocks: {
    tools: {
      get_weather: () => "Tokyo: 72°F, Clear",
      calculator: (args) => {
        const { a, b, operation } = args as { a: number; b: number; operation: string };
        if (operation === "multiply") return `${a * b}`;
        return `${a + b}`;
      },
      web_search: () => "No results.",
      read_file: () => "Error: not found",
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "strict",
      expected: [
        { name: "get_weather", argMatchMode: "ignore" },
        { name: "calculator", argMatchMode: "ignore" },
      ],
    },
  },
});
