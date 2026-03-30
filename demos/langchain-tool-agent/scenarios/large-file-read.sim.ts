import { scenario } from "@agentesting/agentest";

// Tests agent behavior with a large tool result — should summarize, not dump.
scenario("verbosity: agent summarizes large file content", {
  profile: "A busy manager who wants a quick summary",
  goal: "Read ./server.log and tell me how many errors there are and what they say",

  maxTurns: 2,

  mocks: {
    tools: {
      read_file: () =>
        [
          "[2024-01-15 08:00:01] INFO  Server started on port 3000",
          "[2024-01-15 08:00:02] INFO  Connected to database",
          "[2024-01-15 08:01:15] INFO  GET /api/users 200 45ms",
          "[2024-01-15 08:02:30] ERROR Failed to connect to Redis: ECONNREFUSED",
          "[2024-01-15 08:03:00] INFO  GET /api/products 200 89ms",
          "[2024-01-15 08:03:45] ERROR TypeError: Cannot read properties of null",
          "[2024-01-15 08:04:00] INFO  GET /api/health 200 2ms",
        ].join("\n"),
      get_weather: () => "Not available",
      calculator: () => "0",
      web_search: () => "No results.",
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "contains",
      expected: [
        { name: "read_file", argMatchMode: "ignore" },
      ],
      forbidden: [
        { name: "web_search" },
        { name: "get_weather" },
        { name: "calculator" },
      ],
    },
  },
});
