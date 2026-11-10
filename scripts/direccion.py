#!/usr/bin/env python3
"""Paquete de MR- Dirección (content/direccion-es.json): el configurador de escenas del módulo ya viene preparado para ¡Agua Va!
con el reparto de cada escena, los puntos de apoyo del suelo y los efectos de sonido como chips. Se ajusta luego con el editor.
Uso: python3 scripts/direccion.py"""
import json
ID = "mr-agua-va"
PJ = ["kenji", "mako", "daiki", "yumi"]
f = lambda c: {"ref": {"flag": [ID, "clave", c]}, "label": ""}
esc = lambda k: {"flag": [ID, "escena", k]}
# clave de escena: (nombre, reparto, horizonte, apoyos del suelo)
SUELO = [[0.3, 0.86], [0.5, 0.9], [0.7, 0.86]]
ESC = {
 "00-amanecer": ("Cortinilla · Buenos días", ["presentador"], None), "01-mediodia": ("Cortinilla · A comer", ["presentador"], None),
 "02-noche": ("Cortinilla · Buenas noches", ["presentador"], None), "03-nuevo-amanecer": ("Cortinilla · Nuevo amanecer", ["presentador"], None),
 "04-dojo-exterior": ("El Bambú Torcido", PJ + ["yuzuki"], 0.5), "05-dojo-interior": ("Dentro del dojo", PJ, 0.45),
 "06-calle-nerima": ("La calle comercial", PJ + ["tendera"], 0.48), "07-mercadillo": ("El mercadillo", PJ, 0.46),
 "08-supermercado": ("El supermercado", PJ + ["mariko"], 0.45), "09-canal": ("El canal", PJ + ["ramen"], 0.5),
 "10-jardin-te": ("El jardín de té", PJ + ["matsu"], 0.5), "11-lavanderia": ("La lavandería", PJ, 0.45),
 "12-bano-exterior": ("El Vapor Feliz", PJ, 0.5), "13-bano-interior": ("La sala de baños", PJ + ["hidetoshi", "pandilla", "yuzuki"], 0.42),
 "14-calderas": ("La sala de calderas", PJ, 0.45), "15-tejados": ("Los tejados", PJ, 0.5), "16-estanque-caos": ("El estanque", PJ + ["hidetoshi"], 0.5),
}
escenas = []
for i, (k, (nombre, reparto, ojo)) in enumerate(ESC.items()):
    escenas.append({"ref": esc(k), "order": i, "name": nombre, "reading": None, "music": None, "motifs": [], "cues": [], "ambient": None,
        "figures": [f(c) for c in reparto] if ojo else [], "handouts": [], "notes": "", "thumb": f"systems/{ID}/assets/escenas/{k}-thumb.webp",
        "stage": {"mode": "horizon", "eye": ojo, "anchors": SUELO} if ojo else {"mode": "none"}})
EF = [("chapuzon", "¡Chapuzón!", "droplet", "splash_a"), ("boing", "Boing", "burst", "boing_a"), ("golpe", "Golpe", "hand-fist", "hit_c"), ("madera", "Cartel de madera", "signs-post", "wood_a"),
      ("gong", "Gong", "bell", "gong_a"), ("dingdong", "¡Ding-dong!", "bell-concierge", "bell_c"), ("kiin", "Estrellita", "star", "bell_b"), ("plop", "Plop", "circle-dot", "plop")]
pack = {"schema": 1, "id": ID, "title": "¡Agua Va!", "version": json.load(open("system.json"))["version"], "author": "Manu Romera", "license": "MIT",
        "settings": {"fade": 3.5, "motifs": [], "effects": [{"id": i, "label": l, "icon": ic, "sound": {"src": f"systems/{ID}/assets/sfx/{s}.mp3"}} for i, l, ic, s in EF],
                     "markers": {"milestones": [], "clocks": []}}, "scenes": escenas}
json.dump(pack, open("content/direccion-es.json", "w"), ensure_ascii=False, indent=1)
print(len(escenas), "escenas,", len(EF), "efectos")
