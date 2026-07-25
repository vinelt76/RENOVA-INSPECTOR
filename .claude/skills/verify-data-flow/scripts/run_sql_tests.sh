#!/usr/bin/env bash
# Corre los tests de supabase/tests/*.sql — bloques `do $$ ... $$` autorreversibles que
# terminan con `raise exception 'TESTS_PASSED'` para forzar rollback (nunca dejan datos).
#
# REQUIERE una base de datos con permiso de ESCRITURA. NO correr contra producción sin
# autorización explícita del usuario (regla de este repo: CLAUDE.md "Cierre proporcional al
# cambio" — no aplicar cambios remotos destructivos o difíciles de revertir sin aprobación).
# La forma segura es una branch efímera de Supabase (mcp__supabase__create_branch) o una
# instancia local (`supabase start`).
#
# Uso:
#   DATABASE_URL="postgresql://...connection-string-de-la-branch-o-local..." \
#     ./run_sql_tests.sh
#
# Cada archivo corre independiente; un fallo no detiene a los demás. El script reporta
# PASSED/FAILED por archivo al final.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
TESTS_DIR="$REPO_ROOT/supabase/tests"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: define DATABASE_URL apuntando a una branch efímera o instancia local — nunca a producción sin autorización." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql no está instalado." >&2
  exit 2
fi

declare -a resultados=()
exit_code=0

for f in "$TESTS_DIR"/*.test.sql; do
  name="$(basename "$f")"
  echo ""
  echo "=== $name ==="
  # TESTS_PASSED se lanza como excepción a propósito (rollback); psql devuelve error igual —
  # distinguimos por el texto del mensaje, no por el exit code.
  output="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -f "$f" 2>&1)"
  if echo "$output" | grep -q "TESTS_PASSED"; then
    resultados+=("PASSED  $name")
  else
    resultados+=("FAILED  $name")
    exit_code=1
    echo "$output" | tail -20
  fi
done

echo ""
echo "=== Resumen ==="
printf '%s\n' "${resultados[@]}"

exit "$exit_code"
