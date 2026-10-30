/* Ofira · Utilidades de interfaz: plantillas seguras, íconos, estados, componentes comunes. */
(function () {
  'use strict';
  const O = window.Ofira;

  // ---------- Plantillas con escape automático ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function Raw(s) { this.s = s; }
  function raw(s) { return new Raw(s); }
  function val(v) {
    if (v == null || v === false) return '';
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(val).join('');
    return esc(v);
  }
  function h(strings, ...vals) {
    let out = '';
    strings.forEach((s, i) => { out += s; if (i < vals.length) out += val(vals[i]); });
    return raw(out);
  }

  // ---------- Íconos (trazo, 24x24) ----------
  const P = {
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    saw: '<path d="M3 17 15 5l4 4L7 21H3z"/><path d="m8 12 2 2m1-5 2 2"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4m0 3v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/>',
    wifiOff: '<path d="M2 8.5a15 15 0 0 1 4.2-2.6M9.6 5.2A15 15 0 0 1 22 8.5M5 12a10 10 0 0 1 3.5-2.2m5.2-.4A10 10 0 0 1 19 12M8.5 15.5a5 5 0 0 1 7 0M12 19.5v.01M3 3l18 18"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    next: '<path d="m9 5 7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    home: '<path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    case: '<path d="M3 7h18v13H3z"/><path d="M9 7V4h6v3M3 12h18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    out: '<path d="M10 4H4v16h6M15 8l4 4-4 4M19 12H9"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16m0 4v-4h-4"/>',
    cal: '<path d="M4 6h16v15H4zM4 10h16M8 3v4m8-4v4"/>',
    money: '<path d="M3 7h18v10H3z"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4m12-4v4"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    chart: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-4-6.3"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    send: '<path d="m3 11 18-8-8 18-2-8z"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    lock: '<path d="M5 11h14v10H5z"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
  };
  function icon(n, cls) {
    return raw('<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (P[n] || P.info) + '</svg>');
  }

  // ---------- Estados: texto + ícono + tono (nunca solo color) ----------
  const TONO = {
    'Solicitada': ['wait', 'clock'], 'En evaluación': ['wait', 'search'], 'Pendiente de aprobación': ['act', 'alert'],
    'Confirmada': ['ok', 'check'], 'Vencida': ['bad', 'clock'], 'Cancelada': ['bad', 'x'],
    'Borrador': ['mute', 'file'], 'Enviada': ['act', 'send'], 'Aprobada': ['ok', 'check'], 'Rechazada': ['bad', 'x'], 'Anulada': ['mute', 'x'],
    'Confirmado': ['ok', 'check'], 'En ejecución': ['wait', 'tool'], 'Finalizado': ['ok', 'flag'], 'Cancelado': ['bad', 'x'],
    'Abierto': ['act', 'alert'], 'En revisión': ['wait', 'search'], 'Resuelto': ['ok', 'check'], 'Cerrado': ['mute', 'lock'],
    'Pendiente de revisión': ['wait', 'clock'], 'Verificado': ['ok', 'shield'], 'Observado': ['act', 'alert'], 'Suspendido': ['bad', 'x'],
    'Pendiente': ['wait', 'clock'], 'Aceptada': ['ok', 'check'], 'Pagado': ['ok', 'money'],
    'Activa': ['ok', 'check'], 'Suspendida': ['bad', 'x']
  };
  function estado(e, extra) {
    const t = TONO[e] || ['mute', 'info'];
    return h`<span class="est est-${t[0]}${extra ? ' ' + extra : ''}">${icon(t[1])}<span>${e}</span></span>`;
  }
  function simulado(texto) {
    return h`<span class="sim" title="Esta función se simula en el prototipo">${icon('info')}Simulado${texto ? ' · ' + texto : ''}</span>`;
  }
  function estrellas(n, tam) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += '<svg class="ic star ' + (i <= Math.round(n) ? 'on' : '') + ' ' + (tam || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + P.star + '</svg>';
    return raw('<span class="stars" role="img" aria-label="' + n + ' de 5 estrellas">' + s + '</span>');
  }
  function calif(pid) {
    const r = O.Store.calificacionPromedio(pid);
    if (!r.n) return h`<span class="muted">Sin calificaciones aún</span>`;
    return h`<span class="rating">${estrellas(r.prom)}<b>${r.prom.toFixed(1)}</b><span class="muted">(${r.n})</span></span>`;
  }
  function avatar(nombre, cls) {
    const ini = String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
    let hue = 0; for (const ch of String(nombre)) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
    return h`<span class="av ${cls || ''}" style="--h:${hue}" aria-hidden="true">${ini}</span>`;
  }

  // ---------- Fechas y tiempos ----------
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fecha(ms) {
    const d = new Date(ms);
    return d.getDate() + ' ' + meses[d.getMonth()] + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function fechaCorta(iso) {
    const d = new Date(iso + 'T12:00:00');
    return O.DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + meses[d.getMonth()];
  }
  function hace(ms) {
    const s = Math.round((O.Store.ahora() - ms) / 1000);
    if (s < 60) return 'hace un momento';
    const m = Math.round(s / 60); if (m < 60) return 'hace ' + m + ' min';
    const hr = Math.round(m / 60); if (hr < 24) return 'hace ' + hr + ' h';
    const d = Math.round(hr / 24); return 'hace ' + d + (d === 1 ? ' día' : ' días');
  }
  function restante(ms) {
    const s = Math.max(0, Math.round((ms - O.Store.ahora()) / 1000));
    if (s <= 0) return 'vencido';
    const d = Math.floor(s / 86400); const hr = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60;
    if (d) return d + ' d ' + hr + ' h';
    if (hr) return hr + ' h ' + String(m).padStart(2, '0') + ' min';
    return m + ':' + String(ss).padStart(2, '0') + ' min';
  }
  function cuenta(msVence, prefijo) {
    return h`<span class="countdown" data-vence="${msVence}">${icon('clock')}<span>${prefijo || 'Vence en'} <b data-cd>${restante(msVence)}</b></span></span>`;
  }
  function horarioTexto(horario) {
    if (!horario) return '';
    if (horario.tipo === 'ahora') return 'Lo antes posible';
    const f = O.Store.franja(horario.franja);
    return fechaCorta(horario.fecha) + ' · ' + f.nombre + ' (' + f.horas + ')';
  }

  // ---------- Bloques comunes ----------
  function vacio(ic, titulo, texto, acciones) {
    return h`<div class="empty" role="status">${icon(ic, 'big')}<h3>${titulo}</h3><p>${texto}</p>${acciones ? h`<div class="row wrap center">${acciones}</div>` : ''}</div>`;
  }
  function aviso(tono, ic, texto) {
    return h`<div class="note note-${tono}" role="${tono === 'bad' ? 'alert' : 'status'}">${icon(ic)}<div>${texto}</div></div>`;
  }
  function cotTabla(cot) {
    const t = O.Store.totales(cot);
    const grupos = [['mano_obra', 'Mano de obra'], ['materiales', 'Materiales'], ['cargos', 'Cargos']];
    return h`<div class="quote">
      ${grupos.map(([k, nom]) => {
        const ls = cot.lineas.filter((l) => l.categoria === k);
        return h`<div class="q-group">
          <div class="q-head"><span>${nom}</span><b class="num">${O.Store.dinero(t[k])}</b></div>
          ${ls.length ? ls.map((l) => h`<div class="q-line"><span>${l.concepto}</span><span class="num">${O.Store.dinero(l.monto)}</span></div>`) : h`<div class="q-line muted"><span>Sin ${nom.toLowerCase()}</span><span></span></div>`}
        </div>`;
      })}
      <div class="q-total"><span>Total</span><b class="num">${O.Store.dinero(t.total)}</b></div>
    </div>`;
  }
  function timeline(items) {
    if (!items.length) return h`<p class="muted">Sin movimientos todavía.</p>`;
    return h`<ol class="timeline">${items.map((it) => h`<li>
      <span class="dot"></span>
      <div><div class="tl-top">${estado(it.estado)}<span class="muted small">${fecha(it.fecha)}</span></div>
      <div class="small">${it.objeto !== 'Servicio' && it.objeto !== 'Solicitud' ? it.objeto + ' · ' : ''}por ${O.Store.nombre(it.actor)}${it.nota ? ' · ' + it.nota : ''}</div></div>
    </li>`)}</ol>`;
  }
  function mapa(sectorNombre) {
    // Imagen fija del mapa (no es un mapa real)
    return h`<figure class="map" aria-label="Mapa de referencia del sector ${sectorNombre}">
      <svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="320" height="140" class="m-bg"/>
        <path class="m-river" d="M-10 110 C 60 90, 90 130, 160 105 S 260 70, 330 92"/>
        <path class="m-road" d="M0 40 H320 M0 78 H320 M60 0 V140 M150 0 V140 M240 0 V140"/>
        <path class="m-road thin" d="M0 20 H320 M0 60 H320 M105 0 V140 M195 0 V140 M285 0 V140"/>
        <rect x="160" y="44" width="30" height="28" class="m-block"/><rect x="70" y="84" width="28" height="18" class="m-block"/>
        <g transform="translate(176 58)"><circle r="16" class="m-halo"/><path class="m-pin" d="M0 6s-9-8-9-15a9 9 0 0 1 18 0c0 7-9 15-9 15z" transform="translate(0 -4)"/><circle r="3" cy="-13" class="m-dot"/></g>
      </svg>
      <figcaption><span class="ref-tag">${icon('pin')}Mapa de referencia</span><span>${sectorNombre}</span></figcaption>
    </figure>`;
  }

  // ---------- Fotos subidas (se sirven solo a cuentas con sesión) ----------
  function fotos(ids, quitar) {
    if (!ids || !ids.length) return '';
    return h`<div class="thumbs">${ids.map((id) => h`<span class="thumb"><a href="/archivo/${id}" target="_blank" rel="noopener"><img src="/archivo/${id}" alt="Foto adjunta" loading="lazy"></a>
      ${quitar ? h`<button type="button" class="thumb-x" data-act="${quitar}" data-id="${id}" aria-label="Quitar foto">${icon('x')}</button>` : ''}</span>`)}</div>`;
  }

  // ---------- Modal y toast ----------
  let modalCb = null;
  let modalGen = 0;
  function modal(opts) {
    // opts: { titulo, cuerpo (Raw), acciones: [{texto, clase, valor}], alCerrar(valor, form) }
    const root = document.getElementById('modal-root');
    modalGen += 1;
    modalCb = opts.alCerrar || null;
    root.innerHTML = val(h`<div class="modal-back" data-act="modal-cerrar" data-valor=""></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-t">
        <form id="modal-form" data-form="modal" novalidate>
          <h2 id="modal-t">${opts.titulo}</h2>
          <div class="modal-body">${opts.cuerpo || ''}</div>
          <div class="modal-err" id="modal-err" role="alert" hidden></div>
          <div class="modal-actions">${(opts.acciones || [{ texto: 'Entendido', clase: 'btn-pri', valor: 'ok' }]).map((a) =>
            h`<button type="${a.submit ? 'submit' : 'button'}" class="btn ${a.clase || 'btn-sec'}" data-act="modal-cerrar" data-valor="${a.valor}" id="modal-btn-${a.valor}">${a.texto}</button>`)}</div>
        </form>
      </div>`);
    root.hidden = false;
    const primero = root.querySelector('input, textarea, select, .btn-pri');
    if (primero) primero.focus();
  }
  function modalError(msg) {
    const e = document.getElementById('modal-err');
    if (!e) return;
    e.textContent = msg; e.hidden = !msg;
  }
  function cerrarModal(valor) {
    const root = document.getElementById('modal-root');
    const form = document.getElementById('modal-form');
    const cb = modalCb;
    const gen = modalGen;
    if (cb && valor) {
      const seguir = cb(valor, form);
      if (seguir === false) return; // el callback pidió mantener el modal abierto (validación)
      if (gen !== modalGen) return; // el callback abrió otro modal (por ejemplo, un error)
    }
    modalCb = null;
    root.hidden = true; root.innerHTML = '';
  }
  function toast(texto, tono) {
    const t = document.getElementById('toast');
    while (t.children.length >= 1) t.firstChild.remove(); // un aviso a la vez para no tapar la pantalla
    const el = document.createElement('div');
    el.className = 'toast toast-' + (tono || 'ok');
    el.setAttribute('role', 'status');
    el.innerHTML = val(h`${icon(tono === 'bad' ? 'alert' : tono === 'info' ? 'bell' : 'check')}<span>${texto}</span>`);
    t.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3600);
  }

  O.UI = { fotos, esc, raw, h, val, icon, estado, simulado, estrellas, calif, avatar, fecha, fechaCorta, hace, restante, cuenta, horarioTexto, vacio, aviso, cotTabla, timeline, mapa, modal, modalError, cerrarModal, toast };
})();
