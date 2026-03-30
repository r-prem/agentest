import { scenario, sequence } from "@agentesting/agentest";

// Tests sequence() mocks: different results on successive calls.
scenario("sequence: multi-step research with changing results", {
  profile: "A researcher who needs two searches done",
  goal: "Search for 'renewable energy' and then search for 'solar panel costs'. Tell me the key finding from each.",

  maxTurns: 2,

  mocks: {
    tools: {
      web_search: sequence([
        "1. Renewable Energy 101\n   A beginner's guide to wind, solar, and hydro power.",
        "1. Solar Panel Costs 2024\n   Average residential cost is $2.50 per watt.",
      ]),
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
        { name: "web_search", argMatchMode: "ignore" },
      ],
    },
  },
});
