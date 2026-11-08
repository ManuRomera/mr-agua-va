/**
 * Compila los compendios a LevelDB desde `_data/<pack>.json`.
 * Compilar con Foundry abierto destruye los packs: LevelDB recuperaría la base
 * vacía, así que antes se comprueba que no haya ninguna base bloqueada.
 */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { ClassicLevel } from "classic-level";

const manifiesto = JSON.parse(await fs.readFile("system.json"));
const RAIZ = { JournalEntry: "journal", Actor: "actors", Item: "items", RollTable: "tables", Cards: "cards", Scene: "scenes", Adventure: "adventures" };
const EMBEBIDOS = { JournalEntry: ["pages"], Actor: ["items", "effects"], Item: ["effects"], RollTable: ["results"], Cards: ["cards"], Scene: [], Adventure: [] };
const id = texto => createHash("sha1").update(texto).digest("hex").slice(0, 16);

/**
 * Comprueba que ninguna base esté abierta por otro proceso.
 * @param {Array<{name:string, path:string}>} packs
 */
export async function comprobarCerrados(packs) {
  const bloqueados = [];
  for (const pack of packs) {
    if (!(await fs.stat(pack.path).catch(() => null))) continue;
    const db = new ClassicLevel(pack.path, { valueEncoding: "json" });
    try {
      await db.open();
      await db.close();
    } catch (error) {
      if ((error.cause?.code ?? error.code) === "LEVEL_LOCKED") bloqueados.push(pack.name);
      else throw error;
    }
  }
  if (bloqueados.length) {
    throw new Error(`Foundry tiene abiertos estos packs: ${bloqueados.join(", ")}.\nCierra el mundo (o Foundry) antes de compilar.`);
  }
}

if (process.argv[1]?.endsWith("build.mjs")) {
  await comprobarCerrados(manifiesto.packs);
  await fs.mkdir("packs", { recursive: true });
  for (const pack of manifiesto.packs) {
    const crudo = JSON.parse(await fs.readFile(`_data/${pack.name}.json`));
    const carpetas = Array.isArray(crudo) ? [] : (crudo.folders ?? []);
    const documentos = Array.isArray(crudo) ? crudo : crudo.documents;
    const raiz = RAIZ[pack.type];
    if (!raiz) throw new Error(`Tipo de pack sin raíz: ${pack.type}`);
    await fs.rm(pack.path, { recursive: true, force: true });
    const db = new ClassicLevel(pack.path, { valueEncoding: "json" });
    for (const carpeta of carpetas) await db.put(`!folders!${carpeta._id}`, carpeta);
    for (const origen of documentos) {
      const doc = structuredClone(origen);
      for (const coleccion of EMBEBIDOS[pack.type] ?? []) {
        const filas = doc[coleccion];
        if (!Array.isArray(filas)) continue;
        // El padre guarda solo los ids; cada hijo va en su propia clave.
        doc[coleccion] = filas.map(f => f._id);
        for (const fila of filas) await db.put(`!${raiz}.${coleccion}!${doc._id}.${fila._id}`, fila);
      }
      await db.put(`!${raiz}!${doc._id}`, doc);
    }
    await db.close();
    console.log(`pack ${pack.name}: ${documentos.length} documentos${carpetas.length ? `, ${carpetas.length} carpetas` : ""}`);
  }
}

export { id };
