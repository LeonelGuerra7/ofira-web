/* Ofira · Reportes para administración en PDF y Excel (.xlsx).
 * Sin librerías externas: el .xlsx es un ZIP con XML (Office Open XML) y el PDF se escribe a mano
 * con las fuentes estándar Helvetica (codificación WinAnsi, que incluye tildes y ñ).
 */
'use strict';
const zlib = require('node:zlib');

const ZONA = 'America/Guatemala';
const fechaHora = (t) => (t ? new Date(t).toLocaleString('es-GT', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '');
const soloFecha = (t) => (t ? new Date(t).toLocaleDateString('es-GT', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const contar = (lista, fn) => lista.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});

// ======================= Datos de cada reporte =======================
/* Cada reporte: { titulo, descripcion, columnas: [{ t, w, num }], filas: [[...]], resumen: [[etiqueta, valor]] }
 * w es el peso del ancho de la columna en el PDF y el ancho aproximado en Excel. */
function construir(O, St, tipo, filtro) {
  const S = St.S;
  const persona = (cuentaId) => { const c = St.cuenta(cuentaId); return c ? St.persona(c.personaId) : null; };
  const sector = (id) => { const s = St.sector(id); return s ? s.nombre : ''; };

  if (tipo === 'usuarios') {
    const filas = S.cuentas.map((c) => { const p = St.persona(c.personaId); return [p.nombre, c.correo, p.telefono, c.roles.join(', '), sector(c.sectorId), soloFecha(c.creada), c.estado]; });
    const roles = {}; S.cuentas.forEach((c) => c.roles.forEach((r) => { roles[r] = (roles[r] || 0) + 1; }));
    return {
      titulo: 'Usuarios', descripcion: 'Cuentas registradas en la plataforma, con sus roles y estado.',
      columnas: [{ t: 'Persona', w: 20 }, { t: 'Correo', w: 22 }, { t: 'Teléfono', w: 11 }, { t: 'Roles', w: 16 }, { t: 'Sector', w: 16 }, { t: 'Creada', w: 11 }, { t: 'Estado', w: 11 }],
      filas,
      resumen: [['Total de cuentas', S.cuentas.length], ...['cliente', 'prestador', 'soporte', 'administrador'].map((r) => ['Con rol ' + r, roles[r] || 0]),
        ['Activas', S.cuentas.filter((c) => c.estado === 'Activa').length], ['Suspendidas', S.cuentas.filter((c) => c.estado !== 'Activa').length]]
    };
  }

  if (tipo === 'prestadores') {
    let lista = S.prestadores.slice();
    if (filtro) lista = lista.filter((p) => p.estadoVerificacion === filtro);
    const com = St.comisiones();
    const filas = lista.map((p) => {
      const per = persona(p.cuentaId); const r = St.calificacionPromedio(p.id); const c = com[p.id];
      return [per ? per.nombre : '', St.oficio(p.oficioId).nombre, p.experiencia, p.cobertura.map(sector).join(', '), r.n ? Number(r.prom.toFixed(1)) : '', r.n,
        S.servicios.filter((s) => s.prestadorId === p.id && s.estado === 'Finalizado').length, c ? c.comision : 0, soloFecha(p.alta), p.estadoVerificacion];
    });
    const est = contar(S.prestadores, (p) => p.estadoVerificacion);
    return {
      titulo: 'Prestadores' + (filtro ? ' · ' + filtro : ''), descripcion: 'Prestadores registrados, su verificación, calificación y comisión acumulada (8 % de la mano de obra).',
      columnas: [{ t: 'Prestador', w: 18 }, { t: 'Oficio', w: 11 }, { t: 'Años exp.', w: 7, num: true }, { t: 'Cobertura', w: 23 }, { t: 'Calificación', w: 9, num: true },
        { t: 'Opiniones', w: 8, num: true }, { t: 'Finalizados', w: 9, num: true }, { t: 'Comisión (Q)', w: 9, num: true, dinero: true }, { t: 'Alta', w: 9 }, { t: 'Verificación', w: 13 }],
      filas,
      resumen: [['Total de prestadores', S.prestadores.length], ...['Verificado', 'Pendiente de revisión', 'Observado', 'Suspendido'].map((e) => [e, est[e] || 0]),
        ...S.oficios.map((o) => ['Oficio: ' + o.nombre, S.prestadores.filter((p) => p.oficioId === o.id).length])]
    };
  }

  if (tipo === 'categorias') {
    const filas = S.oficios.map((o) => {
      const esp = S.especialidades.filter((e) => e.oficioId === o.id);
      return [o.nombre, o.activo ? 'Activo' : 'Inactivo', o.modalidades.map((m) => O.MODALIDADES[m].nombre).join(', '), esp.length, esp.map((e) => e.nombre).join(', '),
        S.prestadores.filter((p) => p.oficioId === o.id).length, S.solicitudes.filter((s) => s.oficioId === o.id).length];
    });
    return {
      titulo: 'Categorías', descripcion: 'Oficios con sus modalidades y especialidades, y cuánto se usan.',
      columnas: [{ t: 'Oficio', w: 12 }, { t: 'Estado', w: 8 }, { t: 'Modalidades', w: 16 }, { t: 'N.º esp.', w: 6, num: true }, { t: 'Especialidades', w: 38 }, { t: 'Prestadores', w: 9, num: true }, { t: 'Solicitudes', w: 9, num: true }],
      filas,
      resumen: [['Oficios', S.oficios.length], ['Oficios activos', S.oficios.filter((o) => o.activo).length], ['Especialidades', S.especialidades.length]]
    };
  }

  if (tipo === 'solicitudes') {
    let lista = S.solicitudes.slice().sort((a, b) => b.creada - a.creada);
    if (filtro) lista = lista.filter((s) => s.estado === filtro);
    const filas = lista.map((s) => {
      const e = St.especialidad(s.especialidadId); const per = persona(s.clienteCuentaId);
      return [s.folio, St.oficio(s.oficioId).nombre, O.MODALIDADES[s.modalidad].nombre, e ? e.nombre : '', sector(s.sectorId), per ? per.nombre : '',
        S.invitaciones.filter((i) => i.solicitudId === s.id).length, S.cotizaciones.filter((c) => c.solicitudId === s.id && c.estado !== 'Borrador').length, fechaHora(s.creada), s.estado];
    });
    const est = contar(S.solicitudes, (s) => s.estado);
    return {
      titulo: 'Solicitudes' + (filtro ? ' · ' + filtro : ''), descripcion: 'Solicitudes de servicio hechas por los clientes, de la más reciente a la más antigua.',
      columnas: [{ t: 'Folio', w: 9 }, { t: 'Oficio', w: 10 }, { t: 'Modalidad', w: 10 }, { t: 'Especialidad', w: 16 }, { t: 'Sector', w: 13 }, { t: 'Cliente', w: 16 },
        { t: 'Invitados', w: 8, num: true }, { t: 'Cotizaciones', w: 10, num: true }, { t: 'Creada', w: 12 }, { t: 'Estado', w: 14 }],
      filas,
      resumen: [['Total de solicitudes', S.solicitudes.length], ...['Solicitada', 'En evaluación', 'Pendiente de aprobación', 'Confirmada', 'Vencida', 'Cancelada'].map((e) => [e, est[e] || 0]),
        ...S.oficios.map((o) => ['Oficio: ' + o.nombre, S.solicitudes.filter((s) => s.oficioId === o.id).length])]
    };
  }

  if (tipo === 'reclamos') {
    const lista = S.reclamos.slice().sort((a, b) => b.creado - a.creado);
    const filas = lista.map((r) => {
      const srv = St.servicio(r.servicioId);
      return [r.folio, srv ? srv.folio : '', r.motivo, r.descripcion || '', srv ? St.nombre(srv.clienteCuentaId) : '', srv ? St.nombrePrestador(srv.prestadorId) : '',
        St.nombre(r.abiertoPor), fechaHora(r.creado), r.estado, r.resolucion || ''];
    });
    const est = contar(S.reclamos, (r) => r.estado);
    const fin = S.servicios.filter((s) => s.estado === 'Finalizado').length;
    return {
      titulo: 'Reclamos', descripcion: 'Reclamos abiertos por clientes o prestadores y su resolución por parte de soporte.',
      columnas: [{ t: 'Folio', w: 8 }, { t: 'Servicio', w: 8 }, { t: 'Motivo', w: 13 }, { t: 'Descripción', w: 22 }, { t: 'Cliente', w: 12 }, { t: 'Prestador', w: 12 },
        { t: 'Abierto por', w: 12 }, { t: 'Creado', w: 11 }, { t: 'Estado', w: 9 }, { t: 'Resolución', w: 18 }],
      filas,
      resumen: [['Total de reclamos', S.reclamos.length], ...['Abierto', 'En revisión', 'Resuelto', 'Cerrado'].map((e) => [e, est[e] || 0]),
        ['Tasa de reclamos (por servicio finalizado)', (fin ? Math.round((S.reclamos.length / fin) * 100) : 0) + ' %']]
    };
  }

  if (tipo === 'general') {
    const k = St.indicadores(); const com = St.comisiones();
    const filas = Object.entries(com).map(([pid, r]) => [St.nombrePrestador(pid), r.servicios, r.mano, r.comision, r.exentos]);
    return {
      titulo: 'Indicadores y comisiones', descripcion: 'Indicadores de operación y comisión del 8 % sobre la mano de obra por prestador.',
      columnas: [{ t: 'Prestador', w: 30 }, { t: 'Servicios finalizados', w: 14, num: true }, { t: 'Mano de obra (Q)', w: 14, num: true, dinero: true }, { t: 'Comisión 8 % (Q)', w: 14, num: true, dinero: true }, { t: 'Exentos (primer mes)', w: 14, num: true }],
      filas,
      resumen: [['Solicitudes enviadas', k.enviadas], ['Servicios finalizados', k.atendidas], ['Solicitudes atendidas', k.pctAtendidas + ' %'], ['Tiempo promedio de aceptación', k.tiempoProm + ' min'],
        ['Cancelaciones', k.pctCanceladas + ' %'], ['Reclamos', k.pctReclamos + ' %'], ['Solicitudes vencidas', k.vencidas],
        ['Comisión acumulada (Q)', Object.values(com).reduce((a, r) => a + r.comision, 0)]]
    };
  }
  return null;
}

// ======================= Excel (.xlsx) =======================
const xml = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
function colLetra(i) { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

/* Estilos: 0 normal · 1 título · 2 subtítulo gris · 3 encabezado de tabla · 4 número · 5 dinero · 6 texto con ajuste */
function celda(ref, v, estilo) {
  if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${estilo || 4}"><v>${v}</v></c>`;
  if (v === '' || v === null || v === undefined) return estilo ? `<c r="${ref}" s="${estilo}"/>` : '';
  return `<c r="${ref}" t="inlineStr" s="${estilo || 6}"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
}

function hojaDatos(rep, generado) {
  const n = rep.columnas.length; const ult = colLetra(n - 1);
  const filas = [];
  filas.push(`<row r="1" ht="24" customHeight="1">${celda('A1', 'Ofira · ' + rep.titulo, 1)}</row>`);
  filas.push(`<row r="2">${celda('A2', rep.descripcion + ' Generado el ' + generado + '.', 2)}</row>`);
  filas.push(`<row r="4" ht="20" customHeight="1">${rep.columnas.map((c, i) => celda(colLetra(i) + '4', c.t, 3)).join('')}</row>`);
  rep.filas.forEach((f, j) => {
    const r = j + 5;
    filas.push(`<row r="${r}">${f.map((v, i) => celda(colLetra(i) + r, v, typeof v === 'number' ? (rep.columnas[i].dinero ? 5 : 4) : 6)).join('')}</row>`);
  });
  const fin = Math.max(5, rep.filas.length + 4);
  const anchos = rep.columnas.map((c, i) => {
    const largo = Math.max(c.t.length, ...rep.filas.map((f) => String(f[i] === undefined ? '' : f[i]).length));
    return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(10, largo + 2))}" customWidth="1"/>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${anchos}</cols><sheetData>${filas.join('')}</sheetData>
${rep.filas.length ? `<autoFilter ref="A4:${ult}${fin}"/>` : ''}<mergeCells count="1"><mergeCell ref="A2:${ult}2"/></mergeCells>
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

function hojaResumen(rep, generado, autor) {
  const filas = [`<row r="1" ht="24" customHeight="1">${celda('A1', 'Resumen · ' + rep.titulo, 1)}</row>`, `<row r="2">${celda('A2', 'Generado el ' + generado + ' por ' + autor, 2)}</row>`,
    `<row r="4">${celda('A4', 'Indicador', 3)}${celda('B4', 'Valor', 3)}</row>`];
  rep.resumen.forEach(([k, v], j) => { filas.push(`<row r="${j + 5}">${celda('A' + (j + 5), k, 6)}${celda('B' + (j + 5), v, typeof v === 'number' && !Number.isInteger(v) ? 5 : 4)}</row>`); });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="46" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/></cols>
<sheetData>${filas.join('')}</sheetData></worksheet>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;Q&quot; #,##0.00"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="15"/><color rgb="FF12304A"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FF5B6B7A"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF12304A"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFDDE3EA"/></left><right style="thin"><color rgb="FFDDE3EA"/></right><top style="thin"><color rgb="FFDDE3EA"/></top><bottom style="thin"><color rgb="FFDDE3EA"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs></styleSheet>`;

function zip(archivos) {
  const locales = []; const central = []; let pos = 0;
  const ahora = new Date(); const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
  const dia = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
  archivos.forEach(([nombre, texto]) => {
    const datos = Buffer.from(texto, 'utf8'); const comp = zlib.deflateRawSync(datos); const crc = zlib.crc32(datos) >>> 0; const n = Buffer.from(nombre, 'utf8');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8); lh.writeUInt16LE(hora, 10); lh.writeUInt16LE(dia, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(datos.length, 22); lh.writeUInt16LE(n.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(hora, 12); ch.writeUInt16LE(dia, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(datos.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(pos, 42);
    locales.push(lh, n, comp); central.push(ch, n);
    pos += 30 + n.length + comp.length;
  });
  const dir = Buffer.concat(central); const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10); fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(pos, 16);
  return Buffer.concat([...locales, dir, fin]);
}

function xlsx(rep, generado, autor) {
  const hoja = (rep.titulo.split(' · ')[0]).slice(0, 31).replace(/[\\/?*[\]:]/g, '');
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml('Ofira · ' + rep.titulo)}</dc:title><dc:creator>Ofira</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(hoja)}" sheetId="1" r:id="rId1"/><sheet name="Resumen" sheetId="2" r:id="rId2"/></sheets>${rep.filas.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xml(hoja)}'!$A$4:$${colLetra(rep.columnas.length - 1)}$${rep.filas.length + 4}</definedName></definedNames>` : ''}</workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/worksheets/sheet1.xml', hojaDatos(rep, generado)],
    ['xl/worksheets/sheet2.xml', hojaResumen(rep, generado, autor)],
    ['xl/styles.xml', ESTILOS]
  ]);
}

// ======================= PDF =======================
/* Anchos de Helvetica (unidades de 1/1000) para los caracteres 32–126; las letras con tilde usan el ancho de su letra base. */
const ANCHOS = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };
function anchoTexto(s, tam, negrita) {
  let w = 0;
  for (const ch of s) {
    const base = ch.normalize('NFD')[0]; const c = base.charCodeAt(0);
    w += c >= 32 && c <= 126 ? ANCHOS[c - 32] : ch === '…' || ch === '—' ? 1000 : ch === '·' ? 278 : ch === 'º' || ch === 'ª' ? 365 : 556;
  }
  return (w * tam / 1000) * (negrita ? 1.07 : 1);
}
function pdfTexto(s) {
  const bytes = [];
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    const b = WIN[ch] !== undefined ? WIN[ch] : c < 256 ? c : 0x3f;
    if (b === 0x28 || b === 0x29 || b === 0x5c) bytes.push(0x5c, b);
    else if (b < 32) bytes.push(0x20);
    else bytes.push(b);
  }
  return Buffer.from(bytes).toString('latin1');
}
function partir(texto, ancho, tam, negrita, maxLineas) {
  const palabras = String(texto).split(/\s+/).filter(Boolean); const lineas = []; let actual = '';
  const cortar = (p) => { while (anchoTexto(p, tam, negrita) > ancho && p.length > 1) p = p.slice(0, -1); return p; };
  for (let p of palabras) {
    const prueba = actual ? actual + ' ' + p : p;
    if (anchoTexto(prueba, tam, negrita) <= ancho) { actual = prueba; continue; }
    if (actual) lineas.push(actual);
    while (anchoTexto(p, tam, negrita) > ancho) { const t = cortar(p); lineas.push(t); p = p.slice(t.length); }
    actual = p;
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const r = lineas.slice(0, maxLineas); let u = r[maxLineas - 1] + '…';
    while (anchoTexto(u, tam, negrita) > ancho && u.length > 2) u = u.slice(0, -2) + '…';
    r[maxLineas - 1] = u; return r;
  }
  return lineas.length ? lineas : [''];
}
const COLOR = { petroleo: '0.071 0.188 0.290', turquesa: '0.071 0.659 0.616', fondo: '0.961 0.969 0.980', dorado: '0.906 0.663 0.263', linea: '0.867 0.890 0.918', gris: '0.357 0.420 0.478', tinta: '0.106 0.149 0.192' };
const fmtValor = (v, c) => (typeof v === 'number' ? (c && c.dinero ? 'Q ' + v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.toLocaleString('es-GT')) : String(v === undefined || v === null ? '' : v));

