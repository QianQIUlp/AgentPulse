$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
$Package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
$Version = $Package.version
$Artifact = "agentpulse-v$Version-windows-x64"
$Archive = Join-Path $Root "release\$Artifact.zip"
$Checksum = "$Archive.sha256"
$Port = if ($env:AGENTPULSE_SMOKE_PORT) { $env:AGENTPULSE_SMOKE_PORT } else { "43768" }
$Work = Join-Path ([System.IO.Path]::GetTempPath()) "AgentPulse smoke $([guid]::NewGuid())"
$Extracted = Join-Path $Work $Artifact
$Bin = Join-Path $Extracted "agentpulse.exe"
$HomeDir = Join-Path $Work "home"
$DaemonOut = Join-Path $Work "daemon.stdout.log"
$DaemonErr = Join-Path $Work "daemon.stderr.log"
$DaemonPidFile = Join-Path $Work "daemon.pid"
$DaemonPid = $null
$NodeHarness = (Get-Command node -ErrorAction Stop).Source
$Taskkill = (Get-Command taskkill.exe -ErrorAction Stop).Source
$Where = (Get-Command where.exe -ErrorAction Stop).Source
$DaemonControl = Join-Path $Root "scripts\windows-daemon-control.mjs"

function Invoke-AgentPulse {
  param(
    [string[]]$Arguments,
    [string]$Stdin,
    [switch]$AllowFailure
  )

  $stdout = Join-Path $Work "command-$([guid]::NewGuid()).stdout"
  $stderr = Join-Path $Work "command-$([guid]::NewGuid()).stderr"
  $stdinFile = $null
  $start = @{
    FilePath = $Bin
    ArgumentList = $Arguments
    RedirectStandardOutput = $stdout
    RedirectStandardError = $stderr
    NoNewWindow = $true
    PassThru = $true
    Wait = $true
  }
  if ($PSBoundParameters.ContainsKey("Stdin")) {
    $stdinFile = Join-Path $Work "command-$([guid]::NewGuid()).stdin"
    [System.IO.File]::WriteAllText($stdinFile, $Stdin, [System.Text.UTF8Encoding]::new($false))
    $start.RedirectStandardInput = $stdinFile
  }

  $process = Start-Process @start
  $result = [pscustomobject]@{
    ExitCode = $process.ExitCode
    Stdout = if (Test-Path $stdout) { Get-Content $stdout -Raw } else { "" }
    Stderr = if (Test-Path $stderr) { Get-Content $stderr -Raw } else { "" }
  }
  if (-not $AllowFailure -and $result.ExitCode -ne 0) {
    throw "agentpulse $($Arguments -join ' ') failed with $($result.ExitCode): $($result.Stderr)"
  }
  return $result
}

function Wait-Dashboard {
  param([int]$Attempts = 100)

  for ($i = 0; $i -lt $Attempts; $i++) {
    try {
      return Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/dashboard" -TimeoutSec 1
    } catch {
      Start-Sleep -Milliseconds 100
    }
  }
  throw "Dashboard did not become ready."
}

function Stop-Daemon {
  if ($null -eq $script:DaemonPid) {
    return
  }

  & $NodeHarness $DaemonControl stop $DaemonPidFile
  if ($LASTEXITCODE -ne 0) {
    & $Taskkill /PID $script:DaemonPid /T /F | Out-Null
  }

  for ($i = 0; $i -lt 50; $i++) {
    if (-not (Get-Process -Id $script:DaemonPid -ErrorAction SilentlyContinue)) {
      $script:DaemonPid = $null
      return
    }
    Start-Sleep -Milliseconds 100
  }
  throw "Unable to terminate the daemon process tree."
}

