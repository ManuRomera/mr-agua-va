import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sys = JSON.parse(fs.readFileSync("system.json"));
const leer = p => fs.readFileSync(p, "utf8");
const codigo = fs.readdirSync("module", { recursive: true }).filter(f => f.endsWith(".mjs")).map(f => leer(`module/${f}`)).join("\n") + leer("mr-agua-va.mjs");

test("el manifiesto apunta a archivos que existen", () => {
  for (const f of [...sys.esmodules, ...sys.styles, ...sys.languages.map(l => l.path)]) assert.ok(fs.existsSync(f), f);
});

test("las plantillas citadas existen", () => {
  for (const [, ruta] of codigo.matchAll(/RUTA\}\/(templates\/[\w/.-]+\.hbs)/g)) assert.ok(fs.existsSync(ruta), ruta);
});

test("el CSS no pisa la fuente de los iconos de Foundry", () => {
  const css = leer("styles/mr-agua-va.css");
  assert.doesNotMatch(css, /(^|[\s,])(button|\*|i|\.window-header)\s*\{[^}]*font(-family)?\s*:/m);
  assert.doesNotMatch(css, /all\s*:\s*unset/);
});

test("sin códigos de regla en la interfaz", () => {
  const ui = codigo + fs.readdirSync("templates", { recursive: true }).filter(f => f.endsWith(".hbs")).map(f => leer(`templates/${f}`)).join("\n");
  assert.doesNotMatch(ui, /\(R \d+\)|«R \d+»/);
});

test("DialogV2: icono y etiqueta por separado", () => {
  assert.doesNotMatch(codigo, /label:\s*["'`]<i /);
});

test("la aventura trae 4 personajes, 18 retos y 4 cortinillas con su arte declarado", async () => {
  const AV = (await import("../module/aventura.mjs")).default;
  assert.equal(AV.pjs.length, 4); assert.equal(AV.retos.length, 18); assert.equal(AV.cortinillas.length, 4);
  assert.deepEqual(AV.cortinillas.map(c => c.minuto), [0, 45, 85, 112]);
});

test("el texto publicable no lleva notas de producción ni prompts de arte", async () => {
  const AV = (await import("../module/aventura.mjs")).default;
  const texto = JSON.stringify(AV);
  assert.doesNotMatch(texto, /\bprompts?\b|cel art|Estudio Deen|1:1 avatar|REF_[A-Z]|image_gen|Rumiko/i);
});

test("todas las muestras de sonido que cita efectos.mjs existen", () => {
  const src = leer("module/efectos.mjs");
  const bloque = src.slice(src.indexOf("export const CAPAS"), src.indexOf("const NOMBRES"));
  const nombres = [...bloque.matchAll(/"([a-z]+_[a-z]|plop|charge|boom|pot)"/g)].map(m => m[1]);
  assert.ok(nombres.length > 20);
  for (const n of new Set(nombres)) assert.ok(fs.existsSync(`assets/sfx/${n}.mp3`), n);
});

test("el paquete de MR- Dirección cubre las 17 escenas y sus actores existen en la aventura", () => {
  const pack = JSON.parse(leer("content/direccion-es.json"));
  assert.equal(pack.scenes.length, 17);
  const aventura = JSON.parse(leer("_data/aventura.json"))[0];
  const claves = new Set(aventura.actors.map(a => a.flags["mr-agua-va"].clave));
  const escenas = new Set(aventura.scenes.map(s => s.flags["mr-agua-va"].escena));
  for (const s of pack.scenes) {
    assert.ok(escenas.has(s.ref.flag[2]), s.ref.flag[2]);
    for (const f of s.figures) assert.ok(claves.has(f.ref.flag[2]), f.ref.flag[2]);
  }
});

test("el modo oscuro redefine las variables de fondo, línea y texto", () => {
  const css = leer("styles/mr-agua-va.css");
  const oscuro = css.slice(css.indexOf("body.av-oscuro {"), css.indexOf("}", css.indexOf("body.av-oscuro {")));
  for (const v of ["--av-papel", "--av-tinta", "--av-linea", "--av-blanco", "--av-campo"]) assert.ok(oscuro.includes(v), v);
});
