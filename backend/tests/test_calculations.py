from backend.app.core.calculations import (
    calcular_rtd_movi,
    calcular_idi,
    calcular_estado_rtd,
    calcular_estado_presion
)

def test_calcular_rtd_movi():
    # 3 active channels
    assert calcular_rtd_movi(8.0, 9.0, 7.0) == 7.0
    # 4 active channels
    assert calcular_rtd_movi(10.0, 11.5, 9.0, 8.5) == 8.5
    # Some channels missing
    assert calcular_rtd_movi(None, 6.0, None) == 6.0
    # All channels missing
    assert calcular_rtd_movi(None, None, None) is None

def test_calcular_idi():
    # Regular values
    assert calcular_idi(8.0, 9.0, 7.0) == 2.0
    # Single value (no deviation possible)
    assert calcular_idi(8.0, None, None) == 0.0
    # Extreme deviation
    assert calcular_idi(12.0, 6.0, 10.0, 5.0) == 7.0
    # All missing
    assert calcular_idi(None, None, None) == 0.0

def test_calcular_estado_rtd():
    # Default thresholds: cambio=4.0, proximo=7.0
    assert calcular_estado_rtd(None) == "Sin Medir"
    assert calcular_estado_rtd(3.5) == "Para Reencauche"
    assert calcular_estado_rtd(4.0) == "Para Reencauche"
    assert calcular_estado_rtd(5.0) == "Próximo a Reencauche"
    assert calcular_estado_rtd(7.0) == "Próximo a Reencauche"
    assert calcular_estado_rtd(8.0) == "Normal"

def test_calcular_estado_presion_frio():
    # Ref pressure: 110 PSI
    # Delta high: +5% (115.5 PSI), Delta low: -10% (99 PSI)
    assert calcular_estado_presion(None, "FRÍO", 110.0) == "Sin Medir"
    assert calcular_estado_presion(105.0, "FRÍO", 110.0) == "Normal"
    assert calcular_estado_presion(116.0, "FRÍO", 110.0) == "Alta Presión"
    assert calcular_estado_presion(98.0, "FRÍO", 110.0) == "Baja Presión"

def test_calcular_estado_presion_caliente():
    # Ref pressure: 110 PSI
    # Caliente offset: +15 PSI -> Adjusted ref: 125 PSI
    # Delta high: +5% (131.25 PSI), Delta low: -10% (112.5 PSI)
    assert calcular_estado_presion(120.0, "CALIENTE", 110.0) == "Normal"
    assert calcular_estado_presion(135.0, "CALIENTE", 110.0) == "Alta Presión"
    assert calcular_estado_presion(110.0, "CALIENTE", 110.0) == "Baja Presión"
