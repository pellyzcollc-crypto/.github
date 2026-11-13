// Lee un CSV, TSV o XML plano exportado de la Markups List de Revu.
// No abre Bluebeam y no calcula compra. Totales de grupo y el padre de un
// grupo salen de la lista de compra para no contar la misma medida dos veces.

type Unidad = "ft" | "m" | "ea";

type Rol =
  | "asunto"
  | "etiqueta"
  | "plano"
  | "pagina"
  | "comentario"
  | "autor"
  | "estado"
  | "capa"
  | "espacio"
  | "largo"
  | "unidadLargo"
  | "medida"
  | "conteo"
  | "cantidadLibre"
  | "area"
  | "volumen"
  | "unidad"
  | "id"
  | "padre"
  | "subida"
  | "ruido"
  | "extra";

type Medida =
  | { tipo: "lineal"; cantidad: number; unidad: "ft" | "m"; texto: string }
  | { tipo: "conteo"; cantidad: number; texto: string }
  | { tipo: "area"; cantidad: number | null; texto: string }
  | { tipo: "volumen"; cantidad: number | null; texto: string }
  | { tipo: "sin_unidad"; cantidad: number; texto: string };

type Fila = {
  indice: number;
  asunto: string | null;
  etiqueta: string | null;
  partida: string | null;
  plano: string | null;
  pagina: string | null;
  espacio: string | null;
  capa: string | null;
  comentario: string | null;
  autor: string | null;
  estado: string | null;
  idMarca: string | null;
  padre: string | null;
  subida: string | null;
  textoMedida: string | null;
  cantidadLeida: number | null;
  unidad: Unidad | null;
  conteo: number | null;
  entraEnCompra: boolean;
  motivo: string | null;
  extra: Record<string, string>;
};

type ParaRollup = {
  partida: string;
  cantidad: number;
  unidad: Unidad;
  area: string | null;
  plano: string | null;
};

export type ListaBluebeam = {
  reconocido: boolean;
  formato: "csv" | "tsv" | "xml" | null;
  motivo: string | null;
  nota: string;
  encabezados: string[];
  primeraFila: string[] | null;
  filas: Fila[];
  paraRollup: ParaRollup[];
  resumen: {
    filas: number;
    entranEnCompra: number;
    fuera: number;
    totalesOmitidos: number;
    gruposPadre: number;
  };
};

const NOTA =
  "Texto pegado por Pedro. Esta lectura no abre Bluebeam y no aplica desperdicio.";

const MAX_FILAS = 2000;
const MAX_EXTRA = 8;

const ROL: Record<string, Rol> = {
  subject: "asunto",
  asunto: "asunto",
  label: "etiqueta",
  etiqueta: "etiqueta",
  pagelabel: "plano",
  etiquetadepagina: "plano",
  sheet: "plano",
  sheetlabel: "plano",
  pageindex: "pagina",
  pagenumber: "pagina",
  pageno: "pagina",
  page: "pagina",
  pagina: "pagina",
  indicepagina: "pagina",
  comments: "comentario",
  comment: "comentario",
  comentarios: "comentario",
  comentario: "comentario",
  author: "autor",
  autor: "autor",
  status: "estado",
  estado: "estado",
  layer: "capa",
  capa: "capa",
  space: "espacio",
  espacio: "espacio",
  length: "largo",
  largo: "largo",
  longitud: "largo",
  lengthunit: "unidadLargo",
  unidadlargo: "unidadLargo",
  unidaddelongitud: "unidadLargo",
  measurement: "medida",
  medida: "medida",
  medicion: "medida",
  count: "conteo",
  conteo: "conteo",
  recuento: "conteo",
  quantity: "cantidadLibre",
  qty: "cantidadLibre",
  cantidad: "cantidadLibre",
  area: "area",
  volume: "volumen",
  volumen: "volumen",
  unit: "unidad",
  unidad: "unidad",
  units: "unidad",
  id: "id",
  markupid: "id",
  parent: "padre",
  padre: "padre",
  parentid: "padre",
  risedrop: "subida",
  rise: "subida",
  drop: "subida",
  subida: "subida",
  bajada: "subida",
};

