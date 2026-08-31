import { describe, expect, it } from 'vitest';
import { isActiveAnomaly } from './FormBody';

describe('isActiveAnomaly', () => {
  it('no presenta Normal como una anomalía activa', () => {
    expect(isActiveAnomaly('Normal')).toBe(false);
    expect(isActiveAnomaly(' normal ')).toBe(false);
  });

  it('mantiene la alerta para una anomalía real', () => {
    expect(isActiveAnomaly('Corte profundo en flanco')).toBe(true);
  });

  it('no alerta por un valor vacío', () => {
    expect(isActiveAnomaly('')).toBe(false);
    expect(isActiveAnomaly(null)).toBe(false);
  });
});
