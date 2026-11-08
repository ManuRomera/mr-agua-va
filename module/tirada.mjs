/**
 * ¡PAM! 2.0: 2d6, +1d6 por el talento de la forma (Marcial en Seco, de Bestia en Mojado), +1d6 al huir/esquivar/colarse
 * en forma Mojada, +1d6 por cada PJ que colabora (y se arriesga a la complicación); como mucho 4d6. Cuentan los dos mejores.
 * Solo se tira cuando hay incertidumbre interesante.
 */
import { pjs } from "./mesa.mjs";
import { DialogV2 } from "./compat.mjs";
import { reserva, resultado, dosMejores, esDobles } from "./reglas.mjs";
import { publicar } from "./chat.mjs";
import { formaDe, tokenForma } from "./forma.mjs";

const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

/** Tira los dados de ¡PAM! y devuelve el análisis, sin publicar nada (la ¡PELEA! lo usa también). */
export async function lanzarPam(opts = {}) {
  const n = reserva(opts);
  const roll = await new Roll(`${n}d6kh2`).evaluate();
  const caras = roll.dice[0].results.map(r => r.result);
  const cuentan = new Set(dosMejores(caras));
  const suma = roll.total;
  return { n, roll, caras, cuentan, suma, r: resultado(suma), dobles: esDobles([...cuentan].map(i => caras[i]), suma) };
}

/** Diálogo de tirada para un actor PJ. */
export async function dialogoTirada(actor) {
  const forma = formaDe(actor), mojado = forma === "mojado";
  const otros = pjs().filter(a => a.id !== actor.id);
  const ayudas = otros.map(a => `<label class="av-casilla"><input type="checkbox" name="ayuda" value="${a.id}"><img src="${a.img}" alt="" data-retrato="${a.id}"><span>${esc(a.name)}</span></label>`).join("");
  const talento = mojado ? actor.system.bestia : actor.system.marcial;
  const datos = await DialogV2.prompt({
    window: { title: `¡PAM! · ${actor.name}`, icon: "fa-solid fa-dice" },
    classes: ["mr-agua-va", "av-dialogo"],
    content: `<div class="av-dialogo-cuerpo">
      <label class="av-campo"><span>¿Qué intentas? <small>(opcional)</small></span><input type="text" name="accion" placeholder="Esquivar el chorro del Cisne…" autofocus></label>
      <label class="av-casilla av-casilla-grande"><input type="checkbox" name="talento"><span><b>Mi ${mojado ? "Talento de Bestia" : "Talento Marcial"} ayuda</b> <small>+1 dado · ${esc(talento || "sin definir")}</small></span></label>
      ${mojado ? `<label class="av-casilla av-casilla-grande"><input type="checkbox" name="huida"><span><b>Huyo, esquivo o me cuelo</b> <small>+1 dado automático de la forma Mojada</small></span></label>` : ""}
      ${otros.length ? `<fieldset class="av-ayudas"><legend>Colabora y se arriesga a la complicación <small>+1 dado cada uno</small></legend>${ayudas}</fieldset>` : ""}
      <p class="av-nota">2d6 de base, máximo 4d6. Se suman los <b>dos mejores</b>. 2–5 fiasco útil · 6–8 éxito aparatoso (¡CHAPUZÓN!) · 9–11 éxito brillante · 12 éxito descomunal. Dobles en un éxito: gag del Caos de Nerima.</p>
    </div>`,
    ok: {
      label: "¡PAM!", icon: "fa-solid fa-hand-fist",
      callback: (ev, boton) => {
        const f = boton.form.elements;
        return { accion: f.accion.value.trim(), talento: f.talento.checked, huida: Boolean(f.huida?.checked), ayudas: [...boton.form.querySelectorAll("input[name=ayuda]:checked")].map(i => i.value) };
      }
    },
    rejectClose: false
  });
  if (datos) return tirar(actor, datos);
}

export async function tirar(actor, { accion = "", talento = false, huida = false, ayudas = [] } = {}) {
  const mojado = formaDe(actor) === "mojado";
  const { n, roll, caras, cuentan, suma, r, dobles } = await lanzarPam({ talento, huida: huida && mojado, ayudas: ayudas.length });
  const nombresAyuda = ayudas.map(id => game.actors.get(id)?.name).filter(Boolean);
  const extras = [talento && (mojado ? "bestia" : "marcial"), huida && mojado && "huida", nombresAyuda.length && `ayuda de ${nombresAyuda.join(" y ")}`].filter(Boolean).join(" + ");
  const botones = [];
  if (r.clave === "aparatoso" && !mojado) botones.push({ etiqueta: "¡CHAPUZÓN!", icono: "fa-solid fa-droplet", accion: "chapuzon", datos: { actor: actor.id, motivo: "Un chorro de agua fría desvía el golpe." }, clase: "av-solo-gm" });
  if (r.clave === "fiasco") botones.push({ etiqueta: "+1 Desbarajuste", icono: "fa-solid fa-burst", accion: "desbarajuste", clase: "av-solo-gm" });
  return publicar({
    tipo: "tirada", tono: r.clave, icono: "fa-solid fa-dice", etiqueta: `¡PAM! · ${n}d6${extras ? ` (${extras})` : ""}`,
    sfx: r.sfx, arte: tokenForma(actor), arteClase: "figura", arteAlt: actor.name,
    dados: caras.map((valor, i) => ({ valor, cuenta: cuentan.has(i) })), suma,
    titulo: r.nombre,
    globo: accion ? esc(accion) : "",
    texto: `<p>${r.texto}</p>${dobles ? "<p><b>¡Caos de Nerima!</b> Dobles en un éxito: quien dirige suelta un gag ambiental (un vecino con manguera, un resbalón, un bulto volando).</p>" : ""}`,
    botones: botones.length ? botones : undefined,
    pie: nombresAyuda.length ? `Quien ayuda comparte la complicación si la hay.` : "",
    fx: { texto: r.sfx, sonido: r.clave, tono: r.clave }
  }, { actor, tirada: roll });
}
