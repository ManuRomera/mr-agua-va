/**
 * MR- ¡Agua Va! · punto de entrada. Aquí solo se registran piezas y hooks; la lógica vive en `module/`.
 */
import { ApplicationV2, DocumentSheetConfig, anadirHerramienta, diagnostico } from "./module/compat.mjs";
import { ID, registrarAjustes, escucharSocket, estado, cambiarEstado } from "./module/mesa.mjs";
import { MODELOS } from "./module/modelos.mjs";
import { HojaPJ, HojaPNJ } from "./module/hojas.mjs";
import { PanelDireccion, lanzarCortinilla, guiaHabla, activarEscena } from "./module/apps/direccion.mjs";
import { escucharChat, publicar } from "./module/chat.mjs";
import { registrarEfectos, chapuzonPantalla, onomatopeya } from "./module/efectos.mjs";
import { registrarCartela, restablecerCartela } from "./module/cartela.mjs";
import { dialogoTirada, tirar } from "./module/tirada.mjs";
import { registrarAccesibilidad } from "./module/accesibilidad.mjs";
import { pintarRetratos, repintarRetratos } from "./module/retrato.mjs";
import { PanelSeguridad, registrarSeguridad } from "./module/apps/seguridad.mjs";
import { PanelDiagnostico } from "./module/apps/diagnostico.mjs";
import { registrarLupa } from "./module/lupa.mjs";
import { registrarCoberturaDeFondo } from "./module/escenario.mjs";
import { registrarInicio, importarAventura } from "./module/inicio.mjs";
import { registrarDireccionMR, abrirConfigurador } from "./module/direccion-mr.mjs";
import { registrarPelea, iniciarPelea, terminarPelea, nuevoRound } from "./module/pelea.mjs";
import { chapuzon, hervir, cartel, aplicarForma } from "./module/forma.mjs";

Hooks.once("init", () => {
  Object.assign(CONFIG.Actor.dataModels, MODELOS);
  DocumentSheetConfig.registerSheet(Actor, ID, HojaPJ, { types: ["pj"], makeDefault: true, label: "¡Agua Va! · Personaje maldito" });
  DocumentSheetConfig.registerSheet(Actor, ID, HojaPNJ, { types: ["pnj"], makeDefault: true, label: "¡Agua Va! · Vecino o rival" });

  registrarAjustes();
  registrarEfectos();
  registrarAccesibilidad();
  registrarLupa();
  registrarCoberturaDeFondo();
  registrarSeguridad();
  registrarCartela();
  registrarPelea();
  registrarInicio();
  registrarDireccionMR();
  game.settings.registerMenu(ID, "diagnosticoMenu", {
    name: "Diagnóstico", label: "Comprobar el sistema",
    hint: "Comprueba el compendio, las imágenes y el estado de la partida, y deja un informe copiable.",
    icon: "fa-solid fa-stethoscope",
    type: class extends ApplicationV2 { async render() { PanelDiagnostico.abrir(); return this; } }, restricted: false
  });
  game.settings.registerMenu(ID, "cartelaMenu", {
    name: "Cartela del día", label: "Volver a su sitio",
    hint: "Devuelve la cartela flotante (hora, Desbarajuste, Vapor, Termo, tablillas) a la parte superior de la pantalla.",
    icon: "fa-solid fa-arrows-to-dot",
    type: class extends ApplicationV2 { async render() { restablecerCartela(); return this; } }, restricted: false
  });

  game.mrAguaVa = {
    abrirDireccion: () => PanelDireccion.abrir(), abrirConfigurador,
    abrirSeguridad: () => PanelSeguridad.abrir(),
    abrirDiagnostico: () => PanelDiagnostico.abrir(),
    tirar, dialogoTirada, chapuzon, hervir, cartel, aplicarForma, chapuzonPantalla, onomatopeya, lanzarCortinilla, guiaHabla, activarEscena, importarAventura,
    iniciarPelea, terminarPelea, nuevoRound, estado, cambiarEstado, publicar, diagnostico
  };
});

Hooks.once("ready", () => {
  escucharSocket();
  escucharChat();
  PanelSeguridad.iniciar();
  document.body.classList.toggle("av-es-gm", game.user.isGM);
  console.info(`MR- ¡Agua Va! ${game.system.version} · Foundry ${game.version}`);
});

Hooks.on("updateActor", (actor, cambios) => {
  const f = cambios.flags?.[ID];
  if ("img" in cambios || (f && ("retrato" in f || "-=retrato" in f))) repintarRetratos();
});
Hooks.on("aguava.estado", () => foundry.applications.instances.get("av-direccion")?.render());

/** Los diarios de la aventura se visten de revista. */
Hooks.on("renderJournalEntrySheet", (app) => {
  if (app.document.getFlag(ID, "clave") || app.document.pack?.startsWith(`${ID}.`)) {
    app.element.classList.add("mr-agua-va", "av-diario", "themed", "theme-light");
    app.element.classList.remove("theme-dark");
  }
});
/** Papel de revista: las ventanas del sistema usan siempre el tema claro de Foundry por dentro. */
Hooks.on("renderApplicationV2", app => {
  if (!app.element?.classList.contains("mr-agua-va")) return;
  app.element.classList.add("themed", "theme-light");
  app.element.classList.remove("theme-dark");
});

Hooks.on("renderActorDirectory", (app, html) => {
  const raiz = html instanceof HTMLElement ? html : html[0];
  pintarRetratos(raiz);
  const acciones = raiz?.querySelector(".header-actions");
  if (!game.user.isGM || !acciones || acciones.querySelector(".av-boton-panel")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "av-boton-panel";
  b.innerHTML = `<i class="fa-solid fa-clapperboard" inert></i><span>Panel de dirección</span>`;
  b.addEventListener("click", () => PanelDireccion.abrir());
  acciones.append(b);
});

/** Actores de los tokens seleccionados (o el personaje del jugador). */
const objetivos = () => {
  const sel = canvas?.tokens?.controlled?.map(t => t.actor).filter(Boolean) ?? [];
  return sel.length ? sel : (game.user.character ? [game.user.character] : []);
};

Hooks.on("getSceneControlButtons", controles => {
  anadirHerramienta(controles, "tokens", { name: "avSeguridad", title: "Seguridad en mesa", icon: "fa-solid fa-shield-heart", onChange: () => PanelSeguridad.abrir() });
  if (!game.user.isGM) return;
  anadirHerramienta(controles, "tokens", { name: "avDireccion", title: "Panel de dirección", icon: "fa-solid fa-clapperboard", onChange: () => PanelDireccion.abrir() });
  anadirHerramienta(controles, "tokens", { name: "avEscenas", title: "Configurador de escenas (MR- Dirección)", icon: "fa-solid fa-sliders", onChange: () => abrirConfigurador() });
  anadirHerramienta(controles, "tokens", { name: "avChapuzon", title: "¡CHAPUZÓN! a los tokens seleccionados (agua fría)", icon: "fa-solid fa-droplet", onChange: async () => { for (const a of objetivos()) if (a.type === "pj") await chapuzon(a); } });
  anadirHerramienta(controles, "tokens", { name: "avHervir", title: "Agua caliente a los tokens seleccionados", icon: "fa-solid fa-mug-hot", onChange: async () => { for (const a of objetivos()) if (a.type === "pj") await hervir(a); } });
});
