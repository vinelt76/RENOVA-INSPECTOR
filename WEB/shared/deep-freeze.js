/** deepFreeze — congela un valor recursivamente (incluye Maps), sin mutar el input si ya está congelado. */
export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (value instanceof Map) {
    for (const item of value.values()) deepFreeze(item);
  } else {
    Object.values(value).forEach(deepFreeze);
  }
  return Object.freeze(value);
}