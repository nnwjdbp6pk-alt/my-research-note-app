$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'

$pythonExe = Join-Path $backendDir '.venv\Scripts\python.exe'
if (-not (Test-Path $pythonExe)) {
  $pythonExe = 'python'
}

$backendCommand = "Set-Location '$backendDir'; & '$pythonExe' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
$backendProcess = Start-Process -FilePath 'powershell' -ArgumentList @('-NoProfile', '-Command', $backendCommand) -PassThru

Write-Host "Backend started (PID: $($backendProcess.Id)) at http://127.0.0.1:8000"
Write-Host 'Starting frontend at http://localhost:5173 ...'

try {
  Set-Location $frontendDir
  npm run dev
}
finally {
  if ($backendProcess -and -not $backendProcess.HasExited) {
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host 'Backend process stopped.'
  }
}
