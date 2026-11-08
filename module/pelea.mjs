/**
 * ¡PELEA! · combate de barrio estilo máquina recreativa de lucha (1 contra 1 o por equipos, «tag»).
 *  - El estado vive en `estado().pelea` (ajuste de mundo): solo quien dirige lo escribe y todos lo pintan arriba de la pantalla.
 *  - Las posturas se eligen en secreto: cada cliente las manda por socket al GM activo, que las guarda en memoria hasta resolver.
 *  - La resolución (triángulo Golpe > Presa > Parada, tirada de ¡PAM!, Dignidad, Furia, K.O.) es de quien dirige.
 */
import { ID, ARTE, estado, cambiarEstado, alRecibir, difundir, SOCKET } from "./mesa.mjs";
import { DialogV2 } from "./compat.mjs";
import { publicar } from "./chat.mjs";
import { sonar } from "./efectos.mjs";
import { POSTURAS, MAX_FURIA, CRUCES_POR_RONDA, dominante, danoDe, barra, tiempo, caido, posturaDe } from "./reglas.mjs";
import { lanzarPam } from "./tirada.mjs";
import { formaDe, tokenForma, caraForma, chapuzon, hervir } from "./forma.mjs";

const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const ELECCIONES = ["golpe", "presa", "parada", "hervir", "tecnica"];
const otro = i => 1 - i;
const activoDe = lado => lado.equipo[lado.activo];
const nombreBando = lado => lado.equipo.map(f => f.nombre).join(" y ");

/** Elecciones secretas de cada lado (solo en la memoria del GM activo). */
const PICKS = [null, null];

/* ───────────────────────── Montaje ───────────────────────── */

