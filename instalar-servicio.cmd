@echo off
rem Instala la tarea "CDS Ticket - Servicio" (pide elevación UAC)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0instalar-servicio.ps1\"' -Wait"
