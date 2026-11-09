/**
 * Panel de dirección (solo GM): reloj real de 120 minutos, Desbarajuste Acuático, Vapor Nocturno, Termo y tablillas,
 * las cuatro cortinillas del Guía de Jusenkyo, los 18 retos flotantes, la máquina de ¡PELEA!, la noche en la
 * Casa de Baños (tuberías, vías, finales) y el reparto.
 */
import { ApplicationV2, HandlebarsApplicationMixin } from "../compat.mjs";
import { ConMemoria } from "../memoria.mjs";
import { ID, RUTA, ARTE, estado, cambiarEstado, pjs } from "../mesa.mjs";
import { DESBARAJUSTE, VAPOR, tramo, minutosReloj, cortinillaPendiente, maxPalabras } from "../reglas.mjs";
import { publicar } from "../chat.mjs";
import { chapuzonPantalla } from "../efectos.mjs";
import { pintarRetratos } from "../retrato.mjs";
import { iniciarPelea, terminarPelea, accionesMando } from "../pelea.mjs";
import { chapuzon, formaDe, tokenForma } from "../forma.mjs";
import AV from "../aventura.mjs";

const GRUPOS = [
  { clave: "personal", nombre: "Personales", test: r => r.grupo === "personal" },
  { clave: "publico", nombre: "Públicos", test: r => r.grupo === "publico" },
  { clave: "grande", nombre: "Gran escala", test: r => r.grupo === "grande" },
  { clave: "otros", nombre: "Social y comodín", test: r => ["social", "comodin"].includes(r.grupo) }
];
export const FRASES_GUIA = [
  "¡Y aquí, amigos, se ve claramente la tragedia del barrio que acaba de mojarse!",
  "Recuerden: el agua fría es amiga hasta que deja de serlo.",
  "Esa nutria es profesional.",
  "Yo solo cuento la historia. El cubo no es cosa mía.",
  "¿Alguien ha visto mi termo? Ah, no, aquí está. ¡Fideos!",
  "Atención, vecinos: se recomienda el uso de paraguas… y de dignidad."
];
const TUBERIAS = [
  "Un chorro helado en la cara de quien gire la rueda: ¡CHAPUZÓN!",
  "Una nube de vapor: +1 Vapor.",
  "Agua caliente por la regadera más cercana: cualquier Mojado se seca (Hervir gratis).",
  "Un gong metálico que se oye en todo el edificio: Hidetoshi sabe que estáis ahí.",
  "Una válvula se queda en la mano: Entorno +1d6 para la siguiente tirada.",
  "Todo sale bien, por una vez: −1 Vapor."
];

const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const mmss = m => `${String(Math.floor(m)).padStart(2, "0")}:${String(Math.floor((m % 1) * 60)).padStart(2, "0")}`;

/** El Guía de Jusenkyo habla en el chat. */
export function guiaHabla(texto, { arte = "guia-manana", titulo = "Guía de Jusenkyo" } = {}) {
  return publicar({
    tipo: "guia", tono: "guia", icono: "fa-solid fa-microphone-lines", etiqueta: titulo, arte: `${ARTE}/personajes/${arte}.webp`, arteClase: "figura mini",
    titulo: "", globo: esc(texto)
  }, { alias: "Guía de Jusenkyo" });
}

/** Activa una escena de la aventura por su clave (flags.mr-agua-va.escena). */
export async function activarEscena(clave) {
  const s = game.scenes.find(x => x.getFlag(ID, "escena") === clave);
  if (!s) return ui.notifications.warn("No encuentro esa escena: importa la aventura desde Configuración → ¡Agua Va!.");
  await s.activate();
  return s;
}

export async function lanzarCortinilla(id) {
  const c = AV.cortinillas.find(x => x.id === id);
  if (!c) return;
  await activarEscena(c.escena);
  const e = estado();
  await cambiarEstado({ cortinillas: [...new Set([...e.cortinillas, id])], ...(id === "noche" ? { vapor: Math.max(1, e.vapor) } : {}) });
  return publicar({
    tipo: "cortinilla", tono: id === "noche" ? "noche" : "dia", icono: id === "noche" ? "fa-solid fa-moon" : "fa-solid fa-sun",
    etiqueta: `Cortinilla · minuto ${c.minuto}`, sfx: "¡DING-DONG!", arte: `${ARTE}/personajes/${c.guia}.webp`, arteClase: "figura",
    titulo: c.titulo, texto: c.lineas.map(l => `<p>${l}</p>`).join(""),
    fx: { texto: "¡DING-DONG!", sonido: "campanilla", tono: id === "noche" ? "noche" : "rosa" }
  }, { alias: "Guía de Jusenkyo" });
}