export function luchador(actor) {
  const s = actor.system, pj = actor.type === "pj";
  const max = Math.max(1, s.dignidad || (pj ? 8 : 6)), barras = pj ? 1 : Math.max(1, s.barras || 1);
  return { id: actor.id, nombre: actor.name, apodo: s.apodo ?? "", tipo: actor.type, max, barras, dig: max * barras,
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
  await cambiarEstado({ pelea: { fase: "eleccion", ronda: 1, rondasPara: Math.max(1, Math.min(3, rondasPara)), cruce: 1, maxCruces, lados, ganador: null } });
  banners([{ t: "RONDA 1", ms: 1500, sonido: "ronda" }, { t: "¡PELEA!", ms: 1100, sonido: "pelea", tono: "fuego" }]);
}

export async function terminarPelea() {
  if (!game.user.isGM) return;
  PICKS[0] = PICKS[1] = null;
  await cambiarEstado({ pelea: null });
}

/* ───────────────────────── Peticiones de los jugadores ───────────────────────── */

const soyGMActivo = () => game.users.activeGM?.isSelf;
/** ¿Puede este usuario decidir por el luchador activo del lado i? (su dueño o quien dirige) */
function puedeActuar(quien, i, actorId) {
  if (quien?.isGM) return true;
  const f = actorId ? game.actors.get(actorId) : null;
  return Boolean(f?.testUserPermission(quien, "OWNER"));
}
function enviar(op, datos) {
  if (game.user.isGM) return RECEPTORES[op]?.(datos, game.user);
  game.socket.emit(SOCKET, { op, datos });
}

const RECEPTORES = {
  async pick(d, quien) {
    if (!soyGMActivo()) return;
    const p = estado().pelea;
    if (!p || p.fase !== "eleccion" || ![0, 1].includes(d?.lado)) return;
    const lado = p.lados[d.lado], f = activoDe(lado);
    if (!puedeActuar(quien, d.lado, f?.id)) return;
    const eleccion = ELECCIONES.includes(d.eleccion) ? d.eleccion : null;
    if (!eleccion) return;
    if (eleccion === "tecnica" && lado.furia < MAX_FURIA) return ui.notifications.warn("Falta Furia para la Técnica Secreta.");
    if (eleccion === "parada" && lado.sinParada) return;
    if (eleccion === "hervir" && f.forma !== "mojado") return;
    PICKS[d.lado] = { eleccion, talento: Boolean(d.talento), entorno: Boolean(d.entorno), asistentes: (PICKS[d.lado]?.asistentes ?? []), relevo: PICKS[d.lado]?.relevo ?? null,
      golpe: String(d.golpe ?? "").slice(0, 50), fuente: d.fuente === "escena" ? "escena" : "termo" };
    await marcarListo(d.lado, true);
    if (PICKS[0]?.eleccion && PICKS[1]?.eleccion) return resolver();
  },
  async asistir(d, quien) {
    if (!soyGMActivo()) return;
    const p = estado().pelea; if (!p || p.fase !== "eleccion" || ![0, 1].includes(d?.lado)) return;
    if (!puedeActuar(quien, d.lado, d.actor)) return;
    const lado = p.lados[d.lado];
    if (!lado.equipo.some((f, i) => f.id === d.actor && i !== lado.activo && f.dig > 0)) return;
    const prev = PICKS[d.lado] ?? { eleccion: null, asistentes: [], relevo: null };
    const set = new Set(prev.asistentes); d.on ? set.add(d.actor) : set.delete(d.actor);
    PICKS[d.lado] = { ...prev, asistentes: [...set] };
    await cambiarEstado({ pelea: { ...p, ayudas: { ...(p.ayudas ?? {}), [d.lado]: [...set] } } });
  },
  async relevo(d, quien) {
    if (!soyGMActivo()) return;
    const p = estado().pelea; if (!p || p.fase !== "eleccion" || ![0, 1].includes(d?.lado)) return;
    if (!puedeActuar(quien, d.lado, d.actor)) return;
    const lado = p.lados[d.lado];
    if (lado.relevoPrevio || !lado.equipo.some((f, i) => f.id === d.actor && i !== lado.activo && f.dig > 0)) return ui.notifications.warn("No se puede relevar ahora.");
    const prev = PICKS[d.lado] ?? { eleccion: null, asistentes: [], relevo: null };
    PICKS[d.lado] = { ...prev, relevo: prev.relevo === d.actor ? null : d.actor };
    await cambiarEstado({ pelea: { ...p, relevos: { ...(p.relevos ?? {}), [d.lado]: PICKS[d.lado].relevo } } });
  },
  async provocar(d, quien) {
    if (!soyGMActivo()) return;
    const p = estado().pelea; if (!p || p.fase !== "eleccion" || ![0, 1].includes(d?.lado)) return;
    const lado = p.lados[d.lado], f = activoDe(lado);
    if (!puedeActuar(quien, d.lado, f?.id) || f.provoco) return;
    const texto = String(d.texto ?? "").trim().slice(0, 140);
    if (!texto) return;
    const humana = quien && !quien.isGM || (f.tipo === "pj");
    const gracia = humana ? await DialogV2.confirm({
      window: { title: "¿Ha tenido gracia?", icon: "fa-solid fa-face-grin-tears" }, classes: ["mr-agua-va", "av-dialogo"],
      content: `<p><b>${esc(f.nombre)}</b> provoca: «${esc(texto)}»</p><p class="av-nota">Si hace gracia a la mesa, ${esc(activoDe(p.lados[otro(d.lado)]).nombre)} pierde los papeles: este Cruce no puede elegir Parada.</p>`,
      yes: { label: "¡Ha tenido gracia!", icon: "fa-solid fa-face-laugh-squint" }, no: { label: "Ni caso", icon: "fa-solid fa-face-meh" }, rejectClose: false
    }) : true;
    const nuevo = foundry.utils.deepClone(p);
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
  }
};

async function marcarListo(i, listo) {
  const p = foundry.utils.deepClone(estado().pelea); p.lados[i].listo = listo;
  await cambiarEstado({ pelea: p });
}

/** Acciones del usuario (las llaman los botones del mando). */
export const accionesMando = {
  pick: d => enviar("pick", d), asistir: d => enviar("asistir", d), relevo: d => enviar("relevo", d), provocar: d => enviar("provocar", d),
  async alAzar(lado) {
    if (!game.user.isGM) return;
    const p = estado().pelea, l = p.lados[lado], f = activoDe(l);
    const opciones = ["golpe", "presa", ...(l.sinParada ? [] : ["parada"]), ...(l.furia >= MAX_FURIA ? ["tecnica"] : [])];
    return RECEPTORES.pick({ lado, eleccion: opciones[Math.floor(Math.random() * opciones.length)], golpe: "", talento: Math.random() < 0.5, entorno: false }, game.user);
  },
  async forzar() { if (game.user.isGM) return resolver(true); }
};

/* ───────────────────────── Resolución del Cruce (GM) ───────────────────────── */

async function tirarLado(p, i, pick) {
  const lado = p.lados[i], f = activoDe(lado), actor = game.actors.get(f.id);
  const ayudas = (pick.asistentes ?? []).filter(id => lado.equipo.some((x, k) => x.id === id && k !== lado.activo && x.dig > 0)).length;
  const r = await lanzarPam({ talento: pick.talento, ayudas, extra: (pick.entorno ? 1 : 0) + (pick.eleccion === "tecnica" ? 1 : 0) + (f.entrada ? 1 : 0) });
  return { ...r, actor, ayudas };
}

async function resolver(forzado = false) {
  const e = estado(), p0 = e.pelea;
  if (!p0 || p0.fase !== "eleccion") return;
  const p = foundry.utils.deepClone(p0);
  // Quien no ha elegido (o la máquina quiere acabar): al azar
  for (const i of [0, 1]) if (!PICKS[i]?.eleccion) {
    const l = p.lados[i], base = ["golpe", "presa", ...(l.sinParada ? [] : ["parada"])];
    PICKS[i] = { ...(PICKS[i] ?? { asistentes: [], relevo: null }), eleccion: base[Math.floor(Math.random() * base.length)], talento: false, entorno: false, golpe: "", fuente: "escena" };
  }
  const [pa, pb] = PICKS;
  const golpes = [pa.golpe, pb.golpe];
  const dom = dominante(pa.eleccion, pb.eleccion);
  const F = [activoDe(p.lados[0]), activoDe(p.lados[1])];
  const lineas = [];
  const nombres = [F[0].nombre, F[1].nombre];
  const dichos = [pa, pb].map(k => k.eleccion === "tecnica" ? "Técnica Secreta" : k.eleccion === "hervir" ? "Hervir (cuenta como Parada)" : POSTURAS[k.eleccion].nombre);
  lineas.push({ clave: "Posturas", valor: `${esc(nombres[0])}: <b>${dichos[0]}</b> · ${esc(nombres[1])}: <b>${dichos[1]}</b>` });

  // Hervir: gasta el Cruce, vuelve a la forma humana (no contraataca)
  for (const i of [0, 1]) if (PICKS[i].eleccion === "hervir") {
    const actor = game.actors.get(F[i].id);
    await hervir(actor, { fuente: PICKS[i].fuente });
    F[i].forma = "seco"; F[i].cara = caraForma(actor, "seco");
  }

  // Tiradas
  let ganador = null, tirada = null, dano = 0, tecnica = false, choque = dom === "choque";
  const tiradas = [null, null];
  if (choque) {
    for (const i of [0, 1]) tiradas[i] = await tirarLado(p, i, PICKS[i]);
    const [sa, sb] = [tiradas[0].suma, tiradas[1].suma];
    if (sa === sb) { lineas.push({ clave: "Choque", valor: "¡Doble impacto cómico! Los dos pierden 1 de Dignidad." }); dano = -1; }
    else { ganador = sa > sb ? 0 : 1; tirada = tiradas[ganador]; tecnica = PICKS[ganador].eleccion === "tecnica"; dano = danoDe(tirada.r.clave, { tecnica, choque: true }); }
  } else {
    ganador = dom === "a" ? 0 : 1;
    if (PICKS[ganador].eleccion === "hervir") { lineas.push({ clave: "Resultado", valor: `${esc(nombres[ganador])} bloquea mientras se seca: nadie pierde Dignidad.` }); dano = 0; }
    else { tirada = tiradas[ganador] = await tirarLado(p, ganador, PICKS[ganador]); tecnica = PICKS[ganador].eleccion === "tecnica"; dano = danoDe(tirada.r.clave, { tecnica }); }
  }

  const ladoPerdedor = ganador === null ? null : otro(ganador);
  const ya = { perfectos: false };
  // Daño
  if (dano === -1) { for (const i of [0, 1]) { F[i].dig = Math.max(0, F[i].dig - 1); p.lados[i].danoRonda += 1; } }
  else if (ganador !== null && dano > 0) { F[ladoPerdedor].dig = Math.max(0, F[ladoPerdedor].dig - dano); p.lados[ladoPerdedor].danoRonda += dano; }
  if (ganador !== null && dano > 0) lineas.push({ clave: "Daño", valor: `${esc(nombres[ganador])} gana el Cruce: <b>−${dano} de Dignidad</b> para ${esc(nombres[ladoPerdedor])}${tecnica ? " (Técnica Secreta)" : ""}${choque ? " (Choque)" : ""}.` });

  // Furia
  const furia = [p.lados[0].furia, p.lados[1].furia];
  if (tecnica) p.lados[ganador].furia = 0;
  if (ganador !== null && dano > 0) {
    p.lados[ganador].furia = Math.min(MAX_FURIA, p.lados[ganador].furia + 1);
    p.lados[ladoPerdedor].furia = Math.min(MAX_FURIA, p.lados[ladoPerdedor].furia + 1);
    if (tirada?.r.clave === "descomunal") p.lados[ganador].furia = MAX_FURIA;
  }
  if (dano === -1) for (const i of [0, 1]) p.lados[i].furia = Math.min(MAX_FURIA, p.lados[i].furia + 1);
  // En rojo (una vez por ronda) y segunda barra
  const extra = [];
  for (const i of [0, 1]) {
    const b = barra(F[i]);
    if (F[i].dig > 0 && b.color === "roja" && !F[i].rojo) { F[i].rojo = true; p.lados[i].furia = Math.min(MAX_FURIA, p.lados[i].furia + 1); extra.push({ t: "¡EN ROJO!", ms: 900, sonido: "golpe", tono: "fuego" }); }
    if (F[i].dig > 0 && b.actual > F[i].barraPrev) { F[i].barraPrev = b.actual; p.lados[i].furia = Math.max(p.lados[i].furia, 2); extra.push({ t: "¡SEGUNDA BARRA!", ms: 1400, sonido: "tecnica", tono: "fuego" }); lineas.push({ clave: "Jefe", valor: `${esc(nombres[i])} entra en su segunda barra con Furia 2.` }); }
  }
  // Ayudantes: pagan si su bando pierde el Cruce o saca un fiasco
  for (const i of [0, 1]) {
    const lado = p.lados[i], k = PICKS[i];
    const perdio = ganador !== null && ladoPerdedor === i;
    const fiasco = tiradas[i]?.r.clave === "fiasco";
    for (const id of k.asistentes ?? []) {
      const h = lado.equipo.find((x, n) => x.id === id && n !== lado.activo && x.dig > 0);
      if (h && (perdio || fiasco)) { h.dig = Math.max(0, h.dig - 1); lado.danoRonda += 1; lineas.push({ clave: "Ayuda", valor: `${esc(h.nombre)} se arriesgó y pierde 1 de Dignidad.` }); }
    }
  }
  // ¡CHAPUZÓN! en un aparatoso: al PJ que está en el Cruce (el atacante si lo es; si no, quien recibe)
  let mojado = null;
  if (tirada?.r.clave === "aparatoso" && ganador !== null) {
    const objetivo = F[ganador].tipo === "pj" ? ganador : (F[ladoPerdedor].tipo === "pj" ? ladoPerdedor : null);
    if (objetivo !== null && F[objetivo].forma === "seco") mojado = objetivo;
  }
  // Pausa de los que esperan en el banquillo: +1 por Cruce
  for (const i of [0, 1]) p.lados[i].equipo.forEach((f, n) => { if (n !== p.lados[i].activo && f.dig > 0 && f.dig < f.max * f.barras) f.dig += 1; });

  // Relevos pedidos y entradas por K.O.
  for (const i of [0, 1]) {
    const lado = p.lados[i], k = PICKS[i];
    lado.equipo.forEach(f => { f.entrada = false; });
    let entra = -1; lado.relevoPrevio = false;
    if (activoDe(lado).dig <= 0) entra = lado.equipo.findIndex(f => f.dig > 0);
    else if (k.relevo) { const n = lado.equipo.findIndex(f => f.id === k.relevo && f.dig > 0); if (n >= 0) { entra = n; lado.relevoPrevio = true; } }
    if (entra >= 0 && entra !== lado.activo) { lado.activo = entra; lado.equipo[entra].entrada = true; lineas.push({ clave: "Entra", valor: `${esc(lado.equipo[entra].nombre)} entra con ${lado.relevoPrevio ? "una entrada espectacular (+1d6)" : "la rabia del relevo (+1d6)"}.` }); }
    lado.sinParada = false; lado.listo = false;
  }
  p.ayudas = {}; p.relevos = {};

  // Fin de ronda
  const banners_ = [...[0, 1].filter(i => PICKS[i].eleccion === "tecnica").map(i => ({ t: (golpes[i] || "¡TÉCNICA SECRETA!").toUpperCase().slice(0, 44), ms: 1700, sonido: "tecnica", tono: "tecnica" })), ...extra];
  let finRondaGanador = null, causa = null;
  const caidos = [caido(p.lados[0].equipo), caido(p.lados[1].equipo)];
  if (caidos[0] || caidos[1]) { causa = "ko"; finRondaGanador = caidos[0] && caidos[1] ? -1 : (caidos[0] ? 1 : 0); }
  else { p.cruce += 1; if (p.cruce > p.maxCruces) { causa = "tiempo"; const t = tiempo(p.lados[0].equipo, p.lados[1].equipo); finRondaGanador = t === "doble" ? -1 : t === "a" ? 0 : 1; } }

  let termoMas = 0;
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
      p.fase = "fin"; p.ganador = finRondaGanador;
      banners_.push({ t: `¡GANA ${nombreBando(p.lados[finRondaGanador]).toUpperCase()}!`, ms: 2600, sonido: "perfecto", tono: "oro" });
    } else {
      p.ronda += finRondaGanador === -1 ? 0 : 1; p.cruce = 1;
      for (const lado of p.lados) { lado.activo = 0; lado.danoRonda = 0; lado.relevoPrevio = false; lado.equipo.forEach(f => { f.dig = f.max * f.barras; f.rojo = false; f.provoco = false; f.barraPrev = 1; f.entrada = false; }); }
      banners_.push({ t: `RONDA ${p.ronda}`, ms: 1500, sonido: "ronda" }, { t: "¡PELEA!", ms: 1100, sonido: "pelea", tono: "fuego" });
    }
  }
  PICKS[0] = PICKS[1] = null;

  // Guardar estado, tarjeta, chapuzón, banners
  const nuevoTermo = termoMas ? Math.min(3, estado().termo + 1) : estado().termo;
  await cambiarEstado({ pelea: p, ...(termoMas ? { termo: nuevoTermo } : {}) });
  const dominanteActor = ganador !== null ? tiradas[ganador]?.actor ?? game.actors.get(F[ganador].id) : null;
  const golpe = ganador !== null ? (golpes[ganador] ?? "") : "";
  await publicar({
    tipo: "cruce", tono: tirada?.r.clave ?? (dano === -1 ? "aparatoso" : "fiasco"), icono: "fa-solid fa-hand-fist",
    etiqueta: `¡PELEA! · Ronda ${p0.ronda} · Cruce ${p0.cruce}`, sfx: tirada?.r.sfx ?? (dano === -1 ? "¡PAF!" : "¡CLONC!"),
    arte: dominanteActor ? tokenForma(dominanteActor) : undefined, arteClase: "figura mini", arteAlt: ganador !== null ? nombres[ganador] : "",
    dados: tirada ? tirada.caras.map((valor, k) => ({ valor, cuenta: tirada.cuentan.has(k) })) : undefined, suma: tirada?.suma,
    titulo: ganador !== null ? `¡${nombres[ganador]} gana el Cruce!` : "¡Doble impacto!",
    globo: golpe ? esc(golpe) : "", filas: lineas.map(l => ({ clave: l.clave, valor: l.valor })),
    fx: tirada ? { texto: tirada.r.sfx, sonido: tirada.r.clave, tono: tirada.r.clave } : { texto: "", sonido: "golpe", tono: "fuego" }
  }, { actor: dominanteActor ?? undefined, tirada: tirada?.roll, alias: dominanteActor ? undefined : "¡PELEA!" });
  if (mojado !== null) { const a = game.actors.get(F[mojado].id); await chapuzon(a, { motivo: "El golpe ha salpicado." }); const q = foundry.utils.deepClone(estado().pelea); const fq = q.lados[mojado].equipo.find(x => x.id === F[mojado].id); if (fq) { fq.forma = "mojado"; fq.cara = caraForma(a, "mojado"); await cambiarEstado({ pelea: q }); } }
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

