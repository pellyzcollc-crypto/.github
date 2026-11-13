import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

const familias = [
  "conduit",
  "cable",
  "soporte",
  "dispositivo",
  "tablero",
  "herraje",
  "otro",
] as const;

type Familia = (typeof familias)[number];

const FACTOR_OFICINA: Record<Familia, number> = {
  conduit: 0.1,
  cable: 0.1,
  soporte: 0.05,
  dispositivo: 0,
  tablero: 0,
  herraje: 0.05,
  otro: 0.05,
};

const lineaSchema = z.object({
  partida: z.string().min(1),
  familia: z.enum(familias),
  cantidad: z.number().nonnegative(),
  unidad: z.enum(["ft", "ea", "m", "set"]),
  area: z.string().optional(),
  plano: z.string().optional(),
  spec: z.string().optional(),
});

const factoresSchema = z.object({
  conduit: z.number().min(0).max(1).optional(),
  cable: z.number().min(0).max(1).optional(),
  soporte: z.number().min(0).max(1).optional(),
  dispositivo: z.number().min(0).max(1).optional(),
  tablero: z.number().min(0).max(1).optional(),
  herraje: z.number().min(0).max(1).optional(),
  otro: z.number().min(0).max(1).optional(),
});

const inputSchema = z.object({
  proyectoId: z.string().min(1).optional(),
  factores: factoresSchema.optional(),
  lineas: z.array(lineaSchema).min(1),
});

type Linea = z.infer<typeof lineaSchema>;

type Grupo = {
  partida: string;
  familia: Familia;
  unidad: "ft" | "ea" | "m" | "set";
  spec: string | null;
  cantidadNeta: number;
  factorDesperdicio: number;
  cantidadCompra: number;
  areas: string[];
  planos: string[];
};

function factorDe(familia: Familia, factores: z.infer<typeof factoresSchema> | undefined): number {
  const override = factores?.[familia];
  return override === undefined ? FACTOR_OFICINA[familia] : override;
}

function compra(neta: number, factor: number): number {
  return Math.ceil(neta * (1 + factor) - 1e-9);
}

function limpiar(valor: string | undefined): string | null {
  if (valor === undefined) return null;
  const texto = valor.trim();
  return texto.length === 0 ? null : texto;
}

function clave(linea: Linea): string {
  return [
    linea.partida.trim().toLowerCase(),
    linea.familia,
    linea.unidad,
    limpiar(linea.spec)?.toLowerCase() ?? "",
  ].join("|");
}

export default defineTool({
  description: prompt`
    Calcula el buyout eléctrico a partir de conteos ya medidos.
    Úsala para cualquier cantidad de compra. No estimes desperdicio fuera de esta herramienta.
    Los factores de oficina, si no se pasan otros, son conduit 10%, cable 10%,
    soporte 5%, herraje 5%, otro 5%, dispositivo 0% y tablero 0%.
    No lee planos ni guarda nada.
  `,
  inputSchema,
  effect: "read",
  async execute({ proyectoId, factores, lineas }) {
    const grupos = new Map<string, Grupo>();

    for (const linea of lineas) {
      const id = clave(linea);
      const factor = factorDe(linea.familia, factores);
      const area = limpiar(linea.area);
      const plano = limpiar(linea.plano);
      const actual = grupos.get(id);
      if (actual === undefined) {
        grupos.set(id, {
          partida: linea.partida.trim(),
          familia: linea.familia,
          unidad: linea.unidad,
          spec: limpiar(linea.spec),
          cantidadNeta: linea.cantidad,
          factorDesperdicio: factor,
          cantidadCompra: compra(linea.cantidad, factor),
          areas: area === null ? [] : [area],
          planos: plano === null ? [] : [plano],
        });
        continue;
      }
      actual.cantidadNeta = Math.round((actual.cantidadNeta + linea.cantidad) * 10000) / 10000;
      actual.cantidadCompra = compra(actual.cantidadNeta, actual.factorDesperdicio);
      if (area !== null && !actual.areas.includes(area)) actual.areas.push(area);
      if (plano !== null && !actual.planos.includes(plano)) actual.planos.push(plano);
    }

    const lista = [...grupos.values()];
    const porFamilia = new Map<Familia, { familia: Familia; partidas: number; unidades: string[] }>();
    for (const grupo of lista) {
      const fila = porFamilia.get(grupo.familia) ?? {
        familia: grupo.familia,
        partidas: 0,
        unidades: [],
      };
      fila.partidas += 1;
      if (!fila.unidades.includes(grupo.unidad)) fila.unidades.push(grupo.unidad);
      porFamilia.set(grupo.familia, fila);
    }

    return {
      proyectoId: proyectoId ?? null,
      origen: "conteo_recibido",
      notaFactores:
        "Factores de oficina por defecto, salvo los que vengan en factores. No son un requisito de código.",
      grupos: lista,
      resumenFamilias: [...porFamilia.values()],
      precios: "pendientes",
    };
  },
});
