# Ofira

**Encuentra, cotiza y contrata con confianza.**
Plataforma web que conecta a clientes con fontaneros y electricistas verificados de Asunción Mita, Jutiapa.
Proyecto final de Análisis de Sistemas · Universidad Mariano Gálvez de Guatemala, campus Jutiapa.

---

## Cómo iniciarlo

**Requisito:** Node.js 22.13 o superior ([nodejs.org](https://nodejs.org)). No hay que instalar nada más: el sistema no usa librerías externas.

- **Windows:** doble clic en `Iniciar Ofira.bat`. Se abre el navegador en `http://localhost:3000`.
- **Desde la terminal:**

```bash
npm start
```

Deja la ventana abierta mientras lo usas. La primera vez se crea la base de datos con los datos iniciales.

**Desde un celular:** conecta el celular a la misma red WiFi que la computadora y abre la dirección que aparece en la ventana, por ejemplo `http://192.168.1.169:3000`.

**Volver a los datos iniciales:** cierra el servidor y ejecuta:

```bash
npm run reiniciar-datos
```

---

## Usuarios de prueba

Todas las cuentas usan la contraseña **`Ofira2026`**. Las personas son ficticias.

| Correo | Persona | Rol | Para qué sirve |
|---|---|---|---|
| ana@ofira.test | Ana Lucía Morales | Cliente | Cliente del casco urbano; tiene un servicio por calificar |
| jorge@ofira.test | Jorge Castillo | Cliente | Cliente de aldea; tiene un reclamo abierto |
| marco@ofira.test | Marco Antonio Pérez | Prestador · fontanería | Disponible ahora; tiene un servicio mañana por la mañana |
| edgar@ofira.test | Edgar Ramírez | Cliente y prestador | Cuenta con dos roles (cambia de modo desde el menú) |
| hugo@ofira.test | Hugo Méndez | Prestador · fontanería | No disponible ahora; solo mañanas |
| luis@ofira.test | Luis Fernando Aguilar | Prestador · electricidad | Diagnóstico con visita de Q 75 |
| oscar@ofira.test | Óscar Linares | Prestador · electricidad | Primer mes sin comisión; atiende tarde y noche |
| wilmer@ofira.test | Wilmer Sandoval | Prestador · electricidad | Pendiente de verificación |
| rosa@ofira.test | Rosa Elena Cruz | Prestador · carpintería | Oficio descrito en el documento |
| admin@ofira.test | Administración Ofira | Administrador | Panel, verificación, usuarios y reportes |
| soporte@ofira.test | Soporte Ofira | Soporte | Atención de reclamos |

> Antes de usarlo con personas reales, cambia la contraseña de `admin@ofira.test` y `soporte@ofira.test` desde **Cambiar contraseña**.

---

## Demostración sugerida (presentación)

1. **Servicio completo (fontanería inmediata).** Ana: Inicio → Fontanería → invita a Marco y Edgar → describe la fuga, agrega medidas y una foto → Enviar. En otra ventana o celular, Marco acepta y cotiza; Edgar también. Ana compara y aprueba la de Marco (la de Edgar se anula). Marco toca **Voy en camino**, inicia, registra avance y finaliza. Ambos se califican.
2. **Electricidad con diagnóstico.** Ana invita a Luis → Luis cotiza la visita → Ana aprueba → Luis inicia y envía la cotización del trabajo → Ana aprueba o rechaza (si rechaza, solo paga la visita).
3. **Excepción.** Marco rechaza una invitación → la solicitud queda Vencida → Ana la reenvía con un toque o la cancela. También se puede desconectar el WiFi para mostrar el aviso de “Sin conexión”.

Usa una ventana normal para un usuario y una **ventana de incógnito** (o un celular) para otro: cada una tiene su propia sesión.

---

## Reportes (administración)

En **Usuarios, Prestadores, Categorías, Solicitudes, Reclamos y Reportes** hay dos botones arriba a la derecha: **PDF** y **Excel**. El servidor arma el archivo con los datos del momento:

- **PDF:** encabezado de Ofira, fecha, quién lo generó, tarjetas de resumen y la tabla completa, con número de página.
- **Excel (.xlsx):** hoja con los datos (filtros y encabezado fijo) y una hoja **Resumen**.
- En Prestadores y Solicitudes, el reporte respeta el filtro de estado que esté elegido.
- Solo una cuenta de administración puede descargarlos, y cada descarga queda en la `bitacora`.

---

## Seguridad implementada

| Riesgo | Protección |
|---|---|
| Robo de contraseñas | Cifradas con **scrypt** y sal aleatoria. Nadie, ni administración, puede verlas. |
| Adivinar contraseñas | 5 intentos fallidos bloquean el inicio de sesión 15 minutos. Contraseñas de 8 caracteres con letras y números. |
| Inyección SQL | Todas las consultas son parametrizadas. |
| XSS (código en mensajes o formularios) | Todo texto se escapa antes de mostrarse y la política de contenido (CSP) bloquea scripts externos. |
| Robo de sesión / CSRF | Cookie **HttpOnly + SameSite=Strict** (+ Secure con HTTPS); el servidor exige una cabecera propia y revisa el origen. |
| Acceso a datos ajenos | El servidor revisa el rol y el dueño en **cada** acción, y cada cuenta recibe solo los datos que puede ver. |
| Privacidad | La dirección exacta solo la ve el prestador con servicio confirmado. El teléfono solo entre las partes. El DPI solo lo ve administración. |
| Archivos maliciosos | Solo imágenes JPG, PNG o WEBP, revisadas por su contenido real, máximo 3 MB, con nombre aleatorio. |
| Recuperación de cuenta | No revela si la cuenta existe. Administración verifica por teléfono y entrega una contraseña temporal que se debe cambiar al entrar. |
| Auditoría | Tabla `bitacora` con inicios de sesión, fallos, registros y cambios de contraseña. |

La prueba `tools/prueba_completa.py` comprueba 64 puntos, entre ellos los ataques de esta tabla.

---

## Base de datos

**SQLite** (incluida en Node 22), en `data/ofira.db`. Tablas principales, alineadas con el modelo entidad-relación:

`personas`, `cuentas`, `cuenta_roles`, `sectores`, `oficios`, `oficio_modalidades`, `especialidades`, `prestadores`, `prestador_especialidades` (con precio de referencia), `coberturas`, `disponibilidad`, `galeria`, `solicitudes`, `solicitud_fotos`, `invitaciones`, `cotizaciones`, `cotizacion_detalle`, `servicios`, `avances`, `historial`, `mensajes`, `calificaciones`, `reclamos`, `reclamo_evidencias`, `reclamo_notas`, `notificaciones`, `sesiones`, `archivos`, `recuperaciones`, `bitacora`.

Incluye llaves primarias y foráneas, restricciones `CHECK` en los estados y `UNIQUE` en correo, teléfono, folios y una calificación por parte. Cada cambio se guarda en una transacción.

**Respaldo:** copia la carpeta `data/` (base de datos y fotos) con el servidor detenido.

---

## Publicarlo en internet

- **Para una demostración rápida:** con el servidor encendido, `ngrok http 3000` da un enlace público con HTTPS que funciona mientras tu computadora esté encendida.
- **Para un lanzamiento real:** usa el `Dockerfile` incluido en un servicio con **disco permanente** (Railway con volumen, Render con disco, Fly.io con volumen o un VPS). Los planes sin disco permanente borran la base de datos en cada reinicio.

| Variable | Valor en la nube | Para qué |
|---|---|---|
| `DATA_DIR` | `/data` (donde se monta el volumen) | Base de datos y fotos |
| `TRUST_PROXY` | `1` | Cookie segura y IP real detrás del HTTPS del proveedor |
| `CLAVE_INICIAL` | una contraseña tuya (8+ caracteres, letras y números) | Contraseña de las cuentas iniciales; así no queda `Ofira2026` en internet |
| `PORT` | la pone el proveedor | Puerto del servidor |

`CLAVE_INICIAL` solo se usa la primera vez, al crear la base. Después, cada cuenta cambia su contraseña desde **Cambiar contraseña**.

---

## Estructura

```
public/   Pantallas (HTML, CSS y JavaScript). store.js también corre en el servidor.
server/   server.js (web y API), db.js (tablas), auth.js (contraseñas y sesiones),
          vista.js (qué ve cada cuenta), acciones.js (permisos de cada acción)
tools/    prueba_completa.py (prueba con varios usuarios y ataques), reiniciar-datos.js
data/     Base de datos y fotos (se crea al iniciar; no se comparte)
```

## Ubicación

Al crear una solicitud, el cliente puede tocar **Usar mi ubicación actual**. El navegador pide permiso y guarda las coordenadas del GPS. Si marca **Guardar esta dirección para la próxima vez**, la dirección y la ubicación quedan en su cuenta y se llenan solas en sus próximas solicitudes (puede borrarlas en **Mi perfil**).

El prestador recibe el botón **Cómo llegar (Google Maps)** solo cuando el servicio está confirmado; antes ve únicamente el sector.

> Los navegadores solo comparten la ubicación en sitios seguros: `http://localhost` en la computadora o un enlace **https** (por ejemplo, el de ngrok). Desde un celular con la dirección `http://192.168...` la ubicación no está disponible; la persona escribe la dirección y la referencia.

## Pendiente para una versión futura

- Avisos por SMS o WhatsApp (hoy los avisos están dentro de la app).
- Mapa dentro de la app con seguimiento en tiempo real (hoy se abre Google Maps con la ubicación).
- Carpintería y la modalidad por presupuesto.
- App móvil.
