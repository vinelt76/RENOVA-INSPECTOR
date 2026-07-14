# Prueba de campo — Modo Cambios de Neumáticos

Guía rápida para probar el modo **Cambios** en el navegador contra la base real.

## 1. Levantar el servidor

Desde la raíz del repo:

```bash
cd "WEB"
python3 -m http.server 8765
```

Dejá esa terminal abierta. Para cortar el servidor: `Ctrl+C`.

## 2. Abrir la unidad de prueba

En el navegador:

```
http://localhost:8765/Inspecciones%20por%20unidad.html?plate=QA-CN16&mode=cambios
```

- Aparece el login → entrá con el usuario de taller.
- `?plate=QA-CN16` abre la unidad de prueba; `?mode=cambios` entra directo al modo Cambios
  (podés alternar arriba con las pestañas **Inspección / Cambios**).

## 3. Unidad de prueba `QA-CN16` (estado inicial)

Bus 2-4-2, empresa MÓVIL BUS. Neumáticos de prueba marca `QA-TEST`, códigos `CN16-000x`:

- **P1–P6**: ocupadas y limpias.
- **P7**: ocupada, marcada **REVISAR IDENTIDAD** (código no coincide, a propósito).
- **P8**: **vacía** (para probar montaje).
- En **inventario** hay un neumático disponible: `CN16-0008` (para montar en P8).

## 4. Qué probar

1. Tocar una posición ocupada → **Enviar a retén**, **Descartar** (pide causa + **foto**) o
   **Intercambiar** (elegir la segunda posición).
2. Tocar la posición vacía P8 → **Elegir para montar** → buscar `CN16-0008` en el inventario.
3. Completar el **odómetro** (obligatorio) y **Confirmar lote**.
4. Recargar la página: el estado nuevo debe seguir ahí.

## 5. Volver a dejarla lista (resetear)

Cada confirmación cambia la unidad de verdad. Para volver a empezar desde el estado inicial de
arriba, pedime "resetear QA-CN16" y la dejo prístina otra vez (o corré de nuevo el sembrado que
quedó documentado en `REVISION_FINAL.md`).

> Nota: la unidad y sus neumáticos son de prueba (`QA-TEST` / `QA-CN16`); no son de la flota real.
> Cuando termines las pruebas, se pueden borrar sin afectar datos productivos.
