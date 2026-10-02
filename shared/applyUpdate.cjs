const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const SHA256_RE = /^[a-f0-9]{64}$/i;

function updatesDirectory(tempDir) {
  return path.join(tempDir, 'Proxima', 'updates');
}

function pendingUpdatePath(userData) {
  return path.join(userData, 'pending-update.json');
}

function updateErrorPath(userData) {
  return path.join(userData, 'update-error.json');
}

function readJson(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function sanitizePending(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.confirmed !== true) return null;
  if (value.mode !== 'installed' && value.mode !== 'portable') return null;
  if (typeof value.version !== 'string' || !VERSION_RE.test(value.version)) return null;
  if (typeof value.file !== 'string' || !path.isAbsolute(value.file)) return null;
  if (typeof value.sha256 !== 'string' || !SHA256_RE.test(value.sha256)) return null;
  if (typeof value.size !== 'number' || !Number.isFinite(value.size) || value.size <= 0) return null;
  return {
    confirmed: true,
    applyOnQuit: value.applyOnQuit !== false,
    version: value.version,
    file: value.file,
    fileName: typeof value.fileName === 'string' && value.fileName ? value.fileName : path.basename(value.file),
    sha256: value.sha256.toLowerCase(),
    size: value.size,
    mode: value.mode,
  };
}

function readPendingUpdate(userData) {
  const file = pendingUpdatePath(userData);
  try {
    if (!fs.existsSync(file)) return null;
    return sanitizePending(readJson(file));
  } catch {
    return null;
  }
}

function writePendingUpdate(userData, record) {
  const pending = sanitizePending(record);
  if (!pending) throw new Error('Refusing to store an unconfirmed update.');
  writeJson(pendingUpdatePath(userData), pending);
  return pending;
}

function clearPendingUpdate(userData) {
  fs.rmSync(pendingUpdatePath(userData), { force: true });
}

function readUpdateError(userData) {
  const file = updateErrorPath(userData);
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = readJson(file);
    if (!parsed || typeof parsed.message !== 'string') return null;
    const message = parsed.message.trim();
    return message || null;
  } catch {
    return null;
  }
}

function clearUpdateError(userData) {
  fs.rmSync(updateErrorPath(userData), { force: true });
}

function fileMatches(file, expectedSize, expectedSha256) {
  if (!file || !fs.existsSync(file)) return false;
  const stat = fs.statSync(file);
  if (!stat.isFile()) return false;
  if (expectedSize && stat.size !== expectedSize) return false;
  if (!expectedSha256) return stat.size > 0;
  const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return digest.toLowerCase() === String(expectedSha256).toLowerCase();
}

