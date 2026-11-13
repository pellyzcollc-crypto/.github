import { defineEval, includes } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["bluebeam"],
  description: "A pasted Revu markups list is read with bluebeam and not re-measured.",
  async test(t) {
    await t.send(
      "No delegues, no guardes y no calcules compra. Lee esta lista de marcas con bluebeam " +
        "y dime qué entra en compra.\n" +
        "Subject,Label,Page Label,Space,Length,Count,Unit\n" +
        "EMT 3/4,,E-201,Level 2,120 ft,,ft\n" +
        "THHN #12,,E-201,Level 2,400 ft,,ft\n" +
        "Cloud,,E-202,Level 2,,,\n" +
        "4SQ,,E-201,Level 2,,24,ea",
    );
    t.succeeded();
    t.calledTool("bluebeam");
    t.notCalledTool("rollup-materiales");
    t.notCalledTool("cuaderno");
    t.check(t.reply, includes(/120/));
    t.check(t.reply, includes(/400/));
    t.check(t.reply, includes(/24/));
  },
});
