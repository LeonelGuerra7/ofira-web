/* Ofira · Datos ficticios del prototipo.
 * Todas las personas, teléfonos y DPI son inventados. Ningún dato corresponde a personas reales.
 * Los nombres de entidades y estados siguen el vocabulario común del plan de trabajo (sección 01).
 */
(function () {
  'use strict';

  const MIN = 60 * 1000;
  const HORA = 60 * MIN;
  const DIA = 24 * HORA;

  // Reglas de negocio parametrizadas (plan de trabajo, sección 01)
  const REGLAS = {
    maxInvitaciones: 3,
    vencimiento: {
      // minutos
      inmediata: { invitacion: 30, cotizacion: 15 },
      otras: { invitacion: 24 * 60, cotizacion: 72 * 60 }
    },
    comision: 0.08, // 8 % sobre la mano de obra de servicios finalizados
    mesesSinComision: 1, // primer mes sin comisión
    diasParaCalificar: 7
  };

  const FRANJAS = [
    { id: 'manana', nombre: 'Mañana', horas: '7:00 a 12:00', desde: 7, hasta: 12 },
    { id: 'tarde', nombre: 'Tarde', horas: '12:00 a 17:00', desde: 12, hasta: 17 },
    { id: 'noche', nombre: 'Noche', horas: '17:00 a 21:00', desde: 17, hasta: 21 }
  ];

  // Motivos válidos de reclamo (los usa la pantalla y el servidor los valida)
  const MOTIVOS_RECLAMO_LISTA = ['Trabajo incompleto o con fallas', 'Cobro distinto a lo cotizado', 'No se presentó o llegó muy tarde', 'Daños durante el trabajo', 'Trato inadecuado', 'Otro'];

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const MODALIDADES = {
    inmediata: { id: 'inmediata', nombre: 'Inmediata', desc: 'Atención lo antes posible por alguien disponible ahora.' },
    programada: { id: 'programada', nombre: 'Programada', desc: 'Acuerdas día y franja horaria.' },
    diagnostico: { id: 'diagnostico', nombre: 'Diagnóstico', desc: 'Pagas la visita, el prestador revisa y cotiza el trabajo después.' },
    presupuesto: { id: 'presupuesto', nombre: 'Por presupuesto', desc: 'Apruebas alcance y precio antes de empezar.' }
  };

  // Lista fija de sectores de Asunción Mita, Jutiapa (casco urbano y aldeas).
  // El equipo puede ajustar esta lista en un solo lugar sin tocar el resto del prototipo.
  const SECTORES = [
    { id: 'sec-centro', nombre: 'Barrio El Centro', zona: 'Casco urbano' },
    { id: 'sec-calvario', nombre: 'Barrio El Calvario', zona: 'Casco urbano' },
    { id: 'sec-ermita', nombre: 'Barrio La Ermita', zona: 'Casco urbano' },
    { id: 'sec-sanjeronimo', nombre: 'Aldea San Jerónimo', zona: 'Aldea' },
    { id: 'sec-santacruz', nombre: 'Aldea Santa Cruz', zona: 'Aldea' },
    { id: 'sec-anguiatu', nombre: 'Aldea Anguiatú', zona: 'Aldea' },
    { id: 'sec-tiucal', nombre: 'Aldea Tiucal', zona: 'Aldea' }
  ];

  function semilla() {
    const ahora = Date.now();
    const hace = (ms) => ahora - ms;

    const oficios = [
      { id: 'of-fon', nombre: 'Fontanería', icono: 'drop', modalidades: ['inmediata', 'programada'], activo: true, enPrototipo: true },
      { id: 'of-ele', nombre: 'Electricidad', icono: 'bolt', modalidades: ['diagnostico'], activo: true, enPrototipo: true },
      { id: 'of-car', nombre: 'Carpintería', icono: 'saw', modalidades: ['presupuesto'], activo: true, enPrototipo: false }
    ];

    const especialidades = [
      { id: 'esp-fugas', oficioId: 'of-fon', nombre: 'Reparación de fugas' },
      { id: 'esp-mant', oficioId: 'of-fon', nombre: 'Mantenimiento de tuberías' },
      { id: 'esp-tinaco', oficioId: 'of-fon', nombre: 'Instalación de tinacos y bombas' },
      { id: 'esp-inst', oficioId: 'of-ele', nombre: 'Instalación eléctrica' },
      { id: 'esp-falla', oficioId: 'of-ele', nombre: 'Fallas y cortocircuitos' },
      { id: 'esp-tablero', oficioId: 'of-ele', nombre: 'Tableros y breakers' },
      { id: 'esp-muebles', oficioId: 'of-car', nombre: 'Muebles a medida' },
      { id: 'esp-puertas', oficioId: 'of-car', nombre: 'Puertas y ventanas' }
    ];

    const personas = [
      { id: 'per-1', nombre: 'Ana Lucía Morales', telefono: '5550-1201', dpi: '0000 00001 0101' },
      { id: 'per-2', nombre: 'Jorge Castillo', telefono: '5550-1202', dpi: '0000 00002 0101' },
      { id: 'per-3', nombre: 'Marco Antonio Pérez', telefono: '5550-2301', dpi: '0000 00003 0101' },
      { id: 'per-4', nombre: 'Edgar Ramírez', telefono: '5550-2302', dpi: '0000 00004 0101' },
      { id: 'per-5', nombre: 'Hugo Méndez', telefono: '5550-2303', dpi: '0000 00005 0101' },
      { id: 'per-6', nombre: 'Luis Fernando Aguilar', telefono: '5550-3401', dpi: '0000 00006 0101' },
      { id: 'per-7', nombre: 'Óscar Linares', telefono: '5550-3402', dpi: '0000 00007 0101' },
      { id: 'per-8', nombre: 'Wilmer Sandoval', telefono: '5550-3403', dpi: '0000 00008 0101' },
      { id: 'per-9', nombre: 'Rosa Elena Cruz', telefono: '5550-4501', dpi: '0000 00009 0101' },
      { id: 'per-10', nombre: 'Administración Ofira', telefono: '5550-9001', dpi: '' },
      { id: 'per-11', nombre: 'Soporte Ofira', telefono: '5550-9002', dpi: '' }
    ];

    const CLAVE = 'Ofira2026';
    const cuentas = [
      { id: 'cta-ana', personaId: 'per-1', correo: 'ana@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['cliente'], estado: 'Activa', sectorId: 'sec-centro', creada: hace(120 * DIA) },
      { id: 'cta-jorge', personaId: 'per-2', correo: 'jorge@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['cliente'], estado: 'Activa', sectorId: 'sec-sanjeronimo', creada: hace(200 * DIA) },
      { id: 'cta-marco', personaId: 'per-3', correo: 'marco@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['prestador'], estado: 'Activa', sectorId: 'sec-calvario', creada: hace(400 * DIA) },
      { id: 'cta-edgar', personaId: 'per-4', correo: 'edgar@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['cliente', 'prestador'], estado: 'Activa', sectorId: 'sec-santacruz', creada: hace(300 * DIA) },
      { id: 'cta-hugo', personaId: 'per-5', correo: 'hugo@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['prestador'], estado: 'Activa', sectorId: 'sec-centro', creada: hace(250 * DIA) },
      { id: 'cta-luis', personaId: 'per-6', correo: 'luis@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['prestador'], estado: 'Activa', sectorId: 'sec-centro', creada: hace(380 * DIA) },
      { id: 'cta-oscar', personaId: 'per-7', correo: 'oscar@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['prestador'], estado: 'Activa', sectorId: 'sec-anguiatu', creada: hace(20 * DIA) },
      { id: 'cta-wilmer', personaId: 'per-8', correo: 'wilmer@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['prestador'], estado: 'Activa', sectorId: 'sec-ermita', creada: hace(1 * DIA) },
      { id: 'cta-rosa', personaId: 'per-9', correo: 'rosa@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['prestador'], estado: 'Activa', sectorId: 'sec-centro', creada: hace(150 * DIA) },
      { id: 'cta-admin', personaId: 'per-10', correo: 'admin@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['administrador'], estado: 'Activa', sectorId: null, creada: hace(500 * DIA) },
      { id: 'cta-soporte', personaId: 'per-11', correo: 'soporte@ofira.test', clave: CLAVE, debeCambiarClave: false, roles: ['soporte'], estado: 'Activa', sectorId: null, creada: hace(500 * DIA) }
    ];

    const todosLosDias = [1, 2, 3, 4, 5, 6];
    const prestadores = [
      {
        id: 'pre-marco', cuentaId: 'cta-marco', oficioId: 'of-fon', especialidades: ['esp-fugas', 'esp-mant'],
        experiencia: 12, descripcion: 'Fontanero con 12 años en Asunción Mita. Reparo fugas, cambio tubería y doy mantenimiento a tinacos.',
        cobertura: ['sec-centro', 'sec-calvario', 'sec-ermita'], disponibilidad: { dias: todosLosDias, franjas: ['manana', 'tarde', 'noche'] },
        disponibleAhora: true, estadoVerificacion: 'Verificado', referencia: 'Ferretería del barrio (referencia de trabajo revisada)',
        costoVisita: 0, condiciones: 'Llevo herramienta básica. Los materiales se cotizan aparte y se compran con tu aprobación.', alta: hace(400 * DIA), precios: { 'esp-fugas': 100, 'esp-mant': 120 }, galeria: [], dpiArchivo: ''
      },
      {
        id: 'pre-edgar', cuentaId: 'cta-edgar', oficioId: 'of-fon', especialidades: ['esp-fugas', 'esp-tinaco'],
        experiencia: 6, descripcion: 'Instalo tinacos, bombas y reparo fugas en casco urbano y Santa Cruz.',
        cobertura: ['sec-centro', 'sec-santacruz'], disponibilidad: { dias: todosLosDias, franjas: ['manana', 'tarde', 'noche'] },
        disponibleAhora: true, estadoVerificacion: 'Verificado', referencia: 'Constructora local (referencia revisada)',
        costoVisita: 0, condiciones: 'Atiendo emergencias de fuga. Los materiales se pagan contra factura.', alta: hace(300 * DIA), precios: { 'esp-fugas': 90, 'esp-tinaco': 250 }, galeria: [], dpiArchivo: ''
      },
      {
        id: 'pre-hugo', cuentaId: 'cta-hugo', oficioId: 'of-fon', especialidades: ['esp-mant'],
        experiencia: 9, descripcion: 'Mantenimiento preventivo de tuberías y drenajes.',
        cobertura: ['sec-centro', 'sec-calvario'], disponibilidad: { dias: [1, 2, 3, 4, 5], franjas: ['manana'] },
        disponibleAhora: false, estadoVerificacion: 'Verificado', referencia: 'Cliente comercial (referencia revisada)',
        costoVisita: 0, condiciones: 'Solo trabajos programados por la mañana.', alta: hace(250 * DIA), precios: { 'esp-mant': 110 }, galeria: [], dpiArchivo: ''
      },
      {
        id: 'pre-luis', cuentaId: 'cta-luis', oficioId: 'of-ele', especialidades: ['esp-falla', 'esp-tablero', 'esp-inst'],
        experiencia: 15, descripcion: 'Electricista residencial y comercial. Diagnóstico de fallas, cortocircuitos y cambio de tableros.',
        cobertura: ['sec-centro', 'sec-calvario', 'sec-ermita', 'sec-sanjeronimo'], disponibilidad: { dias: todosLosDias, franjas: ['manana', 'tarde'] },
        disponibleAhora: true, estadoVerificacion: 'Verificado', referencia: 'Comedor del parque central (referencia revisada)',
        costoVisita: 75, condiciones: 'La visita de diagnóstico cuesta Q 75.00. Después de revisar te envío la cotización del trabajo.', alta: hace(380 * DIA), precios: { 'esp-falla': 150, 'esp-tablero': 400, 'esp-inst': 200 }, galeria: [], dpiArchivo: ''
      },
      {
        id: 'pre-oscar', cuentaId: 'cta-oscar', oficioId: 'of-ele', especialidades: ['esp-inst', 'esp-falla'],
        experiencia: 4, descripcion: 'Instalaciones eléctricas nuevas y reparación de fallas.',
        cobertura: ['sec-centro', 'sec-anguiatu', 'sec-santacruz'], disponibilidad: { dias: todosLosDias, franjas: ['tarde', 'noche'] },
        disponibleAhora: true, estadoVerificacion: 'Verificado', referencia: 'Tienda de abarrotes (referencia revisada)',
        costoVisita: 60, condiciones: 'Visita de diagnóstico Q 60.00. Trabajo con materiales certificados.', alta: hace(20 * DIA), precios: { 'esp-inst': 180, 'esp-falla': 140 }, galeria: [], dpiArchivo: ''
      },
      {
        id: 'pre-wilmer', cuentaId: 'cta-wilmer', oficioId: 'of-ele', especialidades: ['esp-inst'],
        experiencia: 3, descripcion: 'Electricista recién registrado en Ofira.',
        cobertura: ['sec-ermita', 'sec-centro'], disponibilidad: { dias: todosLosDias, franjas: ['manana', 'tarde'] },
        disponibleAhora: true, estadoVerificacion: 'Pendiente de revisión', referencia: 'Taller eléctrico (pendiente de llamar)',
        costoVisita: 50, condiciones: 'Visita Q 50.00.', alta: hace(1 * DIA), precios: { 'esp-inst': 150 }, galeria: [], dpiArchivo: ''
      },
      {
        id: 'pre-rosa', cuentaId: 'cta-rosa', oficioId: 'of-car', especialidades: ['esp-muebles', 'esp-puertas'],
        experiencia: 10, descripcion: 'Carpintera. Muebles a medida, closets y puertas.',
        cobertura: ['sec-centro', 'sec-calvario', 'sec-ermita'], disponibilidad: { dias: todosLosDias, franjas: ['manana', 'tarde'] },
        disponibleAhora: false, estadoVerificacion: 'Verificado', referencia: 'Mueblería local (referencia revisada)',
        costoVisita: 0, condiciones: 'Trabajo por presupuesto: primero acordamos alcance y precio.', alta: hace(150 * DIA), precios: { 'esp-muebles': 800, 'esp-puertas': 600 }, galeria: [], dpiArchivo: ''
      }
    ];

    // Historial previo para que los perfiles tengan calificaciones y el panel tenga indicadores
    const solicitudes = [];
    const invitaciones = [];
    const cotizaciones = [];
    const servicios = [];
    const historial = [];
    const calificaciones = [];
    const reclamos = [];
    const mensajes = [];
    let n = 0;

    function hist(objeto, objetoId, estado, fecha, actor, nota) {
      historial.push({ id: 'his-s' + (++n), objeto, objetoId, estado, fecha, actor, nota: nota || '' });
    }

    function servicioPasado(o) {
      // o: {num, cliente, prestador, oficio, esp, modalidad, sector, desc, diasAtras, mano, mat, cargos, estrellas, comentario, estrellasCliente}
      const ini = hace(o.diasAtras * DIA);
      const sol = {
        id: 'sol-h' + o.num, folio: 'SOL-0' + (100 + o.num), clienteCuentaId: o.cliente, oficioId: o.oficio, especialidadId: o.esp,
        modalidad: o.modalidad, descripcion: o.desc, sectorId: o.sector, direccion: o.direccion || 'Casa con portón verde, frente a la tienda',
        referencia: '', medidas: '', horario: { tipo: 'programado', fecha: diaISO(ini), franja: 'manana' }, fotos: [], estado: 'Confirmada', creada: ini, clave: 'seed-' + o.num
      };
      solicitudes.push(sol);
      const inv = { id: 'inv-h' + o.num, solicitudId: sol.id, prestadorId: o.prestador, estado: 'Aceptada', enviada: ini, venceEn: ini + DIA, respondida: ini + 25 * MIN, motivo: '' };
      invitaciones.push(inv);
      const cot = {
        id: 'cot-h' + o.num, folio: 'COT-0' + (100 + o.num), solicitudId: sol.id, servicioId: null, prestadorId: o.prestador, tipo: 'trabajo',
        lineas: [
          { categoria: 'mano_obra', concepto: 'Mano de obra', monto: o.mano },
          ...(o.mat ? [{ categoria: 'materiales', concepto: 'Materiales', monto: o.mat }] : []),
          ...(o.cargos ? [{ categoria: 'cargos', concepto: 'Transporte', monto: o.cargos }] : [])
        ],
        nota: '', tiempoEstimado: '2 horas', estado: 'Aprobada', creada: ini + 40 * MIN, enviada: ini + 40 * MIN, venceEn: ini + 3 * DIA
      };
      cotizaciones.push(cot);
      const srv = {
        id: 'srv-h' + o.num, folio: 'SRV-0' + (100 + o.num), solicitudId: sol.id, clienteCuentaId: o.cliente, prestadorId: o.prestador,
        cotizacionId: cot.id, estado: o.estado || 'Finalizado', creado: ini + 2 * HORA, horario: { fecha: diaISO(ini), franja: 'manana' },
        avances: [{ fecha: ini + 26 * HORA, texto: 'Trabajo terminado y probado.' }],
        pago: { estado: 'Pagado', metodo: 'Efectivo', fecha: ini + 26 * HORA }, finalizado: ini + 26 * HORA, soloVisita: false, motivoCancelacion: '', enCamino: null
      };
      cot.servicioId = null;
      servicios.push(srv);
      hist('Solicitud', sol.id, 'Solicitada', ini, o.cliente);
      hist('Solicitud', sol.id, 'En evaluación', ini + 25 * MIN, prestadorCuenta(o.prestador));
      hist('Solicitud', sol.id, 'Pendiente de aprobación', ini + 40 * MIN, prestadorCuenta(o.prestador));
      hist('Cotización', cot.id, 'Enviada', ini + 40 * MIN, prestadorCuenta(o.prestador));
      hist('Cotización', cot.id, 'Aprobada', ini + 2 * HORA, o.cliente);
      hist('Solicitud', sol.id, 'Confirmada', ini + 2 * HORA, o.cliente);
      hist('Servicio', srv.id, 'Confirmado', ini + 2 * HORA, 'Sistema');
      hist('Servicio', srv.id, 'En ejecución', ini + 24 * HORA, prestadorCuenta(o.prestador));
      if (srv.estado === 'Finalizado') hist('Servicio', srv.id, 'Finalizado', ini + 26 * HORA, prestadorCuenta(o.prestador));
      if (o.estrellas) {
        calificaciones.push({ id: 'cal-h' + o.num + 'a', servicioId: srv.id, deCuentaId: o.cliente, aCuentaId: prestadorCuenta(o.prestador), estrellas: o.estrellas, comentario: o.comentario || '', fecha: ini + 27 * HORA, publicada: o.publicada !== false });
      }
      if (o.estrellasCliente) {
        calificaciones.push({ id: 'cal-h' + o.num + 'b', servicioId: srv.id, deCuentaId: prestadorCuenta(o.prestador), aCuentaId: o.cliente, estrellas: o.estrellasCliente, comentario: '', fecha: ini + 27 * HORA, publicada: true });
      }
      return srv;
    }

    function prestadorCuenta(pid) {
      return prestadores.find((p) => p.id === pid).cuentaId;
    }

    servicioPasado({ num: 1, cliente: 'cta-jorge', prestador: 'pre-marco', oficio: 'of-fon', esp: 'esp-fugas', modalidad: 'programada', sector: 'sec-calvario', desc: 'Fuga debajo del lavatrastos.', diasAtras: 40, mano: 150, mat: 45, estrellas: 5, comentario: 'Llegó puntual y explicó todo antes de cobrar.', estrellasCliente: 5 });
    servicioPasado({ num: 2, cliente: 'cta-edgar', prestador: 'pre-marco', oficio: 'of-fon', esp: 'esp-mant', modalidad: 'programada', sector: 'sec-centro', desc: 'Cambio de llave de paso.', diasAtras: 25, mano: 120, mat: 80, estrellas: 5, comentario: 'Trabajo limpio.', estrellasCliente: 5 });
    servicioPasado({ num: 3, cliente: 'cta-jorge', prestador: 'pre-marco', oficio: 'of-fon', esp: 'esp-fugas', modalidad: 'programada', sector: 'sec-centro', desc: 'Goteo en el baño.', diasAtras: 12, mano: 100, mat: 20, estrellas: 4, comentario: 'Bien, aunque tardó en conseguir el repuesto.', estrellasCliente: 5 });
    servicioPasado({ num: 4, cliente: 'cta-jorge', prestador: 'pre-luis', oficio: 'of-ele', esp: 'esp-falla', modalidad: 'diagnostico', sector: 'sec-sanjeronimo', desc: 'Se bajaba el breaker al conectar la refrigeradora.', diasAtras: 30, mano: 275, mat: 160, cargos: 25, estrellas: 5, comentario: 'Encontró la falla rápido.', estrellasCliente: 4 });
    servicioPasado({ num: 5, cliente: 'cta-edgar', prestador: 'pre-luis', oficio: 'of-ele', esp: 'esp-tablero', modalidad: 'diagnostico', sector: 'sec-centro', desc: 'Cambio de tablero.', diasAtras: 15, mano: 350, mat: 420, estrellas: 4, comentario: 'Buen trabajo, precio justo.', estrellasCliente: 5 });
    servicioPasado({ num: 6, cliente: 'cta-ana', prestador: 'pre-edgar', oficio: 'of-fon', esp: 'esp-tinaco', modalidad: 'programada', sector: 'sec-centro', desc: 'Limpieza y revisión del tinaco.', diasAtras: 60, mano: 180, mat: 0, estrellas: 4, comentario: 'Cumplió con lo acordado.', estrellasCliente: 5 });
    // Servicio finalizado hace 2 días, sin calificar todavía (para demostrar la calificación)
    servicioPasado({ num: 7, cliente: 'cta-ana', prestador: 'pre-hugo', oficio: 'of-fon', esp: 'esp-mant', modalidad: 'programada', sector: 'sec-centro', desc: 'Mantenimiento de la tubería del patio.', diasAtras: 3, mano: 140, mat: 35 });
    // Servicio finalizado con reclamo abierto: la calificación queda guardada pero sin publicar
    const srvReclamo = servicioPasado({ num: 8, cliente: 'cta-jorge', prestador: 'pre-oscar', oficio: 'of-ele', esp: 'esp-inst', modalidad: 'diagnostico', sector: 'sec-centro', desc: 'Instalación de dos tomacorrientes.', diasAtras: 4, mano: 200, mat: 90, estrellas: 2, comentario: 'Uno de los tomacorrientes no funciona.', publicada: false });
    reclamos.push({
      id: 'rec-1', folio: 'REC-0101', servicioId: srvReclamo.id, abiertoPor: 'cta-jorge', motivo: 'Trabajo incompleto o con fallas',
      descripcion: 'Uno de los dos tomacorrientes instalados no da corriente. El prestador dice que ya no le corresponde.',
      evidencia: [], estado: 'Abierto', creado: hace(2 * DIA), resolucion: '', notas: []
    });
    hist('Reclamo', 'rec-1', 'Abierto', hace(2 * DIA), 'cta-jorge');
    mensajes.push({ id: 'msg-s1', solicitudId: 'sol-h8', prestadorId: 'pre-oscar', deCuentaId: 'cta-jorge', texto: 'Buenas, uno de los tomacorrientes no funciona.', foto: '', fecha: hace(2 * DIA + HORA) });
    mensajes.push({ id: 'msg-s2', solicitudId: 'sol-h8', prestadorId: 'pre-oscar', deCuentaId: 'cta-oscar', texto: 'Cuando me fui los dos funcionaban.', foto: '', fecha: hace(2 * DIA) });

    // Servicio confirmado de Marco para mañana por la mañana (sirve para mostrar la regla de franja ocupada)
    const manana = ahora + DIA;
    solicitudes.push({
      id: 'sol-h9', folio: 'SOL-0109', clienteCuentaId: 'cta-jorge', oficioId: 'of-fon', especialidadId: 'esp-mant', modalidad: 'programada',
      descripcion: 'Revisión general de tuberías antes de pintar.', medidas: '', sectorId: 'sec-calvario', direccion: '3a. calle, casa esquinera color celeste', referencia: '',
      horario: { tipo: 'programado', fecha: diaISO(manana), franja: 'manana' }, fotos: [], estado: 'Confirmada', creada: hace(5 * HORA), clave: 'seed-9'
    });
    invitaciones.push({ id: 'inv-h9', solicitudId: 'sol-h9', prestadorId: 'pre-marco', estado: 'Aceptada', enviada: hace(5 * HORA), venceEn: hace(5 * HORA) + DIA, respondida: hace(4 * HORA), motivo: '' });
    cotizaciones.push({
      id: 'cot-h9', folio: 'COT-0109', solicitudId: 'sol-h9', servicioId: null, prestadorId: 'pre-marco', tipo: 'trabajo',
      lineas: [{ categoria: 'mano_obra', concepto: 'Revisión general', monto: 125 }], nota: '', tiempoEstimado: '3 horas',
      estado: 'Aprobada', creada: hace(4 * HORA), enviada: hace(4 * HORA), venceEn: hace(4 * HORA) + 3 * DIA
    });
    servicios.push({
      id: 'srv-h9', folio: 'SRV-0109', solicitudId: 'sol-h9', clienteCuentaId: 'cta-jorge', prestadorId: 'pre-marco', cotizacionId: 'cot-h9',
      estado: 'Confirmado', creado: hace(3 * HORA), horario: { fecha: diaISO(manana), franja: 'manana' }, avances: [],
      pago: { estado: 'Pendiente', metodo: '', fecha: null }, finalizado: null, soloVisita: false, motivoCancelacion: '', enCamino: null
    });
    hist('Solicitud', 'sol-h9', 'Solicitada', hace(5 * HORA), 'cta-jorge');
    hist('Solicitud', 'sol-h9', 'Confirmada', hace(3 * HORA), 'cta-jorge');
    hist('Servicio', 'srv-h9', 'Confirmado', hace(3 * HORA), 'Sistema');

    const notificaciones = [
      { id: 'not-s1', cuentaId: 'cta-ana', titulo: 'Califica tu servicio', texto: 'Hugo Méndez finalizó el mantenimiento. Tienes 7 días para calificarlo.', fecha: hace(3 * DIA - 26 * HORA), leida: false, ir: 'c/servicio/srv-h7' },
      { id: 'not-s2', cuentaId: 'cta-soporte', titulo: 'Nuevo reclamo REC-0101', texto: 'Trabajo incompleto o con fallas · SRV-0108', fecha: hace(2 * DIA), leida: false, ir: 's/reclamo/rec-1' },
      { id: 'not-s3', cuentaId: 'cta-admin', titulo: 'Prestador pendiente de revisión', texto: 'Wilmer Sandoval envió su DPI y una referencia de trabajo.', fecha: hace(1 * DIA), leida: false, ir: 'a/prestador/pre-wilmer' }
    ];

    return {
      version: 3,
      clockOffset: 0,
      seq: { SOL: 0, COT: 0, SRV: 0, REC: 0, id: 1000 }, // los ids nuevos empiezan en 1001 para no chocar con los de la semilla
      oficios, especialidades, personas, cuentas, prestadores,
      solicitudes, invitaciones, cotizaciones, servicios, historial,
      mensajes, calificaciones, reclamos, notificaciones
    };
  }

  function diaISO(ms) {
    const d = new Date(ms);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + dd;
  }

  window.Ofira = window.Ofira || {};
  Object.assign(window.Ofira, { MOTIVOS_RECLAMO_LISTA, REGLAS, FRANJAS, DIAS, MODALIDADES, SECTORES, semilla, diaISO, MIN, HORA, DIA });
})();
