/** Reglas puras de ¡PAM! 2.0, de los marcadores y de ¡PELEA!: sin Foundry, para poder probarlas. */

export const RESULTADOS = [
  { min: 2, max: 5, clave: "fiasco", nombre: "Fiasco útil", sfx: "¡PATAPLAF!", dano: 1, texto: "La acción falla o se desvía. Quien dirige ofrece enseguida otra posibilidad y un lío visible: nunca un callejón sin salida." },
  { min: 6, max: 8, clave: "aparatoso", nombre: "Éxito aparatoso", sfx: "¡CATACROC!", dano: 2, texto: "Lo consigues, pero con un coste cómico, una consecuencia secundaria… o un ¡CHAPUZÓN! con agua fría." },
  { min: 9, max: 11, clave: "brillante", nombre: "Éxito brillante", sfx: "¡ZAS!", dano: 3, texto: "Logras lo que querías sin precio relevante. Descríbelo a lo grande, con pose marcial de anime de los 80." },
  { min: 12, max: 12, clave: "descomunal", nombre: "Éxito descomunal", sfx: "¡KA-BOOM!", dano: 4, texto: "Además de lograrlo con soberbia, eliges un beneficio extraordinario, vistoso y temporal en el escenario." }
];

export const resultado = suma => RESULTADOS.find(r => suma >= r.min && suma <= r.max) ?? (suma > 12 ? RESULTADOS[3] : RESULTADOS[0]);

/** Dados de la reserva: 2 de base, +1 por el talento de la forma, +1 por huir/esquivar/colarse en forma Mojada, +1 por cada ayuda; como mucho 4. */
export const reserva = ({ talento = false, huida = false, ayudas = 0, extra = 0 } = {}) =>
  Math.min(4, 2 + (talento ? 1 : 0) + (huida ? 1 : 0) + Math.max(0, ayudas | 0) + Math.max(0, extra | 0));

/** Índices de los dos dados que cuentan (los más altos; a igualdad, los primeros). */
export function dosMejores(caras) {
  return caras.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, 2).map(([, i]) => i);
}

/** Probabilidad exacta de sacar al menos `objetivo` sumando los dos mejores de `n` d6. */
export function probabilidad(n, objetivo) {
  let si = 0, total = 0;
  const caras = Array(n).fill(1);
  for (;;) {
    total++;
    const [a, b] = [...caras].sort((x, y) => y - x);
    if (a + b >= objetivo) si++;
    let i = 0;
    while (i < n && caras[i] === 6) caras[i++] = 1;
    if (i === n) break;
    caras[i]++;
  }
  return si / total;
}

/** Caos de Nerima: éxito (6+) con los dos dados que cuentan iguales. */
export const esDobles = (dosDados, suma) => dosDados.length === 2 && dosDados[0] === dosDados[1] && suma >= 6;

export const DESBARAJUSTE = [
  "Calma chicha: solo cubos de vecinos con buena intención.",
  "Los vecinos calientan motores: mangueras en mano.",
  "Tiempo de remojo: cada reto trae su chorro; un éxito aparatoso salpica.",
  "Se desbloquean los retos de gran escala (R13–R16) y el barrio se queda sin agua caliente.",
  "Las mangueras se escapan solas: con un fiasco también hay ¡CHAPUZÓN!.",
  "Nerima entera está empapada: gastar una carga de Termo cuesta una complicación.",
  "¡Inundación! Si de noche no se calma, amenaza el Final C."
];

export const VAPOR = [
  "Aire tibio: Carteles de 4 palabras.",
  "Aire tibio: Carteles de 4 palabras.",
  "Niebla: Carteles de 3 palabras; las distancias engañan.",
  "Niebla: Carteles de 3 palabras; las distancias engañan.",
  "Calor espeso: Carteles de 2 palabras; tuberías cruzadas.",
  "Calor espeso: Carteles de 2 palabras; tuberías cruzadas.",
  "¡La caldera explota! Carteles de 1 palabra. Final C."
];

export const acota = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

/** Carteles de Madera: cuatro palabras como mucho; el Vapor se las come (0-1: 4 · 2-3: 3 · 4-5: 2 · 6: 1). */
export const maxPalabras = (vapor = 0) => (vapor >= 6 ? 1 : vapor >= 4 ? 2 : vapor >= 2 ? 3 : 4);
export function recortarCartel(texto, vapor = 0) {
  const palabras = String(texto ?? "").trim().split(/\s+/).filter(Boolean);
  const max = maxPalabras(vapor);
  return { texto: palabras.slice(0, max).join(" "), recortado: palabras.length > max, max };
}