export class PanelDireccion extends ConMemoria(HandlebarsApplicationMixin(ApplicationV2)) {
  static MEMORIA = "direccion";
  static DEFAULT_OPTIONS = {
    id: "av-direccion",
    classes: ["mr-agua-va", "av-direccion"],
    position: { width: 800, height: 740 },
    window: { title: "Panel de dirección", icon: "fa-solid fa-clapperboard", resizable: true },
    actions: {
      reloj: PanelDireccion.#reloj, marcador: PanelDireccion.#marcador, chapuzonPantalla: () => chapuzonPantalla(),
      cortinilla: (ev, b) => lanzarCortinilla(b.dataset.id), escena: (ev, b) => activarEscena(b.dataset.clave),
      reto: PanelDireccion.#reto, estadoReto: PanelDireccion.#estadoReto, frase: (ev, b) => guiaHabla(FRASES_GUIA[b.dataset.i]),
      tablilla: PanelDireccion.#tablilla, tuberia: PanelDireccion.#tuberia, chaparron: PanelDireccion.#chaparron, valvula: PanelDireccion.#valvula,
      final: PanelDireccion.#final, abrir: (ev, b) => game.actors.get(b.dataset.id)?.sheet.render(true),
      diario: (ev, b) => game.journal.find(j => j.getFlag(ID, "clave") === b.dataset.clave)?.sheet.render(true),
      seguridad: () => game.mrAguaVa.abrirSeguridad(), filtro: PanelDireccion.#filtro,
      pelea: PanelDireccion.#pelea, peleaRapida: PanelDireccion.#peleaRapida, peleaTerminar: () => terminarPelea(), peleaForzar: () => accionesMando.forzar()
    }
  };
  static PARTS = { panel: { template: `${RUTA}/templates/apps/direccion.hbs`, scrollable: [".av-pestana"] } };
  static SCROLL_MEMORIA = [".av-pestana.active"];
  tabGroups = { panel: "mesa" };
  filtro = "todos";
  sel = { a: null, b: new Set(), rondas: 0, cruces: 6 };

  static abrir() {
    if (!game.user.isGM) return ui.notifications.warn("El panel de dirección es para quien dirige.");
    return (foundry.applications.instances.get("av-direccion") ?? new PanelDireccion()).render({ force: true });
  }

  async _prepareContext() {
    const e = estado();
    const min = minutosReloj(e.reloj);
    const t = tramo(min);
    const pendiente = cortinillaPendiente(min, e.cortinillas);
    const todos = pjs();
    this.sel.a ??= new Set(todos.map(a => a.id));
    const rivales = game.actors.filter(a => a.type === "pnj" && a.system.rol === "rival");
    const casillas = (n, max) => Array.from({ length: max }, (_, i) => ({ n: i + 1, llena: i + 1 <= n }));
    return {
      pestana: this.tabGroups.panel,
      pestanas: [["mesa", "La mesa", "fa-sun"], ["retos", "Retos", "fa-burst"], ["pelea", "¡Pelea!", "fa-hand-fist"], ["noche", "La noche", "fa-moon"], ["reparto", "Reparto", "fa-users"]]
        .map(([id, nombre, icono]) => ({ id, nombre, icono, activa: id === this.tabGroups.panel })),
      reloj: { texto: mmss(min), marcha: Boolean(e.reloj.inicio), tramo: t.nombre, pct: Math.min(100, (min / 120) * 100), aviso: pendiente ? AV.cortinillas.find(c => c.id === pendiente)?.titulo : "" },
      desbarajuste: { valor: e.desbarajuste, texto: DESBARAJUSTE[e.desbarajuste], casillas: casillas(e.desbarajuste, 6) },
      vapor: { valor: e.vapor, texto: VAPOR[e.vapor], palabras: maxPalabras(e.vapor), casillas: casillas(e.vapor, 6), cuenta: e.cuentaAtras?.restantes ?? 0 },
      termo: { valor: e.termo, casillas: casillas(e.termo, 3) },
      tablillas: [1, 2, 3].map(n => ({ n, tengo: e.tablillas.includes(n), reto: `R0${n}` })),
      cortinillas: AV.cortinillas.map(c => ({ ...c, hecha: e.cortinillas.includes(c.id), arte: `${ARTE}/personajes/${c.guia}.webp` })),
      filtro: this.filtro,
      grupos: [{ clave: "todos", nombre: "Todos" }, ...GRUPOS].map(g => ({ ...g, activo: g.clave === this.filtro })),
      retos: AV.retos.filter(r => this.filtro === "todos" || GRUPOS.find(g => g.clave === this.filtro)?.test(r)).map(r => ({ ...r, estado: e.retos[r.id] ?? "", reservado: r.grupo === "grande" && e.desbarajuste < 3 })),
      frases: FRASES_GUIA.map((texto, i) => ({ texto, i })),
      pelea: {
        activa: Boolean(e.pelea), fase: e.pelea?.fase, ronda: e.pelea?.ronda,
        a: todos.map(a => ({ id: a.id, nombre: a.name, img: tokenForma(a), marcado: this.sel.a.has(a.id) })),
        b: rivales.map(a => ({ id: a.id, nombre: a.name, img: a.img, dignidad: a.system.dignidad, barras: a.system.barras, rondas: a.system.rondas, marcado: this.sel.b.has(a.id) })),
        rondas: this.sel.rondas, cruces: this.sel.cruces,
        rapidas: AV.rivales.map(r => ({ clave: r.clave, nombre: r.nombre, texto: `${r.dignidad}${r.barras > 1 ? ` × ${r.barras}` : ""} de Dignidad · ${r.rondas === 1 ? "una ronda" : `mejor de ${r.rondas * 2 - 1}`}`, tipo: r.tipo }))
      },
      vias: AV.vias,
      finales: AV.finales.map(f => ({ ...f, elegido: e.final === f.id })),
      cameos: AV.cameos,
      reparto: todos.map(a => ({ id: a.id, nombre: a.name, apodo: a.system.apodo, img: a.img, mojado: formaDe(a) === "mojado", duenos: game.users.filter(u => !u.isGM && a.testUserPermission(u, "OWNER")).map(u => u.name).join(", ") })),
      vecinos: game.actors.filter(a => a.type === "pnj").map(a => ({ id: a.id, nombre: a.name, img: a.img })),
      arte: ARTE
    };
  }

