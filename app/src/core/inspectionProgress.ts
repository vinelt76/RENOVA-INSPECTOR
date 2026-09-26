export type InspectionPositionState = 'empty' | 'partial' | 'invalid' | 'complete';

export interface InspectionPositionAssessment {
  state: InspectionPositionState;
  invalidFields: string[];
}

type InspectionValues = Partial<Record<'r1' | 'r2' | 'r3' | 'r4' | 'presion', string>>;

const REMANENTE_MIN_MM = 0;
const REMANENTE_MAX_MM = 22;
const PRESION_MIN_PSI = 60;
const PRESION_MAX_PSI = 200;

function outOfRange(value: string | undefined, min: number, max: number): boolean {
  if (!value) return false;
  const numeric = Number(value);
  return !Number.isFinite(numeric) || numeric < min || numeric > max;
}

export function assessInspectionPosition(values: InspectionValues): InspectionPositionAssessment {
  const invalidFields = (['r1', 'r2', 'r3', 'r4'] as const)
    .filter(key => outOfRange(values[key], REMANENTE_MIN_MM, REMANENTE_MAX_MM));
  const invalid: string[] = [...invalidFields];
  if (outOfRange(values.presion, PRESION_MIN_PSI, PRESION_MAX_PSI)) invalid.push('presion');
  if (invalid.length) return { state: 'invalid', invalidFields: invalid };

  const measured = ['r1', 'r2', 'r3', 'r4', 'presion'].some(key => Boolean(values[key as keyof InspectionValues]));
  if (!measured) return { state: 'empty', invalidFields: [] };
  if (values.r1 && values.r2 && values.r3 && values.presion) return { state: 'complete', invalidFields: [] };
  return { state: 'partial', invalidFields: [] };
}
