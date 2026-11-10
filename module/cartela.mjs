/**
 * La cartela del día: un rótulo flotante para todos los jugadores con la hora (Amanecer, Acto I…), el Desbarajuste Acuático,
 * el Termo, las tablillas y, de noche, el Vapor. Se arrastra con el botón derecho; quien dirige abre el panel con un clic.
 */
import { ID, ARTE, estado } from "./mesa.mjs";
import { tramo, minutosReloj, TRAMOS } from "./reglas.mjs";
import AV from "./aventura.mjs";

let caja = null;

/** Momento actual: el del reloj si corre o ha corrido; si no, el de la última cortinilla. */
function momento(e) {
  const min = minutosReloj(e.reloj);
  if (min > 0 || e.reloj.inicio) return tramo(min);
  const ultima = [...AV.cortinillas].reverse().find(c => e.cortinillas.includes(c.id));
  return ultima ? tramo(ultima.minuto) : { nombre: "Nerima", noche: false, clave: "previo" };
}

export function pintarCartela() {
  if (!game.settings.get(ID, "marcadorVisible")) { caja?.remove(); caja = null; return; }
  const e = estado();
  const t = momento(e);
  const noche = t.noche;
  if (!caja) {
    caja = document.createElement("aside");
    caja.id = "av-cartela";
    caja.className = "mr-agua-va av-cartela";
    caja.setAttribute("aria-live", "polite");
    document.body.append(caja);
    colocar();
    arrastrable();
    caja.addEventListener("click", () => { if (game.user.isGM) game.mrAguaVa.abrirDireccion(); });
  }
  caja.classList.toggle("noche", noche);
  caja.classList.toggle("gm", game.user.isGM);
  const pips = (n, max, clase = "") => Array.from({ length: max }, (_, i) => `<i class="${clase} ${i < n ? "llena" : ""}"></i>`).join("");
  const guia = noche ? "presentador-noche" : "presentador-manana";
  caja.innerHTML = `<img src="${ARTE}/personajes/${guia}-cara.webp" alt="">
    <span class="av-cartela-tramo">${t.nombre}</span>
    <span class="av-cartela-medidor" data-tooltip="Desbarajuste Acuático ${e.desbarajuste}/6"><b>Agua</b>${pips(e.desbarajuste, 6)}</span>
    ${noche ? `<span class="av-cartela-medidor vapor" data-tooltip="Vapor ${e.vapor}/6"><b>Vapor</b>${pips(e.vapor, 6)}</span>` : ""}
    <span class="av-cartela-medidor termo" data-tooltip="Termo Portátil ${e.termo}/3"><i class="fa-solid fa-mug-hot" inert></i>${pips(e.termo, 3, "t")}</span>
    <span class="av-cartela-medidor tablillas" data-tooltip="Tablillas conseguidas: ${e.tablillas.length}/3">${[1, 2, 3].map(n => `<em class="${e.tablillas.includes(n) ? "tengo" : ""}">${n}</em>`).join("")}</span>`;
  caja.dataset.tooltip = game.user.isGM ? "Clic: panel de dirección · Botón derecho: arrastrar" : "Botón derecho: arrastrar";
}

function colocar() {
  const p = game.settings.get(ID, "marcadorPos");
  if (Number.isFinite(p?.left)) Object.assign(caja.style, { left: `${p.left}px`, top: `${p.top}px`, transform: "none" });
  else Object.assign(caja.style, { left: "50%", top: "8px", transform: "translateX(-50%)" });
}

/** Botón derecho + arrastrar. Se guarda la posición calculada, no la medida al soltar. */
function arrastrable() {
  caja.addEventListener("contextmenu", ev => ev.preventDefault());
  caja.addEventListener("pointerdown", ev => {
    if (ev.button !== 2) return;
    const r = caja.getBoundingClientRect();
    const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    let pos = { left: r.left, top: r.top };
    try { caja.setPointerCapture(ev.pointerId); } catch {}
    const mover = e => {
      pos = { left: Math.max(0, Math.min(innerWidth - r.width, e.clientX - dx)), top: Math.max(0, Math.min(innerHeight - r.height, e.clientY - dy)) };
      Object.assign(caja.style, { left: `${pos.left}px`, top: `${pos.top}px`, transform: "none" });
    };
    const soltar = () => { caja.removeEventListener("pointermove", mover); caja.removeEventListener("pointerup", soltar); game.settings.set(ID, "marcadorPos", pos); };
    caja.addEventListener("pointermove", mover);
    caja.addEventListener("pointerup", soltar);
  });
}

export function restablecerCartela() {
  game.settings.set(ID, "marcadorPos", {});
  if (caja) { caja.style.top = ""; caja.style.left = ""; colocar(); }
}

export function registrarCartela() {
  Hooks.on("aguava.estado", pintarCartela);
  Hooks.once("ready", () => { pintarCartela(); setInterval(() => { if (estado().reloj.inicio) pintarCartela(); }, 30000); });
}
export { TRAMOS };
