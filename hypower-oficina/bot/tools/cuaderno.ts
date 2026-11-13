import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

const idSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,64}$/);

const proyectoSchema = z.object({
  id: idSchema,
  nombre: z.string().min(1),
  gc: z.string().optional(),
  fase: z.string().optional(),
  ubicacion: z.string().optional(),
});

const circuitoSchema = z.object({
  id: idSchema,
  proyectoId: idSchema,
  tipo: z.enum(["homerun", "feeder"]),
  desde: z.string().min(1),
  hasta: z.string().min(1),
  descripcion: z.string().optional(),
  panel: z.string().optional(),
  circuito: z.string().optional(),
  voltaje: z.string().optional(),
  polos: z.string().optional(),
  amperaje: z.string().optional(),
  conduit: z.string().optional(),
  conductores: z.string().optional(),
  largoFt: z.number().nonnegative().optional(),
  area: z.string().optional(),
  plano: z.string().optional(),
  estado: z.enum(["layout", "contado", "pedido", "instalado"]).optional(),
  notas: z.string().optional(),
});

const grupoSchema = z.object({
  partida: z.string().min(1),
  familia: z.string().min(1),
  unidad: z.string().min(1),
  spec: z.string().nullable().optional(),
  cantidadNeta: z.number().nonnegative(),
  factorDesperdicio: z.number().min(0).max(1),
  cantidadCompra: z.number().nonnegative(),
  areas: z.array(z.string()),
  planos: z.array(z.string()),
});

const inputSchema = z.discriminatedUnion("operacion", [
  z.object({
    operacion: z.literal("guardar_proyecto"),
    proyecto: proyectoSchema,
  }),
  z.object({
    operacion: z.literal("leer"),
    proyectoId: idSchema.optional(),
  }),
  z.object({
    operacion: z.literal("upsert_circuito"),
    circuito: circuitoSchema,
  }),
  z.object({
    operacion: z.literal("listar_circuitos"),
    proyectoId: idSchema,
    tipo: z.enum(["homerun", "feeder"]).optional(),
  }),
  z.object({
    operacion: z.literal("guardar_buyout"),
    proyectoId: idSchema,
    grupos: z.array(grupoSchema).min(1),
    nota: z.string().optional(),
  }),
  z.object({
    operacion: z.literal("leer_buyout"),
    proyectoId: idSchema,
  }),
]);

type Proyecto = z.infer<typeof proyectoSchema>;
type Circuito = z.infer<typeof circuitoSchema>;
type Grupo = z.infer<typeof grupoSchema>;

function claveActivo(): string {
  return "oficina:activo";
}

function claveProyecto(id: string): string {
  return `oficina:proyecto:${id}`;
}

function claveCircuitos(proyectoId: string): string {
  return `oficina:circuitos:${proyectoId}`;
}

function claveCircuito(proyectoId: string, circuitoId: string): string {
  return `oficina:circuito:${proyectoId}:${circuitoId}`;
}

function claveBuyout(proyectoId: string): string {
  return `oficina:buyout:${proyectoId}`;
}

function sinVacios(valor: unknown) {
  return JSON.parse(JSON.stringify(valor));
}

function leerProyecto(valor: unknown): Proyecto | null {
  const parsed = proyectoSchema.safeParse(valor);
  return parsed.success ? parsed.data : null;
}

function leerIds(valor: unknown): string[] | null {
  const parsed = z.array(idSchema).safeParse(valor);
  return parsed.success ? parsed.data : null;
}

export default defineTool({
  description: prompt`
    Cuaderno del trabajo de Hypower. Guarda y lee el proyecto activo,
    filas de homerun o feeder, y el último buyout.
    Misma operación y mismos datos no cambian el resultado.
    No envía correo, no escribe en Smartsheet y no marca un precio como asegurado.
    Llama leer antes de asumir el proyecto activo.
  `,
  inputSchema,
  effect: "idempotent",
  async execute(input, ctx) {
    const kv = ctx.host.kv;

    if (input.operacion === "guardar_proyecto") {
      const proyecto = input.proyecto;
      await kv.put(claveProyecto(proyecto.id), sinVacios(proyecto));
      await kv.put(claveActivo(), proyecto.id);
      return { operacion: "guardar_proyecto" as const, activo: proyecto.id, proyecto };
    }

    if (input.operacion === "leer") {
      const activoValor = await kv.get(claveActivo());
      const activo = typeof activoValor === "string" ? activoValor : null;
      const proyectoId = input.proyectoId ?? activo;
      if (proyectoId === null) {
        return {
          operacion: "leer" as const,
          activo: null,
          proyecto: null,
          circuitos: 0,
          buyoutGuardado: false,
        };
      }
      const proyecto = leerProyecto(await kv.get(claveProyecto(proyectoId)));
      const ids = leerIds(await kv.get(claveCircuitos(proyectoId))) ?? [];
      const buyout = await kv.get(claveBuyout(proyectoId));
      return {
        operacion: "leer" as const,
        activo,
        proyecto,
        circuitos: ids.length,
        buyoutGuardado: buyout !== undefined,
      };
    }

    if (input.operacion === "upsert_circuito") {
      const circuito: Circuito = input.circuito;
      const proyecto = leerProyecto(await kv.get(claveProyecto(circuito.proyectoId)));
      if (proyecto === null) {
        return {
          operacion: "upsert_circuito" as const,
          guardado: false,
          motivo: "proyecto_ausente" as const,
          proyectoId: circuito.proyectoId,
        };
      }
      await kv.put(claveCircuito(circuito.proyectoId, circuito.id), sinVacios(circuito));
      const ids = leerIds(await kv.get(claveCircuitos(circuito.proyectoId))) ?? [];
      if (!ids.includes(circuito.id)) {
        ids.push(circuito.id);
        await kv.put(claveCircuitos(circuito.proyectoId), ids);
      }
      return { operacion: "upsert_circuito" as const, guardado: true, circuito };
    }

    if (input.operacion === "listar_circuitos") {
      const ids = leerIds(await kv.get(claveCircuitos(input.proyectoId)));
      if (ids === null) {
        return {
          operacion: "listar_circuitos" as const,
          proyectoId: input.proyectoId,
          filas: [] as Circuito[],
        };
      }
      const filas: Circuito[] = [];
      for (const circuitoId of ids) {
        const parsed = circuitoSchema.safeParse(
          await kv.get(claveCircuito(input.proyectoId, circuitoId)),
        );
        if (!parsed.success) continue;
        if (input.tipo !== undefined && parsed.data.tipo !== input.tipo) continue;
        filas.push(parsed.data);
      }
      return {
        operacion: "listar_circuitos" as const,
        proyectoId: input.proyectoId,
        filas,
      };
    }

    if (input.operacion === "guardar_buyout") {
      const proyecto = leerProyecto(await kv.get(claveProyecto(input.proyectoId)));
      if (proyecto === null) {
        return {
          operacion: "guardar_buyout" as const,
          guardado: false,
          motivo: "proyecto_ausente" as const,
          proyectoId: input.proyectoId,
        };
      }
      const buyout = {
        proyectoId: input.proyectoId,
        grupos: input.grupos,
        nota: input.nota ?? null,
        precios: "pendientes" as const,
      };
      await kv.put(claveBuyout(input.proyectoId), sinVacios(buyout));
      return { operacion: "guardar_buyout" as const, guardado: true, buyout };
    }

    const buyout = await kv.get(claveBuyout(input.proyectoId));
    return {
      operacion: "leer_buyout" as const,
      proyectoId: input.proyectoId,
      buyout: buyout ?? null,
    };
  },
});
