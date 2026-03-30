import { scenario } from "@agentesting/agentest";

// Tests PARTIAL argument matching: we only check that city="Paris", other args don't matter.
scenario("partial args: weather must query Paris", {
  profile: "A traveler checking current conditions before heading out",
  goal: "What is the current temperature and condition in Paris?",

  maxTurns: 2,

  mocks: {
    tools: {
      get_weather: () => "Paris: 68°F, Sunny",
      calculator: () => "0",
      web_search: () => "No results.",
      read_file: () => "Error: not found",
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "contains",
      expected: [
        {
          name: "get_weather",
          args: { city: "Paris" },
          argMatchMode: "partial",
        },
      ],
    },
  },
});
