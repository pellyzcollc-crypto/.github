---
description: Use when Pedro pastes a Bluebeam Revu Markups List (CSV, TSV, or XML summary) from a layout takeoff. Read it with the bluebeam tool before any buy quantity.
---

# Lista de marcas de Bluebeam

Revu no está conectado. Pedro exporta y pega.

Export que sirve: Markups List, Summary, CSV. Column headers on. Columnas: Subject, Label, Page Label, Space, Length, Count, Measurement, Unit. Si puede, que incluya las marcas y no una segunda copia de los totales. Si el archivo trae totales, `bluebeam` los marca y los saca de `paraRollup`.

1. Llama `bluebeam` con el texto completo, encabezados incluidos.
2. No vuelvas a sumar las filas. `paraRollup` es la lista de compra.
3. Pasa esa lista a `rollup-materiales`. Tú pones la familia. `area` y `plano` ya vienen en cada objeto. `cantidad` y `unidad` se copian.
4. Si `partida` es null o el motivo es `asunto_es_herramienta`, pregunta el material. El asunto "Length" o "Count" es la herramienta de Revu, no la partida.
5. `unidad_ausente`, `nube_sin_largo`, `area_no_entra` y `volumen_no_entra` no entran. Pídele la medida en Revu.
6. `conteo` y `subida` no se suman a la cantidad.
7. Un comentario de homerun o feeder no arma el circuito. Falta desde y hasta.
