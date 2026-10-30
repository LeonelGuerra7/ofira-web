"""Ofira · Prueba completa del sitio con servidor.

Levanta el servidor con una base de datos temporal, abre un navegador distinto para cada persona
(cada uno con su propia sesión) y recorre los flujos reales. También intenta ataques comunes para
comprobar que la seguridad responde.

Uso: python tools/prueba_completa.py [carpeta de capturas]
"""
import os
import sys
import json
import time
import shutil
import struct
import zlib
import sqlite3
import tempfile
import subprocess
import urllib.request
import pathlib
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CAPTURAS = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
if CAPTURAS:
    CAPTURAS.mkdir(parents=True, exist_ok=True)
PUERTO = 3077
URL = f"http://localhost:{PUERTO}"
DATOS = pathlib.Path(tempfile.mkdtemp(prefix="ofira-prueba-"))
CLAVE = "Ofira2026"

resultados, errores = [], []


def check(cond, texto):
    resultados.append((bool(cond), texto))
    print(("  OK  " if cond else "  FALLA ") + texto)


def png(ruta, ancho=60, alto=40, color=(18, 168, 157)):
    filas = b"".join(b"\x00" + bytes(color) * ancho for _ in range(alto))
    def bloque(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    ruta.write_bytes(b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0)) + bloque(b"IDAT", zlib.compress(filas)) + bloque(b"IEND", b""))
    return str(ruta)


FOTO = png(DATOS / "foto.png")
DPI = png(DATOS / "dpi.png", 80, 50, (200, 200, 200))


