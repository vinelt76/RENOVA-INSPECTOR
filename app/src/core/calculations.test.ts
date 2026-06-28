import { describe, it, expect } from 'vitest';
import {
  calcularRtdMovi,
  calcularIdi,
  calcularEstadoRtd,
  calcularEstadoPresion,
  calcularVur,
  calcularTasaDesgaste,
  calcularIsaPeso,
} from './calculations';

describe('calcularRtdMovi', () => {
  it('calcula MIN de 3 canales (Dirección/Tracción)', () => {
    expect(calcularRtdMovi(12, 11, 13)).toBe(11);
    expect(calcularRtdMovi(10, 10, 10)).toBe(10);
    expect(calcularRtdMovi(7, 5, 6)).toBe(5);
  });

  it('calcula MIN de 4 canales (Libre/Dual)', () => {
    expect(calcularRtdMovi(12, 11, 13, 10)).toBe(10);
    expect(calcularRtdMovi(16, 16, 16, 16)).toBe(16);
  });

  it('lanza Error si algún canal es negativo', () => {
    expect(() => calcularRtdMovi(-1, 10, 10)).toThrow('RTD canal 0 negativo');
    expect(() => calcularRtdMovi(10, -2, 10)).toThrow('RTD canal 1 negativo');
    expect(() => calcularRtdMovi(10, 10, -3)).toThrow('RTD canal 2 negativo');
    expect(() => calcularRtdMovi(10, 10, 10, -4)).toThrow('RTD canal 3 negativo');
  });
});

describe('calcularIdi', () => {
  it('calcula MAX - MIN para 3 canales', () => {
    expect(calcularIdi(12, 11, 13)).toBe(2);
    expect(calcularIdi(10, 10, 10)).toBe(0);
    expect(calcularIdi(7, 5, 6)).toBe(2);
  });

  it('calcula MAX - MIN para 4 canales', () => {
    expect(calcularIdi(12, 11, 13, 10)).toBe(3);
    expect(calcularIdi(16, 16, 16, 16)).toBe(0);
    expect(calcularIdi(10, 9, 7, 4)).toBe(6);
  });
});

describe('calcularEstadoRtd', () => {
  const rtdCambio = 4;
  const rtdProximo = 7;

  it('retorna "Para Reencauche" cuando RTD MOVI <= rtd_cambio', () => {
    expect(calcularEstadoRtd(3, rtdCambio, rtdProximo)).toBe('Para Reencauche');
    expect(calcularEstadoRtd(4, rtdCambio, rtdProximo)).toBe('Para Reencauche');
    expect(calcularEstadoRtd(0, rtdCambio, rtdProximo)).toBe('Para Reencauche');
  });

  it('retorna "Próximo a Reencauche" cuando RTD MOVI <= rtd_proximo pero > rtd_cambio', () => {
    expect(calcularEstadoRtd(5, rtdCambio, rtdProximo)).toBe('Próximo a Reencauche');
    expect(calcularEstadoRtd(6, rtdCambio, rtdProximo)).toBe('Próximo a Reencauche');
    expect(calcularEstadoRtd(7, rtdCambio, rtdProximo)).toBe('Próximo a Reencauche');
  });

  it('retorna "Normal" cuando RTD MOVI > rtd_proximo', () => {
    expect(calcularEstadoRtd(8, rtdCambio, rtdProximo)).toBe('Normal');
    expect(calcularEstadoRtd(10, rtdCambio, rtdProximo)).toBe('Normal');
    expect(calcularEstadoRtd(15, rtdCambio, rtdProximo)).toBe('Normal');
  });

  it('evalúa SECUENCIALMENTE: rtd=3 con cambio=4/proximo=7 → "Para Reencauche" (no "Próximo")', () => {
    expect(calcularEstadoRtd(3, 4, 7)).toBe('Para Reencauche');
  });
});

