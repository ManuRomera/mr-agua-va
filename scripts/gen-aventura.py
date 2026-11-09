#!/usr/bin/env python3
"""content/aventura.json + assets → _data/aventura.json (un documento Adventure con escenas, actores, diarios y carpetas).
Solo incluye lo que tiene arte en assets/. Uso: python3 scripts/gen-aventura.py"""
import hashlib, json, sys
from pathlib import Path
sys.path.insert(0, "/Volumes/Datos_Dock/FoundryVTT/Trabajo LOGO/marca")
import marca  # caja del brillo animado de la marca

ID = "mr-agua-va"; R = f"systems/{ID}/assets"; A = Path("assets")
AV = json.load(open("content/aventura.json", encoding="utf-8"))
uid = lambda t: hashlib.sha1(f"{ID}:{t}".encode()).hexdigest()[:16]
hay = lambda p: (A / p).exists()
STATS = {"systemId": ID, "systemVersion": json.load(open("system.json"))["version"], "coreVersion": "13.351"}

def carpeta(nombre, tipo, color, orden):
    return {"_id": uid(f"carpeta-{tipo}-{nombre}"), "name": nombre, "type": tipo, "color": color, "sorting": "m", "sort": orden, "folder": None, "description": "", "flags": {}}

folders = [carpeta("Personajes malditos", "Actor", "#1aa6d8", 1), carpeta("Rivales y vecinos", "Actor", "#e0572a", 2),
           carpeta("Cortinillas", "Scene", "#ffd23f", 1), carpeta("Nerima de día", "Scene", "#1aa6d8", 2), carpeta("La noche · Casa de Baños", "Scene", "#14325c", 3)]
F = {f["name"]: f["_id"] for f in folders}

# ---------- Actores ----------
def token(img, w=1.2, h=1.8, nombre=None):
    return {"name": nombre, "texture": {"src": img, "fit": "contain", "scaleX": 1, "scaleY": 1}, "width": w, "height": h,
            "lockRotation": True, "displayName": 30, "disposition": 1, "actorLink": True, "ring": {"enabled": False}, "sight": {"enabled": False}}

actores = []
for i, p in enumerate(AV["pjs"]):
    k = p["clave"]
    if not (hay(f"personajes/pj-{k}-seco.webp") and hay(f"personajes/pj-{k}-mojado.webp")): continue
    formas = {f: {"img": f"{R}/personajes/pj-{k}-{f}-cara.webp", "cara": f"{R}/personajes/pj-{k}-{f}-cara.webp", "token": f"{R}/personajes/pj-{k}-{f}.webp"} for f in ("seco", "mojado")}
    actores.append({"_id": uid(f"pj-{k}"), "name": p["nombre"], "type": "pj", "img": formas["seco"]["img"], "folder": F["Personajes malditos"], "sort": i,
        "system": {"apodo": p["apodo"], "estilo": p["estilo"], "lema": p["lema"], "forma": "seco", "marcial": p["marcial"], "maldicion": p["maldicion"], "animal": p["animal"],
                   "bestia": p["bestia"], "defecto": p["defecto"], "vinculo": p["vinculo"], "presentacion": p["presentacion"], "secreto": p["secreto"],
                   "confesion": p["confesion"], "reto": p["reto"], "dignidad": 8, "notas": ""},
        "prototypeToken": token(formas["seco"]["token"], nombre=p["nombre"]), "ownership": {"default": 0},
        "flags": {ID: {"formas": formas, "retratoDual": f"{R}/retratos/pj-{k}.webp", "color": p["color"]}}})

