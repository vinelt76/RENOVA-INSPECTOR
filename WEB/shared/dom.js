/**
 * createElement — helper DOM para tests y producción.
 * Acepta dos firmas:
 *   createElement(documentObject, tagName, className, text)  // documentObject inyectado (tests)
 *   createElement(tagName, className, text)                   // document global (dashboards)
 */
// Firma 3-arg: primer arg = tag string → document global.
// Firma 4-arg: primer arg = documentObject inyectado (tests).
// Nunca caer a document para undefined/null: falla claro en node.
export function createElement(a, b, c, d) {
  const useGlobal = typeof a === 'string';
  const doc = useGlobal ? document : a;
  const tagName = useGlobal ? a : b;
  const className = useGlobal ? b : c;
  const text = useGlobal ? c : d;
  const element = doc.createElement(tagName);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}