describe('calcularEstadoPresion', () => {
  const presionRef = 110;
  const deltaAltoPct = 5;
  const deltaBajoPct = 10;

  it('retorna "Sin Medir" cuando sin_medir=true', () => {
    expect(calcularEstadoPresion(110, presionRef, deltaAltoPct, deltaBajoPct, true)).toBe('Sin Medir');
  });

  it('retorna "Sin Medir" cuando presión es null/undefined', () => {
    expect(calcularEstadoPresion(null, presionRef, deltaAltoPct, deltaBajoPct)).toBe('Sin Medir');
    expect(calcularEstadoPresion(undefined, presionRef, deltaAltoPct, deltaBajoPct)).toBe('Sin Medir');
  });

  it('retorna "Alta Presión" cuando presión > ref * (1 + delta_alto/100)', () => {
    // 110 * 1.05 = 115.5 → alta desde 116
    expect(calcularEstadoPresion(116, presionRef, deltaAltoPct, deltaBajoPct)).toBe('Alta Presión');
    expect(calcularEstadoPresion(120, presionRef, deltaAltoPct, deltaBajoPct)).toBe('Alta Presión');
  });

  it('retorna "Baja Presión" cuando presión < ref * (1 - delta_bajo/100)', () => {
    // 110 * 0.90 = 99 → baja desde 98
    expect(calcularEstadoPresion(98, presionRef, deltaAltoPct, deltaBajoPct)).toBe('Baja Presión');
    expect(calcularEstadoPresion(90, presionRef, deltaAltoPct, deltaBajoPct)).toBe('Baja Presión');
  });

  it('retorna "Normal" cuando presión está en rango', () => {
    // 110 * 0.90 = 99, 110 * 1.05 = 115.5
    expect(calcularEstadoPresion(99, presionRef, deltaAltoPct, deltaBajoPct)).toBe('Normal');
    expect(calcularEstadoPresion(100, presionRef, deltaAltoPct, deltaBajoPct)).toBe('Normal');
    expect(calcularEstadoPresion(110, presionRef, deltaAltoPct, deltaBajoPct)).toBe('Normal');
    expect(calcularEstadoPresion(115, presionRef, deltaAltoPct, deltaBajoPct)).toBe('Normal');
  });

  it('ejemplo real del Excel: 315/80R22.5 Dirección ref=110', () => {
    expect(calcularEstadoPresion(116, 110, 5, 10)).toBe('Alta Presión');
    expect(calcularEstadoPresion(98, 110, 5, 10)).toBe('Baja Presión');
    expect(calcularEstadoPresion(110, 110, 5, 10)).toBe('Normal');
  });

  it('ejemplo real del Excel: 315/80R22.5 Tracción/Libre ref=115', () => {
    expect(calcularEstadoPresion(122, 115, 5, 10)).toBe('Alta Presión');
    expect(calcularEstadoPresion(103, 115, 5, 10)).toBe('Baja Presión');
    expect(calcularEstadoPresion(115, 115, 5, 10)).toBe('Normal');
  });
});

describe('calcularVur', () => {
  it('retorna null si tasa es null/undefined/0/negativa', () => {
    expect(calcularVur(10, 4, null)).toBeNull();
    expect(calcularVur(10, 4, undefined)).toBeNull();
    expect(calcularVur(10, 4, 0)).toBeNull();
    expect(calcularVur(10, 4, -1)).toBeNull();
  });

  it('retorna 0 si RTD MOVI <= rtd_cambio (cambio inmediato)', () => {
    expect(calcularVur(4, 4, 1.5)).toBe(0);
    expect(calcularVur(3, 4, 1.5)).toBe(0);
  });

  it('calcula km proyectados correctamente', () => {
    // (10 - 4) / 1.5 * 1000 = 6 / 1.5 * 1000 = 4000
    expect(calcularVur(10, 4, 1.5)).toBe(4000);
    // (8 - 4) / 0.5 * 1000 = 4 / 0.5 * 1000 = 8000
    expect(calcularVur(8, 4, 0.5)).toBe(8000);
  });
});

describe('calcularTasaDesgaste', () => {
  it('calcula tasa en mm/1000km', () => {
    // (12 - 10) / (10000 - 5000) * 1000 = 2 / 5000 * 1000 = 0.4
    expect(calcularTasaDesgaste(12, 10, 5000, 10000)).toBe(0.4);
  });

  it('retorna null si km_actual <= km_anterior', () => {
    expect(calcularTasaDesgaste(12, 10, 10000, 10000)).toBeNull();
    expect(calcularTasaDesgaste(12, 10, 10000, 5000)).toBeNull();
  });
});

describe('calcularIsaPeso', () => {
  it('retorna 5 para desecho=true', () => {
    expect(calcularIsaPeso(true)).toBe(5);
  });

  it('retorna 1 para desecho=false', () => {
    expect(calcularIsaPeso(false)).toBe(1);
  });
});