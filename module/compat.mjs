/**
 * Enrutamiento de compatibilidad Foundry VTT 13 ↔ 14.
 * Todo acceso a API que haya cambiado de nombre o de sitio pasa por aquí;
 * el resto del sistema no pregunta nunca por la versión.
 *
 * | Necesidad            | v13                                 | v14                               |
 * |----------------------|-------------------------------------|-----------------------------------|
 * | Visibilidad del chat | core.rollMode + applyRollMode       | core.messageMode + applyMode      |
 * | Nombres de modo      | publicroll/gmroll/blindroll/selfroll| public/gm/blind/self              |
 * | Hook de chat         | renderChatMessageHTML (HTMLElement) | igual                             |
 * | Hojas y diálogos     | foundry.applications.api (V2)       | igual; V1 en retirada             |
 */
const f = globalThis.foundry;

export const ApplicationV2 = f.applications.api.ApplicationV2;
export const HandlebarsApplicationMixin = f.applications.api.HandlebarsApplicationMixin;
export const DialogV2 = f.applications.api.DialogV2;
export const ActorSheetV2 = f.applications.sheets.ActorSheetV2;
export const DocumentSheetConfig = f.applications.apps.DocumentSheetConfig;
/** Se resuelve al usarse: un módulo puede sustituir la implementación en CONFIG.ux después de cargar. */
const textEditor = () => f.applications.ux.TextEditor.implementation;
export const renderTemplate = f.applications.handlebars.renderTemplate;
export const loadTemplates = f.applications.handlebars.loadTemplates;

if (![ApplicationV2, HandlebarsApplicationMixin, DialogV2, ActorSheetV2, DocumentSheetConfig].every(c => typeof c === "function")) {
  throw new Error("MR- ¡Agua Va! necesita las APIs V2 de Foundry 13 o posterior.");
}

/** Generación leída en el momento: `game.release` no existe mientras se evalúa el módulo. */
export function generacion() {
  return Number(game.release?.generation) || Number(String(game.version).split(".")[0]) || 13;
}

const MODOS_V13 = { public: "publicroll", gm: "gmroll", blind: "blindroll", self: "selfroll" };
const MODOS_V14 = Object.fromEntries(Object.entries(MODOS_V13).map(([v14, v13]) => [v13, v14]));

/** Modo de visibilidad que el usuario tiene elegido en el chat, en el vocabulario de su versión. */
export function modoActual() {
  const clave = game.settings.settings.has("core.messageMode") ? "messageMode" : "rollMode";
  return game.settings.get("core", clave);
}

/** Aplica un modo de visibilidad a los datos de un mensaje, traduciendo el nombre si hace falta. */
export function aplicarModo(datos, modo = modoActual()) {
  if (typeof ChatMessage.applyMode === "function") return ChatMessage.applyMode(datos, MODOS_V14[modo] ?? modo);
  return ChatMessage.applyRollMode(datos, MODOS_V13[modo] ?? modo);
}

/** Chat: ambos entregan HTMLElement; se acepta un envoltorio jQuery por si un módulo lo reinyecta. */
export function alRenderizarMensaje(fn) {
  Hooks.on("renderChatMessageHTML", (mensaje, html) => {
    const el = html instanceof HTMLElement ? html : html?.[0];
    if (el) fn(mensaje, el);
  });
}

/**
 * Herramientas en los controles de escena. v13 y v14 usan un registro de objetos y
 * `onChange(event, active)`; `onClick` está obsoleto y dispararía dos veces.
 */
export function anadirHerramienta(controles, grupo, herramienta) {
  const destino = controles[grupo];
  if (!destino?.tools || destino.tools[herramienta.name]) return;
  destino.tools[herramienta.name] = {
    ...herramienta,
    button: true,
    order: Object.keys(destino.tools).length,
    onChange: (event, activo) => { if (activo !== false) herramienta.onChange(event); }
  };
}

export const enriquecer = (html, relativo) =>
  textEditor().enrichHTML(html ?? "", { relativeTo: relativo, secrets: relativo?.isOwner ?? false });

export function diagnostico() {
  return {
    sistema: game.system.version,
    foundry: game.version,
    generacion: generacion(),
    modoMensaje: typeof ChatMessage.applyMode === "function" ? "applyMode" : "applyRollMode"
  };
}
