/**
 * ¡PAM! 2.0: 2d6, +1d6 por el talento de la forma (Marcial en Seco, de Bestia en Mojado), +1d6 al huir/esquivar/colarse
 * en forma Mojada, +1d6 por cada PJ que colabora (y se arriesga a la complicación); como mucho 4d6. Cuentan los dos mejores.
 * Solo se tira cuando hay incertidumbre interesante.
 * Los dobles de TODA la reserva (también los dados descartados) mandan sobre el azar cómico: dobles altos = Caos de Nerima
 * (gag a favor), dobles bajos = Pifia Cómica (¡CHAPUZÓN! o desastre, aunque la acción saliera bien). Si hay de los dos, manda el Caos.
 */
import { pjs } from "./mesa.mjs";
import { DialogV2 } from "./compat.mjs";
import { reserva, resultado, dosMejores, analizarDados } from "./reglas.mjs";
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
  return { n, roll, caras, cuentan, suma, r: resultado(suma), ...analizarDados(caras, { talento: Boolean(opts.talento) }) };
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
      <p class="av-nota">2d6 de base, máximo 4d6. Se suman los <b>dos mejores</b>. 2–5 fiasco útil · 6–8 éxito aparatoso (¡CHAPUZÓN!) · 9–11 éxito brillante · 12 éxito descomunal. Dobles <b>altos</b> (4-5-6) en cualquier dado: Caos de Nerima a tu favor. Dobles <b>bajos</b> (1-2-3): Pifia Cómica, aunque salga bien (con tu talento, los de 3 son Caos). Si ayudas y hay pifia, la paga quien ayuda.</p>
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
  const { n, roll, caras, cuentan, suma, r, evento } = await lanzarPam({ talento, huida: huida && mojado, ayudas: ayudas.length });
  const nombresAyuda = ayudas.map(id => game.actors.get(id)?.name).filter(Boolean);
  const extras = [talento && (mojado ? "bestia" : "marcial"), huida && mojado && "huida", nombresAyuda.length && `ayuda de ${nombresAyuda.join(" y ")}`].filter(Boolean).join(" + ");
  const botones = [];
  // Pifia Cómica con ayuda complicada: el desastre se lo lleva el ayudante, como escudo humano cómico.
  const ayudante = evento === "pifia" && ayudas.length ? game.actors.get(ayudas[Math.floor(Math.random() * ayudas.length)]) : null;
  const victima = evento === "pifia" ? (ayudante ?? actor) : null;
  if (r.clave === "aparatoso" && !mojado && evento !== "pifia") botones.push({ etiqueta: "¡CHAPUZÓN!", icono: "fa-solid fa-droplet", accion: "chapuzon", datos: { actor: actor.id, motivo: "Un chorro de agua fría desvía el golpe." }, clase: "av-solo-gm" });
  if (victima && formaDe(victima) === "seco") botones.push({ etiqueta: `¡CHAPUZÓN! a ${victima.name}`, icono: "fa-solid fa-droplet", accion: "chapuzon", datos: { actor: victima.id, motivo: "Pifia cómica: el agua fría llega por donde menos se espera." }, clase: "av-solo-gm" });
  if (r.clave === "fiasco") botones.push({ etiqueta: "+1 Desbarajuste", icono: "fa-solid fa-burst", accion: "desbarajuste", clase: "av-solo-gm" });
  const extra = evento === "caos" ? "<p><b>¡Caos de Nerima!</b> Dobles altos: quien dirige suelta un gag ambiental <b>a favor</b> del jugador (un vecino con manguera que empapa al rival, un resbalón oportuno, un bulto volando).</p>"
    : evento === "pifia" ? `<p><b>¡PIFIA CÓMICA!</b> Dobles bajos: ocurre un desastre o un ¡CHAPUZÓN! con agua fría, aunque la acción saliera bien.${ayudante ? ` Había ayuda complicada: el castigo es <b>solo para ${esc(ayudante.name)}</b>, que hace de escudo humano cómico.` : ""}</p>` : "";
  return publicar({
    tipo: "tirada", tono: r.clave, icono: "fa-solid fa-dice", etiqueta: `¡PAM! · ${n}d6${extras ? ` (${extras})` : ""}`,
    sfx: evento === "pifia" ? "¡PIFIA!" : evento === "caos" ? "¡CAOS!" : r.sfx, arte: tokenForma(actor), arteClase: "figura", arteAlt: actor.name,
    dados: caras.map((valor, i) => ({ valor, cuenta: cuentan.has(i) })), suma,
    titulo: r.nombre,
    globo: accion ? esc(accion) : "",
    texto: `<p>${r.texto}</p>${extra}`,
    botones: botones.length ? botones : undefined,
    pie: nombresAyuda.length ? `Quien ayuda comparte la complicación si la hay.` : "",
    fx: { texto: evento === "pifia" ? "¡PIFIA!" : evento === "caos" ? "¡CAOS!" : r.sfx, sonido: evento === "pifia" ? "fiasco" : r.clave, tono: evento === "pifia" ? "agua" : r.clave }
  }, { actor, tirada: roll });
}
