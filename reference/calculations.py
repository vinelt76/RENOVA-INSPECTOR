"""
Motor de cálculo RENOVA INSPECTOR.

Funciones puras — sin acceso a DB, sin side effects.
Fuente de verdad: specs/reglas_negocio.md
Toda modificación aquí DEBE reflejarse en mobile/lib/core/calculations.dart
y ambas deben pasar el golden test.
"""

from __future__ import annotations


def calcular_rtd_movi(
    rtd_a: float,
    rtd_b: float,
    rtd_c: float,
    rtd_d: float | None = None,
) -> float:
    """
    RTD MOVI = MIN de los canales medidos.
    rtd_d es opcional en CUALQUIER posición/eje — hay medidas/diseños que se
    miden en 4 puntos incluso en Dirección. El tipo_eje NO restringe cuántos
    canales se pueden capturar; solo se usan los canales que vengan con valor.

    Raises ValueError si algún canal es negativo.
    """
    canales = [rtd_a, rtd_b, rtd_c]
    if rtd_d is not None:
        canales.append(rtd_d)

    for i, v in enumerate(canales):
        if v < 0:
            raise ValueError(f"RTD canal {i} negativo: {v}")

    return min(canales)


def calcular_idi(
    rtd_a: float,
    rtd_b: float,
    rtd_c: float,
    rtd_d: float | None = None,
) -> float:
    """
    IDI = MAX(canales) - MIN(canales).
    Usa los mismos canales que calcular_rtd_movi.
    """
    canales = [rtd_a, rtd_b, rtd_c]
    if rtd_d is not None:
        canales.append(rtd_d)
    return max(canales) - min(canales)


def calcular_estado_rtd(
    rtd_movi: float,
    rtd_cambio: float,
    rtd_proximo: float,
) -> str:
    """
    Evaluación SECUENCIAL (if/elif) — no condiciones paralelas.
    Ver specs/reglas_negocio.md §2.

    Retorna: 'Para Reencauche' | 'Próximo a Reencauche' | 'Normal'
    """
    if rtd_movi <= rtd_cambio:
        return "Para Reencauche"
    elif rtd_movi <= rtd_proximo:
        return "Próximo a Reencauche"
    else:
        return "Normal"


def calcular_estado_presion(
    presion: float | None,
    presion_ref: float,
    delta_alto_pct: float,
    delta_bajo_pct: float,
    sin_medir: bool = False,
) -> str:
    """
    Evaluación SECUENCIAL.
    Ver specs/reglas_negocio.md §3.

    presion_ref: referencia en frío (o ajustada para CALIENTE cuando se defina).
    delta_alto_pct: porcentaje de margen superior (ej: 5.0 para +5%).
    delta_bajo_pct: porcentaje de margen inferior (ej: 10.0 para -10%).

    Retorna: 'Sin Medir' | 'Alta Presión' | 'Baja Presión' | 'Normal'

    NOTA: el ajuste para temperatura CALIENTE no está definido aún.
    Ver CLAUDE.md "Decisiones abiertas" y specs/reglas_negocio.md §3.
    """
    if sin_medir or presion is None:
        return "Sin Medir"

    limite_alto = presion_ref * (1 + delta_alto_pct / 100)
    limite_bajo = presion_ref * (1 - delta_bajo_pct / 100)

    if presion > limite_alto:
        return "Alta Presión"
    elif presion < limite_bajo:
        return "Baja Presión"
    else:
        return "Normal"


def calcular_vur(
    rtd_movi: float,
    rtd_cambio: float,
    tasa_acumulada: float | None,
) -> float | None:
    """
    VUR (Vida Útil Remanente) en km.
    Ver specs/reglas_negocio.md §8.

    Retorna:
      None  → sin datos suficientes (tasa None, 0, o negativa)
      0.0   → cambio inmediato (RTD ya en límite o por debajo)
      float → km proyectados hasta rtd_cambio
    """
    if tasa_acumulada is None or tasa_acumulada <= 0:
        return None

    if rtd_movi <= rtd_cambio:
        return 0.0

    return (rtd_movi - rtd_cambio) / tasa_acumulada * 1000


def calcular_tasa_desgaste(
    rtd_movi_anterior: float,
    rtd_movi_actual: float,
    km_anterior: int,
    km_actual: int,
) -> float | None:
    """
    Tasa de desgaste en mm/1000km entre dos inspecciones consecutivas.
    Retorna None si km_actual == km_anterior (evita división por cero).
    """
    delta_km = km_actual - km_anterior
    if delta_km <= 0:
        return None
    delta_rtd = rtd_movi_anterior - rtd_movi_actual
    return delta_rtd / delta_km * 1000


def calcular_isa_peso(desecho: bool) -> int:
    """
    Peso de severidad para ISA.
    Ver specs/reglas_negocio.md §6.
    Los pesos son configurables por empresa — esta función usa los defaults.
    """
    return 5 if desecho else 1
