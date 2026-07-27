---
title: "Diccionario en criollo"
updated: 2026-07-26
status: vigente
sources: [specs/reglas_negocio.md, decisions, project terminology, Supabase schema 2026-07-26]
---

# Diccionario en criollo

- **RTD o remanente:** cuántos milímetros de dibujo quedan.
- **RTD MOVI:** el menor de los canales medidos; se toma el peor para no esconder riesgo.
- **IDI:** diferencia entre la parte más alta y la más gastada; ayuda a ver desgaste desparejo.
- **VUR:** estimación de cuántos kilómetros quedan antes del límite.
- **ISA:** peso para resumir gravedad de anomalías.
- **Desecho:** ya no conviene o no se puede recuperar según la causa.
- **Casco:** cuerpo físico permanente del neumático.
- **Ciclo:** una vida de banda nueva o reencauchada.
- **Instalación:** período de un ciclo montado en una unidad y posición.
- **Retiro:** evento que cierra la instalación.
- **Retén:** neumáticos activos disponibles para volver a montar.
- **Descartado:** baja definitiva; no vuelve a montarse.
- **N, R1, R2:** banda nueva, primer y segundo reencauche.
- **Snapshot:** foto del límite que se usó ese día.
- **OTD:** profundidad original de la banda al empezar un ciclo.
- **Profundidad útil:** OTD menos el límite de retiro.
- **Línea base:** primer montaje confirmado a partir de una inspección anterior.
- **Reconciliar:** unir una captura del operario con casco, ciclo e instalación canónicos.
- **Orden:** indicación que emite el supervisor.
- **Ejecución:** lo que el operario declara que realmente hizo.
- **Servicio:** una posición atendida, con salida y entrada cuando corresponda.
- **Faceta:** tipo de filtro, por ejemplo empresa, marca, fecha o medida.
- **Frescura:** cuánto tiempo pasó desde la última inspección; no es una ventana de consumo.
- **Offline-first:** primero queda seguro en el teléfono, después se manda.
- **Sync:** sincronizar la libreta local con el archivo central.
- **RPC:** una función de Supabase que ejecuta una operación definida; puede completar todo o
  rechazarlo sin dejar cambios parciales.
- **RLS:** portero que separa los datos de cada empresa.
- **Realtime:** aviso instantáneo para refrescar un tablero.
- **Migración:** cambio numerado y repetible en la estructura de la base.
- **Seed:** paquete inicial de catálogos/datos para arrancar.
- **Frontend:** lo que la persona ve y toca.
- **Backend:** la parte central que guarda, protege y calcula.
- **API:** ventanilla con reglas para pedir o mandar información.
- **Auth:** inicio de sesión e identidad del usuario.
- **Anon:** cliente sin una sesión de usuario.
- **Tenant o empresa:** grupo de datos que debe quedar separado de los demás.
- **Security invoker:** una vista que respeta los permisos de quien la consulta.
- **Security definer:** una función que trabaja con los permisos de su dueño; necesita controles
  internos porque puede saltarse RLS.
- **Idempotente:** repetir la misma operación produce un solo resultado y no duplica el trabajo.
- **Backoff:** espera que crece entre reintentos.
- **Polling:** volver a preguntar cada cierto tiempo cuando no llega un aviso Realtime.
- **Smoke test:** recorrido corto del flujo real para confirmar que abre, guarda, recarga y no deja
  errores.
- **Golden test:** ejemplo fijo cuya respuesta correcta se conserva para detectar cambios de
  fórmula.

Seguir con [[07 - Que pasa cuando algo falla]].
