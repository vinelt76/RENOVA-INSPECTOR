# Mobile — RENOVA INSPECTOR (Flutter)

Flutter app, iOS + Android, offline-first. Lee `@CLAUDE.md` primero.

## Estructura

```
mobile/
├── lib/
│   ├── main.dart
│   ├── core/
│   │   ├── calculations.dart   # calcular_rtd_movi / estado_rtd / etc. (paridad con Python)
│   │   ├── sync_service.dart   # background sync al recuperar red
│   │   └── auth_service.dart   # JWT storage + refresh
│   ├── db/
│   │   └── database.dart       # Drift: tablas espejo + DAOs
│   ├── features/
│   │   ├── splash/             # Pantalla inicial con logo RENOVA
│   │   ├── auth/               # Login
│   │   ├── empresa/            # Selección de empresa
│   │   ├── vehiculo/           # Búsqueda + alta rápida de vehículo
│   │   ├── inspeccion/
│   │   │   ├── diagrama/       # CustomPainter del vehículo (posiciones tocables)
│   │   │   └── neumatico/      # Formulario por posición
│   │   ├── dashboard/          # Métricas (Sprint 3)
│   │   └── reporte/            # Generar/compartir Excel (Sprint 4)
│   └── shared/
│       ├── widgets/
│       │   ├── rtd_stepper.dart         # Stepper grande ± para RTD
│       │   ├── presion_stepper.dart     # Stepper grande ± para presión
│       │   ├── semaforo_chip.dart       # Chip verde/amarillo/rojo en tiempo real
│       │   └── anomalia_picker.dart     # Buscador con 65+ tipos agrupados
│       └── theme/
└── test/
    ├── golden_test.dart        # ← Paridad con Python contra el mismo fixture
    └── fixtures/
        └── real_sample.json    # Mismo dataset que backend/tests/fixtures/
```

## Motor de cálculo Dart — REGLA CRÍTICA

`lib/core/calculations.dart` implementa exactamente las mismas funciones que el backend Python.
**Fuente de verdad: `@specs/reglas_negocio.md`.**

```dart
double? calcularRtdMovi({required double a, required double b, required double c, double? d})
String calcularEstadoRtd({required double rtdMovi, required double rtdCambio, required double rtdProximo})
String calcularEstadoPresion({required double? presion, required double presionRef,
    required double deltaAltoPct, required double deltaBajoPct, required bool sinMedir})
double? calcularIdi({required double a, required double b, required double c, double? d})
double? calcularVur({required double rtdMovi, required double rtdCambio, required double? tasaAcumulada})
```

Estas funciones son puras. Se llaman en tiempo real en el formulario para el semáforo.
El golden test `test/golden_test.dart` valida que sus outputs coincidan con el Excel real.

## Drift — esquema offline

Drift es SQLite type-safe. Las tablas locales son un espejo de PostgreSQL.

```dart
// Tablas del catálogo (sincronizadas desde servidor, read-only en cliente)
class AnomaliaNeumaticoTable extends Table { ... }
class ConfiguracionVehiculoTable extends Table { ... }
class UmbralRtdTable extends Table { ... }
class UmbralPresionTable extends Table { ... }
class CatalogVersion extends Table { version int; updatedAt DateTime; }

// Tablas de negocio (escritura local, sync hacia servidor)
class VehiculoTable extends Table { ... }
class InspeccionCabeceraTable extends Table {
  // id es UuidConverter — UUID generado en el cliente con uuid package
  UuidConverter get id => ... // NO autoincrement
}
class InspeccionNeumaticoTable extends Table {
  // id es UuidConverter también
}

// Cola de sync
class SyncQueueTable extends Table {
  TextColumn get cabecera_id => ...
  BoolColumn get sincronizado => ...
}
```

## Sync Service

```dart
class SyncService {
  // Se activa cuando Connectivity cambia a conectado
  Future<void> syncPending() async {
    final pending = await db.syncQueue.getPending();
    for (final item in pending) {
      await api.syncInspeccion(item);
      await db.syncQueue.markSynced(item.id);
    }
  }
}
```

