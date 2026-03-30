import { scenario } from "@agentesting/agentest";

scenario("user reads a local file", {
  profile: "A developer who needs a quick answer",
  goal: "Read the package.json file and list the dependency names",

  maxTurns: 2,

  knowledge: [
    { content: "The file is at ./package.json" },
  ],

  mocks: {
    tools: {
      get_weather: () => "Not available",
      calculator: () => "0",
      web_search: () => "No results found.",
      read_file: () =>
        JSON.stringify(
          {
            name: "my-project",
            dependencies: { express: "^5.0.0", zod: "^3.0.0" },
          },
          null,
          2,
        ),
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "contains",
      expected: [{ name: "read_file", argMatchMode: "ignore" }],
    },
  },
});
