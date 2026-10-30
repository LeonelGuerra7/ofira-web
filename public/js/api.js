/* Ofira · Comunicación con el servidor.
 * El navegador no decide nada importante: envía la acción al servidor, el servidor valida permisos y reglas,
 * guarda en la base de datos y devuelve solo los datos que esta cuenta puede ver.
 */
(function () {
  'use strict';
  const O = window.Ofira;
  const St = O.Store;
  const SIN_RED = 'Sin conexión. Revisa tu señal o tus datos móviles e intenta de nuevo.';

  const Api = {
    version: 0,
    quien: '',
    sesion: null,
    enLinea: true,

    aplicar(e) {
      this.version = e.version;
      this.quien = e.quien || ((e.sesion ? e.sesion.cuentaId + '|' + e.sesion.rol : '-'));
      this.sesion = e.sesion || null;
      e.S.clockOffset = (e.ahora - Date.now()) / 60000; // hora del servidor
      St.usar(e.S);
    },

    async pedir(metodo, url, cuerpo) {
      try {
        const r = await fetch(url, {
          method: metodo, credentials: 'same-origin', cache: 'no-store',
          headers: cuerpo ? { 'Content-Type': 'application/json', 'X-Requested-With': 'ofira' } : {},
          body: cuerpo ? JSON.stringify(cuerpo) : undefined
        });
        this.enLinea = true;
        let d = null;
        try { d = await r.json(); } catch (e) { d = null; }
        if (!d) return { ok: false, codigo: 'servidor', error: 'No se pudo completar. Intenta de nuevo.' };
        d.status = r.status;
        return d;
      } catch (e) {
        this.enLinea = false;
        return { ok: false, codigo: 'red', error: SIN_RED };
      }
    },

    /* Pide el estado actual; devuelve true si hubo cambios */
    async estado() {
      const d = await this.pedir('GET', '/api/estado?v=' + this.version + '&q=' + encodeURIComponent(this.quien));
      if (d.codigo === 'red' || d.codigo === 'servidor') return false;
      if (d.sinCambios) { if (St.S) St.S.clockOffset = (d.ahora - Date.now()) / 60000; return false; }
      this.aplicar(d);
      return true;
    },

    async accion(nombre, ...args) {
      const d = await this.pedir('POST', '/api/accion', { nombre, args });
      if (d.estado) this.aplicar(d.estado);
      if (d.resultado) return d.resultado;
      if (d.codigo === 'sesion') { await this.estado(); if (O.App) O.App.render(); }
      return { ok: false, error: d.error || 'No se pudo completar. Intenta de nuevo.', codigo: d.codigo || 'servidor' };
    },

    async conEstado(url, cuerpo) {
      const d = await this.pedir('POST', url, cuerpo);
      if (d.ok && d.S) this.aplicar(d);
      return d;
    },
    login(correo, clave) { return this.conEstado('/api/login', { correo, clave }); },
    registro(datos) { return this.conEstado('/api/registro', datos); },
    logout() { return this.conEstado('/api/logout', {}); },
    rol(rol) { return this.conEstado('/api/rol', { rol }); },
    cambiarClave(actual, nueva) { return this.conEstado('/api/clave', { actual, nueva }); },
    restablecer(cuentaId) { return this.conEstado('/api/admin/restablecer', { cuentaId }); },
    recuperar(dato) { return this.pedir('POST', '/api/recuperar', { dato }); },

    /* Reduce la foto en el teléfono antes de subirla: menos datos y más rápido con mala señal */
    async comprimir(archivo, max) {
      if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error('Solo se aceptan fotos JPG, PNG o WEBP.');
      const url = URL.createObjectURL(archivo);
      try {
        const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se pudo leer la foto.')); i.src = url; });
        const k = Math.min(1, (max || 1600) / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.82);
      } finally { URL.revokeObjectURL(url); }
    },
    async subirFoto(archivo) {
      let datos;
      try { datos = await this.comprimir(archivo); } catch (e) { return { ok: false, error: e.message, codigo: 'datos' }; }
      return this.pedir('POST', '/api/archivo', { datos, tipo: 'foto' });
    }
  };

  // En el navegador el estado es de solo lectura: los vencimientos los procesa el servidor
  St.tick = () => false;
  O.Api = Api;
})();
