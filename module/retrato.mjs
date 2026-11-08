/**
 * Encuadre del retrato. Cada actor guarda qué zona de su imagen se ve y con cuánto zoom
 * (`flags.mr-agua-va.retrato = {x, y, z}`: centro del recorte como fracción 0-1 de la imagen y zoom 1-6).
 * El recorte es siempre cuadrado y se aplica con `object-view-box`, así que vale para cualquier
 * <img> sin envoltorios: la ficha, las tarjetas de chat y el directorio.
 */
import { ID } from "./mesa.mjs";
import { ApplicationV2 } from "./compat.mjs";
import { ConMemoria } from "./memoria.mjs";

const acota = (v, min, max) => Math.min(max, Math.max(min, v));
export const ZOOM_MAX = 6;

export const retratoDe = actor => actor?.getFlag(ID, "retrato") ?? null;

/** `inset()` en píxeles naturales del cuadrado que se ve. */
export function recorte({ x, y, z }, ancho, alto) {
  const lado = Math.min(ancho, alto) / Math.max(1, z);
  const izq = acota(x * ancho - lado / 2, 0, ancho - lado);
  const sup = acota(y * alto - lado / 2, 0, alto - lado);
  return `inset(${sup}px ${ancho - izq - lado}px ${alto - sup - lado}px ${izq}px)`;
}

/** Aplica (o quita, si no hay datos) el encuadre a una imagen. */
export function aplicar(img, datos) {
  if (!img) return;
  if (!datos) { img.style.objectViewBox = ""; delete img.dataset.encuadrado; return; }
  const poner = () => {
    if (!img.naturalWidth) return;
    img.style.objectFit = "cover";
    img.style.objectViewBox = recorte(datos, img.naturalWidth, img.naturalHeight);
    img.dataset.encuadrado = "";
  };
  if (img.complete && img.naturalWidth) poner(); else img.addEventListener("load", poner, { once: true });
}

const mismaImagen = (img, ruta) => {
  try { return decodeURIComponent(new URL(img.src, location.href).pathname).endsWith(`/${ruta.replace(/^\//, "")}`); }
  catch { return false; }
};

/** Aplica el encuadre en un fragmento de la interfaz: nuestras ventanas, el chat y el directorio de Actores. */
export function pintarRetratos(raiz = document) {
  const el = raiz instanceof HTMLElement ? raiz : raiz?.[0];
  if (!el) return;
  for (const img of el.querySelectorAll("img[data-retrato]")) aplicar(img, retratoDe(game.actors.get(img.dataset.retrato)));
  for (const li of el.querySelectorAll("#actors li.directory-item[data-entry-id], li.directory-item.actor[data-entry-id]")) {
    const a = game.actors.get(li.dataset.entryId);
    const img = li.querySelector("img.thumbnail");
    if (a && img && mismaImagen(img, a.img)) aplicar(img, retratoDe(a));
  }
}

/** Tras cambiar un encuadre se repinta lo que ya estaba en pantalla. */
export function repintarRetratos() {
  ui.actors?.render();
  pintarRetratos(document.body);
}

