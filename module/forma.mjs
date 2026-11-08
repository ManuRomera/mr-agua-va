/**
 * Las dos formas de un personaje maldito de Jusenkyo: SECO (humano) y MOJADO (animal).
 * Cambiar de forma cambia el campo `system.forma`, el retrato del actor y la figura (token) del actor y de los
 * tokens que ya están en escena. Aquí viven también el agua caliente (Hervir) y los Carteles de Madera.
 */
import { ID, ARTE, estado, cambiarEstado } from "./mesa.mjs";
import { DialogV2 } from "./compat.mjs";
import { publicar } from "./chat.mjs";
import { recortarCartel, maxPalabras } from "./reglas.mjs";

const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

export const formaDe = actor => (actor?.system?.forma === "mojado" ? "mojado" : "seco");
/** Imagen de una forma: guardada en flags.mr-agua-va.formas.{seco|mojado} = {img, token}. */
export const arteForma = (actor, forma = formaDe(actor)) => actor?.getFlag?.(ID, "formas")?.[forma] ?? null;
export const tokenForma = (actor, forma = formaDe(actor)) => arteForma(actor, forma)?.token || actor?.prototypeToken?.texture?.src || actor?.img;
export const caraForma = (actor, forma = formaDe(actor)) => arteForma(actor, forma)?.cara || arteForma(actor, forma)?.img || actor?.img;

/** Pone al actor en una forma, con su retrato y su figura. Devuelve false si ya estaba. */
export async function aplicarForma(actor, forma) {
  if (!["seco", "mojado"].includes(forma) || formaDe(actor) === forma) return false;
  const a = arteForma(actor, forma);
  const cambios = { "system.forma": forma };
  if (a?.img) cambios.img = a.img;
  if (a?.token) cambios["prototypeToken.texture.src"] = a.token;
  await actor.update(cambios);
  if (a?.token) for (const t of actor.getActiveTokens(false, true)) await t.update({ "texture.src": a.token });
  return true;
}

/** ¡CHAPUZÓN!: agua fría. Seco → Mojado, con tarjeta y efecto en toda la mesa. */
export async function chapuzon(actor, { motivo = "" } = {}) {
  if (!actor) return;
  const cambio = await aplicarForma(actor, "mojado");
  if (!cambio) return ui.notifications.info(`${actor.name} ya está Mojado.`);
  return publicar({
    tipo: "chapuzon", tono: "agua", icono: "fa-solid fa-droplet", etiqueta: "¡CHAPUZÓN!", sfx: "¡SPLASH!",
    arte: tokenForma(actor, "mojado"), arteClase: "figura", arteAlt: actor.name,
    titulo: `${actor.name} se transforma`,
    texto: `<p>${esc(actor.system.maldicion || "La maldición de Jusenkyo")}: ${esc(actor.system.animal || "forma animal")}. ${motivo ? esc(motivo) + " " : ""}A partir de ahora, <b>solo gruñidos y Carteles de Madera</b>.</p>`,
    pie: actor.system.defecto ? `<b>Defecto cómico:</b> ${esc(actor.system.defecto)}` : "",
    fx: { texto: "¡CHAPUZÓN!", sonido: "chapuzon", tono: "agua" }
  }, { actor });
}

