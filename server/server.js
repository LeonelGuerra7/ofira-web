/* Ofira · Servidor web.
 * Node.js 22 sin librerías externas: node:http, node:sqlite, node:crypto y node:zlib.
 * Uso: node server/server.js   (variables opcionales: PORT, HOST, DATA_DIR, TRUST_PROXY=1 detrás de un proxy HTTPS,
 *      CLAVE_INICIAL = contraseña de las cuentas iniciales al crear la base por primera vez)
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const DB = require('./db');
const Auth = require('./auth');
const { vistaPara } = require('./vista');
const Acciones = require('./acciones');
const Reportes = require('./reportes');

const RAIZ = path.resolve(__dirname, '..');
const PUBLICO = path.join(RAIZ, 'public');
const DATOS = path.resolve(process.env.DATA_DIR || path.join(RAIZ, 'data'));
const ARCHIVOS = path.join(DATOS, 'archivos');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
fs.mkdirSync(ARCHIVOS, { recursive: true });

// ---------- Motor de reglas: el mismo archivo que usa el navegador ----------
function cargarMotor() {
  const ctx = { console, Date, Math, JSON };
  ctx.window = ctx;
  vm.createContext(ctx);
  ['js/data.js', 'js/store.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(PUBLICO, f), 'utf8'), ctx, { filename: f }));
  return ctx.Ofira;
}
const O = cargarMotor();
const St = O.Store;

// ---------- Base de datos ----------
const db = DB.abrir(path.join(DATOS, 'ofira.db'));
if (!DB.meta(db, 'sembrado')) {
  const S0 = O.semilla();
  // En la nube se define CLAVE_INICIAL para que las cuentas iniciales no usen la contraseña pública de prueba
  const inicial = process.env.CLAVE_INICIAL;
  if (inicial && Auth.claveValida(inicial)) { console.error('CLAVE_INICIAL no es válida: ' + Auth.claveValida(inicial)); process.exit(1); }
  S0.cuentas.forEach((c) => { c.claveHash = Auth.hashClave(inicial || c.clave); delete c.clave; });
  DB.guardarEstado(db, S0, O);
  DB.meta(db, 'sembrado', new Date().toISOString());
  console.log('Base de datos creada con los datos iniciales y los usuarios de prueba.');
}
let S = DB.cargarEstado(db, O);
St.usar(S);
let version = 1;
function persistir() { DB.guardarEstado(db, S, O); version += 1; }

// Si la base ya existía cuando se definió CLAVE_INICIAL, las cuentas que siguen con la contraseña pública de prueba pasan a usarla
if (process.env.CLAVE_INICIAL && !Auth.claveValida(process.env.CLAVE_INICIAL)) {
  const prueba = O.semilla().cuentas[0].clave;
  if (process.env.CLAVE_INICIAL === prueba) console.warn('Aviso: CLAVE_INICIAL es la contraseña pública de prueba. Usa otra para el sitio publicado.');
  const conPrueba = process.env.CLAVE_INICIAL === prueba ? [] : S.cuentas.filter((c) => Auth.verificarClave(prueba, c.claveHash));
  if (conPrueba.length) {
    conPrueba.forEach((c) => { c.claveHash = Auth.hashClave(process.env.CLAVE_INICIAL); Auth.cerrarSesionesDe(db, c.id); });
    persistir();
    console.log('CLAVE_INICIAL aplicada a ' + conPrueba.length + ' cuentas que usaban la contraseña de prueba.');
  }
}
function recargar() { S = DB.cargarEstado(db, O); St.usar(S); }
setInterval(() => { try { if (St.tick()) persistir(); } catch (e) { console.error(e); recargar(); } }, 20000).unref();

const A = Acciones.crear(O, db);
const bitacora = (cuentaId, evento, detalle, ip) => db.prepare('INSERT INTO bitacora (fecha, cuenta_id, evento, detalle, ip) VALUES (?, ?, ?, ?, ?)').run(Date.now(), cuentaId || null, evento, detalle || '', ip || '');

// ---------- Archivos estáticos (en memoria, comprimidos) ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const estaticos = new Map();
(function leerPublico(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return leerPublico(f);
    const tipo = TIPOS[path.extname(e.name)];
    if (!tipo) return;
    const cuerpo = fs.readFileSync(f);
    const ruta = '/' + path.relative(PUBLICO, f).split(path.sep).join('/');
    estaticos.set(ruta, { tipo, cuerpo, gz: zlib.gzipSync(cuerpo), etag: '"' + crypto.createHash('sha1').update(cuerpo).digest('base64url').slice(0, 20) + '"' });
  });
})(PUBLICO);

// ---------- Utilidades HTTP ----------
function cabecerasSeguridad(res, req) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (esSeguro(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}
const esSeguro = (req) => !!req.socket.encrypted || (TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https');
const ipDe = (req) => (TRUST_PROXY && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || '';

function enviar(res, req, codigo, cuerpo, tipo, extra) {
  let datos = Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo));
  const h = Object.assign({ 'Content-Type': tipo || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {});
  if (datos.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /json|text|javascript/.test(h['Content-Type'])) {
    datos = zlib.gzipSync(datos); h['Content-Encoding'] = 'gzip'; h.Vary = 'Accept-Encoding';
  }
  h['Content-Length'] = datos.length;
  res.writeHead(codigo, h);
  res.end(req.method === 'HEAD' ? undefined : datos);
}

function leerCuerpo(req, limite) {
  return new Promise((resolver, rechazar) => {
    let total = 0; const partes = [];
    req.on('data', (c) => { total += c.length; if (total > limite) { rechazar(Object.assign(new Error('demasiado grande'), { codigo: 413 })); req.destroy(); } else partes.push(c); });
    req.on('end', () => {
      try { resolver(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')); } catch (e) { rechazar(Object.assign(new Error('JSON no válido'), { codigo: 400 })); }
    });
    req.on('error', rechazar);
  });
}

/* Protección CSRF: solo se aceptan POST JSON del mismo sitio con la cabecera propia de la app */
function peticionValida(req) {
  if (req.headers['x-requested-with'] !== 'ofira') return false;
  if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return false;
  const origen = req.headers.origin;
  if (origen) { try { if (new URL(origen).host !== req.headers.host) return false; } catch (e) { return false; } }
  return true;
}

