/* Ofira · Contraseñas, sesiones y límite de intentos.
 * - Contraseñas con scrypt (lento a propósito) y sal aleatoria; nunca se guardan en texto.
 * - Sesión con un token aleatorio de 256 bits; en la base solo se guarda su hash SHA-256.
 * - Cookie HttpOnly + SameSite=Strict (+ Secure con HTTPS).
 */
'use strict';
const crypto = require('node:crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DURACION_SESION = 7 * 24 * 60 * 60 * 1000;

function hashClave(clave) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(clave), sal, 64, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, sal.toString('base64'), h.toString('base64')].join('$');
}

function verificarClave(clave, guardado) {
  const partes = String(guardado || '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, N, r, p, sal, hash] = partes;
  const esperado = Buffer.from(hash, 'base64');
  const calc = crypto.scryptSync(String(clave), Buffer.from(sal, 'base64'), esperado.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return crypto.timingSafeEqual(esperado, calc);
}

/* Reglas mínimas de contraseña: 8 caracteres, al menos una letra y un número */
function claveValida(clave) {
  const c = String(clave || '');
  if (c.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (c.length > 128) return 'La contraseña es demasiado larga.';
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(c) || !/\d/.test(c)) return 'La contraseña debe tener letras y números.';
  return '';
}

const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

function crearSesion(db, cuentaId, rol) {
  const token = crypto.randomBytes(32).toString('base64url');
  const ahora = Date.now();
  db.prepare('INSERT INTO sesiones VALUES (?, ?, ?, ?, ?)').run(sha256(token), cuentaId, rol, ahora, ahora + DURACION_SESION);
  db.prepare('DELETE FROM sesiones WHERE expira < ?').run(ahora);
  return token;
}
function leerSesion(db, token) {
  if (!token || token.length > 100) return null;
  const s = db.prepare('SELECT * FROM sesiones WHERE token_hash = ? AND expira > ?').get(sha256(token), Date.now());
  return s || null;
}
function cambiarRolSesion(db, token, rol) { db.prepare('UPDATE sesiones SET rol = ? WHERE token_hash = ?').run(rol, sha256(token)); }
function cerrarSesion(db, token) { if (token) db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(sha256(token)); }
function cerrarSesionesDe(db, cuentaId, exceptoToken) {
  if (exceptoToken) db.prepare('DELETE FROM sesiones WHERE cuenta_id = ? AND token_hash <> ?').run(cuentaId, sha256(exceptoToken));
  else db.prepare('DELETE FROM sesiones WHERE cuenta_id = ?').run(cuentaId);
}

function cookieSesion(token, segura, borrar) {
  const partes = ['ofira_sid=' + (borrar ? '' : token), 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=' + (borrar ? 0 : DURACION_SESION / 1000)];
  if (segura) partes.push('Secure');
  return partes.join('; ');
}
function leerCookie(req, nombre) {
  const c = req.headers.cookie || '';
  for (const parte of c.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return '';
}

/* Límite de intentos: 5 fallos en 15 minutos por correo + IP bloquean el inicio de sesión 15 minutos */
const intentos = new Map();
const VENTANA = 15 * 60 * 1000;
function bloqueado(llave) {
  const r = intentos.get(llave);
  if (!r) return false;
  if (Date.now() - r.desde > VENTANA) { intentos.delete(llave); return false; }
  return r.n >= 5;
}
function registrarFallo(llave) {
  const r = intentos.get(llave);
  if (!r || Date.now() - r.desde > VENTANA) intentos.set(llave, { n: 1, desde: Date.now() });
  else r.n += 1;
}
function limpiarFallos(llave) { intentos.delete(llave); }

function claveTemporal() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  let t = '';
  for (let i = 0; i < 6; i++) t += letras[crypto.randomInt(letras.length)];
  return t + crypto.randomInt(1000, 9999);
}

module.exports = { hashClave, verificarClave, claveValida, crearSesion, leerSesion, cambiarRolSesion, cerrarSesion, cerrarSesionesDe, cookieSesion, leerCookie, bloqueado, registrarFallo, limpiarFallos, claveTemporal };
