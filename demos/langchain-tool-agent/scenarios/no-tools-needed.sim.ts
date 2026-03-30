import { scenario } from "@agentesting/agentest";

// Tests that the agent does NOT call any tools for a simple greeting.
// If the agent unnecessarily calls tools, the 'within' match with empty expected will catch it.
scenario("no tools: simple greeting needs no tool calls", {
  profile: "A friendly user just saying hello",
  goal: "Say hello and get a greeting back from the agent",

  mocks: {
    tools: {
      get_weather: () => "Not available",
      calculator: () => "0",
      web_search: () => "No results.",
      read_file: () => "Error: not found",
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "within",
      expected: [],
      forbidden: [
        { name: "get_weather" },
        { name: "calculator" },
        { name: "web_search" },
        { name: "read_file" },
      ],
    },
  },
});
