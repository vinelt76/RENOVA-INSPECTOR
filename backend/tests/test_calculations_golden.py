"""
Golden test del motor de cálculo RENOVA INSPECTOR.

Valida que calcular_* produzca exactamente los mismos resultados que el Excel real.
Cuando exista backend/tests/fixtures/real_sample.xlsx, reemplazar los casos
de DATOS_EXCEL por los valores reales extraídos de ese archivo.

Ver decisions/0002-calc-parity.md para el protocolo completo.
"""

import pytest
from app.core.calculations import (
    calcular_rtd_movi,
    calcular_idi,
    calcular_estado_rtd,
    calcular_estado_presion,
    calcular_vur,
    calcular_tasa_desgaste,
)

# ---------------------------------------------------------------------------
# Umbrales de referencia (valores del Excel real para medida 315/80R22.5)
# ---------------------------------------------------------------------------
RTD_CAMBIO = 4.0    # mm — "Para Reencauche"
RTD_PROXIMO = 7.0   # mm — "Próximo a Reencauche"

PRESION_REF_DIR = 110.0    # PSI — eje Dirección
PRESION_REF_TRAC = 115.0   # PSI — eje Tracción/Libre
DELTA_ALTO = 5.0            # %
DELTA_BAJO = 10.0           # %


# ---------------------------------------------------------------------------
# RTD MOVI — specs §1
# ---------------------------------------------------------------------------
class TestRtdMovi:
    def test_tres_canales_devuelve_minimo(self):
        assert calcular_rtd_movi(10, 9, 7) == 7

    def test_cuatro_canales_devuelve_minimo(self):
        # Bus 8260 posición 7 del Excel real: RTD A=10 B=9 C=7 D=4
        assert calcular_rtd_movi(10, 9, 7, 4) == 4

    def test_todos_iguales(self):
        assert calcular_rtd_movi(8, 8, 8) == 8

    def test_rtd_cero_valido(self):
        assert calcular_rtd_movi(0, 5, 8) == 0

    def test_rtd_negativo_rechazado(self):
        with pytest.raises(ValueError):
            calcular_rtd_movi(-1, 5, 8)

    def test_cuatro_canales_sin_rtd_d_usa_tres(self):
        # rtd_d=None → 3 canales
        assert calcular_rtd_movi(10, 9, 7, None) == 7


# ---------------------------------------------------------------------------
# IDI — specs §4
# ---------------------------------------------------------------------------
class TestIdi:
    def test_bus_8260_pos7_idi_6(self):
        # Caso real del Excel: IDI=6 → anomalía "Desgaste excesivo en hombro interno"
        assert calcular_idi(10, 9, 7, 4) == 6

    def test_desgaste_parejo_idi_0(self):
        assert calcular_idi(8, 8, 8) == 0

    def test_idi_tres_canales(self):
        assert calcular_idi(10, 7, 9) == 3


# ---------------------------------------------------------------------------
# ESTADO RTD — specs §2 (evaluación if/elif secuencial)
# ---------------------------------------------------------------------------
class TestEstadoRtd:
    def test_para_reencauche(self):
        # 3mm ≤ 4mm (rtd_cambio)
        assert calcular_estado_rtd(3, RTD_CAMBIO, RTD_PROXIMO) == "Para Reencauche"

    def test_exactamente_en_limite_cambio(self):
        # 4mm ≤ 4mm → Para Reencauche (límite inclusivo)
        assert calcular_estado_rtd(4, RTD_CAMBIO, RTD_PROXIMO) == "Para Reencauche"

    def test_proximo_reencauche(self):
        # 5mm > 4mm y ≤ 7mm
        assert calcular_estado_rtd(5, RTD_CAMBIO, RTD_PROXIMO) == "Próximo a Reencauche"
        assert calcular_estado_rtd(6, RTD_CAMBIO, RTD_PROXIMO) == "Próximo a Reencauche"
        assert calcular_estado_rtd(7, RTD_CAMBIO, RTD_PROXIMO) == "Próximo a Reencauche"

    def test_normal(self):
        # 8mm > 7mm (rtd_proximo)
        assert calcular_estado_rtd(8, RTD_CAMBIO, RTD_PROXIMO) == "Normal"
        assert calcular_estado_rtd(15, RTD_CAMBIO, RTD_PROXIMO) == "Normal"

    def test_secuencial_no_paralelo(self):
        # 3mm cumple AMBAS condiciones (≤4 Y ≤7) — debe ser Para Reencauche, no Próximo
        result = calcular_estado_rtd(3, RTD_CAMBIO, RTD_PROXIMO)
        assert result == "Para Reencauche", (
            "Error: condición no es secuencial — 3mm clasificado como "
            f"'{result}' en vez de 'Para Reencauche'"
        )


