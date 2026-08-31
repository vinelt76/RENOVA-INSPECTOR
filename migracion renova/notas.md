    # Notas — Excel desde la app + Migración self-hosted

    Registro de una conversación de brainstorming (2026-08-07). Nada de esto está diseñado a
    detalle ni aprobado para implementar; son decisiones parciales y estimados para retomar.

    ## 1. Reporte Excel desde la app de inspección

    **Idea original:** que al terminar de inspeccionar, el inspector pueda pedir un Excel con las
    inspecciones de una empresa/día, ya calculado y con formato RENOVA, para reenviarlo por WhatsApp
    a los jefes (ej. MAB).

    **Decisiones tomadas en esta conversación:**

    - Quien dispara la generación: **el inspector, desde la app** (no automático, no desde WEB).
    - Entrega: **compartir nativo de Android** (`@capacitor/share`). El inspector elige WhatsApp y el
      contacto/grupo desde el selector del sistema. Se descarta integrar la API de WhatsApp Business
      (costo, cuenta aprobada, plantillas) — no hace falta.
    - Un inspector puede trabajar varias empresas el mismo día (elige empresa por inspección). Al
      pedir "Excel de hoy" se genera **un archivo por cada empresa que tocó ese día**, no uno mezclado.
    - Ubicación en la UI: **un botón en la pantalla de inicio/lista de unidades** que ya existe (no se
      crea una pantalla nueva de "resumen del día").
    - Contenido de cada fila (columnas exactas: capturado vs. capturado+calculado): **queda pendiente
      de definir**, se retoma después.

    **Decisión técnica clave — generación local vs. servidor:**

    Se evaluó generar el Excel en el servidor (Supabase Edge Function) vs. generarlo localmente en la
    app con la data ya capturada en SQLite. Se optó por explorar **generación local**, porque:

    - Es coherente con el valor central de la app (offline-first): no depende de conectividad al
      momento de generar/enviar.
    - Es técnicamente viable sin código nativo: `exceljs` (JS puro, corre en el WebView, soporta
      fórmulas y estilos) + `@capacitor/filesystem` (escribir el archivo) + `@capacitor/share` (abrir
      el selector nativo). Patrón conocido en apps Capacitor/Ionic.

    **Límite importante encontrado al revisar `app/src/sync/`:** la app hoy solo *sube* inspecciones
    a Supabase (`pushInspeccion.ts`); no descarga las de otros inspectores (solo baja configuración:
    `pullEmpresas.ts`, `pullUmbrales.ts`). Por lo tanto, un Excel generado 100% local solo puede
    incluir **lo que ese inspector capturó en ese teléfono ese día**, no el consolidado de todos los
    inspectores de una empresa. Si se necesita el consolidado completo, eso requeriría ir al servidor
    (o agregar una sincronización de bajada nueva) — se dejó como pregunta abierta, sin resolver.

    **Estimado de esfuerzo:**

    - Función que arma el workbook desde SQLite (reusando `app/src/core/calculations.ts` para los
      campos calculados) + guardar + compartir + botón en la pantalla existente: **~1 día**, una vez
      que las columnas estén definidas.
    - Afinar formato "bonito, estandarizado, con marca RENOVA" (logo, estilos, encabezados): días
      extra según cuánto importe lo visual.
    - Con la definición de columnas y el pulido incluidos: **~1 semana aprox.**

    ## 2. Migración: RENOVA self-hosted en servidor del cliente (solo módulo inspecciones)

    **Contexto:** un cliente quiere RENOVA en su propio servidor, por tema de licencia — pero
    **solo el módulo de inspecciones**, nada de servicios, inventario ni movimientos. Piden Postgres
    17 compatible con Supabase para facilitar la migración, y abrir puertos para que las apps se
    conecten a ese servidor. Facundo lo instalaría y administraría remotamente (no el cliente).

    **Estado actual (arquitectura vigente):** un solo backend Supabase multiempresa
    (`supabase/migrations/`), todas las empresas en las mismas tablas, separadas por RLS
    (`empresa_id`). Es SaaS multi-tenant, no una instancia por cliente.

    **Lo que ya existe y facilita la migración (Supabase es self-hosteable oficialmente — stack
    Docker: Postgres + GoTrue/Auth + PostgREST + Realtime + Storage + Kong + Studio):**

    - No hay Edge Functions en el proyecto (`supabase/functions/` no existe) — nada que reescribir en
      runtime Deno self-hosted.
    - No hay `pg_cron` ni `pg_net` — no hay jobs programados que reconfigurar.
    - Solo 1 bucket de Storage (`tire_discard_photos_bucket`, fotos de descarte) y 1 tabla con
      Realtime habilitado (`enable_realtime_inspections`) — ambos soportados de fábrica en el stack
      self-hosted.
    - 53 migraciones, todas SQL puro — corren igual en Postgres self-hosted.

    **Lo que realmente pesa — separar "solo inspecciones":**

    - Al revisar las migraciones se encontraron ~9 que tocan movimientos/traslados/órdenes y ~3 de
      servicios, entrelazadas con tablas base compartidas (unidad, neumático, posición, empresa) que
      inspecciones también usa. Decidir qué migraciones/tablas quedan sin romper foreign keys es
      trabajo de auditoría fino, no copiar carpetas.
    - Reapuntar las apps (app/, WEB) a la URL/anon key del servidor nuevo es trivial; validar que cada
      policy de RLS se comporta igual en self-hosted sí toma tiempo de pruebas.

    **Lo que no es "migración" sino carga permanente (porque la administración es remota):**

    - Levantar y asegurar el servidor: TLS, firewall, exponer solo lo necesario (PostgREST/Auth/
      Storage detrás de proxy, no Postgres directo), acceso SSH/VPN.
    - Backups, monitoreo, y actualizar las imágenes de Supabase self-hosted cuando salgan parches —
      continúa después de "terminar" la migración, indefinidamente.

    **Estimado de esfuerzo:**

    - Stack self-hosted + correr migraciones + apuntar las apps, probado: **~1 semana**.
    - Auditar y separar limpiamente el módulo de inspecciones del resto: **~1 semana adicional**
      (depende de qué tan enredadas estén las tablas compartidas — falta auditoría real, esto es
      estimado desde el conteo de migraciones, no desde un análisis completo de dependencias).
    - Hardening de red + acceso remoto seguro: **2-3 días**.
    - **Total realista: ~2.5-3 semanas** para dejarlo sólido, más el compromiso permanente de
      mantenerlo.

    ## Pendiente / próximos pasos

    - Excel: definir columnas exactas (capturado + qué cálculos), decidir si el consolidado
      multi-inspector por empresa es necesario y de dónde sale si sí.
    - Migración: hacer la auditoría real de dependencias entre tablas de inspecciones y las de
      movimientos/servicios antes de comprometer el estimado de 2-3 semanas.
    - Ninguno de los dos temas tiene diseño formal (spec) todavía; esto es solo el registro de la
      conversación exploratoria.