const frac = f => barra(f).frac * 100;
const colorBarra = f => barra(f).color;

function tarjetaLuchador(f, lado, i, activo) {
  const b = barra(f);
  return `<div class="av-luch ${activo ? "activo" : "banquillo"} ${f.dig <= 0 ? "caido" : ""}" data-id="${f.id}">
    <figure class="av-luch-cara"><img src="${esc(f.cara)}" alt="${esc(f.nombre)}"></figure>
    <div class="av-luch-datos">
      <div class="av-luch-nombre"><b>${esc(f.nombre)}</b>${f.apodo ? `<small>«${esc(f.apodo)}»</small>` : ""}${f.forma === "mojado" ? `<i class="fa-solid fa-droplet av-mojado" data-tooltip="Mojado" inert></i>` : ""}</div>
      <div class="av-vida ${b.color}"><i class="av-vida-dano" style="width:${b.frac * 100}%"></i><i class="av-vida-relleno" style="width:${b.frac * 100}%"></i>
        ${f.barras > 1 ? `<span class="av-vida-barras">${Array.from({ length: f.barras }, (_, k) => `<em class="${k < (f.dig > 0 ? b.actual : 0) ? "on" : ""}"></em>`).join("")}</span>` : ""}
        <span class="av-vida-num">${f.dig}</span></div>
    </div></div>`;
}

