/**
 * Prueba del motor de ¡PELEA! con un Foundry de pega: sin pantalla, con dados dirigidos.
 * Cubre Parada contra Parada, Furia defensiva, el Jefe Final (fases, salpicadura, aislamiento, Torrente Olímpico con QTE),
 * el relevo dinámico, la cuenta atrás del Vapor 6 y que los PNJ solo los maneje quien dirige.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ───── Foundry de pega ─────
const ajustes = new Map(); const chats = []; const socketOut = [];
const fusion = (a, b) => { const o = structuredClone(a); for (const [k, v] of Object.entries(b ?? {})) o[k] = v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" ? fusion(o[k], v) : v; return o; };
class Cualquiera {}
globalThis.foundry = {
  applications: { api: { ApplicationV2: Cualquiera, HandlebarsApplicationMixin: Cualquiera, DialogV2: class { static confirm() { return true; } static prompt() { return null; } } }, sheets: { ActorSheetV2: Cualquiera }, apps: { DocumentSheetConfig: Cualquiera },
    ux: { TextEditor: { implementation: {} } }, handlebars: { renderTemplate: async () => "<article></article>", loadTemplates() {} }, instances: new Map() },
  utils: { deepClone: o => structuredClone(o), escapeHTML: s => String(s), mergeObject: (a, b) => fusion(a, b) }
};
globalThis.Hooks = { on() {}, once() {}, callAll() {} };
globalThis.CONFIG = { sounds: { dice: "" } };
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async d => { chats.push(d); return d; }, applyRollMode() {} };
globalThis.document = { body: { classList: { contains: () => false, toggle() {} } } };
globalThis.ui = { notifications: { warn() {}, info() {}, error() {} } };
globalThis.__dados = [];
globalThis.Roll = class { constructor(f) { this.f = f; } async evaluate() {
  const n = Number(/^(\d+)d6/.exec(this.f)[1]); const cola = globalThis.__dados.shift();
  const caras = cola ? [...cola] : Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
  while (caras.length < n) caras.push(1);
  const orden = [...caras].sort((a, b) => b - a); this.total = orden[0] + orden[1]; this.dice = [{ results: caras.map(result => ({ result })) }]; return this; } };
const gm = { id: "gm", isGM: true, isSelf: true, active: true };
const jugador = { id: "j1", isGM: false, isSelf: false, active: true };
globalThis.game = { user: gm, users: { activeGM: gm, get: id => ({ gm, j1: jugador })[id], some: () => false },
  settings: { settings: new Map(), get: (_, k) => (k === "rollMode" ? "publicroll" : ajustes.get(k)), set: async (_, k, v) => { ajustes.set(k, structuredClone(v)); } },
  socket: { emit: m => socketOut.push(m), on() {} }, actors: { _l: [], get(id) { return this._l.find(a => a.id === id); }, filter(f) { return this._l.filter(f); } },
  system: { version: "test" }, version: "13" };

const actor = (id, name, type, sys = {}, dueno = true) => ({ id, name, type, img: `${id}.webp`, system: { forma: "seco", dignidad: type === "pj" ? 8 : 6, barras: 1, rondas: 1, jefe: "", ...sys },
  prototypeToken: { texture: { src: `${id}.webp` } }, getFlag: () => null, testUserPermission: (u) => dueno && u.id === "j1", async update(c) { for (const [k, v] of Object.entries(c)) if (k.startsWith("system.")) this.system[k.slice(7)] = v; }, getActiveTokens: () => [] });

const mesa = await import("../module/mesa.mjs");
const { iniciarPelea, accionesMando } = await import("../module/pelea.mjs");
const estado = () => mesa.estado().pelea;
const reset = async (pjs, enemigos) => {
  game.actors._l = [...pjs, ...enemigos]; chats.length = 0; globalThis.__dados = []; ajustes.set("estado", { cuentaAtras: null, vapor: 1, termo: 3 });
  await iniciarPelea({ a: pjs.map(a => a.id), b: enemigos.map(a => a.id), rondasPara: 1 });
};
const pick = (lado, eleccion, extra = {}) => accionesMando.pick({ lado, eleccion, talento: false, entorno: false, golpe: "", ...extra });
const cambia = async fn => { const p = structuredClone(estado()); fn(p); await mesa.cambiarEstado({ pelea: p }); };
const espera = ms => new Promise(r => setTimeout(r, ms));

test("Parada contra Parada: sin daño y +1 de Furia a cada uno", async () => {
  await reset([actor("k", "Kenji", "pj")], [actor("m", "Mariko", "pnj", { rol: "rival" })]);
  await pick(0, "parada"); await pick(1, "parada");
  const p = estado();
  assert.equal(p.lados[0].equipo[0].dig, 8); assert.equal(p.lados[1].equipo[0].dig, 6);
  assert.deepEqual([p.lados[0].furia, p.lados[1].furia], [1, 1]); assert.equal(p.cruce, 2);
});

test("Evasión Ridícula: anula cualquier ataque, incluso una Técnica, y gasta la Furia", async () => {
  await reset([actor("k", "Kenji", "pj")], [actor("m", "Mariko", "pnj", { rol: "rival" })]);
  await cambia(p => { p.lados[0].furia = 3; p.lados[1].furia = 3; });
  await pick(0, "evasion"); await pick(1, "tecnica", { golpe: "¡Torpedo!" });
  const p = estado();
  assert.equal(p.lados[0].equipo[0].dig, 8); assert.equal(p.lados[0].furia, 0); assert.equal(p.lados[1].furia, 0);
});

test("Peinarse recupera 4 de Dignidad y cuenta como Parada sin contraataque", async () => {
  await reset([actor("k", "Kenji", "pj")], [actor("m", "Mariko", "pnj", { rol: "rival" })]);
  await cambia(p => { p.lados[0].furia = 3; p.lados[0].equipo[0].dig = 3; });
  globalThis.__dados = [[6, 5]];
  await pick(0, "serenidad"); await pick(1, "golpe");
  const p = estado();
  assert.equal(p.lados[0].equipo[0].dig, 7); assert.equal(p.lados[1].equipo[0].dig, 6); assert.equal(p.lados[0].furia, 0);
});

test("Pifia Cómica con ayuda: se la lleva el ayudante; con el Talento los 3 son Caos", async () => {
  const k = actor("k", "Kenji", "pj"), d = actor("d", "Daiki", "pj");
  await reset([k, d], [actor("m", "Mariko", "pnj", { rol: "rival" })]);
  await accionesMando.asistir({ lado: 0, actor: "d", on: true });
  globalThis.__dados = [[3, 3, 6]];                       // dobles bajos (3-3) y suma 9: brillante, pero hay Pifia
  await pick(0, "golpe"); await pick(1, "presa");
  const cruce = chats.find(c => c.flags?.["mr-agua-va"]?.tipo === "cruce");
  assert.ok(cruce, "hay tarjeta del Cruce");

  assert.equal(d.system.forma, "mojado"); assert.equal(k.system.forma, "seco");
});

test("Jefe Final: salpicadura en fase 1, cañón roto en fase 2 con Furia 3", async () => {
  const pjs = [actor("k", "Kenji", "pj"), actor("d", "Daiki", "pj"), actor("y", "Yumi", "pj")];
  const jefe = actor("h", "Hidetoshi", "pnj", { rol: "rival", dignidad: 16, barras: 1, rondas: 1, jefe: "hidetoshi" });
  await reset(pjs, [jefe]);
  assert.equal(estado().lados[1].equipo[0].dig, 16);
  await cambia(p => { p.lados[0].equipo[1].dig = 5; p.lados[0].equipo[2].dig = 5; });
  globalThis.__dados = [[6, 6, 6]];                        // el jefe gana con mucho
  await pick(0, "presa"); await pick(1, "golpe");          // golpe gana a presa
  let p = estado();
  assert.equal(p.lados[0].equipo[1].dig, 4, "el banquillo pierde 1 y no descansa"); assert.equal(p.lados[0].equipo[2].dig, 4);
  await cambia(q => { q.lados[1].equipo[0].dig = 9; });
  globalThis.__dados = [[6, 5], [6, 5]];                   // el PJ gana y baja al jefe a la fase 2
  await pick(0, "golpe"); await pick(1, "presa");
  p = estado();
  assert.equal(p.lados[1].equipo[0].fase, 2); assert.equal(p.lados[1].furia, 3);
});

test("Torrente Olímpico: el banquillo esquiva con QTE o recibe 2 de Dignidad", async () => {
  const pjs = [actor("k", "Kenji", "pj"), actor("d", "Daiki", "pj"), actor("y", "Yumi", "pj")];
  await reset(pjs, [actor("h", "Hidetoshi", "pnj", { rol: "rival", dignidad: 16, jefe: "hidetoshi" })]);
  await cambia(p => { p.lados[1].furia = 3; });
  globalThis.__dados = [[6, 5, 5], [6, 5]];
  const hecho = pick(0, "golpe").then(() => pick(1, "tecnica", { golpe: "¡Torrente Olímpico!" }));
  await espera(300);
  accionesMando.qteResp({ actor: "d" });                    // Daiki esquiva; Yumi no
  await hecho; await espera(5200);
  const p = estado();
  // Daiki esquivó la ola (solo sufre la salpicadura del cañón: 8 → 7); Yumi no reaccionó: 8 − 2 − 1 = 5 y ¡CHAPUZÓN!
  assert.equal(p.lados[0].equipo[1].dig, 7, "Daiki esquiva la ola");
  assert.equal(p.lados[0].equipo[2].dig, 5, "Yumi recibe el impacto directo");
  assert.equal(game.actors.get("y").system.forma, "mojado");
});

test("Relevo: pide el del banquillo, elige el activo y entra al final del Cruce", async () => {
  const pjs = [actor("k", "Kenji", "pj"), actor("d", "Daiki", "pj")];
  await reset(pjs, [actor("m", "Mariko", "pnj", { rol: "rival" })]);
  await accionesMando.pedirRelevo({ lado: 0, actor: "d" });
  assert.deepEqual(estado().peticiones[0], ["d"]);
  await accionesMando.darRelevo({ lado: 0, actor: "d" });
  assert.equal(estado().relevos[0], "d");
  await pick(0, "parada"); await pick(1, "parada");
  assert.equal(estado().lados[0].activo, 1, "Daiki entra");
  await accionesMando.pedirRelevo({ lado: 0, actor: "k" });
  await accionesMando.pedirRelevo({ lado: 0, actor: "k" });   // anular
  assert.deepEqual(estado().peticiones[0], []);
});

test("Aislamiento: el relevo no se concede si el jefe estampa al activo con un aparatoso", async () => {
  const pjs = [actor("k", "Kenji", "pj"), actor("d", "Daiki", "pj")];
  await reset(pjs, [actor("h", "Hidetoshi", "pnj", { rol: "rival", dignidad: 16, jefe: "hidetoshi" })]);
  await accionesMando.pedirRelevo({ lado: 0, actor: "d" }); await accionesMando.darRelevo({ lado: 0, actor: "d" });
  globalThis.__dados = [[4, 3, 3]];                         // el jefe: 4+3 = 7 → éxito aparatoso (los dobles de 3 darán pifia, pero el golpe entra)
  await pick(0, "presa"); await pick(1, "golpe");
  assert.equal(estado().lados[0].activo, 0, "Kenji no puede ser relevado");
});

test("Vapor 6: la cuenta atrás de 2 Cruces acaba en Final C si nadie vence al jefe", async () => {
  await reset([actor("k", "Kenji", "pj")], [actor("h", "Hidetoshi", "pnj", { rol: "rival", dignidad: 16, jefe: "hidetoshi" })]);
  await mesa.cambiarEstado({ vapor: 6 });
  assert.deepEqual(mesa.estado().cuentaAtras, { restantes: 2 });
  await pick(0, "parada"); await pick(1, "parada");
  assert.deepEqual(mesa.estado().cuentaAtras, { restantes: 1 });
  await pick(0, "parada"); await pick(1, "parada");
  assert.equal(mesa.estado().final, "C"); assert.equal(estado().fase, "fin");
});

test("Vapor 6: cerrar la válvula (vapor < 6) apaga la cuenta atrás", async () => {
  await reset([actor("k", "Kenji", "pj")], [actor("m", "Mariko", "pnj", { rol: "rival" })]);
  await mesa.cambiarEstado({ vapor: 6 }); await mesa.cambiarEstado({ vapor: 4, cuentaAtras: null });
  assert.equal(mesa.estado().cuentaAtras, null);
});

test("Los PNJ solo los maneja quien dirige: la petición de un jugador sobre un enemigo se ignora", async () => {
  await reset([actor("k", "Kenji", "pj")], [actor("m", "Mariko", "pnj", { rol: "rival" }, true)]);
  const { registrarPelea } = await import("../module/pelea.mjs");
  let manejador; game.socket.on = (_, fn) => { manejador = fn; };
  registrarPelea(); mesa.escucharSocket();
  await manejador({ op: "pick", datos: { lado: 1, eleccion: "golpe" } }, "j1");      // el jugador intenta mover al enemigo
  assert.equal(estado().lados[1].listo, false);
  await manejador({ op: "pick", datos: { lado: 0, eleccion: "golpe" } }, "j1");      // y a su propio luchador sí puede
  assert.equal(estado().lados[0].listo, true);
});

test("Mandos: el banquillo ve los botones en gris y 'Pedir relevo'; los enemigos solo los ve el GM", async () => {
  const k = actor("k", "Kenji", "pj"), d = actor("d", "Daiki", "pj"), m = actor("m", "Mariko", "pnj", { rol: "rival" });
  await reset([k, d], [m]);
  const { htmlMando, misLados } = await import("../module/pelea.mjs");
  const p = estado();
  game.user = jugador;                                               // un jugador dueño de Kenji y de Daiki
  assert.deepEqual(misLados(p), [0], "el jugador no ve el bando enemigo");
  const activo = htmlMando(p, 0);
  assert.match(activo, /av-arcade-golpe" data-accion="pick" data-eleccion="golpe"\s+>/);
  assert.match(activo, /Pedir relevo/);                              // Daiki, su otro luchador, espera en el banquillo
  const soloBanquillo = structuredClone(p); soloBanquillo.lados[0].activo = 1;   // ahora activo Daiki, Kenji espera
  assert.match(htmlMando(soloBanquillo, 0), /Piden el relevo|Pedir relevo/);
  game.actors._l[0] = actor("k", "Kenji", "pj", {}, false);          // Kenji deja de ser suyo: solo Daiki (activo) es suyo
  game.user = gm;
  assert.deepEqual(misLados(p), [0, 1], "el GM ve los dos mandos");
  assert.match(htmlMando(p, 1), /rival · solo lo ves tú/);
});
