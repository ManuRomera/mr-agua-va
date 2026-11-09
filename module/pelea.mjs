/**
 * ¡PELEA! · combate de barrio estilo máquina recreativa de lucha (1 contra 1 o por equipos, «tag»).
 *  - El estado vive en `estado().pelea` (ajuste de mundo): solo quien dirige lo escribe y todos lo pintan arriba de la pantalla.
 *  - Las posturas se eligen en secreto: cada cliente las manda por socket al GM activo, que las guarda en memoria hasta resolver.
 *  - La resolución (triángulo Golpe > Presa > Parada, tirada de ¡PAM!, Dignidad, Furia, K.O.) es de quien dirige.
 *  - Los mandos de los bandos de PNJ solo los ve y maneja quien dirige; un jugador solo ve el mando de sus propios luchadores.
 *  - El Jefe Final (Hidetoshi) pelea un único round con una barra de 16 en dos fases, salpicadura, aislamiento y un ataque de área con QTE.
 */
import { ID, estado, cambiarEstado, alRecibir, difundir, SOCKET } from "./mesa.mjs";
import { DialogV2 } from "./compat.mjs";
import { publicar } from "./chat.mjs";
import { sonar } from "./efectos.mjs";
import { POSTURAS, MAX_FURIA, CRUCES_POR_RONDA, CURA_SERENIDAD, dominante, danoDe, barra, tiempo, caido } from "./reglas.mjs";
import { lanzarPam } from "./tirada.mjs";
import { formaDe, tokenForma, caraForma, chapuzon, hervir } from "./forma.mjs";

const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const ELECCIONES = ["golpe", "presa", "parada", "hervir", "serenidad", "evasion", "tecnica"];
const PASIVAS = ["hervir", "serenidad"];                  // cuentan como Parada, sin contraataque
const CUESTAN_FURIA = ["tecnica", "evasion", "serenidad"]; // gastan los 3 puntos
const QTE_MS = 4000;
const otro = i => 1 - i;
const activoDe = lado => lado.equipo[lado.activo];
const nombreBando = lado => lado.equipo.map(f => f.nombre).join(" y ");
const azar = lista => lista[Math.floor(Math.random() * lista.length)];

/** Elecciones secretas de cada lado (solo en la memoria del GM activo). */
const PICKS = [null, null];

/* ───────────────────────── Montaje ───────────────────────── */

export function luchador(actor) {
  const s = actor.system, pj = actor.type === "pj";
  const max = Math.max(1, s.dignidad || (pj ? 8 : 6)), barras = pj ? 1 : Math.max(1, s.barras || 1);
  return { id: actor.id, nombre: actor.name, apodo: s.apodo ?? "", tipo: actor.type, max, barras, dig: max * barras, jefe: pj ? "" : (s.jefe ?? ""), fase: 1,
    forma: pj ? formaDe(actor) : "seco", cara: caraForma(actor), entrada: false, provoco: false, rojo: false, barraPrev: 1, rondas: s.rondas ?? 1 };
}

const ladoNuevo = ids => ({ rondas: 0, activo: 0, furia: 0, listo: false, sinParada: false, relevoPrevio: false, danoRonda: 0,
  equipo: ids.map(id => game.actors.get(id)).filter(Boolean).map(luchador) });

/** Empieza una ¡PELEA! (solo GM). a y b son listas de ids de actor. */
export async function iniciarPelea({ a = [], b = [], rondasPara = 1, maxCruces = CRUCES_POR_RONDA } = {}) {
  if (!game.user.isGM) return;
  const lados = [ladoNuevo(a), ladoNuevo(b)];
  if (!lados[0].equipo.length || !lados[1].equipo.length) return ui.notifications.warn("Cada bando necesita al menos un luchador.");
  PICKS[0] = PICKS[1] = null;
  // Un Jefe Final no tiene cronómetro: la pelea acaba por K.O. (o por la cuenta atrás del Vapor), nunca por ¡TIEMPO!
  const sinLimite = lados.some(l => l.equipo.some(f => f.jefe));
  await cambiarEstado({ pelea: { fase: "eleccion", ronda: 1, rondasPara: Math.max(1, Math.min(3, rondasPara)), cruce: 1, maxCruces: sinLimite ? 0 : maxCruces, lados, ganador: null, peticiones: {}, relevos: {}, ayudas: {} } });
  banners([{ t: "RONDA 1", ms: 1500, sonido: "ronda" }, { t: "¡PELEA!", ms: 1100, sonido: "pelea", tono: "fuego" }]);
}

export async function terminarPelea() {
  if (!game.user.isGM) return;
  PICKS[0] = PICKS[1] = null;
  await cambiarEstado({ pelea: null });
}

/* ───────────────────────── Peticiones de los jugadores ───────────────────────── */

const soyGMActivo = () => game.users.activeGM?.isSelf;
/** ¿Puede este usuario decidir por este actor? Su dueño (si es un PJ) o quien dirige. Los PNJ solo los maneja el GM. */
function puedeActuar(quien, actorId) {
  if (quien?.isGM) return true;
  const a = actorId ? game.actors.get(actorId) : null;
  return Boolean(a && a.type === "pj" && a.testUserPermission(quien, "OWNER"));
}
function enviar(op, datos) {
  if (game.user.isGM) return RECEPTORES[op]?.(datos, game.user);
  game.socket.emit(SOCKET, { op, datos });
}
const peleaEnEleccion = d => { const p = estado().pelea; return p && !RESOLVIENDO && p.fase === "eleccion" && [0, 1].includes(d?.lado) ? p : null; };
const vivoEnBanquillo = (lado, id) => lado.equipo.some((f, i) => f.id === id && i !== lado.activo && f.dig > 0);

