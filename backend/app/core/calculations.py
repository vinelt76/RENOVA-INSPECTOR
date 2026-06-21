from typing import Optional, List, Tuple

def calcular_rtd_movi(rtd_a: Optional[float], rtd_b: Optional[float], rtd_c: Optional[float], rtd_d: Optional[float] = None) -> Optional[float]:
    """
    RTD MOVI is the minimum of the active RTD channels.
    """
    vals = [v for v in [rtd_a, rtd_b, rtd_c, rtd_d] if v is not None]
    if not vals:
        return None
    return min(vals)

def calcular_idi(rtd_a: Optional[float], rtd_b: Optional[float], rtd_c: Optional[float], rtd_d: Optional[float] = None) -> Optional[float]:
    """
    IDI = MAX(RTD A..D) - MIN(RTD A..D)
    """
    vals = [v for v in [rtd_a, rtd_b, rtd_c, rtd_d] if v is not None]
    if len(vals) < 2:
        return 0.0  # Or None, but 0.0 means no deviation
    return max(vals) - min(vals)

def calcular_estado_rtd(
    rtd_movi: Optional[float], 
    rtd_cambio: float = 4.0, 
    rtd_proximo: float = 7.0
) -> str:
    """
    Calculates the RTD status:
    - RTD MOVI <= rtd_cambio (default 4mm) -> 'Para Reencauche'
    - RTD MOVI <= rtd_proximo (default 7mm) -> 'Próximo a Reencauche'
    - Otherwise -> 'Normal'
    """
    if rtd_movi is None:
        return "Sin Medir"
    
    if rtd_movi <= rtd_cambio:
        return "Para Reencauche"
    elif rtd_movi <= rtd_proximo:
        return "Próximo a Reencauche"
    else:
        return "Normal"

def calcular_estado_presion(
    presion: Optional[float],
    temperatura: str,  # 'FRÍO' or 'CALIENTE'
    presion_frio_ref: float,
    delta_alto_pct: float = 0.05,
    delta_bajo_pct: float = 0.10,
    caliente_offset: float = 15.0  # Default hot offset: +15 PSI
) -> str:
    """
    Calculates the pressure status:
    - Sin Medir: presion is None
    - Alta Presión: presion > ref_ajustada * (1 + delta_alto_pct)
    - Baja Presión: presion < ref_ajustada * (1 - delta_bajo_pct)
    - Normal: within range
    """
    if presion is None:
        return "Sin Medir"
    
    # Adjust reference pressure for hot tires
    ref_ajustada = presion_frio_ref
    if temperatura.upper() == "CALIENTE":
        ref_ajustada += caliente_offset
        
    limite_alto = ref_ajustada * (1.0 + delta_alto_pct)
    limite_bajo = ref_ajustada * (1.0 - delta_bajo_pct)
    
    # Rounding ratio or values to match excel style roundings if needed
    # We round the limits to 1 decimal place or do direct comparison
    if presion > round(limite_alto, 2):
        return "Alta Presión"
    elif presion < round(limite_bajo, 2):
        return "Baja Presión"
    else:
        return "Normal"