function pdf(rep, generado, autor) {
  const W = 792; const H = 612; const M = 36; const ANCHO = W - 2 * M;
  const paginas = []; let ops = null; let y = 0;
  const t = (x, yy, s, tam, negrita, color) => ops.push(`BT /${negrita ? 'F2' : 'F1'} ${tam} Tf ${color || COLOR.tinta} rg ${x.toFixed(2)} ${yy.toFixed(2)} Td (${pdfTexto(s)}) Tj ET`);
  const rect = (x, yy, w, h, color) => ops.push(`${color} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);

  const total = rep.columnas.reduce((a, c) => a + c.w, 0);
  const anchos = rep.columnas.map((c) => (c.w / total) * ANCHO);
  const TAM = 8; const LINEA = 10; const PAD = 4;

  function encabezadoTabla() {
    // Si una palabra del encabezado no cabe en la columna, se reduce la letra en vez de partirla
    const tams = rep.columnas.map((c, i) => { let tam = TAM; while (tam > 6 && c.t.split(' ').some((w) => anchoTexto(w, tam, true) > anchos[i] - 2 * PAD)) tam -= 0.5; return tam; });
    const lineas = rep.columnas.map((c, i) => partir(c.t, anchos[i] - 2 * PAD, tams[i], true, 2));
    const alto = Math.max(...lineas.map((l) => l.length)) * LINEA + 2 * PAD;
    rect(M, y - alto, ANCHO, alto, COLOR.petroleo);
    let x = M;
    lineas.forEach((ls, i) => {
      ls.forEach((l, k) => t(rep.columnas[i].num ? x + anchos[i] - PAD - anchoTexto(l, tams[i], true) : x + PAD, y - PAD - 8 - k * LINEA, l, tams[i], true, '1 1 1'));
      x += anchos[i];
    });
    y -= alto;
  }
  function nuevaPagina(primera) {
    ops = []; paginas.push(ops);
    rect(0, H - 6, W, 6, COLOR.turquesa);
    t(M, H - 40, 'Ofira', 18, true, COLOR.petroleo);
    t(M + anchoTexto('Ofira', 18, true) + 1, H - 40, '.', 18, true, COLOR.turquesa);
    t(M + 62, H - 40, rep.titulo, 14, true, COLOR.tinta);
    const der = 'Generado: ' + generado;
    t(W - M - anchoTexto(der, 8), H - 34, der, 8, false, COLOR.gris);
    const por = 'Por: ' + autor;
    t(W - M - anchoTexto(por, 8), H - 45, por, 8, false, COLOR.gris);
    ops.push(`${COLOR.dorado} RG 1.5 w ${M} ${H - 54} m ${W - M} ${H - 54} l S`);
    y = H - 70;
    if (primera) {
      partir(rep.descripcion, ANCHO, 9, false, 3).forEach((l) => { t(M, y, l, 9, false, COLOR.gris); y -= 12; });
      y -= 6;
      // Tarjetas de resumen
      const porFila = 5; const gap = 8; const cw = (ANCHO - gap * (porFila - 1)) / porFila; const ch = 38;
      rep.resumen.forEach(([k, v], i) => {
        const col = i % porFila;
        if (col === 0 && i > 0) y -= ch + gap;
        const x = M + col * (cw + gap);
        rect(x, y - ch, cw, ch, COLOR.fondo);
        rect(x, y - ch, 3, ch, COLOR.turquesa);
        t(x + 10, y - 14, partir(k, cw - 16, 7.5, false, 1)[0], 7.5, false, COLOR.gris);
        t(x + 10, y - 31, fmtValor(v, typeof v === 'number' && !Number.isInteger(v) ? { dinero: true } : null), 13, true, COLOR.petroleo);
      });
      y -= ch + 18;
      t(M, y, 'Detalle (' + rep.filas.length + (rep.filas.length === 1 ? ' registro)' : ' registros)'), 10, true, COLOR.petroleo);
      y -= 8;
    }
    encabezadoTabla();
  }

  nuevaPagina(true);
  if (!rep.filas.length) { t(M + PAD, y - 16, 'No hay registros para este reporte.', 9, false, COLOR.gris); }
  rep.filas.forEach((f, j) => {
    const celdas = f.map((v, i) => partir(fmtValor(v, rep.columnas[i]), anchos[i] - 2 * PAD, TAM, false, 4));
    const alto = Math.max(...celdas.map((l) => l.length)) * LINEA + 2 * PAD;
    if (y - alto < M + 20) nuevaPagina(false);
    if (j % 2) rect(M, y - alto, ANCHO, alto, COLOR.fondo);
    let x = M;
    celdas.forEach((ls, i) => {
      ls.forEach((l, k) => {
        const tx = rep.columnas[i].num ? x + anchos[i] - PAD - anchoTexto(l, TAM) : x + PAD;
        t(tx, y - PAD - 8 - k * LINEA, l, TAM);
      });
      x += anchos[i];
    });
    ops.push(`${COLOR.linea} RG 0.5 w ${M} ${(y - alto).toFixed(2)} m ${W - M} ${(y - alto).toFixed(2)} l S`);
    y -= alto;
  });

  // Pie de página con número de página
  paginas.forEach((p, i) => {
    ops = p;
    t(M, 20, 'Ofira · Encuentra, cotiza y contrata con confianza · Asunción Mita, Jutiapa', 7.5, false, COLOR.gris);
    const n = 'Página ' + (i + 1) + ' de ' + paginas.length;
    t(W - M - anchoTexto(n, 7.5), 20, n, 7.5, false, COLOR.gris);
  });

  // Ensamblar el archivo PDF
  const objetos = [];
  const agregar = (cuerpo) => { objetos.push(cuerpo); return objetos.length; };
  agregar('<< /Type /Catalog /Pages 2 0 R >>');
  agregar(null); // páginas, se llena al final
  agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const info = agregar(`<< /Title (${pdfTexto('Ofira · ' + rep.titulo)}) /Producer (Ofira) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`);
  const kids = [];
  paginas.forEach((p) => {
    const datos = zlib.deflateSync(Buffer.from(p.join('\n'), 'latin1'));
    const contenido = agregar({ dict: `<< /Length ${datos.length} /Filter /FlateDecode >>`, datos });
    kids.push(agregar(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contenido} 0 R >>`));
  });
  objetos[1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;

  const partes = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]; let pos = partes[0].length; const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(pos);
    const b = typeof o === 'string'
      ? Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1')
      : Buffer.concat([Buffer.from(`${i + 1} 0 obj\n${o.dict}\nstream\n`, 'latin1'), o.datos, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    partes.push(b); pos += b.length;
  });
  const xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  partes.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(partes);
}

