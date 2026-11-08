/** Hojas V2 con memoria: personaje jugador (perfil de revista con las dos formas y ficha privada) y PNJ de Nerima. */
import { ActorSheetV2, HandlebarsApplicationMixin, enriquecer } from "./compat.mjs";
import { ConMemoria } from "./memoria.mjs";
import { ID, RUTA } from "./mesa.mjs";
import { EditorRetrato, pintarRetratos } from "./retrato.mjs";
import { dialogoTirada } from "./tirada.mjs";
import { formaDe, tokenForma, arteForma, chapuzon, hervir, aplicarForma, cartel } from "./forma.mjs";

class HojaBase extends ConMemoria(HandlebarsApplicationMixin(ActorSheetV2)) {
  static DEFAULT_OPTIONS = {
    classes: ["mr-agua-va", "av-hoja"],
    form: { submitOnChange: true },
    window: { resizable: true },
    actions: {
      retrato: HojaBase.#retrato, figura: HojaBase.#figura, tirar: HojaBase.#tirar,
      forma: HojaBase.#forma, silencio: HojaBase.#silencio, cartel: HojaBase.#cartel
    }
  };
  static SCROLL_MEMORIA = [".av-hoja-cuerpo"];

  get title() { return this.document.name; }

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const a = this.document;
    const forma = formaDe(a);
    return {
      ...base, actor: a, system: a.system, editable: this.isEditable,
      // La ficha privada: su jugador y quien dirige. (Foundry envía los datos a todos: es discreción, no secreto.)
      privado: a.isOwner, esGM: game.user.isGM,
      forma, seco: forma === "seco", mojado: forma === "mojado", color: a.getFlag(ID, "color") || "#2b8fc4",
      figura: tokenForma(a, forma),
      dual: a.getFlag(ID, "retratoDual") || a.img,
      notas: await enriquecer(a.system.notas, a)
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    pintarRetratos(this.element);
  }

  static #retrato() { if (this.isEditable) EditorRetrato.abrir(this.document); }
  static async #figura() {
    if (!this.isEditable) return;
    const FP = foundry.applications.apps.FilePicker.implementation;
    new FP({ type: "image", current: this.document.prototypeToken.texture.src, callback: src => this.document.update({ "prototypeToken.texture.src": src }) }).render({ force: true });
  }
  static #tirar() { return dialogoTirada(this.document); }
  /** SECO ↔ MOJADO con sus reglas: agua fría (¡CHAPUZÓN!) o agua caliente (Hervir). */
  static async #forma(ev, b) {
    if (!this.isEditable) return;
    const a = this.document, quiere = b.dataset.forma;
    if (quiere === formaDe(a)) return;
    return quiere === "mojado" ? chapuzon(a, { motivo: "Agua fría." }) : hervir(a);
  }
  /** Solo quien dirige: cambiar de forma sin tarjeta ni gastar nada. */
  static async #silencio() { if (game.user.isGM) await aplicarForma(this.document, formaDe(this.document) === "seco" ? "mojado" : "seco"); }
  static #cartel() { return cartel(this.document); }
}

export class HojaPJ extends HojaBase {
  static DEFAULT_OPTIONS = { classes: ["av-hoja-pj"], position: { width: 860, height: 780 } };
  static PARTS = { hoja: { template: `${RUTA}/templates/hojas/pj.hbs`, scrollable: [".av-hoja-cuerpo"] } };
}

export class HojaPNJ extends HojaBase {
  static DEFAULT_OPTIONS = { classes: ["av-hoja-pnj"], position: { width: 600, height: 620 } };
  static PARTS = { hoja: { template: `${RUTA}/templates/hojas/pnj.hbs`, scrollable: [".av-hoja-cuerpo"] } };
}
