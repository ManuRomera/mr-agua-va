/**
 * Efectos de revista: el ¡CHAPUZÓN! (anillos de agua y onomatopeya que cruza la pantalla)
 * y las onomatopeyas de las tiradas, con su sonido sintetizado (Web Audio, sin archivos).
 * Respetan «Reducir movimiento» de accesibilidad y los ajustes de cada navegador.
 */
import { ID, alRecibir, difundir } from "./mesa.mjs";

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

export const SONIDOS = {
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

export function sonar(clave) {
  if (sonando()) SONIDOS[clave]?.();
}

const sinMovimiento = () => document.body.classList.contains("av-sin-movimiento");

/** Onomatopeya grande que cruza la pantalla. */
export function onomatopeya(texto, { tono = "amarillo", anillos = false } = {}) {
  if (!game.settings.get(ID, "efectos")) return;
  const capa = document.createElement("div");
  capa.className = `mr-agua-va av-fx av-fx-${tono}${anillos ? " av-fx-anillos" : ""}${sinMovimiento() ? " quieto" : ""}`;
  capa.setAttribute("aria-hidden", "true");
  capa.innerHTML = `${anillos ? "<i></i><i></i><i></i>" : ""}<b data-texto="${texto}">${texto}</b>`;
  document.body.append(capa);
  setTimeout(() => capa.remove(), sinMovimiento() ? 900 : 1700);
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
  document.addEventListener("pointerdown", () => { if (ctx?.state === "suspended") ctx.resume(); }, { passive: true });
}
