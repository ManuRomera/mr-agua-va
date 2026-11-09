#!/usr/bin/env python3
"""PDF de la aventura con aspecto de especial de revista de anime de 1990 (B5, papel tintado por secciones, páginas a color).
content/aventura.json + assets/ → «Trabajo AGUAVA/pdf/aguava.html» → Chrome headless → PDF.
Solo lleva texto de juego: no hay notas de producción ni indicaciones de arte en las fuentes.
Uso: python3 scripts/pdf.py [salida.pdf]"""
import html, json, subprocess, sys
from pathlib import Path

RAIZ = Path.cwd()
OUT = Path("/Volumes/Datos_Dock/FoundryVTT/Trabajo AGUAVA/pdf"); OUT.mkdir(parents=True, exist_ok=True)
PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT / "MR-Agua-Va.pdf"
AV = json.load(open("content/aventura.json", encoding="utf-8"))
SYS = json.load(open("system.json"))
CACHE = OUT / "img"; CACHE.mkdir(exist_ok=True)

def A(p):
    """Las ilustraciones opacas van a Chrome como JPEG (las incrusta sin recomprimir); las figuras con alfa, tal cual."""
    src = RAIZ / "assets" / p
    from PIL import Image
    if p.startswith("personajes/") and not p.endswith("-cara.webp") or p.startswith("marca/logo"):
        dst = CACHE / (p.replace("/", "_").rsplit(".", 1)[0] + ".png")
        if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            im = Image.open(src); im.thumbnail((900, 900), Image.LANCZOS)
            im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(dst, optimize=True)
        return dst.as_uri()
    dst = CACHE / (p.replace("/", "_").rsplit(".", 1)[0] + ".jpg")
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        im = Image.open(src).convert("RGB")
        if im.width > 1500: im = im.resize((1500, round(im.height * 1500 / im.width)), Image.LANCZOS)
        im.save(dst, "JPEG", quality=82, optimize=True)
    return dst.as_uri()
hay = lambda p: (RAIZ / "assets" / p).exists()
e = html.escape
cap = {c["n"]: c for c in AV["capitulos"]}
md_inline = lambda t: e(t).replace("`", "")

def img(p, clase="", alt=""):
    return f'<img class="{clase}" src="{A(p)}" alt="{e(alt)}">' if hay(p) else ""

import re
def limpia(h):
    """HTML del capítulo para papel: un titular seguido de tabla viaja con ella (si no, queda huérfano al pie de la página)."""
    return re.sub(r"(<h[23]>(?:(?!</h[23]>).)*</h[23]>\s*)(<table>.*?</table>)", r'<div class="bloque-tabla">\1\2</div>', h, flags=re.S)

KANA = {1: "はじまり", 2: "ルール", 3: "みず", 4: "たたかい", 5: "ひみつ", 6: "じかん", 7: "あさ", 8: "ひる", 9: "ネリマ", 10: "ともだち", 11: "よる", 12: "メモ"}
PAPEL = {1: "crema", 2: "crema", 3: "celeste", 4: "arcade", 5: "rosa", 6: "crema", 7: "rosa", 8: "celeste", 9: "verde", 10: "crema", 11: "noche", 12: "crema"}
LAMINA = {1: "laminas/bn-vapor.webp", 2: "laminas/bn-dados.webp", 3: "laminas/bn-chapuzon.webp", 6: "laminas/bn-termo.webp", 9: "laminas/bn-cartel.webp", 10: "laminas/bn-cameos.webp"}
SPLASH = {7: ("laminas/pdf-acto1.webp", "¡Una bomba de agua en la puerta del dojo!", "rojo"), 8: ("laminas/pdf-acto2.webp", "«Esa nutria es profesional.»", "rojo"),
          11: ("laminas/pdf-acto3.webp", "«Recuerden: el agua fría es amiga… hasta que deja de serlo.»", "noche")}
SECCIONES = [(n, PAPEL[n]) for n in range(1, 13)]
EP = {n: n for n in range(1, 13)}

def titulo_cap(n, titulo, papel, lamina=None):
    return f'''<section class="cap {papel}" id="c{n}">
  <header class="cap-cab"><span class="cap-num">EPISODIO <b>{EP[n]}</b></span><h1>{e(titulo)}</h1><span class="kana">{KANA.get(n, "")}</span></header>
  {f'<figure class="lamina-bn">{img(lamina)}</figure>' if lamina and hay(lamina) else ""}'''

