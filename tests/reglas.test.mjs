import test from "node:test";
import assert from "node:assert/strict";
import { resultado, reserva, dosMejores, probabilidad, esDobles, maxPalabras, recortarCartel, tramo, cortinillaPendiente,
  dominante, danoDe, barra, tiempo, caido } from "../module/reglas.mjs";

test("tabla de resultados de ¡PAM!", () => {
  assert.equal(resultado(2).clave, "fiasco"); assert.equal(resultado(5).clave, "fiasco");
  assert.equal(resultado(6).clave, "aparatoso"); assert.equal(resultado(8).clave, "aparatoso");
  assert.equal(resultado(9).clave, "brillante"); assert.equal(resultado(11).clave, "brillante");
  assert.equal(resultado(12).clave, "descomunal");
});

test("reserva de dados: base 2, talento, huida y ayudas, tope 4", () => {
  assert.equal(reserva(), 2);
  assert.equal(reserva({ talento: true }), 3);
  assert.equal(reserva({ talento: true, huida: true }), 4);
  assert.equal(reserva({ talento: true, huida: true, ayudas: 3 }), 4);
});

test("los dos mejores dados y las probabilidades", () => {
  assert.deepEqual(dosMejores([3, 6, 1, 6]), [1, 3]);
  assert.ok(Math.abs(probabilidad(2, 2) - 1) < 1e-9);
  assert.ok(probabilidad(4, 9) > probabilidad(2, 9));
});

test("dobles del caos solo en éxito", () => {
  assert.equal(esDobles([4, 4], 8), true);
  assert.equal(esDobles([2, 2], 4), false);
  assert.equal(esDobles([4, 5], 9), false);
});

test("los Carteles pierden palabras con el Vapor", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(maxPalabras), [4, 4, 3, 3, 2, 2, 1]);
  assert.equal(recortarCartel("tira del cable idiota ya", 0).texto, "tira del cable idiota");
  assert.equal(recortarCartel("tira del cable", 6).texto, "tira");
  assert.equal(recortarCartel("hola", 0).recortado, false);
});

test("reloj: tramos y cortinillas a 45, 85 y 112", () => {
  assert.equal(tramo(0).clave, "amanecer"); assert.equal(tramo(30).clave, "acto1"); assert.equal(tramo(90).clave, "acto3"); assert.equal(tramo(115).clave, "nuevo");
  assert.equal(cortinillaPendiente(44, []), null);
  assert.equal(cortinillaPendiente(45, []), "mediodia");
  assert.equal(cortinillaPendiente(90, ["mediodia"]), "noche");
  assert.equal(cortinillaPendiente(113, ["mediodia", "noche"]), "nuevo");
});

test("triángulo de posturas: Golpe > Presa > Parada > Golpe", () => {
  assert.equal(dominante("golpe", "presa"), "a"); assert.equal(dominante("presa", "golpe"), "b");
  assert.equal(dominante("presa", "parada"), "a"); assert.equal(dominante("parada", "golpe"), "a");
  assert.equal(dominante("golpe", "parada"), "b"); assert.equal(dominante("golpe", "golpe"), "choque");
});

test("Hervir cuenta como Parada y la Técnica rompe la guardia", () => {
  assert.equal(dominante("hervir", "golpe"), "a");
  assert.equal(dominante("tecnica", "parada"), "a"); assert.equal(dominante("parada", "tecnica"), "b");
  assert.equal(dominante("tecnica", "tecnica"), "choque");
});

test("daño por resultado, técnica y choque", () => {
  assert.deepEqual(["fiasco", "aparatoso", "brillante", "descomunal"].map(c => danoDe(c)), [1, 2, 3, 4]);
  assert.equal(danoDe("fiasco", { tecnica: true }), 2);
  assert.equal(danoDe("brillante", { tecnica: true }), 4);
  assert.equal(danoDe("fiasco", { choque: true }), 1);
  assert.equal(danoDe("brillante", { choque: true }), 2);
});

test("barra de Dignidad de varias vidas y su color", () => {
  assert.deepEqual([barra({ dig: 8, max: 8 }).color, barra({ dig: 4, max: 8 }).color, barra({ dig: 2, max: 8 }).color], ["verde", "amarilla", "roja"]);
  const b = barra({ dig: 12, max: 8, barras: 2 });
  assert.equal(b.actual, 2); assert.equal(b.frac, 0.5);
  assert.equal(barra({ dig: 0, max: 8, barras: 2 }).frac, 0);
  assert.equal(barra({ dig: 99, max: 8, barras: 2 }).dig, 16);
});

test("¡TIEMPO! gana quien conserve más porcentaje y K.O. de un bando", () => {
  const a = [{ dig: 4, max: 8 }], b = [{ dig: 12, max: 8, barras: 2 }];
  assert.equal(tiempo(a, b), "b");
  assert.equal(tiempo([{ dig: 4, max: 8 }], [{ dig: 4, max: 8 }]), "doble");
  assert.equal(caido([{ dig: 0 }, { dig: 0 }]), true);
  assert.equal(caido([{ dig: 0 }, { dig: 1 }]), false);
});
