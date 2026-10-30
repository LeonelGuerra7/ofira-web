/* Ofira · Acciones permitidas desde el navegador.
 * Cada acción revisa en el servidor quién la pide (la sesión, nunca lo que diga el navegador),
 * si tiene el rol y si es dueño de lo que quiere cambiar. Después valida los datos y llama al motor de reglas.
 */
'use strict';

const falla = (error, codigo) => ({ ok: false, error, codigo: codigo || 'permiso' });
const NO = falla('No tienes permiso para hacer esto.');
const txt = (v, max) => String(v == null ? '' : v).slice(0, max);
const esId = (v) => typeof v === 'string' && /^[A-Za-z0-9-]{1,40}$/.test(v);
const esArchivo = (v) => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);

function crear(O, db) {
  const St = O.Store;
  const S = () => St.S;
  const miPrestador = (c) => S().prestadores.find((p) => p.cuentaId === c.id);
  const archivoMio = (id, cuenta) => esArchivo(id) && !!db.prepare("SELECT 1 FROM archivos WHERE id = ? AND cuenta_id = ? AND tipo = 'foto'").get(id, cuenta.id);
  const fotosMias = (lista, cuenta, max) => Array.isArray(lista) && lista.length <= max && lista.every((f) => archivoMio(f, cuenta));
  const esParte = (srv, cuenta) => srv.clienteCuentaId === cuenta.id || (miPrestador(cuenta) && miPrestador(cuenta).id === srv.prestadorId);

  const A = {
    // ---------- Cliente ----------
    crearSolicitud: { roles: ['cliente'], fn: (c, [d, ids, clave]) => {
      if (!d || typeof d !== 'object' || !Array.isArray(ids) || !/^[A-Za-z0-9-]{4,60}$/.test(String(clave || ''))) return falla('Datos no válidos.', 'datos');
      const o = St.oficio(d.oficioId);
      if (!o || !o.activo || !o.enPrototipo || !o.modalidades.includes(d.modalidad)) return falla('El oficio o la modalidad no es válida.', 'datos');
      const esp = St.especialidad(d.especialidadId);
      if (!esp || esp.oficioId !== o.id) return falla('Elige el tipo de trabajo.', 'datos');
      if (!O.SECTORES.some((s) => s.id === d.sectorId)) return falla('Elige un sector válido.', 'datos');
      let horario;
      if (d.modalidad === 'inmediata') horario = { tipo: 'ahora' };
      else {
        const h = d.horario || {};
        const hoy = O.diaISO(St.ahora()); const max = O.diaISO(St.ahora() + 30 * O.DIA);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(h.fecha || '') || h.fecha < hoy || h.fecha > max || !O.FRANJAS.some((f) => f.id === h.franja)) return falla('Elige un día y una franja válidos.', 'datos');
        horario = { tipo: 'programado', fecha: h.fecha, franja: h.franja };
      }
      const descripcion = txt(d.descripcion, 1000); const direccion = txt(d.direccion, 200);
      if (descripcion.trim().length < 15) return falla('Describe el problema con al menos 15 caracteres.', 'datos');
      if (direccion.trim().length < 5) return falla('Escribe la dirección.', 'datos');
      if (!fotosMias(d.fotos || [], c, 3)) return falla('Las fotos no son válidas.', 'datos');
      if (new Set(ids).size !== ids.length || !ids.every(esId)) return falla('Selección de prestadores no válida.', 'datos');
      const ubicacion = ubicacionValida(d.ubicacion);
      if (d.ubicacion && !ubicacion) return falla('La ubicación no es válida. Vuelve a tomarla.', 'datos');
      if (d.guardarDireccion) St.guardarDireccion(c.id, { direccion: direccion.trim(), referencia: txt(d.referencia, 200).trim(), lat: ubicacion ? ubicacion.lat : null, lng: ubicacion ? ubicacion.lng : null });
      return St.crearSolicitud({ oficioId: o.id, modalidad: d.modalidad, especialidadId: esp.id, sectorId: d.sectorId, horario, descripcion, direccion,
        referencia: txt(d.referencia, 200), medidas: txt(d.medidas, 200), fotos: d.fotos || [], ubicacion }, ids, txt(clave, 60), c.id);
    } },
    borrarDireccion: { roles: ['cliente'], fn: (c) => St.guardarDireccion(c.id, null) },
    cancelarSolicitud: { roles: ['cliente'], fn: (c, [id, motivo]) => {
      const s = St.solicitud(id); if (!s || s.clienteCuentaId !== c.id) return NO;
      if (!txt(motivo, 100).trim()) return falla('Elige un motivo.', 'datos');
      return St.cancelarSolicitud(id, c.id, txt(motivo, 100));
    } },
    reenviar: { roles: ['cliente'], fn: (c, [id]) => {
      const s = St.solicitud(id); if (!s || s.clienteCuentaId !== c.id) return NO;
      return St.reenviar(id, c.id);
    } },
    aprobarCotizacion: { roles: ['cliente'], fn: (c, [id]) => {
      const k = St.cotizacion(id); if (!k || St.solicitud(k.solicitudId).clienteCuentaId !== c.id) return NO;
      return St.aprobarCotizacion(id, c.id);
    } },
    rechazarCotizacion: { roles: ['cliente'], fn: (c, [id, motivo]) => {
      const k = St.cotizacion(id); if (!k || St.solicitud(k.solicitudId).clienteCuentaId !== c.id) return NO;
      if (!txt(motivo, 100).trim()) return falla('Elige un motivo.', 'datos');
      return St.rechazarCotizacion(id, c.id, txt(motivo, 100));
    } },

    // ---------- Prestador ----------
    responderInvitacion: { roles: ['prestador'], fn: (c, [id, aceptar, motivo]) => {
      const i = St.invitacion(id); const p = miPrestador(c); if (!i || !p || i.prestadorId !== p.id) return NO;
      if (!aceptar && !txt(motivo, 100).trim()) return falla('Elige un motivo.', 'datos');
      return St.responderInvitacion(id, !!aceptar, c.id, txt(motivo, 100));
    } },
    guardarCotizacion: { roles: ['prestador'], fn: (c, [d, enviar]) => {
      const p = miPrestador(c); if (!p || !d || typeof d !== 'object') return NO;
      const sol = St.solicitud(d.solicitudId); if (!sol) return NO;
      if (d.id) { const k = St.cotizacion(d.id); if (!k || k.prestadorId !== p.id) return NO; }
      let tipo;
      if (d.servicioId) {
        const srv = St.servicio(d.servicioId);
        if (!srv || srv.prestadorId !== p.id || srv.solicitudId !== sol.id) return NO;
        if (!['trabajo', 'adicional'].includes(d.tipo) || (d.tipo === 'trabajo' && sol.modalidad !== 'diagnostico')) return falla('Tipo de cotización no válido.', 'datos');
        tipo = d.tipo;
      } else {
        tipo = St.tipoCotizacionInicial(sol);
      }
      if (!Array.isArray(d.lineas) || d.lineas.length > 30) return falla('Revisa las líneas de la cotización.', 'datos');
      const lineas = [];
      for (const l of d.lineas) {
        if (!l || !['mano_obra', 'materiales', 'cargos'].includes(l.categoria)) return falla('Categoría no válida.', 'datos');
        const monto = l.monto === '' || l.monto == null ? 0 : Number(l.monto);
        if (!isFinite(monto) || monto < 0 || monto > 100000) return falla('Los montos deben estar entre Q 0 y Q 100,000.', 'datos');
        lineas.push({ categoria: l.categoria, concepto: txt(l.concepto, 120), monto: l.monto === '' ? '' : monto });
      }
      return St.guardarCotizacion({ id: d.id || null, solicitudId: sol.id, servicioId: d.servicioId || null, prestadorId: p.id, tipo, lineas,
        nota: txt(d.nota, 300), tiempoEstimado: txt(d.tiempoEstimado, 60) }, !!enviar, c.id);
    } },
    iniciarServicio: { roles: ['prestador'], fn: (c, [id]) => soloMiServicio(c, id) || St.iniciarServicio(id, c.id) },
    marcarEnCamino: { roles: ['prestador'], fn: (c, [id, min]) => soloMiServicio(c, id) || St.marcarEnCamino(id, min, c.id) },
    registrarAvance: { roles: ['prestador'], fn: (c, [id, texto]) => soloMiServicio(c, id) || St.registrarAvance(id, txt(texto, 300), c.id) },
    finalizarServicio: { roles: ['prestador'], fn: (c, [id, pago]) => {
      const m = pago && ['Efectivo', 'Transferencia'].includes(pago.metodo) ? pago.metodo : '';
      return soloMiServicio(c, id) || St.finalizarServicio(id, c.id, { metodo: m });
    } },
    marcarPagado: { roles: ['prestador'], fn: (c, [id, metodo]) => {
      if (!['Efectivo', 'Transferencia'].includes(metodo)) return falla('Elige cómo te pagaron.', 'datos');
      return soloMiServicio(c, id) || St.marcarPagado(id, metodo, c.id);
    } },
    actualizarPerfil: { roles: ['prestador'], fn: (c, [d]) => {
      const p = miPrestador(c); if (!p || !d) return NO;
      const arr = (v) => (Array.isArray(v) ? v.slice(0, 20).map(String) : []);
      return St.actualizarPerfil(p.id, { especialidades: arr(d.especialidades), cobertura: arr(d.cobertura), dias: arr(d.dias), franjas: arr(d.franjas),
        experiencia: d.experiencia, descripcion: txt(d.descripcion, 600), condiciones: txt(d.condiciones, 400), costoVisita: d.costoVisita, precios: d.precios || {} });
    } },
    setDisponibleAhora: { roles: ['prestador'], fn: (c, [v]) => { const p = miPrestador(c); if (!p) return NO; St.setDisponibleAhora(p.id, !!v); return { ok: true }; } },
    agregarGaleria: { roles: ['prestador'], fn: (c, [archivo, desc]) => {
      const p = miPrestador(c); if (!p || !archivoMio(archivo, c)) return NO;
      return St.agregarGaleria(p.id, archivo, txt(desc, 120));
    } },
    quitarGaleria: { roles: ['prestador'], fn: (c, [archivo]) => { const p = miPrestador(c); if (!p) return NO; return St.quitarGaleria(p.id, String(archivo)); } },

    // ---------- Cliente o prestador del servicio ----------
    cancelarServicio: { roles: ['cliente', 'prestador'], fn: (c, [id, motivo]) => {
      const s = St.servicio(id); if (!s || !esParte(s, c)) return NO;
      return St.cancelarServicio(id, c.id, txt(motivo, 300));
    } },
    enviarMensaje: { roles: ['cliente', 'prestador'], fn: (c, [solId, pid, texto, foto]) => {
      const s = St.solicitud(solId); const p = St.prestador(pid); if (!s || !p) return NO;
      const invitado = S().invitaciones.some((i) => i.solicitudId === s.id && i.prestadorId === p.id && i.estado !== 'Pendiente');
      const soyCliente = s.clienteCuentaId === c.id; const soyPrestador = p.cuentaId === c.id;
      if (!invitado || (!soyCliente && !soyPrestador)) return NO;
      if (foto && !archivoMio(foto, c)) return falla('La foto no es válida.', 'datos');
      return St.enviarMensaje(s.id, p.id, txt(texto, 400), c.id, foto || '');
    } },
    calificar: { roles: ['cliente', 'prestador'], fn: (c, [id, estrellas, comentario]) => {
      if (!St.servicio(id)) return NO;
      return St.calificar(id, c.id, Number(estrellas), txt(comentario, 300));
    } },
    abrirReclamo: { roles: ['cliente', 'prestador'], fn: (c, [id, motivo, desc, evid]) => {
      const s = St.servicio(id); if (!s || !esParte(s, c)) return NO;
      if (!fotosMias(evid || [], c, 3)) return falla('La evidencia no es válida.', 'datos');
      return St.abrirReclamo(id, c.id, txt(motivo, 60), txt(desc, 1000), evid || []);
    } },

    // ---------- Soporte ----------
    transicionReclamo: { roles: ['soporte'], fn: (c, [id, estado, nota]) => {
      if (!St.reclamo(id)) return NO;
      return St.transicionReclamo(id, String(estado), c.id, txt(nota, 600));
    } },

    // ---------- Administración ----------
    verificar: { roles: ['administrador'], fn: (c, [pid, estado, nota]) => (St.prestador(pid) ? St.verificar(pid, String(estado), c.id, txt(nota, 300)) : NO) },
    agregarOficio: { roles: ['administrador'], fn: (c, [nombre, mods]) => {
      const validas = Array.isArray(mods) ? mods.filter((m) => O.MODALIDADES[m]) : [];
      return St.agregarOficio(txt(nombre, 40), validas);
    } },
    agregarEspecialidad: { roles: ['administrador'], fn: (c, [oid, nombre]) => (St.oficio(oid) ? St.agregarEspecialidad(oid, txt(nombre, 60)) : NO) },
    alternarOficio: { roles: ['administrador'], fn: (c, [oid]) => (St.oficio(oid) ? St.alternarOficio(oid) : NO) },
    alternarCuenta: { roles: ['administrador'], fn: (c, [cid]) => {
      if (!St.cuenta(cid) || cid === c.id) return NO;
      const r = St.alternarCuenta(cid);
      if (r.ok && St.cuenta(cid).estado === 'Suspendida') db.prepare('DELETE FROM sesiones WHERE cuenta_id = ?').run(cid);
      return r;
    } },
    agregarRol: { roles: ['administrador'], fn: (c, [cid, rol]) => {
      if (!St.cuenta(cid) || !['cliente', 'prestador', 'soporte', 'administrador'].includes(rol)) return NO;
      if (rol === 'prestador') return falla('Para ser prestador, la persona debe registrarse con su DPI y referencia desde “Crear cuenta”.');
      return St.agregarRol(cid, rol);
    } },

    // ---------- Avisos de la propia cuenta ----------
    leerAvisos: { roles: ['cliente', 'prestador', 'administrador', 'soporte'], fn: (c) => {
      S().notificaciones.forEach((n) => { if (n.cuentaId === c.id) n.leida = true; });
      return { ok: true };
    } },
    leerAviso: { roles: ['cliente', 'prestador', 'administrador', 'soporte'], fn: (c, [id]) => {
      const n = S().notificaciones.find((x) => x.id === id && x.cuentaId === c.id);
      if (n) n.leida = true;
      return { ok: true };
    } }
  };

  /* Coordenadas reales del GPS del teléfono: números dentro de rango y precisión razonable */
  function ubicacionValida(u) {
    if (!u || typeof u !== 'object') return null;
    const lat = Number(u.lat); const lng = Number(u.lng); const precision = Number(u.precision);
    if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, precision: isFinite(precision) && precision >= 0 ? Math.min(Math.round(precision), 100000) : null };
  }

  function soloMiServicio(c, id) {
    const s = St.servicio(id); const p = miPrestador(c);
    if (!s || !p || s.prestadorId !== p.id) return NO;
    return null;
  }

  return A;
}

module.exports = { crear };
