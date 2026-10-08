@echo off
rem ============================================================
rem  CDS Ticket - arranque automatico de la app
rem  Usado por la tarea programada "CDS Ticket - Servicio"
rem  (ejecuta next dev :3000 + backend :3001 en modo desarrollo)
rem ============================================================
cd /d "%~dp0"
if not exist "logs" mkdir "logs"
rem Sobrescribe el log en cada arranque para que no crezca sin limite
call npm run dev > "logs\servicio.log" 2>&1
