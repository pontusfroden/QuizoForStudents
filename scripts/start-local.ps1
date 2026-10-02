$ErrorActionPreference = 'Stop'
$quizoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $quizoRoot
$quizoOllama = (Get-Command ollama -ErrorAction SilentlyContinue).Source
if (-not $quizoOllama) { $quizoOllama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe' }
if (-not (Test-Path -LiteralPath $quizoOllama)) { throw 'Install Ollama first: https://ollama.com/download/windows' }
try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null }
catch { $env:OLLAMA_NO_CLOUD = '1'; Start-Process -FilePath $quizoOllama -ArgumentList 'serve' -WindowStyle Hidden }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Quizo could not be built.' }
try { Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/status' -TimeoutSec 3 | Out-Null }
catch {
  $quizoNode = (Get-Command node).Source
  Start-Process -FilePath $quizoNode -ArgumentList 'server/ai.mjs' -WorkingDirectory $quizoRoot -WindowStyle Hidden
}
Write-Host 'Quizo AI is starting on this computer. Keep Ollama running.'
Start-Process 'https://pontusfroden.github.io/QuizoForStudents/'