/** Regla del Hervidor: una acción de escena junto a una fuente de calor devuelve la forma humana. */
export async function hervir(actor, { fuente = null } = {}) {
  if (!actor) return;
  if (formaDe(actor) !== "mojado") return ui.notifications.info(`${actor.name} ya está Seco.`);
  const e = estado();
  if (!fuente) {
    fuente = await DialogV2.prompt({
      window: { title: "Agua caliente", icon: "fa-solid fa-mug-hot" },
      classes: ["mr-agua-va", "av-dialogo"],
      content: `<div class="av-dialogo-cuerpo"><p class="av-nota">Volver a la forma humana ocupa una acción de escena junto a una fuente de calor.</p>
        <label class="av-casilla-texto"><input type="radio" name="fuente" value="termo" ${e.termo ? "checked" : "disabled"}><span><b>Termo Portátil</b><small>${e.termo} carga${e.termo === 1 ? "" : "s"}; gasta una</small></span></label>
        <label class="av-casilla-texto"><input type="radio" name="fuente" value="escena" ${e.termo ? "" : "checked"}><span><b>Fuente de calor de la escena</b><small>Ramen, tetera, caldera de un baño… no gasta carga</small></span></label></div>`,
      ok: { label: "¡Hervir!", icon: "fa-solid fa-fire-flame-curved", callback: (ev, b) => b.form.elements.fuente.value || null },
      rejectClose: false
    });
    if (!fuente) return;
  }
  if (fuente === "termo") {
    if (estado().termo < 1) return ui.notifications.warn("El Termo está vacío.");
    await cambiarEstado({ termo: estado().termo - 1 });
  }
  await aplicarForma(actor, "seco");
  return publicar({
    tipo: "hervir", tono: "caliente", icono: "fa-solid fa-mug-hot", etiqueta: "¡Agua caliente!", sfx: "¡FUUUSH!",
    arte: tokenForma(actor, "seco"), arteClase: "figura", arteAlt: actor.name,
    titulo: `${actor.name} vuelve a ser persona`,
    texto: `<p>${fuente === "termo" ? "Una carga del Termo Portátil" : "Una fuente de calor de la escena"} y el vapor hace su trabajo. ${fuente === "termo" ? `Quedan ${estado().termo} cargas.` : ""}</p>`,
    fx: { texto: "¡FUUUSH!", sonido: "brillante", tono: "caliente" }
  }, { actor });
}

/** Cartel de Madera: pone el rótulo en el chat. Cuatro palabras como mucho; el Vapor las recorta. */
export async function cartel(actor) {
  if (!actor) return;
  if (formaDe(actor) !== "mojado" && !game.user.isGM) return ui.notifications.warn("Solo se levantan Carteles de Madera en forma Mojada.");
  const vapor = estado().vapor;
  const max = maxPalabras(vapor);
  const bruto = await DialogV2.prompt({
    window: { title: `Cartel de Madera · ${actor.name}`, icon: "fa-solid fa-signs-post" },
    classes: ["mr-agua-va", "av-dialogo"],
    content: `<div class="av-dialogo-cuerpo"><div class="av-cartel-madera av-cartel-previa"><span data-previa>¡…!</span></div>
      <label class="av-campo"><span>Lo que escribes a pincel <small>(${max} palabra${max === 1 ? "" : "s"} como mucho${vapor >= 2 ? ` · el Vapor ${vapor} se come palabras` : ""})</small></span>
      <input type="text" name="cartel" autocomplete="off" placeholder="¡Tira del cable, idiota!" autofocus></label>
      <p class="av-nota" data-cuenta>${max} palabras disponibles.</p></div>`,
    render: (ev, dialogo) => {
      const input = dialogo.element.querySelector("[name=cartel]"), previa = dialogo.element.querySelector("[data-previa]"), cuenta = dialogo.element.querySelector("[data-cuenta]");
      input?.addEventListener("input", () => {
        const r = recortarCartel(input.value, vapor);
        previa.textContent = r.texto || "¡…!";
        cuenta.textContent = r.recortado ? `Solo caben ${r.max}: lo demás se queda fuera.` : `${r.max} palabra${r.max === 1 ? "" : "s"} como mucho.`;
      });
    },
    ok: { label: "¡Levantar!", icon: "fa-solid fa-hand", callback: (ev, b) => b.form.elements.cartel.value },
    rejectClose: false
  });
  const r = recortarCartel(bruto, vapor);
  if (!r.texto) return;
  return publicar({
    tipo: "cartel", tono: "madera", icono: "fa-solid fa-signs-post", etiqueta: "Cartel de Madera", sfx: "¡TOC!",
    arte: tokenForma(actor), arteClase: "figura mini", arteAlt: actor.name,
    titulo: "", cartel: r.texto, pie: r.recortado ? "El vapor se ha comido las demás palabras." : "",
    fx: { sonido: "madera", tono: "madera" }
  }, { actor });
}