# ---------------------------------------------------------------------------
# ESTADO PRESIÓN — specs §3
# ---------------------------------------------------------------------------
class TestEstadoPresion:
    def test_sin_medir_flag(self):
        assert calcular_estado_presion(None, PRESION_REF_DIR, DELTA_ALTO, DELTA_BAJO, sin_medir=True) == "Sin Medir"

    def test_presion_none_es_sin_medir(self):
        assert calcular_estado_presion(None, PRESION_REF_DIR, DELTA_ALTO, DELTA_BAJO) == "Sin Medir"

    def test_alta_presion_direccion(self):
        # 315/80R22.5 Dirección: ref=110 PSI → Alta desde 116 (110 * 1.05 = 115.5)
        assert calcular_estado_presion(116, PRESION_REF_DIR, DELTA_ALTO, DELTA_BAJO) == "Alta Presión"

    def test_baja_presion_direccion(self):
        # ref=110 PSI → límite bajo = 110*0.90 = 99.0 exacto.
        # Con '<' estricto: 99 es Normal (borde), 98 es Baja.
        assert calcular_estado_presion(99, PRESION_REF_DIR, DELTA_ALTO, DELTA_BAJO) == "Normal"
        assert calcular_estado_presion(98, PRESION_REF_DIR, DELTA_ALTO, DELTA_BAJO) == "Baja Presión"
        assert calcular_estado_presion(90, PRESION_REF_DIR, DELTA_ALTO, DELTA_BAJO) == "Baja Presión"

    def test_normal_direccion(self):
        assert calcular_estado_presion(110, PRESION_REF_DIR, DELTA_ALTO, DELTA_BAJO) == "Normal"
        assert calcular_estado_presion(105, PRESION_REF_DIR, DELTA_ALTO, DELTA_BAJO) == "Normal"

    def test_alta_presion_traccion(self):
        # 315/80R22.5 Tracción: ref=115 PSI → Alta desde 122 (115 * 1.05 = 120.75)
        assert calcular_estado_presion(122, PRESION_REF_TRAC, DELTA_ALTO, DELTA_BAJO) == "Alta Presión"

    def test_baja_presion_traccion(self):
        # ref=115 PSI → Baja desde 103 (115 * 0.90 = 103.5)
        assert calcular_estado_presion(103, PRESION_REF_TRAC, DELTA_ALTO, DELTA_BAJO) == "Baja Presión"

    def test_en_limite_exacto_alto_es_alta(self):
        # 110 * 1.05 = 115.5 → 116 es Alta, 115 es Normal
        assert calcular_estado_presion(115.5, PRESION_REF_DIR, DELTA_ALTO, DELTA_BAJO) == "Normal"
        assert calcular_estado_presion(115.6, PRESION_REF_DIR, DELTA_ALTO, DELTA_BAJO) == "Alta Presión"


# ---------------------------------------------------------------------------
# VUR — specs §8
# ---------------------------------------------------------------------------
class TestVur:
    def test_vur_normal(self):
        # RTD=9mm, cambio=4mm, tasa=1mm/1000km → VUR=5000km
        assert calcular_vur(9, 4, 1.0) == 5000.0

    def test_tasa_none_retorna_none(self):
        assert calcular_vur(9, 4, None) is None

    def test_tasa_cero_retorna_none(self):
        # División por cero → None, no excepción
        assert calcular_vur(9, 4, 0) is None

    def test_tasa_negativa_retorna_none(self):
        # RTD aumentó entre inspecciones → dato inválido
        assert calcular_vur(9, 4, -0.5) is None

    def test_rtd_en_limite_retorna_cero(self):
        # RTD == rtd_cambio → cambio inmediato
        assert calcular_vur(4, 4, 1.0) == 0.0

    def test_rtd_bajo_limite_retorna_cero(self):
        # RTD < rtd_cambio → ya pasó el límite → cambio inmediato
        assert calcular_vur(3, 4, 1.0) == 0.0


# ---------------------------------------------------------------------------
# Tasa de desgaste — specs §7
# ---------------------------------------------------------------------------
class TestTasaDesgaste:
    def test_calculo_normal(self):
        # RTD pasó de 10 a 9mm en 1000km → 1mm/1000km
        assert calcular_tasa_desgaste(10, 9, 0, 1000) == 1.0

    def test_mismo_km_retorna_none(self):
        # No hubo movimiento → no calcular
        assert calcular_tasa_desgaste(10, 9, 1000, 1000) is None

    def test_km_menor_retorna_none(self):
        # Odómetro incorrecto → no calcular
        assert calcular_tasa_desgaste(10, 9, 2000, 1000) is None