def iniciar_servidor():
    try:
        urllib.request.urlopen(URL + "/api/estado", timeout=1)
        raise SystemExit("El puerto %d ya está en uso por otro servidor. Ciérralo y vuelve a correr la prueba." % PUERTO)
    except urllib.error.URLError:
        pass
    env = dict(os.environ, PORT=str(PUERTO), DATA_DIR=str(DATOS / "data"))
    p = subprocess.Popen(["node", "--disable-warning=ExperimentalWarning", "server/server.js"], cwd=RAIZ, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8")
    for _ in range(80):
        try:
            urllib.request.urlopen(URL + "/api/estado", timeout=1)
            return p
        except Exception:
            time.sleep(0.25)
    raise SystemExit("El servidor no arrancó:\n" + (p.stdout.read() if p.stdout else ""))


def api(metodo, ruta, cuerpo=None, cabeceras=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    h = {"Content-Type": "application/json", "X-Requested-With": "ofira"}
    h.update(cabeceras or {})
    req = urllib.request.Request(URL + ruta, data=datos, method=metodo, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def main():
    proceso = iniciar_servidor()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome")
            paginas = {}

            def persona(nombre, ancho=1440, alto=900, gps=None):
                extra = {"geolocation": gps, "permissions": ["geolocation"]} if gps else {}
                ctx = b.new_context(viewport={"width": ancho, "height": alto}, device_scale_factor=1, locale="es-GT", **extra)
                pg = ctx.new_page()
                pg.on("console", lambda m, n=nombre: errores.append(f"[{n}] {m.text}") if m.type == "error" and "status of 4" not in m.text else None)
                pg.on("pageerror", lambda e, n=nombre: errores.append(f"[{n}] {e}"))
                pg.goto(URL)
                pg.wait_for_selector(".welcome")
                paginas[nombre] = pg
                return pg

            def entrar(pg, correo, clave=CLAVE, espera="#sidebar .sb-item"):
                if not pg.locator("#acc-correo").count():
                    pg.click("#btn-ir-acceso")
                pg.fill("#acc-correo", correo)
                pg.fill("#acc-clave", clave)
                pg.click("#btn-entrar")
                pg.wait_for_selector(espera, timeout=10000)

            def esperar(pg, cond_js, ms=15000):
                pg.wait_for_function(f"(async () => {{ await Ofira.Api.estado(); Ofira.App.render(); return {cond_js}; }})()", timeout=ms, polling=1000)

            def foto(pg, nombre):
                if CAPTURAS:
                    pg.wait_for_timeout(200)
                    pg.evaluate("document.getElementById('toast').innerHTML = ''")
                    pg.screenshot(path=str(CAPTURAS / f"{nombre}.png"))

            ev = lambda pg, js: pg.evaluate(js)
            ir = lambda pg, ruta: pg.evaluate(f"Ofira.App.go({ruta!r})")

            def ok_modal(pg):
                pg.click("#modal-btn-si")
                pg.wait_for_timeout(400)

            # ================= 1. Sitio público =================
            print("\n[1] Sitio público y acceso")
            ana = persona("Ana", gps={"latitude": 14.33352, "longitude": -89.71605, "accuracy": 18})
            check(ana.locator("#demo-fab, .demo").count() == 0, "Ya no existe el panel de demostración")
            check("Encuentra, cotiza y contrata con confianza" in ana.inner_text("body"), "Eslogan en la portada")
            foto(ana, "01-portada")
            ana.click("#btn-ir-acceso")
            check("ana@ofira.test" not in ana.inner_text("body"), "La pantalla de acceso ya no muestra usuarios de prueba")
            ana.fill("#acc-correo", "ana@ofira.test"); ana.fill("#acc-clave", "incorrecta1"); ana.click("#btn-entrar")
            ana.wait_for_selector(".note-bad")
            check("no coinciden" in ana.inner_text("#screen"), "Contraseña incorrecta muestra error genérico")
            entrar(ana, "ana@ofira.test")
            check(ev(ana, "Ofira.App.rol()") == "cliente", "Ana inicia sesión contra el servidor")
            foto(ana, "02-cliente-inicio")

            # ================= 2. Solicitud con foto real =================
            print("\n[2] Cliente busca y solicita (foto real)")
            ana.click("#oficio-of-fon")
            ana.wait_for_selector(".pcard")
            check("Desde Q 100.00" in ana.inner_text("#screen"), "Resultados muestran precio de referencia (mejora de entrevistas)")
            ana.click("button[data-go='c/prestador/pre-marco']")
            check("Especialidades y precios" in ana.inner_text("#screen") and "Trabajos anteriores" in ana.inner_text("#screen"), "Perfil con precios y sección de trabajos anteriores")
            ana.click("#btn-atras")
            ana.check("#sel-pre-marco"); ana.check("#sel-pre-edgar")
            ana.click("#btn-continuar")
            ana.select_option("#sol-esp", "esp-fugas")
            ana.fill("#sol-desc", "Sale agua debajo del lavatrastos desde esta mañana.")
            ana.fill("#sol-dir", "4a. avenida 3-15, casa de dos niveles")
            ana.fill("#sol-medidas", "Tubo de 1/2 pulgada")
            ana.click("#btn-ubicacion")
            ana.wait_for_selector("text=Ubicación agregada", timeout=10000)
            check("precisión aprox. 18 m" in ana.inner_text("#bloque-ubicacion"), "Ana agrega su ubicación actual del GPS")
            ana.set_input_files("#sol-fotos", FOTO)
            ana.wait_for_selector(".thumb img", timeout=10000)
            check(ana.locator(".thumb img").count() == 1, "La foto se sube al servidor y se muestra")
            foto(ana, "03-solicitud")
            ana.click("#btn-enviar-solicitud")
            ana.wait_for_selector(".done")
            sol = ev(ana, "Ofira.Store.S.solicitudes.slice(-1)[0].id")
            check(ev(ana, f"Ofira.Store.solicitud('{sol}').estado") == "Solicitada", "Solicitud guardada en la base de datos")

            # ================= 3. Prestadores en sus propios navegadores =================
            print("\n[3] Prestadores reciben y cotizan (otras sesiones)")
            marco = persona("Marco"); entrar(marco, "marco@ofira.test")
            inv = ev(marco, f"Ofira.Store.S.invitaciones.find(i => i.solicitudId === '{sol}').id")
            check(bool(inv), "Marco recibe la invitación en su propio navegador")
            check(ev(marco, f"Ofira.Store.solicitud('{sol}').direccion") == "", "El servidor NO envía la dirección al prestador antes de confirmar")
            check(ev(marco, f"Ofira.Store.solicitud('{sol}').ubicacion") is None, "El servidor NO envía la ubicación del GPS antes de confirmar")
            check(ev(marco, f"Ofira.Store.solicitud('{sol}').medidas") == "Tubo de 1/2 pulgada", "El prestador ve las medidas (mejora de entrevistas)")
            marco.click(f"#inv-{inv}")
            check(marco.locator(".thumb img").count() == 1, "El prestador ve la foto del cliente")
            foto(marco, "04-prestador-invitacion")
            marco.click("#btn-aceptar-inv")
            marco.click("#btn-preparar-cot")
            marco.fill("#l-c-0", "Cambio del tubo bajo el lavatrastos"); marco.fill("#l-m-0", "150")
            marco.fill("#l-c-1", "Tubo PVC 1/2 y codos"); marco.fill("#l-m-1", "65")
            marco.click("#add-cargos"); marco.fill("#l-c-2", "Transporte"); marco.fill("#l-m-2", "10")
            marco.click("#btn-enviar-cot")
            marco.wait_for_selector(".est")
            edgar = persona("Edgar"); entrar(edgar, "edgar@ofira.test")
            edgar.click("#sb-modo-prestador"); edgar.wait_for_selector("#nav-solicitudes")
            check(True, "Una cuenta con dos roles cambia a modo prestador desde el menú")
            inv_e = ev(edgar, f"Ofira.Store.S.invitaciones.find(i => i.solicitudId === '{sol}').id")
            ir(edgar, f"p/invitacion/{inv_e}")
            edgar.click("#btn-aceptar-inv"); edgar.click("#btn-preparar-cot")
            edgar.fill("#l-c-0", "Reparación de la fuga"); edgar.fill("#l-m-0", "140")
            edgar.click("#btn-enviar-cot")
            edgar.wait_for_selector(".est")
            check(ev(edgar, f"Ofira.Store.S.cotizaciones.filter(c => c.solicitudId === '{sol}').length") == 1, "Edgar NO ve la cotización de Marco (privacidad entre prestadores)")

            # ================= 4. Cliente aprueba =================
            print("\n[4] Cliente compara y aprueba")
            esperar(ana, f"Ofira.Store.S.cotizaciones.filter(c => c.solicitudId === '{sol}' && c.estado === 'Enviada').length === 2")
            check(True, "Ana recibe las 2 cotizaciones sin recargar la página (actualización automática)")
            c_marco = ev(ana, f"Ofira.Store.S.cotizaciones.find(c => c.solicitudId === '{sol}' && c.prestadorId === 'pre-marco').id")
            ir(ana, f"c/cotizacion/{c_marco}")
            foto(ana, "05-cotizacion")
            ana.click("#btn-aprobar-cot"); ok_modal(ana)
            ana.wait_for_selector(".stepper")
            srv = ev(ana, f"Ofira.Store.servicioDeSolicitud('{sol}').id")
            check(ev(ana, f"Ofira.Store.S.cotizaciones.find(c => c.solicitudId === '{sol}' && c.prestadorId === 'pre-edgar').estado") == "Anulada", "Doble aceptación: la cotización de Edgar queda Anulada")

            # ================= 5. En camino, ejecución y cierre =================
            print("\n[5] Prestador: en camino, ejecución y cierre")
            marco.reload(); marco.wait_for_selector("#sidebar .sb-item")
            ir(marco, f"p/servicio/{srv}")
            check("4a. avenida 3-15" in marco.inner_text("#screen"), "Con el servicio confirmado, el servidor ya envía la dirección")
            enlace = marco.get_attribute("#btn-como-llegar", "href") or ""
            check("destination=14.33352%2C-89.71605" in enlace, "Marco recibe “Cómo llegar” con la ubicación exacta de Ana")
            foto(marco, "05b-prestador-como-llegar")
            marco.click("#btn-en-camino"); ok_modal(marco)
            esperar(ana, f"!!Ofira.Store.servicio('{srv}').enCamino")
            ir(ana, f"c/servicio/{srv}")
            check(ana.locator("#aviso-en-camino").count() == 1, "El cliente ve “va en camino” con hora de llegada (mejora de entrevistas)")
            foto(ana, "06-cliente-en-camino")
            marco.click("#btn-iniciar"); marco.wait_for_selector("#avance-txt")
            marco.fill("#avance-txt", "Cambié el tubo y probé la presión."); marco.click("#btn-avance")
            marco.wait_for_timeout(400)
            marco.click("#btn-finalizar")
            check("Q 12.00" in marco.inner_text("#modal-root"), "Comisión 8 % calculada en el cierre")
            ok_modal(marco)
            check(ev(marco, f"Ofira.Store.servicio('{srv}').estado") == "Finalizado", "Servicio finalizado")
            foto(marco, "07-prestador-servicio")

            # ================= 6. Chat con foto y calificación =================
            print("\n[6] Mensajes con foto y calificación")
            ir(ana, f"chat/{sol}/pre-marco")
            ana.fill("#msg-txt", "<img src=x onerror=alert(1)> Gracias por venir")
            ana.press("#msg-txt", "Enter"); ana.wait_for_timeout(500)
            check(ana.locator(".msg img[src='x']").count() == 0 and "<img src=x" in ana.inner_text("#chat-list"), "XSS bloqueado: el código del mensaje se muestra como texto")
            ana.set_input_files("#chat-foto", FOTO); ana.wait_for_timeout(1200)
            check(ana.locator(".msg img").count() >= 1, "Se envía una foto por el chat (mejora de entrevistas)")
            foto(ana, "08-chat-foto")
            ir(ana, f"calificar/{srv}")
            ana.click(".star-input label:nth-child(5)"); ana.fill("#cal-com", "Llegó rápido y explicó todo.")
            ana.click("#btn-enviar-calificacion"); ana.wait_for_timeout(500)
            check(ev(ana, f"Ofira.Store.S.calificaciones.some(c => c.servicioId === '{srv}' && c.deCuentaId === 'cta-ana')"), "Calificación guardada")

            # ================= 7. Galería del prestador =================
            print("\n[7] Galería de trabajos")
            ir(marco, "p/perfil")
            marco.fill("#gal-desc", "Cambio de tubería en cocina")
            marco.set_input_files("#gal-foto", FOTO)
            marco.wait_for_function("() => Ofira.Store.prestador('pre-marco').galeria.length === 1", timeout=10000)
            check(ev(marco, "Ofira.Store.prestador('pre-marco').galeria.length") == 1, "El prestador sube una foto a su galería")
            ir(ana, "c/prestador/pre-marco"); ana.wait_for_timeout(300)
            esperar(ana, "Ofira.Store.prestador('pre-marco').galeria.length === 1")
            ir(ana, "c/prestador/pre-marco")
            check(ana.locator(".galeria img").count() == 1, "El cliente ve la galería en el perfil")

            # ================= 8. Excepción: rechazo, vencida, reenvío y cancelación =================
            print("\n[8] Excepción")
            ir(ana, "c/encuentra"); ana.click("#oficio-of-fon"); ana.wait_for_selector(".pcard")
            ana.check("#sel-pre-marco"); ana.click("#btn-continuar")
            check(ana.input_value("#sol-dir") == "4a. avenida 3-15, casa de dos niveles" and "Ubicación agregada" in ana.inner_text("#bloque-ubicacion"), "La dirección y ubicación guardadas se llenan solas en la siguiente solicitud")
            ana.select_option("#sol-esp", "esp-fugas"); ana.fill("#sol-desc", "Gotea la llave del baño desde ayer en la noche.")
            ana.click("#btn-enviar-solicitud"); ana.wait_for_selector(".done")
            sol2 = ev(ana, "Ofira.Store.S.solicitudes.slice(-1)[0].id")
            esperar(marco, f"Ofira.Store.S.invitaciones.some(i => i.solicitudId === '{sol2}')")
            inv2 = ev(marco, f"Ofira.Store.S.invitaciones.find(i => i.solicitudId === '{sol2}').id")
            ir(marco, f"p/invitacion/{inv2}"); marco.click("#btn-rechazar-inv"); marco.select_option("#m-rinv", index=1); ok_modal(marco)
            esperar(ana, f"Ofira.Store.solicitud('{sol2}').estado === 'Vencida'")
            ir(ana, f"c/solicitud/{sol2}")
            check(ana.locator("#btn-reenviar").count() == 1, "Si nadie acepta, la solicitud queda Vencida con opción de reenviar")
            foto(ana, "09-excepcion-vencida")
            ana.click("#btn-reenviar"); ana.wait_for_timeout(500)
            check(ev(ana, f"Ofira.Store.solicitud('{sol2}').estado") == "Solicitada", "Reenvío con un toque a otros prestadores disponibles")
            ana.click("#btn-cancelar-solicitud"); ana.select_option("#m-cancel", index=1); ok_modal(ana)
            check(ev(ana, f"Ofira.Store.solicitud('{sol2}').estado") == "Cancelada", "Cancelación de la solicitud")

            r = ev(ana, "Ofira.Api.accion('crearSolicitud', { oficioId: 'of-fon', modalidad: 'inmediata', especialidadId: 'esp-fugas', sectorId: 'sec-centro', descripcion: 'Prueba de coordenadas no válidas', direccion: 'Casa 1', ubicacion: { lat: 999, lng: 'x' } }, ['pre-edgar'], 'k-prueba-ubic')")
            check(not r["ok"], "El servidor rechaza coordenadas inválidas")

            # ================= 9. Seguridad =================
            print("\n[9] Seguridad")
            st, cuerpo = api("POST", "/api/login", {"correo": "' OR 1=1 --", "clave": "x"})
            check(st == 401, "Inyección SQL en el inicio de sesión no funciona")
            for _ in range(5):
                api("POST", "/api/login", {"correo": "jorge@ofira.test", "clave": "mala1234"})
            st, _ = api("POST", "/api/login", {"correo": "jorge@ofira.test", "clave": CLAVE})
            check(st == 429, "Tras 5 intentos fallidos se bloquea el inicio de sesión 15 minutos")
            st, _ = api("POST", "/api/accion", {"nombre": "verificar", "args": ["pre-wilmer", "Verificado", ""]})
            check(st == 401, "Sin sesión no se puede ejecutar ninguna acción")
            st, _ = api("POST", "/api/login", {"correo": "ana@ofira.test", "clave": CLAVE}, {"X-Requested-With": "otro"})
            check(st == 403, "Protección CSRF: se rechazan peticiones sin la cabecera de la app")
            st, _ = api("POST", "/api/login", {"correo": "ana@ofira.test", "clave": CLAVE}, {"Origin": "https://sitio-malicioso.com"})
            check(st == 403, "Protección CSRF: se rechazan peticiones desde otro sitio")
            r = ev(ana, "Ofira.Api.accion('verificar', 'pre-wilmer', 'Verificado', '')")
            check(not r["ok"] and r["codigo"] == "permiso", "Un cliente no puede ejecutar acciones de administrador")
            r = ev(ana, f"Ofira.Api.accion('iniciarServicio', '{srv}')")
            check(not r["ok"], "Un cliente no puede iniciar un servicio del prestador")
            r = ev(edgar, f"Ofira.Api.accion('enviarMensaje', '{sol}', 'pre-marco', 'hola', '')")
            check(not r["ok"], "Un prestador no puede escribir en conversaciones ajenas")
            r = ev(edgar, "Ofira.Api.accion('aprobarCotizacion', 'cot-h9')")
            check(not r["ok"], "Un prestador no puede aprobar cotizaciones de otro cliente")
            vista = ev(ana, "JSON.stringify(Ofira.Store.S)")
            check("scrypt$" not in vista and "claveHash" not in vista, "El navegador nunca recibe contraseñas ni sus hashes")
            check(ev(ana, "Ofira.Store.solicitud('sol-h9')") is None, "Un cliente no ve solicitudes de otros clientes")
            check(ev(ana, "Ofira.Store.S.personas.every(p => p.dpi === '')"), "El cliente no recibe números de DPI")
            check(ev(ana, "Ofira.Store.persona('per-2')") is None or ev(ana, "Ofira.Store.persona('per-2').telefono") == "", "El cliente no ve teléfonos de personas sin servicio con él")
            cab = urllib.request.urlopen(URL + "/").headers
            check("default-src 'self'" in (cab.get("Content-Security-Policy") or "") and cab.get("X-Frame-Options") == "DENY" and cab.get("X-Content-Type-Options") == "nosniff", "Cabeceras de seguridad (CSP, anti-clickjacking, nosniff)")
            cookie = [c for c in ana.context.cookies() if c["name"] == "ofira_sid"][0]
            check(cookie["httpOnly"] and cookie["sameSite"] == "Strict", "Cookie de sesión HttpOnly y SameSite=Strict")
            foto_id = ev(ana, f"Ofira.Store.solicitud('{sol}').fotos[0]")
            st, _ = api("GET", "/archivo/" + foto_id)
            check(st == 404, "Las fotos no se pueden ver sin iniciar sesión")
            st, _ = api("POST", "/api/archivo", {"datos": "data:image/png;base64," + "PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", "tipo": "foto"})
            check(st in (400, 401), "No se aceptan archivos que no son imágenes")
            r = ev(ana, "Ofira.Api.pedir('POST', '/api/archivo', { datos: 'data:image/png;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' })")
            check(not r["ok"], "Un archivo disfrazado de imagen se rechaza por su contenido real")

            # ================= 10. Registro de prestador con DPI y verificación =================
            print("\n[10] Registro con DPI, verificación y privacidad del DPI")
            nuevo = persona("Nuevo")
            nuevo.click("#btn-ir-registro"); nuevo.click("#reg-prestador")
            nuevo.fill("#reg-nombre", "Carmen Lucía Ortiz"); nuevo.fill("#reg-tel", "55509999"); nuevo.fill("#reg-correo", "carmen@ofira.test")
            nuevo.fill("#reg-clave", "corta")
            nuevo.select_option("#reg-sector", "sec-ermita"); nuevo.select_option("#reg-oficio", "of-fon"); nuevo.fill("#reg-exp", "5")
            nuevo.fill("#reg-ref", "Ferretería El Progreso, 5550-0000")
            nuevo.click("#btn-registrar")
            check(nuevo.locator("#err-clave").count() == 1, "Contraseña débil rechazada")
            nuevo.set_input_files("#reg-dpi", DPI); nuevo.wait_for_selector("text=Foto del DPI lista")
            nuevo.fill("#reg-clave", "Segura2026")
            nuevo.click("#btn-registrar"); nuevo.wait_for_selector("#sidebar .sb-item", timeout=10000)
            check(ev(nuevo, "Ofira.App.yo().roles.join(',')") == "cliente,prestador", "Cuenta nueva con roles cliente y prestador")
            dpi_id = ev(nuevo, "Ofira.Api.rol('prestador').then(() => Ofira.Store.prestadorDeCuenta(Ofira.App.yo().id).dpiArchivo)")
            admin = persona("Admin"); entrar(admin, "admin@ofira.test")
            check(admin.evaluate(f"fetch('/archivo/{dpi_id}').then(r => r.status)") == 200, "Administración puede ver la foto del DPI")
            check(ana.evaluate(f"fetch('/archivo/{dpi_id}').then(r => r.status)") == 403, "Un cliente NO puede ver el DPI aunque conozca el enlace")
            soporte = persona("Soporte"); entrar(soporte, "soporte@ofira.test")
            check(soporte.evaluate(f"fetch('/archivo/{dpi_id}').then(r => r.status)") == 403, "Soporte NO puede ver el DPI")
            pid = ev(admin, "Ofira.Store.prestadorDeCuenta(Ofira.Store.S.cuentas.find(c => c.correo === 'carmen@ofira.test').id).id")
            ir(admin, f"a/prestador/{pid}")
            check(admin.locator("img[alt^='Foto del DPI']").count() == 1, "El administrador revisa la foto real del DPI")
            foto(admin, "10-admin-verificacion")
            admin.click("#btn-verificar"); admin.wait_for_timeout(500)
            check(ev(admin, f"Ofira.Store.prestador('{pid}').estadoVerificacion") == "Verificado", "Prestador verificado")

            # ================= 11. Recuperación de cuenta =================
            print("\n[11] Recuperación de cuenta segura")
            jorge = persona("Jorge")
            jorge.click("#btn-ir-acceso"); jorge.click("button[data-go='recuperar']")
            jorge.fill("#rec-dato", "luis@ofira.test"); jorge.click("#btn-recuperar")
            jorge.wait_for_selector("text=Solicitud recibida")
            check("Solicitud recibida" in jorge.inner_text("#screen"), "La recuperación no revela si la cuenta existe ni entrega códigos en pantalla")
            esperar(admin, "(Ofira.Store.S.recuperaciones || []).length === 1")
            ir(admin, "a/cuentas")
            foto(admin, "11-admin-usuarios")
            admin.click("section.card [data-act='restablecer-clave']"); ok_modal(admin)
            admin.wait_for_selector("#modal-root .amount")
            temporal = admin.inner_text("#modal-root .amount").strip()
            admin.click("#modal-btn-ok")
            luis = persona("Luis"); entrar(luis, "luis@ofira.test", temporal, "#btn-guardar-clave")
            check(luis.locator("#btn-guardar-clave").count() == 1, "Con la contraseña temporal se obliga a crear una nueva")
            luis.fill("#cl-nueva", "NuevaLuis2026"); luis.fill("#cl-repetir", "NuevaLuis2026"); luis.click("#btn-guardar-clave")
            luis.wait_for_selector("#nav-inicio", timeout=10000)
            check(ev(luis, "Ofira.App.rol()") == "prestador", "Luis entra con su nueva contraseña")

            # ================= 12. Soporte =================
            print("\n[12] Soporte atiende un reclamo")
            ir(soporte, "s/reclamo/rec-1")
            soporte.click("#btn-reclamo-avanzar"); soporte.wait_for_timeout(400)
            soporte.fill("#rec-nota", "El prestador regresó y cambió el tomacorriente sin costo.")
            soporte.click("#btn-reclamo-avanzar"); soporte.wait_for_timeout(400)
            check(ev(soporte, "Ofira.Store.reclamo('rec-1').estado") == "Resuelto", "Soporte resuelve el reclamo")
            foto(soporte, "12-soporte")

            # ================= 13. Celular =================
            print("\n[13] Celular")
            cel = persona("Celular", 390, 844)
            entrar(cel, "ana@ofira.test")
            check(cel.evaluate("document.documentElement.scrollWidth") <= 390, "Sin desplazamiento horizontal en el celular")
            foto(cel, "13-celular")
            b.close()

        # ================= 14. Base de datos y persistencia =================
        print("\n[14] Base de datos")
        con = sqlite3.connect(DATOS / "data" / "ofira.db")
        hashes = [r[0] for r in con.execute("SELECT clave_hash FROM cuentas")]
        check(all(h.startswith("scrypt$") for h in hashes) and not any(CLAVE in h for h in hashes), "En la base de datos las contraseñas están cifradas con scrypt")
        tablas = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        check(len(tablas) >= 30, f"La base de datos tiene {len(tablas)} tablas del modelo entidad-relación")
        n_sol = con.execute("SELECT COUNT(*) FROM solicitudes").fetchone()[0]
        check(con.execute("PRAGMA foreign_key_check").fetchall() == [], "Integridad referencial correcta (sin llaves foráneas rotas)")
        check(con.execute("SELECT COUNT(*) FROM bitacora WHERE evento = 'login-fallido'").fetchone()[0] >= 5, "La bitácora registra los intentos fallidos de inicio de sesión")
        con.close()
        proceso.terminate(); proceso.wait(5)
        proceso = iniciar_servidor()
        st, cuerpo = api("POST", "/api/login", {"correo": "ana@ofira.test", "clave": CLAVE})
        datos = json.loads(cuerpo)
        check(st == 200 and len(datos["S"]["solicitudes"]) >= 3, "Al reiniciar el servidor los datos siguen ahí (persistencia real)")
    finally:
        proceso.terminate()
        try:
            proceso.wait(5)
        except Exception:
            proceso.kill()
        shutil.rmtree(DATOS, ignore_errors=True)

    fallas = [t for okk, t in resultados if not okk]
    print(f"\nRESUMEN: {len(resultados) - len(fallas)} de {len(resultados)} comprobaciones correctas")
    print("Errores de consola:", errores or "ninguno")
    if fallas or errores:
        sys.exit(1)


if __name__ == "__main__":
    main()
