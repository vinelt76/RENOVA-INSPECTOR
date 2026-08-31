#!/usr/bin/env python3
"""Genera los documentos de propuesta.

Toma las plantillas de _src/, inyecta la hoja de estilo compartida y las fuentes
de marca como data URI, y escribe los HTML finales en propuesta/.

Uso:  python3 propuesta/_src/build.py
"""
import base64
import pathlib
import re

SRC = pathlib.Path(__file__).resolve().parent
OUT = SRC.parent
REPO = OUT.parent
ASSETS = REPO / "deploy-static" / "assets"

FONTS = {
    "__BEBAS_400__": "bebas-neue-latin-400-normal-9mHNbWWO.woff2",
    "__MONO_400__": "jetbrains-mono-latin-400-normal-V6pRDFza.woff2",
    "__MONO_700__": "jetbrains-mono-latin-700-normal-BYuf6tUa.woff2",
    "__MONO_800__": "jetbrains-mono-latin-800-normal-D2mQHRMK.woff2",
}

DOCS = {
    "cliente.html": "Propuesta - Modulo Inspecciones RENOVA.html",
    "interno.html": "INTERNO - Appliance arquitectura y ejecucion.html",
}


def estilo_con_fuentes() -> str:
    css = (SRC / "estilo.css").read_text(encoding="utf-8")
    for token, filename in FONTS.items():
        path = ASSETS / filename
        if not path.exists():
            raise SystemExit(f"Falta la fuente: {path}")
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        css = css.replace(token, f"data:font/woff2;base64,{b64}")
    return css


def main() -> None:
    css = estilo_con_fuentes()
    for plantilla, destino in DOCS.items():
        html = (SRC / plantilla).read_text(encoding="utf-8")
        html = html.replace("__ESTILO__", css)

        leftovers = set(re.findall(r"__[A-Z0-9_]+__", html))
        if leftovers:
            raise SystemExit(f"{plantilla}: placeholders sin resolver: {leftovers}")

        (OUT / destino).write_text(html, encoding="utf-8")
        print(f"OK  {destino}  ({len(html) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
