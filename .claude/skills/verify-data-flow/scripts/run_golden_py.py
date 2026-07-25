#!/usr/bin/env python3
"""
Ejecuta fixtures/golden.json contra reference/calculations.py y emite JSON por stdout.

No conoce los valores esperados: solo reporta lo que la implementación produce.
La comparación la hace compare_golden.mjs.
"""

import importlib.util
import json
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SKILL_DIR.parent.parent.parent
FIXTURE = SKILL_DIR / "fixtures" / "golden.json"
CALC_PATH = REPO_ROOT / "reference" / "calculations.py"


def cargar_calculations():
    spec = importlib.util.spec_from_file_location("renova_calculations", CALC_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se pudo cargar {CALC_PATH}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    if not CALC_PATH.exists():
        print(json.dumps({"error": f"no existe {CALC_PATH}"}), file=sys.stdout)
        return 2

    calc = cargar_calculations()

    # fn del fixture -> callable de reference/calculations.py
    despacho = {
        "rtdMovi": lambda a: calc.calcular_rtd_movi(a[0], a[1], a[2], a[3]),
        "idi": lambda a: calc.calcular_idi(a[0], a[1], a[2], a[3]),
        "estadoRtd": lambda a: calc.calcular_estado_rtd(a[0], a[1], a[2]),
        "estadoPresion": lambda a: calc.calcular_estado_presion(a[0], a[1], a[2], a[3], a[4]),
        "vur": lambda a: calc.calcular_vur(a[0], a[1], a[2]),
        "tasaDesgaste": lambda a: calc.calcular_tasa_desgaste(a[0], a[1], a[2], a[3]),
        "isaPeso": lambda a: calc.calcular_isa_peso(a[0]),
    }

    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    resultados = {}

    for caso in fixture["casos"]:
        cid = caso["id"]
        fn = caso["fn"]
        if fn not in despacho:
            resultados[cid] = {"estado": "sin_despacho", "detalle": fn}
            continue
        try:
            valor = despacho[fn](caso["args"])
            resultados[cid] = {"estado": "ok", "valor": valor}
        except Exception as exc:  # noqa: BLE001 — se reporta el tipo, no se traga
            resultados[cid] = {"estado": "error", "detalle": f"{type(exc).__name__}: {exc}"}

    print(json.dumps(
        {"impl": "python", "fuente": str(CALC_PATH.relative_to(REPO_ROOT)), "resultados": resultados},
        ensure_ascii=False,
        indent=2,
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