const RECEPTORES = {
  async pick(d, quien) {
    if (!soyGMActivo()) return;
    const p = peleaEnEleccion(d); if (!p) return;
    const lado = p.lados[d.lado], f = activoDe(lado);
    if (!puedeActuar(quien, f?.id)) return;
    const eleccion = ELECCIONES.includes(d.eleccion) ? d.eleccion : null;
    if (!eleccion) return;
    if (CUESTAN_FURIA.includes(eleccion) && lado.furia < MAX_FURIA) return ui.notifications.warn("Faltan los 3 puntos de Furia.");
    if (eleccion === "parada" && lado.sinParada) return;
    if (eleccion === "hervir" && f.forma !== "mojado") return;
    const prev = PICKS[d.lado];
    PICKS[d.lado] = { eleccion, talento: Boolean(d.talento), entorno: Boolean(d.entorno), asistentes: prev?.asistentes ?? [], relevo: prev?.relevo ?? null,
      golpe: String(d.golpe ?? "").slice(0, 50), fuente: d.fuente === "escena" ? "escena" : "termo" };
    await marcarListo(d.lado, true);
    if (PICKS[0]?.eleccion && PICKS[1]?.eleccion) return resolver();
  },
  async asistir(d, quien) {
    if (!soyGMActivo()) return;
    const p = peleaEnEleccion(d); if (!p) return;
    if (!puedeActuar(quien, d.actor) || !vivoEnBanquillo(p.lados[d.lado], d.actor)) return;
    const prev = PICKS[d.lado] ?? { eleccion: null, asistentes: [], relevo: null };
    const set = new Set(prev.asistentes); d.on ? set.add(d.actor) : set.delete(d.actor);
    PICKS[d.lado] = { ...prev, asistentes: [...set] };
    await cambiarEstado({ pelea: { ...p, ayudas: { ...(p.ayudas ?? {}), [d.lado]: [...set] } } });
  },
  /** Un compañero del banquillo pide (o anula) el relevo. */
  async pedirRelevo(d, quien) {
    if (!soyGMActivo()) return;
    const p = peleaEnEleccion(d); if (!p) return;
    const lado = p.lados[d.lado];
    if (!puedeActuar(quien, d.actor) || !vivoEnBanquillo(lado, d.actor)) return;
    if (lado.relevoPrevio) return ui.notifications.warn("No se puede relevar dos Cruces seguidos.");
    const lista = new Set(p.peticiones?.[d.lado] ?? []); lista.has(d.actor) ? lista.delete(d.actor) : lista.add(d.actor);
    const prev = PICKS[d.lado] ?? { eleccion: null, asistentes: [], relevo: null };
    let relevos = p.relevos ?? {};
    if (!lista.has(d.actor) && prev.relevo === d.actor) { PICKS[d.lado] = { ...prev, relevo: null }; relevos = { ...relevos, [d.lado]: null }; }
    await cambiarEstado({ pelea: { ...p, peticiones: { ...(p.peticiones ?? {}), [d.lado]: [...lista] }, relevos } });
  },
  /** El luchador activo (o quien dirige) elige a quién da entrada al final del Cruce. */
  async darRelevo(d, quien) {
    if (!soyGMActivo()) return;
    const p = peleaEnEleccion(d); if (!p) return;
    const lado = p.lados[d.lado];
    if (!puedeActuar(quien, activoDe(lado)?.id) || !vivoEnBanquillo(lado, d.actor)) return;
    if (!quien.isGM && !(p.peticiones?.[d.lado] ?? []).includes(d.actor)) return ui.notifications.warn("Esa persona no ha pedido el relevo.");
    if (lado.relevoPrevio) return ui.notifications.warn("No se puede relevar dos Cruces seguidos.");
    const prev = PICKS[d.lado] ?? { eleccion: null, asistentes: [], relevo: null };
    PICKS[d.lado] = { ...prev, relevo: prev.relevo === d.actor ? null : d.actor };
    await cambiarEstado({ pelea: { ...p, relevos: { ...(p.relevos ?? {}), [d.lado]: PICKS[d.lado].relevo } } });
  },
  async provocar(d, quien) {
    if (!soyGMActivo()) return;
    const p = peleaEnEleccion(d); if (!p) return;
    const lado = p.lados[d.lado], f = activoDe(lado);
    if (!puedeActuar(quien, f?.id) || f.provoco) return;
    const texto = String(d.texto ?? "").trim().slice(0, 140);
    if (!texto) return;
    const humana = (quien && !quien.isGM) || f.tipo === "pj";
    const gracia = humana ? await DialogV2.confirm({
      window: { title: "¿Ha tenido gracia?", icon: "fa-solid fa-face-grin-tears" }, classes: ["mr-agua-va", "av-dialogo"],
      content: `<p><b>${esc(f.nombre)}</b> provoca: «${esc(texto)}»</p><p class="av-nota">Si hace gracia a la mesa, ${esc(activoDe(p.lados[otro(d.lado)]).nombre)} pierde los papeles: este Cruce no puede elegir Parada.</p>`,
      yes: { label: "¡Ha tenido gracia!", icon: "fa-solid fa-face-laugh-squint" }, no: { label: "Ni caso", icon: "fa-solid fa-face-meh" }, rejectClose: false
    }) : true;
    const nuevo = foundry.utils.deepClone(estado().pelea);
    nuevo.lados[d.lado].equipo[lado.activo].provoco = true;
    if (gracia) {
      nuevo.lados[otro(d.lado)].sinParada = true;
      if (PICKS[otro(d.lado)]?.eleccion === "parada") { PICKS[otro(d.lado)].eleccion = null; nuevo.lados[otro(d.lado)].listo = false; }
    }
    await cambiarEstado({ pelea: nuevo });
    await publicar({ tipo: "provocacion", tono: gracia ? "brillante" : "fiasco", icono: "fa-solid fa-face-grin-tongue-squint", etiqueta: "Provocación", sfx: gracia ? "¡JA!" : "…",
      arte: tokenForma(game.actors.get(f.id)), arteClase: "figura mini", titulo: f.nombre, globo: esc(texto),
      pie: gracia ? `${esc(activoDe(p.lados[otro(d.lado)]).nombre)} pierde los papeles: <b>no puede elegir Parada</b> este Cruce.` : "Ni caso: el rival ni se inmuta.",
      fx: { texto: gracia ? "¡PROVOCACIÓN!" : "", sonido: gracia ? "brillante" : "fiasco", tono: "fuego" } }, { actor: game.actors.get(f.id) });
  },
  /** Respuesta al QTE de esquiva de área. */
  qteResp(d, quien) {
    if (!soyGMActivo() || !QTE || !QTE.ids.has(d?.actor)) return;
    if (!quien?.isGM && !puedeActuar(quien, d.actor)) return;
    QTE.ok.add(d.actor);
    if (QTE.ok.size >= QTE.ids.size) QTE.fin();
  }
};

async function marcarListo(i, listo) {
  const p = foundry.utils.deepClone(estado().pelea); p.lados[i].listo = listo;
  await cambiarEstado({ pelea: p });
}

/** Acciones del usuario (las llaman los botones del mando). */
export const accionesMando = {
  pick: d => enviar("pick", d), asistir: d => enviar("asistir", d), pedirRelevo: d => enviar("pedirRelevo", d), darRelevo: d => enviar("darRelevo", d),
  provocar: d => enviar("provocar", d), qteResp: d => enviar("qteResp", d),
  async alAzar(lado) {
    if (!game.user.isGM) return;
    const p = estado().pelea, l = p.lados[lado];
    const opciones = ["golpe", "presa", ...(l.sinParada ? [] : ["parada"]), ...(l.furia >= MAX_FURIA ? ["tecnica"] : [])];
    return RECEPTORES.pick({ lado, eleccion: azar(opciones), golpe: "", talento: Math.random() < 0.5, entorno: false }, game.user);
  },
  async forzar() { if (game.user.isGM) return resolver(); }
};

/* ───────────────────────── QTE: esquiva de área ───────────────────────── */

let QTE = null;
/** Pide a los del banquillo que se protejan y espera unos segundos. Devuelve el conjunto de quienes reaccionaron a tiempo. */
function esperarQTE(ids, nombre) {
  return new Promise(res => {
    const fin = () => { clearTimeout(t); const ok = QTE?.ok ?? new Set(); QTE = null; res(ok); };
    const t = setTimeout(fin, QTE_MS + 600);
    QTE = { ids: new Set(ids), ok: new Set(), fin };
    difundir("qte", { ids, nombre, ms: QTE_MS });
  });
}

