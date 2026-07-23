export function isActiveAnomaly(value: string | null | undefined): boolean {
  const normalized = String(value ?? '').trim().toLocaleLowerCase('es-PE');
  return normalized !== '' && normalized !== 'normal';
}
