@echo off
title Ofira
cd /d "%~dp0"
where node >nul 2>nul || (echo Necesitas instalar Node.js 22 o superior: https://nodejs.org & pause & exit /b 1)
echo Iniciando Ofira... deja esta ventana abierta mientras lo usas.
start "" http://localhost:3000
node --disable-warning=ExperimentalWarning server/server.js
pause