function sesionDe(req) {
  const token = Auth.leerCookie(req, 'ofira_sid');
  const s = Auth.leerSesion(db, token);
  if (!s) return null;
  const cuenta = St.cuenta(s.cuenta_id);
  if (!cuenta || cuenta.estado !== 'Activa') { Auth.cerrarSesion(db, token); return null; }
  const rol = cuenta.roles.includes(s.rol) ? s.rol : cuenta.roles[0];
  return { token, cuenta, rol };
}

const VACIO = { version: 3, clockOffset: 0, seq: {}, personas: [], cuentas: [], prestadores: [], solicitudes: [], invitaciones: [], cotizaciones: [], servicios: [], historial: [], mensajes: [], calificaciones: [], reclamos: [], notificaciones: [] };
function estadoPara(ses) {
  const base = { version, ahora: Date.now() };
  if (!ses) return Object.assign(base, { sesion: null, S: Object.assign({}, VACIO, { oficios: S.oficios, especialidades: S.especialidades }) });
  const extra = {};
  if (ses.cuenta.roles.includes('administrador')) {
    extra.recuperaciones = db.prepare('SELECT * FROM recuperaciones WHERE atendida = 0 ORDER BY id DESC').all().map((r) => ({ id: r.id, cuentaId: r.cuenta_id, creada: r.creada }));
  }
  return Object.assign(base, { sesion: { cuentaId: ses.cuenta.id, rol: ses.rol, debeCambiarClave: !!ses.cuenta.debeCambiarClave }, S: vistaPara(S, ses.cuenta, extra) });
}

function limpiarResultado(r) {
  const x = { ok: !!r.ok };
  ['error', 'codigo', 'repetida', 'retenida'].forEach((k) => { if (r[k] !== undefined) x[k] = r[k]; });
  ['solicitud', 'servicio', 'cotizacion', 'reclamo'].forEach((k) => { if (r[k]) x[k] = { id: r[k].id, folio: r[k].folio }; });
  if (r.invitados) x.invitados = r.invitados.slice();
  return x;
}

