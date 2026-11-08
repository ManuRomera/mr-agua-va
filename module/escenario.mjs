/**
 * Las escenas de la aventura son decorados de viñeta: cubren toda la pantalla. Foundry ajusta la escena
 * para que quepa entera y deja bandas si la pantalla no es 16:9; aquí se amplía lo justo para taparlas.
 */
import { ID } from "./mesa.mjs";

export function registrarCoberturaDeFondo() {
  const cubrir = lienzo => {
    if (!lienzo?.scene?.getFlag(ID, "escena")) return;
    const r = lienzo.dimensions.sceneRect;
    const p = lienzo.app.screen;
    lienzo.pan({ x: r.x + r.width / 2, y: r.y + r.height / 2, scale: Math.max(p.width / r.width, p.height / r.height) });
  };
  Hooks.on("canvasReady", lienzo => setTimeout(() => cubrir(lienzo), 50));
  window.addEventListener("resize", () => { if (globalThis.canvas?.ready) cubrir(globalThis.canvas); });
}
