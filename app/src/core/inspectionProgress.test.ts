import { describe, expect, it } from 'vitest';
import { assessInspectionPosition } from './inspectionProgress';

describe('assessInspectionPosition', () => {
  it('distingue una posición vacía de una parcialmente medida', () => {
    expect(assessInspectionPosition({})).toEqual({ state: 'empty', invalidFields: [] });
    expect(assessInspectionPosition({ r1: '12' })).toEqual({ state: 'partial', invalidFields: [] });
  });

  it('marca como inválidos los valores fuera de los rangos aprobados', () => {
    expect(assessInspectionPosition({ r1: '23', r2: '12', r3: '12', presion: '201' })).toEqual({
      state: 'invalid', invalidFields: ['r1', 'presion'],
    });
  });

  it('marca completa una posición con tres remanentes y presión válidos', () => {
    expect(assessInspectionPosition({ r1: '12', r2: '11.5', r3: '12', presion: '110' })).toEqual({
      state: 'complete', invalidFields: [],
    });
  });
});
