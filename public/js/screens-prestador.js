/* Ofira · Interfaz del prestador: solicitudes recibidas, cotizaciones, servicios, agenda y perfil. */
(function () {
  'use strict';
  const O = window.Ofira;
  const { h, icon, estado, fotos, calif, avatar, fecha, fechaCorta, hace, cuenta, horarioTexto, vacio, aviso, cotTabla, timeline, mapa } = O.UI;
  const St = O.Store;
  const U = O.UIState;
  const app = () => O.App;
  const ruta = (d) => O.Rutas.push(d);
  const { err, resumenErrores, cabecera } = O.Form;

  function yoP() { return St.prestadorDeCuenta(app().yo().id); }
  function cotizacionInicialDe(sol, pid) {
    return St.cotizacionesDe(sol.id).find((c) => c.prestadorId === pid && !c.servicioId);
  }
  function porCotizar(inv) {
    if (inv.estado !== 'Aceptada') return false;
    const s = St.solicitud(inv.solicitudId);
    const c = cotizacionInicialDe(s, inv.prestadorId);
    return ['En evaluación', 'Pendiente de aprobación'].includes(s.estado) && (!c || c.estado === 'Borrador');
  }

  /* Tarjeta de solicitud recibida (invitación) */
  function tarjetaInv(i) {
    const s = St.solicitud(i.solicitudId);
    const cliente = St.nombre(s.clienteCuentaId);
    return h`<button class="job ${i.estado === 'Pendiente' ? 'hl' : ''}" data-go="p/invitacion/${i.id}" id="inv-${i.id}">
      <div class="job-top"><span class="tag">${St.oficio(s.oficioId).nombre} · ${O.MODALIDADES[s.modalidad].nombre}</span><b>${St.especialidad(s.especialidadId).nombre}</b></div>
      <div class="job-body">
        <div class="row gap-s">${avatar(cliente, 's')}<div class="grow"><b class="small">${cliente.split(' ')[0]}</b><small class="muted">${icon('pin')}${St.sector(s.sectorId).nombre}</small></div>${estado(i.estado)}</div>
        <div class="job-meta"><span>Horario</span><span>Folio</span><b>${horarioTexto(s.horario)}</b><b class="num">${s.folio}</b></div>
        ${i.estado === 'Pendiente' ? cuenta(i.venceEn, 'Responde en') : porCotizar(i) ? h`<span class="act-t small">${icon('file')}Falta enviar tu cotización</span>` : ''}
      </div>
    </button>`;
  }

  ruta({
    patron: 'p/inicio', rol: 'prestador', nav: 'inicio', titulo: () => 'Inicio',
    render: () => {
      St.tick();
      const p = yoP();
      const yo = app().yo();
      const invs = St.S.invitaciones.filter((i) => i.prestadorId === p.id);
      const pendientes = invs.filter((i) => i.estado === 'Pendiente').sort((a, b) => a.venceEn - b.venceEn);
      const cotizar = invs.filter(porCotizar);
      const enviadas = St.S.cotizaciones.filter((c) => c.prestadorId === p.id && c.estado === 'Enviada');
      const activos = St.S.servicios.filter((s) => s.prestadorId === p.id && (s.estado === 'Confirmado' || s.estado === 'En ejecución'));
      const com = St.comisiones()[p.id] || { servicios: 0, mano: 0, comision: 0, exentos: 0 };
      const primerMes = St.ahora() - p.alta < O.REGLAS.mesesSinComision * 30 * O.DIA;
      return h`<div class="stack">
        <div class="page-head"><div><p class="eyebrow">${St.oficio(p.oficioId).nombre}</p><h1 class="h1">Hola, ${St.persona(yo.personaId).nombre.split(' ')[0]}</h1></div>${estado(p.estadoVerificacion, 'lg')}</div>
        ${p.estadoVerificacion !== 'Verificado' ? aviso(p.estadoVerificacion === 'Suspendido' ? 'bad' : 'act', 'shield', h`<b>${p.estadoVerificacion}.</b> ${p.estadoVerificacion === 'Pendiente de revisión' ? 'El administrador está revisando tu DPI y tu referencia. Aún no apareces en las búsquedas.' : 'No apareces en las búsquedas. Revisa tus avisos.'}`) : ''}
        <label class="switch card"><span><b>Disponible ahora</b><small class="muted">Para solicitudes inmediatas. Apágalo si no puedes salir.</small></span>
          <input type="checkbox" role="switch" data-change="disponible-ahora" id="sw-disponible" ${p.disponibleAhora ? 'checked' : ''}><span class="sw" aria-hidden="true"></span></label>
        <div class="stats-row">
          <button class="stat gold" data-go="p/solicitudes">${icon('file')}<div><b>${pendientes.length}</b><span>Solicitudes nuevas</span></div></button>
          <button class="stat" data-go="p/cotizaciones">${icon('money')}<div><b>${enviadas.length}</b><span>Esperando al cliente</span></div></button>
          <button class="stat" data-go="p/servicios">${icon('tool')}<div><b>${activos.length}</b><span>Servicios activos</span></div></button>
          <button class="stat dark" data-go="p/calificaciones">${icon('star')}<div><b>${St.calificacionPromedio(p.id).n ? St.calificacionPromedio(p.id).prom.toFixed(1) : '–'}</b><span>Tu calificación</span></div></button>
        </div>
        <section><div class="row between"><h2 class="h2">Solicitudes nuevas ${pendientes.length ? h`<span class="count">${pendientes.length}</span>` : ''}</h2><button class="btn btn-link btn-s" data-go="p/solicitudes">Ver todas</button></div>
          ${pendientes.length ? h`<div class="grid-3">${pendientes.map(tarjetaInv)}</div>` : vacio('file', 'No tienes solicitudes por responder', 'Cuando un cliente te invite a cotizar, aparecerá aquí con el tiempo que tienes para responder.')}</section>
        ${cotizar.length ? h`<section><h2 class="h2">Por cotizar</h2><div class="grid-3">${cotizar.map(tarjetaInv)}</div></section>` : ''}
        <div class="grid-2">
          <section><h2 class="h2">Servicios activos</h2>${activos.length ? h`<div class="list">${activos.map((s) => O.filaServicio(s, 'prestador'))}</div>` : h`<p class="muted small">Sin servicios activos.</p>`}</section>
          <section class="card"><h2 class="h2">Tus números</h2>
            <div class="stats"><div><b>${com.servicios}</b><span>finalizados</span></div><div><b class="num">${St.dinero(com.mano)}</b><span>mano de obra</span></div><div><b class="num">${St.dinero(com.comision)}</b><span>comisión 8 %</span></div></div>
            <p class="small muted" style="margin-top:10px">La comisión es del 8 % sobre la mano de obra y se cobra mensualmente, fuera de la app. No aplica a materiales. ${primerMes ? h`<b>Estás en tu primer mes: no pagas comisión.</b>` : ''}</p>
          </section>
        </div>
      </div>`;
    }
  });

  ruta({
    patron: 'p/solicitudes', rol: 'prestador', nav: 'solicitudes', titulo: () => 'Solicitudes recibidas',
    render: () => {
      St.tick();
      const p = yoP();
      const invs = St.S.invitaciones.filter((i) => i.prestadorId === p.id).sort((a, b) => b.enviada - a.enviada);
      const grupos = { nuevas: invs.filter((i) => i.estado === 'Pendiente'), aceptadas: invs.filter((i) => i.estado === 'Aceptada'), cerradas: invs.filter((i) => !['Pendiente', 'Aceptada'].includes(i.estado)) };
      const tab = U.tabInv || 'nuevas';
      const nombres = { nuevas: 'Nuevas', aceptadas: 'Aceptadas', cerradas: 'Cerradas' };
      return h`<div class="stack">
        ${cabecera('Solicitudes recibidas', 'Acepta para cotizar, rechaza o deja vencer. Tienes 30 minutos en inmediata y 24 horas en las demás modalidades.')}
        <div class="tabs" role="tablist">${Object.keys(grupos).map((k) => h`<button role="tab" aria-selected="${tab === k}" class="tab ${tab === k ? 'on' : ''}" data-act="tab-inv" data-v="${k}">${nombres[k]} (${grupos[k].length})</button>`)}</div>
        ${grupos[tab].length ? h`<div class="grid-3">${grupos[tab].map(tarjetaInv)}</div>` : vacio('file', 'Nada por aquí', 'Las solicitudes aparecerán aquí cuando un cliente te invite.')}
      </div>`;
    }
  });

  ruta({
    patron: 'p/cotizaciones', rol: 'prestador', nav: 'cotizaciones', titulo: () => 'Mis cotizaciones',
    render: () => {
      const p = yoP();
      const cots = St.S.cotizaciones.filter((c) => c.prestadorId === p.id).sort((a, b) => (b.creada || 0) - (a.creada || 0));
      const ir = (c) => c.servicioId ? 'p/servicio/' + c.servicioId : (St.servicioDeSolicitud(c.solicitudId) && St.servicioDeSolicitud(c.solicitudId).prestadorId === p.id ? 'p/servicio/' + St.servicioDeSolicitud(c.solicitudId).id : 'p/invitacion/' + St.S.invitaciones.find((i) => i.solicitudId === c.solicitudId && i.prestadorId === p.id).id);
      return h`<div class="stack">
        ${cabecera('Mis cotizaciones', 'El cliente tiene 15 minutos para aprobar en inmediata y 72 horas en las demás modalidades.')}
        ${cots.length ? h`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Folio</th><th>Tipo</th><th>Solicitud</th><th>Cliente</th><th>Mano de obra</th><th>Total</th><th>Estado</th></tr></thead><tbody>
          ${cots.map((c) => { const s = St.solicitud(c.solicitudId); const t = St.totales(c); return h`<tr class="link" data-go="${ir(c)}" style="cursor:pointer"><td class="num">${c.folio}</td><td>${{ visita: 'Visita', trabajo: 'Trabajo', adicional: 'Adicional' }[c.tipo]}</td><td class="num">${s.folio}</td><td>${St.nombre(s.clienteCuentaId)}</td><td class="num">${St.dinero(t.mano_obra)}</td><td class="num"><b>${St.dinero(t.total)}</b></td><td>${estado(c.estado)}</td></tr>`; })}
        </tbody></table></div>` : vacio('money', 'Aún no has cotizado', 'Acepta una solicitud y prepara tu primera cotización.')}
      </div>`;
    }
  });

  ruta({
    patron: 'p/invitacion/:id', rol: 'prestador', nav: 'solicitudes', back: 'p/solicitudes', titulo: (pr) => St.solicitud(St.invitacion(pr.id).solicitudId).folio,
    render: (pr) => {
      St.tick();
      const i = St.invitacion(pr.id);
      const s = St.solicitud(i.solicitudId);
      const p = yoP();
      const c = cotizacionInicialDe(s, p.id);
      const srv = St.servicioDeSolicitud(s.id);
      const cliente = St.nombre(s.clienteCuentaId);
      const tipo = St.tipoCotizacionInicial(s);
      const plazos = St.plazos(s.modalidad);
      return h`<div class="cols">
        <div class="stack">
          <div class="row between"><div><p class="eyebrow">${O.MODALIDADES[s.modalidad].nombre} · ${s.folio}</p><h1 class="h1">${St.especialidad(s.especialidadId).nombre}</h1></div>${estado(i.estado, 'lg')}</div>
          ${i.estado === 'Pendiente' ? h`<div class="note note-act">${icon('clock')}<div>Tienes ${plazos.invitacion >= 60 ? plazos.invitacion / 60 + ' horas' : plazos.invitacion + ' minutos'} para responder. ${cuenta(i.venceEn, 'Quedan')}</div></div>` : ''}
          ${i.estado === 'Vencida' ? aviso('bad', 'clock', 'No respondiste a tiempo. El cliente ya no verá esta invitación.') : ''}
          ${i.estado === 'Anulada' ? aviso('mute', 'x', s.estado === 'Cancelada' ? 'El cliente canceló la solicitud.' : 'El cliente contrató a otro prestador.') : ''}
          ${i.estado === 'Rechazada' ? aviso('mute', 'x', 'Rechazaste esta invitación' + (i.motivo ? ': ' + i.motivo : '.')) : ''}
          <section class="card stack-s"><h2 class="h2">Lo que pide el cliente</h2>
            <p>${s.descripcion}</p>
            ${s.medidas ? h`<p class="small"><b>Medidas:</b> ${s.medidas}</p>` : ''}
            <p class="small">${icon('clock')}${horarioTexto(s.horario)}</p>
            <p class="small">${icon('pin')}${St.sector(s.sectorId).nombre}</p>
            <p class="small muted">${icon('lock')}La dirección exacta se muestra cuando el cliente confirme el servicio.</p>
            ${fotos(s.fotos)}
          </section>
          ${c && c.estado !== 'Borrador' ? h`<section><div class="row between"><h2 class="h2">Tu cotización ${c.folio}</h2>${estado(c.estado)}</div>${cotTabla(c)}${c.estado === 'Enviada' ? cuenta(c.venceEn, 'El cliente decide en') : ''}</section>` : ''}
        </div>
        <aside class="side-sticky">
          <div class="card stack-s"><div class="row">${avatar(cliente, 'l')}<div><b>${cliente.split(' ')[0]}</b><p class="small muted">Cliente</p></div></div></div>
          ${mapa(St.sector(s.sectorId).nombre)}
          ${i.estado === 'Pendiente' ? h`<button class="btn btn-pri btn-lg" data-act="aceptar-inv" data-id="${i.id}" id="btn-aceptar-inv">Aceptar para cotizar</button>
            <button class="btn btn-sec" data-act="rechazar-inv" data-id="${i.id}" id="btn-rechazar-inv">Rechazar</button>` : ''}
          ${i.estado === 'Aceptada' && ['En evaluación', 'Pendiente de aprobación'].includes(s.estado) && (!c || c.estado === 'Borrador') ? h`<button class="btn btn-pri btn-lg" data-go="p/cotizar/${s.id}/${tipo}/-" id="btn-preparar-cot">${c ? 'Continuar borrador' : 'Preparar cotización ' + (tipo === 'visita' ? 'de visita' : 'de trabajo')}</button>` : ''}
          ${srv && srv.prestadorId === p.id ? h`<button class="btn btn-pri btn-lg" data-go="p/servicio/${srv.id}">Ir al servicio ${srv.folio}</button>` : ''}
          ${i.estado === 'Aceptada' ? h`<button class="btn btn-sec" data-go="chat/${s.id}/${p.id}">${icon('chat')}Mensajes con ${cliente.split(' ')[0]}</button>` : ''}
        </aside>
      </div>`;
    }
  });

  // ---------- Preparar cotización ----------
  const CATS = [['mano_obra', 'Mano de obra', 'Ej.: reparación de la fuga'], ['materiales', 'Materiales', 'Ej.: tubo PVC 1/2"'], ['cargos', 'Cargos', 'Ej.: transporte']];
  ruta({
    patron: 'p/cotizar/:sol/:tipo/:srv', rol: 'prestador', nav: 'cotizaciones', back: true,
    titulo: (pr) => ({ visita: 'Cotización de visita', trabajo: 'Cotización de trabajo', adicional: 'Cotización adicional' }[pr.tipo]),
    render: (pr) => {
      const s = St.solicitud(pr.sol);
      const p = yoP();
      const srvId = pr.srv === '-' ? null : pr.srv;
      const llave = s.id + '|' + pr.tipo + '|' + (srvId || '');
      if (!U.cot || U.cot.llave !== llave) {
        const draft = St.S.cotizaciones.find((c) => c.solicitudId === s.id && c.prestadorId === p.id && c.tipo === pr.tipo && (c.servicioId || null) === srvId && c.estado === 'Borrador');
        let lineas;
        if (draft) lineas = draft.lineas.map((l) => Object.assign({}, l));
        else if (pr.tipo === 'visita') lineas = [{ categoria: 'mano_obra', concepto: 'Visita de diagnóstico', monto: p.costoVisita || 0 }];
        else lineas = [{ categoria: 'mano_obra', concepto: '', monto: '' }, { categoria: 'materiales', concepto: '', monto: '' }];
        U.cot = { llave, id: draft ? draft.id : null, lineas, nota: draft ? draft.nota : '', tiempoEstimado: draft ? draft.tiempoEstimado : '' };
        U.errores = {};
      }
      const t = St.totales({ lineas: U.cot.lineas });
      const plazo = St.plazos(s.modalidad).cotizacion;
      return h`<form class="cols form" data-form="cotizacion" data-sol="${s.id}" data-tipo="${pr.tipo}" data-srv="${srvId || ''}" novalidate>
        <div class="stack">
          ${pr.tipo === 'visita' ? aviso('info', 'info', 'La visita cubre el diagnóstico. Después de revisar, enviarás la cotización del trabajo dentro del mismo servicio.') : ''}
          ${pr.tipo === 'adicional' ? aviso('info', 'info', 'Usa esta cotización para cambios de alcance: materiales o trabajos que no estaban en lo aprobado. El cliente debe aprobarla.') : ''}
          ${U.errores._ ? aviso('bad', 'alert', U.errores._) : ''}
          ${CATS.map(([cat, nom, ph]) => h`<fieldset class="q-edit"><legend>${nom} <b class="num">${St.dinero(t[cat])}</b></legend>
            ${U.cot.lineas.map((l, idx) => l.categoria !== cat ? '' : h`<div class="q-row">
              <label class="sr" for="l-c-${idx}">Descripción</label><input id="l-c-${idx}" placeholder="${ph}" value="${l.concepto}" data-linea="${idx}" data-k="concepto">
              <label class="sr" for="l-m-${idx}">Monto en quetzales</label><span class="money-in"><span aria-hidden="true">Q</span><input id="l-m-${idx}" inputmode="decimal" type="number" min="0" step="0.01" placeholder="0.00" value="${l.monto}" data-linea="${idx}" data-k="monto"></span>
              <button type="button" class="btn btn-icon btn-ghost" data-act="quitar-linea" data-i="${idx}" aria-label="Quitar línea">${icon('x')}</button></div>`)}
            <button type="button" class="btn btn-link btn-s" style="align-self:flex-start" data-act="agregar-linea" data-cat="${cat}" id="add-${cat}">${icon('plus')}Agregar ${nom.toLowerCase()}</button>
          </fieldset>`)}
          <div class="form-grid">
            <div class="field"><label for="cot-tiempo">Tiempo estimado</label><input id="cot-tiempo" name="tiempoEstimado" placeholder="Ej.: 2 horas" value="${U.cot.tiempoEstimado}" data-cotk="tiempoEstimado"></div>
            <div class="field"><label for="cot-nota">Nota para el cliente (opcional)</label><input id="cot-nota" name="nota" value="${U.cot.nota}" data-cotk="nota"></div>
          </div>
        </div>
        <aside class="side-sticky">
          <div class="card summary"><b>${St.especialidad(s.especialidadId).nombre}</b><p class="small">${s.folio} · ${O.MODALIDADES[s.modalidad].nombre} · ${St.sector(s.sectorId).nombre}</p><p class="small muted">${s.descripcion}</p></div>
          <div class="card cta-card">
            <span class="small muted">Total para el cliente</span>
            <p class="amount num" id="cot-total">${St.dinero(t.total)}</p>
            <p class="hint">${icon('clock')}El cliente tendrá ${plazo >= 60 ? plazo / 60 + ' horas' : plazo + ' minutos'} para aprobarla. Después vence.</p>
            <button type="submit" class="btn btn-pri btn-lg" id="btn-enviar-cot">Enviar cotización</button>
            <button type="button" class="btn btn-sec" data-act="guardar-borrador" id="btn-borrador">Guardar borrador</button>
          </div>
        </aside>
      </form>`;
    }
  });

  // ---------- Servicios ----------
  ruta({
    patron: 'p/servicios', rol: 'prestador', nav: 'servicios', titulo: () => 'Servicios activos',
    render: () => {
      const p = yoP();
      const activos = St.S.servicios.filter((s) => s.prestadorId === p.id && (s.estado === 'Confirmado' || s.estado === 'En ejecución')).sort((a, b) => b.creado - a.creado);
      return h`<div class="stack">
        ${cabecera('Servicios activos', 'Inicia, registra avances y finaliza. La dirección exacta del cliente se ve aquí.')}
        ${activos.length ? h`<div class="list">${activos.map((s) => O.filaServicio(s, 'prestador'))}</div>` : vacio('case', 'Sin servicios activos', 'Cuando un cliente apruebe tu cotización, el servicio aparecerá aquí.')}
        <button class="btn btn-link" style="align-self:flex-start" data-go="p/historial">Ver servicios finalizados y cancelados</button>
      </div>`;
    }
  });

  ruta({
    patron: 'p/historial', rol: 'prestador', nav: 'historial', titulo: () => 'Historial',
    render: () => {
      const p = yoP();
      const otros = St.S.servicios.filter((s) => s.prestadorId === p.id && (s.estado === 'Finalizado' || s.estado === 'Cancelado')).sort((a, b) => b.creado - a.creado);
      return h`<div class="stack">
        ${cabecera('Historial', 'Servicios finalizados y cancelados, con lo cobrado y la comisión.')}
        ${otros.length ? h`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Servicio</th><th>Trabajo</th><th>Cliente</th><th>Cobrado</th><th>Comisión</th><th>Pago</th><th>Estado</th></tr></thead><tbody>
          ${otros.map((s) => { const cm = St.comisionServicio(s); const sol = St.solicitud(s.solicitudId); return h`<tr data-go="p/servicio/${s.id}" style="cursor:pointer" id="srv-${s.id}"><td class="num">${s.folio}</td><td>${St.especialidad(sol.especialidadId).nombre}</td><td>${St.nombre(s.clienteCuentaId)}</td><td class="num">${s.estado === 'Finalizado' ? St.dinero(cm.total) : '–'}</td><td class="num">${s.estado === 'Finalizado' ? (cm.exenta ? 'Q 0.00' : St.dinero(cm.comision)) : '–'}</td><td>${s.estado === 'Finalizado' ? estado(s.pago.estado === 'Pagado' ? 'Pagado' : 'Pendiente') : '–'}</td><td>${estado(s.estado)}</td></tr>`; })}
        </tbody></table></div>` : vacio('list', 'Sin historial', 'Aquí verás tus servicios terminados.')}
      </div>`;
    }
  });

  ruta({
    patron: 'p/agenda', rol: 'prestador', nav: 'agenda', titulo: () => 'Agenda',
    render: () => {
      const p = yoP();
      const srvs = St.S.servicios.filter((s) => s.prestadorId === p.id && (s.estado === 'Confirmado' || s.estado === 'En ejecución'));
      const dias = [];
      for (let k = 0; k < 7; k++) dias.push(O.diaISO(St.ahora() + k * O.DIA));
      const dia = new Date(St.ahora()).getDay();
      return h`<div class="stack">
        ${cabecera('Agenda', 'Tus servicios confirmados de los próximos 7 días. No se pueden confirmar dos servicios en la misma franja.')}
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Día</th>${O.FRANJAS.map((f) => h`<th>${f.nombre} <span class="muted" style="text-transform:none;letter-spacing:0">${f.horas}</span></th>`)}</tr></thead><tbody>
          ${dias.map((d) => { const wd = new Date(d + 'T12:00:00').getDay(); const atiende = p.disponibilidad.dias.includes(wd); return h`<tr><td><b>${fechaCorta(d)}</b>${atiende ? '' : h`<br><small class="muted">No atiende</small>`}</td>
            ${O.FRANJAS.map((f) => { const s = srvs.find((x) => x.horario.fecha === d && x.horario.franja === f.id); const libre = atiende && p.disponibilidad.franjas.includes(f.id);
              return h`<td>${s ? h`<button class="btn btn-sec btn-s" data-go="p/servicio/${s.id}">${s.folio} · ${St.nombre(s.clienteCuentaId).split(' ')[0]}</button>` : libre ? h`<span class="ok-t small">Libre</span>` : h`<span class="muted small">—</span>`}</td>`; })}</tr>`; })}
        </tbody></table></div>
        <p class="small muted">Hoy es ${O.DIAS[dia].toLowerCase()}. Cambia tus días y franjas en “Mi perfil”.</p>
      </div>`;
    }
  });

  ruta({
    patron: 'p/calificaciones', rol: 'prestador', nav: 'calificaciones', titulo: () => 'Calificaciones',
    render: () => {
      const p = yoP();
      const yo = app().yo();
      const r = St.calificacionPromedio(p.id);
      const res = St.resenasDe(p.id);
      const porCal = St.S.servicios.filter((s) => s.prestadorId === p.id && St.puedeCalificar(s.id, yo.id).ok);
      const retenidas = St.S.calificaciones.filter((c) => c.aCuentaId === yo.id && !c.publicada).length;
      return h`<div class="stack">
        ${cabecera('Calificaciones', 'Lo que dicen tus clientes. Las calificaciones con un reclamo abierto se publican cuando se resuelve.')}
        <div class="stats-row">
          <div class="stat gold">${icon('star')}<div><b>${r.n ? r.prom.toFixed(1) : '–'}</b><span>Promedio</span></div></div>
          <div class="stat">${icon('list')}<div><b>${r.n}</b><span>Publicadas</span></div></div>
          <div class="stat dark">${icon('clock')}<div><b>${retenidas}</b><span>Retenidas por reclamo</span></div></div>
          <div class="stat">${icon('user')}<div><b>${porCal.length}</b><span>Clientes por calificar</span></div></div>
        </div>
        ${porCal.length ? h`<section><h2 class="h2">Califica a tus clientes</h2><div class="list">${porCal.map((s) => h`<div class="item">${avatar(St.nombre(s.clienteCuentaId), 's')}<span class="grow"><b>${St.nombre(s.clienteCuentaId)}</b><small class="muted">${s.folio}</small></span><button class="btn btn-pri btn-s" data-go="calificar/${s.id}">Calificar</button></div>`)}</div></section>` : ''}
        <section><h2 class="h2">Reseñas</h2>${res.length ? h`<div class="list">${res.map((c) => h`<div class="review"><div class="row between"><b>${St.nombre(c.deCuentaId).split(' ')[0]}</b>${O.UI.estrellas(c.estrellas)}</div><p>${c.comentario || 'Sin comentario.'}</p><p class="small muted">${hace(c.fecha)}</p></div>`)}</div>` : vacio('star', 'Sin reseñas todavía', 'Al finalizar tus primeros servicios, tus clientes podrán calificarte.')}</section>
      </div>`;
    }
  });

  ruta({
    patron: 'p/servicio/:id', rol: 'prestador', nav: 'servicios', back: 'p/servicios', titulo: (pr) => St.servicio(pr.id).folio,
    render: (pr) => {
      const srv = St.servicio(pr.id);
      const s = St.solicitud(srv.solicitudId);
      const p = yoP();
      const yo = app().yo();
      const cliente = St.nombre(srv.clienteCuentaId);
      const cots = St.cotizacionesDeServicio(srv);
      const trabajo = cots.filter((c) => c.tipo === 'trabajo' && c.servicioId === srv.id);
      const pendCliente = cots.filter((c) => c.estado === 'Enviada');
      const borradores = cots.filter((c) => c.estado === 'Borrador');
      const esDiag = s.modalidad === 'diagnostico';
      const trabajoAprobado = trabajo.some((c) => c.estado === 'Aprobada');
      const puedeCotTrabajo = esDiag && srv.estado === 'En ejecución' && !trabajo.some((c) => ['Enviada', 'Aprobada'].includes(c.estado));
      const puedeAdicional = srv.estado === 'En ejecución' && (!esDiag || trabajoAprobado) && !pendCliente.length;
      const cm = srv.estado === 'Finalizado' ? St.comisionServicio(srv) : null;
      const puedeCal = St.puedeCalificar(srv.id, yo.id).ok;
      return h`<div class="cols">
        <div class="stack">
          <div class="row between"><div><p class="eyebrow">${O.MODALIDADES[s.modalidad].nombre} · ${s.folio}</p><h1 class="h1">${St.especialidad(s.especialidadId).nombre}</h1></div>${estado(srv.estado, 'lg')}</div>
          ${O.stepper(srv)}
          ${pendCliente.length ? aviso('act', 'clock', h`Esperando que el cliente responda la cotización ${pendCliente[0].folio}. ${cuenta(pendCliente[0].venceEn, 'Decide en')}`) : ''}
          ${srv.soloVisita ? aviso('info', 'info', 'Servicio cerrado cobrando solo la visita de diagnóstico.') : ''}
          ${srv.estado === 'En ejecución' ? h`<form class="card row" data-form="avance" data-id="${srv.id}" novalidate><label class="sr" for="avance-txt">Avance</label><input id="avance-txt" name="texto" class="grow" placeholder="Registrar avance, ej.: cambié la tubería"><button class="btn btn-sec" type="submit" id="btn-avance">Guardar avance</button></form>` : ''}
          ${O.bloqueCalificacion(srv, yo.id)}
          <section><h2 class="h2">Cotizaciones del servicio</h2><div class="list">${cots.map((c) => h`<details class="item-d"><summary class="item"><span class="grow"><b>${{ visita: 'Visita', trabajo: 'Trabajo', adicional: 'Adicional' }[c.tipo]} · ${c.folio}</b></span><span class="stack-r"><b class="num">${St.dinero(St.totales(c).total)}</b>${estado(c.estado)}</span></summary>${cotTabla(c)}</details>`)}</div></section>
          ${srv.avances.length ? h`<section class="card"><h2 class="h2">Avances</h2><ul class="bul">${srv.avances.map((a) => h`<li><span class="small muted">${fecha(a.fecha)}</span> · ${a.texto}</li>`)}</ul></section>` : ''}
          ${cm ? h`<section class="card"><h2 class="h2">Cierre</h2>
            <div class="kv"><span>Mano de obra</span><b class="num">${St.dinero(cm.mano)}</b><span>Materiales</span><b class="num">${St.dinero(cm.materiales)}</b><span>Cargos</span><b class="num">${St.dinero(cm.cargos)}</b><span>Cobrado al cliente</span><b class="num">${St.dinero(cm.total)}</b>
            <span>Comisión Ofira (8 % de mano de obra)</span><b class="num">${cm.exenta ? 'Q 0.00 · primer mes' : St.dinero(cm.comision)}</b></div>
            <p class="small" style="margin-top:10px">Pago: ${estado(srv.pago.estado === 'Pagado' ? 'Pagado' : 'Pendiente')} ${srv.pago.metodo ? '· ' + srv.pago.metodo : ''}</p></section>` : ''}
          <section class="card"><h2 class="h2">Historial de estados</h2>${timeline(St.historialDe('Servicio', srv.id))}</section>
        </div>
        <aside class="side-sticky">
          <div class="card stack-s">
            <div class="row">${avatar(cliente, 'l')}<div class="grow"><b>${cliente}</b><p class="small muted">Tel. ${St.persona(St.cuenta(srv.clienteCuentaId).personaId).telefono}</p></div></div>
            ${srv.estado !== 'Cancelado' ? h`<p>${icon('pin')}<b>${s.direccion}</b>${s.referencia ? ' · ' + s.referencia : ''}</p><p class="hint">${St.sector(s.sectorId).nombre} · dirección visible porque el servicio está confirmado</p>
              ${s.ubicacion ? h`<a class="btn btn-pri" href="${O.enlaceMapa(s.ubicacion, true)}" target="_blank" rel="noopener" id="btn-como-llegar">${icon('pin')}Cómo llegar (Google Maps)</a>` : h`<p class="hint">El cliente no compartió su ubicación del GPS.</p>`}` : ''}
            <p class="small">${icon('clock')}${horarioTexto({ tipo: 'programado', fecha: srv.horario.fecha, franja: srv.horario.franja })}</p>
            <p class="small muted">${s.descripcion}</p>
            ${s.medidas ? h`<p class="small"><b>Medidas:</b> ${s.medidas}</p>` : ''}
            ${fotos(s.fotos)}
          </div>
          ${srv.estado !== 'Cancelado' ? mapa(St.sector(s.sectorId).nombre) : ''}
          ${srv.estado === 'Confirmado' && srv.enCamino ? h`<p class="note note-info">${icon('send')}<span>Avisaste que llegas aprox. a las <b>${O.horaDe(srv.enCamino.fecha + srv.enCamino.minutos * O.MIN)}</b>.</span></p>` : ''}
          ${srv.estado === 'Confirmado' ? h`<button class="btn btn-sec btn-lg" data-act="en-camino" data-id="${srv.id}" id="btn-en-camino">${icon('send')}${srv.enCamino ? 'Actualizar hora de llegada' : 'Voy en camino'}</button>` : ''}
          ${srv.estado === 'Confirmado' ? h`<button class="btn btn-pri btn-lg" data-act="iniciar-servicio" data-id="${srv.id}" id="btn-iniciar">${icon('play')}${esDiag ? 'Llegué: iniciar la visita' : 'Iniciar el trabajo'}</button>` : ''}
          ${puedeCotTrabajo ? h`<button class="btn btn-pri btn-lg" data-go="p/cotizar/${s.id}/trabajo/${srv.id}" id="btn-cot-trabajo">${icon('file')}${borradores.some((c) => c.tipo === 'trabajo') ? 'Continuar cotización del trabajo' : 'Enviar cotización del trabajo'}</button>` : ''}
          ${puedeAdicional ? h`<button class="btn btn-sec" data-go="p/cotizar/${s.id}/adicional/${srv.id}" id="btn-adicional">${icon('plus')}Solicitar trabajo adicional</button>` : ''}
          ${srv.estado === 'En ejecución' ? h`<button class="btn ${pendCliente.length ? 'btn-sec' : 'btn-pri'} btn-lg" data-act="finalizar-servicio" data-id="${srv.id}" id="btn-finalizar">${icon('flag')}Finalizar servicio</button>` : ''}
          ${srv.estado === 'Finalizado' && srv.pago.estado !== 'Pagado' ? h`<button class="btn btn-pri btn-lg" data-act="marcar-pagado" data-id="${srv.id}" id="btn-pagado">${icon('money')}Marcar como pagado</button>` : ''}
          ${puedeCal ? h`<button class="btn btn-sec" data-go="calificar/${srv.id}" id="btn-calificar-cliente">${icon('star')}Calificar al cliente</button>` : ''}
          <button class="btn btn-sec" data-go="chat/${s.id}/${p.id}">${icon('chat')}Mensajes con ${cliente.split(' ')[0]}</button>
          ${srv.estado === 'Confirmado' ? h`<button class="btn btn-danger" data-act="cancelar-servicio" data-id="${srv.id}" id="btn-cancelar-servicio-p">Cancelar servicio</button>` : ''}
          ${(srv.estado === 'En ejecución' || srv.estado === 'Finalizado') && !St.reclamoAbiertoDe(srv.id) ? h`<button class="btn btn-link" data-go="reclamo/${srv.id}">${icon('flag')}Reportar un problema</button>` : ''}
        </aside>
      </div>`;
    }
  });

  // ---------- Perfil del prestador (RF02) ----------
  ruta({
    patron: 'p/perfil', rol: 'prestador', nav: 'perfil', titulo: () => 'Mi perfil',
    render: () => {
      const p = yoP();
      const yo = app().yo();
      const per = St.persona(yo.personaId);
      const o = St.oficio(p.oficioId);
      const esps = St.S.especialidades.filter((e) => e.oficioId === o.id);
      return h`<form class="cols form" data-form="perfil-prestador" novalidate>
        <div class="stack">
          <div class="card profile-head">${avatar(per.nombre, 'xl')}<div><h1 class="h1">${per.nombre}</h1><p class="muted">${o.nombre} · ${yo.correo}</p>${calif(p.id)}</div></div>
          ${resumenErrores()}${U.errores._ ? aviso('bad', 'alert', U.errores._) : ''}
          <section class="card stack">
            <h2 class="h2">Tu trabajo</h2>
            <fieldset class="field"><legend class="lbl">Especialidades y precio de referencia</legend>
              <div class="list">${esps.map((e) => h`<div class="item"><label class="check grow"><input type="checkbox" name="especialidades" value="${e.id}" ${p.especialidades.includes(e.id) ? 'checked' : ''}><span>${e.nombre}</span></label>
                <span class="money-in" style="width:150px"><span aria-hidden="true">Q</span><label class="sr" for="precio-${e.id}">Precio desde para ${e.nombre}</label><input id="precio-${e.id}" type="number" min="0" step="5" placeholder="Desde" data-precio="${e.id}" value="${(p.precios || {})[e.id] || ''}"></span></div>`)}</div>
              <p class="hint">El precio “desde” se muestra en tu perfil y en los resultados. Los clientes lo pidieron para decidir antes de invitar.</p>${err('especialidades')}</fieldset>
            <div class="form-grid">
              <div class="field"><label for="pp-exp">Años de experiencia</label><input id="pp-exp" name="experiencia" type="number" min="0" max="60" value="${p.experiencia}"></div>
              ${o.modalidades.includes('diagnostico') ? h`<div class="field"><label for="pp-visita">Costo de la visita de diagnóstico (Q)</label><input id="pp-visita" name="costoVisita" type="number" min="0" step="5" value="${p.costoVisita}"></div>` : h`<div></div>`}
              <div class="field full"><label for="pp-desc">Sobre tu trabajo</label><textarea id="pp-desc" name="descripcion" rows="3">${p.descripcion}</textarea></div>
              <div class="field full"><label for="pp-cond">Condiciones</label><textarea id="pp-cond" name="condiciones" rows="2">${p.condiciones}</textarea></div>
            </div>
          </section>
          <section class="card stack">
            <h2 class="h2">Cobertura y disponibilidad</h2>
            <fieldset class="field"><legend class="lbl">Sectores donde trabajas</legend><div class="checks row wrap">${O.SECTORES.map((s) => h`<label class="check pill"><input type="checkbox" name="cobertura" value="${s.id}" ${p.cobertura.includes(s.id) ? 'checked' : ''}><span>${s.nombre}</span></label>`)}</div>${err('cobertura')}</fieldset>
            <fieldset class="field"><legend class="lbl">Días de atención</legend><div class="checks row wrap">${[1, 2, 3, 4, 5, 6, 0].map((d) => h`<label class="check pill"><input type="checkbox" name="dias" value="${d}" ${p.disponibilidad.dias.includes(d) ? 'checked' : ''}><span>${O.DIAS[d].slice(0, 3)}</span></label>`)}</div>${err('dias')}</fieldset>
            <fieldset class="field"><legend class="lbl">Franjas horarias</legend><div class="checks row wrap">${O.FRANJAS.map((f) => h`<label class="check pill"><input type="checkbox" name="franjas" value="${f.id}" ${p.disponibilidad.franjas.includes(f.id) ? 'checked' : ''}><span>${f.nombre} · ${f.horas}</span></label>`)}</div>${err('franjas')}</fieldset>
          </section>
        </div>
        <aside class="side-sticky">
          <section class="card stack-s"><div class="row between"><b>Verificación</b>${estado(p.estadoVerificacion)}</div>
            <div class="row gap-s">${p.dpiArchivo ? h`<a href="/archivo/${p.dpiArchivo}" target="_blank" rel="noopener" class="thumb"><img src="/archivo/${p.dpiArchivo}" alt="Tu foto del DPI"></a>` : h`<div class="dpi" aria-label="Sin foto del DPI">${icon('user')}<span>DPI</span></div>`}
              <div class="small"><p>${p.dpiArchivo ? 'Foto del DPI enviada' : 'Cuenta creada por administración'}</p><p class="muted">Referencia: ${p.referencia || '—'}</p></div></div>
            <p class="hint">${icon('lock')}Tu DPI solo lo ve administración. “Verificado” significa que se revisaron identidad y referencia; no es garantía de calidad.</p></section>
          <button class="btn btn-pri btn-lg" type="submit" id="btn-guardar-perfil">Guardar cambios</button>
          <section class="card stack-s"><h2 class="h2">Fotos de tus trabajos</h2>
            <p class="hint">Los clientes pidieron ver trabajos anteriores antes de contratar. Hasta 12 fotos.</p>
            ${(p.galeria || []).length ? h`<div class="thumbs">${p.galeria.map((g) => h`<span class="thumb" title="${g.descripcion}"><img src="/archivo/${g.archivo}" alt="${g.descripcion || 'Trabajo'}" loading="lazy"><button type="button" class="thumb-x" data-act="quitar-galeria" data-id="${g.archivo}" aria-label="Quitar foto">${icon('x')}</button></span>`)}</div>` : ''}
            ${(p.galeria || []).length < 12 ? h`<div class="field"><label for="gal-desc">Descripción (opcional)</label><input id="gal-desc" maxlength="120" placeholder="Ej.: cambio de tubería en cocina"></div>
              <div class="field"><label for="gal-foto">Agregar foto</label><input id="gal-foto" type="file" accept="image/jpeg,image/png,image/webp" data-change="galeria-foto" ${O.App.subiendo ? 'disabled' : ''}></div>
              ${O.App.subiendo ? h`<span class="subiendo">${icon('clock')}Subiendo foto…</span>` : ''}` : ''}
          </section>
          ${yo.roles.includes('cliente') ? h`<button type="button" class="btn btn-sec" data-act="cambiar-rol" data-v="cliente" id="btn-modo-cliente">${icon('user')}Cambiar a modo cliente</button>` : ''}
          <button type="button" class="btn btn-link" data-act="salir">${icon('out')}Cerrar sesión</button>
        </aside>
      </form>
      <div class="narrow" style="margin:18px 0 0">${O.formClave()}</div>`;
    }
  });
})();