function assertSafePath(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label}.`);
  if (!path.isAbsolute(value)) throw new Error(`${label} must be an absolute path.`);
  if (/[\r\n\0]/.test(value)) throw new Error(`${label} contains a line break.`);
  return value;
}

function normalizePlan(plan) {
  const pid = Number(plan && plan.pid);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('Update helper needs a process id.');
  const mode = plan && plan.mode;
  if (mode !== 'installed' && mode !== 'portable') throw new Error('Update helper mode must be installed or portable.');
  const version = plan && plan.version;
  if (typeof version !== 'string' || !VERSION_RE.test(version)) throw new Error('Update helper needs a version.');
  const normalized = {
    pid,
    mode,
    version,
    installerPath: assertSafePath(plan.installerPath, 'installer'),
    targetExe: assertSafePath(plan.targetExe, 'target'),
    errorFile: assertSafePath(plan.errorFile, 'error file'),
    pendingFile: assertSafePath(plan.pendingFile, 'pending file'),
    helperPath: assertSafePath(plan.helperPath, 'helper'),
  };
  const json = JSON.stringify(normalized);
  if (json.includes('\n') || json.includes("'@")) throw new Error('Update plan cannot be embedded.');
  return { normalized, json };
}

function buildApplyHelper(plan) {
  const { json } = normalizePlan(plan);
  const lines = [
    '# Proxima apply-update helper. Spawned detached, then the app quits.',
    '# Installed updates run the NSIS setup with /S and /currentuser only.',
    '# Do not pass --delete-app-data. Do not pass --force-run.',
    '# Assisted silent installs start the app only when --force-run is set,',
    '# and that finish-page path also passes --updated into the new process.',
    '# This helper starts the exe itself after a zero exit so a failed setup',
    '# can open the previous exe. The setup still passes --updated to the',
    '# previous uninstaller on its own, which keeps the isUpdated guards',
    '# around saves, settings, and HKCU\\Software\\Proxima.',
    "$ErrorActionPreference = 'Stop'",
    'function Write-UpdateLog([string]$Message) {',
    '  $dir = Split-Path -Parent $PSCommandPath',
    "  $log = Join-Path $dir 'apply-update.log'",
    "  $line = (Get-Date).ToString('o') + ' ' + $Message + [Environment]::NewLine",
    '  [System.IO.File]::AppendAllText($log, $line)',
    '}',
    '',
    'function Write-UpdateError([string]$Message) {',
    '  $dir = Split-Path -Parent $plan.errorFile',
    '  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }',
    "  $json = @{ message = $Message; version = [string]$plan.version } | ConvertTo-Json -Compress",
    '  [System.IO.File]::WriteAllText($plan.errorFile, $json)',
    '}',
    '',
    'function Remove-PlanFile([string]$PathName) {',
    '  if ($PathName -and (Test-Path -LiteralPath $PathName)) {',
    '    Remove-Item -LiteralPath $PathName -Force -ErrorAction SilentlyContinue',
    '  }',
    '}',
    '',
    'function Clear-Helper([bool]$Committed) {',
    '  Set-Location -LiteralPath $env:TEMP',
    '  if ($Committed) {',
    '    Remove-PlanFile $plan.installerPath',
    '    Remove-PlanFile $plan.pendingFile',
    "    Remove-PlanFile (Join-Path (Split-Path -Parent $PSCommandPath) 'apply-update.log')",
    '  }',
    '  $folder = Split-Path -Parent $PSCommandPath',
    '  Remove-PlanFile $PSCommandPath',
    '  if ($Committed -and $folder -and (Test-Path -LiteralPath $folder)) {',
    '    $left = @(Get-ChildItem -LiteralPath $folder -Force -ErrorAction SilentlyContinue)',
    '    if ($left.Count -eq 0) {',
    '      Remove-Item -LiteralPath $folder -Force -ErrorAction SilentlyContinue',
    '      $parent = Split-Path -Parent $folder',
    '      if ($parent -and (Test-Path -LiteralPath $parent)) {',
    '        $parentLeft = @(Get-ChildItem -LiteralPath $parent -Force -ErrorAction SilentlyContinue)',
    '        if ($parentLeft.Count -eq 0) { Remove-Item -LiteralPath $parent -Force -ErrorAction SilentlyContinue }',
    '      }',
    '    }',
    '  }',
    '}',
    '',
    'function Test-PidAlive([int]$ProcessId) {',
    '  try {',
    '    return $null -ne (Get-Process -Id $ProcessId -ErrorAction Stop)',
    '  } catch {',
    '    return $false',
    '  }',
    '}',
    '',
    'function Wait-PidExit([int]$ProcessId, [int]$TimeoutSec) {',
    '  $deadline = (Get-Date).AddSeconds($TimeoutSec)',
    '  $nextLog = Get-Date',
    '  while ((Get-Date) -lt $deadline) {',
    '    if (-not (Test-PidAlive $ProcessId)) { return $true }',
    '    if ((Get-Date) -ge $nextLog) {',
    '      Write-UpdateLog "waiting for pid $ProcessId"',
    '      $nextLog = (Get-Date).AddSeconds(10)',
    '    }',
    '    Start-Sleep -Milliseconds 400',
    '  }',
    '  return $false',
    '}',
    '',
    'function Test-FileUnlocked([string]$PathName) {',
    '  if (-not (Test-Path -LiteralPath $PathName)) { return $true }',
    '  try {',
    "    $stream = [System.IO.File]::Open($PathName, 'Open', 'ReadWrite', 'None')",
    '    $stream.Close()',
    '    return $true',
    '  } catch {',
    '    return $false',
    '  }',
    '}',
    '',
    'function Wait-FileUnlocked([string]$PathName, [int]$TimeoutSec) {',
    '  $deadline = (Get-Date).AddSeconds($TimeoutSec)',
    '  while ((Get-Date) -lt $deadline) {',
    '    if (Test-FileUnlocked $PathName) { return $true }',
    '    Start-Sleep -Milliseconds 400',
    '  }',
    '  return $false',
    '}',
    '',
    'function Test-ExeRunning([string]$Exe) {',
    '  $name = [System.IO.Path]::GetFileNameWithoutExtension($Exe)',
    '  try {',
    '    $procs = @(Get-Process -Name $name -ErrorAction Stop)',
    '  } catch {',
    '    return $false',
    '  }',
    '  if ($procs.Count -eq 0) { return $false }',
    '  foreach ($proc in $procs) {',
    '    try {',
    '      if ($proc.Path -and [string]::Equals($proc.Path, $Exe, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }',
    '    } catch {}',
    '  }',
    '  # Path can be blank briefly. The old process has already exited, so this name is the relaunch.',
    '  return $true',
    '}',
    '',
    'function Wait-ExeRunning([string]$Exe, [int]$TimeoutSec) {',
    '  $deadline = (Get-Date).AddSeconds($TimeoutSec)',
    '  while ((Get-Date) -lt $deadline) {',
    '    if (Test-ExeRunning $Exe) { return $true }',
    '    Start-Sleep -Milliseconds 400',
    '  }',
    '  return $false',
    '}',
    '',
    'function Start-Target([string]$Exe) {',
    '  if (-not (Test-Path -LiteralPath $Exe)) { throw "Proxima.exe is missing." }',
    '  Start-Process -FilePath $Exe | Out-Null',
    '}',
    '',
    'function Move-WithRetry([string]$From, [string]$To) {',
    '  for ($attempt = 1; $attempt -le 20; $attempt++) {',
    '    try {',
    '      Move-Item -LiteralPath $From -Destination $To -Force',
    '      return',
    '    } catch {',
    '      if ($attempt -ge 20) { throw }',
    '      Start-Sleep -Milliseconds 500',
    '    }',
    '  }',
    '}',
    '',
    'trap {',
    '  Write-UpdateLog ("terminated: " + $_.Exception.Message)',
    '  try { Write-UpdateError ([string]$_.Exception.Message) } catch {',
    '    Write-UpdateLog ("could not write update error: " + $_.Exception.Message)',
    '  }',
    '  exit 1',
    '}',
    "Write-UpdateLog 'helper-start'",
    "$plan = @'",
    json,
    "'@ | ConvertFrom-Json",
    'Write-UpdateLog "loaded plan pid=$($plan.pid) mode=$($plan.mode) version=$($plan.version)"',
    '',
    'if (-not (Wait-PidExit ([int]$plan.pid) 180)) {',
    '  Write-UpdateLog "pid $($plan.pid) did not exit"',
    '  Write-UpdateError "Proxima did not close, so the update to $($plan.version) did not start."',
    '  try { Start-Target $plan.targetExe } catch {}',
    '  Clear-Helper $false',
    '  exit 1',
    '}',
    '',
    '# The single-instance lock and the exe handle drop after the process is gone.',
    'Write-UpdateLog "pid $($plan.pid) has exited"',
    'Start-Sleep -Seconds 1',
    'if (-not (Wait-FileUnlocked $plan.targetExe 60)) {',
    '  Write-UpdateLog "target stayed locked: $($plan.targetExe)"',
    '  Write-UpdateError "The app file stayed in use, so the update to $($plan.version) did not start."',
    '  try { Start-Target $plan.targetExe } catch {}',
    '  Clear-Helper $false',
    '  exit 1',
    '}',
    '',
    'Write-UpdateLog "target unlocked"',
    'if ($plan.mode -eq \'portable\') {',
    '  Write-UpdateLog "portable-start"',
    '  $backup = "$($plan.targetExe).old"',
    '  $staged = "$($plan.targetExe).new"',
    '  try {',
    '    Copy-Item -LiteralPath $plan.installerPath -Destination $staged -Force',
    '    Move-WithRetry $plan.targetExe $backup',
    '    try {',
    '      Move-WithRetry $staged $plan.targetExe',
    '    } catch {',
    '      if ((Test-Path -LiteralPath $backup) -and -not (Test-Path -LiteralPath $plan.targetExe)) {',
    '        Move-Item -LiteralPath $backup -Destination $plan.targetExe -Force',
    '      }',
    '      throw',
    '    }',
    '    Start-Target $plan.targetExe',
    '    if (-not (Wait-ExeRunning $plan.targetExe 20)) { throw "The new portable build did not stay open." }',
    '    Remove-PlanFile $backup',
    '    Remove-PlanFile $plan.errorFile',
    '    Clear-Helper $true',
    '    exit 0',
    '  } catch {',
    '    if ((Test-Path -LiteralPath $backup) -and -not (Test-Path -LiteralPath $plan.targetExe)) {',
    '      Move-Item -LiteralPath $backup -Destination $plan.targetExe -Force -ErrorAction SilentlyContinue',
    '    }',
    '    Remove-PlanFile $staged',
    '    Write-UpdateError $_.Exception.Message',
    '    try { Start-Target $plan.targetExe } catch {}',
    '    Clear-Helper $false',
    '    exit 1',
    '  }',
    '}',
    '',
    '$exitCode = 1',
    'for ($attempt = 1; $attempt -le 3; $attempt++) {',
    '  if (-not (Wait-FileUnlocked $plan.targetExe 20)) { Start-Sleep -Seconds 1 }',
    '  Write-UpdateLog "installer-start attempt=$attempt $($plan.installerPath)"',
    "  $proc = Start-Process -FilePath $plan.installerPath -ArgumentList '/S','/currentuser' -Wait -PassThru",
    '  $exitCode = $proc.ExitCode',
    '  Write-UpdateLog "installer-exit attempt=$attempt code=$exitCode"',
    '  if ($exitCode -eq 0) { break }',
    '  Start-Sleep -Seconds 2',
    '}',
    'if ($null -eq $exitCode) { $exitCode = 1 }',
    'if ($exitCode -ne 0) {',
    '  Write-UpdateError "The installer exited with code $exitCode, so Proxima opened the previous version."',
    '  try { Start-Target $plan.targetExe } catch {}',
    '  Clear-Helper $false',
    '  exit $exitCode',
    '}',
    '',
    'try { Start-Target $plan.targetExe } catch {',
    '  Write-UpdateError $_.Exception.Message',
    '  Clear-Helper $true',
    '  exit 1',
    '}',
    'if (-not (Wait-ExeRunning $plan.targetExe 20)) {',
    '  Write-UpdateError "The new version did not stay open."',
    '  Clear-Helper $true',
    '  exit 1',
    '}',
    'Remove-PlanFile $plan.errorFile',
    'Clear-Helper $true',
    'exit 0',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

function writeHelper(plan) {
  const script = buildApplyHelper(plan);
  fs.mkdirSync(path.dirname(plan.helperPath), { recursive: true });
  fs.writeFileSync(plan.helperPath, `\uFEFF${script}`, 'utf8');
  return plan.helperPath;
}

function systemExe(name) {
  const root = process.env.SystemRoot || process.env.SYSTEMROOT;
  if (!root) return name;
  return path.join(root, 'System32', name);
}

function updateLogPath(helperPath) {
  return path.join(path.dirname(helperPath), 'apply-update.log');
}

function powershellPath() {
  const root = process.env.SystemRoot || process.env.SYSTEMROOT;
  if (!root) return 'powershell.exe';
  return path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

function appendUpdateLog(logPath, message) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\r\n`);
}

