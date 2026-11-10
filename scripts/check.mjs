/**
 * Validación estática antes de publicar: sintaxis, JSON, rutas de plantillas,
 * recursos referenciados y coherencia entre etiqueta y versión.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const errores = [];
const listar = async dir => (await fs.readdir(dir, { recursive: true })).map(f => path.join(dir, f));
const existe = p => fs.stat(p).then(() => true, () => false);

const manifiesto = JSON.parse(await fs.readFile("system.json"));
const etiqueta = process.env.RELEASE_TAG;
if (etiqueta && etiqueta !== `v${manifiesto.version}`) errores.push(`La etiqueta ${etiqueta} no coincide con la versión ${manifiesto.version}.`);
const paquete = JSON.parse(await fs.readFile("package.json"));
if (paquete.version !== manifiesto.version) errores.push(`package.json (${paquete.version}) y system.json (${manifiesto.version}) no coinciden.`);

const js = ["mr-agua-va.mjs", ...(await listar("module")), ...(await listar("scripts")).filter(f => !f.includes("fonts")), ...(await listar("tests"))].filter(f => f.endsWith(".mjs"));
for (const f of js) {
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
  catch (e) { errores.push(`${f}: ${e.stderr}`); }
}

for (const f of ["system.json", "lang/es.json", ...(await listar("_data")).filter(f => f.endsWith(".json"))]) {
  try { JSON.parse(await fs.readFile(f, "utf8")); }
  catch (e) { errores.push(`${f}: JSON inválido (${e.message})`); }
}

// Toda ruta systems/mr-agua-va/... citada en código, plantillas y datos debe existir.
const fuentes = [...js, ...(await listar("templates")), ...(await listar("_data")), "system.json"].filter(f => /\.(mjs|hbs|json)$/.test(f));
for (const f of fuentes) {
  const texto = await fs.readFile(f, "utf8");
  for (const [, ruta] of texto.matchAll(/systems\/mr-agua-va\/([\w\-/.]+\.(?:hbs|webp|webm|png|svg|css|woff2))/g)) {
    if (!(await existe(ruta))) errores.push(`${f}: falta ${ruta}`);
  }
  for (const [, ruta] of texto.matchAll(/\$\{RUTA\}\/([\w\-/.]+\.(?:hbs|webp|svg|png))/g)) {
    if (!(await existe(ruta))) errores.push(`${f}: falta ${ruta}`);
  }
}
const css = await fs.readFile("styles/mr-agua-va.css", "utf8");
for (const [, ruta] of css.matchAll(/url\("\.\.\/([^"]+)"\)/g)) {
  if (!(await existe(ruta))) errores.push(`styles: falta ${ruta}`);
}
for (const f of manifiesto.styles.concat(manifiesto.esmodules)) if (!(await existe(f))) errores.push(`system.json: falta ${f}`);

// Imágenes que el sistema y la aventura dan por hechas.
const AV = (await import("../module/aventura.mjs")).default;
const imprescindibles = ["assets/marca/portada.webp", "assets/marca/logo.webp", "assets/marca/icono.webp", "assets/marca/mr-marca.webm", "fonts/PressStart2P-Regular.woff2",
  ...AV.cortinillas.flatMap(c => [`assets/escenas/${c.escena}.webp`, `assets/personajes/${c.presentador}.webp`]),
  ...AV.pjs.flatMap(p => [`assets/retratos/pj-${p.clave}.webp`, ...["seco", "mojado"].flatMap(f => [`assets/personajes/pj-${p.clave}-${f}.webp`, `assets/personajes/pj-${p.clave}-${f}-cara.webp`])]),
  ...AV.retos.map(r => `assets/escenas/${r.escena}.webp`)];
for (const r of imprescindibles) if (!(await existe(r))) errores.push(`falta ${r}`);

// Plantillas: bloques de Handlebars abiertos y cerrados por igual.
for (const f of (await listar("templates")).filter(f => f.endsWith(".hbs"))) {
  const t = await fs.readFile(f, "utf8");
  for (const b of ["if", "each", "unless"]) {
    const abre = (t.match(new RegExp(`\\{\\{#${b}[ }]`, "g")) ?? []).length;
    const cierra = (t.match(new RegExp(`\\{\\{/${b}\\}\\}`, "g")) ?? []).length;
    if (abre !== cierra) errores.push(`${f}: {{#${b}}} abiertos ${abre}, cerrados ${cierra}`);
  }
}

if (errores.length) {
  console.error(errores.join("\n"));
  process.exit(1);
}
console.log(`Comprobación correcta: ${js.length} módulos, ${fuentes.length} fuentes revisadas.`);
