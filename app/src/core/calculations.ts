/**
 * Motor de cálculo RENOVA INSPECTOR.
 * 
 * Funciones puras — sin acceso a DB, sin side effects.
 * Fuente de verdad: specs/reglas_negocio.md
 * Paridad con reference/calculations.py
 */

export function calcularRtdMovi(
  rtdA: number,
  rtdB: number,
  rtdC: number,
  rtdD?: number | null
): number {
  /**
   * RTD MOVI = MIN de los canales medidos.
   * rtdD es undefined/null para posiciones de 3 canales (Dirección, Tracción).
   * rtdD se pasa para posiciones de 4 canales (Libre, Dual).
   * 
   * Lanza Error si algún canal es negativo.
   */
  const canales: number[] = [rtdA, rtdB, rtdC];
  if (rtdD !== undefined && rtdD !== null) {
    canales.push(rtdD);
  }

  for (let i = 0; i < canales.length; i++) {
    if (canales[i] < 0) {
      throw new Error(`RTD canal ${i} negativo: ${canales[i]}`);
    }
  }

  return Math.min(...canales);
}

export function calcularIdi(
  rtdA: number,
  rtdB: number,
  rtdC: number,
  rtdD?: number | null
): number {
  /**
   * IDI = MAX(canales) - MIN(canales).
   * Usa los mismos canales que calcularRtdMovi.
   */
  const canales: number[] = [rtdA, rtdB, rtdC];
  if (rtdD !== undefined && rtdD !== null) {
    canales.push(rtdD);
  }
  return Math.max(...canales) - Math.min(...canales);
}

export function calcularEstadoRtd(
  rtdMovi: number,
  rtdCambio: number,
  rtdProximo: number
): 'Para Reencauche' | 'Próximo a Reencauche' | 'Normal' {
  /**
   * Evaluación SECUENCIAL (if/elif) — no condiciones paralelas.
   * Ver specs/reglas_negocio.md §2.
   * 
   * Retorna: 'Para Reencauche' | 'Próximo a Reencauche' | 'Normal'
   */
  if (rtdMovi <= rtdCambio) {
    return 'Para Reencauche';
  } else if (rtdMovi <= rtdProximo) {
    return 'Próximo a Reencauche';
  } else {
    return 'Normal';
  }
}

export function calcularEstadoPresion(
  presion: number | null | undefined,
  presionRef: number,
  deltaAltoPct: number,
  deltaBajoPct: number,
  sinMedir: boolean = false
): 'Sin Medir' | 'Alta Presión' | 'Baja Presión' | 'Normal' {
  /**
   * Evaluación SECUENCIAL.
   * Ver specs/reglas_negocio.md §3.
   * 
   * presionRef: referencia en frío (o ajustada para CALIENTE cuando se defina).
   * deltaAltoPct: porcentaje de margen superior (ej: 5.0 para +5%).
   * deltaBajoPct: porcentaje de margen inferior (ej: 10.0 para -10%).
   * 
   * Retorna: 'Sin Medir' | 'Alta Presión' | 'Baja Presión' | 'Normal'
   * 
   * NOTA: el ajuste para temperatura CALIENTE no está definido aún.
   * Ver CLAUDE.md "Decisiones abiertas" y specs/reglas_negocio.md §3.
   */
  if (sinMedir || presion === null || presion === undefined) {
    return 'Sin Medir';
  }

  const limiteAlto = presionRef * (1 + deltaAltoPct / 100);
  const limiteBajo = presionRef * (1 - deltaBajoPct / 100);

  if (presion > limiteAlto) {
    return 'Alta Presión';
  } else if (presion < limiteBajo) {
    return 'Baja Presión';
  } else {
    return 'Normal';
  }
}

export function calcularVur(
  rtdMovi: number,
  rtdCambio: number,
  tasaAcumulada: number | null | undefined
): number | null {
  /**
   * VUR (Vida Útil Remanente) en km.
   * Ver specs/reglas_negocio.md §8.
   * 
   * Retorna:
   *   null  → sin datos suficientes (tasa null, 0, o negativa)
   *   0     → cambio inmediato (RTD ya en límite o por debajo)
   *   float → km proyectados hasta rtd_cambio
   */
  if (tasaAcumulada === null || tasaAcumulada === undefined || tasaAcumulada <= 0) {
    return null;
  }

  if (rtdMovi <= rtdCambio) {
    return 0;
  }

  return (rtdMovi - rtdCambio) / tasaAcumulada * 1000;
}

export function calcularTasaDesgaste(
  rtdMoviAnterior: number,
  rtdMoviActual: number,
  kmAnterior: number,
  kmActual: number
): number | null {
  /**
   * Tasa de desgaste en mm/1000km entre dos inspecciones consecutivas.
   * Retorna null si kmActual == kmAnterior (evita división por cero).
   */
  const deltaKm = kmActual - kmAnterior;
  if (deltaKm <= 0) {
    return null;
  }
  const deltaRtd = rtdMoviAnterior - rtdMoviActual;
  return deltaRtd / deltaKm * 1000;
}

export function calcularIsaPeso(desecho: boolean): number {
  /**
   * Peso de severidad para ISA.
   * Ver specs/reglas_negocio.md §6.
   * Los pesos son configurables por empresa — esta función usa los defaults.
   */
  return desecho ? 5 : 1;
}