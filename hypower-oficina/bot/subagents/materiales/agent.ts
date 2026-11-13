import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  description:
    "Use for Bluebeam layout, measured takeoff, material buyout, and vendor price requests. Calls rollup-materiales. Does not invent counts or prices.",
});