function htmlLado(lado, i, p) {
  const f = activoDe(lado);
  const resto = lado.equipo.map((x, n) => n === lado.activo ? "" : tarjetaLuchador(x, lado, i, false)).join("");
  return `<section class="av-lado ${i === 0 ? "izq" : "der"}" data-lado="${i}">
    ${tarjetaLuchador(f, lado, i, true)}
    <div class="av-lado-pie">
      <div class="av-furia" data-tooltip="Furia: con 3, Técnica Secreta"><span>FURIA</span>${Array.from({ length: MAX_FURIA }, (_, k) => `<i class="${k < lado.furia ? "on" : ""}"></i>`).join("")}</div>
      <div class="av-rondas" data-tooltip="Rondas ganadas">${Array.from({ length: p.rondasPara }, (_, k) => `<i class="${k < lado.rondas ? "on" : ""}"></i>`).join("")}</div>
      ${lado.listo ? `<span class="av-listo">¡LISTO!</span>` : ""}${lado.sinParada ? `<span class="av-sinparada" data-tooltip="Sin Parada este Cruce">¡FURIOSO!</span>` : ""}
    </div>
    ${resto ? `<div class="av-banquillo">${resto}</div>` : ""}
  </section>`;
}

function misLados(p) {
  // Lados que puedo manejar: quien dirige, todos; un jugador, aquellos cuyo luchador activo (o algún banquillo) es suyo
  return [0, 1].filter(i => game.user.isGM || p.lados[i].equipo.some(f => game.actors.get(f.id)?.testUserPermission(game.user, "OWNER")));
}

