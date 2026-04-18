param(
    [switch]$SkipSeed,
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RepoRoot 'backend\lingai'
$FrontendDir = Join-Path $RepoRoot 'frontend'
$PythonExe = Join-Path $RepoRoot 'venv\Scripts\python.exe'

if (-not (Test-Path $PythonExe)) {
    throw "Python executable not found: $PythonExe"
}

function Run-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Script
    )
    Write-Host "[STEP] $Name" -ForegroundColor Cyan
    & $Script
    Write-Host "[DONE] $Name" -ForegroundColor Green
}

if (-not $SkipSeed) {
    Run-Step -Name 'Seeding backend demo data' -Script {
        Push-Location $BackendDir
        try {
            & $PythonExe 'seed.py'
            & $PythonExe 'seed_toeic_reading.py' '--reset'
            & $PythonExe 'seed_flashcards.py' '--reset'
        }
        finally {
            Pop-Location
        }
    }
}
else {
    Write-Host '[SKIP] Seeding data' -ForegroundColor Yellow
}

if (-not $SkipNpmInstall) {
    Run-Step -Name 'Installing frontend dependencies' -Script {
        Push-Location $FrontendDir
        try {
            npm install
        }
        finally {
            Pop-Location
        }
    }
}
else {
    Write-Host '[SKIP] npm install' -ForegroundColor Yellow
}

$backendCommand = "Set-Location '$BackendDir'; & '$PythonExe' -m uvicorn app.main:app --reload"
$frontendCommand = "Set-Location '$FrontendDir'; npm start"

Run-Step -Name 'Opening backend terminal' -Script {
    Start-Process powershell -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $backendCommand) | Out-Null
}
Run-Step -Name 'Opening frontend terminal' -Script {
    Start-Process powershell -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $frontendCommand) | Out-Null
}

Write-Host ''
Write-Host 'All done. Use these URLs:' -ForegroundColor Magenta
Write-Host '- Backend docs: http://127.0.0.1:8000/docs'
Write-Host '- Frontend:     http://localhost:3000'
