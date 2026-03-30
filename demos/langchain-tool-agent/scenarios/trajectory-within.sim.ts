import { scenario } from "@agentesting/agentest";

// Tests WITHIN trajectory matching: agent may only call tools from the allowed set.
scenario("within: only weather and calculator allowed", {
  profile: "A traveler who needs quick weather and a cost calculation",
  goal: "What is the weather in San Francisco and what is 25 times 3?",

  maxTurns: 2,

  mocks: {
    tools: {
      get_weather: () => "San Francisco: 59°F, Foggy",
      calculator: (args) => {
        const { a, b, operation } = args as { a: number; b: number; operation: string };
        if (operation === "multiply") return `${a * b}`;
        return "0";
      },
      web_search: () => "No results.",
      read_file: () => "Error: not found",
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "within",
      expected: [
        { name: "get_weather", argMatchMode: "ignore" },
        { name: "calculator", argMatchMode: "ignore" },
      ],
    },
  },
});