RIV = {r["clave"]: r for r in AV["rivales"]}
PNJ = [  # (archivo, nombre, papel, frase, descripción, rival?)
 ("guia-manana", "Guía de Jusenkyo", "Presentador de las cortinillas", "¡Buenos días, queridos espectadores! El agua fría es amiga… hasta que deja de serlo.", "Presentador televisivo con sombrero de paja cónico y gafas redondas. Cuenta la historia, pero «el cubo no es cosa suya». Lo acompaña siempre un termo o un cuenco de fideos.", None),
 ("pnj-hidetoshi", "Capitán Hidetoshi", "Capitán del Dojo del Cisne Hidráulico", "¡Un estilo libre digno de mi apellido!", RIV["hidetoshi"]["descripcion"], "hidetoshi"),
 ("pnj-esbirro", "La Pandilla del Cisne", "Matones del Cisne Hidráulico", "¡Por el Cisne Hidráulico!", RIV["pandilla"]["descripcion"], "pandilla"),
 ("pnj-mariko", "Mariko", "Reina de la sección de congelados", "¡Aquí mando yo, entre la mantequilla y el pescado!", RIV["mariko"]["descripcion"], "mariko"),
 ("pnj-yuzuki", "Maestro Yuzuki", "Propietario del terreno, jubilado hoy", "", "Anciano diminuto y cegato, con unas cejas blancas que le tapan los ojos. Entrega la Escritura y el Barril Imperial a quien reúna las tres tablillas. Cree de verdad en el Barril; nadie sabe que contiene fideos.", None),
 ("pnj-matsu", "Maestra Matsu", "Maestra de la ceremonia del té (R03)", "", "Elegante y serena, guarda la Tablilla nº 3. Tiene un punto travieso: le divierten los errores bien hechos.", None),
 ("pnj-tendera", "Señora Sawa", "Tendera y fuente de chismes", "", "Tendera de la tienda de comestibles que lo sabe todo y lo cuenta tapándose la boca con un abanico. Sabe dónde dejó la llave maestra el Maestro Yuzuki.", None),
 ("pnj-ramen", "El tío del ramen", "Repartidor (R01)", "", "Empuja un carro de reparto lleno de cuencos humeantes y de cajas lacadas. No tiene ni idea de lo que lleva.", None),
 ("pnj-notario", "El notario pajarito", "Notario con prisa (R09)", "", "Pequeño, flaco y con nariz picuda, lee los contratos a la velocidad de un loro. Trae la apuesta del gimnasio firmada por Daiki.", None),
]
for i, (k, nombre, papel, frase, desc, rival) in enumerate(PNJ):
    if not hay(f"personajes/{k}.webp"): continue
    r = RIV.get(rival, {}) if rival else {}
    ancho = 1.6 if k in ("pnj-esbirro", "guia-manana") else 1.2
    actores.append({"_id": uid(f"pnj-{k}"), "name": nombre, "type": "pnj", "img": f"{R}/personajes/{k}-cara.webp", "folder": F["Rivales y vecinos"], "sort": i,
        "system": {"papel": papel, "frase": frase, "descripcion": desc, "tecnica": r.get("tecnica", ""), "secreto": r.get("secreto", ""),
                   "rol": "rival" if rival else "vecino", "jefe": r.get("jefe", ""), "dignidad": r.get("dignidad", 6), "barras": r.get("barras", 1), "rondas": r.get("rondas", 1), "notas": ""},
        "prototypeToken": token(f"{R}/personajes/{k}.webp", ancho, 1.8, nombre) | {"disposition": -1 if rival else 0, "actorLink": True},
        "ownership": {"default": 0}, "flags": {ID: ({"rival": rival} if rival else {})}})

# ---------- Escenas ----------
ESCENAS = [  # clave, nombre, carpeta, nav
 ("00-amanecer", "Cortinilla · ¡Buenos días, Nerima!", "Cortinillas", True), ("01-mediodia", "Cortinilla · ¡A comer!", "Cortinillas", False),
 ("02-noche", "Cortinilla · ¡Buenas noches!", "Cortinillas", False), ("03-nuevo-amanecer", "Cortinilla · Nuevo amanecer", "Cortinillas", False),
 ("04-dojo-exterior", "El Bambú Torcido", "Nerima de día", True), ("05-dojo-interior", "Dentro del dojo", "Nerima de día", False),
 ("06-calle-nerima", "La calle comercial", "Nerima de día", True), ("07-mercadillo", "El mercadillo", "Nerima de día", True),
 ("08-supermercado", "El supermercado (pista de hielo)", "Nerima de día", False), ("09-canal", "El canal", "Nerima de día", True),
 ("10-jardin-te", "El jardín de té", "Nerima de día", False), ("11-lavanderia", "La lavandería automática", "Nerima de día", False),
 ("12-bano-exterior", "El Vapor Feliz (fachada)", "La noche · Casa de Baños", True), ("13-bano-interior", "La sala de baños", "La noche · Casa de Baños", True),
 ("14-calderas", "La sala de calderas", "La noche · Casa de Baños", False), ("15-tejados", "Los tejados", "La noche · Casa de Baños", False),
 ("16-estanque-caos", "El estanque, después del caos", "La noche · Casa de Baños", False)]
