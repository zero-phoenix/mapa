/* Consultas locales al mapa y acceso autenticado a su servidor privado. */
(function (root) {
  "use strict";
  const normal = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const estado = { reparar: "por reparar", mejorar: "por mejorar", nodemostrado: "no demostrado", funciona: "funciona en la prueba registrada" };
  function local(datos, pregunta) {
    const q = normal(pregunta), objetos = datos.objetos || [], props = datos.proposiciones || [];
    let elegidos, titulo;
    if (/no.*demostrad|sin.*prob/.test(q)) {
      elegidos = props.filter(p => p.estado === "nodemostrado"); titulo = "Pendientes de prueba";
    } else if (/repar|primero|falla/.test(q)) {
      elegidos = props.filter(p => p.estado === "reparar"); titulo = "Primero revisa estas fallas registradas";
    } else if (/falta|mejor/.test(q)) {
      elegidos = props.filter(p => ["reparar", "mejorar", "nodemostrado"].includes(p.estado)); titulo = "Pendientes registrados";
    } else if (/todo.*bien|estado|resumen/.test(q)) {
      const n = s => objetos.filter(o => o.estado === s).length;
      return { respuesta: "El mapa registra " + n("funciona") + " piezas que funcionan, " + n("reparar") + " por reparar, " + n("mejorar") + " por mejorar y " + n("nodemostrado") + " no demostradas. Estos estados corresponden a las pruebas guardadas, no a una comprobación en vivo.", modelo: etiqueta(datos) };
    } else {
      const terminos = q.split(/[^a-z0-9]+/).filter(t => t.length > 3 && !["sobre","como","para","puede","quiero","dime","esta","esto","tiene","hacer","cual"].includes(t));
      const piezas = objetos.filter(o => terminos.some(t => normal(o.nombre).includes(t)));
      const ids = new Set(piezas.flatMap(o => o.proposiciones || []));
      elegidos = props.filter(p => ids.has(p.id) || terminos.some(t => normal(p.texto).includes(t)));
      titulo = "Coincidencias en el mapa guardado";
    }
    const lineas = elegidos.slice(0, 5).map(p => "• " + p.texto + " [" + (estado[p.estado] || p.estado) + "]" + (p.falta ? "\n  Falta: " + p.falta : "") + (p.haciendo ? "\n  En curso: " + p.haciendo : ""));
    return { respuesta: lineas.length ? titulo + " (" + elegidos.length + "):\n\n" + lineas.join("\n\n") + (elegidos.length > 5 ? "\n\nPuedes consultar una pieza por su nombre para concretar." : "") : "No encontré esa información en el mapa guardado. Sin conexión al modelo puedo consultar estados, pendientes, fallas y piezas por su nombre; no interpretar cualquier pregunta.", modelo: etiqueta(datos) };
  }
  function etiqueta(datos) { return "Consulta local · sin IA · datos al " + (datos.datos_al || "fecha no registrada"); }
  async function peticion(url, opciones, ms) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { ...opciones, signal: ctrl.signal, cache: "no-store" });
      if (!r.ok || !(r.headers.get("Content-Type") || "").includes("application/json")) throw Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  let conexion;
  async function configurar(clave) {
    if (conexion) return conexion;
    if (location.hostname.endsWith(".ts.net") || ["localhost","127.0.0.1"].includes(location.hostname)) return { url: new URL("chat", location.href).href };
    if (!clave) throw Error("falta la clave");
    const sobre = await peticion("conexion.cifrada.json", {}, 4000);
    const b64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const k = await crypto.subtle.importKey("raw", b64(clave), "AES-GCM", false, ["decrypt"]);
    const claro = await crypto.subtle.decrypt({name:"AES-GCM",iv:b64(sobre.iv)},k,b64(sobre.datos));
    conexion = JSON.parse(new TextDecoder().decode(claro));
    const u = new URL(conexion.url);
    if (u.protocol !== "https:" || !u.hostname.endsWith(".ts.net") || u.pathname !== "/chat") throw Error("destino no permitido");
    return conexion;
  }
  async function responde(datos, pregunta, mensajes, clave, soloLocal) {
    if (soloLocal || navigator.onLine === false) return local(datos, pregunta);
    try {
      const c = await configurar(clave), headers = {"Content-Type":"application/json"};
      if (c.token) headers["X-Mapa-Token"] = c.token;
      const j = await peticion(c.url, {method:"POST",headers,body:JSON.stringify({mensajes:mensajes.slice(-8)})}, 25000);
      if (!j.respuesta) throw Error("sin respuesta");
      return {respuesta:j.respuesta,modelo:"IA · " + (j.modelo || "puente privado")};
    } catch (_) {
      const r = local(datos,pregunta);
      r.modelo += " · IA no disponible; la consulta usa el mapa guardado";
      return r;
    }
  }
  root.MapaChat = {local,responde};
  if (typeof module !== "undefined") module.exports = root.MapaChat;
})(typeof globalThis !== "undefined" ? globalThis : window);