const RUIDO = new Set([
  "color",
  "date",
  "creationdate",
  "fecha",
  "fechacreacion",
  "lock",
  "bloqueo",
  "checkmark",
  "check",
  "capture",
  "sequence",
  "secuencia",
  "x",
  "y",
  "xcenter",
  "ycenter",
  "documentwidth",
  "documentheight",
  "wallarea",
  "height",
  "width",
  "depth",
  "alto",
  "ancho",
  "profundidad",
  "slope",
  "pendiente",
  "legend",
  "leyenda",
  "view",
  "3dview",
]);

const HERRAMIENTAS = new Set([
  "length",
  "polylength",
  "polyline",
  "line",
  "dimension",
  "arc",
  "area",
  "volume",
  "count",
  "counter",
  "cloud",
  "cloudplus",
  "rectangle",
  "ellipse",
  "polygon",
  "pen",
  "highlighter",
  "highlight",
  "text",
  "callout",
  "note",
  "typewriter",
  "stamp",
  "image",
  "snapshot",
  "group",
  "caret",
  "underline",
  "squiggle",
  "arrow",
  "flag",
  "sketch",
  "square",
  "circle",
  "medida",
  "medicion",
  "longitud",
  "polilongitud",
  "conteo",
  "recuento",
  "nube",
  "rectangulo",
  "elipse",
  "poligono",
  "polilinea",
  "texto",
  "nota",
  "sello",
  "grupo",
  "flecha",
  "resaltador",
  "linea",
]);

const ROLES_DE_MEDIDA: Rol[] = ["asunto", "largo", "medida", "conteo", "area", "cantidadLibre"];

function norm(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function limpiar(valor: string | undefined): string | null {
  if (valor === undefined) return null;
  const texto = valor.trim();
  return texto.length === 0 ? null : texto;
}

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000;
}

function vacio(): ListaBluebeam {
  return {
    reconocido: false,
    formato: null,
    motivo: "vacio",
    nota: NOTA,
    encabezados: [],
    primeraFila: null,
    filas: [],
    paraRollup: [],
    resumen: { filas: 0, entranEnCompra: 0, fuera: 0, totalesOmitidos: 0, gruposPadre: 0 },
  };
}

function cerrar(
  parcial: Omit<ListaBluebeam, "filas" | "paraRollup" | "resumen">,
  filas: Fila[],
): ListaBluebeam {
  const paraRollup: ParaRollup[] = [];
  let totalesOmitidos = 0;
  let gruposPadre = 0;
  for (const fila of filas) {
    if (fila.motivo === "total_de_grupo") totalesOmitidos += 1;
    if (fila.motivo === "grupo_padre") gruposPadre += 1;
    if (!fila.entraEnCompra || fila.partida === null || fila.unidad === null || fila.cantidadLeida === null) {
      continue;
    }
    paraRollup.push({
      partida: fila.partida,
      cantidad: fila.cantidadLeida,
      unidad: fila.unidad,
      area: fila.espacio,
      plano: fila.plano,
    });
  }
  return {
    ...parcial,
    filas,
    paraRollup,
    resumen: {
      filas: filas.length,
      entranEnCompra: paraRollup.length,
      fuera: filas.length - paraRollup.length,
      totalesOmitidos,
      gruposPadre,
    },
  };
}

function rolDe(header: string): Rol {
  const clave = norm(header);
  if (clave.length === 0) return "ruido";
  const conocido = ROL[clave];
  if (conocido !== undefined) return conocido;
  if (RUIDO.has(clave)) return "ruido";
  return "extra";
}

function esHerramienta(asunto: string | null): boolean {
  if (asunto === null) return false;
  return HERRAMIENTAS.has(norm(asunto));
}

function esTotalNombrado(asunto: string | null, etiqueta: string | null): boolean {
  return [asunto, etiqueta].some(
    (valor) => valor !== null && /^(grand total|subtotal|total|totales|subtotales)$/i.test(valor.trim()),
  );
}

function fraccion(texto: string): number | null {
  const mixto = texto.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixto !== null) {
    const denominador = Number(mixto[3]);
    if (denominador === 0) return null;
    return Number(mixto[1]) + Number(mixto[2]) / denominador;
  }
  const simple = texto.match(/^(\d+)\/(\d+)$/);
  if (simple !== null) {
    const denominador = Number(simple[2]);
    if (denominador === 0) return null;
    return Number(simple[1]) / denominador;
  }
  if (!/^\d+(?:\.\d+)?$/.test(texto)) return null;
  return Number(texto);
}

