import { scenario } from "@agentesting/agentest";

// Tests that mock context (callIndex) works correctly.
scenario("context mock: search results change per call", {
  profile: "A researcher doing two specific searches",
  goal: "Search for 'machine learning basics' and then search for 'deep learning'. Tell me what each search returned.",

  maxTurns: 2,

  mocks: {
    tools: {
      web_search: (_args, ctx) => {
        if (ctx.callIndex === 0) {
          return "1. ML Basics - Stanford\n   Introduction to supervised and unsupervised learning.";
        }
        return "1. Deep Learning vs ML\n   Deep learning is a subset of ML using neural networks.";
      },
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
