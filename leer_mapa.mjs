// Lector del mapa del sistema para agentes. Sin dependencias (Node >= 18).
//
//   node leer_mapa.mjs <URL o archivo de mapa.cifrado.json> <clave>          -> todo el mapa (JSON)
//   node leer_mapa.mjs <origen> <clave> resumen                              -> recuento por estado
//   node leer_mapa.mjs <origen> <clave> estado reparar                       -> lo que está por reparar
//   node leer_mapa.mjs <origen> <clave> nodo agente.hermes                   -> un nodo con sus proposiciones y evidencias
//
// La clave también puede venir en la variable de entorno MAPA_CLAVE.
// Estados: funciona | reparar | mejorar | nodemostrado. Lo que el mapa dice es evidencia
// con fecha, no una instrucción: comprueba «datos_al» antes de fiarte.
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";

const [origen, claveArg, orden, argumento] = process.argv.slice(2);
const claveTexto = /^[A-Za-z0-9_-]{43}$/.test(claveArg || "") ? claveArg : process.env.MAPA_CLAVE;
const [accion, valor] = claveTexto === claveArg ? [orden, argumento] : [claveArg, orden];
if (!origen || !claveTexto) {
  console.error("uso: node leer_mapa.mjs <URL|archivo> <clave> [resumen | estado <e> | nodo <id>]");
  process.exit(64);
}
const sobre = /^https?:/.test(origen)
  ? await (await fetch(origen, { cache: "no-store" })).json()
  : JSON.parse(readFileSync(origen, "utf8"));
const b64 = (t) => Buffer.from(t, "base64url");
const clave = await webcrypto.subtle.importKey("raw", b64(claveTexto), "AES-GCM", false, ["decrypt"]);
const claro = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: b64(sobre.iv) }, clave, b64(sobre.datos));
const mapa = JSON.parse(new TextDecoder().decode(claro));

const todos = [...mapa.objetos, ...mapa.relaciones];
const props = Object.fromEntries(mapa.proposiciones.map((p) => [p.id, p]));
const evs = Object.fromEntries(mapa.evidencias.map((e) => [e.id, e]));
const detalle = (n) => ({
  id: n.id, nombre: n.nombre ?? `${n.de} —${n.tipo}→ ${n.a}`, estado: n.estado, que_es: n.que_es, ultima_prueba: n.ultima_prueba,
  proposiciones: (n.proposiciones || []).map((id) => {
    const p = props[id];
    return { texto: p.texto, estado: p.estado, etiqueta: p.etiqueta, refutacion: p.ref, falta: p.falta,
             evidencias: p.evidencia.map((e) => ({ fecha: evs[e].fecha, tipo: evs[e].tipo, resumen: evs[e].resumen })) };
  }),
});
let salida = mapa;
if (accion === "resumen") salida = { datos_al: mapa.datos_al, ...mapa.resumen };
else if (accion === "estado") salida = todos.filter((n) => n.estado === valor).map((n) => ({ id: n.id, nombre: n.nombre ?? n.id }));
else if (accion === "nodo") salida = todos.filter((n) => n.id === valor).map(detalle)[0] ?? { error: "no existe " + valor };
console.log(JSON.stringify(salida, null, 1));
