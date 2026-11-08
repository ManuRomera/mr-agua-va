/**
 * Empaqueta `dist/mr-agua-va.zip` con system.json en la raíz
 * (el campo `download` de system.json apunta a ese nombre de release).
 * Solo archivos del sistema: sin material de desarrollo. Los packs deben
 * estar cerrados, así que antes corre la misma comprobación que build.mjs.
 */
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { comprobarCerrados } from "./build.mjs";

const manifiesto = JSON.parse(await fs.readFile("system.json"));
await comprobarCerrados(manifiesto.packs);

const raiz = process.cwd();
const CARPETA = `${raiz}/dist/${manifiesto.id}`;
const ZIP = `${CARPETA}.zip`;
const FUERA = ["docs", "node_modules", "tests", "scripts", "_data", "dist", "package.json", "package-lock.json", ".DS_Store", "*.log", ".git", ".github"];

await fs.rm(CARPETA, { recursive: true, force: true });
await fs.rm(ZIP, { force: true });
await fs.mkdir(CARPETA, { recursive: true });

const sh = promisify(execFile);
const rsync = ["-a", ...FUERA.flatMap(p => ["--exclude", p]), "./", `${CARPETA}/`];
await sh("rsync", rsync);
await sh("zip", ["-r", "-q", "-X", ZIP, "."], { cwd: CARPETA });

const { size } = await fs.stat(ZIP);
const { stdout } = await sh("zipinfo", ["-1", ZIP]);
const archivos = stdout.trim().split("\n").length;
await fs.rm(CARPETA, { recursive: true, force: true });
console.log(`${ZIP}: ${archivos} archivos, ${(size / 1024 / 1024).toFixed(1)} MB · v${manifiesto.version}`);
