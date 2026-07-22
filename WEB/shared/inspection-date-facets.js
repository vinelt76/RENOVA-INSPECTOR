const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { iso: `${match[1]}-${match[2]}-${match[3]}`, year: match[1], month, day };
}

export function formatInspectionDate(value) {
  const parsed = parseDateOnly(value);
  return parsed ? `${parsed.day} ${MONTH_NAMES[parsed.month - 1]} ${parsed.year}` : null;
}

export function formatInspectionMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value ?? "").trim());
  const month = match ? Number(match[2]) : NaN;
  return match && month >= 1 && month <= 12 ? `${MONTH_NAMES[month - 1]} ${match[1]}` : null;
}

export function distinctInspectionDateValues(rows, field = "lastInspectionOn") {
  const dates = distinctInspectionIsoDates(rows, field);
  const months = [...new Set(dates.map((date) => date.slice(0, 7)))].sort().reverse();
  return [
    ...dates.map(formatInspectionDate),
    ...months.map(formatInspectionMonth),
  ];
}

export function distinctInspectionExactDateValues(rows, field = "lastInspectionOn") {
  return distinctInspectionIsoDates(rows, field).map(formatInspectionDate);
}

function distinctInspectionIsoDates(rows, field) {
  return [...new Set((Array.isArray(rows) ? rows : [])
    .map((row) => parseDateOnly(row?.[field])?.iso)
    .filter(Boolean))].sort().reverse();
}

export function distinctInspectionMonthValues(rows, field = "lastInspectionOn") {
  const months = [...new Set((Array.isArray(rows) ? rows : [])
    .map((row) => parseDateOnly(row?.[field])?.iso.slice(0, 7))
    .filter(Boolean))].sort().reverse();
  return months.map(formatInspectionMonth);
}

export function matchInspectionDateFacet(row, value, field = "lastInspectionOn") {
  const parsed = parseDateOnly(row?.[field]);
  if (!parsed || !value) return false;
  const expected = String(value).trim();
  return formatInspectionDate(parsed.iso) === expected
    || parsed.iso === expected
    || formatInspectionMonth(parsed.iso.slice(0, 7)) === expected;
}

export function matchInspectionMonthFacet(row, value, field = "lastInspectionOn") {
  const parsed = parseDateOnly(row?.[field]);
  return Boolean(parsed && value && formatInspectionMonth(parsed.iso.slice(0, 7)) === String(value).trim());
}
