import { scenario } from "@agentesting/agentest";

// Tests that a simple single-turn question is answered completely in one turn.
// The simulated user should mark goal as complete after one exchange.
scenario("single turn: simple question answered immediately", {
  profile: "An impatient user who wants a quick answer",
  goal: "Find out what 99 plus 1 equals",

  maxTurns: 2,

  mocks: {
    tools: {
      calculator: () => "100",
      get_weather: () => "Not available",
      web_search: () => "No results.",
      read_file: () => "Error: not found",
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "contains",
      expected: [
        { name: "calculator", argMatchMode: "ignore" },
      ],
    },
  },
});
