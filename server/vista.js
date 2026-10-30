/* Ofira · Lo que cada cuenta puede ver (permisos por rol y privacidad).
 * El navegador nunca recibe la base completa: solo una copia filtrada para la cuenta que inició sesión.
 * - Nunca se envían hashes de contraseñas.
 * - El DPI solo lo ve el administrador (y su dueño).
 * - La dirección exacta de una solicitud solo la ve el prestador cuando su servicio está confirmado.
 * - El teléfono solo se ve entre las partes de un servicio, y soporte lo ve en los reclamos que atiende.
 */
'use strict';

const copia = (o) => JSON.parse(JSON.stringify(o));
const PUBLICO_PRESTADOR = ['id', 'cuentaId', 'oficioId', 'especialidades', 'experiencia', 'descripcion', 'cobertura', 'disponibilidad',
  'disponibleAhora', 'estadoVerificacion', 'costoVisita', 'condiciones', 'alta', 'precios', 'galeria'];

function sinSecretos(c) {
  const x = copia(c);
  delete x.claveHash;
  return x;
}

function vistaPara(S, cuenta, extra) {
  const esAdmin = cuenta.roles.includes('administrador');
  const esSoporte = cuenta.roles.includes('soporte');
  const miPre = S.prestadores.find((p) => p.cuentaId === cuenta.id);

  const V = { version: 3, clockOffset: 0, seq: {}, oficios: copia(S.oficios), especialidades: copia(S.especialidades) };

  if (esAdmin) {
    Object.assign(V, {
      personas: copia(S.personas), cuentas: S.cuentas.map(sinSecretos), prestadores: copia(S.prestadores),
      solicitudes: copia(S.solicitudes), invitaciones: copia(S.invitaciones), cotizaciones: copia(S.cotizaciones),
      servicios: copia(S.servicios), historial: copia(S.historial), mensajes: copia(S.mensajes), calificaciones: copia(S.calificaciones),
      reclamos: copia(S.reclamos), notificaciones: copia(S.notificaciones.filter((x) => x.cuentaId === cuenta.id)),
      recuperaciones: extra.recuperaciones || []
    });
    return V;
  }

  const sol = new Set(); const solComoPrestador = new Set(); const cot = new Set(); const srv = new Set(); const rec = new Set();
  const cuentasVisibles = new Set([cuenta.id]); const conTelefono = new Set([cuenta.id]); const prestVisibles = new Set();

  // Como cliente
  if (cuenta.roles.includes('cliente')) {
    S.solicitudes.filter((s) => s.clienteCuentaId === cuenta.id).forEach((s) => sol.add(s.id));
    S.cotizaciones.filter((c) => sol.has(c.solicitudId) && c.estado !== 'Borrador').forEach((c) => cot.add(c.id));
    S.servicios.filter((s) => s.clienteCuentaId === cuenta.id).forEach((s) => srv.add(s.id));
  }
  // Como prestador
  if (miPre) {
    prestVisibles.add(miPre.id);
    S.invitaciones.filter((i) => i.prestadorId === miPre.id).forEach((i) => { if (!sol.has(i.solicitudId)) solComoPrestador.add(i.solicitudId); });
    S.cotizaciones.filter((c) => c.prestadorId === miPre.id).forEach((c) => cot.add(c.id));
    S.servicios.filter((s) => s.prestadorId === miPre.id).forEach((s) => srv.add(s.id));
  }
  // Como soporte: los reclamos y lo necesario para atenderlos
  if (esSoporte) {
    S.reclamos.forEach((r) => {
      rec.add(r.id);
      const s = S.servicios.find((x) => x.id === r.servicioId);
      srv.add(s.id); sol.add(s.solicitudId);
      S.cotizaciones.filter((c) => (c.id === s.cotizacionId || c.servicioId === s.id) && c.estado === 'Aprobada').forEach((c) => cot.add(c.id));
      [s.clienteCuentaId, S.prestadores.find((p) => p.id === s.prestadorId).cuentaId].forEach((c) => conTelefono.add(c));
    });
  }
  S.reclamos.filter((r) => srv.has(r.servicioId)).forEach((r) => rec.add(r.id));

  const servicios = S.servicios.filter((s) => srv.has(s.id));
  servicios.forEach((s) => {
    sol.add(s.solicitudId); solComoPrestador.delete(s.solicitudId);
    const p = S.prestadores.find((x) => x.id === s.prestadorId);
    if (s.estado !== 'Cancelado') { conTelefono.add(s.clienteCuentaId); conTelefono.add(p.cuentaId); }
  });

  // Solicitudes; la dirección se oculta al prestador que todavía no tiene el servicio confirmado
  const solicitudes = [];
  S.solicitudes.forEach((s) => {
    if (sol.has(s.id)) {
      const x = copia(s);
      const servicio = S.servicios.find((v) => v.solicitudId === s.id);
      const soyCliente = s.clienteCuentaId === cuenta.id;
      const soyPrestadorDelServicio = servicio && miPre && servicio.prestadorId === miPre.id;
      if (!soyCliente && !esSoporte && !soyPrestadorDelServicio) { x.direccion = ''; x.referencia = ''; x.ubicacion = null; }
      if (!soyCliente) delete x.clave;
      solicitudes.push(x);
    } else if (solComoPrestador.has(s.id)) {
      const x = copia(s);
      x.direccion = ''; x.referencia = ''; x.ubicacion = null; delete x.clave;
      solicitudes.push(x);
    }
  });
  const idsSol = new Set(solicitudes.map((s) => s.id));
  solicitudes.forEach((s) => cuentasVisibles.add(s.clienteCuentaId));

  // Invitaciones: el cliente ve todas las de sus solicitudes; el prestador solo las suyas
  const invitaciones = S.invitaciones.filter((i) => (sol.has(i.solicitudId) && S.solicitudes.find((s) => s.id === i.solicitudId).clienteCuentaId === cuenta.id) || (miPre && i.prestadorId === miPre.id)).map(copia);
  const cotizaciones = S.cotizaciones.filter((c) => cot.has(c.id)).map(copia);
  const mensajes = S.mensajes.filter((m) => {
    const s = S.solicitudes.find((x) => x.id === m.solicitudId);
    return (s && s.clienteCuentaId === cuenta.id) || (miPre && m.prestadorId === miPre.id) || (esSoporte && srv.has((S.servicios.find((v) => v.solicitudId === m.solicitudId) || {}).id) && S.servicios.find((v) => v.solicitudId === m.solicitudId).prestadorId === m.prestadorId);
  }).map(copia);
  const reclamos = S.reclamos.filter((r) => rec.has(r.id)).map(copia);
  const calificaciones = S.calificaciones.filter((c) => c.publicada || c.deCuentaId === cuenta.id || c.aCuentaId === cuenta.id || (esSoporte && srv.has(c.servicioId))).map(copia);

  [invitaciones, cotizaciones].forEach((l) => l.forEach((x) => prestVisibles.add(x.prestadorId)));
  servicios.forEach((s) => prestVisibles.add(s.prestadorId));
  mensajes.forEach((m) => { prestVisibles.add(m.prestadorId); cuentasVisibles.add(m.deCuentaId); });
  reclamos.forEach((r) => cuentasVisibles.add(r.abiertoPor));
  calificaciones.forEach((c) => { cuentasVisibles.add(c.deCuentaId); cuentasVisibles.add(c.aCuentaId); });

  // Prestadores: perfil público de los verificados y de los relacionados; perfil completo del propio
  const prestadores = [];
  S.prestadores.forEach((p) => {
    const cta = S.cuentas.find((c) => c.id === p.cuentaId);
    const publico = p.estadoVerificacion === 'Verificado' && cta && cta.estado === 'Activa';
    if (miPre && p.id === miPre.id) { prestadores.push(copia(p)); return; }
    if (!publico && !prestVisibles.has(p.id)) return;
    const x = {};
    PUBLICO_PRESTADOR.forEach((k) => { x[k] = copia(p[k] === undefined ? null : p[k]); });
    x.referencia = ''; x.dpiArchivo = '';
    x.finalizados = S.servicios.filter((s) => s.prestadorId === p.id && s.estado === 'Finalizado').length;
    prestadores.push(x);
  });
  prestadores.forEach((p) => cuentasVisibles.add(p.cuentaId));

  // Agenda pública: solo los horarios ocupados (sin cliente ni detalle) para calcular disponibilidad
  let n = 0;
  const ocupados = S.servicios.filter((s) => !srv.has(s.id) && (s.estado === 'Confirmado' || s.estado === 'En ejecución'))
    .map((s) => ({ id: 'ocupado-' + (++n), prestadorId: s.prestadorId, estado: s.estado, horario: copia(s.horario) }));

  const historial = S.historial.filter((h) =>
    (h.objeto === 'Solicitud' && idsSol.has(h.objetoId)) || (h.objeto === 'Cotización' && cot.has(h.objetoId)) ||
    (h.objeto === 'Servicio' && srv.has(h.objetoId)) || (h.objeto === 'Reclamo' && rec.has(h.objetoId)) ||
    (h.objeto === 'Prestador' && miPre && h.objetoId === miPre.id)).map(copia);
  historial.forEach((h) => { if (h.actor !== 'Sistema') cuentasVisibles.add(h.actor); });

  const cuentas = S.cuentas.filter((c) => cuentasVisibles.has(c.id)).map((c) => (c.id === cuenta.id ? sinSecretos(c) : { id: c.id, personaId: c.personaId, roles: c.roles.slice(), estado: c.estado }));
  const personas = cuentas.map((c) => {
    const p = S.personas.find((x) => x.id === c.personaId);
    return { id: p.id, nombre: p.nombre, telefono: conTelefono.has(c.id) ? p.telefono : '', dpi: '' };
  });

  Object.assign(V, {
    personas, cuentas, prestadores, solicitudes, invitaciones, cotizaciones,
    servicios: servicios.map(copia).concat(ocupados), historial, mensajes, calificaciones, reclamos,
    notificaciones: S.notificaciones.filter((x) => x.cuentaId === cuenta.id).map(copia)
  });
  return V;
}

module.exports = { vistaPara };
