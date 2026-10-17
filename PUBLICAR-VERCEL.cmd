@echo off
setlocal
title Publicar InfoTarea en Vercel
pushd "%~dp0"
if errorlevel 1 exit /b 1

where npm.cmd >nul 2>nul
if errorlevel 1 goto :missing_node

echo Iniciando sesion en Vercel...
call npm.cmd run vercel:login
if errorlevel 1 goto :failed

if exist ".vercel\project.json" goto :deploy
echo Selecciona el equipo y el proyecto EXISTENTE de InfoTarea.
call npm.cmd run vercel:link
if errorlevel 1 goto :failed
if not exist ".vercel\project.json" goto :missing_project

:deploy
echo Publicando los archivos de esta carpeta en produccion...
call npm.cmd run deploy:fresh
if errorlevel 1 goto :failed
echo La CLI termino correctamente. Revisa el dominio de produccion mostrado arriba.
popd
pause
exit /b 0

:missing_node
echo No se encontro npm. Instala Node.js desde https://nodejs.org y vuelve a abrir este archivo.
goto :failed

:missing_project
echo No se completo la vinculacion con el proyecto. La publicacion se ha detenido.

:failed
echo No se pudo completar la publicacion. Revisa el error mostrado arriba.
popd
pause
exit /b 1
