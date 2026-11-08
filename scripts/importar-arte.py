#!/usr/bin/env python3
"""Arte generado (Trabajo AGUAVA/art/new/*.png) → assets/*.webp del sistema. Reanudable; `--todo` lo rehace todo.
Uso: python3 scripts/importar-arte.py [--todo]
El tipo de cada imagen sale de Trabajo AGUAVA/docs/arte.json:
  token    → personajes/<id>.webp (figura con alfa recortada, alto máx. 1100, marca en la manga) y <id>-cara.webp (cara cuadrada de 512 px sobre trama)
  retrato  → retratos/pj-<clave>.webp (avatar cuadrado de las dos formas, 900 px, marca de esquina)
  escena   → escenas/<clave>.webp + -thumb (1920×1080, recorte 16:9 centrado)
  lamina   → laminas/<id>.webp (ilustraciones de capítulo, 1600 px como mucho, marca de esquina)
  marca/   → logo, portada e icono del sistema"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, "/Volumes/Datos_Dock/FoundryVTT/Trabajo LOGO/marca")
import marca  # noqa: E402  (regla de la casa: toda imagen lleva la marca MR)

TRABAJO = Path("/Volumes/Datos_Dock/FoundryVTT/Trabajo AGUAVA")
SRC = TRABAJO / "art" / "new"
TIPOS = {i["id"]: i["tipo"] for i in json.load(open(TRABAJO / "docs" / "arte.json"))["imagenes"]}
A = Path("assets")
for d in ["personajes", "retratos", "escenas", "laminas", "marca"]: (A / d).mkdir(parents=True, exist_ok=True)
webp = lambda im, p, q=84: im.save(p, "WEBP", quality=q, method=6)
FONDOS = [(255, 210, 63), (18, 165, 214), (255, 158, 192), (242, 84, 45), (120, 200, 160), (255, 170, 60)]
PORTADA_SRC = "pdf-acto2"

def trama(w, h, color):
    """Fondo de color con trama de puntos de imprenta."""
    im = Image.new("RGB", (w, h), color); d = ImageDraw.Draw(im)
    osc = tuple(max(0, c - 40) for c in color)
    for y in range(0, h, 9):
        for x in range((y // 9 % 2) * 4, w, 9): d.ellipse((x, y, x + 2.4, y + 2.4), fill=osc)
    return im

def figura(src, nombre, i):
    im = Image.open(src).convert("RGBA")
    caja = im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    if not caja: raise SystemExit(f"{src}: sin alfa")
    im = im.crop(caja)
    if im.height > 1100: im = im.resize((round(im.width * 1100 / im.height), 1100), Image.LANCZOS)
    # Cara: el tercio superior de la figura, cuadrado, sobre trama (antes de marcar la figura).
    if im.height > im.width * 1.2:
        lado = min(im.width, round(im.height * 0.42))
        cx = (lambda b: (b[0] + b[2]) // 2)(im.crop((0, 0, im.width, max(1, lado // 2))).getchannel("A").getbbox() or (0, 0, im.width, 0))
        x0 = max(0, min(im.width - lado, cx - lado // 2))
        cara = im.crop((x0, 0, x0 + lado, lado)).resize((512, 512), Image.LANCZOS)
    else:  # figuras anchas (nutria, Guía sentado): entera, encajada en el cuadrado
        cara = Image.new("RGBA", (512, 512), (0, 0, 0, 0)); t = im.copy(); t.thumbnail((470, 470), Image.LANCZOS)
        cara.alpha_composite(t, ((512 - t.width) // 2, (512 - t.height) // 2))
    fondo = trama(512, 512, FONDOS[i % len(FONDOS)]).convert("RGBA"); fondo.alpha_composite(cara)
    webp(marca.discreta(fondo.convert("RGB"), 470, 488, 22), A / "personajes" / f"{nombre}-cara.webp")
    webp(marca.hombro(im, fila=0.4) if im.height > im.width * 1.15 else im, A / "personajes" / f"{nombre}.webp", 88)

def escena(src, nombre):
    im = Image.open(src).convert("RGB"); w, h = im.size; nh = round(w * 9 / 16)
    im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh)).resize((1920, 1080), Image.LANCZOS)
    webp(marca.esquina(im), A / "escenas" / f"{nombre}.webp")
    webp(im.resize((400, 225), Image.LANCZOS), A / "escenas" / f"{nombre}-thumb.webp", 78)

def destino(k):
    t = TIPOS.get(k)
    if t == "escena": return A / "escenas" / f"{k[4:]}.webp"
    if t == "retrato": return A / "retratos" / f"{k[:-8]}.webp"
    if t == "lamina": return A / "laminas" / f"{k}.webp"
    return A / "personajes" / f"{k}.webp"

hechos = 0
TODO = "--todo" in sys.argv
for i, f in enumerate(sorted(SRC.glob("*.png"))):
    k = f.stem; t = TIPOS.get(k)
    if t is None: continue
    d = destino(k)
    if not TODO and d.exists() and d.stat().st_mtime > f.stat().st_mtime: continue
    if t == "escena": escena(f, k[4:])
    elif t == "retrato":
        im = Image.open(f).convert("RGB").resize((900, 900), Image.LANCZOS)
        webp(marca.esquina(im), d)
    elif t == "lamina":
        im = Image.open(f).convert("RGB"); im.thumbnail((1600, 1600), Image.LANCZOS)
        webp(marca.esquina(im), d)
    else: figura(f, k, i)
    hechos += 1

# --- Identidad del sistema: logo rotulado, portada e icono ---
def rotulo(texto, alto, relleno, contorno=(15, 29, 51), fnt="scripts/fonts/DelaGothicOne-Regular.ttf"):
    f = ImageFont.truetype(fnt, alto); d = ImageDraw.Draw(Image.new("L", (1, 1)))
    x0, y0, x1, y1 = d.textbbox((0, 0), texto, font=f, stroke_width=alto // 9)
    im = Image.new("RGBA", (x1 - x0 + alto // 6, y1 - y0 + alto // 6), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((-x0 + alto // 6, -y0 + alto // 6), texto, font=f, fill=contorno, stroke_width=alto // 9, stroke_fill=contorno)  # sombra dura
    d.text((-x0, -y0), texto, font=f, fill=relleno, stroke_width=alto // 9, stroke_fill=contorno)
    return im
if (SRC / f"{PORTADA_SRC}.png").exists():
    logo = Image.new("RGBA", (1100, 420), (0, 0, 0, 0))
    a = rotulo("¡AGUA", 170, (255, 210, 63)); b = rotulo("VA!", 170, (18, 165, 214))
    logo.alpha_composite(a.rotate(4, expand=True, resample=Image.BICUBIC), (20, 0)); logo.alpha_composite(b.rotate(4, expand=True, resample=Image.BICUBIC), (300, 190))
    logo = logo.crop(logo.getbbox()); webp(logo, A / "marca" / "logo.webp", 90)
    por = Image.open(SRC / f"{PORTADA_SRC}.png").convert("RGB"); w, h = por.size; nh = round(w * 9 / 16)
    por = por.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh)).resize((1920, 1080), Image.LANCZOS).convert("RGBA")
    l2 = logo.resize((round(logo.width * 0.85), round(logo.height * 0.85)), Image.LANCZOS)
    por.alpha_composite(l2, (60, 50))
    webp(marca.esquina(por.convert("RGB")), A / "marca" / "portada.webp")
if (A / "personajes" / "pj-kenji-mojado-cara.webp").exists():
    ic = Image.open(A / "personajes" / "pj-kenji-mojado-cara.webp").resize((256, 256), Image.LANCZOS); webp(ic, A / "marca" / "icono.webp", 88)
print(hechos, "imágenes importadas")