def splash(n, titulo, lamina, frase, color="rojo"):
    return f'''<section class="splash {color}">
  {img(lamina, "fondo")}
  <div class="splash-rotulo"><span class="cap-num">EPISODIO <b>{EP[n]}</b> · A TODO COLOR</span><h1>{e(titulo)}</h1></div>
  <p class="splash-frase">{e(frase)}</p>
</section>'''

# ---------- Portada ----------
portada = f'''<section class="portada">
  {img("laminas/pdf-portada.webp", "fondo")}
  <div class="cabecera-revista"><span class="cr-semanal">SEMANAL</span><span class="cr-logo">¡PAM!</span>
    <span class="cr-num">ESPECIAL<br>VERANO<br><b>1990</b></span></div>
  <div class="precio">120<small>MIN</small></div>
  <div class="estallido e1">¡NUEVA AVENTURA<br>COMPLETA!</div>
  <div class="estallido e2">¡4 MALDITOS<br>A TODO COLOR!</div>
  <div class="estallido e3">¡PELEA!<br>COMBATES DE<br>RECREATIVA</div>
  {img("marca/logo.webp", "logo-portada")}
  <div class="portada-pie"><span>ESPECIAL NERIMA · PARTIDA FAN NO OFICIAL · REGLAS ¡PAM! 2.0 INCLUIDAS</span><i class="barras"></i></div>
</section>'''

# ---------- Índice ----------
indice_filas = "".join(f'<li><a href="#c{n}"><span class="ix-n">{EP[n]:02d}</span><b>{e(cap[n]["titulo"])}</b><span class="ix-p"></span></a></li>' for n, _ in SECCIONES)
indice = f'''<section class="indice">
  <h1 class="ix-titulo">ÍNDICE <small>もくじ</small></h1>
  <div class="ix-promesa"><p class="globo">{e(AV["promesa"][0].upper() + AV["promesa"][1:])}</p>{img("personajes/guia-manana.webp", "ix-porco")}</div>
  <ol class="ix-lista">{indice_filas}<li><a href="#fichas"><span class="ix-n">EX</span><b>Fichas privadas para recortar</b></a></li></ol>
  <div class="staff"><b>STAFF</b> Aventura y sistema: Manu Romera · Arte: generado con IA para esta partida a partir de diseños propios · Rótulos: Dela Gothic One, Zen Maru Gothic y Press Start 2P (OFL) · Versión {SYS["version"]} para Foundry VTT 13–14.
  <br><em>Partida fan, original y no oficial, ambientada en el barrio de Nerima y en el espíritu de las comedias de artes marciales de los años 90. Sin ánimo de lucro. Para 2–4 participantes y dirección; 120 minutos; comedia de enredos para mesa adulta o juvenil.</em></div>
</section>'''

# ---------- Pantalla de versus (antes de ¡PELEA!) ----------
versus = f'''<section class="versus">
  <div class="vs-hud">
    <div class="vs-izq"><div class="vs-nombre">Kenji «Plancha de Hierro»</div><div class="vs-barra"><i></i></div></div>
    <div class="vs-reloj">06</div>
    <div class="vs-der"><div class="vs-nombre">Capitán Hidetoshi</div><div class="vs-barra"><i></i></div></div>
  </div>
  {img("personajes/pj-kenji-seco.webp", "vs-fig vs-izq-fig")}{img("personajes/pnj-hidetoshi.webp", "vs-fig vs-der-fig")}
  <div class="vs-vs">VS</div>
  <div class="vs-pie">¡PELEA!<small>Golpe &gt; Presa &gt; Parada &gt; Golpe · Dignidad · Furia · Técnica Secreta</small></div>
</section>'''

# ---------- Personajes ----------
def ficha_pj(p):
    k = p["clave"]
    return f'''<section class="pj2">
  <div class="pj-fondo"></div>
  <header><h1>{e(p["nombre"])}</h1><span class="pj-titulo">«{e(p["apodo"])}»</span><span class="pj-estilo">{e(p["estilo"])}</span></header>
  {img(f"laminas/pj-{k}-cuerpo.webp", "pj2-cuerpo")}
  {img(f"retratos/pj-{k}.webp", "pj2-dual")}
  <p class="globo pj-frase">«{e(p["lema"])}»</p>
  <div class="pj2-formas">
    <div class="forma-caja seco"><h2>SECO <span>humano</span></h2><dl><dt>Talento Marcial</dt><dd>{e(p["marcial"])}</dd><dt>Técnica Secreta</dt><dd>{e(p["tecnica"])}</dd><dt>Vínculos</dt><dd>{e(p["vinculo"])}</dd></dl></div>
    <div class="forma-caja mojado"><h2>MOJADO <span>{e(p["animal"])}</span></h2><dl><dt>{e(p["maldicion"])}</dt><dd>{e(p["descripcion_animal"])}</dd><dt>Talento de Bestia</dt><dd>{e(p["bestia"])}</dd><dt>Defecto cómico</dt><dd>{e(p["defecto"])}</dd></dl></div>
  </div>
  <div class="pj2-secreto"><b>SOLO DIRECCIÓN Y JUGADOR</b> Secreto vergonzoso: {e(p["secreto"])} <b>Confesión posible</b> {e(p["confesion"])}<br><b>Reto personal</b> {e(p["reto"])}</div>
</section>'''

