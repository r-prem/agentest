import { scenario } from "@agentesting/agentest";

scenario("user asks about weather and does math", {
  profile: "A traveler planning expenses",
  goal: "Check the weather in Paris and calculate 3 times 120",

  maxTurns: 2,

  knowledge: [
    { content: "Hotel rate is 120 euros per night for 3 nights" },
  ],

  mocks: {
    tools: {
      get_weather: () => "Paris: 68°F, Sunny",
      calculator: (args) => {
        const { a, b, operation } = args as { a: number; b: number; operation: string };
        if (operation === "multiply") return `${a * b}`;
        if (operation === "add") return `${a + b}`;
        return "0";
      },
      web_search: () => "No results found.",
      read_file: () => "Error: file not found",
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "contains",
      expected: [
        { name: "get_weather", argMatchMode: "ignore" },
        { name: "calculator", argMatchMode: "ignore" },
      ],
    },
  },
});
