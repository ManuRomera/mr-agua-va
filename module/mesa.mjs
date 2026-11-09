/**
 * Estado compartido de la partida (ajuste de mundo): Desbarajuste, Vapor, Termo, tablillas, reloj real,
 * retos lanzados, cortinillas y la ¡PELEA!. Solo un GM escribe ajustes de mundo; el resto lo pide por socket.
 * El socket también reparte los efectos de pantalla (¡CHAPUZÓN!, ¡PELEA!) a toda la mesa.
 */
import { olvidarTodo } from "./memoria.mjs";
import { ApplicationV2 } from "./compat.mjs";
import { acota, CUENTA_ATRAS } from "./reglas.mjs";

export const ID = "mr-agua-va";
export const SOCKET = `system.${ID}`;
export const RUTA = `systems/${ID}`;
export const ARTE = `${RUTA}/assets`;

export const ESTADO_INICIAL = {
  desbarajuste: 0,
  vapor: 0,
  termo: 3,           // cargas del Termo Portátil
  tablillas: [],      // tablillas conseguidas (1, 2, 3)
  reloj: { inicio: null, acumulado: 0 },
  retos: {},          // R01: "activo" | "resuelto"
  cortinillas: [],    // ids ya lanzadas
  final: "",
  cuentaAtras: null,  // Vapor 6: {restantes} Cruces de combate para vencer al jefe o cerrar una válvula; si no, Final C
  pelea: null         // ¡PELEA! en curso (solo la escribe quien dirige; ver pelea.mjs)
};

class RestablecerVentanas extends ApplicationV2 {
  async render() {
    olvidarTodo();
    ui.notifications.info("Posiciones, tamaños y pestañas olvidadas en este navegador.");
    return this;
  }
}

export function registrarAjustes() {
  game.settings.register(ID, "estado", {
    scope: "world", config: false, type: Object, default: ESTADO_INICIAL,
    onChange: () => Hooks.callAll("aguava.estado", estado())
  });
  game.settings.register(ID, "bienvenida", { scope: "world", config: false, type: String, default: "" });
  game.settings.register(ID, "avisoDireccion", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register(ID, "importada", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register(ID, "efectos", {
    name: "Efectos de pantalla",
    hint: "El ¡CHAPUZÓN! y las onomatopeyas de las tiradas y de la ¡PELEA! cruzan la pantalla. Ajuste de este navegador.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "marcadorPos", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(ID, "marcadorVisible", {
    name: "Mostrar la cartela del episodio",
    hint: "La cartela flotante con la hora del día, el Desbarajuste, el Vapor, el Termo y las tablillas. Se arrastra con el botón derecho.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => Hooks.callAll("aguava.estado", estado())
  });
  game.settings.registerMenu(ID, "ventanas", {
    name: "Memoria de ventanas", label: "Olvidar posiciones",
    hint: "Las ventanas del sistema recuerdan posición, tamaño, pestaña y secciones plegadas en este navegador.",
    icon: "fa-solid fa-window-restore", type: RestablecerVentanas, restricted: false
  });
}

export const estado = () => foundry.utils.mergeObject(foundry.utils.deepClone(ESTADO_INICIAL), game.settings.get(ID, "estado") ?? {}, { inplace: false });

/** Cambios validados: solo claves conocidas y valores dentro de rango. */
function sanear(cambios = {}) {
  const v = {};
  if ("desbarajuste" in cambios) v.desbarajuste = acota(cambios.desbarajuste, 0, 6);
  if ("vapor" in cambios) v.vapor = acota(cambios.vapor, 0, 6);
  if ("termo" in cambios) v.termo = acota(cambios.termo, 0, 3);
  if (Array.isArray(cambios.tablillas)) v.tablillas = [...new Set(cambios.tablillas.map(Number).filter(n => [1, 2, 3].includes(n)))].sort();
  if ("cuentaAtras" in cambios) v.cuentaAtras = cambios.cuentaAtras ? { restantes: acota(cambios.cuentaAtras.restantes, 0, CUENTA_ATRAS) } : null;
  if ("pelea" in cambios) v.pelea = cambios.pelea && typeof cambios.pelea === "object" ? cambios.pelea : null;
  if (cambios.reloj && typeof cambios.reloj === "object") v.reloj = { inicio: Number(cambios.reloj.inicio) || null, acumulado: Math.max(0, Number(cambios.reloj.acumulado) || 0) };
  if (cambios.retos && typeof cambios.retos === "object") v.retos = Object.fromEntries(Object.entries(cambios.retos).filter(([k, e]) => /^R\d\d$/.test(k) && ["activo", "resuelto"].includes(e)));
  if (Array.isArray(cambios.cortinillas)) v.cortinillas = cambios.cortinillas.filter(c => typeof c === "string").slice(0, 8);
  if (typeof cambios.final === "string") v.final = cambios.final.slice(0, 2);
  return v;
}

/** Cambia el estado. Los objetos (reloj, retos) se sustituyen enteros. */
export async function cambiarEstado(cambios) {
  const validos = sanear(cambios);
  if (game.user.isGM) {
    // Vapor 6 enciende la cuenta atrás (¡tiembla el edificio!); bajar de 6 la apaga.
    const antes = estado();
    if ("vapor" in validos) {
      if (validos.vapor >= 6 && antes.vapor < 6 && !antes.cuentaAtras && !("cuentaAtras" in validos)) {
        validos.cuentaAtras = { restantes: CUENTA_ATRAS };
        difundir("banners", { lista: [{ t: "¡TIEMBLA EL EDIFICIO!", ms: 2200, sonido: "alarma", tono: "ko" }] });
      } else if (validos.vapor < 6 && antes.cuentaAtras && !("cuentaAtras" in validos)) validos.cuentaAtras = null;
    }
    return game.settings.set(ID, "estado", { ...antes, ...validos });
  }
  if (!game.users.activeGM) return ui.notifications.warn("Hace falta que quien dirige esté conectado.");
  game.socket.emit(SOCKET, { op: "estado", datos: validos });
}

const RECEPTORES = {};
/** Registra qué hacer con un mensaje de socket de tipo `op`. */
export const alRecibir = (op, fn) => { RECEPTORES[op] = fn; };
/** Envía a los demás y lo ejecuta también aquí. */
export function difundir(op, datos) {
  game.socket.emit(SOCKET, { op, datos });
  RECEPTORES[op]?.(datos, game.user);
}

export function escucharSocket() {
  game.socket.on(SOCKET, ({ op, datos } = {}, de) => {
    const quien = game.users.get(de) ?? null;
    if (op === "estado") {
      // Quien no dirige solo puede tocar el Termo y las tablillas; la ¡PELEA! la lleva el GM.
      const cambios = quien?.isGM ? datos : { termo: datos?.termo, tablillas: datos?.tablillas };
      if (game.users.activeGM?.isSelf) game.settings.set(ID, "estado", { ...estado(), ...sanear(Object.fromEntries(Object.entries(cambios ?? {}).filter(([, v]) => v !== undefined))) });
      return;
    }
    RECEPTORES[op]?.(datos, quien);
  });
}

export const pjs = () => game.actors.filter(a => a.type === "pj");
