/**
 * Efectos de revista: el ¡CHAPUZÓN! (anillos de agua y onomatopeya que cruza la pantalla)
 * y las onomatopeyas de las tiradas, con su sonido sintetizado (Web Audio, sin archivos).
 * Respetan «Reducir movimiento» de accesibilidad y los ajustes de cada navegador.
 */
import { ID, RUTA, alRecibir, difundir } from "./mesa.mjs";

let ctx = null;
const sonando = () => game.settings.get(ID, "sonido") && game.settings.get(ID, "sonidoVolumen") > 0;
const vol = () => (game.settings.get(ID, "sonidoVolumen") / 100) * 0.45;

function audio() {
  const C = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!C) return null;
  ctx ??= new C();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tono({ tipo = "sine", de, a, dur, t = 0, fuerza = 1, vibrato = 0 }) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + t;
  const o = c.createOscillator(), g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(de, t0);
  o.frequency.exponentialRampToValueAtTime(a, t0 + dur);
  if (vibrato) {
    const l = c.createOscillator(), lg = c.createGain();
    l.frequency.value = 18; lg.gain.value = vibrato;
    l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol() * fuerza, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function golpe(t = 0, fuerza = 1) {
  const c = audio();
  if (!c) return;
  const n = Math.floor(c.sampleRate * 0.25), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = "lowpass"; f.frequency.value = 900; g.gain.value = vol() * 1.6 * fuerza;
  s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + t);
  tono({ de: 140, a: 45, dur: 0.3, t, fuerza: 1.4 * fuerza });
}

/** Sonidos sintetizados: solo de reserva si no cargan las muestras. */
const SINTE = {
  chapuzon: () => { golpe(0, 0.7); tono({ tipo: "sine", de: 900, a: 140, dur: 0.7, fuerza: 0.7, vibrato: 30 }); tono({ tipo: "triangle", de: 300, a: 700, dur: 0.25, t: 0.55, fuerza: 0.4 }); },
  fiasco: () => { tono({ tipo: "triangle", de: 520, a: 90, dur: 0.7, fuerza: 0.8 }); golpe(0.65, 0.8); },
  aparatoso: () => { golpe(0); tono({ tipo: "square", de: 300, a: 600, dur: 0.18, t: 0.2, fuerza: 0.3 }); },
  brillante: () => { [660, 880, 1320].forEach((f, i) => tono({ de: f, a: f, dur: 0.35, t: i * 0.09, fuerza: 0.7 })); },
  descomunal: () => { golpe(0, 1.3); [523, 659, 784, 1047].forEach((f, i) => tono({ tipo: "triangle", de: f, a: f, dur: 0.5, t: 0.15 + i * 0.1, fuerza: 0.7 })); },
  gong: () => { [196, 294, 392].forEach((f, i) => tono({ de: f, a: f * 0.985, dur: 1.8, t: i * 0.02, fuerza: 0.5 })); },
  campanilla: () => { [1568, 2093].forEach((f, i) => tono({ de: f, a: f * 0.99, dur: 1.2, t: i * 0.15, fuerza: 0.5 })); },
  madera: () => { golpe(0, 0.45); tono({ tipo: "square", de: 420, a: 300, dur: 0.09, fuerza: 0.35 }); tono({ tipo: "square", de: 520, a: 380, dur: 0.09, t: 0.14, fuerza: 0.3 }); },
  /* Máquina recreativa */
  ronda: () => { [392, 392, 523].forEach((f, i) => tono({ tipo: "square", de: f, a: f, dur: 0.22, t: i * 0.3, fuerza: 0.3 })); },
  pelea: () => { golpe(0, 1.2); [523, 659, 784, 1047, 1319].forEach((f, i) => tono({ tipo: "sawtooth", de: f, a: f, dur: 0.16, t: i * 0.055, fuerza: 0.35 })); },
  golpe: () => { golpe(0, 1); tono({ tipo: "square", de: 220, a: 90, dur: 0.12, fuerza: 0.3 }); },
  tecnica: () => { tono({ tipo: "sawtooth", de: 150, a: 1400, dur: 0.6, fuerza: 0.4 }); golpe(0.55, 1.6); },
  ko: () => { golpe(0, 1.8); tono({ tipo: "sawtooth", de: 900, a: 60, dur: 1.1, fuerza: 0.5, vibrato: 25 }); [262, 196, 147].forEach((f, i) => tono({ tipo: "square", de: f, a: f, dur: 0.3, t: 0.7 + i * 0.28, fuerza: 0.3 })); },
  alarma: () => { [0, 0.35, 0.7].forEach(t => { tono({ tipo: "square", de: 880, a: 660, dur: 0.3, t, fuerza: 0.4 }); tono({ tipo: "square", de: 660, a: 880, dur: 0.3, t: t + 0.17, fuerza: 0.3 }); }); },
  perfecto: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tono({ tipo: "triangle", de: f, a: f, dur: 0.3, t: i * 0.08, fuerza: 0.6 })); }
};