// ---------- Imágenes subidas ----------
const LIMITE_IMAGEN = 3 * 1024 * 1024;
function guardarImagen(dataUrl, cuentaId, tipo) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return { ok: false, error: 'Solo se aceptan imágenes JPG, PNG o WEBP.' };
  const datos = Buffer.from(m[2], 'base64');
  if (!datos.length || datos.length > LIMITE_IMAGEN) return { ok: false, error: 'La imagen debe pesar menos de 3 MB.' };
  // Se revisa la firma real del archivo, no solo lo que dice el navegador
  const jpg = datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff;
  const png = datos.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = datos.slice(0, 4).toString('ascii') === 'RIFF' && datos.slice(8, 12).toString('ascii') === 'WEBP';
  const mime = jpg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : '';
  if (!mime) return { ok: false, error: 'El archivo no es una imagen válida.' };
  const id = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(path.join(ARCHIVOS, id), datos, { flag: 'wx' });
  db.prepare('INSERT INTO archivos VALUES (?, ?, ?, ?, ?, ?)').run(id, cuentaId, tipo, mime, datos.length, Date.now());
  return { ok: true, id };
}
const subidas = new Map();
function puedeSubir(cuentaId) {
  const ahora = Date.now(); const r = subidas.get(cuentaId);
  if (!r || ahora - r.desde > 3600000) { subidas.set(cuentaId, { n: 1, desde: ahora }); return true; }
  r.n += 1; return r.n <= 60;
}
const registros = new Map();
function puedeRegistrar(ip) {
  const ahora = Date.now(); const r = registros.get(ip);
  if (!r || ahora - r.desde > 3600000) { registros.set(ip, { n: 1, desde: ahora }); return true; }
  r.n += 1; return r.n <= 10;
}

// ---------- Rutas de la API ----------
const correoOk = (v) => /^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,}$/.test(v);
const HASH_FALSO = Auth.hashClave('no-existe-' + crypto.randomBytes(8).toString('hex'));

