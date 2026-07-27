# task_08 — Documentación, ADR y knowledge

## 1. Objetivo y resultado observable

Que dentro de tres meses alguien pueda leer por qué el % de desgaste se mide sobre la profundidad
útil sin tener que redescubrirlo desde una captura de Excel.

Resultado observable: `npm run docs:check` en verde y un ADR que registra la decisión con su
evidencia y con lo que se descartó.

## 2. Dependencias

`task_07`. Es la última.

## 3. Qué escribir

### 3.1 ADR

`decisions/0011-formulas-de-rendimiento-y-agregacion-ponderada.md`.

Tiene que contener, además de la decisión:

- **Que la fuente es la planilla de RENOVA**, no una derivación estadística. Las fórmulas no se
  eligieron: se leyeron.
- **Que el OTD es la base del ciclo** (D1), con el argumento de rotación/traslado.
- **Que el ponderado dentro de una unidad es deliberado** (D3), porque instalaciones con evidencia
  desigual no deben tener el mismo peso.
- **Qué evidencia NO se tiene**: la planilla demuestra el resumen de un vehículo, no los
  agrupamientos por marca o diseño.

### 3.2 Specs

`specs/reglas_negocio.md` no documenta ninguna fórmula de rendimiento agregado — solo menciona la
VUR proyectada en §8. Agregar la sección que falta, o dejar constancia de que el contrato vive en
`tasks_paridad_rendimiento/CONTRATOS_DATOS.md` y por qué.

**Esto ya pasó una vez y salió caro:** la spec de presión documentaba un modelo que el negocio no
usaba, y `calcularEstadoPresion` se implementó con paridad Python/TS y cobertura golden para un
modelo que nadie iba a usar.

### 3.3 Knowledge

- `knowledge/ai/06 - Reglas de negocio.md` — las fórmulas y las dos estadísticas.
- `knowledge/ai/10 - Roadmap deuda y riesgos.md` — registrar la tasa a nivel ciclo y que un ciclo
  incompleto devuelve `NULL`.
- `knowledge/ai/15 - Bitacora diaria.md` — la sesión, con lo verificado.

### 3.4 Documento de lógica

`auditoria_lunes/LOGICA_RENDIMIENTO.md` es el documento de revisión que ya existe. Actualizar §2, §3
y §7, y **borrar de §9 las preguntas que esta fase respondió**, dejando las que siguen abiertas.

### 3.5 Traspaso

`auditoria_lunes/TRASPASO.md` no existe en el árbol. Se registra como N/A y no se inventa un
documento histórico.

## 4. Criterio de cierre

- [x] ADR escrito, con alternativas y límites de evidencia.
- [x] `npm run docs:check` en verde.
- [x] Specs, reglas, roadmap, decisiones e índice/bitácora actualizados.
- [x] `LOGICA_RENDIMIENTO.md` actualizado; `TRASPASO.md` registrado como inexistente.
- [x] `DECISIONES.md` conserva D6 y D9 abiertas y D7 resuelta por espera de recarga.

## 5. Trampa

**No duplicar el contrato.** `CONTRATOS_DATOS.md` es la fuente; knowledge resume y enruta. Dos copias
de una fórmula divergen, y la que se lea primero gana.