let qteEl = null;
const quienControla = id => {   // ¿este cliente maneja a este luchador del banquillo? (el GM, si su dueño no está conectado)
  const a = game.actors.get(id); if (!a) return false;
  if (game.user.isGM) return !game.users.some(u => u.active && !u.isGM && a.testUserPermission(u, "OWNER"));
  return a.type === "pj" && a.testUserPermission(game.user, "OWNER");
};
function mostrarQTE({ ids = [], nombre = "", ms = QTE_MS } = {}) {
  qteEl?.remove(); qteEl = null;
  const mios = ids.filter(quienControla);
  sonar("alarma");
  if (!mios.length) return;
  const el = document.createElement("aside");
  el.id = "av-qte"; el.className = `mr-agua-va av-qte${document.body.classList.contains("av-sin-movimiento") ? " quieto" : ""}`;
  el.setAttribute("role", "alert");
  el.innerHTML = `<p class="av-qte-aviso">¡${esc(nombre)} lanza una ola contra el banquillo!</p>
    <div class="av-qte-botones">${mios.map(id => `<button type="button" class="av-qte-boton" data-actor="${id}"><i class="fa-solid fa-person-running" inert></i> ¡ESQUIVAR!<small>${esc(game.actors.get(id)?.name)}</small></button>`).join("")}</div>
    <div class="av-qte-tiempo"><i style="animation-duration:${ms}ms"></i></div>`;
  el.addEventListener("click", ev => {
    const b = ev.target.closest(".av-qte-boton"); if (!b || b.disabled) return;
    b.disabled = true; b.classList.add("salvo"); b.innerHTML = `<i class="fa-solid fa-shield-heart" inert></i> ¡A SALVO!<small>${esc(game.actors.get(b.dataset.actor)?.name)}</small>`;
    sonar("brillante"); accionesMando.qteResp({ actor: b.dataset.actor });
  });
  document.body.append(el); qteEl = el;
  setTimeout(() => { if (qteEl === el) { el.remove(); qteEl = null; } }, ms + 500);
}

/* ───────────────────────── Resolución del Cruce (GM) ───────────────────────── */

async function tirarLado(p, i, pick) {
  const lado = p.lados[i], f = activoDe(lado), actor = game.actors.get(f.id);
  const ayudas = (pick.asistentes ?? []).filter(id => lado.equipo.some((x, k) => x.id === id && k !== lado.activo && x.dig > 0)).length;
  const canon = f.jefe === "hidetoshi" && f.fase === 1 ? 1 : 0;   // el cañón de agua da +1d6 en la fase 1
  const r = await lanzarPam({ talento: pick.talento, ayudas, extra: (pick.entorno ? 1 : 0) + (pick.eleccion === "tecnica" ? 1 : 0) + (f.entrada ? 1 : 0) + canon });
  return { ...r, actor, ayudas };
}

/** Copia a la ¡PELEA! la forma y la cara actuales de cada PJ (tras un ¡CHAPUZÓN! o agua caliente). */
async function sincronizarFormas() {
  const p = estado().pelea; if (!p) return;
  const q = foundry.utils.deepClone(p); let cambio = false;
  for (const l of q.lados) for (const f of l.equipo) {
    if (f.tipo !== "pj") continue;
    const a = game.actors.get(f.id); if (!a) continue;
    const forma = formaDe(a), cara = caraForma(a, forma);
    if (f.forma !== forma || f.cara !== cara) { f.forma = forma; f.cara = cara; cambio = true; }
  }
  if (cambio) await cambiarEstado({ pelea: q });
}

let RESOLVIENDO = false;
/** Resuelve el Cruce una sola vez aunque lleguen peticiones mientras se espera el QTE. */
async function resolver() {
  if (RESOLVIENDO) return;
  RESOLVIENDO = true;
  try { await resolverCruce(); } finally { RESOLVIENDO = false; }
}

