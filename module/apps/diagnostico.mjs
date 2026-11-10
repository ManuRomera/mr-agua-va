/** Diagnóstico legible y copiable (Configuración → Ajustes → Diagnóstico). */
import { ID, ARTE, estado, pjs } from "../mesa.mjs";
import { ApplicationV2, diagnostico } from "../compat.mjs";
import { ConMemoria } from "../memoria.mjs";

const existe = async src => { try { return (await fetch(src, { method: "HEAD", cache: "no-store" })).ok; } catch { return false; } };
const IMAGENES = ["marca/portada.webp", "personajes/presentador-manana.webp", "personajes/presentador-noche.webp", "personajes/pnj-hidetoshi.webp", "personajes/pj-kenji-seco.webp", "personajes/pj-kenji-mojado.webp"];

export async function informe() {
  const faltan = (await Promise.all(IMAGENES.map(async r => [r, await existe(`${ARTE}/${r}`)]))).filter(([, ok]) => !ok).map(([r]) => r);
  const pack = game.packs.get(`${ID}.aventura`);
  const escenas = game.scenes.filter(s => s.getFlag(ID, "escena")).length;
  const comprobaciones = [
    { ok: Boolean(pack?.index.size), texto: `Compendio de la aventura: ${pack?.index.size ?? 0} aventura(s)` },
    { ok: !faltan.length, texto: faltan.length ? `Faltan imágenes: ${faltan.join(", ")}` : "Imágenes del sistema en su sitio" },
    { ok: escenas >= 17, texto: `Escenas de la aventura en el mundo: ${escenas}/17`, aviso: true },
    { ok: pjs().length > 0, texto: `Personajes jugadores en el mundo: ${pjs().length}`, aviso: true },
    { ok: Boolean(game.users.activeGM), texto: game.users.activeGM ? "Hay un GM conectado" : "No hay GM conectado: los marcadores no se pueden cambiar", aviso: true }
  ];
  const datos = { ...diagnostico(), mundo: game.world.id, usuario: { gm: game.user.isGM }, estado: estado(), escenas, dado3d: Boolean(game.dice3d),
    ajustes: Object.fromEntries(["efectos", "sonido", "sonidoVolumen", "marcadorVisible", "importada"].map(k => [k, game.settings.get(ID, k)])) };
  return { comprobaciones, datos };
}

export class PanelDiagnostico extends ConMemoria(ApplicationV2) {
  static MEMORIA = "diagnostico";
  static DEFAULT_OPTIONS = { id: "av-diagnostico", classes: ["mr-agua-va", "av-dialogo"], position: { width: 560, height: "auto" }, window: { title: "Diagnóstico", icon: "fa-solid fa-stethoscope" } };
  #json = "";
  static abrir() { return (foundry.applications.instances.get("av-diagnostico") ?? new PanelDiagnostico()).render({ force: true }); }

  async _renderHTML() {
    const { comprobaciones, datos } = await informe();
    this.#json = JSON.stringify(datos, null, 2);
    const bien = comprobaciones.every(c => c.ok || c.aviso);
    const filas = comprobaciones.map(c => `<li class="${c.ok ? "ok" : c.aviso ? "aviso" : "mal"}"><i class="fa-solid ${c.ok ? "fa-circle-check" : c.aviso ? "fa-circle-info" : "fa-triangle-exclamation"}"></i> ${foundry.utils.escapeHTML(c.texto)}</li>`).join("");
    return `<div class="av-dialogo-cuerpo"><p class="av-diag-resumen ${bien ? "ok" : "mal"}">${bien ? "Todo en orden." : "Hay cosas que revisar."}</p>
      <ul class="av-diag-lista">${filas}</ul>
      <label class="av-campo"><span>Para copiar cuando haya que contar un fallo</span><textarea readonly rows="8">${foundry.utils.escapeHTML(this.#json)}</textarea></label>
      <div class="av-fila-botones"><button type="button" class="av-boton av-boton-suave" data-diag="actualizar"><i class="fa-solid fa-rotate"></i> Actualizar</button>
      <button type="button" class="av-boton" data-diag="copiar"><i class="fa-solid fa-copy"></i> Copiar</button></div></div>`;
  }

  _replaceHTML(html, el) {
    el.innerHTML = html;
    el.querySelector("[data-diag=actualizar]")?.addEventListener("click", () => this.render());
    el.querySelector("[data-diag=copiar]")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(this.#json); ui.notifications.info("Diagnóstico copiado."); } catch { el.querySelector("textarea")?.select(); }
    });
  }
}
