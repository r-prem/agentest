import { scenario } from "@agentesting/agentest";

// Tests agent behavior when a tool returns an error condition.
// The agent should handle the division by zero gracefully and explain it to the user.
scenario("edge case: agent handles division by zero from calculator", {
  profile: "A math student testing edge cases",
  goal: "Ask the agent to divide 10 by 0 and see how it handles the error",

  mocks: {
    tools: {
      calculator: (args) => {
        const { a, b, operation } = args as { a: number; b: number; operation: string };
        if (operation === "divide" && b === 0) return "Error: division by zero";
        if (operation === "divide") return `${a / b}`;
        return "0";
      },
      get_weather: () => "Not available",
      web_search: () => "No results.",
      read_file: () => "Error: not found",
    },
  },

  assertions: {
    toolCalls: {
      matchMode: "contains",
      expected: [
        {
          name: "calculator",
          args: { a: 10, b: 0, operation: "divide" },
          argMatchMode: "exact",
        },
      ],
    },
  },
});
