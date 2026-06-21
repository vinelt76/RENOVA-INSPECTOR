# Flujo de Inspección — UX del Inspector

Especificación de la experiencia de usuario en campo.
Fuente: transcripción directa del inspector + refinamiento de equipo.

---

## Pantallas y flujo principal

```
1. Splash (logo RENOVA)
   ↓
2. Login (JWT)
   ↓
3. Selección de empresa  ←─────────────────────────────────┐
   [dropdown: Palomino / Carapongo / ...]                   │
   ↓                                                        │
4. Ingreso de número de vehículo                            │
   [campo texto + búsqueda fuzzy]                           │
   ├─ Si existe → carga datos previos (medida, marca,       │
   │              diseño ya prellenados)                    │
   └─ Si no existe → "Registrar nueva unidad"               │
        [TIPO VEHÍCULO + CONFIGURACIÓN]                     │
        → catálogo genera posiciones automáticamente        │
   ↓                                                        │
5. Diagrama de posiciones del vehículo                      │
   [visual tocable, coloreado por estado]                   │
   gris=pendiente / verde=Normal / amarillo=Próximo /       │
   rojo=Para Reencauche                                     │
   ↓ (toca una posición)                                    │
6. Formulario del neumático (ver detalle abajo)             │
   ↓ (guarda → vuelve al diagrama)                          │
7. Siguiente posición → repetir                             │
   ↓ (todas completas)                                      │
8. "INSPECCIÓN TERMINADA"                                   │
   ↓                                                        │
9. Sync en background                                       │
   ↓                                                        │
   Volver a pantalla 3 ─────────────────────────────────────┘
```

---

## Formulario del neumático (paso 6, campo por campo)

El orden de campos respeta el flujo manual actual del inspector.

### Identificación
| Campo | Comportamiento |
|---|---|
| Código | Texto libre. Pre-llenado si hay inspección previa. |
| Medida | Pre-llenada, editable. Nunca pedir de cero si ya existe. |
| Marca | Pre-llenada, editable. |
| Condición | Toggle N / R1 / R2 (default: N si es primera vez) |
| Diseño actual | Solo aparece si Condición ≠ N. Picker de catálogo. |

### Medición RTD
| Campo | Comportamiento |
|---|---|
| RTD A / B / C | Stepper ±1mm, rango 0–22mm. SIN teclado. |
| RTD D | Solo visible si posición es de 4 canales (Libre/Dual). |
| RTD MOVI | Calculado al instante. Solo lectura. Chip de color. |
| IDI | Calculado al instante. Solo lectura. Chip de color. |
| Valor anterior | Texto tenue debajo del campo ("anterior: 9mm"). |

**Semáforo RTD en vivo:** chip verde/amarillo/rojo actualizado con cada cambio de RTD.

### Medición de presión
| Campo | Comportamiento |
|---|---|
| Presión | Stepper ±1 PSI, rango 60–200 PSI. SIN teclado. |
| Temperatura | Toggle FRÍO / CALIENTE |
| Sin medir | Checkbox. Si activo: oculta presión, ESTADO = "Sin Medir" |
| ESTADO PRESIÓN | Calculado al instante. Chip de color. |

### Estado del neumático
| Campo | Comportamiento |
|---|---|
| Tapa Válvula | Picker de catálogo. **Default: Metálica** |
| Anomalía Aro | Picker con búsqueda. **Default: Normal** |
| Anomalía Neumático | Picker con búsqueda (65+ tipos agrupados). **Default: Normal** |
| DESECHO | Auto-marcado si anomalía tiene `desecho=TRUE`. Puede marcarse manual. |
| Foto | Botón de cámara. Aparece SOLO cuando DESECHO=TRUE. (Sprint 3) |

### Comportamientos clave
- **Autoguardado por neumático** al tocar "siguiente posición". No esperar al final.
- Si el inspector sale y vuelve, recupera el estado de la inspección en progreso.
- Si no hay cambios respecto a inspección anterior, puede avanzar sin tocar nada
  (los valores pre-llenados se copian tal cual).
- La flecha abajo (o botón "Siguiente") avanza a la siguiente posición sin volver
  al diagrama (flujo rápido para el inspector que va posición por posición en orden).

---

## Registro rápido de vehículo nuevo (desde campo)

1. Inspector busca número de vehículo → no aparece.
2. Botón "Registrar nueva unidad" (sin salir del flujo).
3. Campos mínimos: NÚMERO VEHÍCULO, OPERACIÓN, TIPO VEHÍCULO, CONFIGURACIÓN.
4. Al elegir TIPO + CONFIGURACIÓN → diagrama de posiciones generado automáticamente.
5. La unidad queda en estado `activo` (sin validación previa por supervisor en Fase 1).

---

## Anomalía picker — UX

Con 65+ tipos de anomalía, un dropdown plano es inutilizable en campo.

**Estructura:**
```
[🔍 Buscar anomalía...]    ← campo de búsqueda siempre visible
─────────────────────────
▶ Cortes
▶ Desgastes
▶ Desgarros
▶ Separaciones
▶ Otras
```

- Expandir categoría → lista de tipos con su POSIBLE CAUSA en texto pequeño.
- Campo de búsqueda filtra en tiempo real sobre nombre Y posible causa.
- Los tipos con DESECHO=SÍ muestran un ícono de advertencia (🔴) en la lista.
- Al seleccionar uno con DESECHO=SÍ: se cierra el picker y aparece banner rojo
  "Este neumático debe retirarse".

---

## Diagrama de posiciones — comportamiento

- Se genera automáticamente desde `configuracion_vehiculo` (catálogo).
- Cada posición es un rect/círculo tocable.
- Color por ESTADO RTD del neumático inspeccionado en esa posición.
- Al terminar todas las posiciones: banner "INSPECCIÓN TERMINADA" + botón de cierre.
- El inspector puede volver a cualquier posición ya inspeccionada para corregir.
