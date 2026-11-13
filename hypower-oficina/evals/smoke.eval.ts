import { defineEval, includes } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "A buyout uses rollup-materiales and keeps the tool quantities.",
  async test(t) {
    await t.send(
      "No delegues y no guardes. Calcula la compra con rollup-materiales. " +
        "EMT 3/4, familia conduit, 120 ft, área Nivel 2, plano E-201. " +
        "THHN #12, familia cable, 400 ft. " +
        "Cajas 4x4, familia dispositivo, 24 ea.",
    );
    t.succeeded();
    t.calledTool("rollup-materiales");
    t.notCalledTool("cuaderno");
    t.check(t.reply, includes(/132/));
    t.check(t.reply, includes(/440/));
    t.check(t.reply, includes(/24/));
  },
});
