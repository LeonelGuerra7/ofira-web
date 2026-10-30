/* Ofira · Navegación, acciones y formularios. Todo cambio se envía al servidor (ver api.js). */
(function () {
  'use strict';
  const O = window.Ofira;
  const { h, val, icon, estado, modal, modalError, cerrarModal, toast } = O.UI;
  const St = O.Store;
  const U = O.UIState;
  const Api = O.Api;

  const INICIO = { cliente: 'c/encuentra', prestador: 'p/inicio', administrador: 'a/resumen', soporte: 's/reclamos' };
  // Menú lateral por rol. El del cliente se agrupa en las tres etapas del producto: Encuentra, Cotiza y Contrata.
  const MENU = {
    cliente: [
      ['Encuentra', [['encuentra', 'Inicio', 'home', 'c/encuentra'], ['servicios', 'Buscar servicios', 'search', 'c/servicios']]],
      ['Cotiza', [['cotiza', 'Mis solicitudes', 'file', 'c/cotiza'], ['cotizaciones', 'Cotizaciones', 'money', 'c/cotizaciones']]],
      ['Contrata', [['contrata', 'Mis servicios', 'case', 'c/contrata'], ['historial', 'Historial', 'list', 'c/historial'], ['calificaciones', 'Calificaciones', 'star', 'c/calificaciones'], ['reclamos', 'Reclamos', 'flag', 'c/reclamos']]],
      ['Cuenta', [['cuenta', 'Mi perfil', 'user', 'c/cuenta'], ['avisos', 'Avisos', 'bell', 'avisos']]]
    ],
    prestador: [
      ['Trabajo', [['inicio', 'Inicio', 'home', 'p/inicio'], ['solicitudes', 'Solicitudes recibidas', 'file', 'p/solicitudes'], ['cotizaciones', 'Mis cotizaciones', 'money', 'p/cotizaciones'], ['servicios', 'Servicios activos', 'case', 'p/servicios'], ['agenda', 'Agenda', 'cal', 'p/agenda']]],
      ['Mi cuenta', [['perfil', 'Mi perfil', 'user', 'p/perfil'], ['calificaciones', 'Calificaciones', 'star', 'p/calificaciones'], ['historial', 'Historial', 'list', 'p/historial'], ['avisos', 'Avisos', 'bell', 'avisos']]]
    ],
    administrador: [
      ['General', [['resumen', 'Dashboard', 'chart', 'a/resumen'], ['reportes', 'Reportes', 'money', 'a/reportes']]],
      ['Gestión', [['cuentas', 'Usuarios', 'users', 'a/cuentas'], ['verificacion', 'Prestadores', 'shield', 'a/verificacion'], ['categorias', 'Categorías', 'grid', 'a/categorias'], ['solicitudes', 'Solicitudes', 'file', 'a/solicitudes'], ['reclamos', 'Reclamos', 'flag', 'a/reclamos']]],
      ['Sistema', [['config', 'Configuración', 'gear', 'a/config'], ['avisos', 'Avisos', 'bell', 'avisos']]]
    ],
    soporte: [
      ['Atención', [['reclamos', 'Reclamos', 'flag', 's/reclamos'], ['avisos', 'Avisos', 'bell', 'avisos']]]
    ]
  };
  // Barra inferior en el celular: las secciones principales de cada rol
  const RAPIDO = {
    cliente: [['encuentra', 'Encuentra', 'search', 'c/encuentra'], ['cotiza', 'Cotiza', 'file', 'c/cotiza'], ['contrata', 'Contrata', 'check', 'c/contrata'], ['cuenta', 'Cuenta', 'user', 'c/cuenta']],
    prestador: [['inicio', 'Inicio', 'home', 'p/inicio'], ['solicitudes', 'Solicitudes', 'file', 'p/solicitudes'], ['servicios', 'Servicios', 'case', 'p/servicios'], ['perfil', 'Perfil', 'user', 'p/perfil']],
    administrador: [['resumen', 'Dashboard', 'chart', 'a/resumen'], ['verificacion', 'Prestadores', 'shield', 'a/verificacion'], ['solicitudes', 'Solicitudes', 'file', 'a/solicitudes'], ['reportes', 'Reportes', 'money', 'a/reportes']],
    soporte: [['reclamos', 'Reclamos', 'flag', 's/reclamos'], ['avisos', 'Avisos', 'bell', 'avisos']]
  };
  const ROL_TXT = { cliente: 'Cliente', prestador: 'Prestador', administrador: 'Administración', soporte: 'Soporte' };

  const App = {
    ruta: 'bienvenida',
    pila: [],
    vistos: new Set(),
    ocupado: false,

    yo() { return Api.sesion ? St.cuenta(Api.sesion.cuentaId) : null; },
    rol() { return Api.sesion ? Api.sesion.rol : null; },

    match(rutaTxt) {
      const partes = rutaTxt.split('/');
      for (const def of O.Rutas) {
        const pp = def.patron.split('/');
        if (pp.length !== partes.length) continue;
        const params = {};
        let okk = true;
        for (let i = 0; i < pp.length; i++) {
          if (pp[i][0] === ':') params[pp[i].slice(1)] = decodeURIComponent(partes[i]);
          else if (pp[i] !== partes[i]) { okk = false; break; }
        }
        if (okk) return { def, params };
      }
      return null;
    },

    go(rutaTxt, opts) {
      opts = opts || {};
      if (!opts.reemplazar && this.ruta !== rutaTxt) this.pila.push(this.ruta);
      if (this.pila.length > 40) this.pila.shift();
      if (rutaTxt !== this.ruta) U.errores = {};
      this.ruta = rutaTxt;
      this._nuevaRuta = true;
      this.render();
    },
    atras() {
      const m = this.match(this.ruta);
      const destino = this.pila.pop();
      if (destino && this.match(destino) && this.permitido(this.match(destino).def)) { this.ruta = destino; U.errores = {}; this._nuevaRuta = true; this.render(); return; }
      const b = m && m.def.back;
      this.go(typeof b === 'string' ? b : (this.rol() ? INICIO[this.rol()] : 'bienvenida'), { reemplazar: true });
    },

    permitido(def) {
      const rol = this.rol();
      if (def.rol === '*') return true;
      if (def.rol === 'publico') return !rol;
      if (!rol) return false;
      return Array.isArray(def.rol) ? def.rol.includes(rol) : def.rol === rol;
    },

    render() {
      if (Api.sesion && Api.sesion.debeCambiarClave) this.ruta = 'clave-temporal';
      let m = this.match(this.ruta);
      if (!m || !this.permitido(m.def) || (this.ruta === 'clave-temporal' && !(Api.sesion && Api.sesion.debeCambiarClave))) {
        this.ruta = this.rol() ? INICIO[this.rol()] : 'bienvenida';
        this.pila = [];
        m = this.match(this.ruta);
      }
      const rol = this.rol();
      const publico = !rol || this.ruta === 'clave-temporal';
      document.getElementById('device').classList.toggle('publico', publico);
      document.body.classList.toggle('publico', publico);
      document.body.classList.remove('menu-open');
      const screen = document.getElementById('screen');
      const scroll = screen.scrollTop;
      let titulo = '';
      try {
        titulo = m.def.titulo(m.params);
        screen.innerHTML = val(m.def.render(m.params));
      } catch (e) {
        console.error(e);
        screen.innerHTML = val(O.UI.vacio('alert', 'No encontramos esta pantalla', 'Puede que ya no exista o que no tengas acceso. Tus datos están a salvo.', h`<button class="btn btn-pri" data-act="ir-inicio">Volver al inicio</button>`));
      }
      this.marco(m, titulo);
      if (m.def.mount) m.def.mount(m.params);
      if (this._nuevaRuta) screen.scrollTop = 0; else screen.scrollTop = scroll;
      this._nuevaRuta = false;
      document.title = titulo ? titulo + ' · Ofira' : 'Ofira · Encuentra, cotiza y contrata con confianza';
      try { sessionStorage.setItem('ofira-ruta', this.ruta); } catch (e) { /* sin almacenamiento */ }
    },
    /* Barra superior, menú lateral y barra inferior (sin tocar el contenido) */
    marco(m, titulo) {
      m = m || this.match(this.ruta);
      if (titulo === undefined) { try { titulo = m.def.titulo(m.params); } catch (e) { titulo = ''; } }
      const badges = this.rol() ? this.badges() : {};
      document.getElementById('appbar').innerHTML = val(this.appbar(m, titulo));
      document.getElementById('netbar').innerHTML = val(this.netbar());
      document.getElementById('sidebar').innerHTML = val(this.sidebar(m, badges));
      document.getElementById('bottombar').innerHTML = val(this.bottombar(m, badges));
    },

    appbar(m, titulo) {
      const yo = this.yo();
      if (!yo) return '';
      const noLeidos = St.S.notificaciones.filter((n) => n.cuentaId === yo.id && !n.leida).length;
      const back = m.def.back;
      return h`<div class="bar-in">
        <button class="btn btn-icon btn-ghost bar-menu" data-act="menu-toggle" aria-label="Abrir menú" id="btn-menu">${icon('list')}</button>
        ${back ? h`<button class="btn btn-icon btn-ghost" data-act="atras" aria-label="Atrás" id="btn-atras">${icon('back')}</button>` : ''}
        <h1 class="bar-title">${titulo}</h1>
        <span class="role-chip">${ROL_TXT[this.rol()]}</span>
        <button class="btn btn-icon btn-ghost bell" data-go="avisos" aria-label="Avisos${noLeidos ? ', ' + noLeidos + ' sin leer' : ''}" id="btn-avisos">${icon('bell')}${noLeidos ? h`<span class="badge">${noLeidos > 9 ? '9+' : noLeidos}</span>` : ''}</button>
      </div>`;
    },
    netbar() {
      if (!Api.enLinea || !navigator.onLine) return h`<div class="net net-off" role="status">${icon('wifiOff')}<span><b>Sin conexión.</b> Puedes ver lo que ya cargó, pero nada se enviará hasta que vuelva la señal.</span></div>`;
      return '';
    },
    badges() {
      const rol = this.rol();
      const yo = this.yo();
      const b = {};
      if (!yo) return b;
      b.avisos = St.S.notificaciones.filter((n) => n.cuentaId === yo.id && !n.leida).length;
      if (rol === 'cliente') {
        b.cotiza = St.S.cotizaciones.filter((c) => c.estado === 'Enviada' && !c.servicioId && St.solicitud(c.solicitudId) && St.solicitud(c.solicitudId).clienteCuentaId === yo.id).length;
        b.contrata = St.S.cotizaciones.filter((c) => c.estado === 'Enviada' && c.servicioId && St.servicio(c.servicioId) && St.servicio(c.servicioId).clienteCuentaId === yo.id).length;
        b.calificaciones = St.S.servicios.filter((s) => s.clienteCuentaId === yo.id && St.puedeCalificar(s.id, yo.id).ok).length;
      } else if (rol === 'prestador') {
        const p = St.prestadorDeCuenta(yo.id);
        b.solicitudes = p ? St.S.invitaciones.filter((i) => i.prestadorId === p.id && i.estado === 'Pendiente').length : 0;
        b.inicio = b.solicitudes;
      } else if (rol === 'administrador') {
        b.verificacion = St.S.prestadores.filter((p) => p.estadoVerificacion === 'Pendiente de revisión').length;
        b.cuentas = (St.S.recuperaciones || []).length;
      } else if (rol === 'soporte') {
        b.reclamos = St.S.reclamos.filter((r) => r.estado === 'Abierto').length;
      }
      return b;
    },
    sidebar(m, badges) {
      const rol = this.rol();
      if (!rol) return '';
      const yo = this.yo();
      const nom = St.nombre(yo.id);
      const otros = yo.roles.filter((r) => r !== rol && (r === 'cliente' || r === 'prestador'));
      return h`<div class="sb-brand"><span class="sb-mark" aria-hidden="true">O</span><div><b>Ofira<i>.</i></b><small>Asunción Mita · Jutiapa</small></div></div>
        <div class="sb-user">${O.UI.avatar(nom, 's')}<div><b>${nom}</b><small>${ROL_TXT[rol]}</small></div></div>
        ${MENU[rol].map(([grupo, items]) => h`<div class="sb-group"><span>${grupo}</span>
          ${items.map(([k, t, ic, r]) => h`<button class="sb-item ${m.def.nav === k ? 'on' : ''}" data-go="${r}" ${m.def.nav === k ? O.UI.raw('aria-current="page"') : ''} id="nav-${k}">
            ${icon(ic)}<span>${t}</span>${badges[k] ? h`<span class="badge">${badges[k]}</span>` : ''}</button>`)}</div>`)}
        <div class="sb-foot">
          ${otros.map((r) => h`<button class="sb-item" data-act="cambiar-rol" data-v="${r}" id="sb-modo-${r}">${icon('refresh')}<span>Cambiar a modo ${r}</span></button>`)}
          <button class="sb-item" data-go="mi-clave" id="sb-clave">${icon('lock')}<span>Cambiar contraseña</span></button>
          <button class="sb-item" data-go="acerca">${icon('info')}<span>Ayuda y privacidad</span></button>
          <button class="sb-item" data-act="salir" id="sb-salir">${icon('out')}<span>Cerrar sesión</span></button>
        </div>`;
    },
    bottombar(m, badges) {
      const rol = this.rol();
      if (!rol) return '';
      return h`${RAPIDO[rol].map(([k, t, ic, r]) => h`<button class="tab-b ${m.def.nav === k ? 'on' : ''}" data-go="${r}" id="bnav-${k}">
        ${icon(ic)}<span>${t}</span>${badges[k] ? h`<span class="badge">${badges[k]}</span>` : ''}</button>`)}`;
    },

    /* Muestra como banner los avisos nuevos que llegan del servidor */
    avisosNuevos() {
      const yo = this.yo();
      if (!yo) return;
      const nuevos = St.S.notificaciones.filter((n) => n.cuentaId === yo.id && !n.leida && !this.vistos.has(n.id));
      nuevos.slice(-2).forEach((n) => toast(n.titulo, 'info'));
      nuevos.forEach((n) => this.vistos.add(n.id));
    },
    marcarVistos() {
      St.S.notificaciones.forEach((n) => this.vistos.add(n.id));
    },

    /* Ejecuta una acción en el servidor y muestra el estado que corresponda: éxito, error de regla o desconexión */
    async ejecutar(fn, alOk, alError) {
      if (this.ocupado) return null;
      this.ocupado = true;
      document.body.classList.add('cargando');
      let r;
      try { r = await fn(); } finally { this.ocupado = false; document.body.classList.remove('cargando'); }
      this.procesar(r, fn, alOk, alError);
      return r;
    },
    procesar(r, fn, alOk, alError) {
      if (r.ok) {
        if (alOk) alOk(r);
        this.render();
        this.avisosNuevos();
        return;
      }
      if (r.codigo === 'red') {
        this.marco();
        modal({
          titulo: 'Sin conexión',
          cuerpo: h`<div class="state-ill off">${icon('wifiOff', 'big')}</div><p>${r.error}</p><p class="small muted">Lo que escribiste sigue en la pantalla. Si ya se había enviado, al reintentar no se duplica.</p>`,
          acciones: [{ texto: 'Cerrar', valor: 'cerrar', clase: 'btn-sec' }, { texto: 'Reintentar', valor: 'reintentar', clase: 'btn-pri' }],
          alCerrar: (v) => {
            if (v !== 'reintentar') return;
            cerrarModal('');
            this.ejecutar(fn, alOk, alError);
          }
        });
        return;
      }
      if (alError && alError(r) === true) return;
      const titulos = { doble: 'Ya hay un prestador contratado', franja: 'Horario ocupado', vencida: 'Ya venció', 'sin-prestadores': 'Sin prestadores disponibles', datos: 'Faltan datos', permiso: 'Sin permiso', sesion: 'Tu sesión terminó' };
      modal({
        titulo: titulos[r.codigo] || 'No se pudo completar',
        cuerpo: h`<div class="state-ill bad">${icon(r.codigo === 'vencida' ? 'clock' : 'alert', 'big')}</div><p>${r.error}</p>`,
        acciones: [{ texto: 'Entendido', valor: 'ok', clase: 'btn-pri' }],
        alCerrar: () => this.render()
      });
    },

    /* Actualización automática: trae cambios hechos por otras personas (nuevas solicitudes, cotizaciones, avisos) */
    async actualizar() {
      if (this.ocupado || document.hidden) return;
      const antes = Api.enLinea;
      const hubo = await Api.estado();
      if (antes !== Api.enLinea) this.marco();
      if (!hubo) return;
      const modalAbierto = !document.getElementById('modal-root').hidden;
      const conFormulario = document.querySelector('#screen form[data-form]:not([data-form="mensaje"])');
      const escribiendo = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (!modalAbierto && !conFormulario && !escribiendo) this.render(); else this.marco();
      this.avisosNuevos();
    }
  };
  O.App = App;

  // ======================= Acciones (clics) =======================
  const A = {};
  function yo() { return App.yo(); }
  function irServicioSegunRol(srvId) { App.go((App.rol() === 'cliente' ? 'c' : 'p') + '/servicio/' + srvId); }

  A['ir-inicio'] = () => App.go(App.rol() ? INICIO[App.rol()] : 'bienvenida');
  A.atras = () => App.atras();
  A['modal-cerrar'] = (el) => cerrarModal(el.dataset.valor);
  A['menu-toggle'] = () => document.body.classList.toggle('menu-open');

  A['elegir-oficio'] = (el) => { O.nuevaBusqueda(el.dataset.id); App.go('c/buscar'); };
  A['buscar-modalidad'] = (el) => {
    const m = el.dataset.v; U.busqueda.modalidad = m;
    U.busqueda.horario = m === 'inmediata' ? { tipo: 'ahora' } : { tipo: 'programado', fecha: O.diaISO(St.ahora() + O.DIA), franja: 'manana' };
    App.render();
  };
  A['buscar-fecha'] = (el) => { U.busqueda.horario.fecha = el.dataset.v; App.render(); };
  A['buscar-franja'] = (el) => { U.busqueda.horario.franja = el.dataset.v; App.render(); };
  A['buscar-sector-sug'] = (el) => { U.busqueda.sectorId = el.dataset.v; App.render(); };
  A['toggle-sel'] = (el) => {
    const id = el.dataset.id;
    if (U.seleccion.includes(id)) U.seleccion = U.seleccion.filter((x) => x !== id);
    else if (U.seleccion.length < O.REGLAS.maxInvitaciones) U.seleccion.push(id);
    toast(U.seleccion.includes(id) ? 'Agregado a la invitación' : 'Quitado de la invitación');
    App.atras();
  };
  A['ir-solicitar'] = () => { if (U.seleccion.length) App.go('c/solicitar'); };
  A['tab-cotiza'] = (el) => { U.tabCotiza = el.dataset.v; App.render(); };
  A['tab-inv'] = (el) => { U.tabInv = el.dataset.v; App.render(); };
  A['filtro-hist'] = (el) => { U.filtroHist = el.dataset.v; App.render(); };
  A['filtro-ver'] = (el) => { U.filtroVer = el.dataset.v; App.render(); };
  A['filtro-rec'] = (el) => { U.filtroRec = el.dataset.v; App.render(); };
  A['filtro-sola'] = (el) => { U.filtroSolA = el.dataset.v; App.render(); };
  A['quitar-foto-sol'] = (el) => { U.borrador.sol.fotos = U.borrador.sol.fotos.filter((f) => f !== el.dataset.id); App.render(); };
  A['usar-ubicacion'] = () => {
    U.ubicError = '';
    if (!('geolocation' in navigator)) { U.ubicError = 'Este navegador no puede compartir la ubicación. Escribe la dirección y una referencia.'; App.render(); return; }
    if (!window.isSecureContext) { U.ubicError = 'Por seguridad, el navegador solo comparte la ubicación en sitios con https. Escribe la dirección o entra a Ofira con su enlace https.'; App.render(); return; }
    U.ubicCargando = true; App.render();
    navigator.geolocation.getCurrentPosition((pos) => {
      U.ubicCargando = false;
      if (U.borrador.sol) U.borrador.sol.ubicacion = { lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) };
      App.render(); toast('Ubicación agregada');
    }, (e) => {
      U.ubicCargando = false;
      U.ubicError = e.code === 1 ? 'No diste permiso para usar tu ubicación. Puedes activarlo en el candado junto a la dirección del sitio, o escribir la dirección.'
        : e.code === 3 ? 'Se tardó demasiado en encontrar tu ubicación. Intenta de nuevo cerca de una ventana o con mejor señal.'
          : 'No pudimos obtener tu ubicación. Revisa que el GPS esté activado.';
      App.render();
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  };
  A['quitar-ubicacion'] = () => { if (U.borrador.sol) U.borrador.sol.ubicacion = null; U.ubicError = ''; App.render(); };
  A['borrar-direccion'] = () => App.ejecutar(() => Api.accion('borrarDireccion'), () => { if (U.borrador.sol) U.borrador.sol = null; toast('Dirección guardada borrada', 'info'); });
  A['quitar-foto-rec'] = (el) => { U.evidencia = (U.evidencia || []).filter((f) => f !== el.dataset.id); App.render(); };

  A.reenviar = (el) => App.ejecutar(() => Api.accion('reenviar', el.dataset.id), (r) => toast('Reenviada a ' + r.invitados.length + ' prestador(es)'));

  function selectMotivo(id, opciones) {
    return h`<div class="field"><label for="${id}">Motivo</label><select id="${id}" name="motivo"><option value="">Elige un motivo</option>${opciones.map((o) => h`<option>${o}</option>`)}</select></div>`;
  }
  /* Modal de confirmación que ejecuta una acción en el servidor */
  function confirmar(opts, accion) {
    modal(Object.assign({}, opts, {
      alCerrar: (v, form) => {
        if (v !== 'si') return;
        const datos = opts.leer ? opts.leer(form) : null;
        if (datos && datos.error) { modalError(datos.error); return false; }
        cerrarModal('');
        accion(datos);
      }
    }));
  }

  A['cancelar-solicitud'] = (el) => confirmar({
    titulo: 'Cancelar solicitud',
    cuerpo: h`<p>Los prestadores invitados recibirán un aviso y sus cotizaciones se anularán.</p>${selectMotivo('m-cancel', ['Ya lo resolví', 'Encontré a alguien por fuera', 'Los precios son altos', 'Me equivoqué al pedir', 'Otro'])}`,
    acciones: [{ texto: 'Volver', valor: 'no', clase: 'btn-sec' }, { texto: 'Cancelar solicitud', valor: 'si', clase: 'btn-danger' }],
    leer: (f) => (f.motivo.value ? { motivo: f.motivo.value } : { error: 'Elige un motivo.' })
  }, (d) => App.ejecutar(() => Api.accion('cancelarSolicitud', el.dataset.id, d.motivo), () => toast('Solicitud cancelada')));

  A['aprobar-cot'] = (el) => {
    const c = St.cotizacion(el.dataset.id);
    const inicial = !c.servicioId;
    const otras = inicial ? St.cotizacionesDe(c.solicitudId).filter((x) => x.id !== c.id && x.estado === 'Enviada').length : 0;
    confirmar({
      titulo: 'Aprobar cotización',
      cuerpo: h`<p>Vas a aprobar <b>${St.dinero(St.totales(c).total)}</b> con ${St.nombrePrestador(c.prestadorId)}.</p>
        ${inicial ? h`<p class="small">Se creará el servicio y ${St.nombrePrestador(c.prestadorId).split(' ')[0]} podrá ver tu dirección exacta.${otras ? ' Las otras ' + otras + ' cotización(es) se anularán y se avisará a esos prestadores.' : ''}</p>` : h`<p class="small">Se agregará al servicio en curso.</p>`}`,
      acciones: [{ texto: 'Volver', valor: 'no', clase: 'btn-sec' }, { texto: 'Aprobar', valor: 'si', clase: 'btn-pri' }]
    }, () => App.ejecutar(() => Api.accion('aprobarCotizacion', c.id), (r) => {
      if (inicial) { toast('Servicio confirmado ' + r.servicio.folio); App.go('c/servicio/' + r.servicio.id); } else { toast('Cotización aprobada'); App.go('c/servicio/' + c.servicioId); }
    }));
  };
  A['rechazar-cot'] = (el) => {
    const c = St.cotizacion(el.dataset.id);
    let advertencia = '';
    if (c.tipo === 'trabajo' && c.servicioId) {
      const visita = St.cotizacion(St.servicio(c.servicioId).cotizacionId);
      advertencia = h`<p class="note note-act">${icon('info')}<span>Si la rechazas, el servicio se finaliza y solo pagas la visita (${St.dinero(St.totales(visita).total)}).</span></p>`;
    }
    confirmar({
      titulo: 'Rechazar cotización',
      cuerpo: h`${advertencia}${selectMotivo('m-rech', ['El precio es alto', 'Ya no lo necesito', 'Prefiero otra cotización', 'No entiendo el detalle', 'Otro'])}`,
      acciones: [{ texto: 'Volver', valor: 'no', clase: 'btn-sec' }, { texto: 'Rechazar', valor: 'si', clase: 'btn-danger' }],
      leer: (f) => (f.motivo.value ? { motivo: f.motivo.value } : { error: 'Elige un motivo.' })
    }, (d) => App.ejecutar(() => Api.accion('rechazarCotizacion', c.id, d.motivo), () => {
      toast('Cotización rechazada', 'info');
      if (c.servicioId) App.go('c/servicio/' + c.servicioId); else App.go('c/solicitud/' + c.solicitudId);
    }));
  };
  A['cancelar-servicio'] = (el) => confirmar({
    titulo: 'Cancelar servicio',
    cuerpo: h`<p>Solo se puede cancelar antes de que empiece. La otra parte recibirá un aviso con tu motivo.</p><div class="field"><label for="m-motsrv">Motivo</label><textarea id="m-motsrv" name="motivo" rows="2" maxlength="300"></textarea></div>`,
    acciones: [{ texto: 'Volver', valor: 'no', clase: 'btn-sec' }, { texto: 'Cancelar servicio', valor: 'si', clase: 'btn-danger' }],
    leer: (f) => (f.motivo.value.trim() ? { motivo: f.motivo.value } : { error: 'Indica el motivo de la cancelación.' })
  }, (d) => App.ejecutar(() => Api.accion('cancelarServicio', el.dataset.id, d.motivo), () => toast('Servicio cancelado', 'info')));

  // ---------- Prestador ----------
  A['aceptar-inv'] = (el) => App.ejecutar(() => Api.accion('responderInvitacion', el.dataset.id, true), () => toast('Aceptaste. Ahora prepara tu cotización.'));
  A['rechazar-inv'] = (el) => confirmar({
    titulo: 'Rechazar invitación',
    cuerpo: h`<p>El cliente verá que no puedes atender.</p>${selectMotivo('m-rinv', ['No tengo disponibilidad en ese horario', 'Está fuera de mi especialidad', 'Queda lejos de mi cobertura', 'Otro'])}`,
    acciones: [{ texto: 'Volver', valor: 'no', clase: 'btn-sec' }, { texto: 'Rechazar', valor: 'si', clase: 'btn-danger' }],
    leer: (f) => (f.motivo.value ? { motivo: f.motivo.value } : { error: 'Elige un motivo.' })
  }, (d) => App.ejecutar(() => Api.accion('responderInvitacion', el.dataset.id, false, d.motivo), () => toast('Invitación rechazada', 'info')));
  A['agregar-linea'] = (el) => { U.cot.lineas.push({ categoria: el.dataset.cat, concepto: '', monto: '' }); App.render(); };
  A['quitar-linea'] = (el) => { U.cot.lineas.splice(Number(el.dataset.i), 1); App.render(); };
  function datosCotizacion(form) {
    return { id: U.cot.id, solicitudId: form.dataset.sol, servicioId: form.dataset.srv || null, tipo: form.dataset.tipo, lineas: U.cot.lineas, nota: U.cot.nota, tiempoEstimado: U.cot.tiempoEstimado };
  }
  function datosInvalidos(r) {
    if (r.codigo === 'datos') { U.errores = { _: r.error }; App.render(); return true; }
    return false;
  }
  A['guardar-borrador'] = () => {
    const d = datosCotizacion(document.querySelector('[data-form="cotizacion"]'));
    App.ejecutar(() => Api.accion('guardarCotizacion', d, false), (r) => { U.cot.id = r.cotizacion.id; toast('Borrador guardado'); }, datosInvalidos);
  };
  A['iniciar-servicio'] = (el) => App.ejecutar(() => Api.accion('iniciarServicio', el.dataset.id), () => toast('Servicio en ejecución'));
  A['en-camino'] = (el) => confirmar({
    titulo: 'Avisar que vas en camino',
    cuerpo: h`<p>El cliente recibirá un aviso con la hora aproximada de llegada.</p><fieldset class="field"><legend class="lbl">¿Cuánto tardas en llegar?</legend><div class="checks row wrap">
      ${[10, 20, 30, 45, 60].map((m, i) => h`<label class="check pill"><input type="radio" name="minutos" value="${m}" ${i === 1 ? 'checked' : ''}><span>${m} min</span></label>`)}</div></fieldset>`,
    acciones: [{ texto: 'Volver', valor: 'no', clase: 'btn-sec' }, { texto: 'Avisar al cliente', valor: 'si', clase: 'btn-pri' }],
    leer: (f) => ({ minutos: Number(f.minutos.value) })
  }, (d) => App.ejecutar(() => Api.accion('marcarEnCamino', el.dataset.id, d.minutos), () => toast('Avisaste al cliente que vas en camino')));
  function radiosPago(conPendiente) {
    const ops = [['Efectivo', 'Me pagaron en efectivo'], ['Transferencia', 'Me pagaron por transferencia']];
    if (conPendiente) ops.push(['', 'Todavía no me pagan']);
    return h`<fieldset class="field"><legend class="lbl">Pago</legend>${ops.map(([v, t], i) => h`<label class="check"><input type="radio" name="metodo" value="${v}" ${i === 0 ? 'checked' : ''}><span>${t}</span></label>`)}</fieldset>`;
  }
  A['finalizar-servicio'] = (el) => {
    const srv = St.servicio(el.dataset.id);
    const sol = St.solicitud(srv.solicitudId);
    const aprob = St.cotizacionesDeServicio(srv).filter((c) => c.estado === 'Aprobada');
    const mano = aprob.reduce((a, c) => a + St.totales(c).mano_obra, 0);
    const total = aprob.reduce((a, c) => a + St.totales(c).total, 0);
    const p = St.prestador(srv.prestadorId);
    const exento = St.ahora() - p.alta < O.REGLAS.mesesSinComision * 30 * O.DIA;
    const soloVisita = sol.modalidad === 'diagnostico' && !St.cotizacionesDeServicio(srv).some((c) => c.tipo === 'trabajo' && c.servicioId === srv.id && c.estado === 'Aprobada');
    confirmar({
      titulo: 'Finalizar servicio',
      cuerpo: h`${soloVisita ? h`<p class="note note-act">${icon('info')}<span>No hay cotización de trabajo aprobada. Se cerrará cobrando solo la visita.</span></p>` : ''}
        <div class="kv"><span>Total a cobrar al cliente</span><b class="num">${St.dinero(total)}</b><span>Comisión Ofira (8 % de ${St.dinero(mano)})</span><b class="num">${exento ? 'Q 0.00 · primer mes' : St.dinero(Math.round(mano * O.REGLAS.comision * 100) / 100)}</b></div>
        ${radiosPago(true)}`,
      acciones: [{ texto: 'Volver', valor: 'no', clase: 'btn-sec' }, { texto: 'Finalizar', valor: 'si', clase: 'btn-pri' }],
      leer: (f) => ({ metodo: f.metodo.value })
    }, (d) => App.ejecutar(() => Api.accion('finalizarServicio', srv.id, { metodo: d.metodo }), () => toast('Servicio finalizado')));
  };
  A['marcar-pagado'] = (el) => confirmar({
    titulo: 'Registrar pago',
    cuerpo: h`<p class="small">El pago entre cliente y prestador es fuera de la app. Aquí registras cómo te pagaron.</p>${radiosPago(false)}`,
    acciones: [{ texto: 'Volver', valor: 'no', clase: 'btn-sec' }, { texto: 'Registrar', valor: 'si', clase: 'btn-pri' }],
    leer: (f) => ({ metodo: f.metodo.value })
  }, (d) => App.ejecutar(() => Api.accion('marcarPagado', el.dataset.id, d.metodo), () => toast('Pago registrado: ' + d.metodo)));
  A['quitar-galeria'] = (el) => App.ejecutar(() => Api.accion('quitarGaleria', el.dataset.id), () => toast('Foto quitada de tu galería', 'info'));

  // ---------- Administración y soporte ----------
  A.verificar = (el) => {
    const nota = document.getElementById('ver-nota').value;
    if (el.dataset.v !== 'Verificado' && !nota.trim()) { U.errores = { nota: 'Escribe qué debe corregir o por qué se suspende.' }; App.render(); return; }
    U.errores = {};
    App.ejecutar(() => Api.accion('verificar', el.dataset.id, el.dataset.v, nota), () => toast('Prestador: ' + el.dataset.v));
  };
  A['alternar-oficio'] = (el) => App.ejecutar(() => Api.accion('alternarOficio', el.dataset.id), () => toast('Oficio actualizado'));
  A['alternar-cuenta'] = (el) => App.ejecutar(() => Api.accion('alternarCuenta', el.dataset.id), () => toast('Cuenta actualizada'));
  A['restablecer-clave'] = (el) => {
    const c = St.cuenta(el.dataset.id);
    confirmar({
      titulo: 'Restablecer contraseña',
      cuerpo: h`<p>Se creará una contraseña temporal para <b>${St.nombre(c.id)}</b> (${c.correo}). Al entrar, tendrá que cambiarla.</p>
        <p class="note note-act">${icon('alert')}<span>Antes, confirma la identidad de la persona llamando al teléfono registrado en su cuenta.</span></p>`,
      acciones: [{ texto: 'Volver', valor: 'no', clase: 'btn-sec' }, { texto: 'Crear contraseña temporal', valor: 'si', clase: 'btn-pri' }]
    }, async () => {
      const r = await Api.restablecer(c.id);
      if (!r.ok) return App.procesar(r);
      App.render();
      modal({
        titulo: 'Contraseña temporal',
        cuerpo: h`<p>Entrégala a la persona por teléfono. Solo se muestra esta vez.</p><p class="amount num" style="font-size:26px;user-select:all">${r.temporal}</p>`,
        acciones: [{ texto: 'Listo', valor: 'ok', clase: 'btn-pri' }]
      });
    });
  };
  A['reclamo-avanzar'] = (el) => {
    const nota = document.getElementById('rec-nota').value;
    if (el.dataset.v === 'Resuelto' && nota.trim().length < 10) { U.errores = { nota: 'Escribe la resolución (al menos 10 caracteres).' }; App.render(); return; }
    U.errores = {};
    App.ejecutar(() => Api.accion('transicionReclamo', el.dataset.id, el.dataset.v, nota), () => toast('Reclamo: ' + el.dataset.v));
  };

  // ---------- Avisos y sesión ----------
  A['leer-todo'] = () => App.ejecutar(() => Api.accion('leerAvisos'));
  A['abrir-aviso'] = async (el) => {
    const n = St.S.notificaciones.find((x) => x.id === el.dataset.id);
    if (!n.leida) await Api.accion('leerAviso', n.id);
    if (n.ir && App.match(n.ir) && App.permitido(App.match(n.ir).def)) App.go(n.ir); else App.render();
  };
  A['cambiar-rol'] = async (el) => {
    const r = await Api.rol(el.dataset.v);
    if (!r.ok) return App.procesar(r);
    App.pila = []; App.marcarVistos(); App.go(INICIO[el.dataset.v], { reemplazar: true });
  };
  A.salir = async () => {
    await Api.logout();
    limpiarUI(); App.pila = [];
    App.go('bienvenida', { reemplazar: true });
  };

  function limpiarUI() {
    U.errores = {}; U.borrador = {}; U.seleccion = []; U.busqueda = null; U.clave = null; U.cot = null; U.recuperar = null; U.evidencia = [];
  }

  // ======================= Cambios en campos =======================
  const C = {};
  C['buscar-sector'] = (el) => { U.busqueda.sectorId = el.value; App.render(); };
  C['sel-prestador'] = (el) => {
    if (el.checked && U.seleccion.length < O.REGLAS.maxInvitaciones) U.seleccion.push(el.value);
    if (!el.checked) U.seleccion = U.seleccion.filter((x) => x !== el.value);
    App.render();
  };
  C['reg-prestador'] = (el) => { guardarRegistro(el.form); U.borrador.reg.prestador = el.checked; App.render(); };
  C['reg-dpi'] = async (el) => {
    guardarRegistro(el.form);
    const f = el.files && el.files[0];
    if (!f) return;
    try { U.borrador.reg.dpiFoto = await Api.comprimir(f, 1600); delete U.errores.dpiFoto; } catch (e) { U.errores.dpiFoto = e.message; }
    App.render();
  };
  /* Sube las fotos elegidas (comprimidas) y guarda sus identificadores */
  async function subir(files, max, actuales, alTerminar) {
    const lista = Array.from(files || []).slice(0, Math.max(0, max - actuales.length));
    if (!lista.length) { toast('Puedes adjuntar hasta ' + max + ' fotos.', 'bad'); return; }
    App.subiendo = true; App.render();
    const ids = [];
    for (const f of lista) {
      const r = await Api.subirFoto(f);
      if (r.ok) ids.push(r.id); else { toast(r.error, 'bad'); break; }
    }
    App.subiendo = false;
    alTerminar(ids);
    App.render();
  }
  C['sol-fotos'] = (el) => subir(el.files, 3, U.borrador.sol.fotos, (ids) => { U.borrador.sol.fotos = U.borrador.sol.fotos.concat(ids); });
  C['sol-guardar'] = (el) => { if (U.borrador.sol) U.borrador.sol.guardarDireccion = el.checked; };
  C['rec-evid'] = (el) => {
    const f = el.form; U.borrador.rec = { motivo: f.motivo.value, descripcion: f.descripcion.value };
    subir(el.files, 3, U.evidencia || [], (ids) => { U.evidencia = (U.evidencia || []).concat(ids); });
  };
  C['chat-foto'] = async (el) => {
    const f = el.files && el.files[0];
    if (!f) return;
    const form = el.form;
    App.subiendo = true; App.marco();
    const r = await Api.subirFoto(f);
    App.subiendo = false;
    if (!r.ok) { toast(r.error, 'bad'); return; }
    App.ejecutar(() => Api.accion('enviarMensaje', form.dataset.sol, form.dataset.pid, form.texto.value, r.id));
  };
  C['galeria-foto'] = async (el) => {
    const f = el.files && el.files[0];
    if (!f) return;
    const desc = (document.getElementById('gal-desc') || {}).value || '';
    App.subiendo = true; App.render();
    const r = await Api.subirFoto(f);
    App.subiendo = false;
    if (!r.ok) { App.render(); toast(r.error, 'bad'); return; }
    App.ejecutar(() => Api.accion('agregarGaleria', r.id, desc), () => toast('Foto agregada a tu galería'));
  };
  C.estrellas = (el) => { U.borrador.estrellas = Number(el.value); const f = el.form; U.borrador.comentario = f.comentario.value; delete U.errores.estrellas; App.render(); };
  C['disponible-ahora'] = (el) => {
    const v = el.checked;
    App.ejecutar(() => Api.accion('setDisponibleAhora', v), () => toast(v ? 'Ahora apareces como disponible' : 'Ya no apareces en solicitudes inmediatas', 'info'));
  };
  C['agregar-rol'] = (el) => {
    if (!el.value) return;
    App.ejecutar(() => Api.accion('agregarRol', el.dataset.id, el.value), () => toast('Rol agregado'));
  };

  function guardarRegistro(form) {
    const fd = new FormData(form);
    const prev = U.borrador.reg || {};
    U.borrador.reg = Object.assign(prev, {
      nombre: fd.get('nombre') || '', telefono: fd.get('telefono') || '', correo: fd.get('correo') || '', sectorId: fd.get('sectorId') || '',
      oficioId: fd.get('oficioId') || prev.oficioId || '', experiencia: fd.get('experiencia') || prev.experiencia || '', referencia: fd.get('referencia') || prev.referencia || ''
    });
  }

  // ======================= Formularios =======================
  const F = {};
  const correoOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const claveOk = (c) => c.length >= 8 && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(c) && /\d/.test(c);

  F.acceso = async (form) => {
    const correo = form.correo.value.trim(); const clave = form.clave.value;
    U.borrador.accCorreo = correo;
    const e = {};
    if (!correo) e.correo = 'Escribe tu correo.'; else if (!correoOk(correo)) e.correo = 'El correo no tiene un formato válido.';
    if (!clave) e.clave = 'Escribe tu contraseña.';
    U.errores = e;
    if (Object.keys(e).length) { App.render(); return; }
    const btn = document.getElementById('btn-entrar'); if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }
    const r = await Api.login(correo, clave);
    if (!r.ok) {
      if (r.codigo === 'red') return App.procesar(r, () => Api.login(correo, clave), () => { App.marcarVistos(); App.go(INICIO[App.rol()], { reemplazar: true }); });
      U.errores = { _: r.error }; App.render(); return;
    }
    limpiarUI(); App.marcarVistos(); App.pila = [];
    App.go(INICIO[App.rol()], { reemplazar: true });
  };

  F.registro = async (form) => {
    guardarRegistro(form);
    const b = U.borrador.reg;
    const e = {};
    if (b.nombre.trim().length < 5) e.nombre = 'Escribe tu nombre y apellido.';
    if (!/^\d{4}-?\d{4}$/.test(b.telefono.trim())) e.telefono = 'Escribe 8 dígitos, por ejemplo 5555-1234.';
    if (!correoOk(b.correo.trim())) e.correo = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    if (!claveOk(form.clave.value || '')) e.clave = 'Usa al menos 8 caracteres, con letras y números.';
    if (!b.sectorId) e.sectorId = 'Elige tu sector.';
    if (b.prestador) {
      if (!b.oficioId) e.oficioId = 'Elige tu oficio.';
      if (b.experiencia === '' || Number(b.experiencia) < 0) e.experiencia = 'Escribe tus años de experiencia.';
      if (!b.dpiFoto) e.dpiFoto = 'Adjunta la foto de tu DPI.';
      if (b.referencia.trim().length < 5) e.referencia = 'Escribe una referencia de trabajo.';
    }
    U.errores = e;
    if (Object.keys(e).length) { App.render(); focoErrores(); return; }
    const datos = Object.assign({}, b, { clave: form.clave.value });
    App.ejecutar(() => Api.registro(datos), () => {
      limpiarUI(); App.marcarVistos(); App.pila = [];
      toast(datos.prestador ? 'Cuenta creada. Tu perfil de prestador quedó Pendiente de revisión.' : 'Cuenta creada. ¡Bienvenido a Ofira!');
      App.go('c/encuentra', { reemplazar: true });
    }, (r) => { U.errores = Object.assign({}, r.campos || {}, r.campos ? {} : { _: r.error }); App.render(); focoErrores(); return true; });
  };

  F['recuperar-1'] = async (form) => {
    const dato = form.dato.value;
    if (!dato.trim()) { U.errores = { dato: 'Escribe tu correo o teléfono.' }; App.render(); return; }
    App.ejecutar(() => Api.recuperar(dato), () => { U.recuperar = { paso: 2 }; U.errores = {}; });
  };

  F.clave = async (form) => {
    const actual = form.actual ? form.actual.value : ''; const nueva = form.nueva.value; const repetir = form.repetir.value;
    const e = {};
    if (form.actual && !actual) e.actual = 'Escribe tu contraseña actual.';
    if (!claveOk(nueva)) e.nueva = 'Usa al menos 8 caracteres, con letras y números.';
    else if (nueva !== repetir) e.repetir = 'Las contraseñas no coinciden.';
    U.errores = e;
    if (Object.keys(e).length) { App.render(); return; }
    const temporal = !!(Api.sesion && Api.sesion.debeCambiarClave);
    App.ejecutar(() => Api.cambiarClave(actual, nueva), () => {
      toast('Contraseña actualizada');
      if (temporal) { App.pila = []; App.ruta = INICIO[App.rol()]; } else form.reset();
    }, (r) => { if (r.campos) { U.errores = r.campos; App.render(); return true; } return false; });
  };

  F.solicitud = (form) => {
    const b = U.busqueda; const d = U.borrador.sol;
    d.especialidadId = form.especialidadId.value; d.descripcion = form.descripcion.value; d.direccion = form.direccion.value; d.referencia = form.referencia.value; d.medidas = form.medidas.value;
    const e = {};
    if (!d.especialidadId) e.especialidadId = 'Elige el tipo de trabajo.';
    if (d.descripcion.trim().length < 15) e.descripcion = 'Describe el problema con al menos 15 caracteres.';
    if (d.direccion.trim().length < 5) e.direccion = 'Escribe la dirección o señas de tu casa.';
    U.errores = e;
    if (Object.keys(e).length) { App.render(); focoErrores(); return; }
    const datos = { oficioId: b.oficioId, modalidad: b.modalidad, sectorId: b.sectorId, horario: Object.assign({}, b.horario), especialidadId: d.especialidadId, descripcion: d.descripcion, direccion: d.direccion, referencia: d.referencia, medidas: d.medidas, fotos: d.fotos,
      ubicacion: d.ubicacion || null, guardarDireccion: !!d.guardarDireccion };
    const sel = U.seleccion.slice(); const clave = U.clave;
    App.ejecutar(() => Api.accion('crearSolicitud', datos, sel, clave), (r) => {
      if (r.repetida) toast('Tu solicitud ya estaba registrada. No se creó un duplicado.', 'info');
      else toast('Solicitud ' + r.solicitud.folio + ' enviada');
      U.borrador.sol = null; U.clave = null; U.seleccion = []; U.busqueda = null;
      App.pila = ['c/encuentra'];
      App.go('c/enviada/' + r.solicitud.id, { reemplazar: true });
    });
  };

  F.calificar = (form) => {
    const est = U.borrador.estrellas || 0;
    if (!est) { U.errores = { estrellas: 'Elige de 1 a 5 estrellas.' }; U.borrador.comentario = form.comentario.value; App.render(); return; }
    const id = form.dataset.id; const com = form.comentario.value;
    App.ejecutar(() => Api.accion('calificar', id, est, com), (r) => {
      U.borrador.estrellas = 0; U.borrador.comentario = '';
      toast(r.retenida ? 'Calificación guardada. Se publicará al resolverse el reclamo.' : 'Gracias. Tu calificación se publicó.');
      App.pila = []; irServicioSegunRol(id);
    });
  };

  F.reclamo = (form) => {
    const id = form.dataset.id;
    const motivo = form.motivo.value; const desc = form.descripcion.value;
    U.borrador.rec = { motivo, descripcion: desc };
    const e = {};
    if (!motivo) e.motivo = 'Elige el motivo.';
    if (desc.trim().length < 15) e.descripcion = 'Describe lo que pasó (al menos 15 caracteres).';
    U.errores = e;
    if (Object.keys(e).length) { App.render(); focoErrores(); return; }
    App.ejecutar(() => Api.accion('abrirReclamo', id, motivo, desc, U.evidencia || []), (r) => {
      U.borrador.rec = null; U.evidencia = [];
      toast('Reclamo ' + r.reclamo.folio + ' enviado a soporte');
      App.pila = []; irServicioSegunRol(id);
    }, (r) => { if (r.codigo === 'datos') { U.errores = { _: r.error }; App.render(); return true; } return false; });
  };

  F.mensaje = (form) => {
    const texto = form.texto.value;
    if (!texto.trim()) return;
    App.ejecutar(() => Api.accion('enviarMensaje', form.dataset.sol, form.dataset.pid, texto, ''), () => {
      setTimeout(() => { const i = document.getElementById('msg-txt'); if (i) i.focus(); }, 0);
    });
  };

  F.cotizacion = (form) => {
    const d = datosCotizacion(form);
    App.ejecutar(() => Api.accion('guardarCotizacion', d, true), (r) => {
      toast('Cotización ' + r.cotizacion.folio + ' enviada');
      U.cot = null;
      if (d.servicioId) App.go('p/servicio/' + d.servicioId, { reemplazar: true });
      else {
        const p = St.prestadorDeCuenta(yo().id);
        App.go('p/invitacion/' + St.S.invitaciones.find((i) => i.solicitudId === d.solicitudId && i.prestadorId === p.id).id, { reemplazar: true });
      }
    }, datosInvalidos);
  };

  F.avance = (form) => {
    const texto = form.texto.value;
    if (!texto.trim()) { toast('Escribe qué avanzaste.', 'bad'); return; }
    App.ejecutar(() => Api.accion('registrarAvance', form.dataset.id, texto), () => toast('Avance registrado'));
  };

  F['perfil-prestador'] = (form) => {
    const fd = new FormData(form);
    const precios = {};
    form.querySelectorAll('[data-precio]').forEach((i) => { if (i.value) precios[i.dataset.precio] = Number(i.value); });
    const d = {
      especialidades: fd.getAll('especialidades'), cobertura: fd.getAll('cobertura'), dias: fd.getAll('dias'), franjas: fd.getAll('franjas'),
      experiencia: fd.get('experiencia'), descripcion: fd.get('descripcion') || '', condiciones: fd.get('condiciones') || '', costoVisita: fd.get('costoVisita') || 0, precios
    };
    const e = {};
    if (!d.especialidades.length) e.especialidades = 'Elige al menos una especialidad.';
    if (!d.cobertura.length) e.cobertura = 'Elige al menos un sector.';
    if (!d.dias.length) e.dias = 'Elige al menos un día.';
    if (!d.franjas.length) e.franjas = 'Elige al menos una franja.';
    U.errores = e;
    if (Object.keys(e).length) { App.render(); focoErrores(); return; }
    App.ejecutar(() => Api.accion('actualizarPerfil', d), () => toast('Perfil actualizado'), datosInvalidos);
  };

  F.especialidad = (form) => {
    const nombre = form.nombre.value;
    App.ejecutar(() => Api.accion('agregarEspecialidad', form.dataset.id, nombre), () => { U.errores = {}; toast('Especialidad agregada'); }, (r) => { U.errores = { _: r.error }; App.render(); return true; });
  };
  F.oficio = (form) => {
    const fd = new FormData(form);
    const nombre = fd.get('nombre'); const mods = fd.getAll('modalidades');
    const e = {};
    if (!nombre || nombre.trim().length < 3) e.nombre = 'Escribe el nombre del oficio.';
    if (!mods.length) e.modalidades = 'Elige al menos una modalidad.';
    U.errores = e;
    if (Object.keys(e).length) { App.render(); return; }
    App.ejecutar(() => Api.accion('agregarOficio', nombre, mods), () => { U.errores = {}; toast('Oficio agregado. Ya aparece en el catálogo del cliente.'); }, (r) => { U.errores = { _: r.error }; App.render(); return true; });
  };

  F.modal = (form, ev) => {
    const b = ev.submitter || form.querySelector('.btn-pri, .btn-danger');
    cerrarModal(b ? b.dataset.valor : 'ok');
  };

  function focoErrores() {
    setTimeout(() => {
      const r = document.getElementById('resumen-errores');
      const primero = document.querySelector('#screen [aria-invalid="true"]');
      (primero || r) && (primero || r).focus();
    }, 0);
  }

  // ======================= Delegación de eventos =======================
  document.addEventListener('click', (ev) => {
    const go = ev.target.closest('[data-go]');
    if (go && !go.disabled) { ev.preventDefault(); App.go(go.dataset.go); return; }
    const act = ev.target.closest('[data-act]');
    if (act && !act.disabled && A[act.dataset.act]) {
      ev.preventDefault();
      A[act.dataset.act](act, ev);
    }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-change]');
    if (el && C[el.dataset.change]) C[el.dataset.change](el, ev);
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.input === 'sol' && U.borrador.sol) U.borrador.sol[el.name] = el.value;
    if (el.dataset.linea !== undefined && U.cot) {
      const l = U.cot.lineas[Number(el.dataset.linea)];
      if (l) l[el.dataset.k] = el.value;
      const t = St.totales({ lineas: U.cot.lineas.map((x) => ({ categoria: x.categoria, monto: Number(x.monto) || 0 })) });
      const tot = document.getElementById('cot-total'); if (tot) tot.textContent = St.dinero(t.total);
      document.querySelectorAll('.q-edit').forEach((fs, i) => { const b = fs.querySelector('legend b'); if (b) b.textContent = St.dinero(t[['mano_obra', 'materiales', 'cargos'][i]]); });
    }
    if (el.dataset.cotk && U.cot) U.cot[el.dataset.cotk] = el.value;
    if (el.dataset.input === 'filtro-oficio') {
      const q = el.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      let visibles = 0;
      document.querySelectorAll('#screen [data-buscar]').forEach((c) => {
        const ok = !q || c.dataset.buscar.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q);
        c.hidden = !ok; if (ok) visibles += 1;
      });
      const sin = document.getElementById('oficio-sin'); if (sin) sin.hidden = visibles > 0;
    }
  });
  document.addEventListener('submit', (ev) => {
    const form = ev.target.closest('[data-form]');
    if (!form) return;
    ev.preventDefault();
    if (F[form.dataset.form]) F[form.dataset.form](form, ev);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !document.getElementById('modal-root').hidden) cerrarModal('');
    else if (ev.key === 'Escape') document.body.classList.remove('menu-open');
  });
  window.addEventListener('online', () => { Api.enLinea = true; App.marco(); App.actualizar(); });
  window.addEventListener('offline', () => App.marco());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) App.actualizar(); });

  // Cuentas regresivas cada segundo y cambios del servidor cada 8 segundos
  let ciclo = 0;
  setInterval(() => {
    document.querySelectorAll('[data-vence]').forEach((el) => {
      const b = el.querySelector('[data-cd]');
      if (b) b.textContent = O.UI.restante(Number(el.dataset.vence));
    });
    ciclo += 1;
    if (ciclo % 8 === 0 && St.S) App.actualizar();
  }, 1000);

  // ======================= Arranque =======================
  async function arrancar() {
    document.getElementById('screen').innerHTML = '<div class="carga"><div><span class="logo">Ofira<i>.</i></span><p>Cargando…</p></div></div>';
    let listo = await Api.estado();
    while (!listo && !St.S) {
      document.getElementById('screen').innerHTML = val(O.UI.vacio('wifiOff', 'No pudimos conectar con Ofira', 'Revisa tu conexión. Volveremos a intentar en unos segundos.'));
      await new Promise((r) => setTimeout(r, 4000));
      listo = await Api.estado();
    }
    App.marcarVistos();
    let r = null;
    try { r = sessionStorage.getItem('ofira-ruta'); } catch (e) { /* sin almacenamiento */ }
    App.ruta = r && App.match(r) ? r : (App.rol() ? INICIO[App.rol()] : 'bienvenida');
    App._nuevaRuta = true;
    App.render();
  }
  O.arrancar = arrancar;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