/* ───────── Muestras CC0 (assets/sfx, ver CREDITOS.md): capas [nombre | [variantes], retardo s, velocidad, ganancia] ───────── */
const GOLPES = ["hit_a", "hit_b", "hit_c", "hit_d"];
export const CAPAS = {
  chapuzon: [[["splash_a", "splash_b"], 0, 1, 1], ["boing_a", 0.22, 1, 0.7], ["plop", 0.55, 1.1, 0.5]],
  fiasco: [[["fail_uah", "fail_blah"], 0, 1, 1], ["boing_c", 0.12, 0.85, 0.5]],
  aparatoso: [[GOLPES, 0, 1, 0.9], ["boing_b", 0.07, 1.15, 0.7], ["plop", 0.3, 0.9, 0.4]],
  brillante: [["bell_b", 0, 1.25, 0.9], ["bell_b", 0.11, 1.6, 0.75], ["bell_b", 0.22, 2, 0.6]],
  descomunal: [["gong_b", 0, 1, 1], [GOLPES, 0, 0.9, 0.8], ["bell_c", 0.25, 1.3, 0.6]],
  gong: [["gong_a", 0, 1, 1]],
  campanilla: [["bell_c", 0, 1, 0.9], ["bell_a", 0.38, 0.84, 0.9]],      // ¡ding-dong!
  madera: [[["wood_a", "wood_b"], 0, 1, 1]],
  ronda: [["gong_b", 0, 1.1, 0.9]],
  pelea: [["slam_a", 0, 1, 1], [GOLPES, 0.05, 0.9, 0.8], ["bell_b", 0.12, 1.9, 0.5]],
  golpe: [[GOLPES, 0, 1, 1], ["slam_a", 0.02, 1.1, 0.5]],
  tecnica: [["charge", 0, 1, 0.9], ["boom", 0.85, 1, 1], ["gong_b", 0.85, 0.8, 0.5]],
  ko: [["slam_b", 0, 1, 1], ["hit_d", 0.02, 0.8, 0.8], ["boing_c", 0.28, 1, 0.8], ["bell_a", 1.15, 2.2, 0.6], ["bell_b", 1.4, 2.8, 0.5]],   // y se va volando: ¡kiiin!
  perfecto: [["bell_b", 0, 1, 0.8], ["bell_b", 0.13, 1.26, 0.8], ["bell_b", 0.26, 1.5, 0.8], ["bell_b", 0.39, 2, 0.9], ["gong_b", 0.5, 1.4, 0.5]],
  alarma: [["bell_b", 0, 1.8, 0.8], ["bell_b", 0.2, 1.4, 0.8], ["bell_b", 0.4, 1.8, 0.8], ["bell_b", 0.6, 1.4, 0.8], ["pot", 0.05, 1, 0.3]],
  vapor: [["bubble_a", 0, 1, 0.9], ["bubble_b", 0.25, 1.2, 0.6], ["bell_b", 0.45, 2.2, 0.4]]
};
const NOMBRES = [...new Set(Object.values(CAPAS).flat().flatMap(([n]) => [n].flat()))];
const buffers = new Map();
function cargar(nombre) {
  if (!buffers.has(nombre)) buffers.set(nombre, (async () => {
    try { const r = await fetch(`${RUTA}/assets/sfx/${nombre}.mp3`); if (!r.ok) return null; return await audio()?.decodeAudioData(await r.arrayBuffer()); }
    catch { return null; }
  })());
  return buffers.get(nombre);
}
const azar = x => (Array.isArray(x) ? x[Math.floor(Math.random() * x.length)] : x);

