/**
 * Instalación de la aventura. En un mundo vacío, el GM activo la importa sola la primera vez;
 * después se puede repetir desde Configuración → ¡Agua Va!. Tarjeta de bienvenida por versión.
 */
import { ID, ARTE } from "./mesa.mjs";
import { DialogV2 } from "./compat.mjs";
import { publicar } from "./chat.mjs";
import AV from "./aventura.mjs";

const PACK = `${ID}.aventura`;

/** Sin personajes, objetos, diarios, listas, macros ni tablas, y como mucho la escena de bienvenida de Foundry. */
function mundoVacio() {
  const sin = ["actors", "items", "journal", "playlists", "macros", "tables", "cards"].every(c => !game[c]?.size);
  return sin && game.scenes.contents.every(s => (!s.background?.src || s.background.src.startsWith("nue/")) && !s.tokens.size);
}

export async function importarAventura({ confirmar = false } = {}) {
  if (!game.user.isGM) return ui.notifications.warn("Solo quien dirige importa la aventura.");
  const pack = game.packs.get(PACK);
  if (!pack) return ui.notifications.error("No encuentro el compendio de la aventura.");
  if (confirmar && !mundoVacio()) {
    const ok = await DialogV2.confirm({
      window: { title: "Importar la aventura", icon: "fa-solid fa-file-import" },
      content: "<p>Este mundo ya tiene contenido. Si importas la aventura se <b>sobrescribirán</b> los documentos de ¡Agua Va! que hayas cambiado a mano (personajes, diarios y escenas).</p>",
      yes: { label: "Importar", icon: "fa-solid fa-file-import" }, no: { label: "Cancelar" }, rejectClose: false
    });
    if (!ok) return;
  }
  ui.notifications.info("¡Agua Va!: importando la aventura (escenas, personajes y diarios)…");
  const aventura = (await pack.getDocuments())[0];
  await aventura.import({ dialog: false });
  await game.settings.set(ID, "importada", true);
  await game.scenes.find(s => s.getFlag(ID, "escena") === "00-amanecer")?.activate();
  ui.notifications.info("¡Aventura importada! Empieza por el diario «¡Agua Va! · La aventura».");
  return true;
}

/**
 * Pone al día los personajes de la aventura que ya estaban en el mundo (importados con una versión anterior): las actualizaciones del sistema
 * no tocan los actores existentes, así que los rivales no tenían sus ataques especiales ni su fase de jefe, y los PJ no tenían su técnica.
 * Solo se tocan los datos de combate de los rivales de la aventura y la técnica vacía de los PJ; nada de lo que hayas escrito a mano.
 */
export async function migrarAventura({ silencioso = false } = {}) {
  if (!game.user.isGM) return 0;
  let n = 0;
  const llevan = (a, c) => a.getFlag(ID, "clave") === c;
  for (const a of game.actors) {
    if (a.type === "pnj") {
      const r = AV.rivales.find(x => x.nombre === a.name || a.getFlag(ID, "rival") === x.clave);
      if (!r) continue;
      const s = a.system, poderes = r.poderes ?? [];
      const igual = s.rol === "rival" && s.dignidad === r.dignidad && s.barras === r.barras && s.rondas === r.rondas && (s.jefe ?? "") === (r.jefe ?? "") && (s.poderes?.length ?? 0) === poderes.length;
      if (igual && llevan(a, r.clave)) continue;
      await a.update({ "system.rol": "rival", "system.dignidad": r.dignidad, "system.barras": r.barras, "system.rondas": r.rondas, "system.jefe": r.jefe ?? "", "system.poderes": poderes,
        [`flags.${ID}.rival`]: r.clave, [`flags.${ID}.clave`]: r.clave });
      n++;
    } else if (a.type === "pj") {
      const p = AV.pjs.find(x => x.nombre === a.name);
      if (!p) continue;
      const cambios = {};
      if (!a.system.tecnica && p.tecnica) cambios["system.tecnica"] = p.tecnica;
      if (!llevan(a, p.clave)) cambios[`flags.${ID}.clave`] = p.clave;
      if (Object.keys(cambios).length) { await a.update(cambios); n++; }
    }
  }
  if (n && !silencioso) ui.notifications.info(`¡Agua Va!: ${n} personaje${n === 1 ? "" : "s"} de la aventura puesto${n === 1 ? "" : "s"} al día (ataques especiales, jefe y técnicas).`);
  return n;
}

