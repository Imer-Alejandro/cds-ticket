# Instala y arranca la tarea programada "CDS Ticket - Servicio"
# (SYSTEM al iniciar Windows -> iniciar-app.cmd -> npm run dev en :3000 y :3001)
# IMPORTANTE: este archivo debe mantenerse en ASCII puro; PowerShell 5.1
# interpreta los acentos UTF-8 sin BOM como caracteres de comando.
$ErrorActionPreference = 'Stop'

$scriptPath = $PSScriptRoot

$log = Join-Path $scriptPath 'logs\instalacion.log'
$logApp = Join-Path $scriptPath 'logs\servicio.log'
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
Start-Transcript -Path $log -Force | Out-Null

try {
  $raiz = $scriptPath
  $script = Join-Path $raiz 'iniciar-app.cmd'

  if (-not (Test-Path $script)) {
    throw "No existe $script"
  }

  $action = New-ScheduledTaskAction -Execute $script -WorkingDirectory $raiz
  $trigger = New-ScheduledTaskTrigger -AtStartup
  # Espera ~30s antes de arrancar (red listo); si la propiedad no existe en
  # esta version de PowerShell, se omite sin romper la instalacion.
  try { $trigger.RandomDelay = 'PT30S' } catch { try { $trigger.Delay = 'PT30S' } catch { } }
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

  Register-ScheduledTask `
    -TaskName 'CDS Ticket - Servicio' `
    -Description 'Arranca la app CDS Ticket al iniciar Windows: next dev (:3000) + backend (:3001)' `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

  Write-Host 'Tarea "CDS Ticket - Servicio" instalada OK.' -ForegroundColor Green

  # Si ya hay una instancia manual corriendo (puerto ocupado), no arrancar otra:
  # la tarea quedara lista para el proximo reinicio.
  $ocupado = try { $t = New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1', 3000); $t.Close(); $true } catch { $false }
  if ($ocupado) {
    Write-Host 'Puerto 3000 ocupado (instancia manual corriendo): la tarea NO se arranca ahora; correra sola en el proximo reinicio.' -ForegroundColor Yellow
  } else {
    Start-ScheduledTask -TaskName 'CDS Ticket - Servicio'
    Write-Host 'Arrancando la app ahora (puede tardar unos segundos)...' -ForegroundColor Yellow
    Start-Sleep -Seconds 12
  }

  $estado = (Get-ScheduledTask -TaskName 'CDS Ticket - Servicio').State
  $web = try { (Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 5 -UseBasicParsing).StatusCode } catch { 'no responde aun' }
  $api = try { (Invoke-WebRequest -Uri 'http://localhost:3001/health' -TimeoutSec 5 -UseBasicParsing).Content } catch { 'no responde aun' }

  Write-Host "Tarea: $estado"
  Write-Host "Next   (:3000): $web"
  Write-Host "Backend(:3001): $api"
  Write-Host ''
  Write-Host "Log de la app: $logApp" -ForegroundColor Cyan
} catch {
  Write-Host "ERROR DE INSTALACION: $($_.Exception.Message)" -ForegroundColor Red
} finally {
  Stop-Transcript | Out-Null
}