async function reproducir(capas) {
  const c = audio(); if (!c) return false;
  const lista = capas.map(([n, t, v, g]) => [azar(n), t, v, g]);
  const bufs = await Promise.all(lista.map(([n]) => cargar(n)));
  if (bufs.some(b => !b)) return false;
  const t0 = c.currentTime + 0.01, vol = (game.settings.get(ID, "sonidoVolumen") / 100) * 0.8;
  lista.forEach(([, t, v, g], i) => {
    const s = c.createBufferSource(), gn = c.createGain();
    s.buffer = bufs[i]; s.playbackRate.value = v; gn.gain.value = vol * g;
    s.connect(gn).connect(c.destination); s.start(t0 + t);
  });
  return true;
}

export const SONIDOS = Object.fromEntries(Object.keys({ ...SINTE, ...CAPAS }).map(k => [k, () => (CAPAS[k] ? reproducir(CAPAS[k]).then(ok => { if (!ok) SINTE[k]?.(); }) : SINTE[k]?.())]));

export function sonar(clave) {
  if (sonando()) SONIDOS[clave]?.();
}

const sinMovimiento = () => document.body.classList.contains("av-sin-movimiento");

/**
 * Cola única de mensajes a pantalla completa (onomatopeyas y carteles de la ¡PELEA!): salen de uno en uno,
 * para que nunca se pisen y se pueda leer cada uno. `fn` muestra el mensaje y devuelve cuántos ms debe durar.
 */
let cola = Promise.resolve();
export function colaPantalla(fn) {
  cola = cola.then(() => new Promise(res => { let ms = 0; try { ms = fn() || 0; } catch (e) { console.warn(`${ID} |`, e); } setTimeout(res, ms); })).catch(() => {});
  return cola;
}

/** Onomatopeya grande que cruza la pantalla (en cola con los demás mensajes). */
export function onomatopeya(texto, { tono = "amarillo", anillos = false } = {}) {
  if (!texto || !game.settings.get(ID, "efectos")) return;
  colaPantalla(() => {
    const dur = sinMovimiento() ? 900 : 1300;
    const capa = document.createElement("div");
    capa.className = `mr-agua-va av-fx av-fx-${tono}${anillos ? " av-fx-anillos" : ""}${sinMovimiento() ? " quieto" : ""}`;
    capa.setAttribute("aria-hidden", "true");
    capa.innerHTML = `${anillos ? "<i></i><i></i><i></i>" : ""}<b data-texto="${texto}">${texto}</b>`;
    document.body.append(capa);
    setTimeout(() => capa.remove(), dur);
    return dur;
  });
}

/** ¡CHAPUZÓN! de pantalla para toda la mesa. */
export function chapuzonPantalla(texto = "¡CHAPUZÓN!") {
  difundir("chapuzon", { texto });
}

export function registrarEfectos() {
  game.settings.register(ID, "sonido", {
    name: "Sonidos de historieta y de recreativa",
    hint: "¡CHAPUZÓN!, golpes de las tiradas, gongs de las cortinillas y los sonidos de la ¡PELEA!. Sintetizados, sin archivos. Ajuste de este navegador.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "sonidoVolumen", { name: "Volumen de los sonidos", scope: "client", config: true, type: Number, default: 60, range: { min: 0, max: 100, step: 5 } });
  alRecibir("chapuzon", d => { onomatopeya(d?.texto ?? "¡CHAPUZÓN!", { anillos: true, tono: "agua" }); sonar("chapuzon"); });
  // Las tarjetas de chat traen su sonido y su onomatopeya; suenan en todos los clientes al llegar.
  Hooks.on("createChatMessage", m => {
    const fx = m.getFlag(ID, "fx");
    if (!fx || !m.visible) return;
    const lanzar = () => { if (fx.sonido) sonar(fx.sonido); if (fx.texto) onomatopeya(fx.texto, { tono: fx.tono }); };
    // Con Dice So Nice, la onomatopeya espera a que paren los dados.
    if (game.dice3d && m.rolls?.length) {
      const id = Hooks.on("diceSoNiceRollComplete", mid => { if (mid === m.id) { Hooks.off("diceSoNiceRollComplete", id); lanzar(); } });
      setTimeout(() => Hooks.off("diceSoNiceRollComplete", id), 15000);
    } else lanzar();
  });
  document.addEventListener("pointerdown", () => { if (ctx?.state === "suspended") ctx.resume(); NOMBRES.forEach(cargar); }, { passive: true, once: false });
}