function numeroInicial(texto: string): number | null {
  const match = texto.match(/^(\d+(?:\.\d+)?)/);
  if (match === null) return null;
  return Number(match[1]);
}

type Clase = "ft" | "ftin" | "in" | "m" | "mm" | "ea" | "area" | "volumen";

function claseDeHint(hint: string | null): Clase | null {
  if (hint === null) return null;
  const clave = norm(hint);
  if (clave.length === 0) return null;
  if (clave.includes("sqft") || clave.includes("squarefeet") || clave === "sf" || clave.includes("sqm") || clave === "m2") {
    return "area";
  }
  if (clave.includes("cuft") || clave.includes("cubic") || clave === "cf" || clave === "m3") return "volumen";
  if (clave.includes("ftin") || clave.includes("feetinch") || clave.includes("architectural")) return "ftin";
  if (clave === "ft" || clave === "feet" || clave === "foot" || clave === "lf" || clave === "linearft") return "ft";
  if (clave === "in" || clave === "inch" || clave === "inches" || clave === "pulg" || clave === "pulgadas") return "in";
  if (clave === "m" || clave === "meter" || clave === "meters" || clave === "metre" || clave === "metres" || clave === "metro" || clave === "metros") {
    return "m";
  }
  if (clave === "mm" || clave.startsWith("milimet")) return "mm";
  if (clave === "ea" || clave === "each") return "ea";
  return null;
}

function claseEnTexto(texto: string): "area" | "volumen" | "ea" | null {
  const clave = norm(texto);
  if (!/\d/.test(clave)) return null;
  if (clave.includes("sqft") || clave.includes("sqm") || clave.includes("m2") || /(?:^|\d)sf$/.test(clave)) return "area";
  if (clave.includes("cuft") || clave.includes("cubic") || clave.includes("m3") || /(?:^|\d)cf$/.test(clave)) return "volumen";
  if (/(?:ea|each)$/.test(clave)) return "ea";
  return null;
}

function lineal(cantidad: number, unidad: "ft" | "m", texto: string): Medida {
  return { tipo: "lineal", cantidad: redondear(cantidad), unidad, texto };
}

function aplicarHint(cantidad: number, hint: Clase | null, texto: string): Medida {
  if (hint === "ft" || hint === "ftin") return lineal(cantidad, "ft", texto);
  if (hint === "in") return lineal(cantidad / 12, "ft", texto);
  if (hint === "m") return lineal(cantidad, "m", texto);
  if (hint === "mm") return lineal(cantidad / 1000, "m", texto);
  if (hint === "ea") return { tipo: "conteo", cantidad: redondear(cantidad), texto };
  if (hint === "area") return { tipo: "area", cantidad: redondear(cantidad), texto };
  if (hint === "volumen") return { tipo: "volumen", cantidad: redondear(cantidad), texto };
  return { tipo: "sin_unidad", cantidad: redondear(cantidad), texto };
}

function normalizarNumero(token: string): string {
  const ultimaComa = token.lastIndexOf(",");
  const ultimoPunto = token.lastIndexOf(".");
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    if (ultimaComa > ultimoPunto) return token.replace(/\./g, "").replace(",", ".");
    return token.replace(/,/g, "");
  }
  if (ultimaComa >= 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(token)) return token.replace(/,/g, "");
    if (/^\d+,\d{1,2}$/.test(token)) return token.replace(",", ".");
    return token.replace(/,/g, "");
  }
  return token;
}