const API = {
  async 'POST /api/login'(req, res, d) {
    const correo = String(d.correo || '').trim().toLowerCase().slice(0, 120); const clave = String(d.clave || '').slice(0, 128);
    const ip = ipDe(req); const llave = ip + '|' + correo;
    if (Auth.bloqueado(llave)) return enviar(res, req, 429, { ok: false, error: 'Demasiados intentos. Espera 15 minutos o recupera tu cuenta.' });
    const cuenta = S.cuentas.find((c) => c.correo === correo);
    const valida = Auth.verificarClave(clave, cuenta ? cuenta.claveHash : HASH_FALSO) && !!cuenta;
    if (!valida) { Auth.registrarFallo(llave); bitacora(cuenta && cuenta.id, 'login-fallido', correo, ip); return enviar(res, req, 401, { ok: false, error: 'El correo o la contraseña no coinciden.' }); }
    if (cuenta.estado !== 'Activa') return enviar(res, req, 403, { ok: false, error: 'Esta cuenta está suspendida. Escribe a soporte para revisarla.' });
    Auth.limpiarFallos(llave);
    const token = Auth.crearSesion(db, cuenta.id, cuenta.roles[0]);
    bitacora(cuenta.id, 'login', '', ip);
    enviar(res, req, 200, Object.assign({ ok: true }, estadoPara({ token, cuenta, rol: cuenta.roles[0] })), null, { 'Set-Cookie': Auth.cookieSesion(token, esSeguro(req)) });
  },

  async 'POST /api/logout'(req, res, d, ses) {
    if (ses) { Auth.cerrarSesion(db, ses.token); bitacora(ses.cuenta.id, 'logout', '', ipDe(req)); }
    enviar(res, req, 200, Object.assign({ ok: true }, estadoPara(null)), null, { 'Set-Cookie': Auth.cookieSesion('', esSeguro(req), true) });
  },

  async 'POST /api/registro'(req, res, d) {
    const ip = ipDe(req);
    if (!puedeRegistrar(ip)) return enviar(res, req, 429, { ok: false, error: 'Demasiados registros desde esta conexión. Intenta más tarde.' });
    const nombre = String(d.nombre || '').trim().slice(0, 80); const telefono = String(d.telefono || '').trim().replace(/^(\d{4})(\d{4})$/, '$1-$2');
    const correo = String(d.correo || '').trim().toLowerCase().slice(0, 120);
    const e = {};
    if (nombre.length < 5) e.nombre = 'Escribe tu nombre y apellido.';
    if (!/^\d{4}-\d{4}$/.test(telefono)) e.telefono = 'Escribe 8 dígitos, por ejemplo 5555-1234.';
    if (!correoOk(correo)) e.correo = 'Escribe un correo válido.';
    const errClave = Auth.claveValida(d.clave); if (errClave) e.clave = errClave;
    if (!O.SECTORES.some((s) => s.id === d.sectorId)) e.sectorId = 'Elige tu sector.';
    const prestador = !!d.prestador;
    if (prestador) {
      const o = St.oficio(d.oficioId);
      if (!o || !o.activo) e.oficioId = 'Elige tu oficio.';
      const exp = Number(d.experiencia); if (!(exp >= 0 && exp <= 60)) e.experiencia = 'Escribe tus años de experiencia.';
      if (String(d.referencia || '').trim().length < 5) e.referencia = 'Escribe una referencia de trabajo.';
      if (!d.dpiFoto) e.dpiFoto = 'Adjunta la foto de tu DPI.';
    }
    if (Object.keys(e).length) return enviar(res, req, 400, { ok: false, error: 'Revisa los datos marcados.', campos: e });
    const r = St.registrar({ nombre, telefono, correo, claveHash: Auth.hashClave(d.clave), sectorId: d.sectorId, prestador, oficioId: d.oficioId,
      experiencia: Number(d.experiencia) || 0, referencia: String(d.referencia || '').trim().slice(0, 150) });
    if (!r.ok) { recargar(); return enviar(res, req, 409, { ok: false, error: r.error }); }
    if (prestador) {
      const img = guardarImagen(d.dpiFoto, r.cuenta.id, 'dpi');
      if (!img.ok) { recargar(); return enviar(res, req, 400, { ok: false, error: img.error, campos: { dpiFoto: img.error } }); }
      St.prestadorDeCuenta(r.cuenta.id).dpiArchivo = img.id;
    }
    persistir();
    bitacora(r.cuenta.id, 'registro', prestador ? 'cliente y prestador' : 'cliente', ip);
    const cuenta = St.cuenta(r.cuenta.id);
    const token = Auth.crearSesion(db, cuenta.id, 'cliente');
    enviar(res, req, 200, Object.assign({ ok: true }, estadoPara({ token, cuenta, rol: 'cliente' })), null, { 'Set-Cookie': Auth.cookieSesion(token, esSeguro(req)) });
  },

  /* Recuperación: no se revela si la cuenta existe. Administración restablece la contraseña y la entrega a la persona. */
  async 'POST /api/recuperar'(req, res, d) {
    const dato = String(d.dato || '').trim().toLowerCase().slice(0, 120);
    const cuenta = S.cuentas.find((c) => c.correo === dato || St.persona(c.personaId).telefono === dato.replace(/^(\d{4})(\d{4})$/, '$1-$2'));
    if (cuenta && !db.prepare('SELECT 1 FROM recuperaciones WHERE cuenta_id = ? AND atendida = 0').get(cuenta.id)) {
      db.prepare('INSERT INTO recuperaciones (cuenta_id, creada) VALUES (?, ?)').run(cuenta.id, Date.now());
      St.notificarRol('administrador', 'Solicitud de recuperación de cuenta', St.nombre(cuenta.id) + ' pidió restablecer su contraseña. Verifica su identidad por teléfono.', 'a/cuentas');
      persistir();
      bitacora(cuenta.id, 'recuperacion-solicitada', '', ipDe(req));
    }
    enviar(res, req, 200, { ok: true });
  },

  async 'POST /api/clave'(req, res, d, ses) {
    if (!ses) return enviar(res, req, 401, { ok: false, error: 'Inicia sesión de nuevo.' });
    const cuenta = ses.cuenta;
    if (!cuenta.debeCambiarClave && !Auth.verificarClave(String(d.actual || ''), cuenta.claveHash)) return enviar(res, req, 400, { ok: false, error: 'La contraseña actual no coincide.', campos: { actual: 'La contraseña actual no coincide.' } });
    const err = Auth.claveValida(d.nueva); if (err) return enviar(res, req, 400, { ok: false, error: err, campos: { nueva: err } });
    if (Auth.verificarClave(String(d.nueva), cuenta.claveHash)) return enviar(res, req, 400, { ok: false, error: 'La nueva contraseña debe ser distinta a la anterior.', campos: { nueva: 'Debe ser distinta a la anterior.' } });
    cuenta.claveHash = Auth.hashClave(d.nueva); cuenta.debeCambiarClave = false;
    persistir();
    Auth.cerrarSesionesDe(db, cuenta.id, ses.token);
    bitacora(cuenta.id, 'cambio-clave', '', ipDe(req));
    enviar(res, req, 200, Object.assign({ ok: true }, estadoPara(ses)));
  },

  async 'POST /api/rol'(req, res, d, ses) {
    if (!ses) return enviar(res, req, 401, { ok: false, error: 'Inicia sesión de nuevo.' });
    if (!ses.cuenta.roles.includes(d.rol)) return enviar(res, req, 403, { ok: false, error: 'Tu cuenta no tiene ese rol.' });
    Auth.cambiarRolSesion(db, ses.token, d.rol);
    enviar(res, req, 200, Object.assign({ ok: true }, estadoPara(Object.assign({}, ses, { rol: d.rol }))));
  },

  async 'POST /api/archivo'(req, res, d, ses) {
    if (!ses) return enviar(res, req, 401, { ok: false, error: 'Inicia sesión de nuevo.' });
    if (!puedeSubir(ses.cuenta.id)) return enviar(res, req, 429, { ok: false, error: 'Subiste demasiadas fotos. Intenta en una hora.' });
    const r = guardarImagen(d.datos, ses.cuenta.id, 'foto');
    enviar(res, req, r.ok ? 200 : 400, r);
  },

  async 'POST /api/accion'(req, res, d, ses) {
    if (!ses) return enviar(res, req, 401, { ok: false, error: 'Tu sesión terminó. Inicia sesión de nuevo.', codigo: 'sesion' });
    if (ses.cuenta.debeCambiarClave) return enviar(res, req, 403, { ok: false, error: 'Primero cambia tu contraseña temporal.', codigo: 'clave' });
    const def = A[d.nombre];
    if (!def) return enviar(res, req, 404, { ok: false, error: 'Acción desconocida.' });
    if (!def.roles.some((r) => ses.cuenta.roles.includes(r))) return enviar(res, req, 403, { ok: false, error: 'No tienes permiso para hacer esto.', codigo: 'permiso' });
    let r;
    try {
      St.tick();
      r = def.fn(ses.cuenta, Array.isArray(d.args) ? d.args : []);
      persistir();
    } catch (e) {
      console.error('Error en la acción', d.nombre, e);
      recargar();
      return enviar(res, req, 500, { ok: false, error: 'No se pudo completar. Intenta de nuevo.' });
    }
    enviar(res, req, 200, { resultado: limpiarResultado(r), estado: estadoPara(sesionDe(req)) });
  },

  async 'POST /api/admin/restablecer'(req, res, d, ses) {
    if (!ses || !ses.cuenta.roles.includes('administrador')) return enviar(res, req, 403, { ok: false, error: 'No tienes permiso.' });
    const cuenta = St.cuenta(String(d.cuentaId || ''));
    if (!cuenta || cuenta.id === ses.cuenta.id) return enviar(res, req, 400, { ok: false, error: 'Cuenta no válida.' });
    const temporal = Auth.claveTemporal();
    cuenta.claveHash = Auth.hashClave(temporal); cuenta.debeCambiarClave = true;
    persistir();
    Auth.cerrarSesionesDe(db, cuenta.id);
    db.prepare('UPDATE recuperaciones SET atendida = 1 WHERE cuenta_id = ?').run(cuenta.id);
    bitacora(cuenta.id, 'clave-restablecida', 'por ' + ses.cuenta.id, ipDe(req));
    enviar(res, req, 200, Object.assign({ ok: true, temporal }, estadoPara(ses)));
  }
};

