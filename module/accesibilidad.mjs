/**
 * Accesibilidad. Ajustes de cliente (cada persona los suyos, en su navegador) y un panel con un
 * icono en la cabecera de todas las ventanas del sistema, junto al de cerrar:
 * tamaño del texto, alto contraste, fuente de alta legibilidad, reducir movimiento y ayuda inmediata.
 * Solo cambian variables y clases del <body>; los componentes no tienen casos especiales.
 */
import { ID } from "./mesa.mjs";
import { ApplicationV2 } from "./compat.mjs";
import { ConMemoria } from "./memoria.mjs";

const CLAVES = ["a11yEscala", "a11yOscuro", "a11yContraste", "a11yLegible", "a11yMovimiento", "a11yAyuda"];
const CAJAS = [
  ["a11yOscuro", "Hojas en modo oscuro", "Las fichas, el panel y los diarios pasan del papel de revista a tinta clara sobre noche."],
  ["a11yContraste", "Alto contraste", "Texto y bordes más marcados, sin matices."],
  ["a11yLegible", "Fuente de alta legibilidad", "Letra más espaciada y de formas claras; sin rótulos de cómic."],
  ["a11yMovimiento", "Reducir movimiento", "Sin transiciones ni animaciones en las ventanas del sistema."],
  ["a11yAyuda", "Ayuda inmediata", "Los textos de ayuda aparecen al instante al pasar el ratón."]
];

export function aplicarAccesibilidad() {
  const g = k => game.settings.get(ID, k);
  document.documentElement.style.setProperty("--av-escala", String(g("a11yEscala") / 100));
  document.body.classList.toggle("av-oscuro", g("a11yOscuro"));
  document.body.classList.toggle("av-contraste", g("a11yContraste"));
  document.body.classList.toggle("av-legible", g("a11yLegible"));
  document.body.classList.toggle("av-sin-movimiento", g("a11yMovimiento"));
  const tip = game.tooltip?.constructor;
  if (tip) tip.TOOLTIP_ACTIVATION_MS = g("a11yAyuda") ? 60 : 500;
}

/** Registrar en `init`. */
export function registrarAccesibilidad() {
  const reg = (clave, datos) => game.settings.register(ID, clave, { scope: "client", config: true, onChange: () => { aplicarAccesibilidad(); repintar(); }, ...datos });
  reg("a11yEscala", { name: "Accesibilidad · Tamaño del texto (%)", hint: "Escala el texto de las fichas, diálogos y tarjetas de MR- ¡Agua Va!. Ajuste de este navegador.", type: Number, default: 100, range: { min: 85, max: 160, step: 5 } });
  reg("a11yOscuro", { name: "Hojas en modo oscuro", hint: CAJAS[0][2], type: Boolean, default: false });
  reg("a11yContraste", { name: "Accesibilidad · Alto contraste", hint: CAJAS[1][2], type: Boolean, default: false });
  reg("a11yLegible", { name: "Accesibilidad · Fuente de alta legibilidad", hint: CAJAS[2][2], type: Boolean, default: false });
  reg("a11yMovimiento", { name: "Accesibilidad · Reducir movimiento", hint: CAJAS[3][2], type: Boolean, default: false });
  reg("a11yAyuda", { name: "Accesibilidad · Ayuda inmediata", hint: CAJAS[4][2], type: Boolean, default: true });
  Hooks.once("ready", aplicarAccesibilidad);
  // El icono va en la cabecera de toda ventana del sistema: fichas, panel, diálogos, diarios del manual.
  Hooks.on("renderApplicationV2", app => anadirBotonAccesibilidad(app));
}

function repintar() {
  for (const app of foundry.applications.instances.values()) if (app instanceof PanelAccesibilidad) app.render();
}

export class PanelAccesibilidad extends ConMemoria(ApplicationV2) {
  static MEMORIA = "accesibilidad";
  static CAMPOS_MEMORIA = ["left", "top"];

  static DEFAULT_OPTIONS = {
    id: "mr-av-a11y", classes: ["mr-agua-va", "av-dialogo", "av-a11y"], position: { width: 400, height: "auto" },
    window: { title: "Accesibilidad", icon: "fa-solid fa-universal-access" }
  };

  static abrir() {
    return (foundry.applications.instances.get("mr-av-a11y") ?? new PanelAccesibilidad()).render({ force: true });
  }

  async _renderHTML() {
    const g = k => game.settings.get(ID, k);
    const filas = CAJAS.map(([k, t, ayuda]) => `<label class="av-casilla-texto av-a11y-fila"><input type="checkbox" name="${k}" ${g(k) ? "checked" : ""}><span>${t}<small>${ayuda}</small></span></label>`).join("");
    return `<div class="av-dialogo-cuerpo">
      <label class="av-campo av-a11y-escala"><span>Tamaño del texto <b>${g("a11yEscala")}%</b></span>
        <input type="range" name="a11yEscala" min="85" max="160" step="5" value="${g("a11yEscala")}" aria-label="Tamaño del texto"></label>
      ${filas}
      <p class="av-tenue">Son ajustes de este navegador; también están en <b>Configuración → Ajustes del sistema</b>.</p>
      <div class="av-a11y-acciones"><button type="button" class="av-boton av-boton-suave" data-restablecer><i class="fa-solid fa-rotate-left"></i> Restablecer</button></div>
    </div>`;
  }

  _replaceHTML(html, contenido) {
    contenido.innerHTML = html;
    contenido.querySelectorAll("input").forEach(el => el.addEventListener("change", () => {
      game.settings.set(ID, el.name, el.type === "checkbox" ? el.checked : Number(el.value));
    }));
    contenido.querySelector("input[type=range]")?.addEventListener("input", ev => { ev.target.closest("label").querySelector("b").textContent = `${ev.target.value}%`; });
    contenido.querySelector("[data-restablecer]")?.addEventListener("click", async () => {
      for (const k of CLAVES) await game.settings.set(ID, k, game.settings.settings.get(`${ID}.${k}`).default);
    });
  }
}

/** El icono va en la cabecera, justo antes del de cerrar. Idempotente. */
export function anadirBotonAccesibilidad(app) {
  const raiz = app.element;
  if (app instanceof PanelAccesibilidad) return;
  // Ventanas del sistema y diarios del manual (no llevan nuestra clase, pero sí viven en nuestro compendio).
  if (!raiz?.classList?.contains("mr-agua-va") && !app.document?.pack?.startsWith(`${ID}.`)) return;
  const cab = raiz.querySelector(".window-header");
  if (!cab || cab.querySelector(".av-a11y-boton")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "header-control icon fa-solid fa-universal-access av-a11y-boton";
  b.dataset.tooltip = "Accesibilidad";
  b.setAttribute("aria-label", "Opciones de accesibilidad");
  b.addEventListener("click", ev => { ev.stopPropagation(); PanelAccesibilidad.abrir(); });
  const cerrar = cab.querySelector('[data-action="close"]');
  if (cerrar) cerrar.before(b); else cab.append(b);
}