# Capas de las cortinillas: (archivo, x, y, alto) en una escena de 1920×1080. Se ajustan mirando cada decorado.
CAPAS = json.load(open("content/capas.json")) if Path("content/capas.json").exists() else {}
bx, by, bw, bh = marca.caja_animada(1920, 1080)

def tile(src, x, y, w, h, n, alfa=1):
    return {"_id": uid(f"tile-{n}"), "texture": {"src": src, "fit": "fill", "scaleX": 1, "scaleY": 1}, "x": x, "y": y, "width": w, "height": h,
            "elevation": 0, "sort": 10 + len(n), "rotation": 0, "alpha": alfa, "hidden": False, "locked": True, "restrictions": {"light": False, "weather": False},
            "occlusion": {"mode": 0, "alpha": 0}, "video": {"loop": True, "autoplay": True, "volume": 0}, "flags": {ID: {"capa": n}}}

def medidas(p):
    from PIL import Image
    return Image.open(A / p).size

escenas = []
for i, (k, nombre, carp, nav) in enumerate(ESCENAS):
    if not hay(f"escenas/{k}.webp"): continue
    tiles = [tile(f"{R}/marca/mr-marca.webm", bx, by, bw, bh, f"{k}-marca")]
    for (arch, x, y, alto) in CAPAS.get(k, []):
        if hay(f"personajes/{arch}.webp"):
            w, h = medidas(f"personajes/{arch}.webp"); ancho = round(w * alto / h)
            tiles.append(tile(f"{R}/personajes/{arch}.webp", x, y, ancho, alto, f"{k}-{arch}"))
    escenas.append({"_id": uid(f"escena-{k}"), "name": nombre, "folder": F[carp], "sort": i * 100, "navigation": nav, "navOrder": i, "navName": nombre,
        "background": {"src": f"{R}/escenas/{k}.webp"}, "thumb": f"{R}/escenas/{k}-thumb.webp", "width": 1920, "height": 1080, "padding": 0,
        "backgroundColor": "#14325c" if "noche" in carp or k == "02-noche" else "#e8f6fa", "grid": {"type": 0, "size": 100, "distance": 1, "units": "m"},
        "tokenVision": False, "fog": {"exploration": False}, "environment": {"globalLight": {"enabled": True}},
        "tiles": tiles, "tokens": [], "drawings": [], "lights": [], "notes": [], "sounds": [], "templates": [], "walls": [], "regions": [],
        "initial": {"x": 960, "y": 540, "scale": 0.5}, "ownership": {"default": 0}, "flags": {ID: {"escena": k}}})

# ---------- Diarios ----------
def pagina(nombre, html, n, img=None, nivel=1):
    if img and hay(img): html = f'<p><img src="{R}/{img}" alt=""></p>' + html
    return {"_id": uid(f"pag-{nombre}"), "name": nombre, "type": "text", "title": {"show": True, "level": nivel}, "sort": n * 100,
            "text": {"format": 1, "content": html}, "ownership": {"default": -1}, "flags": {}}

LAMINAS = {7: "laminas/pdf-acto1.webp", 8: "laminas/pdf-acto2.webp", 11: "laminas/pdf-acto3.webp", 3: "laminas/bn-chapuzon.webp", 2: "laminas/bn-dados.webp",
           4: "laminas/bn-pelea.webp", 10: "laminas/bn-cameos.webp", 9: "laminas/bn-cartel.webp", 6: "laminas/bn-termo.webp"}
