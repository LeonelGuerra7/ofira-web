/* Ofira · Base de datos SQLite (incluida en Node 22, sin librerías externas).
 * Las tablas siguen el modelo entidad-relación del proyecto. El motor de reglas trabaja con objetos
 * en memoria; aquí se cargan desde las tablas y se guardan de vuelta dentro de una transacción.
 */
'use strict';
const { DatabaseSync } = require('node:sqlite');

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contadores (tipo TEXT PRIMARY KEY, valor INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sectores (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, zona TEXT NOT NULL CHECK (zona IN ('Casco urbano', 'Aldea')));
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, telefono TEXT NOT NULL UNIQUE, dpi TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS cuentas (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL UNIQUE REFERENCES personas(id) DEFERRABLE INITIALLY DEFERRED,
  correo TEXT NOT NULL UNIQUE, clave_hash TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('Activa', 'Suspendida')),
  sector_id TEXT REFERENCES sectores(id) DEFERRABLE INITIALLY DEFERRED,
  debe_cambiar_clave INTEGER NOT NULL DEFAULT 0, creada INTEGER NOT NULL,
  dir_guardada TEXT NOT NULL DEFAULT '', ref_guardada TEXT NOT NULL DEFAULT '',
  lat REAL CHECK (lat IS NULL OR lat BETWEEN -90 AND 90), lng REAL CHECK (lng IS NULL OR lng BETWEEN -180 AND 180));
CREATE TABLE IF NOT EXISTS cuenta_roles (
  cuenta_id TEXT NOT NULL REFERENCES cuentas(id) DEFERRABLE INITIALLY DEFERRED,
  rol TEXT NOT NULL CHECK (rol IN ('cliente', 'prestador', 'administrador', 'soporte')),
  PRIMARY KEY (cuenta_id, rol));
CREATE TABLE IF NOT EXISTS oficios (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL UNIQUE, icono TEXT NOT NULL,
  activo INTEGER NOT NULL CHECK (activo IN (0, 1)), en_prototipo INTEGER NOT NULL CHECK (en_prototipo IN (0, 1)));
CREATE TABLE IF NOT EXISTS oficio_modalidades (
  oficio_id TEXT NOT NULL REFERENCES oficios(id) DEFERRABLE INITIALLY DEFERRED,
  modalidad TEXT NOT NULL CHECK (modalidad IN ('inmediata', 'programada', 'diagnostico', 'presupuesto')),
  PRIMARY KEY (oficio_id, modalidad));
CREATE TABLE IF NOT EXISTS especialidades (
  id TEXT PRIMARY KEY, oficio_id TEXT NOT NULL REFERENCES oficios(id) DEFERRABLE INITIALLY DEFERRED,
  nombre TEXT NOT NULL, UNIQUE (oficio_id, nombre));
