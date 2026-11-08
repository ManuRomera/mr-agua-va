#!/usr/bin/env python3
"""Capturas de Foundry (Trabajo AGUAVA/capturas/*.png, 2880×1800) y PDF → montajes de docs/img para el README.
Uso: python3 tools/montajes.py"""
import math
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

CAP = Path("/Volumes/Datos_Dock/FoundryVTT/Trabajo AGUAVA/capturas"); OUT = Path("docs/img"); OUT.mkdir(parents=True, exist_ok=True)
PDF = Path("/Volumes/Datos_Dock/FoundryVTT/Trabajo AGUAVA/pdf/MR-Agua-Va.pdf")
TINTA = (15, 29, 51)
img = lambda n: Image.open(CAP / f"{n}.png").convert("RGB")
guardar = lambda im, n, q=86: im.save(OUT / f"{n}.webp", "WEBP", quality=q, method=6)

def fondo(w, h, c1=(18, 165, 214), c2=(110, 214, 240)):
    """Rayos de historieta azules con trama de puntos."""
    im = Image.new("RGB", (w, h), c1); d = ImageDraw.Draw(im); cx, cy = w / 2, h / 2; R = math.hypot(w, h); n = 48
    for i in range(0, n, 2):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        d.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)), (cx + R * math.cos(a1), cy + R * math.sin(a1))], fill=c2)
    for y in range(0, h, 14):
        for x in range((y // 14 % 2) * 7, w, 14): d.ellipse((x, y, x + 3, y + 3), fill=(8, 135, 185))
    return im

def sombra(im, d=10):
    w, h = im.size; out = Image.new("RGBA", (w + 6 + d, h + 6 + d), (0, 0, 0, 0)); dr = ImageDraw.Draw(out)
    dr.rectangle((d, d, w + 5 + d, h + 5 + d), fill=TINTA + (255,)); dr.rectangle((0, 0, w + 5, h + 5), fill=TINTA + (255,)); out.paste(im, (3, 3)); return out

def rejilla(ims, cols, ancho, hueco=26, margen=40):
    t = [sombra(i.resize((ancho, round(i.height * ancho / i.width)), Image.LANCZOS)) for i in ims]
    filas = [t[i:i + cols] for i in range(0, len(t), cols)]
    W = margen * 2 + cols * t[0].width + (cols - 1) * hueco; alto_f = [max(x.height for x in f) for f in filas]; H = margen * 2 + sum(alto_f) + hueco * (len(filas) - 1)
    lienzo = fondo(W, H).convert("RGBA"); y = margen
    for f, ah in zip(filas, alto_f):
        x = margen + (W - 2 * margen - len(f) * t[0].width - (len(f) - 1) * hueco) // 2
        for im in f: lienzo.alpha_composite(im, (x, y)); x += im.width + hueco
        y += ah + hueco
    return lienzo.convert("RGB")

guardar(rejilla([img(k).resize((1440, 900), Image.LANCZOS) for k in ["c-amanecer", "c-mediodia", "c-noche", "c-nuevo"]], 2, 760), "cortinillas")
# Fichas: ventana centrada de ~1190×1080 px (a 1440×900 css), en las dos formas
ficha = lambda n: img(n).crop((580, 110, 2310, 1690))
guardar(rejilla([ficha("f-kenji-seco"), ficha("f-kenji-mojado"), ficha("f-mako-seco"), ficha("f-mako-mojado")], 2, 700), "fichas", 84)
guardar(rejilla([img("pelea-medio").resize((1600, 1000), Image.LANCZOS), img("pelea-ronda").resize((1600, 1000), Image.LANCZOS)], 1, 1100), "pelea", 84)
guardar(rejilla([img("panel-mesa"), img("panel-pelea"), img("panel-retos")], 3, 520), "panel", 84)
guardar(img("diario").resize((1600, 1000), Image.LANCZOS), "diario", 84)

# PDF: portada, versus, ficha, retos y contraportada
d = fitz.open(PDF); n = len(d)
def pag(i, dpi=70):
    pm = d[i].get_pixmap(dpi=dpi); return Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
buscar = lambda texto: next(i for i in range(n) if texto in d[i].get_text())
paginas = [0, buscar("Cómo se ve en Foundry") - 3 if False else 8, buscar("Kenji"), buscar("R01"), n - 1]
guardar(rejilla([pag(i) for i in [0, 9, buscar("SECO") , buscar("R01"), n - 1]], 5, 330, hueco=16, margen=30), "pdf", 84)
print("montajes listos")
