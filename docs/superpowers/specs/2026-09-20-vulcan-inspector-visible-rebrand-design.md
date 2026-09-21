# Diseño: renombrado visible a VULCAN INSPECTOR

## Objetivo

Reemplazar toda referencia visible de la demo a «RENOVA» por «VULCAN INSPECTOR» en los tableros web, la app de inspecciones y la app de Movimientos, sin modificar datos, autenticación, Supabase ni la identidad técnica instalada de las aplicaciones.

## Decisión de marca

- La marca principal visible será siempre `VULCAN INSPECTOR`.
- En la app de operarios se mostrará `VULCAN INSPECTOR · MOVIMIENTOS` para distinguir su propósito sin convertirlo en otra marca.
- En los tableros web, `VULCAN INSPECTOR` será la marca de cabecera y el nombre de cada módulo seguirá apareciendo como subtítulo o pantalla activa.
- Títulos de navegador y nombres de Android usarán las mismas denominaciones.

## Superficies incluidas

### Web

Se actualizan los siete puntos de entrada visibles: Inspecciones por fecha, Inspecciones por unidad, Inventario, Servicios, Rendimiento, Historial de neumático e Importar. También se actualizan las superficies compartidas que una persona puede ver: modal de inicio de sesión, badge de datos/sesión, buscador y archivos de estilo o utilidades que impriman la marca.

Los nombres de archivos compartidos que hoy contienen `renova` se conservan en esta entrega cuando no se muestran en la interfaz. Sus importaciones, APIs globales y rutas son internas; renombrarlas aportaría riesgo de carga sin cambiar la experiencia de la persona usuaria.

### App de inspecciones

Se actualizan pantallas de carga, login, unidad, empresa si se navega a ella, errores visibles y el nombre que Android muestra. El `appName` de Capacitor y los recursos Android cambian a `VULCAN INSPECTOR`.

### App de Movimientos

Se actualizan componente de marca, login, mensajes de error y nombre de Android. El `appName` de Capacitor y los recursos Android cambian a `VULCAN INSPECTOR · MOVIMIENTOS`.

## Compatibilidad que se conserva

No se modifican estos identificadores técnicos:

- IDs Android `com.renova.inspector` y `com.renova.movimientos`.
- Paquetes Java/Kotlin correspondientes.
- Base SQLite `renova.db` ni claves locales de sesión, caché y borradores.
- Variables globales JavaScript y rutas internas como `RenovaSupabase`, `renova-ready.js` y claves `renova:*`.
- Esquema, RPCs, RLS, datos, usuarios y migraciones de Supabase.
- Documentación histórica, evidencias, planes cerrados, prototipos y nombres de directorio o repositorio.

Conservarlos permite actualizar las APK existentes sin crear una segunda aplicación y conserva borradores, sesión y datos locales de pruebas.

## Fuera de alcance

No se rediseña la paleta, tipografía, iconografía o estructura de navegación. No se cambia el nombre de empresas como CIVA. No se alteran las cuentas ni permisos. No se renombra el repositorio ni se reescribe la historia documental.

## Criterios de aceptación

1. Toda pantalla web o móvil de la demo muestra `VULCAN INSPECTOR` y no muestra `RENOVA` en logotipos, títulos, textos de sesión, errores, carga o metadatos visibles.
2. Las dos APK muestran el nuevo nombre en Android, conservan sus IDs de aplicación y se construyen correctamente.
3. Los flujos de login, selección/búsqueda de unidad, inspección, emisión de órdenes y ejecución de movimientos siguen operativos.
4. Las búsquedas automatizadas sobre las fuentes de interfaz no encuentran `RENOVA` en literales visibles.
5. No cambia ningún contrato de Supabase ni se ejecuta una migración remota.

## Validación

- Ejecutar suites WEB afectadas y una búsqueda de regresión sobre los archivos de interfaz.
- Ejecutar pruebas, lint y build de ambas apps.
- Sincronizar Capacitor y compilar ambas APK de depuración.
- Smoke test manual: abrir cada punto de entrada web, login de ambas apps y cabeceras principales en modo móvil y escritorio.