CREATE TABLE IF NOT EXISTS prestadores (
  id TEXT PRIMARY KEY,
  cuenta_id TEXT NOT NULL UNIQUE REFERENCES cuentas(id) DEFERRABLE INITIALLY DEFERRED,
  oficio_id TEXT NOT NULL REFERENCES oficios(id) DEFERRABLE INITIALLY DEFERRED,
  experiencia INTEGER NOT NULL DEFAULT 0 CHECK (experiencia BETWEEN 0 AND 60),
  descripcion TEXT NOT NULL DEFAULT '', condiciones TEXT NOT NULL DEFAULT '',
  disponible_ahora INTEGER NOT NULL DEFAULT 0,
  estado_verificacion TEXT NOT NULL CHECK (estado_verificacion IN ('Pendiente de revisión', 'Verificado', 'Observado', 'Suspendido')),
  referencia TEXT NOT NULL DEFAULT '', costo_visita REAL NOT NULL DEFAULT 0 CHECK (costo_visita >= 0),
  alta INTEGER NOT NULL, dpi_archivo TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS prestador_especialidades (
  prestador_id TEXT NOT NULL REFERENCES prestadores(id) DEFERRABLE INITIALLY DEFERRED,
  especialidad_id TEXT NOT NULL REFERENCES especialidades(id) DEFERRABLE INITIALLY DEFERRED,
  precio_desde REAL CHECK (precio_desde IS NULL OR precio_desde > 0),
  PRIMARY KEY (prestador_id, especialidad_id));
CREATE TABLE IF NOT EXISTS coberturas (
  prestador_id TEXT NOT NULL REFERENCES prestadores(id) DEFERRABLE INITIALLY DEFERRED,
  sector_id TEXT NOT NULL REFERENCES sectores(id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (prestador_id, sector_id));
CREATE TABLE IF NOT EXISTS disponibilidad (
  prestador_id TEXT NOT NULL REFERENCES prestadores(id) DEFERRABLE INITIALLY DEFERRED,
  dia INTEGER NOT NULL CHECK (dia BETWEEN 0 AND 6),
  franja TEXT NOT NULL CHECK (franja IN ('manana', 'tarde', 'noche')),
  PRIMARY KEY (prestador_id, dia, franja));
CREATE TABLE IF NOT EXISTS galeria (
  prestador_id TEXT NOT NULL REFERENCES prestadores(id) DEFERRABLE INITIALLY DEFERRED,
  orden INTEGER NOT NULL, archivo_id TEXT NOT NULL, descripcion TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (prestador_id, orden));
CREATE TABLE IF NOT EXISTS solicitudes (
  id TEXT PRIMARY KEY, folio TEXT NOT NULL UNIQUE,
  cliente_cuenta_id TEXT NOT NULL REFERENCES cuentas(id) DEFERRABLE INITIALLY DEFERRED,
  oficio_id TEXT NOT NULL REFERENCES oficios(id) DEFERRABLE INITIALLY DEFERRED,
  especialidad_id TEXT REFERENCES especialidades(id) DEFERRABLE INITIALLY DEFERRED,
  modalidad TEXT NOT NULL CHECK (modalidad IN ('inmediata', 'programada', 'diagnostico', 'presupuesto')),
  descripcion TEXT NOT NULL, medidas TEXT NOT NULL DEFAULT '',
  sector_id TEXT NOT NULL REFERENCES sectores(id) DEFERRABLE INITIALLY DEFERRED,
  direccion TEXT NOT NULL, referencia TEXT NOT NULL DEFAULT '',
  horario_tipo TEXT NOT NULL CHECK (horario_tipo IN ('ahora', 'programado')), horario_fecha TEXT, horario_franja TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('Solicitada', 'En evaluación', 'Pendiente de aprobación', 'Confirmada', 'Vencida', 'Cancelada')),
  creada INTEGER NOT NULL, clave TEXT NOT NULL UNIQUE,
  ubic_lat REAL CHECK (ubic_lat IS NULL OR ubic_lat BETWEEN -90 AND 90),
  ubic_lng REAL CHECK (ubic_lng IS NULL OR ubic_lng BETWEEN -180 AND 180), ubic_precision REAL);
CREATE TABLE IF NOT EXISTS solicitud_fotos (
  solicitud_id TEXT NOT NULL REFERENCES solicitudes(id) DEFERRABLE INITIALLY DEFERRED,
  orden INTEGER NOT NULL, archivo_id TEXT NOT NULL, PRIMARY KEY (solicitud_id, orden));
CREATE TABLE IF NOT EXISTS invitaciones (
  id TEXT PRIMARY KEY,
  solicitud_id TEXT NOT NULL REFERENCES solicitudes(id) DEFERRABLE INITIALLY DEFERRED,
  prestador_id TEXT NOT NULL REFERENCES prestadores(id) DEFERRABLE INITIALLY DEFERRED,
  estado TEXT NOT NULL CHECK (estado IN ('Pendiente', 'Aceptada', 'Rechazada', 'Vencida', 'Anulada')),
  enviada INTEGER NOT NULL, vence_en INTEGER NOT NULL, respondida INTEGER, motivo TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS cotizaciones (
  id TEXT PRIMARY KEY, folio TEXT NOT NULL UNIQUE,
  solicitud_id TEXT NOT NULL REFERENCES solicitudes(id) DEFERRABLE INITIALLY DEFERRED,
  servicio_id TEXT REFERENCES servicios(id) DEFERRABLE INITIALLY DEFERRED,
  prestador_id TEXT NOT NULL REFERENCES prestadores(id) DEFERRABLE INITIALLY DEFERRED,
  tipo TEXT NOT NULL CHECK (tipo IN ('visita', 'trabajo', 'adicional')),
  nota TEXT NOT NULL DEFAULT '', tiempo_estimado TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL CHECK (estado IN ('Borrador', 'Enviada', 'Aprobada', 'Rechazada', 'Vencida', 'Anulada')),
  creada INTEGER NOT NULL, enviada INTEGER, vence_en INTEGER);
CREATE TABLE IF NOT EXISTS cotizacion_detalle (
  cotizacion_id TEXT NOT NULL REFERENCES cotizaciones(id) DEFERRABLE INITIALLY DEFERRED,
  linea INTEGER NOT NULL, categoria TEXT NOT NULL CHECK (categoria IN ('mano_obra', 'materiales', 'cargos')),
  concepto TEXT NOT NULL, monto REAL NOT NULL CHECK (monto >= 0), PRIMARY KEY (cotizacion_id, linea));
CREATE TABLE IF NOT EXISTS servicios (
  id TEXT PRIMARY KEY, folio TEXT NOT NULL UNIQUE,
  solicitud_id TEXT NOT NULL UNIQUE REFERENCES solicitudes(id) DEFERRABLE INITIALLY DEFERRED,
  cliente_cuenta_id TEXT NOT NULL REFERENCES cuentas(id) DEFERRABLE INITIALLY DEFERRED,
  prestador_id TEXT NOT NULL REFERENCES prestadores(id) DEFERRABLE INITIALLY DEFERRED,
  cotizacion_id TEXT NOT NULL REFERENCES cotizaciones(id) DEFERRABLE INITIALLY DEFERRED,
  estado TEXT NOT NULL CHECK (estado IN ('Confirmado', 'En ejecución', 'Finalizado', 'Cancelado')),
  creado INTEGER NOT NULL, fecha TEXT NOT NULL, franja TEXT NOT NULL,
  pago_estado TEXT NOT NULL CHECK (pago_estado IN ('Pendiente', 'Pagado')), pago_metodo TEXT NOT NULL DEFAULT '', pago_fecha INTEGER,
  finalizado INTEGER, solo_visita INTEGER NOT NULL DEFAULT 0, motivo_cancelacion TEXT NOT NULL DEFAULT '',
  en_camino_fecha INTEGER, en_camino_minutos INTEGER);
CREATE TABLE IF NOT EXISTS avances (
  servicio_id TEXT NOT NULL REFERENCES servicios(id) DEFERRABLE INITIALLY DEFERRED,
  orden INTEGER NOT NULL, fecha INTEGER NOT NULL, texto TEXT NOT NULL, PRIMARY KEY (servicio_id, orden));
CREATE TABLE IF NOT EXISTS historial (
  id TEXT PRIMARY KEY, objeto TEXT NOT NULL CHECK (objeto IN ('Solicitud', 'Cotización', 'Servicio', 'Reclamo', 'Prestador')),
  objeto_id TEXT NOT NULL, estado TEXT NOT NULL, fecha INTEGER NOT NULL, actor TEXT NOT NULL, nota TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS ix_historial_objeto ON historial (objeto, objeto_id);
CREATE TABLE IF NOT EXISTS mensajes (
  id TEXT PRIMARY KEY,
  solicitud_id TEXT NOT NULL REFERENCES solicitudes(id) DEFERRABLE INITIALLY DEFERRED,
  prestador_id TEXT NOT NULL REFERENCES prestadores(id) DEFERRABLE INITIALLY DEFERRED,
  de_cuenta_id TEXT NOT NULL REFERENCES cuentas(id) DEFERRABLE INITIALLY DEFERRED,
  texto TEXT NOT NULL, foto TEXT NOT NULL DEFAULT '', fecha INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS calificaciones (
  id TEXT PRIMARY KEY,
  servicio_id TEXT NOT NULL REFERENCES servicios(id) DEFERRABLE INITIALLY DEFERRED,
  de_cuenta_id TEXT NOT NULL REFERENCES cuentas(id) DEFERRABLE INITIALLY DEFERRED,
  a_cuenta_id TEXT NOT NULL REFERENCES cuentas(id) DEFERRABLE INITIALLY DEFERRED,
  estrellas INTEGER NOT NULL CHECK (estrellas BETWEEN 1 AND 5), comentario TEXT NOT NULL DEFAULT '',
  fecha INTEGER NOT NULL, publicada INTEGER NOT NULL CHECK (publicada IN (0, 1)),
  UNIQUE (servicio_id, de_cuenta_id));
CREATE TABLE IF NOT EXISTS reclamos (
  id TEXT PRIMARY KEY, folio TEXT NOT NULL UNIQUE,
  servicio_id TEXT NOT NULL REFERENCES servicios(id) DEFERRABLE INITIALLY DEFERRED,
  abierto_por TEXT NOT NULL REFERENCES cuentas(id) DEFERRABLE INITIALLY DEFERRED,
  motivo TEXT NOT NULL, descripcion TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('Abierto', 'En revisión', 'Resuelto', 'Cerrado')),
  creado INTEGER NOT NULL, resolucion TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS reclamo_evidencias (
  reclamo_id TEXT NOT NULL REFERENCES reclamos(id) DEFERRABLE INITIALLY DEFERRED,
  orden INTEGER NOT NULL, archivo_id TEXT NOT NULL, PRIMARY KEY (reclamo_id, orden));
CREATE TABLE IF NOT EXISTS reclamo_notas (
  reclamo_id TEXT NOT NULL REFERENCES reclamos(id) DEFERRABLE INITIALLY DEFERRED,
  orden INTEGER NOT NULL, fecha INTEGER NOT NULL, texto TEXT NOT NULL, actor TEXT NOT NULL, PRIMARY KEY (reclamo_id, orden));
CREATE TABLE IF NOT EXISTS notificaciones (
  id TEXT PRIMARY KEY, cuenta_id TEXT NOT NULL REFERENCES cuentas(id) DEFERRABLE INITIALLY DEFERRED,
  titulo TEXT NOT NULL, texto TEXT NOT NULL, fecha INTEGER NOT NULL, leida INTEGER NOT NULL DEFAULT 0, ir TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS ix_notificaciones_cuenta ON notificaciones (cuenta_id);

-- Tablas fuera del motor de reglas
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash TEXT PRIMARY KEY, cuenta_id TEXT NOT NULL, rol TEXT NOT NULL, creada INTEGER NOT NULL, expira INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS archivos (
  id TEXT PRIMARY KEY, cuenta_id TEXT NOT NULL, tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'dpi')),
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')), tamano INTEGER NOT NULL, creado INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS recuperaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cuenta_id TEXT NOT NULL, creada INTEGER NOT NULL, atendida INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS bitacora (
  id INTEGER PRIMARY KEY AUTOINCREMENT, fecha INTEGER NOT NULL, cuenta_id TEXT, evento TEXT NOT NULL, detalle TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '');
`;

/* Agrega columnas nuevas a una base de datos creada con una versión anterior */
function migrar(db) {
  const nuevas = [
    ['cuentas', 'dir_guardada', "TEXT NOT NULL DEFAULT ''"], ['cuentas', 'ref_guardada', "TEXT NOT NULL DEFAULT ''"],
    ['cuentas', 'lat', 'REAL'], ['cuentas', 'lng', 'REAL'],
    ['solicitudes', 'ubic_lat', 'REAL'], ['solicitudes', 'ubic_lng', 'REAL'], ['solicitudes', 'ubic_precision', 'REAL']
  ];
  nuevas.forEach(([t, c, def]) => {
    if (!db.prepare('PRAGMA table_info(' + t + ')').all().some((x) => x.name === c)) db.exec('ALTER TABLE ' + t + ' ADD COLUMN ' + c + ' ' + def);
  });
}

function abrir(ruta) {
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(ESQUEMA);
  migrar(db);
  return db;
}

const b = (v) => (v ? 1 : 0);
const n = (v) => (v === undefined ? null : v);

/* Lee todas las tablas y arma el estado con la forma que usa el motor de reglas */
function cargarEstado(db, O) {
  const todo = (sql) => db.prepare(sql).all();
  const agrupar = (filas, llave) => {
    const m = new Map();
    filas.forEach((f) => { if (!m.has(f[llave])) m.set(f[llave], []); m.get(f[llave]).push(f); });
    return m;
  };
  const roles = agrupar(todo('SELECT * FROM cuenta_roles ORDER BY rol'), 'cuenta_id');
  const mods = agrupar(todo('SELECT * FROM oficio_modalidades'), 'oficio_id');
  const pEsp = agrupar(todo('SELECT * FROM prestador_especialidades ORDER BY rowid'), 'prestador_id');
  const cob = agrupar(todo('SELECT * FROM coberturas ORDER BY rowid'), 'prestador_id');
  const disp = agrupar(todo('SELECT * FROM disponibilidad'), 'prestador_id');
  const gal = agrupar(todo('SELECT * FROM galeria ORDER BY orden'), 'prestador_id');
  const fotos = agrupar(todo('SELECT * FROM solicitud_fotos ORDER BY orden'), 'solicitud_id');
  const det = agrupar(todo('SELECT * FROM cotizacion_detalle ORDER BY linea'), 'cotizacion_id');
  const av = agrupar(todo('SELECT * FROM avances ORDER BY orden'), 'servicio_id');
  const evi = agrupar(todo('SELECT * FROM reclamo_evidencias ORDER BY orden'), 'reclamo_id');
  const notas = agrupar(todo('SELECT * FROM reclamo_notas ORDER BY orden'), 'reclamo_id');
  const ordenMod = ['inmediata', 'programada', 'diagnostico', 'presupuesto'];
  const seq = { SOL: 0, COT: 0, SRV: 0, REC: 0, id: 1000 };
  todo('SELECT * FROM contadores').forEach((c) => { seq[c.tipo] = c.valor; });

  return {
    version: 3, clockOffset: 0, seq,
    oficios: todo('SELECT * FROM oficios ORDER BY rowid').map((o) => ({
      id: o.id, nombre: o.nombre, icono: o.icono, activo: !!o.activo, enPrototipo: !!o.en_prototipo,
      modalidades: (mods.get(o.id) || []).map((m) => m.modalidad).sort((a, c) => ordenMod.indexOf(a) - ordenMod.indexOf(c))
    })),
    especialidades: todo('SELECT * FROM especialidades ORDER BY rowid').map((e) => ({ id: e.id, oficioId: e.oficio_id, nombre: e.nombre })),
    personas: todo('SELECT * FROM personas ORDER BY rowid').map((p) => ({ id: p.id, nombre: p.nombre, telefono: p.telefono, dpi: p.dpi })),
    cuentas: todo('SELECT * FROM cuentas ORDER BY rowid').map((c) => ({
      id: c.id, personaId: c.persona_id, correo: c.correo, claveHash: c.clave_hash, estado: c.estado, sectorId: c.sector_id,
      creada: c.creada, debeCambiarClave: !!c.debe_cambiar_clave,
      guardada: c.dir_guardada ? { direccion: c.dir_guardada, referencia: c.ref_guardada, lat: c.lat, lng: c.lng } : null, roles: (roles.get(c.id) || []).map((r) => r.rol)
        .sort((a, z) => ['cliente', 'prestador', 'administrador', 'soporte'].indexOf(a) - ['cliente', 'prestador', 'administrador', 'soporte'].indexOf(z))
    })),
    prestadores: todo('SELECT * FROM prestadores ORDER BY rowid').map((p) => {
      const d = disp.get(p.id) || [];
      const precios = {};
      (pEsp.get(p.id) || []).forEach((e) => { if (e.precio_desde) precios[e.especialidad_id] = e.precio_desde; });
      return {
        id: p.id, cuentaId: p.cuenta_id, oficioId: p.oficio_id, experiencia: p.experiencia, descripcion: p.descripcion, condiciones: p.condiciones,
        disponibleAhora: !!p.disponible_ahora, estadoVerificacion: p.estado_verificacion, referencia: p.referencia, costoVisita: p.costo_visita,
        alta: p.alta, dpiArchivo: p.dpi_archivo,
        especialidades: (pEsp.get(p.id) || []).map((e) => e.especialidad_id),
        cobertura: (cob.get(p.id) || []).map((c) => c.sector_id),
        disponibilidad: { dias: [...new Set(d.map((x) => x.dia))].sort(), franjas: O.FRANJAS.map((f) => f.id).filter((f) => d.some((x) => x.franja === f)) },
        precios, galeria: (gal.get(p.id) || []).map((g) => ({ archivo: g.archivo_id, descripcion: g.descripcion }))
      };
    }),
    solicitudes: todo('SELECT * FROM solicitudes ORDER BY rowid').map((s) => ({
      id: s.id, folio: s.folio, clienteCuentaId: s.cliente_cuenta_id, oficioId: s.oficio_id, especialidadId: s.especialidad_id, modalidad: s.modalidad,
      descripcion: s.descripcion, medidas: s.medidas, sectorId: s.sector_id, direccion: s.direccion, referencia: s.referencia,
      horario: s.horario_tipo === 'ahora' ? { tipo: 'ahora' } : { tipo: 'programado', fecha: s.horario_fecha, franja: s.horario_franja },
      fotos: (fotos.get(s.id) || []).map((f) => f.archivo_id), estado: s.estado, creada: s.creada, clave: s.clave,
      ubicacion: s.ubic_lat != null ? { lat: s.ubic_lat, lng: s.ubic_lng, precision: s.ubic_precision } : null
    })),
    invitaciones: todo('SELECT * FROM invitaciones ORDER BY rowid').map((i) => ({
      id: i.id, solicitudId: i.solicitud_id, prestadorId: i.prestador_id, estado: i.estado, enviada: i.enviada, venceEn: i.vence_en, respondida: i.respondida, motivo: i.motivo
    })),
    cotizaciones: todo('SELECT * FROM cotizaciones ORDER BY rowid').map((c) => ({
      id: c.id, folio: c.folio, solicitudId: c.solicitud_id, servicioId: c.servicio_id, prestadorId: c.prestador_id, tipo: c.tipo, nota: c.nota,
      tiempoEstimado: c.tiempo_estimado, estado: c.estado, creada: c.creada, enviada: c.enviada, venceEn: c.vence_en,
      lineas: (det.get(c.id) || []).map((l) => ({ categoria: l.categoria, concepto: l.concepto, monto: l.monto }))
    })),
    servicios: todo('SELECT * FROM servicios ORDER BY rowid').map((s) => ({
      id: s.id, folio: s.folio, solicitudId: s.solicitud_id, clienteCuentaId: s.cliente_cuenta_id, prestadorId: s.prestador_id, cotizacionId: s.cotizacion_id,
      estado: s.estado, creado: s.creado, horario: { fecha: s.fecha, franja: s.franja },
      avances: (av.get(s.id) || []).map((a) => ({ fecha: a.fecha, texto: a.texto })),
      pago: { estado: s.pago_estado, metodo: s.pago_metodo, fecha: s.pago_fecha }, finalizado: s.finalizado, soloVisita: !!s.solo_visita,
      motivoCancelacion: s.motivo_cancelacion, enCamino: s.en_camino_fecha ? { fecha: s.en_camino_fecha, minutos: s.en_camino_minutos } : null
    })),
    historial: todo('SELECT * FROM historial ORDER BY rowid').map((h) => ({ id: h.id, objeto: h.objeto, objetoId: h.objeto_id, estado: h.estado, fecha: h.fecha, actor: h.actor, nota: h.nota })),
    mensajes: todo('SELECT * FROM mensajes ORDER BY rowid').map((m) => ({ id: m.id, solicitudId: m.solicitud_id, prestadorId: m.prestador_id, deCuentaId: m.de_cuenta_id, texto: m.texto, foto: m.foto, fecha: m.fecha })),
    calificaciones: todo('SELECT * FROM calificaciones ORDER BY rowid').map((c) => ({
      id: c.id, servicioId: c.servicio_id, deCuentaId: c.de_cuenta_id, aCuentaId: c.a_cuenta_id, estrellas: c.estrellas, comentario: c.comentario, fecha: c.fecha, publicada: !!c.publicada
    })),
    reclamos: todo('SELECT * FROM reclamos ORDER BY rowid').map((r) => ({
      id: r.id, folio: r.folio, servicioId: r.servicio_id, abiertoPor: r.abierto_por, motivo: r.motivo, descripcion: r.descripcion, estado: r.estado,
      creado: r.creado, resolucion: r.resolucion, evidencia: (evi.get(r.id) || []).map((e) => e.archivo_id),
      notas: (notas.get(r.id) || []).map((x) => ({ fecha: x.fecha, texto: x.texto, actor: x.actor }))
    })),
    notificaciones: todo('SELECT * FROM notificaciones ORDER BY rowid').map((x) => ({ id: x.id, cuentaId: x.cuenta_id, titulo: x.titulo, texto: x.texto, fecha: x.fecha, leida: !!x.leida, ir: x.ir }))
  };
}

const TABLAS_ESTADO = ['contadores', 'notificaciones', 'reclamo_notas', 'reclamo_evidencias', 'reclamos', 'calificaciones', 'mensajes', 'historial', 'avances',
  'cotizacion_detalle', 'servicios', 'cotizaciones', 'invitaciones', 'solicitud_fotos', 'solicitudes', 'galeria', 'disponibilidad', 'coberturas',
  'prestador_especialidades', 'prestadores', 'especialidades', 'oficio_modalidades', 'oficios', 'cuenta_roles', 'cuentas', 'personas', 'sectores'];

/* Guarda el estado completo dentro de una transacción: o se guarda todo, o nada */
function guardarEstado(db, S, O) {
  const ins = {};
  const p = (sql) => ins[sql] || (ins[sql] = db.prepare(sql));
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('PRAGMA defer_foreign_keys = ON');
    TABLAS_ESTADO.forEach((t) => db.exec('DELETE FROM ' + t));
    Object.entries(S.seq).forEach(([k, v]) => p('INSERT INTO contadores VALUES (?, ?)').run(k, v));
    O.SECTORES.forEach((s) => p('INSERT INTO sectores VALUES (?, ?, ?)').run(s.id, s.nombre, s.zona));
    S.personas.forEach((x) => p('INSERT INTO personas VALUES (?, ?, ?, ?)').run(x.id, x.nombre, x.telefono, x.dpi || ''));
    S.cuentas.forEach((c) => {
      const g = c.guardada || {};
      p('INSERT INTO cuentas VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(c.id, c.personaId, c.correo, c.claveHash, c.estado, n(c.sectorId), b(c.debeCambiarClave), c.creada,
        g.direccion || '', g.referencia || '', g.lat == null ? null : g.lat, g.lng == null ? null : g.lng);
      c.roles.forEach((r) => p('INSERT INTO cuenta_roles VALUES (?, ?)').run(c.id, r));
    });
    S.oficios.forEach((o) => {
      p('INSERT INTO oficios VALUES (?, ?, ?, ?, ?)').run(o.id, o.nombre, o.icono, b(o.activo), b(o.enPrototipo));
      o.modalidades.forEach((m) => p('INSERT INTO oficio_modalidades VALUES (?, ?)').run(o.id, m));
    });
    S.especialidades.forEach((e) => p('INSERT INTO especialidades VALUES (?, ?, ?)').run(e.id, e.oficioId, e.nombre));
    S.prestadores.forEach((x) => {
      p('INSERT INTO prestadores VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(x.id, x.cuentaId, x.oficioId, x.experiencia, x.descripcion || '', x.condiciones || '',
        b(x.disponibleAhora), x.estadoVerificacion, x.referencia || '', x.costoVisita || 0, x.alta, x.dpiArchivo || '');
      x.especialidades.forEach((e) => p('INSERT INTO prestador_especialidades VALUES (?, ?, ?)').run(x.id, e, n((x.precios || {})[e])));
      x.cobertura.forEach((s) => p('INSERT INTO coberturas VALUES (?, ?)').run(x.id, s));
      x.disponibilidad.dias.forEach((d) => x.disponibilidad.franjas.forEach((f) => p('INSERT INTO disponibilidad VALUES (?, ?, ?)').run(x.id, d, f)));
      (x.galeria || []).forEach((g, i) => p('INSERT INTO galeria VALUES (?, ?, ?, ?)').run(x.id, i, g.archivo, g.descripcion || ''));
    });
    S.solicitudes.forEach((s) => {
      const u = s.ubicacion || {};
      p('INSERT INTO solicitudes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(s.id, s.folio, s.clienteCuentaId, s.oficioId, n(s.especialidadId), s.modalidad,
        s.descripcion, s.medidas || '', s.sectorId, s.direccion, s.referencia || '', s.horario.tipo, n(s.horario.fecha), n(s.horario.franja), s.estado, s.creada, s.clave,
        u.lat == null ? null : u.lat, u.lng == null ? null : u.lng, u.precision == null ? null : u.precision);
      (s.fotos || []).forEach((f, i) => p('INSERT INTO solicitud_fotos VALUES (?, ?, ?)').run(s.id, i, f));
    });
    S.invitaciones.forEach((i) => p('INSERT INTO invitaciones VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(i.id, i.solicitudId, i.prestadorId, i.estado, i.enviada, i.venceEn, n(i.respondida), i.motivo || ''));
    S.cotizaciones.forEach((c) => {
      p('INSERT INTO cotizaciones VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(c.id, c.folio, c.solicitudId, n(c.servicioId), c.prestadorId, c.tipo, c.nota || '',
        c.tiempoEstimado || '', c.estado, c.creada, n(c.enviada), n(c.venceEn));
      c.lineas.forEach((l, i) => p('INSERT INTO cotizacion_detalle VALUES (?, ?, ?, ?, ?)').run(c.id, i, l.categoria, l.concepto, l.monto));
    });
    S.servicios.forEach((s) => {
      p('INSERT INTO servicios VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(s.id, s.folio, s.solicitudId, s.clienteCuentaId, s.prestadorId, s.cotizacionId,
        s.estado, s.creado, s.horario.fecha, s.horario.franja, s.pago.estado, s.pago.metodo || '', n(s.pago.fecha), n(s.finalizado), b(s.soloVisita),
        s.motivoCancelacion || '', s.enCamino ? s.enCamino.fecha : null, s.enCamino ? s.enCamino.minutos : null);
      s.avances.forEach((a, i) => p('INSERT INTO avances VALUES (?, ?, ?, ?)').run(s.id, i, a.fecha, a.texto));
    });
    S.historial.forEach((h) => p('INSERT INTO historial VALUES (?, ?, ?, ?, ?, ?, ?)').run(h.id, h.objeto, h.objetoId, h.estado, h.fecha, h.actor, h.nota || ''));
    S.mensajes.forEach((m) => p('INSERT INTO mensajes VALUES (?, ?, ?, ?, ?, ?, ?)').run(m.id, m.solicitudId, m.prestadorId, m.deCuentaId, m.texto, m.foto || '', m.fecha));
    S.calificaciones.forEach((c) => p('INSERT INTO calificaciones VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(c.id, c.servicioId, c.deCuentaId, c.aCuentaId, c.estrellas, c.comentario || '', c.fecha, b(c.publicada)));
    S.reclamos.forEach((r) => {
      p('INSERT INTO reclamos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(r.id, r.folio, r.servicioId, r.abiertoPor, r.motivo, r.descripcion, r.estado, r.creado, r.resolucion || '');
      (r.evidencia || []).forEach((e, i) => p('INSERT INTO reclamo_evidencias VALUES (?, ?, ?)').run(r.id, i, e));
      (r.notas || []).forEach((x, i) => p('INSERT INTO reclamo_notas VALUES (?, ?, ?, ?, ?)').run(r.id, i, x.fecha, x.texto, x.actor));
    });
    S.notificaciones.forEach((x) => p('INSERT INTO notificaciones VALUES (?, ?, ?, ?, ?, ?, ?)').run(x.id, x.cuentaId, x.titulo, x.texto, x.fecha, b(x.leida), x.ir || ''));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function meta(db, clave, valor) {
  if (valor === undefined) { const r = db.prepare('SELECT valor FROM meta WHERE clave = ?').get(clave); return r ? r.valor : null; }
  db.prepare('INSERT INTO meta VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').run(clave, String(valor));
}

module.exports = { abrir, cargarEstado, guardarEstado, meta };