function parseCelda(raw: string | undefined, hint: string | null): Medida | null {
  if (raw === undefined) return null;
  const original = raw.trim();
  if (original.length === 0) return null;
  const texto = original
    .replace(/\d[\d.,]*/g, (token) => normalizarNumero(token))
    .replace(/\s+/g, " ")
    .trim();
  const clase = claseEnTexto(texto);
  if (clase === "area") return { tipo: "area", cantidad: numeroInicial(texto), texto: original };
  if (clase === "volumen") return { tipo: "volumen", cantidad: numeroInicial(texto), texto: original };
  if (clase === "ea") {
    const cantidad = numeroInicial(texto);
    if (cantidad === null) return null;
    return { tipo: "conteo", cantidad: redondear(cantidad), texto: original };
  }

  const pies = texto.match(/^(\d+(?:\.\d+)?)\s*(?:feet|foot|lf|ft|')(?![a-z])\s*(?:-\s*)?(.*)$/i);
  if (pies !== null) {
    const resto = (pies[2] ?? "").trim();
    if (resto.length === 0) return lineal(Number(pies[1]), "ft", original);
    const pulgadas = fraccion(resto.replace(/(?:"|''|inches|inch|in)$/i, "").trim());
    if (pulgadas !== null) return lineal(Number(pies[1]) + pulgadas / 12, "ft", original);
  }

  if (/(?:"|inches|inch|in)$/i.test(texto) && !/[']|feet|foot|\bft\b|\blf\b/i.test(texto)) {
    const pulgadas = fraccion(texto.replace(/(?:"|inches|inch|in)$/i, "").trim());
    if (pulgadas !== null) return lineal(pulgadas / 12, "ft", original);
  }

  const metros = texto.match(/^(\d+(?:\.\d+)?)\s*(mm|millimeters?|milimetros?|meters?|metres?|metros?|m)$/i);
  if (metros !== null) {
    const cantidad = Number(metros[1]);
    const unidadTxt = metros[2].toLowerCase();
    if (unidadTxt === "m" || unidadTxt.startsWith("meter") || unidadTxt.startsWith("metre") || unidadTxt.startsWith("metro")) {
      return lineal(cantidad, "m", original);
    }
    return lineal(cantidad / 1000, "m", original);
  }

  if (/^\d+(?:\.\d+)?$/.test(texto)) return aplicarHint(Number(texto), claseDeHint(hint), original);
  return null;
}

function cerca(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.02;
}

function claveFila(fila: Fila): string {
  return (fila.partida ?? fila.asunto ?? "").trim().toLowerCase();
}

function tienePagina(fila: Fila): boolean {
  return fila.plano !== null || fila.pagina !== null;
}

function enBlanco(fila: Fila): boolean {
  return fila.etiqueta === null && fila.comentario === null && fila.espacio === null && fila.autor === null && fila.capa === null;
}

function marcarTotales(filas: Fila[]) {
  const grupos = new Map<string, Fila[]>();
  for (const fila of filas) {
    if (fila.motivo === "respuesta" || fila.motivo === "total_de_grupo") continue;
    const clave = claveFila(fila);
    if (clave.length === 0 || fila.cantidadLeida === null || fila.unidad === null) continue;
    const lista = grupos.get(clave) ?? [];
    lista.push(fila);
    grupos.set(clave, lista);
  }
  for (const lista of grupos.values()) {
    for (const candidata of lista) {
      if (tienePagina(candidata) || candidata.padre !== null) continue;
      const detalles = lista.filter(
        (fila) => fila !== candidata && tienePagina(fila) && fila.unidad === candidata.unidad,
      );
      if (detalles.length === 0) continue;
      const suma = redondear(detalles.reduce((total, fila) => total + (fila.cantidadLeida ?? 0), 0));
      if (!cerca(candidata.cantidadLeida ?? 0, suma)) continue;
      if (detalles.length === 1 && !enBlanco(candidata)) continue;
      candidata.motivo = "total_de_grupo";
      candidata.entraEnCompra = false;
    }
  }
}

function marcarPadres(filas: Fila[]) {
  const porId = new Map<string, Fila>();
  for (const fila of filas) {
    if (fila.idMarca !== null) porId.set(fila.idMarca, fila);
  }
  const hijos = new Map<string, Fila[]>();
  for (const fila of filas) {
    if (fila.padre === null) continue;
    const lista = hijos.get(fila.padre) ?? [];
    lista.push(fila);
    hijos.set(fila.padre, lista);
  }
  for (const [id, lista] of hijos) {
    const padre = porId.get(id);
    if (padre === undefined || padre.cantidadLeida === null || padre.unidad === null) continue;
    if (padre.motivo === "total_de_grupo") continue;
    const medidos = lista.filter(
      (fila) => fila.unidad === padre.unidad && fila.cantidadLeida !== null && fila.motivo !== "total_de_grupo",
    );
    if (medidos.length === 0) continue;
    const suma = redondear(medidos.reduce((total, fila) => total + (fila.cantidadLeida ?? 0), 0));
    if (!cerca(padre.cantidadLeida, suma)) continue;
    padre.motivo = "grupo_padre";
    padre.entraEnCompra = false;
  }
}

function filaDesde(celdas: string[], headers: string[], roles: Rol[], indice: number): Fila | null {
  const tomar = (rol: Rol) => {
    const i = roles.indexOf(rol);
    return i < 0 ? "" : (celdas[i] ?? "");
  };
  const asunto = limpiar(tomar("asunto"));
  const etiqueta = limpiar(tomar("etiqueta"));
  const herramienta = esHerramienta(asunto);
  const partida = etiqueta ?? (herramienta ? null : asunto);
  const extra: Record<string, string> = {};
  headers.forEach((header, i) => {
    if (roles[i] !== "extra") return;
    if (Object.keys(extra).length >= MAX_EXTRA) return;
    const valor = limpiar(celdas[i]);
    if (valor === null) return;
    extra[header.trim()] = valor.slice(0, 500);
  });

  const hintUnidad = limpiar(tomar("unidad"));
  const hintLargo = limpiar(tomar("unidadLargo")) ?? hintUnidad;
  const largo = parseCelda(tomar("largo"), hintLargo);
  const medida = parseCelda(tomar("medida"), hintUnidad);
  const conteoCelda = parseCelda(tomar("conteo"), "ea");
  const libre = parseCelda(tomar("cantidadLibre"), hintUnidad);
  const area = parseCelda(tomar("area"), "sq ft");
  const volumen = parseCelda(tomar("volumen"), "cu ft");
  const conteo =
    conteoCelda?.tipo === "conteo" && conteoCelda.cantidad > 0
      ? conteoCelda.cantidad
      : conteoCelda?.tipo === "sin_unidad" && conteoCelda.cantidad > 0
        ? conteoCelda.cantidad
        : null;

  let cantidadLeida: number | null = null;
  let unidad: Unidad | null = null;
  let textoMedida: string | null = null;
  let motivo: string | null = null;
  let conteoInformativo: number | null = null;

  const linealElegido =
    largo?.tipo === "lineal"
      ? largo
      : medida?.tipo === "lineal"
        ? medida
        : largo === null && (medida === null || medida.tipo === "area" || medida.tipo === "volumen") && libre?.tipo === "lineal"
          ? libre
          : null;

  if (linealElegido !== null) {
    cantidadLeida = linealElegido.cantidad;
    unidad = linealElegido.unidad;
    textoMedida = linealElegido.texto;
    conteoInformativo = conteo !== null && conteo > 1 ? conteo : null;
  } else if (largo?.tipo === "sin_unidad") {
    cantidadLeida = largo.cantidad;
    textoMedida = largo.texto;
    motivo = "unidad_ausente";
  } else if (conteo !== null) {
    cantidadLeida = conteo;
    unidad = "ea";
    textoMedida = tomar("conteo").trim();
  } else if (medida?.tipo === "conteo") {
    cantidadLeida = medida.cantidad;
    unidad = "ea";
    textoMedida = medida.texto;
  } else if (libre?.tipo === "conteo") {
    cantidadLeida = libre.cantidad;
    unidad = "ea";
    textoMedida = libre.texto;
  } else if (medida?.tipo === "sin_unidad") {
    cantidadLeida = medida.cantidad;
    textoMedida = medida.texto;
    motivo = "unidad_ausente";
  } else if (libre?.tipo === "sin_unidad") {
    cantidadLeida = libre.cantidad;
    textoMedida = libre.texto;
    motivo = "unidad_ausente";
  } else if (area !== null || largo?.tipo === "area" || medida?.tipo === "area") {
    const origen = area ?? (largo?.tipo === "area" ? largo : medida?.tipo === "area" ? medida : null);
    cantidadLeida = origen?.cantidad ?? null;
    textoMedida = origen?.texto ?? limpiar(tomar("area"));
    motivo = "area_no_entra";
  } else if (volumen !== null || largo?.tipo === "volumen" || medida?.tipo === "volumen") {
    const origen = volumen ?? (largo?.tipo === "volumen" ? largo : medida?.tipo === "volumen" ? medida : null);
    cantidadLeida = origen?.cantidad ?? null;
    textoMedida = origen?.texto ?? limpiar(tomar("volumen"));
    motivo = "volumen_no_entra";
  } else {
    motivo = "sin_medida";
  }

  if (motivo === "sin_medida") {
    const texto = `${asunto ?? ""} ${limpiar(tomar("comentario")) ?? ""}`;
    const clave = norm(asunto ?? "");
    if (clave === "cloud" || clave === "cloudplus" || clave === "nube" || /homerun|home run|feeder/i.test(texto)) {
      motivo = "nube_sin_largo";
    }
  }

  if (cantidadLeida !== null && partida === null && herramienta && motivo === null) {
    motivo = "asunto_es_herramienta";
  }

  if (esTotalNombrado(asunto, etiqueta)) motivo = "total_de_grupo";

  const comentario = limpiar(tomar("comentario"));
  const vacia =
    asunto === null &&
    etiqueta === null &&
    cantidadLeida === null &&
    comentario === null &&
    Object.keys(extra).length === 0;
  if (vacia) return null;

  if (motivo === "sin_medida" && asunto === null && etiqueta === null && comentario !== null) {
    motivo = "respuesta";
  }

  const entraEnCompra = motivo === null && partida !== null && unidad !== null && cantidadLeida !== null && cantidadLeida > 0;

  return {
    indice,
    asunto,
    etiqueta,
    partida,
    plano: limpiar(tomar("plano")),
    pagina: limpiar(tomar("pagina")),
    espacio: limpiar(tomar("espacio")),
    capa: limpiar(tomar("capa")),
    comentario: comentario === null ? null : comentario.slice(0, 500),
    autor: limpiar(tomar("autor")),
    estado: limpiar(tomar("estado")),
    idMarca: limpiar(tomar("id")),
    padre: limpiar(tomar("padre")),
    subida: limpiar(tomar("subida")),
    textoMedida,
    cantidadLeida,
    unidad,
    conteo: conteoInformativo,
    entraEnCompra,
    motivo,
    extra,
  };
}

function armar(headers: string[], datos: string[][]): Fila[] {
  const roles = rolesDe(headers, datos);
  const filas: Fila[] = [];
  for (const celdas of datos) {
    if (celdas.every((celda) => celda.trim().length === 0)) continue;
    if (celdas.join("|").toLowerCase() === headers.join("|").toLowerCase()) continue;
    const fila = filaDesde(celdas, headers, roles, filas.length + 1);
    if (fila === null) continue;
    filas.push(fila);
    if (filas.length > MAX_FILAS) break;
  }
  marcarTotales(filas);
  marcarPadres(filas);
  return filas;
}

function rolesDe(headers: string[], datos: string[][]): Rol[] {
  const usados = new Set<Rol>();
  const roles = headers.map((header) => {
    let rol = rolDe(header);
    if (rol !== "ruido" && rol !== "extra" && usados.has(rol)) rol = "extra";
    if (rol !== "ruido" && rol !== "extra") usados.add(rol);
    return rol;
  });
  const iPagina = roles.indexOf("pagina");
  if (iPagina >= 0 && (norm(headers[iPagina] ?? "") === "page" || norm(headers[iPagina] ?? "") === "pagina")) {
    const hayLetra = datos.some((fila) => /[A-Za-z]/.test(fila[iPagina] ?? ""));
    if (hayLetra && !usados.has("plano")) roles[iPagina] = "plano";
  }
  return roles;
}

function pareceEncabezado(fila: string[]): boolean {
  const roles = new Set(fila.map((celda) => rolDe(celda)));
  return ROLES_DE_MEDIDA.some((rol) => roles.has(rol));
}

function detectarDelim(texto: string): "\t" | ";" | "," {
  let coma = 0;
  let tab = 0;
  let puntoYComa = 0;
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (enComillas) {
        if (texto[i + 1] === '"') {
          i += 1;
          continue;
        }
        enComillas = false;
        continue;
      }
      const previo = i === 0 ? "\n" : texto[i - 1];
      if (previo === "," || previo === ";" || previo === "\t" || previo === "\n" || previo === "\r") {
        enComillas = true;
      }
      continue;
    }
    if (enComillas) continue;
    if (c === ",") coma += 1;
    else if (c === "\t") tab += 1;
    else if (c === ";") puntoYComa += 1;
  }
  if (tab > 0 && tab >= coma && tab >= puntoYComa) return "\t";
  if (puntoYComa > coma) return ";";
  return ",";
}

function parseDelimited(texto: string, delim: string): string[][] {
  const filas: string[][] = [];
  let celda = "";
  let fila: string[] = [];
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          celda += '"';
          i += 1;
        } else {
          enComillas = false;
        }
      } else {
        celda += c;
      }
      continue;
    }
    if (c === '"') {
      // A quote at the start of a cell opens a CSV field. A quote after a
      // digit is the inch mark Revu writes in 20'-6".
      if (celda.length === 0) {
        enComillas = true;
        continue;
      }
      celda += '"';
      continue;
    }
    if (c === delim) {
      fila.push(celda.trim());
      celda = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i += 1;
      fila.push(celda.trim());
      celda = "";
      if (fila.some((valor) => valor.length > 0)) filas.push(fila);
      fila = [];
      continue;
    }
    celda += c;
  }
  if (celda.length > 0 || fila.length > 0) {
    fila.push(celda.trim());
    if (fila.some((valor) => valor.length > 0)) filas.push(fila);
  }
  return filas;
}

function leerTabla(texto: string, formato: "csv" | "tsv"): ListaBluebeam {
  const delim = detectarDelim(texto);
  const tabla = parseDelimited(texto, delim).map((fila) => fila.slice(0, 80));
  const formatoReal = delim === "\t" ? "tsv" : formato;
  const indice = tabla.findIndex((fila) => pareceEncabezado(fila));
  if (indice < 0) {
    return cerrar(
      {
        reconocido: false,
        formato: formatoReal,
        motivo: "sin_encabezado",
        nota: NOTA,
        encabezados: [],
        primeraFila: tabla[0]?.slice(0, 12) ?? null,
      },
      [],
    );
  }
  const headers = tabla[indice] ?? [];
  const datos = tabla.slice(indice + 1);
  if (datos.length > MAX_FILAS) {
    return cerrar(
      {
        reconocido: false,
        formato: formatoReal,
        motivo: "demasiado_filas",
        nota: NOTA,
        encabezados: headers,
        primeraFila: null,
      },
      [],
    );
  }
  const filas = armar(headers, datos);
  return cerrar(
    {
      reconocido: true,
      formato: formatoReal,
      motivo: filas.length === 0 ? "sin_filas" : null,
      nota: NOTA,
      encabezados: headers.filter((header) => header.length > 0),
      primeraFila: null,
    },
    filas,
  );
}

type Nodo = {
  nombre: string;
  atributos: Record<string, string>;
  texto: string;
  hijos: Nodo[];
};

function decodificar(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function nombreLocal(nombre: string): string {
  const i = nombre.lastIndexOf(":");
  return i >= 0 ? nombre.slice(i + 1) : nombre;
}

function parseXml(texto: string): Nodo | null {
  const raiz: Nodo = { nombre: "#root", atributos: {}, texto: "", hijos: [] };
  const pila: Nodo[] = [raiz];
  let i = 0;
  while (i < texto.length) {
    const lt = texto.indexOf("<", i);
    if (lt < 0) {
      pila[pila.length - 1].texto += decodificar(texto.slice(i));
      break;
    }
    if (lt > i) pila[pila.length - 1].texto += decodificar(texto.slice(i, lt));
    if (texto.startsWith("<!--", lt)) {
      const fin = texto.indexOf("-->", lt + 4);
      if (fin < 0) return null;
      i = fin + 3;
      continue;
    }
    if (texto.startsWith("<?", lt) || texto.startsWith("<!", lt)) {
      const fin = texto.indexOf(">", lt + 2);
      if (fin < 0) return null;
      i = fin + 1;
      continue;
    }
    const fin = texto.indexOf(">", lt + 1);
    if (fin < 0) return null;
    const crudo = texto.slice(lt + 1, fin).trim();
    i = fin + 1;
    if (crudo.startsWith("/")) {
      const nombre = nombreLocal(crudo.slice(1).trim());
      if (pila.length > 1 && pila[pila.length - 1].nombre === nombre) pila.pop();
      continue;
    }
    const autocierre = crudo.endsWith("/");
    const cuerpo = autocierre ? crudo.slice(0, -1).trim() : crudo;
    const espacio = cuerpo.search(/\s/);
    const nombre = nombreLocal(espacio < 0 ? cuerpo : cuerpo.slice(0, espacio));
    const atributos: Record<string, string> = {};
    const attrTexto = espacio < 0 ? "" : cuerpo.slice(espacio);
    for (const match of attrTexto.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      atributos[nombreLocal(match[1])] = decodificar(match[3] ?? match[4] ?? "");
    }
    const nodo: Nodo = { nombre, atributos, texto: "", hijos: [] };
    pila[pila.length - 1].hijos.push(nodo);
    if (!autocierre && nombre.length > 0) pila.push(nodo);
  }
  return raiz;
}

function textoNodo(nodo: Nodo): string {
  const propio = nodo.texto.trim();
  if (propio.length > 0) return propio;
  return nodo.hijos
    .map((hijo) => textoNodo(hijo))
    .filter((texto) => texto.length > 0)
    .join(" ")
    .trim();
}

function registrosXml(raiz: Nodo): { headers: string[]; datos: string[][] } | null {
  const grupos = new Map<string, Nodo[]>();
  const visitar = (nodo: Nodo) => {
    if (nodo.hijos.length > 0 || Object.keys(nodo.atributos).length > 0) {
      const lista = grupos.get(nodo.nombre) ?? [];
      lista.push(nodo);
      grupos.set(nodo.nombre, lista);
    }
    for (const hijo of nodo.hijos) visitar(hijo);
  };
  for (const hijo of raiz.hijos) visitar(hijo);
  let mejor: Nodo[] | null = null;
  for (const lista of grupos.values()) {
    const nombres = camposDe(lista[0]);
    if (!pareceEncabezado(nombres)) continue;
    if (mejor === null || lista.length > mejor.length) mejor = lista;
  }
  if (mejor === null || mejor.length === 0) return null;
  const headers: string[] = [];
  for (const nodo of mejor) {
    for (const nombre of camposDe(nodo)) {
      if (!headers.includes(nombre)) headers.push(nombre);
    }
  }
  const datos = mejor.map((nodo) => headers.map((header) => valorCampo(nodo, header)));
  return { headers, datos };
}

function camposDe(nodo: Nodo | undefined): string[] {
  if (nodo === undefined) return [];
  const nombres = Object.keys(nodo.atributos);
  for (const hijo of nodo.hijos) {
    if (!nombres.includes(hijo.nombre)) nombres.push(hijo.nombre);
  }
  return nombres;
}

function valorCampo(nodo: Nodo, nombre: string): string {
  if (nodo.atributos[nombre] !== undefined) return nodo.atributos[nombre];
  const hijo = nodo.hijos.find((item) => item.nombre === nombre);
  return hijo === undefined ? "" : textoNodo(hijo);
}

function leerXml(texto: string): ListaBluebeam | null {
  if (!texto.trimStart().startsWith("<")) return null;
  const raiz = parseXml(texto);
  if (raiz === null) {
    return cerrar(
      {
        reconocido: false,
        formato: "xml",
        motivo: "sin_encabezado",
        nota: NOTA,
        encabezados: [],
        primeraFila: null,
      },
      [],
    );
  }
  const tabla = registrosXml(raiz);
  if (tabla === null) {
    return cerrar(
      {
        reconocido: false,
        formato: "xml",
        motivo: "sin_encabezado",
        nota: NOTA,
        encabezados: [],
        primeraFila: null,
      },
      [],
    );
  }
  if (tabla.datos.length > MAX_FILAS) {
    return cerrar(
      {
        reconocido: false,
        formato: "xml",
        motivo: "demasiado_filas",
        nota: NOTA,
        encabezados: tabla.headers,
        primeraFila: null,
      },
      [],
    );
  }
  const filas = armar(tabla.headers, tabla.datos);
  return cerrar(
    {
      reconocido: true,
      formato: "xml",
      motivo: filas.length === 0 ? "sin_filas" : null,
      nota: NOTA,
      encabezados: tabla.headers,
      primeraFila: null,
    },
    filas,
  );
}

export function leerListaBluebeam(texto: string): ListaBluebeam {
  const limpio = texto.replace(/^\uFEFF/, "").trim();
  if (limpio.length === 0) return vacio();
  const xml = leerXml(limpio);
  if (xml !== null) return xml;
  return leerTabla(limpio, "csv");
}
