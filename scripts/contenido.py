#!/usr/bin/env python3
"""Capítulos en Markdown + datos estructurados → content/aventura.json y module/aventura.mjs.
Fuentes (carpeta de trabajo): Trabajo AGUAVA/docs/capitulos/NN-*.md y Trabajo AGUAVA/docs/datos.json (generado por docs/datos.py).
Solo se publica el texto de juego: no hay notas de producción ni indicaciones de arte en las fuentes.
Uso: python3 scripts/contenido.py"""
import json, re
from pathlib import Path
import markdown

TRABAJO = Path("/Volumes/Datos_Dock/FoundryVTT/Trabajo AGUAVA/docs")
D = json.load(open(TRABAJO / "datos.json", encoding="utf-8"))
md = lambda t: markdown.markdown(t, extensions=["tables"])
CAP = [  # n, título, corto
 (1, "La premisa: un dojo, un frasco y un día de mucha agua", "Premisa"),
 (2, "Las reglas de Jusenkyo: ¡PAM! 2.0", "Reglas"),
 (3, "Doble forma: Seco y Mojado", "Doble forma"),
 (4, "¡PELEA! Combate de barrio", "¡PELEA!"),
 (5, "Cuatro humanos, cuatro maldiciones", "Personajes"),
 (6, "Un día entero en 120 minutos", "Reloj"),
 (7, "Acto I · Amanecer y desastres en Nerima", "Acto I"),
 (8, "Acto II · La tarde de los cien cubos", "Acto II"),
 (9, "Banco de retos flotantes", "Retos"),
 (10, "Nerima vive sin nosotros", "Cameos"),
 (11, "Acto III · El clímax en la Casa de Baños", "Acto III"),
 (12, "Chuleta de dirección", "Chuleta"),
]
D["capitulos"] = []
for n, titulo, corto in CAP:
    f = next((TRABAJO / "capitulos").glob(f"{n:02d}-*.md"))
    D["capitulos"].append(dict(n=n, titulo=titulo, corto=corto, html=md(f.read_text(encoding="utf-8"))))
Path("content").mkdir(exist_ok=True)
json.dump(D, open("content/aventura.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open("module/aventura.mjs", "w", encoding="utf-8").write("/** Generado por scripts/contenido.py desde la aventura: no editar a mano. */\nexport default " + json.dumps(D, ensure_ascii=False, indent=1) + ";\n")
print("capítulos:", len(D["capitulos"]), "· retos:", len(D["retos"]), "· PJ:", len(D["pjs"]))