const TIPOS = ['usuarios', 'prestadores', 'categorias', 'solicitudes', 'reclamos', 'general'];
const FILTROS = {
  prestadores: ['Pendiente de revisión', 'Verificado', 'Observado', 'Suspendido'],
  solicitudes: ['Solicitada', 'En evaluación', 'Pendiente de aprobación', 'Confirmada', 'Vencida', 'Cancelada']
};

/* Devuelve { nombre, tipo, datos } o null si el tipo no existe */
function generar(O, St, tipo, formato, filtro, autor) {
  if (!TIPOS.includes(tipo) || (formato !== 'pdf' && formato !== 'xlsx')) return null;
  const f = FILTROS[tipo] && FILTROS[tipo].includes(filtro) ? filtro : '';
  const rep = construir(O, St, tipo, f);
  const ahora = Date.now();
  const generado = fechaHora(ahora);
  const dia = new Date(ahora).toLocaleDateString('en-CA', { timeZone: ZONA });
  const nombre = 'Ofira_' + rep.titulo.split(' · ')[0].replace(/\s+/g, '_').normalize('NFD').replace(/[^\w]/g, '') + (f ? '_' + f.replace(/\s+/g, '_').normalize('NFD').replace(/[^\w]/g, '') : '') + '_' + dia + '.' + formato;
  return formato === 'pdf'
    ? { nombre, tipo: 'application/pdf', datos: pdf(rep, generado, autor) }
    : { nombre, tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', datos: xlsx(rep, generado, autor) };
}

module.exports = { generar, TIPOS };
