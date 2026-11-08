#!/usr/bin/env python3
"""Compone las cuatro cortinillas con content/capas.json para revisar a ojo que Porco sale del tronco y el Sol/Luna caen en el cielo.
Uso: python3 scripts/comprobar-capas.py [salida.jpg]"""
import json, sys
from PIL import Image
C = json.load(open("content/capas.json")); out = Image.new("RGB", (1920, 1080))
for i, (k, capas) in enumerate(C.items()):
    bg = Image.open(f"assets/escenas/{k}.webp").convert("RGBA")
    for a, x, y, h in capas:
        im = Image.open(f"assets/personajes/{a}.webp").convert("RGBA"); im = im.resize((round(im.width * h / im.height), h)); bg.alpha_composite(im, (x, y))
    out.paste(bg.convert("RGB").resize((960, 540)), (960 * (i % 2), 540 * (i // 2)))
out.save(sys.argv[1] if len(sys.argv) > 1 else "/tmp/capas.jpg", quality=88)