export class EditorRetrato extends ConMemoria(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "mr-av-retrato", classes: ["mr-agua-va", "av-dialogo", "av-retrato-editor"], position: { width: 620, height: "auto" },
    window: { icon: "fa-solid fa-crop-simple", title: "Encuadre del retrato" }
  };

  static MEMORIA = "retrato";
  static CAMPOS_MEMORIA = ["left", "top"];
  static abrir(actor) { return new EditorRetrato(actor).render({ force: true }); }

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.src = actor.img;
    this.r = { x: 0.5, y: 0.5, z: 1, ...(retratoDe(actor) ?? {}) };
  }

  get title() { return `Encuadre · ${this.actor.name}`; }

  async _renderHTML() {
    return `<div class="av-ret">
      <div class="av-ret-cuerpo">
        <div class="av-ret-escenario" tabindex="0" role="application" aria-label="Zona visible del retrato. Flechas para mover, más y menos para el zoom.">
          <img class="base" src="${this.src}" alt="" draggable="false"><div class="marco"></div>
        </div>
        <div class="av-ret-lado">
          <div class="vistas"><img class="v-ficha" src="${this.src}" alt=""><img class="v-media" src="${this.src}" alt=""><img class="v-chica" src="${this.src}" alt=""></div>
          <label class="av-campo"><span>Zoom <b class="zoom-valor"></b></span><input type="range" name="zoom" min="1" max="${ZOOM_MAX}" step="0.05" aria-label="Zoom"></label>
          <p class="av-nota">Arrastra el recuadro sobre la imagen o pulsa donde quieras centrarlo. La rueda del ratón cambia el zoom. Se ve igual en la ficha, el chat y el directorio.</p>
        </div>
      </div>
      <footer class="av-pie-formulario">
        <span class="av-ret-acciones"><button type="button" class="av-boton av-boton-suave" data-cambiar><i class="fa-solid fa-image"></i> Cambiar imagen</button><button type="button" class="av-boton av-boton-suave" data-restablecer><i class="fa-solid fa-rotate-left"></i> Restablecer</button></span>
        <button type="button" class="av-boton av-boton-principal" data-guardar><i class="fa-solid fa-check"></i> Guardar</button>
      </footer>
    </div>`;
  }

  _replaceHTML(html, contenido) {
    contenido.innerHTML = html;
    this.el = contenido;
    this.escenario = contenido.querySelector(".av-ret-escenario");
    this.base = contenido.querySelector("img.base");
    const arrancar = () => this.#dibujar();
    if (this.base.complete && this.base.naturalWidth) arrancar(); else this.base.addEventListener("load", arrancar, { once: true });
    new ResizeObserver(arrancar).observe(this.escenario);

    const mover = ev => {
      const caja = this.base.getBoundingClientRect();
      this.r.x = acota((ev.clientX - caja.left) / caja.width, 0, 1);
      this.r.y = acota((ev.clientY - caja.top) / caja.height, 0, 1);
      this.#dibujar();
    };
    this.escenario.addEventListener("pointerdown", ev => {
      this.escenario.setPointerCapture(ev.pointerId);
      mover(ev);
      const seguir = e => mover(e);
      const soltar = () => { this.escenario.removeEventListener("pointermove", seguir); this.escenario.removeEventListener("pointerup", soltar); };
      this.escenario.addEventListener("pointermove", seguir);
      this.escenario.addEventListener("pointerup", soltar);
    });
    this.escenario.addEventListener("wheel", ev => { ev.preventDefault(); this.#zoom(this.r.z + (ev.deltaY < 0 ? 0.2 : -0.2)); }, { passive: false });
    this.escenario.addEventListener("keydown", ev => {
      const paso = ev.shiftKey ? 0.05 : 0.01;
      const k = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[ev.key];
      if (k) { ev.preventDefault(); this.r.x = acota(this.r.x + k[0], 0, 1); this.r.y = acota(this.r.y + k[1], 0, 1); this.#dibujar(); }
      if (ev.key === "+" || ev.key === "=") this.#zoom(this.r.z + 0.2);
      if (ev.key === "-") this.#zoom(this.r.z - 0.2);
    });
    contenido.querySelector("input[name=zoom]").addEventListener("input", ev => this.#zoom(Number(ev.target.value)));
    contenido.querySelector("[data-restablecer]").addEventListener("click", () => { this.r = { x: 0.5, y: 0.5, z: 1 }; this.#dibujar(); });
    contenido.querySelector("[data-cambiar]").addEventListener("click", () => this.#cambiarImagen());
    contenido.querySelector("[data-guardar]").addEventListener("click", () => this.#guardar());
  }

  #zoom(z) { this.r.z = acota(Math.round(z * 100) / 100, 1, ZOOM_MAX); this.#dibujar(); }

  /** Marco sobre la imagen del escenario y las tres vistas previas. */
  #dibujar() {
    const b = this.base;
    if (!b?.naturalWidth) return;
    const caja = this.escenario.getBoundingClientRect();
    if (!caja.width || !caja.height) return; // sin layout aún: el ResizeObserver lo retoma
    const k = Math.min(caja.width / b.naturalWidth, caja.height / b.naturalHeight);
    const w = b.naturalWidth * k, h = b.naturalHeight * k;
    Object.assign(b.style, { width: `${w}px`, height: `${h}px`, left: `${(caja.width - w) / 2}px`, top: `${(caja.height - h) / 2}px` });
    const lado = Math.min(w, h) / this.r.z;
    // El recuadro nunca se sale de la imagen: el centro se acota con él.
    this.r.x = acota(this.r.x, lado / 2 / w, 1 - lado / 2 / w);
    this.r.y = acota(this.r.y, lado / 2 / h, 1 - lado / 2 / h);
    const marco = this.escenario.querySelector(".marco");
    Object.assign(marco.style, { width: `${lado}px`, height: `${lado}px`, left: `${(caja.width - w) / 2 + this.r.x * w - lado / 2}px`, top: `${(caja.height - h) / 2 + this.r.y * h - lado / 2}px` });
    this.el.querySelector(".zoom-valor").textContent = `${this.r.z.toFixed(2)}×`;
    this.el.querySelector("input[name=zoom]").value = this.r.z;
    for (const v of this.el.querySelectorAll(".vistas img")) aplicar(v, this.r);
  }

  async #cambiarImagen() {
    const FP = foundry.applications.apps.FilePicker.implementation;
    new FP({ type: "image", current: this.src, callback: ruta => { this.src = ruta; this.r = { x: 0.5, y: 0.5, z: 1 }; this.render(); } }).render({ force: true });
  }

  async #guardar() {
    const cambios = { [`flags.${ID}.retrato`]: { x: Math.round(this.r.x * 1000) / 1000, y: Math.round(this.r.y * 1000) / 1000, z: this.r.z } };
    if (this.src !== this.actor.img) cambios.img = this.src;
    if (this.r.z === 1 && this.r.x === 0.5 && this.r.y === 0.5) { cambios[`flags.${ID}.-=retrato`] = null; delete cambios[`flags.${ID}.retrato`]; }
    await this.actor.update(cambios);
    repintarRetratos();
    this.close();
  }
}
