/* Ofira · Pantallas públicas (acceso) y del cliente: Encuentra, Cotiza y Contrata. */
(function () {
  'use strict';
  const O = window.Ofira;
  const { h, raw, icon, estado, simulado, fotos, calif, avatar, fecha, fechaCorta, hace, cuenta, horarioTexto, vacio, aviso, cotTabla, timeline, mapa } = O.UI;
  const St = O.Store;
  const R = O.Rutas = O.Rutas || [];
  const U = O.UIState = O.UIState || { errores: {}, borrador: {}, seleccion: [], busqueda: null };
  const app = () => O.App;

  function ruta(def) { R.push(def); }
  function err(campo) { const m = U.errores[campo]; return m ? h`<p class="f-err" id="err-${campo}">${icon('alert')}${m}</p>` : ''; }
  function inv(campo) { return U.errores[campo] ? raw(' aria-invalid="true" aria-describedby="err-' + campo + '"') : ''; }
  function resumenErrores() {
    const n = Object.keys(U.errores).filter((k) => k !== '_').length;
    if (!n) return '';
    return h`<div class="note note-bad" role="alert" id="resumen-errores" tabindex="-1">${icon('alert')}<div><b>Faltan datos (${n}).</b> Revisa los campos marcados en rojo.</div></div>`;
  }
  function cabecera(titulo, sub, extra) {
    return h`<div class="page-head"><div><h1 class="h1">${titulo}</h1>${sub ? h`<p>${sub}</p>` : ''}</div>${extra || ''}</div>`;
  }
  O.Form = { err, inv, resumenErrores, cabecera };

  // ======================= ACCESO =======================
  function auth(contenido, ancho) {
    return h`<div class="auth">
      <section class="auth-side" aria-hidden="true">
        <div class="logo-big">Ofira<i>.</i></div>
        <p class="slogan">Encuentra, cotiza y contrata con confianza</p>
        <p class="lead">Fontaneros y electricistas verificados de Asunción Mita, Jutiapa. Tú eliges a quién invitar, comparas cotizaciones con el detalle separado y apruebas antes de que empiece el trabajo.</p>
        <ul class="pillars">
          <li>${icon('search')}<div><b>Encuentra</b><span>Por oficio, sector y horario.</span></div></li>
          <li>${icon('file')}<div><b>Cotiza</b><span>Mano de obra, materiales y cargos por separado.</span></div></li>
          <li>${icon('check')}<div><b>Contrata</b><span>Sigue el avance y califica al terminar.</span></div></li>
        </ul>
      </section>
      <section class="auth-main"><div class="auth-box ${ancho ? 'wide' : ''}">
        <div class="auth-mobile-logo"><span class="logo">Ofira<i>.</i></span></div>
        ${contenido}
      </div></section>
    </div>`;
  }
  function volver() { return h`<button type="button" class="btn btn-link btn-s" data-act="atras" id="btn-atras" style="align-self:flex-start">${icon('back')}Volver</button>`; }

  ruta({
    patron: 'bienvenida', rol: 'publico', titulo: () => '',
    render: () => auth(h`<div class="stack welcome">
      <p class="eyebrow">Bienvenido</p>
      <h1 class="h1">Resuelve fugas y fallas eléctricas sin adivinar el precio</h1>
      <p class="muted">Encuentra, cotiza y contrata con confianza. Cada cotización separa mano de obra, materiales y cargos, y nada empieza sin tu aprobación.</p>
      <div class="stack-s">
        <button class="btn btn-pri btn-lg" data-go="acceso" id="btn-ir-acceso">Iniciar sesión</button>
        <button class="btn btn-sec btn-lg" data-go="registro" id="btn-ir-registro">Crear cuenta</button>
      </div>
      <button class="btn btn-link" data-go="acerca">Cómo funciona Ofira y cómo cuidamos tus datos</button>
    </div>`)
  });

  ruta({
    patron: 'acceso', rol: 'publico', back: 'bienvenida', titulo: () => 'Iniciar sesión',
    render: () => auth(h`<form class="stack form" data-form="acceso" novalidate>
      ${volver()}
      <div><h1 class="h1">Hola de nuevo</h1><p class="muted">Entra con tu correo y contraseña.</p></div>
      ${U.errores._ ? aviso('bad', 'alert', U.errores._) : ''}
      <div class="field"><label for="acc-correo">Correo electrónico</label>
        <input id="acc-correo" name="correo" type="email" autocomplete="username" value="${U.borrador.accCorreo || ''}" ${inv('correo')} required>${err('correo')}</div>
      <div class="field"><label for="acc-clave">Contraseña</label>
        <input id="acc-clave" name="clave" type="password" autocomplete="current-password" ${inv('clave')} required>${err('clave')}</div>
      <button class="btn btn-pri btn-lg" type="submit" id="btn-entrar">Entrar</button>
      <button class="btn btn-link" type="button" data-go="recuperar">Olvidé mi contraseña</button>
      <p class="small muted center">¿Primera vez en Ofira? <button type="button" class="btn btn-link btn-s" data-go="registro">Crea tu cuenta</button></p>
    </form>`)
  });

  ruta({
    patron: 'registro', rol: 'publico', back: 'bienvenida', titulo: () => 'Crear cuenta',
    render: () => {
      const b = U.borrador.reg || {};
      return auth(h`<form class="stack form" data-form="registro" novalidate>
        ${volver()}
        <div><h1 class="h1">Crea tu cuenta</h1><p class="muted">Una persona tiene una sola cuenta. Con ella puedes contratar y, si quieres, también ofrecer tus servicios.</p></div>
        ${resumenErrores()}${U.errores._ ? aviso('bad', 'alert', U.errores._) : ''}
        <div class="form-grid">
          <div class="field full"><label for="reg-nombre">Nombre completo</label><input id="reg-nombre" name="nombre" autocomplete="name" value="${b.nombre || ''}" ${inv('nombre')}>${err('nombre')}</div>
          <div class="field"><label for="reg-tel">Teléfono</label><input id="reg-tel" name="telefono" inputmode="tel" placeholder="5555-1234" value="${b.telefono || ''}" ${inv('telefono')}>${err('telefono')}</div>
          <div class="field"><label for="reg-sector">Tu sector</label><select id="reg-sector" name="sectorId" ${inv('sectorId')}>
            <option value="">Elige tu sector</option>${sectoresOpts(b.sectorId)}</select>${err('sectorId')}</div>
          <div class="field"><label for="reg-correo">Correo electrónico</label><input id="reg-correo" name="correo" type="email" autocomplete="email" value="${b.correo || ''}" ${inv('correo')}>${err('correo')}</div>
          <div class="field"><label for="reg-clave">Contraseña</label><input id="reg-clave" name="clave" type="password" autocomplete="new-password" ${inv('clave')}><p class="hint">Mínimo 8 caracteres, con letras y números.</p>${err('clave')}</div>
        </div>
        <label class="check"><input type="checkbox" name="prestador" id="reg-prestador" data-change="reg-prestador" ${b.prestador ? 'checked' : ''}><span>También quiero ofrecer mis servicios como prestador</span></label>
        ${b.prestador ? h`<fieldset class="card stack">
          <legend>Datos de prestador</legend>
          <div class="form-grid">
            <div class="field"><label for="reg-oficio">Oficio</label><select id="reg-oficio" name="oficioId" ${inv('oficioId')}><option value="">Elige tu oficio</option>
              ${St.S.oficios.filter((o) => o.activo).map((o) => h`<option value="${o.id}" ${b.oficioId === o.id ? 'selected' : ''}>${o.nombre}</option>`)}</select>${err('oficioId')}</div>
            <div class="field"><label for="reg-exp">Años de experiencia</label><input id="reg-exp" name="experiencia" type="number" min="0" max="60" value="${b.experiencia || ''}" ${inv('experiencia')}>${err('experiencia')}</div>
            <div class="field full"><label for="reg-dpi">Foto del DPI</label><input id="reg-dpi" name="dpiFoto" type="file" accept="image/jpeg,image/png,image/webp" data-change="reg-dpi" ${inv('dpiFoto')}>
              ${b.dpiFoto ? h`<p class="ok-t small">${icon('check')}Foto del DPI lista</p>` : ''}<p class="hint">${icon('lock')}Solo la ve el administrador para revisar tu identidad.</p>${err('dpiFoto')}</div>
            <div class="field full"><label for="reg-ref">Referencia de trabajo</label><input id="reg-ref" name="referencia" placeholder="Nombre y teléfono de alguien que conozca tu trabajo" value="${b.referencia || ''}" ${inv('referencia')}>${err('referencia')}</div>
          </div>
          <p class="hint">Aparecerás en las búsquedas cuando tu perfil esté Verificado. La etiqueta indica que se revisaron identidad y referencia; no garantiza la calidad del trabajo.</p>
        </fieldset>` : ''}
        <button class="btn btn-pri btn-lg" type="submit" id="btn-registrar">Crear cuenta</button>
      </form>`, true);
    }
  });

  ruta({
    patron: 'recuperar', rol: 'publico', back: 'acceso', titulo: () => 'Recuperar cuenta',
    render: () => {
      const r = U.recuperar || { paso: 1 };
      if (r.paso === 1) {
        return auth(h`<form class="stack form" data-form="recuperar-1" novalidate>
          ${volver()}
          <div><h1 class="h1">Recupera tu cuenta</h1><p class="muted">Escribe el correo o teléfono de tu cuenta. Administración confirmará tu identidad por teléfono y te dará una contraseña temporal.</p></div>
          ${U.errores._ ? aviso('bad', 'alert', U.errores._) : ''}
          <div class="field"><label for="rec-dato">Correo o teléfono</label><input id="rec-dato" name="dato" ${inv('dato')}>${err('dato')}</div>
          <button class="btn btn-pri btn-lg" type="submit" id="btn-recuperar">Solicitar recuperación</button>
        </form>`);
      }
      return auth(vacio('check', 'Solicitud recibida', 'Si el correo o teléfono está registrado, administración te llamará al teléfono de tu cuenta para confirmar tu identidad y darte una contraseña temporal.', h`<button class="btn btn-pri" data-go="acceso">Volver a iniciar sesión</button>`));
    }
  });

  ruta({
    patron: 'clave-temporal', rol: '*', titulo: () => 'Nueva contraseña',
    render: () => auth(h`<form class="stack form" data-form="clave" novalidate>
      <div><h1 class="h1">Crea tu nueva contraseña</h1><p class="muted">Entraste con una contraseña temporal. Por seguridad, cámbiala antes de continuar.</p></div>
      ${U.errores._ ? aviso('bad', 'alert', U.errores._) : ''}
      <div class="field"><label for="cl-nueva">Nueva contraseña</label><input id="cl-nueva" name="nueva" type="password" autocomplete="new-password" ${inv('nueva')}><p class="hint">Mínimo 8 caracteres, con letras y números.</p>${err('nueva')}</div>
      <div class="field"><label for="cl-repetir">Repite la contraseña</label><input id="cl-repetir" name="repetir" type="password" autocomplete="new-password" ${inv('repetir')}>${err('repetir')}</div>
      <button class="btn btn-pri btn-lg" type="submit" id="btn-guardar-clave">Guardar contraseña</button>
      <button class="btn btn-link" type="button" data-act="salir">Cerrar sesión</button>
    </form>`)
  });

  /* Cambiar contraseña desde el perfil (cualquier rol) */
  function formClave() {
    return h`<form class="card stack-s form" data-form="clave" novalidate>
      <h2 class="h2">Cambiar contraseña</h2>
      <div class="form-grid">
        <div class="field full"><label for="cl-actual">Contraseña actual</label><input id="cl-actual" name="actual" type="password" autocomplete="current-password" ${inv('actual')}>${err('actual')}</div>
        <div class="field"><label for="cl-nueva">Nueva contraseña</label><input id="cl-nueva" name="nueva" type="password" autocomplete="new-password" ${inv('nueva')}>${err('nueva')}</div>
        <div class="field"><label for="cl-repetir">Repítela</label><input id="cl-repetir" name="repetir" type="password" autocomplete="new-password" ${inv('repetir')}>${err('repetir')}</div>
      </div>
      <p class="hint">Mínimo 8 caracteres, con letras y números. Se cerrarán tus sesiones en otros dispositivos.</p>
      <button class="btn btn-sec" type="submit" id="btn-cambiar-clave" style="align-self:flex-start">Cambiar contraseña</button>
    </form>`;
  }
  O.formClave = formClave;

  ruta({
    patron: 'mi-clave', rol: ['cliente', 'prestador', 'administrador', 'soporte'], nav: 'clave', back: true, titulo: () => 'Cambiar contraseña',
    render: () => h`<div class="stack narrow">${cabecera('Cambiar contraseña', 'Por seguridad, usa una contraseña que no uses en otros sitios.')}${formClave()}</div>`
  });

  ruta({
    patron: 'acerca', rol: '*', back: true, titulo: () => 'Ayuda y privacidad',
    render: () => h`<div class="stack narrow" style="${app().rol() ? '' : 'padding:32px 20px'}">
      ${app().rol() ? '' : volver()}
      ${cabecera('Ayuda y privacidad', 'Ofira conecta a clientes con fontaneros y electricistas verificados de Asunción Mita, Jutiapa.')}
      <section class="card"><h2 class="h2">Cómo funciona</h2>
      <ol class="bul">
        <li><b>Encuentra:</b> elige el oficio, tu sector y el horario. Invita hasta 3 prestadores.</li>
        <li><b>Cotiza:</b> cada prestador te envía el precio con mano de obra, materiales y cargos por separado. Comparas y apruebas una.</li>
        <li><b>Contrata:</b> sigues el avance, te avisan cuando van en camino y al terminar se califican mutuamente.</li>
      </ol></section>
      <section class="card"><h2 class="h2">Reglas importantes</h2>
      <ul class="bul">
        <li>Inmediata: el prestador tiene 30 minutos para responder y tú 15 para aprobar. Otras modalidades: 24 y 72 horas.</li>
        <li>Al aprobar una cotización, las demás se anulan. Nada adicional se cobra sin tu aprobación.</li>
        <li>En electricidad pagas primero la visita de diagnóstico; si no apruebas el trabajo, solo pagas la visita.</li>
        <li>El pago es directo al prestador, en efectivo o transferencia. Ofira no te cobra comisión.</li>
        <li>Solo se califican servicios finalizados, una vez y dentro de 7 días.</li>
      </ul></section>
      <section class="card"><h2 class="h2">Tu privacidad y seguridad</h2>
      <ul class="bul">
        <li>Tu dirección exacta solo la ve el prestador que contratas, cuando el servicio está confirmado.</li>
        <li>Tu teléfono solo lo ve la otra parte de un servicio confirmado.</li>
        <li>La foto del DPI de los prestadores solo la ve administración para verificar su identidad. “Verificado” indica que se revisaron identidad y referencia; no es garantía de calidad.</li>
        <li>Tu contraseña se guarda cifrada: nadie, ni administración, puede verla.</li>
        <li>El mapa es una imagen de referencia del sector, no tu ubicación en tiempo real.</li>
      </ul></section>
      <p class="small muted">¿Un problema con un servicio? Ábrelo desde el servicio con “Tengo un problema”. Soporte lo atiende.</p>
    </div>`
  });

  // ---------- Ubicación actual (GPS del teléfono) ----------
  const CENTRO_ZONA = { lat: 14.3333, lng: -89.7167 }; // Asunción Mita
  function distanciaKm(a, b) {
    const r = Math.PI / 180; const dLat = (b.lat - a.lat) * r; const dLng = (b.lng - a.lng) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(x));
  }
  function enlaceMapa(u, ruta) {
    const p = encodeURIComponent(u.lat + ',' + u.lng);
    return ruta ? 'https://www.google.com/maps/dir/?api=1&destination=' + p : 'https://www.google.com/maps/search/?api=1&query=' + p;
  }
  O.enlaceMapa = enlaceMapa;
  function bloqueUbicacion(d) {
    const u = d.ubicacion;
    const lejos = u && distanciaKm(CENTRO_ZONA, u) > 30;
    return h`<div class="ubic" id="bloque-ubicacion">
      ${u ? h`<div class="row wrap between"><span class="ok-t">${icon('pin')}Ubicación agregada${u.precision ? ' · precisión aprox. ' + u.precision + ' m' : ''}</span>
          <span class="row gap-s"><a class="btn btn-sec btn-s" href="${enlaceMapa(u)}" target="_blank" rel="noopener">Ver en el mapa</a>
          <button type="button" class="btn btn-link btn-s" data-act="quitar-ubicacion" id="btn-quitar-ubicacion">Quitar</button></span></div>
          ${lejos ? aviso('act', 'alert', 'Esta ubicación queda fuera de Asunción Mita. Revisa que estés en el lugar del trabajo o escribe la dirección.') : ''}`
        : h`<button type="button" class="btn btn-sec" data-act="usar-ubicacion" id="btn-ubicacion" ${U.ubicCargando ? 'disabled' : ''}>${icon('pin')}${U.ubicCargando ? 'Buscando tu ubicación…' : 'Usar mi ubicación actual'}</button>
          <p class="hint">Opcional. Ayuda al prestador a llegar sin perderse.</p>`}
      ${U.ubicError ? aviso('bad', 'alert', U.ubicError) : ''}
    </div>`;
  }

  function sectoresOpts(sel) {
    const zonas = ['Casco urbano', 'Aldea'];
    return raw(zonas.map((z) => '<optgroup label="' + z + '">' + O.SECTORES.filter((s) => s.zona === z)
      .map((s) => '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + O.UI.esc(s.nombre) + '</option>').join('') + '</optgroup>').join(''));
  }
  O.sectoresOpts = sectoresOpts;

  // ======================= ENCUENTRA =======================
  function tarjetasOficio() {
    return h`<div class="oficios">
      ${St.S.oficios.filter((o) => o.activo).map((o) => {
        const mods = o.modalidades.map((m) => O.MODALIDADES[m].nombre).join(' · ');
        const n = St.S.prestadores.filter((p) => p.oficioId === o.id && p.estadoVerificacion === 'Verificado').length;
        const esp = St.S.especialidades.filter((e) => e.oficioId === o.id).map((e) => e.nombre).join(' ');
        if (!o.enPrototipo) return h`<div class="oficio off" aria-disabled="true" data-buscar="${o.nombre} ${esp}">${icon(o.icono)}<b>${o.nombre}</b><span>${mods}</span><em>Solo en el documento</em></div>`;
        return h`<button class="oficio" data-act="elegir-oficio" data-id="${o.id}" id="oficio-${o.id}" data-buscar="${o.nombre} ${esp}">${icon(o.icono)}<b>${o.nombre}</b><span>${mods}</span><span>${n} prestador${n === 1 ? '' : 'es'} verificado${n === 1 ? '' : 's'}</span></button>`;
      })}
    </div>`;
  }

  ruta({
    patron: 'c/encuentra', rol: 'cliente', nav: 'encuentra', titulo: () => 'Inicio',
    render: () => {
      const yo = app().yo();
      const per = St.persona(yo.personaId);
      const mias = St.S.solicitudes.filter((s) => s.clienteCuentaId === yo.id);
      const activas = mias.filter((s) => ['Solicitada', 'En evaluación', 'Pendiente de aprobación'].includes(s.estado));
      const porAprobar = St.S.cotizaciones.filter((c) => c.estado === 'Enviada' && St.solicitud(c.solicitudId).clienteCuentaId === yo.id);
      const srvs = St.S.servicios.filter((s) => s.clienteCuentaId === yo.id);
      const enCurso = srvs.filter((s) => s.estado === 'Confirmado' || s.estado === 'En ejecución');
      const fin = srvs.filter((s) => s.estado === 'Finalizado');
      const porCalificar = srvs.filter((s) => St.puedeCalificar(s.id, yo.id).ok);
      const recientes = mias.slice().sort((a, b) => b.creada - a.creada).slice(0, 5);
      return h`<div class="stack">
        <section class="hero">
          <div><p class="eyebrow">${St.sector(yo.sectorId) ? St.sector(yo.sectorId).nombre : 'Asunción Mita'}</p>
          <h1>¿Qué necesitas resolver hoy, ${per.nombre.split(' ')[0]}?</h1>
          <p>Encuentra, cotiza y contrata con confianza. Invita hasta 3 prestadores verificados y aprueba solo la cotización que te convenga.</p></div>
          <button class="btn btn-pri" data-go="c/servicios">${icon('search')}Buscar servicios</button>
        </section>
        ${porAprobar.length ? h`<button class="banner banner-act" data-go="c/cotizacion/${porAprobar[0].id}">${icon('file')}<span><b>Tienes ${porAprobar.length} cotización${porAprobar.length > 1 ? 'es' : ''} por revisar</b><small>${St.nombrePrestador(porAprobar[0].prestadorId)} · ${St.dinero(St.totales(porAprobar[0]).total)}</small></span>${icon('next')}</button>` : ''}
        ${porCalificar.length ? h`<button class="banner" data-go="calificar/${porCalificar[0].id}">${icon('star')}<span><b>Califica a ${St.nombrePrestador(porCalificar[0].prestadorId)}</b><small>${porCalificar[0].folio} · tienes hasta 7 días después de finalizado</small></span>${icon('next')}</button>` : ''}
        <div class="stats-row">
          <button class="stat" data-go="c/cotiza">${icon('file')}<div><b>${activas.length}</b><span>Solicitudes abiertas</span></div></button>
          <button class="stat gold" data-go="c/cotizaciones">${icon('money')}<div><b>${porAprobar.length}</b><span>Cotizaciones por revisar</span></div></button>
          <button class="stat" data-go="c/contrata">${icon('tool')}<div><b>${enCurso.length}</b><span>Servicios en curso</span></div></button>
          <button class="stat dark" data-go="c/historial">${icon('flag')}<div><b>${fin.length}</b><span>Servicios finalizados</span></div></button>
        </div>
        <section><div class="row between"><h2 class="h2">Elige un oficio</h2><button class="btn btn-link btn-s" data-go="c/servicios">Ver todos</button></div>${tarjetasOficio()}</section>
        <section><div class="row between"><h2 class="h2">Actividad reciente</h2><button class="btn btn-link btn-s" data-go="c/historial">Ver historial</button></div>
          ${recientes.length ? h`<div class="list">${recientes.map((s) => filaSolicitud(s))}</div>` : vacio('file', 'Todavía no tienes solicitudes', 'Elige un oficio para enviar la primera.')}</section>
      </div>`;
    }
  });

  ruta({
    patron: 'c/servicios', rol: 'cliente', nav: 'servicios', titulo: () => 'Buscar servicios',
    render: () => h`<div class="stack">
      ${cabecera('Buscar servicios', 'Elige el oficio y después filtra por sector, modalidad y horario.')}
      <div class="field" style="max-width:520px"><label for="buscar-oficio" class="sr">Buscar oficio o especialidad</label>
        <input id="buscar-oficio" data-input="filtro-oficio" placeholder="Busca un oficio o especialidad, por ejemplo “fuga” o “breaker”" autocomplete="off"></div>
      ${tarjetasOficio()}
      <p class="small muted" id="oficio-sin" hidden>Ningún oficio coincide con la búsqueda.</p>
      <div class="note note-info">${icon('info')}<div>Fontanería atiende emergencias (<b>inmediata</b>) y trabajos con cita (<b>programada</b>). Electricidad trabaja con <b>diagnóstico</b>: pagas la visita y luego decides si apruebas el trabajo.</div></div>
    </div>`
  });

  function nuevaBusqueda(oficioId) {
    const o = St.oficio(oficioId);
    const yo = app().yo();
    const modalidad = o.modalidades[0];
    U.busqueda = { oficioId, modalidad, sectorId: yo.sectorId || '', horario: modalidad === 'inmediata' ? { tipo: 'ahora' } : { tipo: 'programado', fecha: O.diaISO(St.ahora() + O.DIA), franja: 'manana' } };
    U.seleccion = [];
    U.borrador.sol = null; U.clave = null;
  }
  O.nuevaBusqueda = nuevaBusqueda;

  function proximosDias() {
    const out = [];
    for (let i = 0; i < 7; i++) out.push(O.diaISO(St.ahora() + i * O.DIA));
    return out;
  }

  ruta({
    patron: 'c/buscar', rol: 'cliente', nav: 'servicios', back: 'c/servicios', titulo: () => U.busqueda ? St.oficio(U.busqueda.oficioId).nombre : 'Buscar',
    render: () => {
      const b = U.busqueda;
      if (!b) { setTimeout(() => app().go('c/servicios'), 0); return ''; }
      const o = St.oficio(b.oficioId);
      const res = b.sectorId ? St.buscar(b) : [];
      const validos = res.filter((r) => r.disponible).map((r) => r.p.id);
      U.seleccion = U.seleccion.filter((id) => validos.includes(id));
      const mods = o.modalidades.filter((m) => m !== 'presupuesto');
      return h`<div class="stack">
        ${cabecera(o.nombre + (b.sectorId ? ' en ' + St.sector(b.sectorId).nombre : ''), b.sectorId ? res.length + ' prestador' + (res.length === 1 ? '' : 'es') + ' con cobertura · puedes invitar hasta ' + O.REGLAS.maxInvitaciones : 'Elige tu sector para ver resultados')}
        <div class="search-layout">
          <aside class="filters card"><fieldset class="criteria">
            <legend class="h2">Filtros</legend>
            ${mods.length > 1 ? h`<div class="field"><span class="lbl">Modalidad</span><div class="chips" role="radiogroup" aria-label="Modalidad">
              ${mods.map((m) => h`<button type="button" role="radio" aria-checked="${b.modalidad === m}" class="chip ${b.modalidad === m ? 'on' : ''}" data-act="buscar-modalidad" data-v="${m}" id="mod-${m}">${O.MODALIDADES[m].nombre}</button>`)}
            </div><p class="hint">${O.MODALIDADES[b.modalidad].desc}</p></div>` : h`<div class="note note-info">${icon('info')}<div><b>${O.MODALIDADES[b.modalidad].nombre}.</b> ${O.MODALIDADES[b.modalidad].desc}</div></div>`}
            <div class="field"><label for="bus-sector">Sector</label><select id="bus-sector" data-change="buscar-sector"><option value="">Elige tu sector</option>${sectoresOpts(b.sectorId)}</select></div>
            ${b.horario.tipo === 'ahora' ? h`<p class="small">${icon('clock')}Se muestran primero quienes están disponibles en este momento.</p>` : h`
              <div class="field"><span class="lbl">Día</span><div class="chips">${proximosDias().map((d) => h`<button type="button" class="chip ${b.horario.fecha === d ? 'on' : ''}" aria-pressed="${b.horario.fecha === d}" data-act="buscar-fecha" data-v="${d}">${fechaCorta(d)}</button>`)}</div></div>
              <div class="field"><span class="lbl">Franja</span><div class="chips">${O.FRANJAS.map((f) => h`<button type="button" class="chip ${b.horario.franja === f.id ? 'on' : ''}" aria-pressed="${b.horario.franja === f.id}" data-act="buscar-franja" data-v="${f.id}">${f.nombre}<small>${f.horas}</small></button>`)}</div></div>`}
          </fieldset></aside>
          <div class="stack">
            ${!b.sectorId ? vacio('pin', 'Elige tu sector', 'Así te mostramos solo a quienes trabajan en tu zona.') : !res.length ? sinResultados(b) : h`
              ${!validos.length ? aviso('act', 'clock', 'Nadie está disponible en ese horario. Prueba otro día o franja.') : ''}
              <div class="results">${res.map((r) => tarjetaPrestador(r))}</div>`}
          </div>
        </div>
        ${res.length ? h`<div class="select-bar"><div class="select-bar-in">
          <span>${U.seleccion.length ? h`<b>${U.seleccion.length} de ${O.REGLAS.maxInvitaciones}</b> · ${U.seleccion.map((id) => St.nombrePrestador(id).split(' ')[0]).join(', ')}` : 'Marca “Invitar” en hasta 3 prestadores para pedirles cotización.'}</span>
          <button class="btn btn-pri" data-act="ir-solicitar" id="btn-continuar" ${U.seleccion.length ? '' : 'disabled'}>${U.seleccion.length ? 'Continuar con ' + U.seleccion.length + ' de ' + O.REGLAS.maxInvitaciones : 'Elige al menos un prestador'}</button>
        </div></div>` : ''}
      </div>`;
    }
  });

  function sinResultados(b) {
    const otros = O.SECTORES.filter((s) => s.id !== b.sectorId && St.buscar(Object.assign({}, b, { sectorId: s.id })).length);
    return vacio('search', 'Sin resultados en ' + St.sector(b.sectorId).nombre,
      'Ningún ' + St.oficio(b.oficioId).nombre.toLowerCase() + ' verificado tiene ese sector en su cobertura todavía.',
      otros.length ? h`<p class="small">Hay prestadores en:</p>${otros.slice(0, 3).map((s) => h`<button class="chip" data-act="buscar-sector-sug" data-v="${s.id}">${s.nombre}</button>`)}` : '');
  }

  function tarjetaPrestador(r) {
    const { p } = r;
    const nom = St.nombre(p.cuentaId);
    const sel = U.seleccion.includes(p.id);
    const lleno = U.seleccion.length >= O.REGLAS.maxInvitaciones && !sel;
    return h`<article class="pcard ${r.disponible ? '' : 'dim'} ${sel ? 'sel' : ''}">
      <div class="pcard-main">
        ${avatar(nom, 'l')}
        <div class="grow">
          <h3 class="h3">${nom}</h3>
          <div class="row wrap gap-s">${calif(p.id)}<span class="small muted">· ${p.experiencia} años</span></div>
          <div class="row wrap gap-s"><span class="verif">${icon('shield')}Verificado</span>${St.precioDesde(p.id) ? h`<span class="price-tag">Desde ${St.dinero(St.precioDesde(p.id))}</span>` : ''}</div>
        </div>
      </div>
      <div class="tags">${p.especialidades.slice(0, 2).map((e) => h`<span class="tag">${St.especialidad(e).nombre}</span>`)}</div>
      <p class="small">${r.disponible ? h`<span class="ok-t">${icon('check')}${U.busqueda.modalidad === 'inmediata' ? 'Disponible ahora' : 'Disponible en ese horario'}</span>` : h`<span class="muted">${icon('x')}${r.motivo}</span>`}
        ${p.costoVisita ? h` · Visita ${St.dinero(p.costoVisita)}` : ''}</p>
      <div class="pcard-actions">
        <button class="btn btn-sec btn-s" data-go="c/prestador/${p.id}">Ver perfil</button>
        <label class="check pill ${!r.disponible || lleno ? 'disabled' : ''}"><input type="checkbox" data-change="sel-prestador" value="${p.id}" id="sel-${p.id}" ${sel ? 'checked' : ''} ${!r.disponible || lleno ? 'disabled' : ''}><span>Invitar</span></label>
      </div>
    </article>`;
  }

  ruta({
    patron: 'c/prestador/:id', rol: 'cliente', nav: 'servicios', back: true, titulo: () => 'Perfil del prestador',
    render: (pr) => {
      const p = St.prestador(pr.id);
      const nom = St.nombre(p.cuentaId);
      const r = St.calificacionPromedio(p.id);
      const o = St.oficio(p.oficioId);
      const enBusqueda = U.busqueda && U.busqueda.oficioId === p.oficioId && U.busqueda.sectorId;
      const estadoBus = enBusqueda ? St.buscar(U.busqueda).find((x) => x.p.id === p.id) : null;
      const sel = U.seleccion.includes(p.id);
      return h`<div class="cols">
        <div class="stack">
          <div class="card profile-head">${avatar(nom, 'xl')}<div><h1 class="h1">${nom}</h1><p class="muted">${o.nombre} · ${p.experiencia} años de experiencia</p>${calif(p.id)}</div></div>
          <div class="card verif-card">${icon('shield')}<div><b>Verificado — identidad y referencia revisadas</b><p class="small">Administración revisó la foto del DPI y una referencia de trabajo. No es una garantía de calidad ni de conducta.</p></div></div>
          <section class="card stack-s"><h2 class="h2">Sobre su trabajo</h2><p>${p.descripcion}</p>
            <h3 class="h3" style="margin-top:8px">Condiciones</h3><p>${p.condiciones}</p></section>
          <div class="grid-2">
            <section class="card"><h2 class="h2">Especialidades y precios</h2><div class="list">${p.especialidades.map((e) => h`<div class="item"><span class="grow">${St.especialidad(e).nombre}</span>${(p.precios || {})[e] ? h`<span class="price-tag">Desde ${St.dinero(p.precios[e])}</span>` : h`<span class="small muted">Precio al cotizar</span>`}</div>`)}</div>
              <p class="hint" style="margin-top:8px">Son precios de referencia. El precio final llega en la cotización.</p></section>
            <section class="card"><h2 class="h2">Cobertura</h2><div class="tags">${p.cobertura.map((s) => h`<span class="tag">${icon('pin')}${St.sector(s).nombre}</span>`)}</div></section>
          </div>
          <section class="card"><h2 class="h2">Trabajos anteriores</h2>
            ${(p.galeria || []).length ? h`<div class="galeria">${p.galeria.map((g) => h`<figure><a href="/archivo/${g.archivo}" target="_blank" rel="noopener"><img src="/archivo/${g.archivo}" alt="${g.descripcion || 'Trabajo anterior'}" loading="lazy"></a>${g.descripcion ? h`<figcaption>${g.descripcion}</figcaption>` : ''}</figure>`)}</div>` : h`<p class="muted small">Todavía no ha subido fotos de sus trabajos.</p>`}</section>
          <section class="card"><h2 class="h2">Disponibilidad</h2><p>${p.disponibilidad.dias.map((d) => O.DIAS[d]).join(', ')}</p><p class="small muted">${p.disponibilidad.franjas.map((f) => St.franja(f).nombre + ' (' + St.franja(f).horas + ')').join(' · ')}</p></section>
          <section><h2 class="h2">Calificaciones</h2>
            ${St.resenasDe(p.id).length ? h`<div class="list">${St.resenasDe(p.id).map((c) => h`<div class="review"><div class="row between">${O.UI.estrellas(c.estrellas)}<span class="small muted">${hace(c.fecha)}</span></div><p>${c.comentario || 'Sin comentario.'}</p><p class="small muted">${St.nombre(c.deCuentaId).split(' ')[0]}</p></div>`)}</div>` : h`<p class="muted">Todavía no tiene calificaciones publicadas.</p>`}
          </section>
        </div>
        <aside class="side-sticky">
          <div class="card cta-card">
            <div class="stats"><div><b>${St.serviciosFinalizados(p.id)}</b><span>finalizados</span></div><div><b>${r.n ? r.prom.toFixed(1) : '–'}</b><span>estrellas</span></div><div><b>${p.costoVisita ? St.dinero(p.costoVisita) : 'Q 0'}</b><span>visita</span></div></div>
            ${estadoBus ? (estadoBus.disponible
              ? h`<button class="btn ${sel ? 'btn-sec' : 'btn-pri'} btn-lg" data-act="toggle-sel" data-id="${p.id}" id="btn-invitar-perfil" ${!sel && U.seleccion.length >= O.REGLAS.maxInvitaciones ? 'disabled' : ''}>${sel ? 'Quitar de la invitación' : 'Invitar a cotizar'}</button>`
              : aviso('act', 'clock', estadoBus.motivo)) : ''}
            <p class="hint">${icon('lock')}Tu dirección exacta solo la verá si apruebas su cotización.</p>
          </div>
        </aside>
      </div>`;
    }
  });

  // ---------- Solicitud ----------
  ruta({
    patron: 'c/solicitar', rol: 'cliente', nav: 'servicios', back: 'c/buscar', titulo: () => 'Nueva solicitud',
    render: () => {
      const b = U.busqueda;
      if (!b || !U.seleccion.length) { setTimeout(() => app().go('c/encuentra'), 0); return ''; }
      const o = St.oficio(b.oficioId);
      const guardada = app().yo().guardada;
      const d = U.borrador.sol || (U.borrador.sol = { especialidadId: '', descripcion: '', direccion: guardada ? guardada.direccion : '', referencia: guardada ? guardada.referencia : '', medidas: '', fotos: [],
        ubicacion: guardada && guardada.lat != null ? { lat: guardada.lat, lng: guardada.lng, precision: null } : null, guardarDireccion: !guardada, desdeGuardada: !!guardada });
      if (!U.clave) U.clave = 'k-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      const plazo = St.plazos(b.modalidad).invitacion;
      return h`<form class="cols form" data-form="solicitud" novalidate>
        <div class="stack">
          ${cabecera('Describe lo que necesitas', 'Con estos datos los prestadores preparan su cotización.')}
          ${resumenErrores()}
          <section class="card stack">
            <div class="field"><label for="sol-esp">¿Qué tipo de trabajo es?</label><select id="sol-esp" name="especialidadId" data-input="sol" ${inv('especialidadId')}>
              <option value="">Elige una opción</option>${St.S.especialidades.filter((e) => e.oficioId === o.id).map((e) => h`<option value="${e.id}" ${d.especialidadId === e.id ? 'selected' : ''}>${e.nombre}</option>`)}</select>${err('especialidadId')}</div>
            <div class="field"><label for="sol-desc">Describe el problema</label><textarea id="sol-desc" name="descripcion" rows="4" data-input="sol" placeholder="${b.oficioId === 'of-ele' ? 'Ej.: se baja el breaker cuando conecto la refrigeradora' : 'Ej.: sale agua debajo del lavatrastos desde esta mañana'}" ${inv('descripcion')}>${d.descripcion}</textarea><p class="hint">Mínimo 15 caracteres. Entre más detalle, mejor la cotización.</p>${err('descripcion')}</div>
            <div class="form-grid">
              <div class="field"><label for="sol-dir">Dirección</label><input id="sol-dir" name="direccion" data-input="sol" autocomplete="street-address" placeholder="Calle, número de casa o señas" value="${d.direccion}" ${inv('direccion')}>${err('direccion')}</div>
              <div class="field"><label for="sol-ref">Referencia (opcional)</label><input id="sol-ref" name="referencia" data-input="sol" placeholder="Ej.: frente a la iglesia, portón negro" value="${d.referencia}"></div>
            </div>
            ${d.desdeGuardada ? h`<p class="hint">${icon('check')}Usamos la dirección guardada en tu cuenta. Puedes cambiarla aquí.</p>` : ''}
            ${bloqueUbicacion(d)}
            <label class="check"><input type="checkbox" id="sol-guardar" data-change="sol-guardar" ${d.guardarDireccion ? 'checked' : ''}><span>Guardar esta dirección${d.ubicacion ? ' y ubicación' : ''} para la próxima vez</span></label>
            <p class="hint">${icon('lock')}La dirección y la ubicación solo las verá el prestador que contrates, cuando el servicio esté Confirmado.</p>
            <div class="field"><label for="sol-medidas">Medidas o detalles (opcional)</label><input id="sol-medidas" name="medidas" data-input="sol" maxlength="200" placeholder="Ej.: tubo de 1/2 pulgada, ventana de 1.20 x 0.80 m" value="${d.medidas || ''}"></div>
            <div class="field"><label for="sol-fotos">Fotos (opcional, hasta 3)</label>
              ${d.fotos.length < 3 ? h`<input id="sol-fotos" name="fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple data-change="sol-fotos" ${app().subiendo ? 'disabled' : ''}>` : ''}
              ${app().subiendo ? h`<span class="subiendo">${icon('clock')}Subiendo fotos…</span>` : ''}
              ${fotos(d.fotos, 'quitar-foto-sol')}
              <p class="hint">Una foto ayuda al prestador a entender el problema antes de llegar.</p></div>
          </section>
        </div>
        <aside class="side-sticky">
          <div class="card summary">
            <div class="row between"><b>${o.nombre} · ${O.MODALIDADES[b.modalidad].nombre}</b><button type="button" class="btn btn-link btn-s" data-go="c/buscar">Cambiar</button></div>
            <p class="small">${icon('clock')}${horarioTexto(b.horario)}</p>
            <p class="small">${icon('pin')}${St.sector(b.sectorId).nombre}</p>
            <div class="list" style="margin-top:6px">${U.seleccion.map((id) => h`<div class="item">${avatar(St.nombrePrestador(id), 's')}<span class="grow"><b>${St.nombrePrestador(id)}</b><small class="muted">${calif(id)}</small></span></div>`)}</div>
            <p class="hint">Tendrán ${plazo >= 60 ? plazo / 60 + ' horas' : plazo + ' minutos'} para responder.</p>
          </div>
          ${mapa(St.sector(b.sectorId).nombre)}
          <button class="btn btn-pri btn-lg" type="submit" id="btn-enviar-solicitud" ${app().subiendo ? 'disabled' : ''}>Enviar solicitud</button>
        </aside>
      </form>`;
    }
  });

  ruta({
    patron: 'c/enviada/:id', rol: 'cliente', nav: 'cotiza', titulo: () => 'Solicitud enviada',
    render: (pr) => {
      const s = St.solicitud(pr.id);
      const invs = St.invitacionesDe(s.id);
      return h`<div class="stack narrow"><div class="card stack">
        <div class="done">${icon('check', 'big')}<h1 class="h1">Solicitud enviada</h1><p class="num muted">${s.folio}</p></div>
        <p>Invitamos a ${invs.length} prestador${invs.length > 1 ? 'es' : ''}. Te avisaremos cuando acepten y envíen su cotización.</p>
        <div class="list">${invs.map((i) => h`<div class="item"><span class="row gap-s grow">${avatar(St.nombrePrestador(i.prestadorId), 's')}<b>${St.nombrePrestador(i.prestadorId)}</b></span>${i.estado === 'Pendiente' ? cuenta(i.venceEn, 'Responde en') : estado(i.estado)}</div>`)}</div>
        ${aviso('info', 'bell', h`Si nadie responde a tiempo, la solicitud pasa a <b>Vencida</b> y podrás reenviarla con un toque.`)}
        <div class="row wrap"><button class="btn btn-pri grow" data-go="c/solicitud/${s.id}" id="btn-ver-solicitud">Ver mi solicitud</button>
        <button class="btn btn-sec" data-go="c/encuentra">Volver al inicio</button></div>
      </div></div>`;
    }
  });

  // ======================= COTIZA =======================
  function filaSolicitud(s) {
    const o = St.oficio(s.oficioId);
    const cots = St.cotizacionesDe(s.id).filter((c) => c.estado === 'Enviada');
    return h`<button class="item link" data-go="c/solicitud/${s.id}">
      <span class="ico-box">${icon(o.icono)}</span>
      <span class="grow"><b>${o.nombre} · ${St.especialidad(s.especialidadId) ? St.especialidad(s.especialidadId).nombre : ''}</b>
      <small class="muted">${s.folio} · ${hace(s.creada)}${cots.length ? ' · ' + cots.length + ' cotización' + (cots.length > 1 ? 'es' : '') + ' por revisar' : ''}</small></span>
      ${estado(s.estado)}
    </button>`;
  }

  ruta({
    patron: 'c/cotiza', rol: 'cliente', nav: 'cotiza', titulo: () => 'Mis solicitudes',
    render: () => {
      const yo = app().yo();
      const todas = St.S.solicitudes.filter((s) => s.clienteCuentaId === yo.id).sort((a, b) => b.creada - a.creada);
      const abiertas = todas.filter((s) => ['Solicitada', 'En evaluación', 'Pendiente de aprobación', 'Vencida'].includes(s.estado));
      const cerradas = todas.filter((s) => !abiertas.includes(s));
      const tab = U.tabCotiza || 'abiertas';
      const lista = tab === 'abiertas' ? abiertas : cerradas;
      return h`<div class="stack">
        ${cabecera('Mis solicitudes', 'Revisa quién aceptó cotizar y compara las cotizaciones.', h`<button class="btn btn-pri" data-go="c/servicios">${icon('plus')}Nueva solicitud</button>`)}
        <div class="tabs" role="tablist"><button role="tab" aria-selected="${tab === 'abiertas'}" class="tab ${tab === 'abiertas' ? 'on' : ''}" data-act="tab-cotiza" data-v="abiertas">Abiertas (${abiertas.length})</button>
        <button role="tab" aria-selected="${tab === 'cerradas'}" class="tab ${tab === 'cerradas' ? 'on' : ''}" data-act="tab-cotiza" data-v="cerradas">Cerradas (${cerradas.length})</button></div>
        ${lista.length ? h`<div class="list">${lista.map(filaSolicitud)}</div>` : vacio('file', tab === 'abiertas' ? 'No tienes solicitudes abiertas' : 'Nada por aquí todavía', 'Busca un oficio y envía tu primera solicitud.', h`<button class="btn btn-pri" data-go="c/servicios">Buscar servicios</button>`)}
      </div>`;
    }
  });

  ruta({
    patron: 'c/cotizaciones', rol: 'cliente', nav: 'cotizaciones', titulo: () => 'Cotizaciones',
    render: () => {
      const yo = app().yo();
      const cots = St.S.cotizaciones.filter((c) => c.estado !== 'Borrador' && St.solicitud(c.solicitudId).clienteCuentaId === yo.id).sort((a, b) => (b.enviada || 0) - (a.enviada || 0));
      const pend = cots.filter((c) => c.estado === 'Enviada');
      const otras = cots.filter((c) => c.estado !== 'Enviada').slice(0, 12);
      const fila = (c) => h`<button class="item link ${c.estado === 'Enviada' ? 'hl' : ''}" data-go="c/cotizacion/${c.id}">
        ${avatar(St.nombrePrestador(c.prestadorId), 's')}
        <span class="grow"><b>${St.nombrePrestador(c.prestadorId)}</b><small class="muted">${{ visita: 'Visita', trabajo: 'Trabajo', adicional: 'Adicional' }[c.tipo]} · ${c.folio} · ${St.solicitud(c.solicitudId).folio}</small>
        ${c.estado === 'Enviada' ? cuenta(c.venceEn, 'Aprueba antes de') : ''}</span>
        <span class="stack-r"><b class="num">${St.dinero(St.totales(c).total)}</b>${estado(c.estado)}</span></button>`;
      return h`<div class="stack">
        ${cabecera('Cotizaciones', 'Cada cotización separa mano de obra, materiales y cargos. Tienes un plazo para aprobarla.')}
        <section><h2 class="h2">Por revisar ${pend.length ? h`<span class="count">${pend.length}</span>` : ''}</h2>
          ${pend.length ? h`<div class="list">${pend.map(fila)}</div>` : vacio('money', 'No tienes cotizaciones por revisar', 'Cuando un prestador te envíe una, aparecerá aquí.')}</section>
        ${otras.length ? h`<section><h2 class="h2">Anteriores</h2><div class="list">${otras.map(fila)}</div></section>` : ''}
      </div>`;
    }
  });

  const EXPLICA_SOL = {
    'Solicitada': 'Esperando que los prestadores acepten cotizar.',
    'En evaluación': 'Al menos un prestador aceptó y está preparando su cotización.',
    'Pendiente de aprobación': 'Ya tienes cotización. Revisa y aprueba la que prefieras.',
    'Confirmada': 'Aprobaste una cotización y se creó el servicio.',
    'Vencida': 'Nadie respondió a tiempo. Puedes reenviarla con un toque.',
    'Cancelada': 'Cancelaste esta solicitud.'
  };

  ruta({
    patron: 'c/solicitud/:id', rol: 'cliente', nav: 'cotiza', back: 'c/cotiza', titulo: (pr) => St.solicitud(pr.id).folio,
    render: (pr) => {
      const s = St.solicitud(pr.id);
      const o = St.oficio(s.oficioId);
      const invs = St.invitacionesDe(s.id);
      const cots = St.cotizacionesDe(s.id).filter((c) => c.estado !== 'Borrador' && !c.servicioId);
      const srv = St.servicioDeSolicitud(s.id);
      const abierta = ['Solicitada', 'En evaluación', 'Pendiente de aprobación'].includes(s.estado);
      return h`<div class="cols">
        <div class="stack">
          <div class="row between"><div><p class="eyebrow">${o.nombre} · ${O.MODALIDADES[s.modalidad].nombre}</p><h1 class="h1">${St.especialidad(s.especialidadId).nombre}</h1></div>${estado(s.estado, 'lg')}</div>
          <p class="note note-info">${icon('info')}<span>${EXPLICA_SOL[s.estado]}</span></p>
          ${cots.length ? h`<section><h2 class="h2">Cotizaciones recibidas</h2><div class="list">${cots.map((c) => h`<button class="item link quote-item ${c.estado === 'Enviada' ? 'hl' : ''}" data-go="c/cotizacion/${c.id}" id="cot-${c.id}">
            ${avatar(St.nombrePrestador(c.prestadorId), 's')}
            <span class="grow"><b>${St.nombrePrestador(c.prestadorId)}</b><small class="muted">${c.tipo === 'visita' ? 'Cotización de visita' : 'Cotización de trabajo'} · ${c.folio}</small>
            ${c.estado === 'Enviada' ? cuenta(c.venceEn, 'Aprueba antes de') : ''}</span>
            <span class="stack-r"><b class="num">${St.dinero(St.totales(c).total)}</b>${estado(c.estado)}</span>
          </button>`)}</div></section>` : ''}
          <section><h2 class="h2">Prestadores invitados</h2><div class="list">${invs.map((i) => h`<div class="item">
            ${avatar(St.nombrePrestador(i.prestadorId), 's')}<span class="grow"><b>${St.nombrePrestador(i.prestadorId)}</b>
            ${i.motivo ? h`<small class="muted">${i.motivo}</small>` : ''}${i.estado === 'Pendiente' ? cuenta(i.venceEn, 'Responde en') : ''}</span>
            <span class="stack-r">${estado(i.estado)}${i.estado === 'Aceptada' || (srv && srv.prestadorId === i.prestadorId) ? h`<button class="btn btn-link btn-s" data-go="chat/${s.id}/${i.prestadorId}">${icon('chat')}Mensajes</button>` : ''}</span>
          </div>`)}</div></section>
          <section class="card"><h2 class="h2">Historial de estados</h2>${timeline(St.historialDe('Solicitud', s.id))}</section>
        </div>
        <aside class="side-sticky">
          ${s.estado === 'Vencida' ? h`<button class="btn btn-pri btn-lg" data-act="reenviar" data-id="${s.id}" id="btn-reenviar">${icon('refresh')}Reenviar solicitud</button>` : ''}
          ${srv ? h`<button class="btn btn-pri btn-lg" data-go="c/servicio/${srv.id}" id="btn-ver-servicio">Ver servicio ${srv.folio}</button>` : ''}
          <section class="card stack-s"><h2 class="h2">Detalle</h2>
            <p>${s.descripcion}</p>
            ${s.medidas ? h`<p class="small"><b>Medidas:</b> ${s.medidas}</p>` : ''}
            <p class="small">${icon('clock')}${horarioTexto(s.horario)}</p>
            <p class="small">${icon('pin')}${St.sector(s.sectorId).nombre} · ${s.direccion}</p>
            ${s.ubicacion ? h`<p class="small"><a class="btn-link" href="${enlaceMapa(s.ubicacion)}" target="_blank" rel="noopener">${icon('pin')}Ubicación compartida · ver en el mapa</a></p>` : ''}
            ${fotos(s.fotos)}
          </section>
          ${abierta ? h`<button class="btn btn-danger" data-act="cancelar-solicitud" data-id="${s.id}" id="btn-cancelar-solicitud">Cancelar solicitud</button>` : ''}
        </aside>
      </div>`;
    }
  });

  const EXPLICA_COT = {
    visita: (c, p) => 'Es el costo de la visita de diagnóstico. Si la apruebas, se crea el servicio y ' + St.nombre(p.cuentaId).split(' ')[0] + ' irá a revisar. Después te enviará la cotización del trabajo; si no la apruebas, solo pagas la visita.',
    trabajo: () => 'Es el precio del trabajo. Al aprobarla se confirma el servicio con este prestador y las demás cotizaciones se anulan.',
    adicional: () => 'Es un cambio de alcance durante el trabajo. Solo se hace si lo apruebas.'
  };

  ruta({
    patron: 'c/cotizacion/:id', rol: 'cliente', nav: 'cotizaciones', back: true, titulo: (pr) => St.cotizacion(pr.id).folio,
    render: (pr) => {
      const c = St.cotizacion(pr.id);
      const p = St.prestador(c.prestadorId);
      const s = St.solicitud(c.solicitudId);
      const nom = St.nombre(p.cuentaId);
      const tipoTxt = { visita: 'Cotización de visita', trabajo: 'Cotización de trabajo', adicional: 'Cotización adicional' }[c.tipo];
      return h`<div class="cols">
        <div class="stack">
          <div><p class="eyebrow">${tipoTxt} · ${s.folio}</p><h1 class="h1">${St.especialidad(s.especialidadId).nombre}</h1></div>
          <p class="note note-info">${icon('info')}<span>${EXPLICA_COT[c.tipo](c, p)}</span></p>
          ${cotTabla(c)}
          ${c.tiempoEstimado || c.nota ? h`<div class="card stack-s">${c.tiempoEstimado ? h`<p class="small">${icon('clock')}Tiempo estimado: ${c.tiempoEstimado}</p>` : ''}${c.nota ? h`<p class="small">${icon('chat')}${c.nota}</p>` : ''}</div>` : ''}
        </div>
        <aside class="side-sticky">
          <div class="card cta-card">
            <div class="row between"><span class="small muted">Total</span>${estado(c.estado)}</div>
            <h2 class="amount num">${St.dinero(St.totales(c).total)}</h2>
            <button class="item link" style="padding:8px 0" data-go="c/prestador/${p.id}">${avatar(nom)}<span class="grow"><b>${nom}</b>${calif(p.id)}</span>${icon('next')}</button>
            ${c.estado === 'Enviada' ? h`${cuenta(c.venceEn, 'Aprueba antes de')}
              <button class="btn btn-pri btn-lg" data-act="aprobar-cot" data-id="${c.id}" id="btn-aprobar-cot">Aprobar ${St.dinero(St.totales(c).total)}</button>
              <button class="btn btn-sec" data-act="rechazar-cot" data-id="${c.id}" id="btn-rechazar-cot">Rechazar</button>` : ''}
          </div>
          <div class="note note-mute">${icon('money')}<div>El pago es directo al prestador en efectivo o transferencia, fuera de la app. Ofira no te cobra comisión.</div></div>
        </aside>
      </div>`;
    }
  });

  // ======================= CONTRATA =======================
  function filaServicio(srv, rol) {
    const s = St.solicitud(srv.solicitudId);
    const o = St.oficio(s.oficioId);
    const otro = rol === 'cliente' ? St.nombrePrestador(srv.prestadorId) : St.nombre(srv.clienteCuentaId);
    const pend = St.pendientesDeServicio(srv).filter((c) => c.estado === 'Enviada');
    return h`<button class="item link" data-go="${rol === 'cliente' ? 'c' : 'p'}/servicio/${srv.id}" id="srv-${srv.id}">
      <span class="ico-box">${icon(o.icono)}</span>
      <span class="grow"><b>${St.especialidad(s.especialidadId).nombre} · ${otro}</b><small class="muted">${srv.folio} · ${horarioTexto({ tipo: 'programado', fecha: srv.horario.fecha, franja: srv.horario.franja })}</small>
      ${pend.length && rol === 'cliente' ? h`<small class="act-t">${icon('alert')}Cotización por responder</small>` : ''}</span>
      ${estado(srv.estado)}
    </button>`;
  }
  O.filaServicio = filaServicio;

  ruta({
    patron: 'c/contrata', rol: 'cliente', nav: 'contrata', titulo: () => 'Mis servicios',
    render: () => {
      const yo = app().yo();
      const srvs = St.S.servicios.filter((s) => s.clienteCuentaId === yo.id).sort((a, b) => b.creado - a.creado);
      const activos = srvs.filter((s) => s.estado === 'Confirmado' || s.estado === 'En ejecución');
      const otros = srvs.filter((s) => !activos.includes(s)).slice(0, 6);
      return h`<div class="stack">
        ${cabecera('Mis servicios', 'Sigue el avance de lo que contrataste, califica y reporta problemas.')}
        <section><h2 class="h2">Activos</h2>
        ${activos.length ? h`<div class="list">${activos.map((s) => filaServicio(s, 'cliente'))}</div>` : vacio('case', 'Sin servicios activos', 'Cuando apruebes una cotización, el servicio aparecerá aquí para que sigas su avance.')}</section>
        ${otros.length ? h`<section><div class="row between"><h2 class="h2">Recientes</h2><button class="btn btn-link btn-s" data-go="c/historial">Ver todo el historial</button></div><div class="list">${otros.map((s) => filaServicio(s, 'cliente'))}</div></section>` : ''}
      </div>`;
    }
  });

  function stepper(srv) {
    const pasos = ['Confirmado', 'En ejecución', 'Finalizado'];
    if (srv.estado === 'Cancelado') return h`<div class="note note-bad">${icon('x')}<div><b>Servicio cancelado.</b> ${srv.motivoCancelacion}</div></div>`;
    const idx = pasos.indexOf(srv.estado);
    return h`<div class="card"><ol class="stepper" aria-label="Avance del servicio">${pasos.map((p, i) => h`<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}" ${i === idx ? raw('aria-current="step"') : ''}>
      <span class="st-dot">${i < idx || (i === idx && p === 'Finalizado') ? icon('check') : i + 1}</span><span>${p}</span></li>`)}</ol></div>`;
  }
  O.stepper = stepper;
  function horaDe(ms) { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  O.horaDe = horaDe;

  function bloqueCalificacion(srv, yoId) {
    const mia = St.S.calificaciones.find((c) => c.servicioId === srv.id && c.deCuentaId === yoId);
    if (mia) return h`<div class="card"><h2 class="h2">Tu calificación</h2>${O.UI.estrellas(mia.estrellas)}<p>${mia.comentario || 'Sin comentario.'}</p>
      ${!mia.publicada ? aviso('act', 'clock', 'Guardada. Se publicará cuando se resuelva el reclamo abierto.') : h`<p class="small muted">Publicada · no se puede editar</p>`}</div>`;
    const v = St.puedeCalificar(srv.id, yoId);
    if (v.ok) return '';
    if (v.codigo === 'plazo') return aviso('mute', 'clock', v.error);
    return '';
  }
  O.bloqueCalificacion = bloqueCalificacion;

  ruta({
    patron: 'c/servicio/:id', rol: 'cliente', nav: 'contrata', back: 'c/contrata', titulo: (pr) => St.servicio(pr.id).folio,
    render: (pr) => {
      const srv = St.servicio(pr.id);
      const s = St.solicitud(srv.solicitudId);
      const p = St.prestador(srv.prestadorId);
      const yo = app().yo();
      const nom = St.nombre(p.cuentaId);
      const cots = St.cotizacionesDeServicio(srv).filter((c) => c.estado !== 'Borrador');
      const pend = cots.filter((c) => c.estado === 'Enviada');
      const rec = St.S.reclamos.find((r) => r.servicioId === srv.id);
      const puedeCal = St.puedeCalificar(srv.id, yo.id).ok;
      const cm = srv.estado === 'Finalizado' ? St.comisionServicio(srv) : null;
      return h`<div class="cols">
        <div class="stack">
          <div class="row between"><div><p class="eyebrow">${St.oficio(s.oficioId).nombre} · ${O.MODALIDADES[s.modalidad].nombre}</p><h1 class="h1">${St.especialidad(s.especialidadId).nombre}</h1></div>${estado(srv.estado, 'lg')}</div>
          ${stepper(srv)}
          ${srv.estado === 'Confirmado' && srv.enCamino ? h`<div class="banner" role="status" id="aviso-en-camino">${icon('send')}<span><b>${nom.split(' ')[0]} va en camino</b><small>Llega aproximadamente a las ${horaDe(srv.enCamino.fecha + srv.enCamino.minutos * O.MIN)} · avisó ${hace(srv.enCamino.fecha)}</small></span></div>` : ''}
          ${pend.map((c) => h`<button class="banner banner-act" data-go="c/cotizacion/${c.id}" id="btn-pend-${c.id}">${icon('file')}<span><b>${c.tipo === 'trabajo' ? 'Cotización del trabajo' : 'Trabajo adicional'} por responder</b><small>${St.dinero(St.totales(c).total)} · ${O.UI.restante(c.venceEn)} para decidir</small></span>${icon('next')}</button>`)}
          ${puedeCal ? h`<button class="btn btn-pri btn-lg" data-go="calificar/${srv.id}" id="btn-calificar">${icon('star')}Calificar a ${nom.split(' ')[0]}</button>` : ''}
          ${bloqueCalificacion(srv, yo.id)}
          ${srv.soloVisita ? aviso('info', 'info', 'Este servicio se cerró cobrando solo la visita de diagnóstico.') : ''}
          <section><h2 class="h2">Cotizaciones del servicio</h2><div class="list">${cots.map((c) => h`<button class="item link" data-go="c/cotizacion/${c.id}">
            <span class="grow"><b>${{ visita: 'Visita', trabajo: 'Trabajo', adicional: 'Adicional' }[c.tipo]}</b><small class="muted">${c.folio}</small></span>
            <span class="stack-r"><b class="num">${St.dinero(St.totales(c).total)}</b>${estado(c.estado)}</span></button>`)}</div></section>
          ${srv.avances.length ? h`<section class="card"><h2 class="h2">Avances</h2><ul class="bul">${srv.avances.map((a) => h`<li><span class="small muted">${fecha(a.fecha)}</span> · ${a.texto}</li>`)}</ul></section>` : ''}
          <section class="card"><h2 class="h2">Historial de estados</h2>${timeline(St.historialDe('Servicio', srv.id))}</section>
        </div>
        <aside class="side-sticky">
          <div class="card stack-s">
            <div class="row">${avatar(nom, 'l')}<div class="grow"><b>${nom}</b><p class="small muted">Tel. ${St.persona(St.cuenta(p.cuentaId).personaId).telefono}</p></div></div>
            <button class="btn btn-sec" data-go="chat/${s.id}/${p.id}" id="btn-mensajes">${icon('chat')}Mensajes</button>
            <p class="small">${icon('clock')}${horarioTexto({ tipo: 'programado', fecha: srv.horario.fecha, franja: srv.horario.franja })}</p>
            <p class="small">${icon('pin')}${St.sector(s.sectorId).nombre} · ${s.direccion}</p>
            ${s.ubicacion ? h`<p class="small"><a class="btn-link" href="${enlaceMapa(s.ubicacion)}" target="_blank" rel="noopener">Ver mi ubicación en el mapa</a></p>` : ''}
          </div>
          ${cm ? h`<div class="card stack-s"><span class="small muted">Total a pagar al prestador</span><p class="amount num">${St.dinero(cm.total)}</p>
            <p class="small">Pago: ${srv.pago.estado === 'Pagado' ? estado('Pagado') : estado('Pendiente')} ${srv.pago.metodo ? '· ' + srv.pago.metodo : ''}</p><p class="hint">Pago directo al prestador, fuera de la app.</p></div>` : ''}
          ${rec ? h`<div class="card"><div class="row between"><b>Reclamo ${rec.folio}</b>${estado(rec.estado)}</div><p class="small">${rec.motivo}</p>${rec.resolucion ? h`<p class="small"><b>Resolución:</b> ${rec.resolucion}</p>` : ''}</div>` : ''}
          ${srv.estado === 'Confirmado' ? h`<button class="btn btn-danger" data-act="cancelar-servicio" data-id="${srv.id}" id="btn-cancelar-servicio">Cancelar servicio</button>` : ''}
          ${(srv.estado === 'En ejecución' || srv.estado === 'Finalizado') && !St.reclamoAbiertoDe(srv.id) ? h`<button class="btn btn-sec" data-go="reclamo/${srv.id}" id="btn-reclamo">${icon('flag')}Tengo un problema con este servicio</button>` : ''}
        </aside>
      </div>`;
    }
  });

  ruta({
    patron: 'c/calificaciones', rol: 'cliente', nav: 'calificaciones', titulo: () => 'Calificaciones',
    render: () => {
      const yo = app().yo();
      const porCal = St.S.servicios.filter((s) => s.clienteCuentaId === yo.id && St.puedeCalificar(s.id, yo.id).ok);
      const dadas = St.S.calificaciones.filter((c) => c.deCuentaId === yo.id).sort((a, b) => b.fecha - a.fecha);
      const recibidas = St.S.calificaciones.filter((c) => c.aCuentaId === yo.id && c.publicada);
      const prom = recibidas.length ? (recibidas.reduce((a, c) => a + c.estrellas, 0) / recibidas.length).toFixed(1) : '–';
      return h`<div class="stack">
        ${cabecera('Calificaciones', 'Solo se califican servicios finalizados, una vez y dentro de 7 días. Los prestadores también te califican.')}
        <div class="stats-row">
          <div class="stat">${icon('star')}<div><b>${porCal.length}</b><span>Por calificar</span></div></div>
          <div class="stat gold">${icon('check')}<div><b>${dadas.length}</b><span>Calificaciones dadas</span></div></div>
          <div class="stat dark">${icon('user')}<div><b>${prom}</b><span>Tu promedio como cliente</span></div></div>
          <div class="stat">${icon('list')}<div><b>${recibidas.length}</b><span>Calificaciones recibidas</span></div></div>
        </div>
        <section><h2 class="h2">Por calificar</h2>${porCal.length ? h`<div class="list">${porCal.map((s) => h`<div class="item">${avatar(St.nombrePrestador(s.prestadorId), 's')}<span class="grow"><b>${St.nombrePrestador(s.prestadorId)}</b><small class="muted">${s.folio} · finalizado ${hace(s.finalizado)}</small></span><button class="btn btn-pri btn-s" data-go="calificar/${s.id}">Calificar</button></div>`)}</div>` : vacio('star', 'Nada pendiente', 'Cuando un servicio se finalice, podrás calificarlo aquí.')}</section>
        ${dadas.length ? h`<section><h2 class="h2">Tus calificaciones</h2><div class="list">${dadas.map((c) => h`<div class="review"><div class="row between"><b>${St.nombre(c.aCuentaId)}</b>${O.UI.estrellas(c.estrellas)}</div><p>${c.comentario || 'Sin comentario.'}</p><p class="small muted">${fecha(c.fecha)}${c.publicada ? '' : ' · retenida por reclamo abierto'}</p></div>`)}</div></section>` : ''}
      </div>`;
    }
  });

  ruta({
    patron: 'c/reclamos', rol: 'cliente', nav: 'reclamos', titulo: () => 'Reclamos',
    render: () => {
      const yo = app().yo();
      const recs = St.S.reclamos.filter((r) => St.servicio(r.servicioId).clienteCuentaId === yo.id).sort((a, b) => b.creado - a.creado);
      return h`<div class="stack">
        ${cabecera('Reclamos', 'Para abrir un reclamo, entra al servicio y toca “Tengo un problema con este servicio”. Soporte lo atiende.')}
        ${recs.length ? h`<div class="list">${recs.map((r) => { const srv = St.servicio(r.servicioId); return h`<button class="item link" data-go="c/servicio/${srv.id}">${icon('flag')}<span class="grow"><b>${r.folio} · ${r.motivo}</b><small class="muted">${srv.folio} · ${St.nombrePrestador(srv.prestadorId)} · ${hace(r.creado)}</small>${r.resolucion ? h`<small>Resolución: ${r.resolucion}</small>` : ''}</span>${estado(r.estado)}</button>`; })}</div>`
          : vacio('flag', 'No tienes reclamos', 'Ojalá siga así. Si algo sale mal en un servicio, repórtalo desde su detalle.')}
      </div>`;
    }
  });

  // ---------- Compartidas cliente/prestador ----------
  ruta({
    patron: 'calificar/:id', rol: ['cliente', 'prestador'], nav: 'calificaciones', back: true, titulo: () => 'Calificar',
    render: (pr) => {
      const srv = St.servicio(pr.id);
      const yo = app().yo();
      const esCliente = yo.id === srv.clienteCuentaId;
      const otro = esCliente ? St.nombrePrestador(srv.prestadorId) : St.nombre(srv.clienteCuentaId);
      const v = St.puedeCalificar(srv.id, yo.id);
      if (!v.ok) return h`<div class="narrow">${vacio(v.codigo === 'plazo' ? 'clock' : 'info', 'No puedes calificar', v.error, h`<button class="btn btn-sec" data-act="atras">Volver</button>`)}</div>`;
      const est = U.borrador.estrellas || 0;
      return h`<div class="narrow"><form class="card stack form" data-form="calificar" data-id="${srv.id}" novalidate>
        <div class="row">${avatar(otro, 'l')}<div><h1 class="h1">¿Cómo te fue con ${otro.split(' ')[0]}?</h1>
        <p class="muted">${srv.folio} · Una sola calificación por servicio. No se puede editar.</p></div></div>
        ${resumenErrores()}
        <fieldset class="field"><legend class="lbl">Calificación</legend>
          <div class="star-input" role="radiogroup" aria-label="Estrellas">${[1, 2, 3, 4, 5].map((n) => h`<label class="${n <= est ? 'on' : ''}"><input type="radio" name="estrellas" value="${n}" data-change="estrellas" ${n === est ? 'checked' : ''}><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg><span class="sr">${n} estrella${n > 1 ? 's' : ''}</span></label>`)}</div>
          ${err('estrellas')}</fieldset>
        <div class="field"><label for="cal-com">Comentario ${esCliente ? '(opcional)' : 'sobre el cliente (opcional)'}</label><textarea id="cal-com" name="comentario" rows="3" maxlength="300">${U.borrador.comentario || ''}</textarea></div>
        ${St.reclamoAbiertoDe(srv.id) ? aviso('act', 'info', 'Hay un reclamo abierto. Tu calificación se guardará y se publicará cuando se resuelva.') : ''}
        <button class="btn btn-pri btn-lg" type="submit" id="btn-enviar-calificacion">Enviar calificación</button>
      </form></div>`;
    }
  });

  O.MOTIVOS_RECLAMO = ['Trabajo incompleto o con fallas', 'Cobro distinto a lo cotizado', 'No se presentó o llegó muy tarde', 'Daños durante el trabajo', 'Trato inadecuado', 'Otro'];
  ruta({
    patron: 'reclamo/:id', rol: ['cliente', 'prestador'], nav: 'reclamos', back: true, titulo: () => 'Reclamo',
    render: (pr) => {
      const srv = St.servicio(pr.id);
      const b = U.borrador.rec || {};
      return h`<div class="narrow"><form class="card stack form" data-form="reclamo" data-id="${srv.id}" novalidate>
        <div><h1 class="h1">Cuéntanos qué pasó</h1>
        <p class="muted">${srv.folio}. Soporte revisará el caso con la información del servicio, las cotizaciones y los mensajes.</p></div>
        ${resumenErrores()}${U.errores._ ? aviso('bad', 'alert', U.errores._) : ''}
        <div class="field"><label for="rec-motivo">Motivo</label><select id="rec-motivo" name="motivo" ${inv('motivo')}><option value="">Elige un motivo</option>${O.MOTIVOS_RECLAMO.map((m) => h`<option ${b.motivo === m ? 'selected' : ''}>${m}</option>`)}</select>${err('motivo')}</div>
        <div class="field"><label for="rec-desc">Descripción</label><textarea id="rec-desc" name="descripcion" rows="4" ${inv('descripcion')}>${b.descripcion || ''}</textarea><p class="hint">Mínimo 15 caracteres.</p>${err('descripcion')}</div>
        <div class="field"><label for="rec-evid">Fotos de evidencia (opcional, hasta 3)</label>
          ${(U.evidencia || []).length < 3 ? h`<input id="rec-evid" name="evidencia" type="file" accept="image/jpeg,image/png,image/webp" multiple data-change="rec-evid" ${app().subiendo ? 'disabled' : ''}>` : ''}
          ${app().subiendo ? h`<span class="subiendo">${icon('clock')}Subiendo fotos…</span>` : ''}${fotos(U.evidencia || [], 'quitar-foto-rec')}</div>
        <p class="small muted">Mientras el reclamo esté abierto, las calificaciones de este servicio no se publican.</p>
        <button class="btn btn-pri btn-lg" type="submit" id="btn-enviar-reclamo">Enviar reclamo</button>
      </form></div>`;
    }
  });

  ruta({
    patron: 'chat/:sol/:pid', rol: ['cliente', 'prestador'], back: true, titulo: () => 'Mensajes',
    render: (pr) => {
      const s = St.solicitud(pr.sol);
      const p = St.prestador(pr.pid);
      const yo = app().yo();
      const otro = yo.id === s.clienteCuentaId ? St.nombre(p.cuentaId) : St.nombre(s.clienteCuentaId);
      const msgs = St.mensajesDe(s.id, p.id);
      return h`<div class="chat">
        <div class="chat-head">${avatar(otro, 's')}<div><b>${otro}</b><small class="muted">Vinculado a ${s.folio}</small></div></div>
        <div class="chat-list" id="chat-list">${msgs.length ? msgs.map((m) => h`<div class="msg ${m.deCuentaId === yo.id ? 'me' : ''}">${m.foto ? h`<a href="/archivo/${m.foto}" target="_blank" rel="noopener"><img src="/archivo/${m.foto}" alt="Foto enviada" loading="lazy"></a>` : ''}${m.texto ? h`<p>${m.texto}</p>` : ''}<small>${fecha(m.fecha)}</small></div>`) : h`<p class="muted center small">Escribe para coordinar detalles. Los mensajes quedan en el historial de la solicitud.</p>`}</div>
        <form class="chat-form" data-form="mensaje" data-sol="${s.id}" data-pid="${p.id}" novalidate>
          <label class="btn btn-icon btn-sec" for="chat-foto" title="Enviar foto" aria-label="Enviar foto">${icon('camera')}</label><input id="chat-foto" type="file" accept="image/jpeg,image/png,image/webp" data-change="chat-foto" class="sr">
          <label for="msg-txt" class="sr">Mensaje</label><input id="msg-txt" name="texto" autocomplete="off" placeholder="Escribe un mensaje" maxlength="400">
          <button class="btn btn-pri btn-icon" type="submit" aria-label="Enviar">${icon('send')}</button>
        </form>
      </div>`;
    },
    mount: () => { const l = document.getElementById('chat-list'); if (l) l.scrollTop = l.scrollHeight; }
  });

  ruta({
    patron: 'avisos', rol: ['cliente', 'prestador', 'administrador', 'soporte'], nav: 'avisos', titulo: () => 'Avisos',
    render: () => {
      const yo = app().yo();
      const lista = St.S.notificaciones.filter((n) => n.cuentaId === yo.id).sort((a, b) => b.fecha - a.fecha);
      return h`<div class="stack narrow">
        ${cabecera('Avisos', 'Invitaciones, cotizaciones y cambios de estado de tus solicitudes y servicios.')}
        ${lista.length ? h`<div class="row end"><button class="btn btn-link btn-s" data-act="leer-todo">Marcar todo como leído</button></div>
        <div class="list">${lista.map((n) => h`<button class="item link ${n.leida ? '' : 'unread'}" data-act="abrir-aviso" data-id="${n.id}">
          <span class="ico-box">${icon('bell')}</span><span class="grow"><b>${n.titulo}</b><small>${n.texto}</small><small class="muted">${hace(n.fecha)}</small></span>${n.leida ? '' : h`<span class="dot-unread" aria-label="No leído"></span>`}</button>`)}</div>`
          : vacio('bell', 'Sin avisos', 'Aquí verás invitaciones, cotizaciones y cambios de estado.')}
      </div>`;
    }
  });

  // ---------- Cuenta del cliente ----------
  ruta({
    patron: 'c/cuenta', rol: 'cliente', nav: 'cuenta', titulo: () => 'Mi perfil',
    render: () => {
      const yo = app().yo();
      const per = St.persona(yo.personaId);
      return h`<div class="stack narrow">
        <div class="card profile-head">${avatar(per.nombre, 'xl')}<div><h1 class="h1">${per.nombre}</h1><p class="muted">${yo.correo}</p><div class="tags">${yo.roles.map((r) => h`<span class="tag">${r[0].toUpperCase() + r.slice(1)}</span>`)}</div></div></div>
        <section class="card"><h2 class="h2">Datos</h2><div class="kv"><span>Teléfono</span><b>${per.telefono}</b><span>Sector</span><b>${St.sector(yo.sectorId) ? St.sector(yo.sectorId).nombre : '–'}</b><span>Cuenta creada</span><b>${fecha(yo.creada)}</b></div></section>
        <section class="card stack-s"><h2 class="h2">Dirección guardada</h2>
          ${yo.guardada ? h`<p>${icon('pin')}${yo.guardada.direccion}${yo.guardada.referencia ? ' · ' + yo.guardada.referencia : ''}</p>
            ${yo.guardada.lat != null ? h`<p class="small"><a class="btn-link" href="${enlaceMapa(yo.guardada)}" target="_blank" rel="noopener">Ubicación guardada · ver en el mapa</a></p>` : h`<p class="small muted">Sin ubicación del GPS.</p>`}
            <p class="hint">Se llena sola en tus próximas solicitudes. Solo la ve el prestador que contrates.</p>
            <button class="btn btn-sec btn-s" data-act="borrar-direccion" id="btn-borrar-direccion" style="align-self:flex-start">Borrar dirección guardada</button>`
          : h`<p class="small muted">No tienes una dirección guardada. Al hacer una solicitud puedes marcar “Guardar esta dirección para la próxima vez”.</p>`}
        </section>
        <div class="list">
          <button class="item link" data-go="c/historial">${icon('list')}<span class="grow">Historial de solicitudes y servicios</span>${icon('next')}</button>
          <button class="item link" data-go="avisos">${icon('bell')}<span class="grow">Avisos</span>${icon('next')}</button>
          ${yo.roles.includes('prestador') ? h`<button class="item link" data-act="cambiar-rol" data-v="prestador" id="btn-modo-prestador">${icon('tool')}<span class="grow">Cambiar a modo prestador</span>${icon('next')}</button>` : ''}
          <button class="item link" data-go="acerca">${icon('info')}<span class="grow">Ayuda y privacidad</span>${icon('next')}</button>
          <button class="item link" data-act="salir" id="btn-salir">${icon('out')}<span class="grow">Cerrar sesión</span></button>
        </div>
        ${formClave()}
      </div>`;
    }
  });

  ruta({
    patron: 'c/historial', rol: 'cliente', nav: 'historial', titulo: () => 'Historial',
    render: () => {
      const yo = app().yo();
      const f = U.filtroHist || 'todos';
      let sols = St.S.solicitudes.filter((s) => s.clienteCuentaId === yo.id).sort((a, b) => b.creada - a.creada);
      const srvDe = (s) => St.servicioDeSolicitud(s.id);
      if (f === 'finalizados') sols = sols.filter((s) => srvDe(s) && srvDe(s).estado === 'Finalizado');
      if (f === 'cancelados') sols = sols.filter((s) => ['Cancelada', 'Vencida'].includes(s.estado) || (srvDe(s) && srvDe(s).estado === 'Cancelado'));
      return h`<div class="stack">
        ${cabecera('Historial', 'Todas tus solicitudes y los servicios que salieron de ellas.')}
        <div class="chips">${[['todos', 'Todos'], ['finalizados', 'Finalizados'], ['cancelados', 'Cancelados o vencidos']].map(([k, t]) => h`<button class="chip ${f === k ? 'on' : ''}" aria-pressed="${f === k}" data-act="filtro-hist" data-v="${k}">${t}</button>`)}</div>
        ${sols.length ? h`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Trabajo</th><th>Solicitud</th><th>Servicio</th><th>Prestador</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>
          ${sols.map((s) => { const srv = srvDe(s); return h`<tr class="item link" data-go="${srv ? 'c/servicio/' + srv.id : 'c/solicitud/' + s.id}" style="display:table-row">
            <td>${St.especialidad(s.especialidadId).nombre}</td><td class="num">${s.folio}</td><td class="num">${srv ? srv.folio : '–'}</td><td>${srv ? St.nombrePrestador(srv.prestadorId) : '–'}</td><td>${fecha(s.creada)}</td><td>${estado(srv ? srv.estado : s.estado)}</td></tr>`; })}
        </tbody></table></div>` : vacio('list', 'Sin resultados', 'No hay solicitudes con ese filtro.')}
      </div>`;
    }
  });
})();
