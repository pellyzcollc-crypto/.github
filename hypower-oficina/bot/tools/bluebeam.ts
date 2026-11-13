import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { leerListaBluebeam } from "../lib/bluebeam-lista.js";

const inputSchema = z.object({
  texto: z
    .string()
    .min(1)
    .max(500_000)
    .describe("CSV, TSV o XML de la Markups List, con la fila de encabezados."),
});

export default defineTool({
  description: prompt`
    Lee una lista de marcas pegada desde Bluebeam Revu.
    Úsala cuando Pedro pega el CSV, el TSV o el XML del summary de Markups List.
    No abre Revu, no mide el plano y no calcula desperdicio ni compra.
    Copia a rollup-materiales solo los objetos de paraRollup.
    Una fila con entraEnCompra en false no se compra: el motivo dice por qué.
    conteo no se suma al largo. subida no se suma a la cantidad.
    Los totales de grupo y el padre de un grupo ya quedaron fuera.
  `,
  inputSchema,
  effect: "read",
  async execute({ texto }) {
    return leerListaBluebeam(texto);
  },
});