function Start-Daemon {
  param(
    [string]$StdoutPath,
    [string]$StderrPath
  )

  Remove-Item $DaemonPidFile -ErrorAction SilentlyContinue
  & $NodeHarness $DaemonControl start $Bin $DaemonPidFile $StdoutPath $StderrPath `
    daemon --dashboard --port $Port --notifier none
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $DaemonPidFile)) {
    throw "Unable to start the standalone daemon process group."
  }
  $script:DaemonPid = [int](Get-Content $DaemonPidFile -Raw)
}

try {
  New-Item -ItemType Directory -Path $Work, $HomeDir -Force | Out-Null

  $checksumText = (Get-Content $Checksum -Raw).Trim()
  $expected = ($checksumText -split "\s+")[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 $Archive).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    throw "Windows archive checksum mismatch."
  }

  Expand-Archive -Path $Archive -DestinationPath $Extracted
  foreach ($name in @("agentpulse.exe", "LICENSE", "BUILD-INFO.txt")) {
    if (-not (Test-Path (Join-Path $Extracted $name))) {
      throw "Archive is missing $name."
    }
  }
  $entries = @(Get-ChildItem $Extracted)
  if ($entries.Count -ne 3) {
    throw "Archive must contain exactly agentpulse.exe, LICENSE, and BUILD-INFO.txt."
  }

  $buildInfo = Get-Content (Join-Path $Extracted "BUILD-INFO.txt") -Raw
  if ($buildInfo -notmatch "AgentPulse version: $([regex]::Escape($Version))" -or
      $buildInfo -notmatch "Platform: windows" -or
      $buildInfo -notmatch "Architecture: x64") {
    throw "BUILD-INFO.txt does not describe the Windows x64 artifact."
  }

  $env:PATH = $Extracted
  $env:HOME = $HomeDir
  $env:USERPROFILE = $HomeDir
  $env:AGENTPULSE_PORT = $Port
  Remove-Item Env:AGENTPULSE_HOST -ErrorAction SilentlyContinue

  foreach ($name in @("node", "npm", "pnpm")) {
    $whereOut = Join-Path $Work "where-$name.stdout"
    $whereErr = Join-Path $Work "where-$name.stderr"
    $whereProcess = Start-Process -FilePath $Where `
      -ArgumentList @($name) `
      -RedirectStandardOutput $whereOut `
      -RedirectStandardError $whereErr `
      -NoNewWindow `
      -PassThru `
      -Wait
    if ($whereProcess.ExitCode -eq 0) {
      throw "Unexpected runtime dependency available in restricted PATH: $name"
    }
  }

  $help = Invoke-AgentPulse -Arguments @("--help")
  if ($help.Stdout -notmatch "AgentPulse v$([regex]::Escape($Version))") {
    throw "Help output has the wrong version."
  }

  $claude = Invoke-AgentPulse -Arguments @("setup", "claude-code", "--print")
  if ($claude.Stdout -notmatch [regex]::Escape($Bin) -or $claude.Stdout -notmatch "ingest.*claude-code") {
    throw "Claude setup did not use the absolute SEA path."
  }
  $codex = Invoke-AgentPulse -Arguments @("setup", "codex", "--print")
  if ($codex.Stdout -notmatch [regex]::Escape($Bin) -or $codex.Stdout -notmatch '"ingest", "codex"') {
    throw "Codex notify setup did not use the absolute SEA path."
  }
  $codexHooks = Invoke-AgentPulse -Arguments @("setup", "codex-hooks", "--print")
  if ($codexHooks.Stdout -notmatch "commandWindows" -or $codexHooks.Stdout -notmatch "codex-hook") {
    throw "Codex hooks setup is missing its Windows command."
  }

  $env:AGENTPULSE_HOST = "0.0.0.0"
  $unsafe = Invoke-AgentPulse -Arguments @("daemon", "--dashboard", "--notifier", "none") -AllowFailure
  if ($unsafe.ExitCode -eq 0 -or $unsafe.Stderr -notmatch "requires --host 127.0.0.1 or --host ::1") {
    throw "Dashboard did not reject AGENTPULSE_HOST=0.0.0.0."
  }
  Remove-Item Env:AGENTPULSE_HOST

  Start-Daemon -StdoutPath $DaemonOut -StderrPath $DaemonErr

  $dashboard = Wait-Dashboard
  if ($dashboard.Content -notmatch "AgentPulse Dashboard") {
    throw "Dashboard HTML was not served."
  }
  $dashboardApi = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/dashboard/api"
  if ($dashboardApi.health.status -ne "ok") {
    throw "Dashboard API health is not ok."
  }

  $doctor = Invoke-AgentPulse -Arguments @("doctor", "--json", "--notifier", "none")
  if (-not ($doctor.Stdout | ConvertFrom-Json).ok) {
    throw "Doctor did not pass against the standalone daemon."
  }

  $hookPayload = '{"session_id":"windows-codex-hook","cwd":"C:\\demo","hook_event_name":"PermissionRequest","prompt":"must-not-leak","tool_input":{"command":"must-not-leak"}}'
  $hook = Invoke-AgentPulse -Arguments @("ingest", "codex-hook") -Stdin $hookPayload
  if ($hook.Stdout.Length -ne 0 -or $hook.Stderr.Length -ne 0) {
    throw "Successful Codex hook ingest must be silent."
  }

  Invoke-AgentPulse -Arguments @(
    "emit", "--source", "custom", "--surface", "manual", "--status", "completed",
    "--session-id", "windows-standalone-smoke", "--message", "done"
  ) | Out-Null
  $status = Invoke-AgentPulse -Arguments @("status", "--json")
  if ($status.Stdout -notmatch "windows-codex-hook" -or
      $status.Stdout -notmatch "windows-standalone-smoke" -or
      $status.Stdout -match "must-not-leak") {
    throw "Status output is missing smoke sessions or leaked sensitive hook data."
  }

  Stop-Daemon

  $RestartOut = Join-Path $Work "restart.stdout.log"
  $RestartErr = Join-Path $Work "restart.stderr.log"
  Start-Daemon -StdoutPath $RestartOut -StderrPath $RestartErr
  Wait-Dashboard | Out-Null
  Stop-Daemon

  Write-Output "Windows standalone smoke test passed with restricted PATH=$Extracted"
} finally {
  Stop-Daemon
  Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue
}
