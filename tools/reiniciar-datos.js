/* Borra la base de datos y las fotos subidas. Al iniciar de nuevo el servidor se crean los datos iniciales. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const datos = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
fs.rmSync(datos, { recursive: true, force: true });
console.log('Datos borrados. Inicia el servidor con "npm start" para crear los datos iniciales.');
