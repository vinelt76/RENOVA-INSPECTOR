/** Normaliza texto para búsquedas tolerantes a mayúsculas, espacios y acentos. */
export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Filtra filas por tokens AND. Cada token puede aparecer en una columna
 * distinta; las columnas buscables las decide cada consumidor.
 */
export function filterRowsBySearchTokens(rows, query = "", searchableColumns = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const columns = Array.isArray(searchableColumns) ? searchableColumns : [];
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [...safeRows];

  return safeRows.filter((row) => {
    const haystack = normalizeSearchText(columns.map((column) => row?.[column]).join(" "));
    return tokens.every((token) => haystack.includes(token));
  });
}
