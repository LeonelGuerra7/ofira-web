/* Ofira · Reglas de negocio.
 * Este mismo archivo corre en el servidor (fuente de verdad, guarda en la base de datos) y en el
 * navegador (solo para consultas y para dibujar las pantallas con los datos que el servidor permite ver).
 */
(function () {
  'use strict';
  const O = window.Ofira;
  const { REGLAS, FRANJAS, MIN, DIA } = O;

  let S = null;

  function ok(datos) { return Object.assign({ ok: true }, datos || {}); }
  function falla(error, codigo) { return { ok: false, error, codigo: codigo || 'regla' }; }

  const Store = {
    get S() { return S; },

    /* El servidor carga el estado desde la base de datos; el navegador recibe una vista filtrada. */
    usar(estado) { S = estado; },
    guardar() { /* el servidor guarda en la base de datos al terminar cada acción */ },

    // ---------- Reloj (el navegador se sincroniza con la hora del servidor) ----------
    ahora() { return Date.now() + (S.clockOffset || 0) * MIN; },

    nuevoId(prefijo) { S.seq.id += 1; return prefijo + '-' + S.seq.id; },
    folio(tipo) { S.seq[tipo] += 1; return tipo + '-' + String(S.seq[tipo]).padStart(4, '0'); },

    hist(objeto, objetoId, estado, actor, nota) {
      S.historial.push({ id: this.nuevoId('his'), objeto, objetoId, estado, fecha: this.ahora(), actor: actor || 'Sistema', nota: nota || '' });
    },
    historialDe(objeto, objetoId) {
      return S.historial.filter((h) => h.objeto === objeto && h.objetoId === objetoId).sort((a, b) => a.fecha - b.fecha);
    },
    notificar(cuentaId, titulo, texto, ir) {
      if (!cuentaId) return;
      S.notificaciones.push({ id: this.nuevoId('not'), cuentaId, titulo, texto, fecha: this.ahora(), leida: false, ir: ir || '' });
    },
    notificarRol(rol, titulo, texto, ir) {
      S.cuentas.filter((c) => c.roles.includes(rol) && c.estado === 'Activa').forEach((c) => this.notificar(c.id, titulo, texto, ir));
    },

    // ---------- Consultas ----------
    cuenta(id) { return S.cuentas.find((c) => c.id === id); },
    persona(id) { return S.personas.find((p) => p.id === id); },
    nombre(cuentaId) {
      if (!cuentaId || cuentaId === 'Sistema') return 'Sistema';
      const c = this.cuenta(cuentaId);
      return c ? this.persona(c.personaId).nombre : 'Desconocido';
    },
    nombrePrestador(pid) { const p = this.prestador(pid); return p ? this.nombre(p.cuentaId) : ''; },
    prestador(id) { return S.prestadores.find((p) => p.id === id); },
    prestadorDeCuenta(cuentaId) { return S.prestadores.find((p) => p.cuentaId === cuentaId); },
    oficio(id) { return S.oficios.find((o) => o.id === id); },
    especialidad(id) { return S.especialidades.find((e) => e.id === id); },
    sector(id) { return O.SECTORES.find((s) => s.id === id); },
    solicitud(id) { return S.solicitudes.find((s) => s.id === id); },
    invitacion(id) { return S.invitaciones.find((i) => i.id === id); },
    cotizacion(id) { return S.cotizaciones.find((c) => c.id === id); },
    servicio(id) { return S.servicios.find((s) => s.id === id); },
    reclamo(id) { return S.reclamos.find((r) => r.id === id); },
    servicioDeSolicitud(solId) { return S.servicios.find((s) => s.solicitudId === solId); },
    invitacionesDe(solId) { return S.invitaciones.filter((i) => i.solicitudId === solId); },
    cotizacionesDe(solId) { return S.cotizaciones.filter((c) => c.solicitudId === solId); },
    cotizacionesDeServicio(srv) {
      return S.cotizaciones.filter((c) => c.id === srv.cotizacionId || c.servicioId === srv.id);
    },
    reclamoAbiertoDe(srvId) {
      return S.reclamos.find((r) => r.servicioId === srvId && (r.estado === 'Abierto' || r.estado === 'En revisión'));
    },

    calificacionPromedio(pid) {
      const p = this.prestador(pid);
      if (!p) return { prom: 0, n: 0 };
      const lista = S.calificaciones.filter((c) => c.aCuentaId === p.cuentaId && c.publicada);
      if (!lista.length) return { prom: 0, n: 0 };
      const suma = lista.reduce((a, c) => a + c.estrellas, 0);
      return { prom: Math.round((suma / lista.length) * 10) / 10, n: lista.length };
    },
    resenasDe(pid) {
      const p = this.prestador(pid);
      return S.calificaciones.filter((c) => c.aCuentaId === p.cuentaId && c.publicada).sort((a, b) => b.fecha - a.fecha);
    },
    serviciosFinalizados(pid) {
      const p = this.prestador(pid);
      if (p && typeof p.finalizados === 'number') return p.finalizados;
      return S.servicios.filter((s) => s.prestadorId === pid && s.estado === 'Finalizado').length;
    },
    /* Precio de referencia más bajo del prestador ("desde Q ..."), o 0 si no ha puesto precios */
    precioDesde(pid) {
      const p = this.prestador(pid);
      const v = Object.values((p && p.precios) || {}).map(Number).filter((n) => n > 0);
      return v.length ? Math.min(...v) : 0;
    },

    totales(cot) {
      const t = { mano_obra: 0, materiales: 0, cargos: 0, total: 0 };
      (cot.lineas || []).forEach((l) => { const m = Number(l.monto) || 0; t[l.categoria] += m; t.total += m; });
      return t;
    },

    franjaActual() {
      const h = new Date(this.ahora()).getHours();
      if (h < 12) return 'manana';
      if (h < 17) return 'tarde';
      return 'noche';
    },
    horarioEfectivo(horario) {
      if (horario.tipo === 'ahora') return { fecha: O.diaISO(this.ahora()), franja: this.franjaActual() };
      return { fecha: horario.fecha, franja: horario.franja };
    },
    ocupado(pid, fecha, franja, exceptoServicioId) {
      return S.servicios.some((s) => s.prestadorId === pid && s.id !== exceptoServicioId &&
        (s.estado === 'Confirmado' || s.estado === 'En ejecución') &&
        s.horario.fecha === fecha && s.horario.franja === franja);
    },

    /* En inmediata, el prestador está ocupado si está trabajando en este momento o si tiene un servicio
     * confirmado en la franja actual (solo dentro del horario de atención, 7:00 a 21:00). */
    ocupadoAhora(pid) {
      const h = new Date(this.ahora()).getHours();
      const fecha = O.diaISO(this.ahora());
      const franja = this.franjaActual();
      return S.servicios.some((s) => s.prestadorId === pid && (s.estado === 'En ejecución' ||
        (s.estado === 'Confirmado' && h >= 7 && h < 21 && s.horario.fecha === fecha && s.horario.franja === franja)));
    },

    /* Regla 1 (asignación): el cliente elige; solo se pueden invitar prestadores verificados que
     * tengan el sector en cobertura y estén disponibles en el horario pedido. En inmediata se
     * muestran primero los disponibles en ese momento. */
    buscar(criterio) {
      const { oficioId, modalidad, sectorId, horario } = criterio;
      const ef = this.horarioEfectivo(horario);
      const dia = new Date(ef.fecha + 'T12:00:00').getDay();
      const lista = S.prestadores
        .filter((p) => p.oficioId === oficioId && p.estadoVerificacion === 'Verificado')
        .filter((p) => { const c = this.cuenta(p.cuentaId); return c && c.estado === 'Activa'; })
        .filter((p) => !sectorId || p.cobertura.includes(sectorId))
        .map((p) => {
          let disponible = true; let motivo = '';
          if (modalidad === 'inmediata') {
            if (!p.disponibleAhora) { disponible = false; motivo = 'No está disponible en este momento'; }
          } else if (!p.disponibilidad.dias.includes(dia)) {
            disponible = false; motivo = 'No atiende los ' + O.DIAS[dia].toLowerCase();
          } else if (!p.disponibilidad.franjas.includes(ef.franja)) {
            disponible = false; motivo = 'No atiende en la franja de la ' + this.franja(ef.franja).nombre.toLowerCase();
          }
          if (disponible && (modalidad === 'inmediata' ? this.ocupadoAhora(p.id) : this.ocupado(p.id, ef.fecha, ef.franja))) { disponible = false; motivo = modalidad === 'inmediata' ? 'Está atendiendo otro servicio' : 'Ya tiene un servicio en esa franja'; }
          const r = this.calificacionPromedio(p.id);
          return { p, disponible, motivo, prom: r.prom, n: r.n };
        });
      lista.sort((a, b) => (b.disponible - a.disponible) || (b.prom - a.prom) || (b.n - a.n));
      return lista;
    },
    franja(id) { return FRANJAS.find((f) => f.id === id) || FRANJAS[0]; },

    plazos(modalidad) { return modalidad === 'inmediata' ? REGLAS.vencimiento.inmediata : REGLAS.vencimiento.otras; },

    sinConexion() { return false; },

    // ---------- Registro (RF01). La contraseña llega ya cifrada desde el servidor ----------
    registrar(d) {
      const correo = String(d.correo).trim().toLowerCase();
      if (S.cuentas.some((c) => c.correo === correo)) return falla('Ya existe una cuenta con ese correo. Inicia sesión o recupera tu cuenta.');
      if (S.personas.some((p) => p.telefono === d.telefono)) return falla('Ese teléfono ya está asociado a una cuenta. Una persona solo puede tener una cuenta.');
      const per = { id: this.nuevoId('per'), nombre: d.nombre.trim(), telefono: d.telefono.trim(), dpi: '' };
      S.personas.push(per);
      const roles = d.prestador ? ['cliente', 'prestador'] : ['cliente'];
      const cta = { id: this.nuevoId('cta'), personaId: per.id, correo, claveHash: d.claveHash, roles, estado: 'Activa', sectorId: d.sectorId, creada: this.ahora(), debeCambiarClave: false };
      S.cuentas.push(cta);
      if (d.prestador) {
        const pre = {
          id: this.nuevoId('pre'), cuentaId: cta.id, oficioId: d.oficioId, especialidades: [], experiencia: Number(d.experiencia) || 0,
          descripcion: '', cobertura: [d.sectorId], disponibilidad: { dias: [1, 2, 3, 4, 5, 6], franjas: ['manana', 'tarde'] },
          disponibleAhora: false, estadoVerificacion: 'Pendiente de revisión', referencia: d.referencia || '', costoVisita: 0,
          condiciones: '', alta: this.ahora(), precios: {}, galeria: [], dpiArchivo: d.dpiArchivo || ''
        };
        S.prestadores.push(pre);
        this.hist('Prestador', pre.id, 'Pendiente de revisión', cta.id);
        this.notificarRol('administrador', 'Prestador pendiente de revisión', per.nombre + ' envió su DPI y una referencia de trabajo.', 'a/prestador/' + pre.id);
      }
      return ok({ cuenta: cta });
    },

    // ---------- Solicitud (RF06) ----------
    /* clave: identificador único generado en el teléfono al preparar la solicitud.
     * Si el envío se repite (reintento), el sistema devuelve la solicitud ya creada y no la duplica. */
    crearSolicitud(d, prestadorIds, clave, actor) {
      const existente = S.solicitudes.find((s) => s.clave === clave);
      if (existente) {
        if (existente.clienteCuentaId !== actor) return falla('No se pudo registrar la solicitud. Intenta de nuevo.');
        return ok({ solicitud: existente, repetida: true });
      }
      if (!prestadorIds.length) return falla('Elige al menos un prestador.');
      if (prestadorIds.length > REGLAS.maxInvitaciones) return falla('Puedes invitar hasta ' + REGLAS.maxInvitaciones + ' prestadores.');
      const criterio = { oficioId: d.oficioId, modalidad: d.modalidad, sectorId: d.sectorId, horario: d.horario };
      const validos = this.buscar(criterio).filter((r) => r.disponible).map((r) => r.p.id);
      const fuera = prestadorIds.filter((id) => !validos.includes(id));
      if (fuera.length) return falla(fuera.map((id) => this.nombrePrestador(id)).join(', ') + ' ya no está disponible para ese sector u horario. Vuelve a los resultados.');

      const t = this.ahora();
      const sol = {
        id: this.nuevoId('sol'), folio: this.folio('SOL'), clienteCuentaId: actor, oficioId: d.oficioId, especialidadId: d.especialidadId,
        modalidad: d.modalidad, descripcion: d.descripcion.trim(), medidas: (d.medidas || '').trim(), sectorId: d.sectorId, direccion: d.direccion.trim(), referencia: (d.referencia || '').trim(),
        horario: d.horario, fotos: (d.fotos || []).slice(0, 3), estado: 'Solicitada', creada: t, clave, ubicacion: d.ubicacion || null
      };
      S.solicitudes.push(sol);
      this.hist('Solicitud', sol.id, 'Solicitada', actor);
      this._invitar(sol, prestadorIds);
      return ok({ solicitud: sol });
    },
    _invitar(sol, prestadorIds) {
      const plazo = this.plazos(sol.modalidad).invitacion;
      prestadorIds.forEach((pid) => {
        const inv = { id: this.nuevoId('inv'), solicitudId: sol.id, prestadorId: pid, estado: 'Pendiente', enviada: this.ahora(), venceEn: this.ahora() + plazo * MIN, respondida: null, motivo: '' };
        S.invitaciones.push(inv);
        const p = this.prestador(pid);
        this.notificar(p.cuentaId, 'Nueva invitación ' + sol.folio, this.oficio(sol.oficioId).nombre + ' · ' + this.sector(sol.sectorId).nombre + ' · responde antes de ' + (plazo >= 60 ? plazo / 60 + ' h' : plazo + ' min'), 'p/invitacion/' + inv.id);
      });
    },
    /* Excepción "sin prestadores": la solicitud vencida se reenvía con un toque a quienes sigan disponibles
     * y no la hayan rechazado antes. */
    reenviar(solId, actor) {
      const sol = this.solicitud(solId);
      if (sol.estado !== 'Vencida') return falla('Solo se reenvían solicitudes vencidas.');
      if (sol.modalidad === 'inmediata') sol.horario = { tipo: 'ahora' };
      const rechazaron = this.invitacionesDe(solId).filter((i) => i.estado === 'Rechazada').map((i) => i.prestadorId);
      const disponibles = this.buscar({ oficioId: sol.oficioId, modalidad: sol.modalidad, sectorId: sol.sectorId, horario: sol.horario })
        .filter((r) => r.disponible && !rechazaron.includes(r.p.id)).slice(0, REGLAS.maxInvitaciones).map((r) => r.p.id);
      if (!disponibles.length) return falla('No hay prestadores disponibles para ese sector y horario. Prueba otra fecha o franja.', 'sin-prestadores');
      sol.estado = 'Solicitada';
      this.hist('Solicitud', sol.id, 'Solicitada', actor, 'Reenviada a ' + disponibles.length + ' prestador(es)');
      this._invitar(sol, disponibles);
      this.guardar();
      return ok({ invitados: disponibles });
    },
    cancelarSolicitud(solId, actor, motivo) {
      const sol = this.solicitud(solId);
      if (!['Solicitada', 'En evaluación', 'Pendiente de aprobación'].includes(sol.estado)) return falla('Esta solicitud ya no se puede cancelar (' + sol.estado + ').');
      sol.estado = 'Cancelada';
      this.hist('Solicitud', sol.id, 'Cancelada', actor, motivo);
      this.invitacionesDe(solId).forEach((i) => {
        if (i.estado === 'Pendiente' || i.estado === 'Aceptada') {
          i.estado = 'Anulada';
          this.notificar(this.prestador(i.prestadorId).cuentaId, 'Solicitud cancelada ' + sol.folio, 'El cliente canceló la solicitud.', 'p/inicio');
        }
      });
      this.cotizacionesDe(solId).forEach((c) => {
        if (c.estado === 'Enviada' || c.estado === 'Borrador') { c.estado = 'Anulada'; this.hist('Cotización', c.id, 'Anulada', 'Sistema', 'Solicitud cancelada'); }
      });
      this.guardar();
      return ok();
    },

    // ---------- Invitación (RF07) ----------
    responderInvitacion(invId, aceptar, actor, motivo) {
      this.tick();
      const inv = this.invitacion(invId);
      const sol = this.solicitud(inv.solicitudId);
      if (inv.estado === 'Vencida') return falla('Esta invitación venció. El cliente ya no la verá.', 'vencida');
      if (inv.estado !== 'Pendiente') return falla('Esta invitación ya fue respondida o anulada (' + inv.estado + ').');
      if (!['Solicitada', 'En evaluación', 'Pendiente de aprobación'].includes(sol.estado)) return falla('La solicitud ya no está abierta (' + sol.estado + ').');
      inv.respondida = this.ahora();
      const quien = this.nombre(actor);
      if (aceptar) {
        inv.estado = 'Aceptada';
        if (sol.estado === 'Solicitada') { sol.estado = 'En evaluación'; this.hist('Solicitud', sol.id, 'En evaluación', actor); }
        this.notificar(sol.clienteCuentaId, quien + ' aceptó cotizar', sol.folio + ' · pronto recibirás su cotización.', 'c/solicitud/' + sol.id);
      } else {
        inv.estado = 'Rechazada';
        inv.motivo = motivo || '';
        this.notificar(sol.clienteCuentaId, quien + ' no puede atender', sol.folio + (motivo ? ' · ' + motivo : ''), 'c/solicitud/' + sol.id);
        this._revisarSinPrestadores(sol);
      }
      this.guardar();
      return ok();
    },
    _revisarSinPrestadores(sol) {
      if (sol.estado !== 'Solicitada') return;
      const invs = this.invitacionesDe(sol.id);
      const abiertas = invs.some((i) => i.estado === 'Pendiente' || i.estado === 'Aceptada');
      if (!abiertas) {
        sol.estado = 'Vencida';
        this.hist('Solicitud', sol.id, 'Vencida', 'Sistema', 'Ningún prestador aceptó a tiempo');
        this.notificar(sol.clienteCuentaId, 'Nadie respondió a tiempo', sol.folio + ' venció. Puedes reenviarla con un toque.', 'c/solicitud/' + sol.id);
      }
    },

    // ---------- Cotización (RF08) ----------
    tipoCotizacionInicial(sol) { return sol.modalidad === 'diagnostico' ? 'visita' : 'trabajo'; },
    guardarCotizacion(d, enviar, actor) {
      this.tick();
      const sol = this.solicitud(d.solicitudId);
      const lineas = (d.lineas || []).filter((l) => l.concepto.trim() || Number(l.monto) > 0)
        .map((l) => ({ categoria: l.categoria, concepto: l.concepto.trim(), monto: Math.round(Number(l.monto) * 100) / 100 }));
      if (enviar) {
        if (lineas.some((l) => !l.concepto)) return falla('Cada línea necesita una descripción.', 'datos');
        if (lineas.some((l) => !(l.monto >= 0) || isNaN(l.monto))) return falla('Los montos deben ser números mayores o iguales a cero.', 'datos');
        if (!lineas.some((l) => l.categoria === 'mano_obra' && l.monto > 0)) return falla('Agrega al menos una línea de mano de obra con monto.', 'datos');
      }
      let srv = d.servicioId ? this.servicio(d.servicioId) : null;
      if (!srv) {
        const inv = S.invitaciones.find((i) => i.solicitudId === sol.id && i.prestadorId === d.prestadorId);
        if (!inv || inv.estado !== 'Aceptada') return falla('Primero acepta la invitación para poder cotizar.');
        if (!['En evaluación', 'Pendiente de aprobación'].includes(sol.estado)) return falla('La solicitud ya no recibe cotizaciones (' + sol.estado + ').');
      } else if (srv.estado !== 'En ejecución') {
        return falla('Solo puedes cotizar dentro de un servicio en ejecución.');
      }
      let cot = d.id ? this.cotizacion(d.id) : null;
      if (cot && cot.estado !== 'Borrador') return falla('Esta cotización ya fue enviada y no se puede editar.');
      if (!cot) {
        cot = { id: this.nuevoId('cot'), folio: this.folio('COT'), solicitudId: sol.id, servicioId: srv ? srv.id : null, prestadorId: d.prestadorId, tipo: d.tipo, lineas: [], nota: '', tiempoEstimado: '', estado: 'Borrador', creada: this.ahora(), enviada: null, venceEn: null };
        S.cotizaciones.push(cot);
        this.hist('Cotización', cot.id, 'Borrador', actor);
      }
      cot.lineas = lineas; cot.nota = (d.nota || '').trim(); cot.tiempoEstimado = (d.tiempoEstimado || '').trim();
      if (enviar) {
        cot.estado = 'Enviada'; cot.enviada = this.ahora();
        cot.venceEn = this.ahora() + this.plazos(sol.modalidad).cotizacion * MIN;
        this.hist('Cotización', cot.id, 'Enviada', actor);
        const etiqueta = { visita: 'de visita', trabajo: 'de trabajo', adicional: 'adicional' }[cot.tipo];
        if (!srv && sol.estado === 'En evaluación') { sol.estado = 'Pendiente de aprobación'; this.hist('Solicitud', sol.id, 'Pendiente de aprobación', actor); }
        if (srv) this.hist('Servicio', srv.id, srv.estado, actor, 'Cotización ' + etiqueta + ' ' + cot.folio + ' enviada');
        this.notificar(sol.clienteCuentaId, 'Nueva cotización ' + etiqueta, this.nombre(actor) + ' · ' + this.dinero(this.totales(cot).total) + ' · ' + cot.folio, 'c/cotizacion/' + cot.id);
      }
      this.guardar();
      return ok({ cotizacion: cot });
    },

    /* Regla 2 (doble aceptación): al aprobar una cotización inicial, las demás se anulan; no se puede
     * aprobar si la solicitud ya está Confirmada; el prestador no puede tener dos servicios en la misma franja. */
    aprobarCotizacion(cotId, actor) {
      this.tick();
      const cot = this.cotizacion(cotId);
      const sol = this.solicitud(cot.solicitudId);
      if (cot.estado === 'Vencida') return falla('Esta cotización venció. Pide al prestador una nueva o invita a otro.', 'vencida');
      if (cot.estado !== 'Enviada') return falla('Esta cotización ya no se puede aprobar (' + cot.estado + ').');
      const p = this.prestador(cot.prestadorId);

      if (!cot.servicioId) {
        if (sol.estado === 'Confirmada') return falla('Esta solicitud ya tiene un prestador confirmado. No se pueden contratar dos.', 'doble');
        const ef = this.horarioEfectivo(sol.horario);
        if (sol.modalidad === 'inmediata' ? this.ocupadoAhora(p.id) : this.ocupado(p.id, ef.fecha, ef.franja)) return falla(this.nombre(p.cuentaId) + ' ya tiene un servicio confirmado en esa franja. Elige otra cotización.', 'franja');
        cot.estado = 'Aprobada';
        this.hist('Cotización', cot.id, 'Aprobada', actor);
        this.cotizacionesDe(sol.id).forEach((c) => {
          if (c.id !== cot.id && (c.estado === 'Enviada' || c.estado === 'Borrador')) {
            c.estado = 'Anulada';
            this.hist('Cotización', c.id, 'Anulada', 'Sistema', 'El cliente aprobó otra cotización');
            this.notificar(this.prestador(c.prestadorId).cuentaId, 'Cotización anulada ' + c.folio, 'El cliente eligió a otro prestador para ' + sol.folio + '.', 'p/inicio');
          }
        });
        this.invitacionesDe(sol.id).forEach((i) => {
          if (i.prestadorId !== p.id && (i.estado === 'Pendiente' || i.estado === 'Aceptada')) {
            i.estado = 'Anulada';
            if (!this.cotizacionesDe(sol.id).some((c) => c.prestadorId === i.prestadorId)) {
              this.notificar(this.prestador(i.prestadorId).cuentaId, 'Invitación cerrada ' + sol.folio, 'El cliente ya contrató a otro prestador.', 'p/inicio');
            }
          }
        });
        sol.estado = 'Confirmada';
        this.hist('Solicitud', sol.id, 'Confirmada', actor);
        const srv = {
          id: this.nuevoId('srv'), folio: this.folio('SRV'), solicitudId: sol.id, clienteCuentaId: sol.clienteCuentaId, prestadorId: p.id,
          cotizacionId: cot.id, estado: 'Confirmado', creado: this.ahora(), horario: ef, avances: [],
          pago: { estado: 'Pendiente', metodo: '', fecha: null }, finalizado: null, soloVisita: false, motivoCancelacion: ''
        };
        S.servicios.push(srv);
        this.hist('Servicio', srv.id, 'Confirmado', 'Sistema', cot.tipo === 'visita' ? 'Visita de diagnóstico confirmada' : '');
        this.notificar(p.cuentaId, 'Servicio confirmado ' + srv.folio, 'Ya puedes ver la dirección exacta. ' + this.sector(sol.sectorId).nombre + '.', 'p/servicio/' + srv.id);
        this.guardar();
        return ok({ servicio: srv });
      }

      const srv = this.servicio(cot.servicioId);
      cot.estado = 'Aprobada';
      this.hist('Cotización', cot.id, 'Aprobada', actor);
      this.hist('Servicio', srv.id, srv.estado, actor, 'Cotización ' + (cot.tipo === 'adicional' ? 'adicional' : 'de trabajo') + ' ' + cot.folio + ' aprobada');
      this.notificar(p.cuentaId, 'Cotización aprobada ' + cot.folio, 'Puedes continuar con el trabajo de ' + srv.folio + '.', 'p/servicio/' + srv.id);
      this.guardar();
      return ok({ servicio: srv });
    },
    rechazarCotizacion(cotId, actor, motivo) {
      this.tick();
      const cot = this.cotizacion(cotId);
      if (cot.estado !== 'Enviada') return falla('Esta cotización ya no se puede rechazar (' + cot.estado + ').');
      cot.estado = 'Rechazada';
      this.hist('Cotización', cot.id, 'Rechazada', actor, motivo);
      const p = this.prestador(cot.prestadorId);
      if (cot.servicioId) {
        const srv = this.servicio(cot.servicioId);
        if (cot.tipo === 'trabajo') {
          // Caso diagnóstico: el cliente rechaza el trabajo, el servicio se finaliza cobrando solo la visita
          srv.estado = 'Finalizado'; srv.finalizado = this.ahora(); srv.soloVisita = true;
          this.hist('Servicio', srv.id, 'Finalizado', 'Sistema', 'Cliente rechazó la cotización de trabajo; se cobra solo la visita');
          this.notificar(p.cuentaId, 'Trabajo rechazado ' + cot.folio, srv.folio + ' finalizó cobrando solo la visita. Marca el pago cuando lo recibas.', 'p/servicio/' + srv.id);
        } else {
          this.hist('Servicio', srv.id, srv.estado, actor, 'Cotización adicional ' + cot.folio + ' rechazada');
          this.notificar(p.cuentaId, 'Adicional rechazado ' + cot.folio, 'El cliente no aprobó el trabajo adicional.', 'p/servicio/' + srv.id);
        }
      } else {
        this.notificar(p.cuentaId, 'Cotización rechazada ' + cot.folio, motivo || 'El cliente no aprobó tu cotización.', 'p/inicio');
      }
      this.guardar();
      return ok();
    },

    // ---------- Servicio (RF09) ----------
    iniciarServicio(srvId, actor) {
      const srv = this.servicio(srvId);
      if (srv.estado !== 'Confirmado') return falla('Solo se inicia un servicio confirmado.');
      srv.estado = 'En ejecución';
      this.hist('Servicio', srv.id, 'En ejecución', actor);
      const sol = this.solicitud(srv.solicitudId);
      this.notificar(srv.clienteCuentaId, 'Servicio en ejecución ' + srv.folio, this.nombre(actor) + (sol.modalidad === 'diagnostico' ? ' llegó para el diagnóstico.' : ' empezó el trabajo.'), 'c/servicio/' + srv.id);
      this.guardar();
      return ok();
    },
    /* Dirección y ubicación guardadas en la cuenta para no escribirlas cada vez */
    guardarDireccion(cuentaId, d) {
      const c = this.cuenta(cuentaId);
      c.guardada = d ? { direccion: d.direccion, referencia: d.referencia || '', lat: d.lat == null ? null : d.lat, lng: d.lng == null ? null : d.lng } : null;
      this.guardar();
      return ok();
    },
    /* Mejora de las entrevistas: el prestador avisa que va en camino y cuánto tarda en llegar */
    marcarEnCamino(srvId, minutos, actor) {
      const srv = this.servicio(srvId);
      if (srv.estado !== 'Confirmado') return falla('Solo se avisa la llegada de un servicio confirmado que aún no empezó.');
      const m = Number(minutos);
      if (![10, 20, 30, 45, 60].includes(m)) return falla('Elige cuánto tardas en llegar.', 'datos');
      srv.enCamino = { fecha: this.ahora(), minutos: m };
      const llega = new Date(this.ahora() + m * MIN);
      const hora = String(llega.getHours()).padStart(2, '0') + ':' + String(llega.getMinutes()).padStart(2, '0');
      this.hist('Servicio', srv.id, 'Confirmado', actor, 'En camino, llega aprox. a las ' + hora);
      this.notificar(srv.clienteCuentaId, this.nombre(actor) + ' va en camino', srv.folio + ' · llega aproximadamente a las ' + hora + '.', 'c/servicio/' + srv.id);
      this.guardar();
      return ok();
    },
    registrarAvance(srvId, texto, actor) {
      const srv = this.servicio(srvId);
      if (srv.estado !== 'En ejecución') return falla('Solo se registran avances en servicios en ejecución.');
      if (!texto.trim()) return falla('Escribe qué avanzaste.', 'datos');
      srv.avances.push({ fecha: this.ahora(), texto: texto.trim() });
      this.hist('Servicio', srv.id, 'En ejecución', actor, 'Avance: ' + texto.trim());
      this.notificar(srv.clienteCuentaId, 'Avance en ' + srv.folio, texto.trim(), 'c/servicio/' + srv.id);
      this.guardar();
      return ok();
    },
    pendientesDeServicio(srv) {
      return this.cotizacionesDeServicio(srv).filter((c) => c.estado === 'Enviada' || c.estado === 'Borrador');
    },
    finalizarServicio(srvId, actor, pago) {
      const srv = this.servicio(srvId);
      if (srv.estado !== 'En ejecución') return falla('Solo se finaliza un servicio en ejecución.');
      const pend = this.pendientesDeServicio(srv);
      if (pend.some((c) => c.estado === 'Enviada')) return falla('Hay una cotización esperando respuesta del cliente. Espera su decisión antes de finalizar.');
      if (pend.length) return falla('Tienes una cotización en borrador. Envíala o elimínala antes de finalizar.');
      const sol = this.solicitud(srv.solicitudId);
      const cotsTrabajo = this.cotizacionesDeServicio(srv).filter((c) => c.tipo === 'trabajo' && c.servicioId === srv.id);
      srv.soloVisita = sol.modalidad === 'diagnostico' && !cotsTrabajo.some((c) => c.estado === 'Aprobada');
      srv.estado = 'Finalizado'; srv.finalizado = this.ahora();
      if (pago && pago.metodo) srv.pago = { estado: 'Pagado', metodo: pago.metodo, fecha: this.ahora() };
      this.hist('Servicio', srv.id, 'Finalizado', actor, srv.soloVisita ? 'Se cobra solo la visita' : '');
      this.notificar(srv.clienteCuentaId, 'Servicio finalizado ' + srv.folio, 'Califica a ' + this.nombre(actor) + '. Tienes ' + REGLAS.diasParaCalificar + ' días.', 'c/servicio/' + srv.id);
      this.guardar();
      return ok();
    },
    marcarPagado(srvId, metodo, actor) {
      const srv = this.servicio(srvId);
      if (srv.estado !== 'Finalizado') return falla('El pago se marca al cerrar el servicio.');
      if (!metodo) return falla('Elige cómo te pagaron.', 'datos');
      srv.pago = { estado: 'Pagado', metodo, fecha: this.ahora() };
      this.hist('Servicio', srv.id, 'Finalizado', actor, 'Pago registrado: ' + metodo);
      this.guardar();
      return ok();
    },
    cancelarServicio(srvId, actor, motivo) {
      const srv = this.servicio(srvId);
      if (srv.estado !== 'Confirmado') return falla('Solo se cancela un servicio confirmado que aún no empezó. Si ya empezó, abre un reclamo.');
      if (!motivo || !motivo.trim()) return falla('Indica el motivo de la cancelación.', 'datos');
      srv.estado = 'Cancelado'; srv.motivoCancelacion = motivo.trim();
      this.hist('Servicio', srv.id, 'Cancelado', actor, motivo.trim());
      const otro = actor === srv.clienteCuentaId ? this.prestador(srv.prestadorId).cuentaId : srv.clienteCuentaId;
      const ir = actor === srv.clienteCuentaId ? 'p/servicio/' + srv.id : 'c/servicio/' + srv.id;
      this.notificar(otro, 'Servicio cancelado ' + srv.folio, this.nombre(actor) + ': ' + motivo.trim(), ir);
      this.guardar();
      return ok();
    },

    // ---------- Comunicación (RF10) ----------
    mensajesDe(solId, pid) {
      return S.mensajes.filter((m) => m.solicitudId === solId && m.prestadorId === pid).sort((a, b) => a.fecha - b.fecha);
    },
    enviarMensaje(solId, pid, texto, actor, foto) {
      texto = String(texto || '');
      if (!texto.trim() && !foto) return falla('Escribe un mensaje o adjunta una foto.', 'datos');
      if (texto.length > 400) return falla('El mensaje es demasiado largo.', 'datos');
      S.mensajes.push({ id: this.nuevoId('msg'), solicitudId: solId, prestadorId: pid, deCuentaId: actor, texto: texto.trim(), foto: foto || '', fecha: this.ahora() });
      texto = texto.trim() || 'Te envió una foto';
      const sol = this.solicitud(solId);
      const p = this.prestador(pid);
      const srv = this.servicioDeSolicitud(solId);
      if (actor === sol.clienteCuentaId) {
        const inv = S.invitaciones.find((i) => i.solicitudId === solId && i.prestadorId === pid);
        this.notificar(p.cuentaId, 'Mensaje de ' + this.nombre(actor), texto.trim(), srv && srv.prestadorId === pid ? 'p/servicio/' + srv.id : 'p/invitacion/' + (inv ? inv.id : ''));
      } else {
        this.notificar(sol.clienteCuentaId, 'Mensaje de ' + this.nombre(actor), texto.trim(), srv && srv.prestadorId === pid ? 'c/servicio/' + srv.id : 'c/solicitud/' + solId);
      }
      this.guardar();
      return ok();
    },

    // ---------- Calificación (RF12, regla 5) ----------
    puedeCalificar(srvId, cuentaId) {
      const srv = this.servicio(srvId);
      if (srv.estado !== 'Finalizado') return falla('Solo se califican servicios finalizados.');
      const p = this.prestador(srv.prestadorId);
      if (cuentaId !== srv.clienteCuentaId && cuentaId !== p.cuentaId) return falla('Solo participan el cliente y el prestador del servicio.');
      if (S.calificaciones.some((c) => c.servicioId === srvId && c.deCuentaId === cuentaId)) return falla('Ya calificaste este servicio. La calificación no se puede editar.', 'hecha');
      if (this.ahora() > srv.finalizado + REGLAS.diasParaCalificar * DIA) return falla('El plazo de ' + REGLAS.diasParaCalificar + ' días para calificar ya venció.', 'plazo');
      return ok();
    },
    calificar(srvId, cuentaId, estrellas, comentario) {
      const v = this.puedeCalificar(srvId, cuentaId);
      if (!v.ok) return v;
      if (!(estrellas >= 1 && estrellas <= 5)) return falla('Elige de 1 a 5 estrellas.', 'datos');
      const srv = this.servicio(srvId);
      const p = this.prestador(srv.prestadorId);
      const aCuentaId = cuentaId === srv.clienteCuentaId ? p.cuentaId : srv.clienteCuentaId;
      const retenida = !!this.reclamoAbiertoDe(srvId);
      S.calificaciones.push({ id: this.nuevoId('cal'), servicioId: srvId, deCuentaId: cuentaId, aCuentaId, estrellas, comentario: (comentario || '').trim(), fecha: this.ahora(), publicada: !retenida });
      this.guardar();
      return ok({ retenida });
    },

    // ---------- Reclamos (RF11) ----------
    abrirReclamo(srvId, actor, motivo, descripcion, evidencia) {
      const srv = this.servicio(srvId);
      if (!['En ejecución', 'Finalizado'].includes(srv.estado)) return falla('Solo se reclama sobre servicios en ejecución o finalizados.');
      if (this.reclamoAbiertoDe(srvId)) return falla('Ya hay un reclamo abierto para este servicio.');
      if (!motivo) return falla('Elige el motivo del reclamo.', 'datos');
      if (!descripcion || descripcion.trim().length < 15) return falla('Describe lo que pasó (al menos 15 caracteres).', 'datos');
      if (!O.MOTIVOS_RECLAMO_LISTA.includes(motivo)) return falla('Elige un motivo válido.', 'datos');
      const rec = { id: this.nuevoId('rec'), folio: this.folio('REC'), servicioId: srvId, abiertoPor: actor, motivo, descripcion: descripcion.trim().slice(0, 1000), evidencia: (evidencia || []).slice(0, 3), estado: 'Abierto', creado: this.ahora(), resolucion: '', notas: [] };
      S.reclamos.push(rec);
      this.hist('Reclamo', rec.id, 'Abierto', actor);
      // Mientras el reclamo esté abierto, las calificaciones del servicio no se publican
      S.calificaciones.forEach((c) => { if (c.servicioId === srvId) c.publicada = false; });
      this.notificarRol('soporte', 'Nuevo reclamo ' + rec.folio, motivo + ' · ' + srv.folio, 's/reclamo/' + rec.id);
      const otro = actor === srv.clienteCuentaId ? this.prestador(srv.prestadorId).cuentaId : srv.clienteCuentaId;
      this.notificar(otro, 'Reclamo abierto sobre ' + srv.folio, 'Soporte revisará el caso y te contactará.', '');
      this.guardar();
      return ok({ reclamo: rec });
    },
    transicionReclamo(recId, estado, actor, nota) {
      const rec = this.reclamo(recId);
      const permitidas = { 'Abierto': ['En revisión'], 'En revisión': ['Resuelto'], 'Resuelto': ['Cerrado'] };
      if (!(permitidas[rec.estado] || []).includes(estado)) return falla('No se puede pasar de ' + rec.estado + ' a ' + estado + '.');
      if (estado === 'Resuelto' && (!nota || nota.trim().length < 10)) return falla('Escribe la resolución (al menos 10 caracteres).', 'datos');
      rec.estado = estado;
      if (estado === 'Resuelto') rec.resolucion = nota.trim();
      else if (nota) rec.notas.push({ fecha: this.ahora(), texto: nota.trim(), actor });
      this.hist('Reclamo', rec.id, estado, actor, nota);
      const srv = this.servicio(rec.servicioId);
      if (estado === 'Resuelto') {
        S.calificaciones.forEach((c) => { if (c.servicioId === srv.id) c.publicada = true; });
      }
      const partes = [srv.clienteCuentaId, this.prestador(srv.prestadorId).cuentaId];
      partes.forEach((c) => this.notificar(c, 'Reclamo ' + rec.folio + ': ' + estado, estado === 'Resuelto' ? rec.resolucion : 'Soporte actualizó tu reclamo.', ''));
      this.guardar();
      return ok();
    },

    // ---------- Prestador (RF02) ----------
    actualizarPerfil(pid, d) {
      const p = this.prestador(pid);
      if (!d.cobertura.length) return falla('Elige al menos un sector de cobertura.', 'datos');
      if (!d.dias.length || !d.franjas.length) return falla('Elige al menos un día y una franja de atención.', 'datos');
      if (!d.especialidades.length) return falla('Elige al menos una especialidad.', 'datos');
      const espValidas = S.especialidades.filter((e) => e.oficioId === p.oficioId).map((e) => e.id);
      p.cobertura = d.cobertura.filter((x) => O.SECTORES.some((s) => s.id === x));
      p.disponibilidad = { dias: d.dias.map(Number).filter((x) => x >= 0 && x <= 6), franjas: d.franjas.filter((f) => FRANJAS.some((x) => x.id === f)) };
      p.especialidades = d.especialidades.filter((x) => espValidas.includes(x));
      p.descripcion = String(d.descripcion || '').trim().slice(0, 600); p.condiciones = String(d.condiciones || '').trim().slice(0, 400);
      p.experiencia = Math.max(0, Math.min(60, Number(d.experiencia) || 0)); p.costoVisita = Math.max(0, Number(d.costoVisita) || 0);
      const precios = {};
      Object.entries(d.precios || {}).forEach(([k, v]) => { if (p.especialidades.includes(k) && Number(v) > 0) precios[k] = Math.round(Number(v) * 100) / 100; });
      p.precios = precios;
      this.guardar();
      return ok();
    },
    /* Mejora de las entrevistas: fotos de trabajos anteriores en el perfil */
    agregarGaleria(pid, archivoId, descripcion) {
      const p = this.prestador(pid);
      p.galeria = p.galeria || [];
      if (p.galeria.length >= 12) return falla('Puedes tener hasta 12 fotos en tu galería. Quita alguna primero.');
      p.galeria.push({ archivo: archivoId, descripcion: String(descripcion || '').trim().slice(0, 120) });
      this.guardar();
      return ok();
    },
    quitarGaleria(pid, archivoId) {
      const p = this.prestador(pid);
      p.galeria = (p.galeria || []).filter((g) => g.archivo !== archivoId);
      this.guardar();
      return ok();
    },
    setDisponibleAhora(pid, v) { this.prestador(pid).disponibleAhora = v; this.guardar(); },

    // ---------- Administración (RF03, RF14) ----------
    verificar(pid, estado, actor, nota) {
      const p = this.prestador(pid);
      if (!['Verificado', 'Observado', 'Suspendido'].includes(estado)) return falla('Estado no válido.');
      if (estado !== 'Verificado' && (!nota || !nota.trim())) return falla('Escribe qué debe corregir o por qué se suspende.', 'datos');
      p.estadoVerificacion = estado;
      this.hist('Prestador', p.id, estado, actor, nota);
      const textos = {
        'Verificado': 'Tu identidad y referencia fueron revisadas. Ya apareces en las búsquedas.',
        'Observado': 'Revisa lo que falta: ' + (nota || ''),
        'Suspendido': 'Tu perfil fue suspendido: ' + (nota || '')
      };
      this.notificar(p.cuentaId, 'Verificación: ' + estado, textos[estado], 'p/perfil');
      this.guardar();
      return ok();
    },
    agregarOficio(nombre, modalidades) {
      const n = String(nombre || '').trim();
      if (n.length < 3) return falla('Escribe el nombre del oficio.', 'datos');
      if (S.oficios.some((o) => o.nombre.toLowerCase() === n.toLowerCase())) return falla('Ese oficio ya existe.');
      if (!modalidades.length) return falla('Elige al menos una modalidad.', 'datos');
      S.oficios.push({ id: this.nuevoId('of'), nombre: n, icono: 'tool', modalidades, activo: true, enPrototipo: true });
      this.guardar();
      return ok();
    },
    agregarEspecialidad(oficioId, nombre) {
      const n = String(nombre || '').trim();
      if (n.length < 3) return falla('Escribe el nombre de la especialidad.', 'datos');
      if (S.especialidades.some((e) => e.oficioId === oficioId && e.nombre.toLowerCase() === n.toLowerCase())) return falla('Esa especialidad ya existe en el oficio.');
      S.especialidades.push({ id: this.nuevoId('esp'), oficioId, nombre: n });
      this.guardar();
      return ok();
    },
    alternarOficio(oficioId) { const o = this.oficio(oficioId); o.activo = !o.activo; this.guardar(); return ok(); },
    alternarCuenta(cuentaId) {
      const c = this.cuenta(cuentaId);
      if (c.roles.includes('administrador')) return falla('No se puede suspender una cuenta de administración desde aquí.');
      c.estado = c.estado === 'Activa' ? 'Suspendida' : 'Activa';
      this.guardar();
      return ok();
    },
    /* Una cuenta puede ser cliente y prestador a la vez; administrador y soporte no se combinan con prestador. */
    agregarRol(cuentaId, rol) {
      const c = this.cuenta(cuentaId);
      if (c.roles.includes(rol)) return falla('La cuenta ya tiene ese rol.');
      const internos = ['administrador', 'soporte'];
      if (rol === 'prestador' && c.roles.some((r) => internos.includes(r))) return falla('Administrador y soporte no se combinan con prestador.');
      if (internos.includes(rol) && c.roles.includes('prestador')) return falla('Administrador y soporte no se combinan con prestador.');
      c.roles.push(rol);
      this.guardar();
      return ok();
    },

    // ---------- Indicadores (para el panel y el apartado 7) ----------
    indicadores() {
      const enviadas = S.solicitudes.length;
      const atendidas = S.servicios.filter((s) => s.estado === 'Finalizado').length;
      const aceptadas = S.invitaciones.filter((i) => i.respondida && i.estado !== 'Rechazada' && i.estado !== 'Vencida');
      const tiempoProm = aceptadas.length ? aceptadas.reduce((a, i) => a + (i.respondida - i.enviada), 0) / aceptadas.length / MIN : 0;
      const canceladas = S.solicitudes.filter((s) => s.estado === 'Cancelada').length + S.servicios.filter((s) => s.estado === 'Cancelado').length;
      const vencidas = S.solicitudes.filter((s) => s.estado === 'Vencida').length;
      const reclamos = S.reclamos.length;
      const reclamosAbiertos = S.reclamos.filter((r) => r.estado === 'Abierto' || r.estado === 'En revisión').length;
      return {
        enviadas, atendidas, pctAtendidas: enviadas ? Math.round((atendidas / enviadas) * 100) : 0,
        tiempoProm: Math.round(tiempoProm), canceladas, pctCanceladas: enviadas ? Math.round((canceladas / enviadas) * 100) : 0,
        vencidas, reclamos, reclamosAbiertos, pctReclamos: atendidas ? Math.round((reclamos / atendidas) * 100) : 0
      };
    },
    /* Regla 4 (ingresos): 8 % sobre la mano de obra de servicios finalizados, cobrada al prestador.
     * No se cobra sobre materiales ni al cliente. El primer mes desde el alta no paga comisión. */
    comisionServicio(srv) {
      const p = this.prestador(srv.prestadorId);
      const cots = this.cotizacionesDeServicio(srv).filter((c) => c.estado === 'Aprobada');
      const mano = cots.reduce((a, c) => a + this.totales(c).mano_obra, 0);
      const materiales = cots.reduce((a, c) => a + this.totales(c).materiales, 0);
      const cargos = cots.reduce((a, c) => a + this.totales(c).cargos, 0);
      const exenta = srv.finalizado - p.alta < REGLAS.mesesSinComision * 30 * DIA;
      return { mano, materiales, cargos, total: mano + materiales + cargos, exenta, comision: exenta ? 0 : Math.round(mano * REGLAS.comision * 100) / 100 };
    },
    comisiones() {
      const fin = S.servicios.filter((s) => s.estado === 'Finalizado');
      const porPrestador = {};
      fin.forEach((s) => {
        const c = this.comisionServicio(s);
        const r = porPrestador[s.prestadorId] || (porPrestador[s.prestadorId] = { servicios: 0, mano: 0, comision: 0, exentos: 0 });
        r.servicios += 1; r.mano += c.mano; r.comision += c.comision; if (c.exenta) r.exentos += 1;
      });
      return porPrestador;
    },

    // ---------- Vencimientos (regla 3) ----------
    tick() {
      const t = this.ahora();
      let cambios = false;
      S.invitaciones.forEach((i) => {
        if (i.estado === 'Pendiente' && t > i.venceEn) {
          i.estado = 'Vencida'; cambios = true;
          const sol = this.solicitud(i.solicitudId);
          this.notificar(this.prestador(i.prestadorId).cuentaId, 'Invitación vencida ' + sol.folio, 'No respondiste a tiempo.', 'p/inicio');
        }
      });
      S.solicitudes.forEach((sol) => {
        if (sol.estado === 'Solicitada') {
          const before = sol.estado; this._revisarSinPrestadores(sol); if (sol.estado !== before) cambios = true;
        }
      });
      S.cotizaciones.forEach((c) => {
        if (c.estado === 'Enviada' && c.venceEn && t > c.venceEn) {
          c.estado = 'Vencida'; cambios = true;
          this.hist('Cotización', c.id, 'Vencida', 'Sistema', 'El cliente no respondió a tiempo');
          this.notificar(this.prestador(c.prestadorId).cuentaId, 'Cotización vencida ' + c.folio, 'El cliente no respondió a tiempo.', 'p/inicio');
          const sol = this.solicitud(c.solicitudId);
          if (c.servicioId) {
            const srv = this.servicio(c.servicioId);
            if (c.tipo === 'trabajo' && srv.estado === 'En ejecución') {
              srv.estado = 'Finalizado'; srv.finalizado = t; srv.soloVisita = true;
              this.hist('Servicio', srv.id, 'Finalizado', 'Sistema', 'La cotización de trabajo venció; se cobra solo la visita');
            }
          } else if (sol.estado === 'Pendiente de aprobación') {
            const vivas = this.cotizacionesDe(sol.id).some((x) => x.estado === 'Enviada');
            const esperando = this.invitacionesDe(sol.id).some((i) => i.estado === 'Pendiente' || (i.estado === 'Aceptada' && !this.cotizacionesDe(sol.id).some((x) => x.prestadorId === i.prestadorId && x.estado !== 'Borrador')));
            if (!vivas && !esperando) {
              sol.estado = 'Vencida';
              this.hist('Solicitud', sol.id, 'Vencida', 'Sistema', 'Las cotizaciones vencieron sin aprobación');
              this.notificar(sol.clienteCuentaId, 'Tu solicitud venció', sol.folio + ': las cotizaciones vencieron. Puedes reenviarla.', 'c/solicitud/' + sol.id);
            }
          }
        }
      });
      if (cambios) this.guardar();
      return cambios;
    },

    dinero(n) {
      return 'Q ' + Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  };

  O.Store = Store;
})();