# ---------- Retos en tarjetas ----------
def reto(r):
    sellos = (f'<span class="reto-sello tab">Tablilla {r["tablilla"]}</span>' if r.get("tablilla") else "") + ('<span class="reto-sello">¡PELEA!</span>' if r.get("pelea") else "")
    return f'''<article class="reto"><header><span class="reto-cod">{r["id"]}</span><h3>{md_inline(r["titulo"])}</h3><span class="reto-sellos">{sellos}</span><small>{e(r["quien"])} · {e(r["cuando"])}</small></header>
  <p><b>Situación</b> {md_inline(r["situacion"])}</p><p><b>Urgencia</b> {md_inline(r["urgencia"])}</p><p><b>Opciones</b> {md_inline(r["opciones"])}</p>
  <p><b>Giro de agua</b> {md_inline(r["giro"])}</p><p><b>Secuela</b> {md_inline(r["secuela"])}</p></article>'''

def cameo(c):
    return f'''<article class="cameo"><h3>{e(c["nombre"])}</h3><p><b>1 · Avistamiento</b> {e(c["paso1"])}</p><p><b>2 · Roce</b> {e(c["paso2"])}</p><p><b>3 · Despedida</b> {e(c["paso3"])}</p></article>'''

# ---------- Galerías ----------
VEC = [("guia-manana", "Guía de Jusenkyo"), ("pnj-hidetoshi", "Capitán Hidetoshi"), ("pnj-esbirro", "La Pandilla del Cisne"), ("pnj-mariko", "Mariko"), ("pnj-yuzuki", "Maestro Yuzuki"),
       ("pnj-matsu", "Maestra Matsu"), ("pnj-tendera", "Señora Sawa"), ("pnj-ramen", "Tío del ramen"), ("pnj-notario", "El notario"),
       ("pj-kenji-mojado", "Kenji (avestruz)"), ("pj-mako-mojado", "Mako (nutria)"), ("pj-daiki-mojado", "Daiki (cabra)"), ("pj-yumi-mojado", "Yumi (macaco)")]
vecinos = "".join(f'<figure>{img(f"personajes/{k}-cara.webp")}<figcaption>{e(n)}</figcaption></figure>' for k, n in VEC if hay(f"personajes/{k}-cara.webp"))
ESC = sorted(p.stem for p in (RAIZ / "assets/escenas").glob("*.webp") if not p.stem.endswith("thumb"))
NOMBRES = {"00-amanecer": "Amanecer", "01-mediodia": "Mediodía", "02-noche": "Noche", "03-nuevo-amanecer": "Nuevo amanecer", "04-dojo-exterior": "El Bambú Torcido", "05-dojo-interior": "Dentro del dojo",
           "06-calle-nerima": "La calle comercial", "07-mercadillo": "El mercadillo", "08-supermercado": "El supermercado", "09-canal": "El canal", "10-jardin-te": "El jardín de té",
           "11-lavanderia": "La lavandería", "12-bano-exterior": "El Vapor Feliz", "13-bano-interior": "La sala de baños", "14-calderas": "Las calderas", "15-tejados": "Los tejados", "16-estanque-caos": "El estanque"}
decorados = "".join(f'<figure>{img(f"escenas/{k}-thumb.webp")}<figcaption>{e(NOMBRES.get(k, k))}</figcaption></figure>' for k in ESC)

fichas = "".join(f'''<div class="recorte"><h3>{e(p["nombre"])} <small>«{e(p["apodo"])}»</small></h3>
  <p><b>Talento Marcial</b> {e(p["marcial"])}</p><p><b>Talento de Bestia ({e(p["animal"])})</b> {e(p["bestia"])}</p><p><b>Defecto cómico</b> {e(p["defecto"])}</p>
  <p><b>Mi secreto vergonzoso</b> {e(p["secreto"])}</p><p><b>Si algún día lo confieso…</b> ____________________________________________</p></div>''' for p in AV["pjs"])