// ---------- Servidor ----------
const servidor = http.createServer(async (req, res) => {
  cabecerasSeguridad(res, req);
  const url = new URL(req.url, 'http://local');
  const ruta = url.pathname;
  try {
    if (req.method === 'GET' && ruta === '/api/estado') {
      const ses = sesionDe(req);
      if (St.tick()) persistir();
      const v = Number(url.searchParams.get('v'));
      const quien = ses ? ses.cuenta.id + '|' + ses.rol : '-';
      if (v === version && url.searchParams.get('q') === quien) return enviar(res, req, 200, { sinCambios: true, version, ahora: Date.now() });
      return enviar(res, req, 200, Object.assign(estadoPara(ses), { quien }));
    }
    if (req.method === 'GET' && ruta === '/api/reporte') {
      const ses = sesionDe(req);
      if (!ses || !ses.cuenta.roles.includes('administrador') || ses.cuenta.debeCambiarClave) return enviar(res, req, 403, 'Solo administración puede descargar reportes.', 'text/plain; charset=utf-8');
      St.tick();
      const r = Reportes.generar(O, St, url.searchParams.get('tipo'), url.searchParams.get('formato'), url.searchParams.get('estado'), St.nombre(ses.cuenta.id));
      if (!r) return enviar(res, req, 404, 'Reporte no encontrado.', 'text/plain; charset=utf-8');
      bitacora(ses.cuenta.id, 'reporte', r.nombre, ipDe(req));
      return enviar(res, req, 200, r.datos, r.tipo, { 'Content-Disposition': 'attachment; filename="' + r.nombre + '"' });
    }
    if (req.method === 'GET' && ruta.startsWith('/archivo/')) {
      const ses = sesionDe(req);
      const id = ruta.slice(9);
      if (!ses || !/^[a-f0-9]{32}$/.test(id)) return enviar(res, req, 404, 'No encontrado', 'text/plain; charset=utf-8');
      const a = db.prepare('SELECT * FROM archivos WHERE id = ?').get(id);
      if (!a) return enviar(res, req, 404, 'No encontrado', 'text/plain; charset=utf-8');
      if (a.tipo === 'dpi' && a.cuenta_id !== ses.cuenta.id && !ses.cuenta.roles.includes('administrador')) return enviar(res, req, 403, 'Sin permiso', 'text/plain; charset=utf-8');
      return enviar(res, req, 200, fs.readFileSync(path.join(ARCHIVOS, id)), a.mime, { 'Cache-Control': 'private, max-age=86400', 'Content-Disposition': 'inline' });
    }
    if (req.method === 'POST' && ruta.startsWith('/api/')) {
      if (!peticionValida(req)) return enviar(res, req, 403, { ok: false, error: 'Petición no permitida.' });
      const fn = API['POST ' + ruta];
      if (!fn) return enviar(res, req, 404, { ok: false, error: 'No encontrado.' });
      const datos = await leerCuerpo(req, ruta === '/api/archivo' || ruta === '/api/registro' ? 5 * 1024 * 1024 : 200 * 1024);
      return await fn(req, res, datos || {}, sesionDe(req));
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const f = estaticos.get(ruta === '/' ? '/index.html' : ruta);
      if (!f) return enviar(res, req, 404, 'Página no encontrada', 'text/plain; charset=utf-8');
      if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, { ETag: f.etag }); return res.end(); }
      const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      const cuerpo = gz ? f.gz : f.cuerpo;
      res.writeHead(200, Object.assign({ 'Content-Type': f.tipo, 'Content-Length': cuerpo.length, ETag: f.etag, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' }, gz ? { 'Content-Encoding': 'gzip' } : {}));
      return res.end(req.method === 'HEAD' ? undefined : cuerpo);
    }
    enviar(res, req, 405, { ok: false, error: 'Método no permitido.' });
  } catch (e) {
    if (e.codigo) return enviar(res, req, e.codigo, { ok: false, error: e.codigo === 413 ? 'El archivo es demasiado grande.' : 'Petición no válida.' });
    console.error(e);
    enviar(res, req, 500, { ok: false, error: 'Error interno. Intenta de nuevo.' });
  }
});
servidor.requestTimeout = 30000;
servidor.headersTimeout = 15000;
servidor.listen(PORT, HOST, () => {
  console.log('Ofira está funcionando en http://localhost:' + PORT);
  const red = Object.values(require('node:os').networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => 'http://' + i.address + ':' + PORT);
  if (red.length) console.log('Desde otro dispositivo en la misma red WiFi: ' + red.join('  '));
});
