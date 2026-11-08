/** Modelos de datos de los actores: personaje jugador (humano maldito, con su ficha privada) y PNJ de Nerima. */
const { StringField, HTMLField, NumberField } = foundry.data.fields;
const texto = (initial = "") => new StringField({ required: true, blank: true, initial });
const entero = (initial, min, max) => new NumberField({ required: true, integer: true, min, max, initial });

export const FORMAS = ["seco", "mojado"];

export class ModeloPJ extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      apodo: texto(), estilo: texto(), lema: texto(),
      // Las dos formas: Seco (humano) y Mojado (animal maldito de Jusenkyo).
      forma: new StringField({ required: true, choices: FORMAS, initial: "seco" }),
      marcial: texto(), maldicion: texto(), animal: texto(), bestia: texto(), defecto: texto(),
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
      // ¡PELEA!: Dignidad por barra, número de barras y rondas a ganar.
      dignidad: entero(6, 1, 40), barras: entero(1, 1, 3), rondas: entero(1, 1, 3),
      notas: new HTMLField({ required: true, blank: true })
    };
  }
}

export const MODELOS = { pj: ModeloPJ, pnj: ModeloPNJ };