  async _onRender(ctx, op) {
    await super._onRender(ctx, op);
    pintarRetratos(this.element);
    // Selección de contendientes de la ¡PELEA!
    this.element.querySelectorAll("[data-bando]").forEach(c => c.addEventListener("change", () => { (this.sel[c.dataset.bando] ??= new Set())[c.checked ? "add" : "delete"](c.value); }));
    this.element.querySelector("[name=rondas]")?.addEventListener("change", ev => { this.sel.rondas = Number(ev.target.value); });
    this.element.querySelector("[name=cruces]")?.addEventListener("change", ev => { this.sel.cruces = Number(ev.target.value) || 6; });
    clearInterval(this._tic);
    this._tic = setInterval(() => { if (this.rendered && estado().reloj.inicio) this.render({ parts: ["panel"] }); }, 10000);
  }

  async close(o) { clearInterval(this._tic); return super.close(o); }

  static async #reloj(ev, b) {
    const r = estado().reloj;
    const ahora = Date.now();
    const accion = b.dataset.op;
    let nuevo = r;
    if (accion === "marcha") nuevo = r.inicio ? { inicio: null, acumulado: r.acumulado + (ahora - r.inicio) } : { inicio: ahora, acumulado: r.acumulado };
    if (accion === "menos" || accion === "mas") nuevo = { inicio: r.inicio, acumulado: Math.max(0, r.acumulado + (accion === "mas" ? 5 : -5) * 60000) };
    if (accion === "cero") nuevo = { inicio: null, acumulado: 0 };
    await cambiarEstado({ reloj: nuevo, ...(accion === "cero" ? { cortinillas: [], desbarajuste: 0, vapor: 0, termo: 3, tablillas: [], retos: {}, final: "", cuentaAtras: null, pelea: null } : {}) });
  }

  static async #marcador(ev, b) {
    const e = estado();
    const clave = b.dataset.clave;
    const v = b.dataset.valor !== undefined ? Number(b.dataset.valor) : e[clave] + Number(b.dataset.delta);
    // Pulsar la casilla ya marcada la desmarca.
    await cambiarEstado({ [clave]: b.dataset.valor !== undefined && v === e[clave] ? v - 1 : v });
  }

  static async #tablilla(ev, b) {
    const e = estado(), n = Number(b.dataset.n);
    await cambiarEstado({ tablillas: e.tablillas.includes(n) ? e.tablillas.filter(x => x !== n) : [...e.tablillas, n] });
  }

  static async #reto(ev, b) {
    const r = AV.retos.find(x => x.id === b.dataset.id);
    if (!r) return;
    const e = estado();
    await cambiarEstado({ retos: { ...e.retos, [r.id]: "activo" } });
    return publicar({
      tipo: "reto", tono: "reto", icono: "fa-solid fa-burst", etiqueta: `Reto ${r.id} · ${r.quien}`, sfx: "¡SPLASH!",
      arte: `${ARTE}/escenas/${r.escena}-thumb.webp`, arteClase: "banner", titulo: r.titulo,
      texto: `<p>${esc(r.situacion)}</p><p><b>¡Urgente!</b> ${esc(r.urgencia)}</p>${r.tablilla ? `<p><b>Tablilla nº ${r.tablilla}</b> en juego.</p>` : ""}${r.pelea ? "<p><b>¡PELEA!</b> disponible: pulsa la pestaña ¡Pelea! del panel.</p>" : ""}`,
      pie: "¿Qué hacéis?", fx: { texto: "¡SPLASH!", sonido: "chapuzon", tono: "agua" }
    }, { alias: "Nerima" });
  }

  static async #estadoReto(ev, b) {
    const e = estado();
    const retos = { ...e.retos };
    retos[b.dataset.id] === "resuelto" ? delete retos[b.dataset.id] : (retos[b.dataset.id] = "resuelto");
    await cambiarEstado({ retos });
  }

  /** Tuberías cruzadas de la sala de calderas (d6). */
  static async #tuberia() {
    const roll = await new Roll("1d6").evaluate();
    const n = roll.total;
    return publicar({
      tipo: "tuberia", tono: n === 6 ? "brillante" : n === 1 ? "fiasco" : "aparatoso", icono: "fa-solid fa-faucet-drip", etiqueta: `Tuberías cruzadas · d6 = ${n}`, sfx: "¡PSSSHH!",
      arte: `${ARTE}/escenas/14-calderas-thumb.webp`, arteClase: "banner", titulo: "Algo gorgotea en las tuberías", texto: `<p>${TUBERIAS[n - 1]}</p>`,
      fx: { texto: "¡PSSSHH!", sonido: "aparatoso", tono: "caliente" }
    }, { alias: "La caldera", tirada: roll });
  }

  /** Vapor 6: cerrar una válvula de seguridad apaga la cuenta atrás y baja el Vapor. */
  static async #valvula() {
    await cambiarEstado({ vapor: 4, cuentaAtras: null });
    return publicar({ tipo: "valvula", tono: "brillante", icono: "fa-solid fa-gauge-high", etiqueta: "Válvula de seguridad", sfx: "¡PSSSHH!", arte: `${ARTE}/escenas/14-calderas-thumb.webp`, arteClase: "banner",
      titulo: "¡Válvula cerrada!", texto: "<p>La presión baja de golpe, el temblor cesa y la cuenta atrás se detiene. <b>El Vapor baja a 4.</b></p>", fx: { texto: "¡PSSSHH!", sonido: "brillante", tono: "caliente" } }, { alias: "La caldera" });
  }

  /** R18: un chaparrón empapa a todos los personajes. */
  static async #chaparron() {
    for (const a of pjs()) if (formaDe(a) === "seco") await chapuzon(a, { motivo: "¡Chaparrón de verano!" });
  }

  static async #final(ev, b) {
    const f = AV.finales.find(x => x.id === b.dataset.id);
    await cambiarEstado({ final: f.id });
    return publicar({ tipo: "final", tono: "dia", icono: "fa-solid fa-flag-checkered", etiqueta: `Final ${f.id}`, titulo: f.nombre, texto: `<p>${esc(f.texto)}</p>`,
      sfx: "¡FIN!", fx: { texto: "¡FIN!", sonido: "descomunal", tono: "descomunal" } }, { soloGM: true, alias: "Dirección" });
  }

  static #filtro(ev, b) { this.filtro = b.dataset.clave; this.render(); }

  static async #pelea() {
    const a = [...this.sel.a], b = [...this.sel.b];
    const rivales = b.map(id => game.actors.get(id)).filter(Boolean);
    const rondasPara = this.sel.rondas || Math.max(1, ...rivales.map(r => r.system.rondas || 1));
    return iniciarPelea({ a, b, rondasPara, maxCruces: this.sel.cruces });
  }

  /** Un contendiente de los preparados (Pandilla, Mariko, Hidetoshi) contra todo el grupo. */
  static async #peleaRapida(ev, b) {
    const r = AV.rivales.find(x => x.clave === b.dataset.clave);
    const actor = game.actors.find(x => x.type === "pnj" && x.getFlag(ID, "rival") === r.clave);
    if (!actor) return ui.notifications.warn(`No encuentro a ${r.nombre} en el mundo: importa la aventura (Configuración → ¡Agua Va!).`);
    return iniciarPelea({ a: pjs().map(x => x.id), b: [actor.id], rondasPara: r.rondas });
  }
}
