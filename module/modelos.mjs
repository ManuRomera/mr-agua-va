/** Modelos de datos de los actores: personaje jugador (humano maldito, con su ficha privada) y PNJ de Nerima. */
const { StringField, HTMLField, NumberField, ArrayField, SchemaField, BooleanField } = foundry.data.fields;
const texto = (initial = "") => new StringField({ required: true, blank: true, initial });
const entero = (initial, min, max) => new NumberField({ required: true, integer: true, min, max, initial });

export const FORMAS = ["seco", "mojado"];

export class ModeloPJ extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      apodo: texto(), estilo: texto(), lema: texto(),
      // Las dos formas: Seco (humano) y Mojado (animal maldito de Jusenkyo).
      forma: new StringField({ required: true, choices: FORMAS, initial: "seco" }),
      tecnica: texto(), marcial: texto(), maldicion: texto(), animal: texto(), bestia: texto(), defecto: texto(),
      vinculo: texto(), presentacion: texto(),
      // Ficha privada: solo la ven su jugador y quien dirige.
      secreto: texto(), confesion: texto(), reto: texto(),
      // ¡PELEA!
      dignidad: entero(8, 1, 40),
      notas: new HTMLField({ required: true, blank: true })
    };
  }
}

export class ModeloPNJ extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      papel: texto(), frase: texto(), descripcion: texto(), tecnica: texto(), secreto: texto(),
      rol: new StringField({ required: true, choices: ["vecino", "rival"], initial: "vecino" }),
      // Jefe con reglas propias en la ¡PELEA! (Hidetoshi: cañón de agua, salpicadura, segunda fase y Torrente Olímpico de área).
      jefe: new StringField({ required: true, blank: true, choices: ["", "hidetoshi"], initial: "" }),
      // Ataques especiales: se activan con un botón (solo para quien dirige), dicen su frase solos y pueden costar Furia, recargarse y ser de área (QTE al banquillo).
      poderes: new ArrayField(new SchemaField({
        nombre: texto(), frase: texto(), coste: entero(0, 0, 3), extra: entero(0, 0, 3), recarga: entero(0, 0, 6), area: new BooleanField({ initial: false })
      }), { initial: [] }),
      // ¡PELEA!: Dignidad por barra, número de barras y rondas a ganar.
      dignidad: entero(6, 1, 40), barras: entero(1, 1, 3), rondas: entero(1, 1, 3),
      notas: new HTMLField({ required: true, blank: true })
    };
  }
}

export const MODELOS = { pj: ModeloPJ, pnj: ModeloPNJ };