async function resolverCruce() {
  const p0 = estado().pelea;
  if (!p0 || p0.fase !== "eleccion") return;
  const p = foundry.utils.deepClone(p0);
  // Quien no ha elegido (o la máquina quiere acabar): al azar
  for (const i of [0, 1]) if (!PICKS[i]?.eleccion) {
    const l = p.lados[i], base = ["golpe", "presa", ...(l.sinParada ? [] : ["parada"])];
    PICKS[i] = { ...(PICKS[i] ?? { asistentes: [], relevo: null }), eleccion: azar(base), talento: false, entorno: false, golpe: "", fuente: "escena" };
  }
  const [pa, pb] = PICKS;
  const golpes = [pa.golpe, pb.golpe];
  const dom = dominante(pa.eleccion, pb.eleccion);
  const F = [activoDe(p.lados[0]), activoDe(p.lados[1])];
  const lineas = [], extra = [], mojar = [];
  const nombres = [F[0].nombre, F[1].nombre];
  const NOMBRE_ELECCION = { tecnica: "Técnica Secreta", hervir: "Hervir (cuenta como Parada)", serenidad: "Recobrar la compostura (cuenta como Parada)", evasion: "Evasión Ridícula Absoluta" };
  const dichos = [pa, pb].map(k => NOMBRE_ELECCION[k.eleccion] ?? POSTURAS[k.eleccion].nombre);
  lineas.push({ clave: "Posturas", valor: `${esc(nombres[0])}: <b>${dichos[0]}</b> · ${esc(nombres[1])}: <b>${dichos[1]}</b>` });
  const faseInicio = F.map(f => f.fase);

  // Los escudos de Furia (y la Técnica) gastan los 3 puntos aunque no sirvan de nada
  for (const i of [0, 1]) if (CUESTAN_FURIA.includes(PICKS[i].eleccion)) p.lados[i].furia = 0;
  // Recobrar la compostura: se peina en medio del caos y recupera Dignidad
  for (const i of [0, 1]) if (PICKS[i].eleccion === "serenidad") {
    const tope = F[i].max * F[i].barras, antes = F[i].dig;
    F[i].dig = Math.min(tope, F[i].dig + CURA_SERENIDAD);
    lineas.push({ clave: "Compostura", valor: `${esc(nombres[i])} se peina en medio del caos y recobra <b>+${F[i].dig - antes} de Dignidad</b>.` });
  }
  // Hervir: gasta el Cruce, vuelve a la forma humana (no contraataca)
  for (const i of [0, 1]) if (PICKS[i].eleccion === "hervir") {
    const actor = game.actors.get(F[i].id);
    await hervir(actor, { fuente: PICKS[i].fuente });
    F[i].forma = "seco"; F[i].cara = caraForma(actor, "seco");
  }

  // Tiradas
  let ganador = null, tirada = null, dano = 0, tecnica = false;
  const tiradas = [null, null];
  if (dom === "espaldas") {
    for (const i of [0, 1]) p.lados[i].furia = Math.min(MAX_FURIA, p.lados[i].furia + 1);
    lineas.push({ clave: "Resultado", valor: "¡Los dos paran! Chocan las espaldas cómicamente: el Cruce se pierde sin daño y <b>+1 de Furia</b> para cada uno, por la frustración." });
  } else if (dom === "anulado") {
    for (const i of [0, 1]) if (PICKS[i].eleccion === "evasion") lineas.push({ clave: "Evasión", valor: `${esc(nombres[i])} se escurre con una <b>Evasión Ridícula Absoluta</b>: cualquier ataque se cancela sin tirar dados.` });
  } else if (dom === "choque") {
    for (const i of [0, 1]) tiradas[i] = await tirarLado(p, i, PICKS[i]);
    const [sa, sb] = [tiradas[0].suma, tiradas[1].suma];
    if (sa === sb) { lineas.push({ clave: "Choque", valor: "¡Doble impacto cómico! Los dos pierden 1 de Dignidad." }); dano = -1; }
    else { ganador = sa > sb ? 0 : 1; tirada = tiradas[ganador]; tecnica = PICKS[ganador].eleccion === "tecnica"; dano = danoDe(tirada.r.clave, { tecnica, choque: true }); }
  } else {
    ganador = dom === "a" ? 0 : 1;
    if (PASIVAS.includes(PICKS[ganador].eleccion)) { lineas.push({ clave: "Resultado", valor: `${esc(nombres[ganador])} bloquea mientras se recompone: nadie pierde Dignidad.` }); dano = 0; }
    else { tirada = tiradas[ganador] = await tirarLado(p, ganador, PICKS[ganador]); tecnica = PICKS[ganador].eleccion === "tecnica"; dano = danoDe(tirada.r.clave, { tecnica }); }
  }

  const ladoPerdedor = ganador === null ? null : otro(ganador);
  // Daño
  if (dano === -1) { for (const i of [0, 1]) { F[i].dig = Math.max(0, F[i].dig - 1); p.lados[i].danoRonda += 1; } }
  else if (ganador !== null && dano > 0) { F[ladoPerdedor].dig = Math.max(0, F[ladoPerdedor].dig - dano); p.lados[ladoPerdedor].danoRonda += dano; }
  if (ganador !== null && dano > 0) lineas.push({ clave: "Daño", valor: `${esc(nombres[ganador])} gana el Cruce: <b>−${dano} de Dignidad</b> para ${esc(nombres[ladoPerdedor])}${tecnica ? " (Técnica Secreta)" : ""}${dom === "choque" ? " (Choque)" : ""}.` });

  // Furia (ganar el Cruce con daño: +1 a los dos; la Técnica ya la gastó)
  if (ganador !== null && dano > 0) {
    p.lados[ganador].furia = Math.min(MAX_FURIA, p.lados[ganador].furia + 1);
    p.lados[ladoPerdedor].furia = Math.min(MAX_FURIA, p.lados[ladoPerdedor].furia + 1);
    if (tirada?.r.clave === "descomunal") p.lados[ganador].furia = MAX_FURIA;
  }
  if (dano === -1) for (const i of [0, 1]) p.lados[i].furia = Math.min(MAX_FURIA, p.lados[i].furia + 1);

  // Pifia Cómica y Caos de Nerima (dobles de toda la reserva); con ayuda complicada la pifia es del ayudante
  for (const i of [0, 1]) {
    const t = tiradas[i]; if (!t?.evento) continue;
    if (t.evento === "caos") lineas.push({ clave: "¡Caos de Nerima!", valor: `Dobles altos de ${esc(nombres[i])}: un gag ambiental <b>a favor de los personajes</b> (la dirección lo describe).` });
    else {
      const ayudantes = (PICKS[i].asistentes ?? []).map(id => p.lados[i].equipo.find((x, k) => x.id === id && k !== p.lados[i].activo)).filter(Boolean);
      const victima = ayudantes.length ? azar(ayudantes) : F[i];
      lineas.push({ clave: "¡PIFIA CÓMICA!", valor: `Dobles bajos de ${esc(nombres[i])}: un desastre o un ¡CHAPUZÓN! con agua fría, aunque la acción saliera bien. ${ayudantes.length ? `Había ayuda complicada: se lo lleva <b>solo ${esc(victima.nombre)}</b>.` : `Se lo lleva ${esc(victima.nombre)}.`}` });
      if (victima.tipo === "pj" && victima.forma === "seco") mojar.push(victima.id);
      extra.push({ t: "¡PIFIA CÓMICA!", ms: 1500, sonido: "fiasco", tono: "agua" });
    }
  }

  // Reglas del Jefe Final (Hidetoshi)
  let salpicadura = false; const bloqueoRelevo = [false, false];
  const ji = [0, 1].find(i => F[i].jefe === "hidetoshi");
  if (ji !== undefined) {
    const J = F[ji], rival = otro(ji);
    if (ganador === ji && dano > 0 && F[rival].tipo === "pj") {
      if (faseInicio[ji] === 1) { salpicadura = true; lineas.push({ clave: "Salpicadura", valor: `El cañón de agua salpica a todo el banquillo: pierden <b>1 de Dignidad</b> y no descansan este Cruce.` }); }
      if (tirada?.r.clave === "aparatoso") { bloqueoRelevo[rival] = true; lineas.push({ clave: "Aislamiento", valor: `${esc(F[rival].nombre)} sale empapado y <b>estampado contra la pared</b>: no se le puede relevar al final de este Cruce.` }); }
    }
    // Torrente Olímpico: ola de área contra el banquillo, con QTE
    if (PICKS[ji].eleccion === "tecnica" && dom !== "anulado") {
      const bando = p.lados[rival], ids = bando.equipo.filter((x, k) => k !== bando.activo && x.dig > 0).map(x => x.id);
      if (ids.length) {
        extra.push({ t: "¡TORRENTE OLÍMPICO!", ms: 1500, sonido: "alarma", tono: "tecnica" });
        const salvados = await esperarQTE(ids, J.nombre);
        for (const id of ids) {
          const x = bando.equipo.find(h => h.id === id);
          if (salvados.has(id)) lineas.push({ clave: "Ola", valor: `${esc(x.nombre)} <b>esquiva a tiempo</b> la ola del banquillo.` });
          else {
            x.dig = Math.max(0, x.dig - 2); bando.danoRonda += 2;
            if (x.tipo === "pj" && x.forma === "seco") mojar.push(x.id);
            lineas.push({ clave: "Ola", valor: `${esc(x.nombre)} no reacciona: <b>impacto directo, −2 de Dignidad</b>${x.tipo === "pj" && x.forma === "seco" ? " y ¡CHAPUZÓN!" : ""}.` });
          }
        }
      }
    }
  }

  // ¡CHAPUZÓN! en un aparatoso: al PJ que está en el Cruce (el atacante si lo es; si no, quien recibe)
  if (tirada?.r.clave === "aparatoso" && ganador !== null) {
    const objetivo = F[ganador].tipo === "pj" ? ganador : (F[ladoPerdedor].tipo === "pj" ? ladoPerdedor : null);
    if (objetivo !== null && F[objetivo].forma === "seco") mojar.push(F[objetivo].id);
  }
  // Ayudantes: pagan si su bando pierde el Cruce o saca un fiasco
  for (const i of [0, 1]) {
    const lado = p.lados[i], k = PICKS[i];
    const perdio = ganador !== null && ladoPerdedor === i, fiasco = tiradas[i]?.r.clave === "fiasco";
    for (const id of k.asistentes ?? []) {
      const h = lado.equipo.find((x, n) => x.id === id && n !== lado.activo && x.dig > 0);
      if (h && (perdio || fiasco)) { h.dig = Math.max(0, h.dig - 1); lado.danoRonda += 1; lineas.push({ clave: "Ayuda", valor: `${esc(h.nombre)} se arriesgó y pierde 1 de Dignidad.` }); }
    }
  }
  // En rojo (una vez por ronda), segunda barra y cambio de fase del Jefe
  for (const i of [0, 1]) {
    const f = F[i], b = barra(f);
    if (f.dig > 0 && b.color === "roja" && !f.rojo) { f.rojo = true; p.lados[i].furia = Math.min(MAX_FURIA, p.lados[i].furia + 1); extra.push({ t: "¡EN ROJO!", ms: 900, sonido: "golpe", tono: "fuego" }); }
    if (f.dig > 0 && b.actual > f.barraPrev) { f.barraPrev = b.actual; p.lados[i].furia = Math.max(p.lados[i].furia, 2); extra.push({ t: "¡SEGUNDA BARRA!", ms: 1400, sonido: "tecnica", tono: "fuego" }); }
    if (f.jefe === "hidetoshi" && f.fase === 1 && f.dig > 0 && f.dig <= (f.max * f.barras) / 2) {
      f.fase = 2; p.lados[i].furia = MAX_FURIA;
      extra.push({ t: "¡EL CAÑÓN SE ROMPE!", ms: 1800, sonido: "tecnica", tono: "fuego" });
      lineas.push({ clave: "Fase 2", valor: `¡El cañón de ${esc(f.nombre)} se rompe! Entra en <b>furia máxima</b> (3 de Furia) y cambia sus ataques.` });
    }
  }
  // Los del banquillo descansan +1 por Cruce (la salpicadura se lo quita y les resta 1)
  for (const i of [0, 1]) p.lados[i].equipo.forEach((f, n) => {
    if (n === p.lados[i].activo || f.dig <= 0) return;
    if (salpicadura && i === otro(ji)) f.dig = Math.max(0, f.dig - 1);
    else if (f.dig < f.max * f.barras) f.dig += 1;
  });

  // Relevos pedidos y entradas por K.O.
  for (const i of [0, 1]) {
    const lado = p.lados[i], k = PICKS[i];
    lado.equipo.forEach(f => { f.entrada = false; });
    let entra = -1; lado.relevoPrevio = false;
    if (activoDe(lado).dig <= 0) entra = lado.equipo.findIndex(f => f.dig > 0);
    else if (k.relevo && !bloqueoRelevo[i]) { const n = lado.equipo.findIndex(f => f.id === k.relevo && f.dig > 0); if (n >= 0) { entra = n; lado.relevoPrevio = true; } }
    if (entra >= 0 && entra !== lado.activo) { lado.activo = entra; lado.equipo[entra].entrada = true; lineas.push({ clave: "Entra", valor: `${esc(lado.equipo[entra].nombre)} entra con ${lado.relevoPrevio ? "una entrada espectacular (+1d6)" : "la rabia del relevo (+1d6)"}.` }); }
    lado.sinParada = false; lado.listo = false;
  }
  p.ayudas = {}; p.relevos = {};
  // Se mantienen las peticiones de relevo de quien sigue en el banquillo; quien entró (o cayó) las pierde
  p.peticiones = Object.fromEntries([0, 1].map(i => [i, (p0.peticiones?.[i] ?? []).filter(id => p.lados[i].equipo.some((f, n) => f.id === id && n !== p.lados[i].activo && f.dig > 0))]));

  // Fin de ronda
  const banners_ = [...[0, 1].filter(i => PICKS[i].eleccion === "tecnica" && !(ji === i && extra.some(b => b.t === "¡TORRENTE OLÍMPICO!"))).map(i => ({ t: (golpes[i] || "¡TÉCNICA SECRETA!").toUpperCase().slice(0, 44), ms: 1700, sonido: "tecnica", tono: "tecnica" })), ...extra];
  let finRondaGanador = null, causa = null;
  const caidos = [caido(p.lados[0].equipo), caido(p.lados[1].equipo)];
  if (caidos[0] || caidos[1]) { causa = "ko"; finRondaGanador = caidos[0] && caidos[1] ? -1 : (caidos[0] ? 1 : 0); }
  else { p.cruce += 1; if (p.maxCruces && p.cruce > p.maxCruces) { causa = "tiempo"; const t = tiempo(p.lados[0].equipo, p.lados[1].equipo); finRondaGanador = t === "doble" ? -1 : t === "a" ? 0 : 1; } }

  let termoMas = 0, victoriaPJ = false;
  if (causa) {
    banners_.push(causa === "ko" ? { t: "¡K.O.!", ms: 2000, sonido: "ko", tono: "ko" } : { t: "¡TIEMPO!", ms: 1500, sonido: "ronda", tono: "fuego" });
    if (finRondaGanador === -1) { banners_.push({ t: "¡DOBLE K.O.!", ms: 1500, sonido: "golpe", tono: "ko" }); lineas.push({ clave: "Ronda", valor: "¡Doble K.O. cómico! Se repite la ronda." }); }
    else {
      const g = finRondaGanador, perfecto = p.lados[g].danoRonda === 0;
      p.lados[g].rondas += 1;
      lineas.push({ clave: "Ronda", valor: `<b>${esc(nombreBando(p.lados[g]))}</b> gana la ronda ${p.ronda}${causa === "tiempo" ? " por ¡TIEMPO!" : " por K.O."} (${p.lados[g].rondas}/${p.rondasPara}).` });
      if (perfecto) { banners_.push({ t: "¡PERFECTO!", ms: 1800, sonido: "perfecto", tono: "oro" }); if (p.lados[g].equipo.some(f => f.tipo === "pj")) { termoMas = 1; lineas.push({ clave: "Perfecto", valor: "Sin perder ni 1 de Dignidad: <b>+1 carga de Termo</b> para el grupo." }); } }
    }
    const terminado = finRondaGanador >= 0 && p.lados[finRondaGanador].rondas >= p.rondasPara;
    if (terminado) {
      p.fase = "fin"; p.ganador = finRondaGanador; victoriaPJ = p.lados[finRondaGanador].equipo.some(f => f.tipo === "pj");
      banners_.push({ t: `¡GANA ${nombreBando(p.lados[finRondaGanador]).toUpperCase()}!`, ms: 2600, sonido: "perfecto", tono: "oro" });
    } else {
      p.ronda += finRondaGanador === -1 ? 0 : 1; p.cruce = 1;
      for (const lado of p.lados) { lado.activo = 0; lado.danoRonda = 0; lado.relevoPrevio = false; lado.equipo.forEach(f => { f.dig = f.max * f.barras; f.rojo = false; f.provoco = false; f.barraPrev = 1; f.entrada = false; f.fase = 1; }); }
      p.peticiones = {};
      banners_.push({ t: `RONDA ${p.ronda}`, ms: 1500, sonido: "ronda" }, { t: "¡PELEA!", ms: 1100, sonido: "pelea", tono: "fuego" });
    }
  }
  PICKS[0] = PICKS[1] = null;

  // Vapor 6: cuenta atrás de Cruces; si no se vence al jefe, el edificio explota (Final C)
  const cambiosEstado = {};
  const cuenta = estado().cuentaAtras;
  if (cuenta) {
    if (victoriaPJ) { cambiosEstado.cuentaAtras = null; cambiosEstado.vapor = 4; lineas.push({ clave: "Vapor", valor: "¡Jefe vencido! El temblor cesa y el Vapor baja a 4." }); }
    else {
      const restantes = cuenta.restantes - 1;
      if (restantes <= 0) {
        cambiosEstado.cuentaAtras = null; cambiosEstado.final = "C"; p.fase = "fin"; p.ganador = null;
        banners_.push({ t: "¡BOOOOM!", ms: 2600, sonido: "ko", tono: "ko" });
        lineas.push({ clave: "¡EXPLOSIÓN!", valor: "Se acabó la cuenta atrás: la presión revienta la caldera y el edificio sale volando. <b>Final C.</b>" });
      } else { cambiosEstado.cuentaAtras = { restantes }; lineas.push({ clave: "Cuenta atrás", valor: `¡Tiembla el edificio! Quedan <b>${restantes} Cruce${restantes === 1 ? "" : "s"}</b> para vencer al jefe o cerrar una válvula.` }); }
    }
  }

  // Guardar estado, tarjeta, chapuzones, banners
  await cambiarEstado({ pelea: p, ...(termoMas ? { termo: Math.min(3, estado().termo + 1) } : {}), ...cambiosEstado });
  const dominanteActor = ganador !== null ? tiradas[ganador]?.actor ?? game.actors.get(F[ganador].id) : null;
  const golpe = ganador !== null ? (golpes[ganador] ?? "") : "";
  const titulo = ganador !== null ? `¡${nombres[ganador]} gana el Cruce!` : dom === "espaldas" ? "¡Espalda contra espalda!" : dom === "anulado" ? "¡Evasión ridícula!" : "¡Doble impacto!";
  await publicar({
    tipo: "cruce", tono: tirada?.r.clave ?? (dano === -1 ? "aparatoso" : "fiasco"), icono: "fa-solid fa-hand-fist",
    etiqueta: `¡PELEA! · Ronda ${p0.ronda} · Cruce ${p0.cruce}`, sfx: tirada?.r.sfx ?? (dano === -1 ? "¡PAF!" : dom === "espaldas" ? "¡CLONC!" : "¡FIUUU!"),
    arte: dominanteActor ? tokenForma(dominanteActor) : undefined, arteClase: "figura mini", arteAlt: ganador !== null ? nombres[ganador] : "",
    dados: tirada ? tirada.caras.map((valor, k) => ({ valor, cuenta: tirada.cuentan.has(k) })) : undefined, suma: tirada?.suma,
    titulo, globo: golpe ? esc(golpe) : "", filas: lineas.map(l => ({ clave: l.clave, valor: l.valor })),
    fx: tirada ? { texto: tirada.r.sfx, sonido: tirada.r.clave, tono: tirada.r.clave } : { texto: "", sonido: "golpe", tono: "fuego" }
  }, { actor: dominanteActor ?? undefined, tirada: tirada?.roll, alias: dominanteActor ? undefined : "¡PELEA!" });
  for (const id of new Set(mojar)) { const a = game.actors.get(id); if (a && formaDe(a) === "seco") await chapuzon(a, { motivo: "El agua fría ha llegado." }); }
  await sincronizarFormas();
  if (banners_.length) banners(banners_);
}

