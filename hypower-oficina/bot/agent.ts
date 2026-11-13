import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  name: "Mesa Hypower",
  description:
    "Oficina del superintendente de Hypower: materiales, circuitos, Procore, campo y correo.",
  model: {
    id: "grok-4.7",
    params: [
      { id: "reasoning_effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
});