**CRÍTICO:** el sync es por `inspeccion_neumatico` individual, no por cabecera completa.
Si el inspector inspeccionó 4 neumáticos offline y 4 más después de reconectar, los primeros
4 no deben sobreescribirse.

## JWT y modo offline prolongado

- El JWT de acceso expira normalmente (e.g., 15 min).
- El refresh token tiene vida larga (e.g., 30 días).
- El sync service usa el refresh token para renovar el access token antes de cada sync.
- Si el refresh token también expiró (inspector offline > 30 días — caso extremo):
  se muestra banner "Sesión expirada — reconectar para sync" pero la inspección local
  **no se pierde**. El inspector puede seguir capturando offline; sync ocurrirá al re-login.

## Sync del catálogo PATRON

Al inicio de sesión (y periódicamente en background):
1. Cliente pide `GET /catalogo/version` → recibe `{version: int, updated_at: datetime}`.
2. Compara con la versión local en `CatalogVersion`.
3. Si hay versión nueva: descarga catálogo completo y reemplaza tablas locales.
4. Si sin conexión: usa versión local (funciona offline siempre).

## UX — reglas para el formulario de neumático

- **Defaults inteligentes:** `anomalia_aro = "Normal"`, `anomalia_neumatico = "Normal"`,
  `tapa_valvula = "Metálica"`. El inspector solo toca si algo cambia.
- **Steppers, no teclado:** RTD usa `RtdStepper` (±1mm, rango 0-22mm). Presión usa
  `PresionStepper` (±1 PSI, rango 60-200 PSI). El teclado numérico no debe aparecer para
  estos campos.
- **Semáforo en vivo:** mientras el inspector ingresa RTD A/B/C, se calcula y muestra
  RTD MOVI + IDI + ESTADO RTD como chip de color. Feedback instantáneo.
- **Valor anterior:** si existe inspección previa del mismo `codigo` en esa posición,
  mostrar RTD anterior como texto tenue ("anterior: 9mm"). Ayuda a detectar errores de tipeo.
- **Anomalía picker:** buscador con autocompletado sobre 65+ tipos agrupados por categoría
  (cortes, desgastes, separaciones...). NO un dropdown plano.
- **DESECHO:** si la anomalía tiene `desecho=TRUE`, auto-marcar el campo y mostrar
  advertencia prominente ("Este neumático debe retirarse").
- **Autoguardado por neumático:** guardar en Drift al completar cada posición.
  NO esperar a que el inspector termine toda la inspección.
- **Diagrama de posiciones:** CustomPainter que dibuja el vehículo según
  `tipo_vehiculo + configuracion`. Posiciones coloreadas: gris=pendiente,
  verde/amarillo/rojo=inspeccionado según ESTADO RTD. Tocable para navegar.

## Fotos

Las fotos se habilitan **únicamente** cuando `desecho = TRUE` o cuando la anomalía
es clasificada como "significativa" (definir umbral en `reglas_negocio.md`).
Flujo: `image_picker` → comprimir → upload a Cloudflare R2 vía backend → guardar `foto_url`.
El upload usa retry con back-off exponencial. Si falla offline, se encola junto con el sync.

**Las fotos son Sprint 3, no Sprint 2.** Sprint 2 completa el formulario base sin fotos.

## Comandos

```bash
flutter run                     # dev
flutter test                    # todos los tests incluyendo golden_test.dart
flutter test test/golden_test.dart  # solo paridad de cálculo
flutter build apk               # build Android
flutter build ios               # build iOS
```

## Dependencias clave (no agregar sin justificación)

| Paquete | Para qué |
|---|---|
| `drift` + `sqlite3_flutter_libs` | Offline SQLite type-safe |
| `riverpod` | State management |
| `dio` | HTTP client con interceptors para JWT refresh |
| `connectivity_plus` | Detectar cambio de red para trigger sync |
| `uuid` | Generar UUID v4 en el cliente para IDs de inspección |
| `image_picker` | Cámara (Sprint 3) |
| `share_plus` | Compartir Excel por WhatsApp/email/Drive (Sprint 4) |
| `open_filex` | Abrir Excel descargado en el dispositivo (Sprint 4) |