function helperCommand(scriptPath) {
  return {
    file: systemExe('conhost.exe'),
    args: ['--headless', powershellPath(), '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
  };
}

function spawnHelper(scriptPath, spawnImpl = spawn) {
  if (typeof scriptPath !== 'string' || scriptPath.includes('"')) {
    throw new Error('Helper path cannot contain a quote.');
  }
  const logPath = updateLogPath(scriptPath);
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  appendUpdateLog(logPath, `node spawning helper for ${scriptPath}`);
  const command = helperCommand(scriptPath);
  let child;
  try {
    child = spawnImpl(command.file, command.args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch (error) {
    appendUpdateLog(logPath, `node spawn failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
  if (child && typeof child.unref === 'function') child.unref();
  appendUpdateLog(logPath, `node spawned pid ${child && child.pid ? child.pid : 'unknown'}`);
  return child;
}

function canApplyUpdate(pending) {
  return Boolean(pending && pending.confirmed === true && pending.applyOnQuit !== false && pending.file && pending.sha256);
}

module.exports = {
  VERSION_RE,
  updatesDirectory,
  pendingUpdatePath,
  updateErrorPath,
  sanitizePending,
  readPendingUpdate,
  writePendingUpdate,
  clearPendingUpdate,
  readUpdateError,
  clearUpdateError,
  fileMatches,
  normalizePlan,
  buildApplyHelper,
  writeHelper,
  updateLogPath,
  helperCommand,
  spawnHelper,
  canApplyUpdate,
};