/* ───────────────────────── Banners de máquina recreativa ───────────────────────── */

export function banners(lista) { difundir("banners", { lista }); }

let cola = Promise.resolve();
function mostrarBanners({ lista = [] } = {}) {
  for (const b of lista) cola = cola.then(() => new Promise(res => {
    if (b.sonido) sonar(b.sonido);
    if (!game.settings.get(ID, "efectos")) return res();
    const el = document.createElement("div");
    el.className = `mr-agua-va av-banner av-banner-${b.tono ?? "ronda"}${document.body.classList.contains("av-sin-movimiento") ? " quieto" : ""}`;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<b data-texto="${esc(b.t)}">${esc(b.t)}</b>`;
    document.body.append(el);
    setTimeout(() => { el.remove(); res(); }, b.ms ?? 1400);
  }));
}

/* ───────────────────────── HUD y mando ───────────────────────── */

let hud = null, firma = "", ultimaClave = "";
const local = { 0: { talento: false, entorno: false, golpe: "", tecnica: "" }, 1: { talento: false, entorno: false, golpe: "", tecnica: "" } };

/** ¿Maneja este usuario a este luchador? Quien dirige, todos; un jugador, solo sus PJ (nunca un PNJ). */
const controla = f => game.user.isGM || (f.tipo === "pj" && Boolean(game.actors.get(f.id)?.testUserPermission(game.user, "OWNER")));

function tarjetaLuchador(f, activo) {
  const b = barra(f);
  return `<div class="av-luch ${activo ? "activo" : "banquillo"} ${f.dig <= 0 ? "caido" : ""} ${f.jefe ? "jefe" : ""}" data-id="${f.id}">
    <figure class="av-luch-cara"><img src="${esc(f.cara)}" alt="${esc(f.nombre)}"></figure>
    <div class="av-luch-datos">
      <div class="av-luch-nombre"><b>${esc(f.nombre)}</b>${f.apodo ? `<small>«${esc(f.apodo)}»</small>` : ""}${f.forma === "mojado" ? `<i class="fa-solid fa-droplet av-mojado" data-tooltip="Mojado" inert></i>` : ""}${f.jefe ? `<span class="av-fase" data-tooltip="${f.fase === 1 ? "Cañón de agua: salpicadura y +1d6" : "Cañón roto: furia máxima"}">FASE ${f.fase}</span>` : ""}</div>
      <div class="av-vida ${b.color}"><i class="av-vida-dano" style="width:${b.frac * 100}%"></i><i class="av-vida-relleno" style="width:${b.frac * 100}%"></i>
        ${f.jefe ? `<i class="av-vida-corte" data-tooltip="Fase 2: 8 de Dignidad"></i>` : ""}
        ${f.barras > 1 ? `<span class="av-vida-barras">${Array.from({ length: f.barras }, (_, k) => `<em class="${k < (f.dig > 0 ? b.actual : 0) ? "on" : ""}"></em>`).join("")}</span>` : ""}
        <span class="av-vida-num">${f.dig}</span></div>
    </div></div>`;
}

function htmlLado(lado, i, p) {
  const f = activoDe(lado);
  const resto = lado.equipo.map((x, n) => n === lado.activo ? "" : tarjetaLuchador(x, false)).join("");
  return `<section class="av-lado ${i === 0 ? "izq" : "der"}" data-lado="${i}">
    ${tarjetaLuchador(f, true)}
    <div class="av-lado-pie">
      <div class="av-furia" data-tooltip="Furia: con 3, Técnica Secreta, Evasión Ridícula o recobrar la compostura"><span>FURIA</span>${Array.from({ length: MAX_FURIA }, (_, k) => `<i class="${k < lado.furia ? "on" : ""}"></i>`).join("")}</div>
      <div class="av-rondas" data-tooltip="Rondas ganadas">${Array.from({ length: p.rondasPara }, (_, k) => `<i class="${k < lado.rondas ? "on" : ""}"></i>`).join("")}</div>
      ${lado.listo ? `<span class="av-listo">¡LISTO!</span>` : ""}${lado.sinParada ? `<span class="av-sinparada" data-tooltip="Sin Parada este Cruce">¡FURIOSO!</span>` : ""}
    </div>
    ${resto ? `<div class="av-banquillo">${resto}</div>` : ""}
  </section>`;
}

/** Lados cuyo mando veo: quien dirige, los dos; un jugador, solo el bando donde pelea alguno de sus PJ (jamás el de los enemigos). */
export const misLados = p => [0, 1].filter(i => game.user.isGM || p.lados[i].equipo.some(f => controla(f)));

export function htmlMando(p, i) {
  const lado = p.lados[i], f = activoDe(lado), e = estado(), st = local[i];
  const activoMio = controla(f);
  const bancoMio = lado.equipo.map((x, n) => ({ x, n })).filter(({ x, n }) => n !== lado.activo && x.dig > 0 && controla(x));
  const ayudas = p.ayudas?.[i] ?? [], pidenIds = p.peticiones?.[i] ?? [], elegido = p.relevos?.[i] ?? null;
  const pasa = p.fase === "eleccion";
  const btn = (clave, nombre, ico, extra = "", off = false) => `<button type="button" class="av-arcade av-arcade-${clave}" data-accion="pick" data-eleccion="${clave}" ${extra} ${!pasa || off ? "disabled" : ""}><i class="fa-solid ${ico}" inert></i><span>${nombre}</span></button>`;
  const furiaMax = lado.furia >= MAX_FURIA;
  // Candidatos al relevo que ve el luchador activo: quienes lo piden (y, para quien dirige, cualquiera del banquillo)
  const candidatos = lado.equipo.filter((x, n) => n !== lado.activo && x.dig > 0 && (pidenIds.includes(x.id) || game.user.isGM));
  const grises = `<div class="av-mando-botones av-mando-gris" aria-label="Esperas en el banquillo: no puedes actuar este Cruce">
      ${btn("golpe", "GOLPE", "fa-hand-fist", "", true)}${btn("presa", "PRESA", "fa-hands-holding", "", true)}${btn("parada", "PARADA", "fa-shield-halved", "", true)}</div>`;
  return `<div class="av-mando-lado ${lado.listo ? "listo" : ""} ${activoMio ? "" : "en-banquillo"}" data-lado="${i}">
    <header><b>${esc(f.nombre)}</b> <small>${game.user.isGM ? (f.tipo === "pj" ? "bando de los personajes" : "rival · solo lo ves tú") : activoMio ? "tu Cruce" : "esperas en el banquillo"}</small>${lado.listo ? `<span class="av-listo">¡LISTO!</span>` : ""}</header>
    ${activoMio ? `<div class="av-mando-botones">
      ${btn("golpe", "GOLPE", "fa-hand-fist")}${btn("presa", "PRESA", "fa-hands-holding")}${btn("parada", "PARADA", "fa-shield-halved", lado.sinParada ? "data-tooltip=\"¡Provocado! No puedes parar este Cruce\"" : "", lado.sinParada)}
      ${f.forma === "mojado" ? btn("hervir", "AGUA CALIENTE", "fa-mug-hot", `data-fuente="${e.termo ? "termo" : "escena"}" data-tooltip="${e.termo ? "Termo: " + e.termo + " carga(s)" : "Fuente de calor de la escena"}"`) : ""}
      ${furiaMax ? btn("tecnica", "TÉCNICA SECRETA", "fa-bolt") : ""}
      ${furiaMax ? btn("evasion", "EVASIÓN RIDÍCULA", "fa-person-running", "data-tooltip=\"Gasta los 3 de Furia: cancela cualquier ataque, hasta una Técnica, sin tirar\"") : ""}
      ${furiaMax ? btn("serenidad", "PEINARSE", "fa-wand-magic-sparkles", `data-tooltip="Gasta los 3 de Furia: recobras la compostura y +${CURA_SERENIDAD} de Dignidad (cuenta como Parada)"`) : ""}
    </div>
    <div class="av-mando-extras">
      <label><input type="checkbox" data-campo="talento" ${st.talento ? "checked" : ""}> Mi talento ayuda <small>+1d6</small></label>
      <label><input type="checkbox" data-campo="entorno" ${st.entorno ? "checked" : ""}> Uso el entorno <small>+1d6</small></label>
      <input type="text" data-campo="golpe" placeholder="Nombre del golpe (¡Plancha Vertical!)" maxlength="50" value="${esc(st.golpe)}">
      ${furiaMax ? `<input type="text" data-campo="tecnica" placeholder="¡Grita tu Técnica Secreta!" maxlength="60" value="${esc(st.tecnica)}" class="av-tecnica-nombre">` : ""}
    </div>
    <div class="av-mando-fila">
      <button type="button" class="av-boton av-boton-suave" data-accion="provocar" ${f.provoco ? "disabled" : ""} data-tooltip="Una por ronda: si hace gracia, el rival no puede Parar"><i class="fa-solid fa-face-grin-tongue-squint" inert></i> Provocar</button>
      ${game.user.isGM && f.tipo !== "pj" ? `<button type="button" class="av-boton av-boton-suave" data-accion="azar"><i class="fa-solid fa-dice" inert></i> Al azar</button>` : ""}
    </div>
    ${candidatos.length ? `<div class="av-mando-relevos"><span>${game.user.isGM ? "Dar entrada al final del Cruce" : "Piden el relevo: elige a quién das entrada"}</span>
      ${candidatos.map(x => `<button type="button" class="av-chip-relevo ${elegido === x.id ? "elegido" : ""} ${pidenIds.includes(x.id) ? "pide" : ""}" data-accion="darRelevo" data-actor="${x.id}" aria-pressed="${elegido === x.id}" ${lado.relevoPrevio ? "disabled" : ""}><img src="${esc(x.cara)}" alt="">${esc(x.nombre)}${pidenIds.includes(x.id) ? " <i class=\"fa-solid fa-hand\" inert></i>" : ""}</button>`).join("")}</div>` : ""}` : (bancoMio.length ? grises : "")}
    ${bancoMio.length ? `<div class="av-mando-banq">${bancoMio.map(({ x }) => `<div class="av-banq-fila"><img src="${esc(x.cara)}" alt=""><b>${esc(x.nombre)}</b>
      <button type="button" class="av-boton av-boton-suave ${ayudas.includes(x.id) ? "activo" : ""}" data-accion="asistir" data-actor="${x.id}" aria-pressed="${ayudas.includes(x.id)}" data-tooltip="Asistencia: +1d6, pero pierde 1 de Dignidad si el bando pierde el Cruce o saca fiasco">Asistir</button>
      <button type="button" class="av-boton av-boton-suave ${pidenIds.includes(x.id) ? "activo" : ""}" data-accion="pedirRelevo" data-actor="${x.id}" aria-pressed="${pidenIds.includes(x.id)}" ${lado.relevoPrevio ? "disabled" : ""} data-tooltip="Pedir relevo: pulsa otra vez para anular la petición">${pidenIds.includes(x.id) ? "Anular relevo" : "Pedir relevo"}</button></div>`).join("")}</div>` : ""}
  </div>`;
}

function pintarHUD() {
  const p = estado().pelea;
  document.body.classList.toggle("av-en-pelea", Boolean(p));
  if (!p) { hud?.remove(); hud = null; firma = ""; ultimaClave = ""; return; }
  if (!hud) {
    hud = document.createElement("aside");
    hud.id = "av-pelea"; hud.className = "mr-agua-va av-pelea";
    hud.addEventListener("click", alPulsar); hud.addEventListener("input", alEscribir); hud.addEventListener("change", alEscribir);
    document.body.append(hud);
  }
  const claveCruce = `${p.ronda}-${p.cruce}`;
  if (claveCruce !== ultimaClave) { ultimaClave = claveCruce; for (const i of [0, 1]) local[i] = { talento: false, entorno: false, golpe: "", tecnica: "" }; }
  const cuenta = estado().cuentaAtras;
  const sig = JSON.stringify([p.fase, p.ronda, p.cruce, p.ganador, p.lados.map(l => [l.activo, l.furia, l.rondas, l.listo, l.sinParada, l.relevoPrevio, l.equipo.map(f => [f.id, f.dig, f.forma, f.fase])]), p.ayudas, p.peticiones, p.relevos, estado().termo, cuenta, game.user.id]);
  if (sig === firma) return;
  const previo = new Map([...hud.querySelectorAll(".av-luch")].map(el => [el.dataset.id, parseFloat(el.querySelector(".av-vida-dano")?.style.width) || 0]));
  firma = sig;
  const restantes = p.maxCruces ? String(Math.max(0, p.maxCruces - p.cruce + 1)).padStart(2, "0") : "∞";
  const gm = game.user.isGM;
  const manejo = misLados(p);
  hud.innerHTML = `<div class="av-pelea-top">
      ${htmlLado(p.lados[0], 0, p)}
      <div class="av-centro"><div class="av-cronometro ${p.maxCruces ? "" : "sin-limite"}" data-tooltip="${p.maxCruces ? "Cruces que quedan en la ronda" : "Sin cronómetro: se acaba por K.O."}">${restantes}</div><div class="av-ronda-tit">${p.fase === "fin" ? "FIN" : `RONDA ${p.ronda}`}</div>
        ${cuenta ? `<div class="av-cuenta" role="alert" data-tooltip="Vapor 6: vence al jefe o cierra una válvula antes de que explote">¡TIEMBLA!<b>${cuenta.restantes}</b><small>CRUCE${cuenta.restantes === 1 ? "" : "S"}</small></div>` : ""}
        ${gm ? `<div class="av-gm-mini"><button type="button" data-accion="forzar" class="av-mini" data-tooltip="Resolver ya (los que no han elegido, al azar)" ${p.fase !== "eleccion" ? "disabled" : ""}><i class="fa-solid fa-forward" inert></i></button><button type="button" data-accion="terminar" class="av-mini" data-tooltip="Terminar la pelea"><i class="fa-solid fa-xmark" inert></i></button></div>` : ""}</div>
      ${htmlLado(p.lados[1], 1, p)}
    </div>
    ${p.fase === "fin" ? `<div class="av-fin"><b>${p.ganador === null ? "¡EXPLOSIÓN! FINAL C" : `¡GANA ${esc(nombreBando(p.lados[p.ganador]).toUpperCase())}!`}</b>${gm ? `<button type="button" class="av-boton" data-accion="terminar">Cerrar la máquina</button>` : ""}</div>` : (manejo.length ? `<div class="av-mando">${manejo.map(i => htmlMando(p, i)).join("")}</div>` : "")}`;
  // Estela de daño: la barra blanca baja despacio detrás de la roja
  for (const el of hud.querySelectorAll(".av-luch")) {
    const d = el.querySelector(".av-vida-dano"), r = el.querySelector(".av-vida-relleno");
    const antes = previo.get(el.dataset.id), ahora = parseFloat(r.style.width) || 0;
    if (d && antes !== undefined && antes > ahora) { d.style.width = `${antes}%`; requestAnimationFrame(() => requestAnimationFrame(() => { d.style.width = `${ahora}%`; })); }
    if (antes !== undefined && antes > ahora) { el.classList.add("golpeado"); setTimeout(() => el.classList.remove("golpeado"), 600); }
  }
}

function alEscribir(ev) {
  const campo = ev.target.dataset?.campo; if (!campo) return;
  const i = Number(ev.target.closest("[data-lado]")?.dataset.lado);
  local[i][campo] = ev.target.type === "checkbox" ? ev.target.checked : ev.target.value;
}

function alPulsar(ev) {
  const b = ev.target.closest("[data-accion]"); if (!b || b.disabled) return;
  const i = Number(b.closest(".av-mando-lado")?.dataset.lado);
  const p = estado().pelea; if (!p) return;
  const accion = b.dataset.accion;
  if (accion === "terminar") return terminarPelea();
  if (accion === "forzar") return accionesMando.forzar();
  if (accion === "azar") return accionesMando.alAzar(i);
  const f = activoDe(p.lados[i]), st = local[i];
  if (accion === "pick") {
    const eleccion = b.dataset.eleccion;
    if (eleccion === "tecnica" && !st.tecnica.trim()) { ui.notifications.warn("¡Grita el nombre de tu Técnica Secreta!"); hud.querySelector(`.av-mando-lado[data-lado="${i}"] .av-tecnica-nombre`)?.focus(); return; }
    const golpe = eleccion === "tecnica" ? `¡${st.tecnica.trim().replace(/^¡|!$/g, "")}!` : st.golpe.trim();
    return accionesMando.pick({ lado: i, eleccion, talento: st.talento, entorno: st.entorno, golpe, fuente: b.dataset.fuente });
  }
  if (accion === "asistir") return accionesMando.asistir({ lado: i, actor: b.dataset.actor, on: b.getAttribute("aria-pressed") !== "true" });
  if (accion === "pedirRelevo") return accionesMando.pedirRelevo({ lado: i, actor: b.dataset.actor });
  if (accion === "darRelevo") return accionesMando.darRelevo({ lado: i, actor: b.dataset.actor });
  if (accion === "provocar") {
    DialogV2.prompt({
      window: { title: `Provocación · ${f.nombre}`, icon: "fa-solid fa-face-grin-tongue-squint" }, classes: ["mr-agua-va", "av-dialogo"],
      content: `<div class="av-dialogo-cuerpo"><p class="av-nota">Una pulla sobre el defecto cómico o el secreto del rival, a la cara y en voz alta. Si hace gracia a la mesa, no podrá Parar este Cruce.</p>
        <label class="av-campo"><span>Tu pulla</span><input type="text" name="texto" maxlength="140" autofocus placeholder="¡Tú no sabes ni nadar!"></label></div>`,
      ok: { label: "¡Provocar!", icon: "fa-solid fa-face-grin-tongue-squint", callback: (e, bb) => bb.form.elements.texto.value }, rejectClose: false
    }).then(texto => { if (texto?.trim()) accionesMando.provocar({ lado: i, texto }); });
  }
}

export function registrarPelea() {
  alRecibir("banners", mostrarBanners);
  alRecibir("qte", mostrarQTE);
  Hooks.on("aguava.estado", pintarHUD);
  Hooks.once("ready", pintarHUD);
  // Las peticiones de los jugadores llegan por socket al GM activo.
  for (const op of ["pick", "asistir", "pedirRelevo", "darRelevo", "provocar", "qteResp"]) alRecibir(op, (d, quien) => RECEPTORES[op](d, quien));
}