/** Tramos del reloj real (minutos de mesa). */
export const TRAMOS = [
  { desde: 0, clave: "amanecer", nombre: "Amanecer en Nerima", noche: false },
  { desde: 5, clave: "montaje", nombre: "Montaje matinal", noche: false },
  { desde: 15, clave: "acto1", nombre: "Acto I · Mañana movida", noche: false },
  { desde: 45, clave: "mediodia", nombre: "Cortinilla de mediodía", noche: false },
  { desde: 48, clave: "acto2", nombre: "Acto II · Tarde de mangueras", noche: false },
  { desde: 85, clave: "noche", nombre: "Cortinilla de noche", noche: true },
  { desde: 88, clave: "acto3", nombre: "Acto III · La Casa de Baños", noche: true },
  { desde: 112, clave: "nuevo", nombre: "Nuevo amanecer", noche: false },
  { desde: 120, clave: "fin", nombre: "¡Fin del episodio!", noche: false }
];

export const tramo = minutos => [...TRAMOS].reverse().find(t => minutos >= t.desde) ?? TRAMOS[0];

/** Minutos transcurridos de un reloj {inicio, acumulado} (inicio = marca de tiempo si está en marcha). */
export const minutosReloj = (reloj, ahora = Date.now()) =>
  ((reloj?.acumulado ?? 0) + (reloj?.inicio ? ahora - reloj.inicio : 0)) / 60000;

/** Cortinilla que toca (minuto 45, 85 o 112) si aún no se ha lanzado. */
export function cortinillaPendiente(minutos, lanzadas = []) {
  const toca = [["mediodia", 45], ["noche", 85], ["nuevo", 112]].filter(([, m]) => minutos >= m).map(([id]) => id);
  return toca.find(id => !lanzadas.includes(id)) ?? null;
}

/* ───────────────────────── ¡PELEA! ───────────────────────── */

export const POSTURAS = {
  golpe: { nombre: "Golpe", gana: "presa", icono: "fa-hand-fist" },
  presa: { nombre: "Presa", gana: "parada", icono: "fa-hands-holding" },
  parada: { nombre: "Parada", gana: "golpe", icono: "fa-shield-halved" }
};
export const MAX_FURIA = 3;
export const CRUCES_POR_RONDA = 6;

/** Postura efectiva de una elección (Hervir cuenta como Parada). */
export const posturaDe = eleccion => (eleccion === "hervir" ? "parada" : eleccion);

/** Quién domina el Cruce: «a», «b» o «choque». La Técnica Secreta rompe cualquier Parada y solo choca con otra Técnica. */
export function dominante(a, b) {
  if (a === "tecnica" && b === "tecnica") return "choque";
  if (a === "tecnica") return "a";
  if (b === "tecnica") return "b";
  const pa = posturaDe(a), pb = posturaDe(b);
  if (pa === pb) return "choque";
  return POSTURAS[pa].gana === pb ? "a" : "b";
}

/** Dignidad que se pierde: según el resultado; la Técnica suma 1 (mínimo 2); en un Choque resta 1 (mínimo 1). */
export function danoDe(clave, { tecnica = false, choque = false } = {}) {
  let d = RESULTADOS.find(r => r.clave === clave)?.dano ?? 1;
  if (tecnica) d = Math.max(2, d + 1);
  if (choque) d = Math.max(1, d - 1);
  return d;
}

/** Datos de una barra de varias vidas. dig = total restante; max = tamaño de cada barra; barras = nº de barras. */
export function barra({ dig = 0, max = 8, barras = 1 }) {
  const total = max * barras;
  const d = Math.max(0, Math.min(total, dig));
  const actual = d === 0 ? 1 : Math.ceil(d / max);
  const enBarra = d === 0 ? 0 : d - (actual - 1) * max;
  const frac = enBarra / max;
  return { total, dig: d, actual, frac, color: frac <= 0.25 ? "roja" : frac <= 0.5 ? "amarilla" : "verde" };
}

/** Porcentaje de Dignidad de todo un bando (¡TIEMPO!). */
export const porcentajeBando = bando => {
  const t = bando.reduce((s, l) => s + l.max * (l.barras ?? 1), 0) || 1;
  return bando.reduce((s, l) => s + l.dig, 0) / t;
};

/** Veredicto al agotarse los Cruces: «a», «b» o «doble». */
export function tiempo(bandoA, bandoB) {
  const pa = porcentajeBando(bandoA), pb = porcentajeBando(bandoB);
  return Math.abs(pa - pb) < 1e-9 ? "doble" : pa > pb ? "a" : "b";
}

/** ¿Está todo el bando a cero? */
export const caido = bando => bando.every(l => l.dig <= 0);
