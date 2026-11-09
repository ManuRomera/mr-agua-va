/**
 * MR- Dirección (módulo hermano): el configurador de escenas. Aquí se registra el paquete de ¡Agua Va! (reparto por escena, puntos de apoyo del suelo,
 * efectos de sonido) y se ofrecen atajos desde el Panel de dirección: abrir el editor de la escena, colocar el reparto y ajustar el tamaño de las figuras.
 * Si el módulo no está activo, se explica cómo instalarlo; el sistema sigue funcionando igual.
 */
import { ID } from "./mesa.mjs";
import { DialogV2 } from "./compat.mjs";

export const MOD = "mr-direccion";
export const MANIFIESTO = "https://github.com/ManuRomera/mr-direccion/releases/latest/download/module.json";
export const api = () => { const m = game.modules.get(MOD); return m?.active ? m.api ?? null : null; };

let registrado = false;
async function registrar(a, forzar = false) {
  if (!a?.registerPack || (registrado && !forzar)) return false;
  try {
    const pack = await (await fetch(`systems/${ID}/content/direccion-es.json`)).json();
    a.registerPack(pack);
    registrado = true;
    return true;
  } catch (e) { console.error(`${ID} | no se pudo registrar el paquete de MR- Dirección`, e); return false; }
}

/** Escenas de la aventura con su estado de configuración, para la pestaña «Escenas» del panel. */
export function escenasDeLaAventura() {
  const a = api();
  return game.scenes.filter(s => s.getFlag(ID, "escena")).sort((x, y) => x.sort - y.sort).map(s => ({
    id: s.id, nombre: s.name, thumb: s.thumb || s.background?.src, activa: s.active, vista: canvas?.scene?.id === s.id,
    reparto: a?.sceneConfig?.(s)?.figures?.length ?? 0
  }));
}

export async function avisoSinModulo() {
  return DialogV2.prompt({
    window: { title: "Falta MR- Dirección", icon: "fa-solid fa-clapperboard" }, classes: ["mr-agua-va", "av-dialogo"],
    content: `<div class="av-dialogo-cuerpo"><p>El <b>configurador de escenas</b> (tamaño y posición de las figuras, perspectiva del suelo, reparto por escena) es de <b>MR- Dirección</b>, un módulo hermano que funciona con cualquier sistema.</p>
      <p>Instálalo en <i>Módulos de complemento → Instalar módulo</i> con este manifiesto y actívalo en tu mundo; ¡Agua Va! le entrega solo el reparto y los puntos de apoyo de sus 17 escenas:</p>
      <label class="av-campo"><span>Manifiesto</span><input type="text" readonly value="${MANIFIESTO}" onfocus="this.select()"></label></div>`,
    ok: { label: "Entendido", icon: "fa-solid fa-check", callback: () => true }, rejectClose: false
  });
}

/** Abre el editor de MR- Dirección en la escena indicada (o la que se está viendo). */
export async function abrirConfigurador(sceneId = canvas?.scene?.id) {
  const a = api();
  if (!a) return avisoSinModulo();
  return a.openEditor(sceneId);
}

/** Acciones de la barra de MR- Dirección: «figures» (colocar el reparto), «resize» (tamaño de las figuras), «fit»… */
export async function accionDireccion(accion, arg) {
  const a = api();
  if (!a) return avisoSinModulo();
  return a.dispatch(accion, arg);
}

export function registrarDireccionMR() {
  Hooks.on("mrDireccion.ready", a => registrar(a));
  Hooks.once("ready", async () => {
    if (!game.user.isGM) return;
    await registrar(api());
    if (!api() && !game.settings.get(ID, "avisoDireccion")) {
      await game.settings.set(ID, "avisoDireccion", true);
      ui.notifications.info("Para configurar el tamaño y la posición de las figuras en las escenas, instala el módulo MR- Dirección (Panel de dirección → Escenas).");
    }
  });
}
