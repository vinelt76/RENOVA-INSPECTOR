/**
 * getFetchView — resuelve el cliente RenovaSupabase.fetchView inyectable
 * (función directa, cliente o globalThis.RenovaSupabase) para tests y dashboards.
 */
export function getFetchView(dependency) {
  if (typeof dependency === "function") return dependency;

  const client = dependency ?? globalThis.RenovaSupabase;
  if (typeof client?.fetchView !== "function") {
    throw new TypeError("RenovaSupabase.fetchView no está disponible");
  }
  return client.fetchView.bind(client);
}

/** normalizeNumericColumns — coerce a Number las columnas numéricas de una fila. */
export function normalizeNumericColumns(row, columns) {
  const normalized = { ...row };
  for (const column of columns) {
    if (normalized[column] != null) normalized[column] = Number(normalized[column]);
  }
  return normalized;
}