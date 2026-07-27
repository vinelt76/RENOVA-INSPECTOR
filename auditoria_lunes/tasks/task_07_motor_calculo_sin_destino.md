# task_07 — Cerrar la brecha entre lo que el motor calcula y lo que llega a una pantalla

**Hallazgo:** H-03 y H-08 · **Prioridad:** Alta · **Tipo:** decisión de producto + esquema
**Bloquea la demo:** no

## Problema

El motor de cálculo tiene paridad Python/TS perfecta (48/48) y sigue la spec. El problema está
después de calcular.

### 3 de 7 funciones no las ejecuta nadie

| función | llamador real en `app/src/` |
|---|---|
| `calcularRtdMovi` | `inspeccionRepo.ts:117` |
| `calcularIdi` | `inspeccionRepo.ts:118` |
| `calcularEstadoRtd` | `inspeccionRepo.ts:119` |
| `calcularIsaPeso` | `inspeccionRepo.ts:128` |
| **`calcularEstadoPresion`** | **ninguno** (ver `task_06`) |
| **`calcularVur`** | **ninguno** |
| **`calcularTasaDesgaste`** | **ninguno** |

VUR y tasa de desgaste están implementadas, probadas y muertas. Hay que decidir si son
funcionalidad pendiente de conectar o alcance que se descartó y conviene retirar. Mantener código
muerto probado al 100 % infla la sensación de cobertura: la suite certifica reglas que no corren.

### `idi` se calcula y nunca sale del dispositivo

`calcularIdi` corre y se persiste local, pero `pushInspeccion.ts` no lo incluye en el payload y no
existe columna remota. Ningún dashboard puede mostrar jamás el Índice de Desgaste Irregular, que
la spec §4 describe como la señal anticipatoria del sistema.

### El estado RTD histórico se recalcula con el umbral vigente

La app envía `rtd_for_change` / `rtd_next_change` (`pushInspeccion.ts:63-65`) y la versión vigente
de `save_inspection` no tiene columna donde aterrizarlos. `fn_rtd_state` recalcula con
`fn_effective_rtd_thresholds(empresa, medida)`. Si una empresa cambia sus umbrales, el estado de
**todas** sus inspecciones pasadas cambia retroactivamente — justo lo que la funcionalidad de
snapshots decía evitar.

### `fn_rtd_state` no está en ninguna migración

Existe y corre en producción, pero no está definida en ningún archivo de `supabase/migrations/`.
Reconstruir el esquema desde cero con solo los archivos versionados **rompe el sync completo**.
Esto es independiente de la decisión de producto y hay que arreglarlo igual.

## Decisiones que hacen falta

1. ¿El estado RTD del dashboard debe ser **histórico** (el umbral del día de la medición) o
   **vigente** (el umbral de hoy)? La spec y task_16 dicen histórico; la implementación hace lo
   contrario. Un conflicto entre intención e implementación no se resuelve en silencio.
2. ¿Se agrega `idi` al esquema remoto ahora, o se acepta que no se muestra?
3. ¿VUR y tasa de desgaste se conectan o se retiran?

## Criterio de cierre

- ADR con las tres respuestas.
- `fn_rtd_state` versionada en `supabase/migrations/` con su definición real (comparar contra
  `pg_get_functiondef` en producción antes de escribirla).
- Si se elige histórico: columnas para los snapshots en `inspection_measurements`, `save_inspection`
  las escribe, las vistas las leen, y una inspección vieja conserva su estado tras cambiar el
  umbral de la empresa. Probarlo, no razonarlo.
- `/calc-parity-check` verde y `sync-migration-reviewer` sobre cualquier cambio de `save_inspection`.
