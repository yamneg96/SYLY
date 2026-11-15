<#
  Checks the tools SYLY needs on Windows and installs ONLY the ones that are missing or too old.
  Run in PowerShell from the repository folder:

      powershell -ExecutionPolicy Bypass -File scripts\check-tools.ps1          # check, then install what is missing
      powershell -ExecutionPolicy Bypass -File scripts\check-tools.ps1 -CheckOnly   # only report

  Needs: winget (comes with Windows 10/11). Installing Docker Desktop needs a restart afterwards.
#>
param([switch]$CheckOnly)

$ErrorActionPreference = 'Continue'
$missing = @()

# Tools that are installed but not on PATH in this window (Docker Desktop is the usual one).
foreach ($extra in @('C:\Program Files\Docker\Docker\resources\bin', "$env:LOCALAPPDATA\Microsoft\WinGet\Links")) {
  if ((Test-Path $extra) -and ($env:Path -notlike "*$extra*")) { $env:Path += ";$extra" }
}

function Version-Of($cmd, $arg) {
  $c = Get-Command $cmd -ErrorAction SilentlyContinue
  if (-not $c) { return $null }
  try { $out = (& $c.Source $arg 2>&1 | Select-Object -First 1) -join '' } catch { return $null }
  if ($out -match '(\d+)\.(\d+)(?:\.(\d+))?') { return [pscustomobject]@{ Text = $out.Trim(); Major = [int]$Matches[1]; Minor = [int]$Matches[2] } }
  return $null   # for example the Microsoft Store "python" stub, which prints no version
}

$tools = @(
  @{ Name = 'Git';            Cmd = 'git';         Arg = '--version'; Id = 'Git.Git';                Ok = { $true } },
  @{ Name = 'Python 3.12+';   Cmd = 'python';      Arg = '--version'; Id = 'Python.Python.3.12';      Ok = { param($v) $v.Major -gt 3 -or ($v.Major -eq 3 -and $v.Minor -ge 12) } },
  @{ Name = 'Node.js 20+';    Cmd = 'node';        Arg = '--version'; Id = 'OpenJS.NodeJS.LTS';       Ok = { param($v) $v.Major -ge 20 } },
  @{ Name = 'Docker Desktop'; Cmd = 'docker';      Arg = '--version'; Id = 'Docker.DockerDesktop';    Ok = { $true } },
  @{ Name = 'cloudflared';    Cmd = 'cloudflared'; Arg = '--version'; Id = 'Cloudflare.cloudflared';  Ok = { $true } }
)

foreach ($t in $tools) {
  $v = Version-Of $t.Cmd $t.Arg
  if ($v -and (& $t.Ok $v)) { Write-Host ("OK       {0,-16} {1}" -f $t.Name, $v.Text); continue }
  $why = if ($v) { "found $($v.Text), too old" } else { 'not found' }
  Write-Host ("MISSING  {0,-16} {1}" -f $t.Name, $why) -ForegroundColor Yellow
  $missing += $t
}

if (-not $missing) { Write-Host "`nEverything is installed." -ForegroundColor Green }
elseif ($CheckOnly) { Write-Host "`nRun again without -CheckOnly to install: $($missing.Name -join ', ')" }
elseif (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host "`nwinget was not found. Install 'App Installer' from the Microsoft Store, or install by hand: $($missing.Name -join ', ')" -ForegroundColor Red
} else {
  foreach ($t in $missing) {
    Write-Host "`nInstalling $($t.Name) ..." -ForegroundColor Cyan
    winget install --id $t.Id -e --accept-package-agreements --accept-source-agreements
  }
  Write-Host "`nDone. Close this window and open a new PowerShell so the new tools are found." -ForegroundColor Green
  if ($missing.Cmd -contains 'docker') { Write-Host 'Docker Desktop was installed: restart the PC, then start Docker Desktop once.' -ForegroundColor Yellow }
}

# Docker installed but not running is the most common reason for "cannot connect to the Docker API".
if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker info --format '{{.ServerVersion}}' 2>$null | ForEach-Object { Write-Host "Docker engine is running (version $_)." }
  if ($LASTEXITCODE -ne 0) { Write-Host 'Docker is installed but the engine is not running: start Docker Desktop and wait for "Engine running".' -ForegroundColor Yellow }
}
