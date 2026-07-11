# Catálogo PATRON — Categorías y Valores Reales

Extraído directamente de las fórmulas y tablas del Excel real (`REPORTES Y PATRON.xlsx`).
Estas son las categorías de datos que el sistema usa. Las **listas** (tapas, anomalías,
configuraciones) son compartidas entre empresas. Los **umbrales** (presión, RTD) cambian
por empresa — ver `reglas_negocio.md` y se definen empresa por empresa.

Seed exacto en: `backend/app/db/seed/catalogo_patron.json`

> **ALCANCE MVP: SOLO BUSES.** El MVP solo inspecciona buses. Las otras configuraciones
> (tracto, cisterna, carreta, semiremolque, tolva) **se agregan después del MVP** — ya están
> en el seed con `mvp=false`, no se descartan, solo no se muestran todavía.
>
> ⚠️ Este Excel es de **una** empresa (BUS / operación LOCAL / todo FRÍO).
> Marcas, medidas y diseños **crecerán** al cargar las demás empresas.

---

## 1. Tablas del catálogo (estructura)

| Tabla | Columnas | Origen en Excel | ¿Cambia por empresa? |
|---|---|---|---|
| `tapa_valvula` | nombre | PATRON col A | No (compartida) |
| `anomalia_neumatico` | nombre, posible_causa, desecho | PATRON col C/D/E | No (compartida) |
| `anomalia_aro` | nombre, posible_causa | (en otro libro, roto aquí) | No (compartida) |
| `configuracion_vehiculo` | tipo_vehiculo, configuracion, posicion, tipo_eje, piso | PATRON col J–N | No (compartida) |
| `marca` | nombre | datos REPORTE col L | No (crece) |
| `diseno` | nombre, tipo (original/reencauche) | datos REPORTE col M/N | No (crece) |
| `medida` | nombre | datos REPORTE col K | No (crece) |
| `condicion` | N / R1 / R2 | datos REPORTE col O | No (fija) |
| `umbral_rtd` | empresa_id, medida, rtd_cambio, rtd_proximo, rtd_normal | REPORTE col AB/AC/AD | **SÍ** |
| `umbral_presion` | empresa_id, medida, tipo_eje, presion_frio, (presion_caliente) | REPORTE col AA | **SÍ** |

---

## 2. Valores reales extraídos

### Tapas de válvula (24)
`AGUJA DAÑADA, Extensión averiada, Extensión desajustada, Extensión torcida, Fuga de aire por
extensión, Hilo dañado, Neumatico sin Aro, No tiene, Normal, Pitón averiado, Pitón corto,
Pitón hacia adentro, Pitón pegado al aro, Pitón recto, Plástica, Repuesto semire elevado,
Repuesto tracto elevado, SIN MEDIR, Sin extensión de válvula, Tapa Metálica, Tapa endurecida,
Ventilas desalineadas, Válvula averiada, Válvula corta`

> Nota: "Normal" y "Tapa Metálica" son los defaults del formulario. "SIN MEDIR" como tapa
> indica el motivo por el que la presión quedó vacía.

### Anomalías de neumático (67 — lista completa en el JSON seed)
**13 con DESECHO=SÍ** (auto-marcan el retiro del neumático):
- Carcasa fatigada
- Desgarro en flanco cuerdas expuestas externo / interno
- Exceso de rodado
- Exceso de frenado
- Rotura de cuerda(s) radial(es) externo / interno
- Separación de paquete de cinturones con las cuerdas radiales
- Separación estructural
- Separación por filtración en banda de rodamiento / en pestaña
- Zipper en flanco
- Corte profundo en flanco

Las otras 54 son DESECHO=NO. Cada anomalía trae su `posible_causa` (Servicio, Neumático,
Conducción-Ruta, Mantenimiento Alineación, Proveedor, etc.) — útil para el análisis de causa.

### Condición del neumático (3)
- `N` — Nuevo
- `R1` — Primer reencauche
- `R2` — Segundo reencauche

### Marcas (4 — crecerá)
`BRIDGESTONE, GOODYEAR, KUMHO, MICHELIN`

### Diseños originales (7 — crecerá)
`ARMOR MAX MSA, KMA01, KMD01, R269, REGIONAL RHS II HL, X MULTI ENERGY, X MULTI Z`

### Diseños de reencauche (crecerá)
`DV-RM 258 REENC, IZE2W REENC` — el sufijo "REENC" los marca como reencauche.
Aplican cuando CONDICIÓN = R1 o R2.

### Medidas (2 — crecerá)
`295/80R22.5, 315/80R22.5`

---

## 3. Configuraciones de vehículo — SOLO BUS (2)

Cada combinación `tipo_vehiculo + configuracion` define las posiciones y el tipo de eje
de cada una. El TIPO EJE es metadato descriptivo de la posición (Direccional/Tracción/Libre);
NO restringe cuántos canales de RTD se capturan — Libre suele traer 4 (A,B,C,D) y
Direccional/Tracción suelen traer 3 (A,B,C), pero RTD_D es opcional en cualquier eje
(hay medidas/diseños que se miden en 4 puntos también en Dirección o Tracción).

| Tipo | Config | Posiciones | Ejes |
|---|---|---|---|
| BUS | 2-4 | 6 | Dir(1-2), Tracc(3-6) |
| BUS | 2-4-2 | 8 | Dir(1-2), Tracc(3-6), Libre(7-8) |

Las 16 configuraciones no-bus (TRACTO, CISTERNA, CARRETA, SEMIREMOLQUE, TOLVA, FURGON)
están en el seed con `mvp=false` — se habilitan **después del MVP**. Algunas tienen
ruedas duales (posiciones repetidas) que habrá que aclarar al expandir el alcance.

---

## 4. Estados RTD que importan (confirmado con RENOVA)

Solo interesan estos estados de salud del neumático:

| Estado | Condición | Color |
|---|---|---|
| **Para Reencauche** | RTD MOVI ≤ rtd_cambio | 🔴 |
| **Próximo a Reencauche** | rtd_cambio < RTD MOVI ≤ rtd_proximo | 🟡 |
| **Normal** | RTD MOVI > rtd_proximo | 🟢 |

Además, **desecho** es una condición separada (flag): cuando la anomalía tiene
`desecho=TRUE`, el neumático se retira independientemente de su RTD.

El estado **"Verificar"** del Excel original es residual y se descarta.

---

## 5. Correcciones a las reglas de presión (de las fórmulas reales)

1. **ESTADO PRESIÓN es ±5% simétrico** en este Excel (`<0.95` baja, `>1.05` alta),
   no el +5%/−10% que decía la documentación. El % exacto **depende de cada empresa**
   (se define por empresa) — por eso los deltas son configurables.
2. El ratio presión/referencia se **redondea a 2 decimales** antes de comparar.
3. **CALIENTE** usa la misma lógica pero contra una **presión de referencia caliente
   distinta** (en este Excel está rota — `#REF!` a libro de Carapongo). Pendiente el valor.