FIGURAS = ["guia-mediodia", "pj-kenji-mojado", "pj-mako-mojado", "guia-noche", "pj-daiki-mojado", "pj-yumi-mojado", "pnj-matsu", "pnj-mariko", "guia-amanecer", "pnj-yuzuki", "pnj-hidetoshi", "pnj-tendera"]
def construir(rellenos):
  def RELLENO(n):
    alto = min(rellenos.get(n, 0), 95)
    marca = f'<span class="fincap">FINCAP{n:02d}</span>'
    if alto < 40: return marca
    fig = FIGURAS[n % len(FIGURAS)]
    return f'<div class="continuara" style="height:{alto}mm">{img(f"personajes/{fig}.webp")}<b>¡CONTINUARÁ!</b><span>つづく</span></div>{marca}'
  cuerpo = [portada, indice]
  for n, papel in SECCIONES:
      c = cap[n]
      if n == 4: cuerpo.append(versus)
      if n in SPLASH:
          lam, frase, color = SPLASH[n]
          cuerpo.append(splash(n, c["titulo"], lam, frase, color))
      if n == 5:
          cuerpo.append(titulo_cap(5, c["titulo"], papel) + '<div class="texto">' + limpia(c["html"]) + f"</div>{RELLENO(5)}</section>")
          cuerpo += [ficha_pj(p) for p in AV["pjs"]]
          continue
      if n == 9:
          intro = c["html"].split("<h2>", 1)[0]
          resto = c["html"][len(intro):]
          cuerpo.append(titulo_cap(9, c["titulo"], papel, LAMINA.get(9)) + f'<div class="texto">{intro}</div><div class="retos">{"".join(reto(r) for r in AV["retos"])}</div><div class="texto">{resto}</div>{RELLENO(9)}</section>')
          continue
      if n == 10:
          cuerpo.append(titulo_cap(10, c["titulo"], papel, LAMINA.get(10)) + f'<div class="texto">{limpia(c["html"])}<div class="cameos">{"".join(cameo(x) for x in AV["cameos"])}</div></div>{RELLENO(10)}</section>')
          continue
      cuerpo.append(titulo_cap(n, c["titulo"], papel, LAMINA.get(n)) + f'<div class="texto">{limpia(c["html"])}</div>{RELLENO(n)}</section>')
      if n == 11 and hay("laminas/pdf-final.webp"):
          cuerpo.append(f'<section class="final-splash">{img("laminas/pdf-final.webp", "fondo")}<p>Nuevo amanecer: cuatro personas (o no) en un tejado, un cuenco de fideos gigantes y un dojo torcido que sigue en pie.</p></section>')

  cuerpo.append(f'<section class="galeria"><h1 class="gal-titulo">¡TODO NERIMA! <small>Reparto de rivales, vecinos y malditos en forma Mojada</small></h1><div class="gal-caras">{vecinos}</div></section>')
  cuerpo.append(f'<section class="galeria decorados"><h1 class="gal-titulo">DECORADOS <small>17 escenas incluidas en Foundry</small></h1><div class="gal-esc">{decorados}</div></section>')
  cuerpo.append(f'<section class="cap crema" id="fichas"><header class="cap-cab"><span class="cap-num">EXTRA</span><h1>Fichas privadas para recortar</h1><span class="kana">ひみつ</span></header><p class="texto">Entrega a cada jugador la suya en privado. Los secretos son ficción del personaje; se pueden cambiar por otro de orgullo, dinero, trabajo, rivalidad o metedura de pata. No hay castigo por no confesarlo, y quien lo confiesa gana un dado.</p><div class="recortes">{fichas}</div></section>')
  cuerpo.append(f'''<section class="encuesta"><h1>¡ENCUESTA DEL LECTOR! <small>アンケート</small></h1>
    <p>Rellena la postal y envíala a la Redacción de ¡PAM!, Apartado de Correos del barrio de Nerima. Entre todas las respuestas sortearemos un termo portátil que, probablemente, tiene fugas.</p>
    <ol><li>¿Qué animal fue la sensación del barrio? ☐ Avestruz ☐ Nutria ☐ Cabra ☐ Macaco</li><li>¿Qué final jugasteis? ☐ A ☐ B ☐ C ☐ D ☐ Otro magnífico desastre</li>
    <li>¿Cuántos ¡CHAPUZONES! hubo? ☐ 1–5 ☐ 6–10 ☐ Perdimos la cuenta</li><li>¿Quién puso nombre a la mejor Técnica Secreta? ______________________</li>
    <li>¿Quién confesó primero? ______________________</li></ol>{img("personajes/pj-mako-mojado.webp", "enc-ment")}</section>''')
  cuerpo.append(f'''<section class="contra">
    <div class="anuncio"><span class="an-nuevo">¡NUEVO!</span><h1>TERMO PORTÁTIL</h1><p class="an-sub">AGUA CALIENTE EN CUALQUIER PARTE DE NERIMA</p>
    {img("personajes/guia-manana.webp", "an-ment")}
    <ul><li>¡Con tapa-taza de goma auténtica!</li><li>¡Devuelve su forma a quien se haya mojado!</li><li>¡Cuatro cargas… bueno, tres!</li></ul>
    <p class="an-letra">Se recomienda no usar sobre avestruces, nutrias, cabras ni macacos que no hayan dado su consentimiento. El fabricante no se hace responsable de salpicaduras, piscinas olímpicas ni capitanes que no sepan nadar.</p>
    <div class="an-precio">¡Sólo<br><b>1.990</b><br>yenes!</div></div>
    {img("marca/logo.webp", "contra-logo")}<p class="contra-pie">MR- ¡Agua Va! · Manu Romera · Digital RPG Design · v{SYS["version"]}</p>
  </section>''')
  return cuerpo