USO = f"""<p><strong>{AV['promesa'][0].upper() + AV['promesa'][1:]}</strong></p>
<p>Partida fan, original y no oficial, ambientada en el barrio de Nerima, Tokio. Para 2–4 jugadores y dirección; dura <strong>120 minutos reales</strong>. Comedia de enredos y artes marciales para mesa adulta o juvenil.</p>
<h2>Cómo se juega en Foundry</h2>
<ul>
<li><strong>Panel de dirección</strong> (botón en el directorio de Actores, en la barra de tokens o con un clic en la cartela): reloj real con aviso de cortinilla, <em>Desbarajuste Acuático</em> 0–6, <em>Vapor Nocturno</em> 0–6, el <em>Termo Portátil</em>, las tres tablillas, los 18 retos flotantes, la máquina de <strong>¡PELEA!</strong>, la noche en la Casa de Baños y los cuatro finales.</li>
<li><strong>Doble forma:</strong> cada ficha tiene el interruptor <strong>SECO / MOJADO</strong>. «MOJADO» lanza un ¡CHAPUZÓN! (retrato y figura cambian al animal); volver a «SECO» pide agua caliente (el Termo o una fuente de calor). Mojado solo se habla con <strong>Carteles de Madera</strong> de 4 palabras (el botón <em>Cartel</em> los pone en el chat).</li>
<li><strong>Tiradas:</strong> <strong>¡PAM!</strong> (2d6, +1 por el talento de la forma, +1 al huir/esquivar/colarse estando Mojado, +1 por cada PJ que ayuda; máximo 4d6; suman los dos mejores).</li>
<li><strong>¡PELEA!:</strong> marcadores de máquina recreativa arriba de la pantalla (nombres, barras de Dignidad, Furia, cronómetro y rondas) y un mando abajo para cada jugador: Golpe, Presa, Parada, Provocar, Técnica Secreta, asistencia y relevo.</li>
<li><strong>Seguridad:</strong> Pausa, Velo y Tarjeta X anónimas en la barra de tokens. Si un gag incomoda, se cambia sin explicaciones.</li>
</ul>
<p>El libro completo, con la misma aventura maquetada como un especial de revista de 1990, va en el PDF que acompaña al sistema.</p>"""
guia = [pagina("Cómo usar esta aventura", USO, 0, "laminas/pdf-portada.webp")]
for c in AV["capitulos"]:
    if c["n"] == 12: continue
    guia.append(pagina(c["titulo"], c["html"], c["n"], LAMINAS.get(c["n"])))
cap = {c["n"]: c for c in AV["capitulos"]}
reglas_html = cap[2]["html"] + cap[3]["html"] + cap[4]["html"]
diarios = [
    {"_id": uid("diario-guia"), "name": "¡Agua Va! · La aventura", "pages": guia, "sort": 0, "folder": None, "ownership": {"default": 0}, "flags": {ID: {"clave": "guia"}}},
    {"_id": uid("diario-chuleta"), "name": "Chuleta de dirección", "pages": [pagina("Chuleta de dirección", cap[12]["html"], 0)], "sort": 1, "folder": None, "ownership": {"default": 0}, "flags": {ID: {"clave": "chuleta"}}},
    {"_id": uid("diario-reglas"), "name": "Reglas: ¡PAM! 2.0, doble forma y ¡PELEA!", "pages": [pagina("Reglas para la mesa", reglas_html, 0, "laminas/bn-dados.webp")], "sort": 2, "folder": None, "ownership": {"default": 2}, "flags": {ID: {"clave": "reglas"}}},
]

aventura = {"_id": uid("aventura"), "name": "¡Agua Va!", "img": f"{R}/marca/portada.webp",
    "caption": "Un día de verano en Nerima: agua fría, animales; agua caliente, personas.",
    "description": f"<p>{AV['promesa']}</p><p>Incluye 17 escenas (cuatro cortinillas del Guía de Jusenkyo), los cuatro personajes malditos con sus dos formas, rivales y vecinos, y el diario de dirección completo.</p>",
    "actors": actores, "scenes": escenas, "journal": diarios, "folders": folders, "items": [], "tables": [], "macros": [], "cards": [], "playlists": [], "combats": [],
    "sort": 0, "flags": {ID: {"version": STATS["systemVersion"]}}, "_stats": STATS}
json.dump([aventura], open("_data/aventura.json", "w"), ensure_ascii=False, indent=1)
print(f"aventura: {len(escenas)} escenas, {len(actores)} actores, {len(diarios)} diarios, {sum(len(d['pages']) for d in diarios)} páginas")
