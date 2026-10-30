/* Ofira · Panel de administración (RF03, RF14) y atención de soporte (RF11). */
(function () {
  'use strict';
  const O = window.Ofira;
  const { h, icon, estado, fotos, avatar, fecha, hace, vacio, aviso, cotTabla, timeline } = O.UI;
  const St = O.Store;
  const U = O.UIState;
  const ruta = (d) => O.Rutas.push(d);
  const { err, inv, cabecera } = O.Form;

  /* Botones para descargar el reporte de la sección; el servidor lo genera con los datos actuales (y el filtro elegido) */
  function descargas(tipo, filtro) {
    const q = '/api/reporte?tipo=' + tipo + (filtro ? '&estado=' + encodeURIComponent(filtro) : '') + '&formato=';
    return h`<div class="row gap-s descargas"><a class="btn btn-sec btn-s" href="${q}pdf" download id="rep-${tipo}-pdf">${icon('download')}PDF</a><a class="btn btn-sec btn-s" href="${q}xlsx" download id="rep-${tipo}-xlsx">${icon('download')}Excel</a></div>`;
  }

  function kpi(titulo, valor, formula, ic) {
    return h`<div class="kpi">${icon(ic)}<span class="kpi-t">${titulo}</span><b class="kpi-v num">${valor}</b><span class="kpi-f">${formula}</span></div>`;
  }
  /* Barras horizontales simples: cada barra se dibuja a escala del valor mayor */
  function barras(datos) {
    const max = Math.max(1, ...datos.map((d) => d[1]));
    return h`<div class="bars">${datos.map(([t, v, tono]) => h`<div class="bar-row"><span>${t}</span><div class="bar-track"><div class="bar-fill ${tono || ''}" style="width:${Math.round((v / max) * 100)}%"></div></div><b class="num">${v}</b></div>`)}</div>`;
  }

  ruta({
    patron: 'a/resumen', rol: 'administrador', nav: 'resumen', titulo: () => 'Dashboard',
    render: () => {
      St.tick();
      const k = St.indicadores();
      const pend = St.S.prestadores.filter((p) => p.estadoVerificacion === 'Pendiente de revisión');
      const com = St.comisiones();
      const totalCom = Object.values(com).reduce((a, r) => a + r.comision, 0);
      const recientes = St.S.solicitudes.slice().sort((a, b) => b.creada - a.creada).slice(0, 6);
      const estados = ['Solicitada', 'En evaluación', 'Pendiente de aprobación', 'Confirmada', 'Vencida', 'Cancelada'];
      const tonos = { Confirmada: 'ok', Vencida: 'bad', Cancelada: 'bad', 'Pendiente de aprobación': 'gold' };
      return h`<div class="stack">
        ${cabecera('Resumen de la operación', 'Asunción Mita · datos ficticios del prototipo')}
        <div class="kpis">
          ${kpi('Solicitudes atendidas', k.pctAtendidas + ' %', k.atendidas + ' servicios finalizados ÷ ' + k.enviadas + ' solicitudes', 'check')}
          ${kpi('Tiempo de aceptación', k.tiempoProm + ' min', 'Promedio de (respuesta − envío) de invitaciones aceptadas', 'clock')}
          ${kpi('Cancelaciones', k.pctCanceladas + ' %', k.canceladas + ' canceladas ÷ ' + k.enviadas + ' solicitudes', 'x')}
          ${kpi('Reclamos', k.pctReclamos + ' %', k.reclamos + ' reclamos ÷ ' + k.atendidas + ' finalizados · ' + k.reclamosAbiertos + ' abiertos', 'flag')}
        </div>
        <div class="grid-2">
          <section class="card"><h2 class="h2">Solicitudes por estado</h2>${barras(estados.map((e) => [e, St.S.solicitudes.filter((s) => s.estado === e).length, tonos[e]]))}</section>
          <section class="card"><h2 class="h2">Solicitudes por oficio</h2>${barras(St.S.oficios.map((o) => [o.nombre, St.S.solicitudes.filter((s) => s.oficioId === o.id).length]))}
            <div class="row between" style="margin-top:14px"><div><span class="small muted">Comisión acumulada</span><p class="amount num" style="font-size:26px">${St.dinero(totalCom)}</p></div><span class="ref-tag">Se cobra al prestador cada mes</span></div></section>
        </div>
        <div class="grid-2">
          <section class="card"><div class="row between"><h2 class="h2">Verificaciones pendientes</h2><button class="btn btn-link btn-s" data-go="a/verificacion">Ver prestadores</button></div>
            ${pend.length ? h`<div class="list">${pend.map((p) => h`<button class="item link" data-go="a/prestador/${p.id}">${avatar(St.nombre(p.cuentaId), 's')}<span class="grow"><b>${St.nombre(p.cuentaId)}</b><small class="muted">${St.oficio(p.oficioId).nombre} · alta ${hace(p.alta)}</small></span>${estado(p.estadoVerificacion)}</button>`)}</div>` : h`<p class="muted small">No hay prestadores pendientes.</p>`}</section>
          <section class="card"><div class="row between"><h2 class="h2">Reclamos</h2><button class="btn btn-link btn-s" data-go="a/reclamos">Ver todos</button></div>
            ${St.S.reclamos.length ? h`<div class="list">${St.S.reclamos.slice(-4).reverse().map((r) => h`<div class="item">${icon('flag')}<span class="grow"><b>${r.folio} · ${r.motivo}</b><small class="muted">${St.servicio(r.servicioId).folio} · ${hace(r.creado)}</small></span>${estado(r.estado)}</div>`)}</div>` : h`<p class="muted small">Sin reclamos.</p>`}</section>
        </div>
        <section class="card"><div class="row between"><h2 class="h2">Solicitudes recientes</h2><button class="btn btn-link btn-s" data-go="a/solicitudes">Ver todas</button></div>
          ${tablaSolicitudes(recientes)}</section>
      </div>`;
    }
  });

  function tablaSolicitudes(lista) {
    return h`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Folio</th><th>Oficio</th><th>Modalidad</th><th>Sector</th><th>Cliente</th><th>Creada</th><th>Estado</th></tr></thead><tbody>
      ${lista.map((s) => h`<tr><td class="num">${s.folio}</td><td>${St.oficio(s.oficioId).nombre}</td><td>${O.MODALIDADES[s.modalidad].nombre}</td><td>${St.sector(s.sectorId).nombre}</td><td>${St.nombre(s.clienteCuentaId)}</td><td>${fecha(s.creada)}</td><td>${estado(s.estado)}</td></tr>`)}
    </tbody></table></div>`;
  }

  ruta({
    patron: 'a/solicitudes', rol: 'administrador', nav: 'solicitudes', titulo: () => 'Solicitudes',
    render: () => {
      St.tick();
      const f = U.filtroSolA || 'todas';
      let lista = St.S.solicitudes.slice().sort((a, b) => b.creada - a.creada);
      if (f !== 'todas') lista = lista.filter((s) => s.estado === f);
      return h`<div class="stack">
        ${cabecera('Solicitudes', 'Todas las solicitudes de la plataforma. El administrador consulta; no modifica solicitudes de los clientes.', descargas('solicitudes', f === 'todas' ? '' : f))}
        <div class="chips">${['todas', 'Solicitada', 'En evaluación', 'Pendiente de aprobación', 'Confirmada', 'Vencida', 'Cancelada'].map((e) => h`<button class="chip ${f === e ? 'on' : ''}" aria-pressed="${f === e}" data-act="filtro-sola" data-v="${e}">${e === 'todas' ? 'Todas' : e}</button>`)}</div>
        ${lista.length ? tablaSolicitudes(lista) : vacio('file', 'Sin solicitudes en este estado', 'Cambia el filtro para ver otras.')}
      </div>`;
    }
  });

  ruta({
    patron: 'a/verificacion', rol: 'administrador', nav: 'verificacion', titulo: () => 'Prestadores',
    render: () => {
      const f = U.filtroVer || 'todos';
      let lista = St.S.prestadores.slice();
      if (f !== 'todos') lista = lista.filter((p) => p.estadoVerificacion === f);
      return h`<div class="stack">
        ${cabecera('Prestadores y verificación', 'Se revisa la foto del DPI y una referencia de trabajo. “Verificado” indica solo eso; no garantiza calidad ni conducta.', descargas('prestadores', f === 'todos' ? '' : f))}
        <div class="chips">${['todos', 'Pendiente de revisión', 'Verificado', 'Observado', 'Suspendido'].map((e) => h`<button class="chip ${f === e ? 'on' : ''}" aria-pressed="${f === e}" data-act="filtro-ver" data-v="${e}">${e === 'todos' ? 'Todos' : e}</button>`)}</div>
        ${lista.length ? h`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Prestador</th><th>Oficio</th><th>Cobertura</th><th>Calificación</th><th>Alta</th><th>Estado</th><th></th></tr></thead><tbody>
          ${lista.map((p) => { const r = St.calificacionPromedio(p.id); return h`<tr><td><span class="row gap-s">${avatar(St.nombre(p.cuentaId), 's')}${St.nombre(p.cuentaId)}</span></td><td>${St.oficio(p.oficioId).nombre}</td><td>${p.cobertura.length} sectores</td><td>${r.n ? r.prom.toFixed(1) + ' ★ (' + r.n + ')' : '–'}</td><td>${hace(p.alta)}</td><td>${estado(p.estadoVerificacion)}</td>
            <td><button class="btn btn-sec btn-s" data-go="a/prestador/${p.id}" id="rev-${p.id}">Revisar</button></td></tr>`; })}
        </tbody></table></div>` : vacio('shield', 'Sin prestadores en este estado', 'Cambia el filtro para ver otros.')}
      </div>`;
    }
  });

  const SIGNIFICADO = {
    'Pendiente de revisión': 'Envió sus datos. No aparece en búsquedas hasta revisarlo.',
    'Verificado': 'Identidad y referencia revisadas. Aparece en búsquedas.',
    'Observado': 'Falta o no coincide algún dato. No aparece en búsquedas hasta corregirlo.',
    'Suspendido': 'Retirado de las búsquedas por incumplimiento o reclamos graves.'
  };

  ruta({
    patron: 'a/prestador/:id', rol: 'administrador', nav: 'verificacion', back: 'a/verificacion', titulo: () => 'Revisión de prestador',
    render: (pr) => {
      const p = St.prestador(pr.id);
      const c = St.cuenta(p.cuentaId);
      const per = St.persona(c.personaId);
      return h`<div class="cols">
        <div class="stack">
          <div class="card profile-head">${avatar(per.nombre, 'xl')}<div><h1 class="h1">${per.nombre}</h1><p class="muted">${St.oficio(p.oficioId).nombre} · ${p.experiencia} años · ${c.correo}</p></div></div>
          <p class="note note-info">${icon('info')}<span><b>${p.estadoVerificacion}:</b> ${SIGNIFICADO[p.estadoVerificacion]}</span></p>
          <div class="grid-2">
            <section class="card stack-s"><h2 class="h2">Identidad</h2>
              ${p.dpiArchivo ? h`<a href="/archivo/${p.dpiArchivo}" target="_blank" rel="noopener"><img src="/archivo/${p.dpiArchivo}" alt="Foto del DPI de ${per.nombre}" style="max-width:300px;width:100%;border-radius:10px;border:1px solid var(--line)"></a>`
                : h`<div class="dpi big" aria-label="Sin foto del DPI">${icon('user')}<span>Sin foto (cuenta creada por administración)</span></div>`}
              <div class="kv"><span>Nombre</span><b>${per.nombre}</b><span>DPI</span><b class="num">${per.dpi}</b><span>Teléfono</span><b>${per.telefono}</b></div>
              <p class="hint">${icon('lock')}Solo administración puede ver esta foto.</p></section>
            <section class="card stack-s"><h2 class="h2">Referencia de trabajo</h2><p>${p.referencia}</p>
              <h3 class="h3">Cobertura</h3><div class="tags">${p.cobertura.map((s) => h`<span class="tag">${St.sector(s).nombre}</span>`)}</div>
              <h3 class="h3">Especialidades</h3><div class="tags">${p.especialidades.length ? p.especialidades.map((e) => h`<span class="tag">${St.especialidad(e).nombre}</span>`) : h`<span class="muted small">Sin especialidades todavía</span>`}</div></section>
          </div>
          <section class="card"><h2 class="h2">Historial de verificación</h2>${timeline(St.historialDe('Prestador', p.id))}</section>
        </div>
        <aside class="side-sticky">
          <section class="card stack-s"><div class="row between"><h2 class="h2">Decisión</h2>${estado(p.estadoVerificacion)}</div>
            <div class="field"><label for="ver-nota">Nota (obligatoria para Observado o Suspendido)</label><textarea id="ver-nota" rows="3" placeholder="Ej.: la foto del DPI está borrosa"></textarea>${err('nota')}</div>
            <button class="btn btn-pri" data-act="verificar" data-id="${p.id}" data-v="Verificado" id="btn-verificar">${icon('shield')}Marcar Verificado</button>
            <button class="btn btn-sec" data-act="verificar" data-id="${p.id}" data-v="Observado" id="btn-observar">${icon('alert')}Observar</button>
            <button class="btn btn-danger" data-act="verificar" data-id="${p.id}" data-v="Suspendido" id="btn-suspender">${icon('x')}Suspender</button>
          </section>
        </aside>
      </div>`;
    }
  });

  ruta({
    patron: 'a/categorias', rol: 'administrador', nav: 'categorias', titulo: () => 'Categorías',
    render: () => h`<div class="stack">
      ${cabecera('Oficios y especialidades', 'Agregar un oficio no cambia las funciones centrales: usa las mismas modalidades, solicitudes y cotizaciones.', descargas('categorias'))}
      ${U.errores._ ? aviso('bad', 'alert', U.errores._) : ''}
      <div class="grid-3">${St.S.oficios.map((o) => h`<section class="card stack-s ${o.activo ? '' : 'dim'}">
        <div class="row between"><h2 class="h2" style="margin:0">${icon(o.icono)} ${o.nombre}</h2>${estado(o.activo ? 'Activa' : 'Suspendida')}</div>
        <p class="small muted">Modalidades: ${o.modalidades.map((m) => O.MODALIDADES[m].nombre).join(', ')}${o.enPrototipo ? '' : ' · solo en el documento'}</p>
        <div class="tags">${St.S.especialidades.filter((e) => e.oficioId === o.id).map((e) => h`<span class="tag">${e.nombre}</span>`)}</div>
        <form class="row" data-form="especialidad" data-id="${o.id}" novalidate><label class="sr" for="esp-${o.id}">Nueva especialidad</label><input id="esp-${o.id}" name="nombre" class="grow" placeholder="Nueva especialidad"><button class="btn btn-sec btn-s" type="submit">Agregar</button></form>
        <button class="btn btn-link btn-s" style="align-self:flex-start" data-act="alternar-oficio" data-id="${o.id}">${o.activo ? 'Desactivar oficio' : 'Activar oficio'}</button>
      </section>`)}</div>
      <form class="card stack-s narrow" style="margin-inline:0" data-form="oficio" novalidate><h2 class="h2">Agregar oficio</h2>
        <div class="field"><label for="of-nombre">Nombre</label><input id="of-nombre" name="nombre" placeholder="Ej.: Herrería" ${inv('nombre')}>${err('nombre')}</div>
        <fieldset class="field"><legend class="lbl">Modalidades</legend><div class="checks row wrap">${Object.values(O.MODALIDADES).map((m) => h`<label class="check pill"><input type="checkbox" name="modalidades" value="${m.id}"><span>${m.nombre}</span></label>`)}</div>${err('modalidades')}</fieldset>
        <button class="btn btn-pri" type="submit" id="btn-agregar-oficio" style="align-self:flex-start">Agregar oficio</button></form>
    </div>`
  });

  ruta({
    patron: 'a/cuentas', rol: 'administrador', nav: 'cuentas', titulo: () => 'Usuarios',
    render: () => h`<div class="stack">
      ${cabecera('Usuarios', 'Una persona tiene una sola cuenta. Una cuenta puede ser cliente y prestador a la vez; administrador y soporte no se combinan con prestador.', descargas('usuarios'))}
      ${(St.S.recuperaciones || []).length ? h`<section class="card"><h2 class="h2">Solicitudes de recuperación de cuenta <span class="count">${St.S.recuperaciones.length}</span></h2>
        <p class="small muted" style="margin-bottom:10px">Llama al teléfono de la cuenta para confirmar que es la persona, y luego crea una contraseña temporal.</p>
        <div class="list">${St.S.recuperaciones.map((r) => { const c = St.cuenta(r.cuentaId); const per = St.persona(c.personaId); return h`<div class="item">${avatar(per.nombre, 's')}<span class="grow"><b>${per.nombre}</b><small class="muted">${c.correo} · Tel. ${per.telefono} · ${hace(r.creada)}</small></span><button class="btn btn-pri btn-s" data-act="restablecer-clave" data-id="${c.id}">Restablecer contraseña</button></div>`; })}</div></section>` : ''}
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Persona</th><th>Correo</th><th>Roles</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        ${St.S.cuentas.map((c) => h`<tr><td><span class="row gap-s">${avatar(St.persona(c.personaId).nombre, 's')}${St.persona(c.personaId).nombre}</span></td><td>${c.correo}</td><td>${c.roles.join(', ')}</td><td>${estado(c.estado)}</td>
          <td><div class="row gap-s"><label class="sr" for="rol-${c.id}">Agregar rol</label><select id="rol-${c.id}" data-change="agregar-rol" data-id="${c.id}"><option value="">Agregar rol…</option>${['cliente', 'soporte', 'administrador'].filter((r) => !c.roles.includes(r)).map((r) => h`<option value="${r}">${r}</option>`)}</select>
          ${c.roles.includes('administrador') ? '' : h`<button class="btn btn-sec btn-s" data-act="alternar-cuenta" data-id="${c.id}">${c.estado === 'Activa' ? 'Suspender' : 'Activar'}</button>
          <button class="btn btn-sec btn-s" data-act="restablecer-clave" data-id="${c.id}" id="restablecer-${c.id}">Restablecer contraseña</button>`}</div></td></tr>`)}
      </tbody></table></div>
    </div>`
  });

  ruta({
    patron: 'a/reclamos', rol: 'administrador', nav: 'reclamos', titulo: () => 'Reclamos',
    render: () => {
      const lista = St.S.reclamos.slice().sort((a, b) => b.creado - a.creado);
      return h`<div class="stack">
        ${cabecera('Reclamos', 'Vista de consulta. Soporte es quien atiende y resuelve cada reclamo.', descargas('reclamos'))}
        ${lista.length ? h`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Folio</th><th>Servicio</th><th>Motivo</th><th>Cliente</th><th>Prestador</th><th>Creado</th><th>Estado</th></tr></thead><tbody>
          ${lista.map((r) => { const srv = St.servicio(r.servicioId); return h`<tr><td class="num">${r.folio}</td><td class="num">${srv.folio}</td><td>${r.motivo}</td><td>${St.nombre(srv.clienteCuentaId)}</td><td>${St.nombrePrestador(srv.prestadorId)}</td><td>${hace(r.creado)}</td><td>${estado(r.estado)}</td></tr>`; })}
        </tbody></table></div>` : vacio('flag', 'Sin reclamos', 'No hay reclamos registrados.')}
      </div>`;
    }
  });

  ruta({
    patron: 'a/reportes', rol: 'administrador', nav: 'reportes', titulo: () => 'Reportes',
    render: () => {
      const k = St.indicadores();
      const com = St.comisiones();
      const filas = Object.entries(com);
      const total = filas.reduce((a, [, r]) => a + r.comision, 0);
      return h`<div class="stack">
        ${cabecera('Reportes', 'Indicadores de operación y comisión por prestador.', descargas('general'))}
        <section class="card"><h2 class="h2">Indicadores</h2>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Indicador</th><th>Fórmula</th><th>Datos</th><th>Valor</th></tr></thead><tbody>
            <tr><td>Solicitudes atendidas</td><td>Servicios finalizados ÷ solicitudes enviadas × 100</td><td>${k.atendidas} ÷ ${k.enviadas}</td><td><b>${k.pctAtendidas} %</b></td></tr>
            <tr><td>Tiempo de aceptación</td><td>Promedio (respuesta − envío) de invitaciones aceptadas</td><td>Invitaciones aceptadas</td><td><b>${k.tiempoProm} min</b></td></tr>
            <tr><td>Cancelaciones</td><td>(Solicitudes canceladas + servicios cancelados) ÷ solicitudes × 100</td><td>${k.canceladas} ÷ ${k.enviadas}</td><td><b>${k.pctCanceladas} %</b></td></tr>
            <tr><td>Reclamos</td><td>Reclamos ÷ servicios finalizados × 100</td><td>${k.reclamos} ÷ ${k.atendidas}</td><td><b>${k.pctReclamos} %</b></td></tr>
            <tr><td>Solicitudes vencidas</td><td>Solicitudes en estado Vencida</td><td>Conteo</td><td><b>${k.vencidas}</b></td></tr>
          </tbody></table></div></section>
        <section class="card"><div class="row between"><h2 class="h2">Comisión por prestador</h2><b class="num">Total ${St.dinero(total)}</b></div>
          <p class="small muted" style="margin-bottom:10px">8 % sobre la mano de obra de servicios finalizados, cobrado al prestador cada mes. No se cobra sobre materiales ni al cliente. El primer mes desde el alta no paga comisión.</p>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Prestador</th><th>Finalizados</th><th>Mano de obra</th><th>Comisión 8 %</th><th>Exentos (primer mes)</th></tr></thead><tbody>
            ${filas.map(([pid, r]) => h`<tr><td>${St.nombrePrestador(pid)}</td><td class="num">${r.servicios}</td><td class="num">${St.dinero(r.mano)}</td><td class="num"><b>${St.dinero(r.comision)}</b></td><td class="num">${r.exentos}</td></tr>`)}
          </tbody></table></div></section>
      </div>`;
    }
  });

  ruta({
    patron: 'a/config', rol: 'administrador', nav: 'config', titulo: () => 'Configuración',
    render: () => {
      const R = O.REGLAS;
      const reglas = [
        ['users', 'Asignación', 'El cliente elige; puede invitar hasta ' + R.maxInvitaciones + ' prestadores con su sector en cobertura y disponibles en el horario. No hay asignación automática.'],
        ['check', 'Doble aceptación', 'Al aprobar una cotización, las demás de esa solicitud pasan a Anulada. Un prestador no puede tener dos servicios confirmados en la misma franja.'],
        ['clock', 'Vencimiento', 'Inmediata: ' + R.vencimiento.inmediata.invitacion + ' min para responder la invitación y ' + R.vencimiento.inmediata.cotizacion + ' min para aprobar. Demás modalidades: ' + R.vencimiento.otras.invitacion / 60 + ' h y ' + R.vencimiento.otras.cotizacion / 60 + ' h.'],
        ['money', 'Ingresos', 'Comisión del ' + Math.round(R.comision * 100) + ' % sobre la mano de obra de servicios finalizados, cobrada al prestador cada mes. Primer mes sin comisión.'],
        ['star', 'Calificación', 'Solo servicios Finalizados; ambas partes; ' + R.diasParaCalificar + ' días de plazo; una vez y sin edición. Con reclamo abierto se guarda sin publicar.'],
        ['shield', 'Verificación', 'Foto del DPI y una referencia de trabajo. La etiqueta dice “Verificado — identidad y referencia revisadas”.']
      ];
      return h`<div class="stack">
        ${cabecera('Configuración', 'Parámetros de las reglas de negocio vigentes. En el prototipo son de solo lectura.')}
        <div class="grid-2">${reglas.map(([ic, t, d]) => h`<div class="card rule">${icon(ic)}<div><b>${t}</b><p class="small">${d}</p></div></div>`)}</div>
        <section class="card"><h2 class="h2">Zona de cobertura</h2><p class="small muted" style="margin-bottom:8px">Asunción Mita, Jutiapa · lista fija de sectores</p>
          <div class="tags">${O.SECTORES.map((s) => h`<span class="tag">${icon('pin')}${s.nombre} · ${s.zona}</span>`)}</div></section>
      </div>`;
    }
  });

  // ======================= SOPORTE =======================
  ruta({
    patron: 's/reclamos', rol: 'soporte', nav: 'reclamos', titulo: () => 'Reclamos',
    render: () => {
      const f = U.filtroRec || 'activos';
      let lista = St.S.reclamos.slice().sort((a, b) => b.creado - a.creado);
      if (f === 'activos') lista = lista.filter((r) => r.estado === 'Abierto' || r.estado === 'En revisión');
      const n = (e) => St.S.reclamos.filter((r) => r.estado === e).length;
      return h`<div class="stack">
        ${cabecera('Reclamos', 'Soporte puede ver el servicio, las cotizaciones y los mensajes del caso. No puede editar cuentas ni ver el DPI.')}
        <div class="stats-row">
          <div class="stat gold">${icon('alert')}<div><b>${n('Abierto')}</b><span>Abiertos</span></div></div>
          <div class="stat">${icon('search')}<div><b>${n('En revisión')}</b><span>En revisión</span></div></div>
          <div class="stat">${icon('check')}<div><b>${n('Resuelto')}</b><span>Resueltos</span></div></div>
          <div class="stat dark">${icon('lock')}<div><b>${n('Cerrado')}</b><span>Cerrados</span></div></div>
        </div>
        <div class="chips">${[['activos', 'Abiertos y en revisión'], ['todos', 'Todos']].map(([k, t]) => h`<button class="chip ${f === k ? 'on' : ''}" aria-pressed="${f === k}" data-act="filtro-rec" data-v="${k}">${t}</button>`)}</div>
        ${lista.length ? h`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Folio</th><th>Servicio</th><th>Motivo</th><th>Abierto por</th><th>Creado</th><th>Estado</th><th></th></tr></thead><tbody>
          ${lista.map((r) => { const srv = St.servicio(r.servicioId); return h`<tr><td class="num">${r.folio}</td><td class="num">${srv.folio}</td><td>${r.motivo}</td><td>${St.nombre(r.abiertoPor)}</td><td>${hace(r.creado)}</td><td>${estado(r.estado)}</td><td><button class="btn btn-pri btn-s" data-go="s/reclamo/${r.id}" id="rec-${r.id}">Atender</button></td></tr>`; })}
        </tbody></table></div>` : vacio('flag', 'Sin reclamos activos', 'Cuando un cliente o prestador reporte un problema, aparecerá aquí.')}
      </div>`;
    }
  });

  ruta({
    patron: 's/reclamo/:id', rol: 'soporte', nav: 'reclamos', back: 's/reclamos', titulo: (pr) => St.reclamo(pr.id).folio,
    render: (pr) => {
      const r = St.reclamo(pr.id);
      const srv = St.servicio(r.servicioId);
      const s = St.solicitud(srv.solicitudId);
      const cots = St.cotizacionesDeServicio(srv).filter((c) => c.estado === 'Aprobada');
      const msgs = St.mensajesDe(s.id, srv.prestadorId);
      const sig = { 'Abierto': ['En revisión', 'Tomar el caso'], 'En revisión': ['Resuelto', 'Marcar resuelto'], 'Resuelto': ['Cerrado', 'Cerrar caso'] }[r.estado];
      return h`<div class="cols">
        <div class="stack">
          <div class="row between"><div><p class="eyebrow">${r.folio} · ${srv.folio}</p><h1 class="h1">${r.motivo}</h1></div>${estado(r.estado, 'lg')}</div>
          <section class="card stack-s"><h2 class="h2">Caso</h2><p>${r.descripcion}</p>
            ${r.evidencia.length ? h`<h3 class="h3">Evidencia</h3>${fotos(r.evidencia)}` : ''}
            ${r.resolucion ? h`<p class="note note-ok">${icon('check')}<span><b>Resolución:</b> ${r.resolucion}</span></p>` : ''}</section>
          <section class="card"><h2 class="h2">Lo aprobado</h2>${cots.map((c) => h`<p class="small" style="margin-bottom:6px"><b>${c.folio}</b> · ${c.tipo}</p>${cotTabla(c)}`)}</section>
          <section class="card"><h2 class="h2">Mensajes de la solicitud ${s.folio}</h2>
            ${msgs.length ? h`<div class="chat-list ro">${msgs.map((m) => h`<div class="msg ${m.deCuentaId === srv.clienteCuentaId ? '' : 'me'}"><p>${m.texto}</p><small>${St.nombre(m.deCuentaId)} · ${fecha(m.fecha)}</small></div>`)}</div>` : h`<p class="muted small">Sin mensajes.</p>`}</section>
          <section class="card"><h2 class="h2">Historial del reclamo</h2>${timeline(St.historialDe('Reclamo', r.id))}</section>
        </div>
        <aside class="side-sticky">
          <section class="card"><div class="kv"><span>Abierto por</span><b>${St.nombre(r.abiertoPor)}</b><span>Cliente</span><b>${St.nombre(srv.clienteCuentaId)}</b><span>Prestador</span><b>${St.nombrePrestador(srv.prestadorId)}</b><span>Servicio</span><b>${srv.estado}</b></div></section>
          ${sig ? h`<section class="card stack-s"><h2 class="h2">Siguiente paso</h2>
            <div class="field"><label for="rec-nota">${sig[0] === 'Resuelto' ? 'Resolución (se comunica a ambas partes)' : 'Nota interna (opcional)'}</label><textarea id="rec-nota" rows="3" ${inv('nota')}></textarea>${err('nota')}</div>
            <button class="btn btn-pri btn-lg" data-act="reclamo-avanzar" data-id="${r.id}" data-v="${sig[0]}" id="btn-reclamo-avanzar">${sig[1]}</button></section>` : aviso('mute', 'lock', 'Caso cerrado.')}
        </aside>
      </div>`;
    }
  });
})();
