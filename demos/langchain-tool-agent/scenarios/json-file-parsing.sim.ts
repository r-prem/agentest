import { scenario } from "@agentesting/agentest";

// Tests that the agent correctly interprets structured JSON from a tool result.
scenario("file parsing: extract specific fields from JSON config", {
  profile: "A DevOps engineer checking database configuration",
  goal: "Read the config at ./db-config.json and tell me the database host, port, and max connections",

  mocks: {
    tools: {
      read_file: () =>
        JSON.stringify(
          {
            database: {
              host: "db.prod.internal",
              port: 5432,
              maxConnections: 100,
              ssl: true,
              timeout: 30000,
            },
            cache: {
              host: "redis.prod.internal",
              port: 6379,
            },
          },
          null,
          2,
        ),
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
      ],
    },
  },
});