F = (RAIZ / "fonts").as_uri()
CSS = (RAIZ / "scripts" / "pdf.css").read_text(encoding="utf-8").replace("FUENTES", F)
import fitz
H = OUT / "aguava.html"; crudo = OUT / "crudo.pdf"
def imprimir(rellenos):
    doc = f'<!doctype html><html lang="es"><head><meta charset="utf-8"><title>¡Agua Va!</title><style>{CSS}</style></head><body>{"".join(construir(rellenos))}</body></html>'
    H.write_text(doc, encoding="utf-8")
    subprocess.run(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--headless", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files",
                    "--virtual-time-budget=20000", f"--print-to-pdf={crudo}", H.as_uri()], check=True, capture_output=True)
    return fitz.open(crudo)

# Pasada 1: dónde acaba cada capítulo y cuánto papel queda debajo. Si el siguiente bloque empieza en página nueva,
# el hueco se llena con una viñeta «¡CONTINUARÁ!» a medida (pasada 2).
MM = 72 / 25.4
d = imprimir({})
rellenos = {}
for n, _ in SECCIONES:
    for pg in d:
        r = pg.search_for(f"FINCAP{n:02d}")
        if not r: continue
        siguiente = [m for m, _ in SECCIONES if m > n]
        mismo = siguiente and pg.search_for(f"EPISODIO {EP[siguiente[0]]}")
        libre = (pg.rect.height - 17 * MM - r[0].y1) / MM
        if not mismo and libre > 45: rellenos[n] = round(libre - 9)
        break
d = imprimir(rellenos)
print("rellenos:", rellenos)

# Índice con números de página reales: se buscan los títulos y se rellena con PyMuPDF.
pags = {}
for n, _ in SECCIONES:
    for i in range(2, len(d)):
        if d[i].search_for(f"EPISODIO {EP[n]}") and d[i].search_for(cap[n]["titulo"][:20]) or (d[i].search_for(f"EPISODIO {EP[n]}") and n in SPLASH and not pags.get(n)):
            pags[n] = i + 1; break
idx = d[1]
for n, p in pags.items():
    for r in idx.search_for(cap[n]["titulo"][:28]):
        idx.insert_text((r.x0 + 330 if r.x0 < 300 else r.x1 + 6, r.y1 - 1), f"p. {p}", fontsize=10, fontname="helv", color=(0.95, 0.33, 0.18))
        break
for i in range(2, len(d)):
    if "EXTRA" in d[i].get_text() and "Fichas privadas para recortar" in d[i].get_text():
        for r in idx.search_for("Fichas privadas para recortar"):
            idx.insert_text((r.x0 + 330, r.y1 - 1), f"p. {i + 1}", fontsize=10, fontname="helv", color=(0.95, 0.33, 0.18)); break
        break
d.save(PDF, garbage=1, deflate=True)  # garbage≥3 o rewrite_images rompen los subconjuntos de fuentes de Chrome
print(f"{PDF}: {len(d)} páginas, {PDF.stat().st_size / 1e6:.1f} MB · índice {pags}")