async function migrarSiHaceFalta() {
  if (!game.user.isGM || game.user !== game.users.activeGM) return;
  const v = game.system.version;
  if (game.settings.get(ID, "migrada") === v) return;
  try { await migrarAventura(); await game.settings.set(ID, "migrada", v); }
  catch (e) { console.error(`${ID} | la puesta al día de los personajes ha fallado`, e); }
}

async function instalarSiVacio() {
  if (!game.user.isGM || game.user !== game.users.activeGM) return false;
  if (game.settings.get(ID, "importada") || !mundoVacio()) return false;
  return importarAventura();
}

async function bienvenida() {
  if (!game.user.isGM || game.settings.get(ID, "bienvenida") === game.system.version) return;
  await game.settings.set(ID, "bienvenida", game.system.version);
  await publicar({
    tipo: "bienvenida", tono: "dia", icono: "fa-solid fa-droplet", etiqueta: `MR- ¡Agua Va! ${game.system.version}`,
    sfx: "¡SPLASH!", arte: `${ARTE}/marca/portada.webp`, arteClase: "banner",
    titulo: "¡Buenos días, Nerima!",
    texto: "<p>La aventura está en el mundo: escenas, los cuatro personajes malditos (con retrato y figura en las dos formas), rivales y el diario de dirección. El <b>Panel de dirección</b> lleva el reloj real de 120 minutos, el Desbarajuste Acuático, el Vapor, el Termo, las tablillas, los retos flotantes y la máquina de <b>¡PELEA!</b>.</p><p>Reparte los personajes (clic derecho → Configurar propiedad) y que cada jugador lea su ficha privada.</p>",
    botones: [
      { etiqueta: "Panel de dirección", icono: "fa-solid fa-clapperboard", accion: "direccion" },
      { etiqueta: "La aventura", icono: "fa-solid fa-book-open", accion: "diario", datos: { clave: "guia" } },
      { etiqueta: "Seguridad", icono: "fa-solid fa-shield-heart", accion: "seguridad" }
    ],
    fx: { texto: "¡SPLASH!", sonido: "chapuzon", tono: "agua" }
  }, { alias: "Guía de Jusenkyo", soloGM: true });
}

export function registrarInicio() {
  Hooks.on("renderSettings", (app, html) => {
    const raiz = html instanceof HTMLElement ? html : html[0];
    const sitio = raiz?.querySelector("section.settings");
    if (!sitio || raiz.querySelector(".av-ajustes") || !game.user.isGM) return;
    const sec = document.createElement("section");
    sec.className = "av-ajustes flexcol";
    sec.innerHTML = `<h4 class="divider">¡Agua Va!</h4>
      <button type="button" data-av="panel"><i class="fa-solid fa-clapperboard" inert></i> Panel de dirección</button>
      <button type="button" data-av="escenas"><i class="fa-solid fa-sliders" inert></i> Configurador de escenas</button>
      <button type="button" data-av="migrar"><i class="fa-solid fa-arrows-rotate" inert></i> Poner al día los personajes</button>
      <button type="button" data-av="importar"><i class="fa-solid fa-file-import" inert></i> Importar la aventura</button>`;
    sec.addEventListener("click", ev => {
      const a = ev.target.closest("button[data-av]")?.dataset.av;
      if (a === "panel") game.mrAguaVa.abrirDireccion();
      if (a === "escenas") game.mrAguaVa.abrirConfigurador();
      if (a === "migrar") migrarAventura().then(n => { if (!n) ui.notifications.info("Los personajes de la aventura ya están al día."); });
      if (a === "importar") importarAventura({ confirmar: true });
    });
    sitio.after(sec);
  });
  Hooks.once("ready", async () => {
    try { await instalarSiVacio(); await migrarSiHaceFalta(); }
    catch (e) { console.error(`${ID} | la importación automática ha fallado`, e); ui.notifications.error("La importación automática ha fallado. Puedes hacerla desde Configuración → ¡Agua Va!."); }
    await bienvenida();
  });
}