function htmlMando(p, i) {
  const lado = p.lados[i], f = activoDe(lado), actor = game.actors.get(f.id), e = estado(), st = local[i];
  const mandoActivo = game.user.isGM || actor?.testUserPermission(game.user, "OWNER");
  const mios = lado.equipo.map((x, n) => ({ x, n })).filter(({ x, n }) => n !== lado.activo && x.dig > 0 && (game.user.isGM || game.actors.get(x.id)?.testUserPermission(game.user, "OWNER")));
  const listo = lado.listo;
  const ayudas = p.ayudas?.[i] ?? [], relevo = p.relevos?.[i] ?? null;
  const btn = (clave, nombre, ico, extra = "") => `<button type="button" class="av-arcade av-arcade-${clave}" data-accion="pick" data-eleccion="${clave}" ${extra} ${p.fase !== "eleccion" ? "disabled" : ""}><i class="fa-solid ${ico}" inert></i><span>${nombre}</span></button>`;
  return `<div class="av-mando-lado ${listo ? "listo" : ""}" data-lado="${i}">
    <header><b>${esc(f.nombre)}</b> <small>${game.user.isGM ? (i === 0 ? "bando A" : "bando B") : "tu Cruce"}</small>${listo ? `<span class="av-listo">¡LISTO!</span>` : ""}</header>
    ${mandoActivo ? `<div class="av-mando-botones">
      ${btn("golpe", "GOLPE", "fa-hand-fist")}${btn("presa", "PRESA", "fa-hands-holding")}${btn("parada", "PARADA", "fa-shield-halved", lado.sinParada ? "disabled data-tooltip=\"¡Provocado! No puedes parar este Cruce\"" : "")}
      ${f.forma === "mojado" ? btn("hervir", "AGUA CALIENTE", "fa-mug-hot", `data-fuente="${e.termo ? "termo" : "escena"}" data-tooltip="${e.termo ? "Termo: " + e.termo + " carga(s)" : "Fuente de calor de la escena"}"`) : ""}
      ${lado.furia >= MAX_FURIA ? btn("tecnica", "TÉCNICA SECRETA", "fa-bolt") : ""}
    </div>
    <div class="av-mando-extras">
      <label><input type="checkbox" data-campo="talento" ${st.talento ? "checked" : ""}> Mi talento ayuda <small>+1d6</small></label>
      <label><input type="checkbox" data-campo="entorno" ${st.entorno ? "checked" : ""}> Uso el entorno <small>+1d6</small></label>
      <input type="text" data-campo="golpe" placeholder="Nombre del golpe (¡Plancha Vertical!)" maxlength="50" value="${esc(st.golpe)}">
      ${lado.furia >= MAX_FURIA ? `<input type="text" data-campo="tecnica" placeholder="¡Grita tu Técnica Secreta!" maxlength="60" value="${esc(st.tecnica)}" class="av-tecnica-nombre">` : ""}
    </div>
    <div class="av-mando-fila">
      <button type="button" class="av-boton av-boton-suave" data-accion="provocar" ${f.provoco ? "disabled" : ""} data-tooltip="Una por ronda: si hace gracia, el rival no puede Parar"><i class="fa-solid fa-face-grin-tongue-squint" inert></i> Provocar</button>
      ${game.user.isGM && f.tipo !== "pj" ? `<button type="button" class="av-boton av-boton-suave" data-accion="azar"><i class="fa-solid fa-dice" inert></i> Al azar</button>` : ""}
    </div>` : ""}
    ${mios.length ? `<div class="av-mando-banq">${mios.map(({ x }) => `<div class="av-banq-fila"><img src="${esc(x.cara)}" alt=""><b>${esc(x.nombre)}</b>
      <button type="button" class="av-boton av-boton-suave ${ayudas.includes(x.id) ? "activo" : ""}" data-accion="asistir" data-actor="${x.id}" aria-pressed="${ayudas.includes(x.id)}" data-tooltip="Asistencia: +1d6, pero pierde 1 de Dignidad si el bando pierde el Cruce o saca fiasco">Asistir</button>
      <button type="button" class="av-boton av-boton-suave ${relevo === x.id ? "activo" : ""}" data-accion="relevo" data-actor="${x.id}" aria-pressed="${relevo === x.id}" ${lado.relevoPrevio ? "disabled" : ""} data-tooltip="Relevo al final del Cruce">Relevo</button></div>`).join("")}</div>` : ""}
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
  const sig = JSON.stringify([p.fase, p.ronda, p.cruce, p.lados.map(l => [l.activo, l.furia, l.rondas, l.listo, l.sinParada, l.equipo.map(f => [f.id, f.dig, f.forma])]), p.ayudas, p.relevos, estado().termo]);
  if (sig === firma) return;
  const previo = new Map([...hud.querySelectorAll(".av-luch")].map(el => [el.dataset.id, parseFloat(el.querySelector(".av-vida-dano")?.style.width) || 0]));
  firma = sig;
  const restantes = Math.max(0, p.maxCruces - p.cruce + 1);
  const gm = game.user.isGM;
  const manejo = misLados(p);
  hud.innerHTML = `<div class="av-pelea-top">
      ${htmlLado(p.lados[0], 0, p)}
      <div class="av-centro"><div class="av-cronometro" data-tooltip="Cruces que quedan en la ronda">${String(restantes).padStart(2, "0")}</div><div class="av-ronda-tit">${p.fase === "fin" ? "FIN" : `RONDA ${p.ronda}`}</div>
        ${gm ? `<div class="av-gm-mini"><button type="button" data-accion="forzar" class="av-mini" data-tooltip="Resolver ya (los que no han elegido, al azar)" ${p.fase !== "eleccion" ? "disabled" : ""}><i class="fa-solid fa-forward" inert></i></button><button type="button" data-accion="terminar" class="av-mini" data-tooltip="Terminar la pelea"><i class="fa-solid fa-xmark" inert></i></button></div>` : ""}</div>
      ${htmlLado(p.lados[1], 1, p)}
    </div>
    ${p.fase === "fin" ? `<div class="av-fin"><b>¡GANA ${esc(nombreBando(p.lados[p.ganador]).toUpperCase())}!</b>${gm ? `<button type="button" class="av-boton" data-accion="terminar">Cerrar la máquina</button>` : ""}</div>` : (manejo.length ? `<div class="av-mando">${manejo.map(i => htmlMando(p, i)).join("")}</div>` : "")}`;
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
  if (accion === "relevo") return accionesMando.relevo({ lado: i, actor: b.dataset.actor });
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
  Hooks.on("aguava.estado", pintarHUD);
  Hooks.once("ready", pintarHUD);
  // Las peticiones de los jugadores llegan por socket al GM activo.
  for (const op of ["pick", "asistir", "relevo", "provocar"]) alRecibir(op, (d, quien) => RECEPTORES[op](d, quien));
}
