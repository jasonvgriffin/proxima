# Install the last published Proxima setup, write a save and a settings file,
# then install the build under test over it. An upgrade must keep the install
# directory, leave a single uninstall entry at the new version, replace
# Proxima.exe, and leave the save, settings, and HKCU\Software\Proxima marker.
#
# electron-builder does not write InstallLocation on the uninstall key. That
# value lives on HKCU\Software\<app-guid>. The uninstall key has DisplayName,
# DisplayVersion, and UninstallString. This script searches both hives,
# including WOW6432Node, then falls back to the UninstallString directory and
# the default per-user folder.
#
# Update PreviousRelease when a newer installer has actually been published.
# This job installs that build, starts it, and runs the apply-update helper
# from this source tree against the CI installer (a higher version).
$ErrorActionPreference = 'Stop'

$PreviousRelease = 'v0.4.0'
$PreviousAsset = 'Proxima-Setup-0.4.0.exe'

function Get-UninstallRoots {
  @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )
}

function Get-UninstallEntries {
  foreach ($root in Get-UninstallRoots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    foreach ($key in @(Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue)) {
      $props = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
      if ($props -and $props.DisplayName -like 'Proxima*') {
        Write-Output $key
      }
    }
  }
}

function Get-QuotedOrFirstPath {
  param([string]$Command)
  if ([string]::IsNullOrWhiteSpace($Command)) { return $null }
  if ($Command -match '^"([^"]+)"') { return $Matches[1] }
  if ($Command -match '^(\S+)') { return $Matches[1] }
  return $null
}

function Get-ParentDir {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
  $parent = Split-Path -Parent $Path
  if ([string]::IsNullOrWhiteSpace($parent)) { return $null }
  return $parent.TrimEnd('\')
}

function Write-UninstallDiagnostics {
  param($Entries)
  $list = @($Entries)
  Write-Host "Proxima uninstall entries: $($list.Count)"
  foreach ($entry in $list) {
    $props = Get-ItemProperty -LiteralPath $entry.PSPath
    Write-Host "  key: $($entry.Name)"
    Write-Host "    DisplayName: $($props.DisplayName)"
    Write-Host "    DisplayVersion: $($props.DisplayVersion)"
    Write-Host "    InstallLocation: $($props.InstallLocation)"
    Write-Host "    UninstallString: $($props.UninstallString)"
    Write-Host "    QuietUninstallString: $($props.QuietUninstallString)"
    Write-Host "    Publisher: $($props.Publisher)"
  }
  foreach ($root in @('HKCU:\Software', 'HKLM:\Software', 'HKCU:\Software\WOW6432Node', 'HKLM:\Software\WOW6432Node')) {
    if (-not (Test-Path -LiteralPath $root)) {
      Write-Host "  app root missing: $root"
      continue
    }
    foreach ($key in @(Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue)) {
      $props = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
      if ($props -and $props.InstallLocation) {
        Write-Host "  $($key.Name) InstallLocation=$($props.InstallLocation)"
      }
    }
  }
}

function Add-InstallCandidate {
  param([string]$Path, [string]$Why)
  if ([string]::IsNullOrWhiteSpace($Path)) { return }
  $clean = $Path.TrimEnd('\')
  if ($script:InstallSeen.ContainsKey($clean)) { return }
  $script:InstallSeen[$clean] = $true
  $script:InstallCandidates.Add([pscustomobject]@{ Path = $clean; Why = $Why }) | Out-Null
}

function Resolve-InstallDir {
  param($Entry)
  $props = Get-ItemProperty -LiteralPath $Entry.PSPath
  $script:InstallCandidates = New-Object System.Collections.Generic.List[object]
  $script:InstallSeen = @{}

  Add-InstallCandidate $props.InstallLocation 'uninstall InstallLocation'
  Add-InstallCandidate (Get-ParentDir (Get-QuotedOrFirstPath $props.UninstallString)) 'UninstallString directory'
  Add-InstallCandidate (Get-ParentDir (Get-QuotedOrFirstPath $props.QuietUninstallString)) 'QuietUninstallString directory'

  foreach ($root in @('HKCU:\Software', 'HKLM:\Software', 'HKCU:\Software\WOW6432Node', 'HKLM:\Software\WOW6432Node')) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    foreach ($key in @(Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue)) {
      $app = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
      if ($app -and $app.InstallLocation) {
        Add-InstallCandidate $app.InstallLocation "InstallLocation on $($key.Name)"
      }
    }
  }

  Add-InstallCandidate (Join-Path $env:LOCALAPPDATA 'Programs\proxima') 'default per-user path'
  Add-InstallCandidate (Join-Path $env:LOCALAPPDATA 'Programs\Proxima') 'default per-user product path'

  $chosen = $null
  foreach ($candidate in $script:InstallCandidates) {
    $exe = Join-Path $candidate.Path 'Proxima.exe'
    $present = Test-Path -LiteralPath $exe
    Write-Host "  candidate ($($candidate.Why)): $($candidate.Path)  Proxima.exe=$present"
    if (-not $chosen -and $present) { $chosen = $candidate }
  }
  if (-not $chosen) {
    $tried = ($script:InstallCandidates | ForEach-Object { $_.Path }) -join '; '
    throw "Could not find Proxima.exe from the uninstall entry. Tried: $tried"
  }
  Write-Host "Resolved install directory from $($chosen.Why): $($chosen.Path)"
  return $chosen.Path
}

function Get-VersionParts {
  param([string]$Text)
  if ($Text -notmatch '^(\d+)\.(\d+)\.(\d+)(?:[-+]([0-9A-Za-z.-]+))?$') {
    throw "Not a Proxima version: '$Text'"
  }
  return [pscustomobject]@{
    Major = [int]$Matches[1]
    Minor = [int]$Matches[2]
    Patch = [int]$Matches[3]
    Pre = $Matches[4]
    Raw = $Text
  }
}

function Test-VersionNewer {
  param([string]$Candidate, [string]$Baseline)
  $next = Get-VersionParts $Candidate
  $prev = Get-VersionParts $Baseline
  if ($next.Major -ne $prev.Major) { return $next.Major -gt $prev.Major }
  if ($next.Minor -ne $prev.Minor) { return $next.Minor -gt $prev.Minor }
  if ($next.Patch -ne $prev.Patch) { return $next.Patch -gt $prev.Patch }
  if (-not $prev.Pre -and $next.Pre) { return $false }
  if ($prev.Pre -and -not $next.Pre) { return $true }
  if (-not $next.Pre -and -not $prev.Pre) { return $false }
  return [string]::Compare($next.Pre, $prev.Pre, [StringComparison]::Ordinal) -gt 0
}

function Read-SharedText {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  try {
    $stream = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
    $reader = New-Object System.IO.StreamReader($stream)
    try { return $reader.ReadToEnd() } finally { $reader.Dispose(); $stream.Dispose() }
  } catch {
    return $null
  }
}

function Write-UpdateDiagnostics {
  param([string]$UpdatesDir)
  foreach ($name in @('apply-update.log', 'apply-update.out')) {
    $file = Join-Path $UpdatesDir $name
    Write-Host "----- $name -----"
    $text = Read-SharedText $file
    if ($null -eq $text) {
      if (Test-Path -LiteralPath $file) { Write-Host "$name exists but could not be read" }
      else { Write-Host "$name was not written" }
    } else {
      Write-Host $text
    }
    Write-Host "----- end $name -----"
  }
  Write-Host 'updates directory:'
  if (Test-Path -LiteralPath $UpdatesDir) {
    Get-ChildItem -LiteralPath $UpdatesDir -Force | ForEach-Object { Write-Host ("  {0} {1}" -f $_.Length, $_.Name) }
  } else {
    Write-Host '  (missing)'
  }
  Write-Host 'processes:'
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -match 'Proxima|powershell|pwsh|cmd|conhost|wscript' } |
    ForEach-Object { Write-Host ("  pid {0} {1}" -f $_.Id, $_.ProcessName) }
}

function Wait-InstallerSettled {
  param([scriptblock]$Ready)
  $deadline = (Get-Date).AddSeconds(180)
  do {
    if (& $Ready) { return }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  Write-UninstallDiagnostics (Get-UninstallEntries)
  throw 'Timed out waiting for the installer to settle'
}

$releaseDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'release'
if (-not (Test-Path -LiteralPath $releaseDir)) { $releaseDir = (Resolve-Path 'release').Path }
$newSetup = Get-ChildItem -LiteralPath $releaseDir -Filter 'Proxima-Setup-*.exe' | Select-Object -First 1
if (-not $newSetup) { throw 'New Proxima-Setup executable was not downloaded' }
if ($newSetup.Name -notmatch '^Proxima-Setup-(.+)\.exe$') {
  throw "Cannot read a version from $($newSetup.Name)"
}
$expectedVersion = $Matches[1]
Get-VersionParts $expectedVersion | Out-Null
Write-Host "New installer: $($newSetup.FullName) version $expectedVersion"

$previousDir = Join-Path $env:TEMP 'proxima-previous-setup'
New-Item -ItemType Directory -Force -Path $previousDir | Out-Null
$previousExe = Join-Path $previousDir $PreviousAsset
if (-not (Test-Path -LiteralPath $previousExe)) {
  Write-Host "Downloading $PreviousRelease $PreviousAsset"
  gh release download $PreviousRelease --repo jasonvgriffin/proxima --pattern $PreviousAsset --dir $previousDir --clobber
  if ($LASTEXITCODE -ne 0) { throw "Could not download $PreviousRelease" }
}

Write-Host "Installing $PreviousRelease"
$old = Start-Process -FilePath $previousExe -ArgumentList '/S' -Wait -PassThru
Write-Host "Previous installer exit code: $($old.ExitCode)"
if ($old.ExitCode -ne 0) { throw "Previous installer failed with exit code $($old.ExitCode)" }

Wait-InstallerSettled { @(Get-UninstallEntries).Count -eq 1 }
$beforeEntries = @(Get-UninstallEntries)
Write-UninstallDiagnostics $beforeEntries
if ($beforeEntries.Count -ne 1) { throw "Expected one uninstall entry after $PreviousRelease, found $($beforeEntries.Count)" }
$before = Get-ItemProperty -LiteralPath $beforeEntries[0].PSPath
$installDir = Resolve-InstallDir $beforeEntries[0]
Write-Host "Installed $PreviousRelease at $installDir (DisplayVersion=$($before.DisplayVersion))"
if ([string]::IsNullOrWhiteSpace($before.DisplayVersion)) {
  throw 'Previous uninstall entry has no DisplayVersion'
}
$exePath = Join-Path $installDir 'Proxima.exe'
$exeBefore = Get-Item -LiteralPath $exePath
$exeBeforeHash = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash
Write-Host "Previous Proxima.exe sha256 $exeBeforeHash written $($exeBefore.LastWriteTimeUtc.ToString('o'))"

$appData = Join-Path $env:APPDATA 'Proxima'
$saveDir = Join-Path $appData 'saves'
New-Item -ItemType Directory -Force -Path $saveDir | Out-Null
$savePath = Join-Path $saveDir 'slot-1.json'
$settingsPath = Join-Path $appData 'settings.json'
$saveBody = '{"marker":"proxima-upgrade-keep","slot":1,"label":"keep this save"}'
$settingsBody = '{"music":true,"master":0.8,"marker":"proxima-settings-keep"}'
Set-Content -LiteralPath $savePath -Value $saveBody -NoNewline
Set-Content -LiteralPath $settingsPath -Value $settingsBody -NoNewline
Set-Content -LiteralPath (Join-Path $saveDir 'slot-1.json.bak') -Value '{"marker":"bak"}' -NoNewline
New-Item -Force -Path 'HKCU:\Software\Proxima' | Out-Null
New-ItemProperty -Path 'HKCU:\Software\Proxima' -Name UpgradeMarker -Value 'keep' -PropertyType String -Force | Out-Null

$updates = Join-Path $env:TEMP 'Proxima\updates'
if (Test-Path -LiteralPath (Join-Path $env:TEMP 'Proxima')) {
  Remove-Item -LiteralPath (Join-Path $env:TEMP 'Proxima') -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $updates | Out-Null
$staged = Join-Path $updates $newSetup.Name
Copy-Item -LiteralPath $newSetup.FullName -Destination $staged
$helper = Join-Path $updates 'apply-update.ps1'
$errorFile = Join-Path $appData 'update-error.json'
$pendingFile = Join-Path $appData 'pending-update.json'
if (Test-Path -LiteralPath $errorFile) { Remove-Item -LiteralPath $errorFile -Force }
@{
  confirmed = $true
  applyOnQuit = $true
  version = $expectedVersion
  file = $staged
  mode = 'installed'
} | ConvertTo-Json | Set-Content -LiteralPath $pendingFile -Encoding utf8

Write-Host "Starting installed $PreviousRelease so the helper must wait for that process to exit"
$running = Start-Process -FilePath $exePath -PassThru
$seen = $false
$startDeadline = (Get-Date).AddSeconds(40)
while ((Get-Date) -lt $startDeadline) {
  if (Get-Process -Id $running.Id -ErrorAction SilentlyContinue) { $seen = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $seen) { throw "Published $PreviousRelease did not stay running (pid $($running.Id))" }
Write-Host "Published build is running as pid $($running.Id)"

$applyScript = Join-Path $PSScriptRoot '..\..\scripts\apply-update.cjs'
Write-Host "Spawning apply-update helper for $($newSetup.Name)"
& node $applyScript `
  --spawn `
  --pid "$($running.Id)" `
  --mode installed `
  --version $expectedVersion `
  --installer $staged `
  --target-exe $exePath `
  --error-file $errorFile `
  --pending-file $pendingFile `
  --helper $helper
if ($LASTEXITCODE -ne 0) {
  Write-UpdateDiagnostics $updates
  throw 'Could not spawn the apply-update helper'
}
if (-not (Test-Path -LiteralPath $helper)) { throw 'The apply-update helper script was not written' }

Start-Sleep -Seconds 3
Write-Host "Closing pid $($running.Id) so the helper can install"
$oldIds = @(Get-Process -Name 'Proxima' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
foreach ($id in $oldIds) {
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
}

$updateLog = Join-Path $updates 'apply-update.log'
$updateOut = Join-Path $updates 'apply-update.out'
$launcher = Join-Path $updates 'apply-update.cmd'
$loggedChars = 0
$deadline = (Get-Date).AddSeconds(240)
$restarted = $false
do {
  $chunk = Read-SharedText $updateLog
  if ($chunk -and $chunk.Length -gt $loggedChars) {
    Write-Host $chunk.Substring($loggedChars)
    $loggedChars = $chunk.Length
  }
  $entries = @(Get-UninstallEntries)
  $versionOk = $false
  if ($entries.Count -eq 1) {
    $props = Get-ItemProperty -LiteralPath $entries[0].PSPath
    $versionOk = $props.DisplayVersion -eq $expectedVersion
  }
  $proc = @(Get-Process -Name 'Proxima' -ErrorAction SilentlyContinue)
  $helperGone = -not (Test-Path -LiteralPath $helper)
  $installerGone = -not (Test-Path -LiteralPath $staged)
  $logGone = -not (Test-Path -LiteralPath $updateLog)
  $outGone = -not (Test-Path -LiteralPath $updateOut)
  $launcherGone = -not (Test-Path -LiteralPath $launcher)
  if ($versionOk -and $proc.Count -ge 1 -and $helperGone -and $installerGone -and $logGone -and $outGone -and $launcherGone) {
    $restarted = $true
    break
  }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)
if (-not $restarted) {
  Write-Host "helper exists: $(Test-Path -LiteralPath $helper)"
  Write-Host "installer exists: $(Test-Path -LiteralPath $staged)"
  Write-Host "launcher exists: $(Test-Path -LiteralPath $launcher)"
  if (Test-Path -LiteralPath $errorFile) { Write-Host "update error: $(Get-Content -LiteralPath $errorFile -Raw)" }
  Write-UpdateDiagnostics $updates
  Write-UninstallDiagnostics (Get-UninstallEntries)
  throw 'Timed out waiting for the apply-update helper to restart into the new version'
}

$afterEntries = @(Get-UninstallEntries)
Write-UninstallDiagnostics $afterEntries
if ($afterEntries.Count -ne 1) {
  throw "Expected one Proxima uninstall entry after upgrade, found $($afterEntries.Count)"
}
$after = Get-ItemProperty -LiteralPath $afterEntries[0].PSPath
$afterDir = Resolve-InstallDir $afterEntries[0]
Write-Host "After upgrade: DisplayVersion=$($after.DisplayVersion) at $afterDir"

$failures = @()
if ($after.DisplayVersion -ne $expectedVersion) {
  $failures += "DisplayVersion is $($after.DisplayVersion), expected $expectedVersion"
}
if (-not (Test-VersionNewer $expectedVersion $before.DisplayVersion)) {
  $failures += "New version $expectedVersion is not newer than installed $($before.DisplayVersion). The build under test must be a higher version than $PreviousRelease."
}
if (-not [string]::Equals($afterDir, $installDir, [StringComparison]::OrdinalIgnoreCase)) {
  $failures += "Install directory changed from $installDir to $afterDir"
}
if (-not (Test-Path -LiteralPath (Join-Path $installDir 'Proxima.exe'))) {
  $failures += 'Proxima.exe is missing from the original install directory'
}
if (-not (Test-Path -LiteralPath (Join-Path $installDir 'Uninstall Proxima.exe'))) {
  $failures += 'Uninstall Proxima.exe is missing after the upgrade'
}
$exeAfter = Get-Item -LiteralPath $exePath
$exeAfterHash = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash
Write-Host "Upgraded Proxima.exe sha256 $exeAfterHash written $($exeAfter.LastWriteTimeUtc.ToString('o'))"
if ($exeAfterHash -eq $exeBeforeHash) {
  $failures += 'Proxima.exe bytes were not replaced by the new build'
}
$saveNow = Get-Content -LiteralPath $savePath -Raw
if ($saveNow -ne $saveBody) { $failures += "Save was changed or removed: $saveNow" }
$settingsNow = Get-Content -LiteralPath $settingsPath -Raw
if ($settingsNow -ne $settingsBody) { $failures += "Settings were changed or removed: $settingsNow" }
if (-not (Test-Path -LiteralPath (Join-Path $saveDir 'slot-1.json.bak'))) {
  $failures += 'Save backup was removed'
}
$marker = (Get-ItemProperty -Path 'HKCU:\Software\Proxima' -ErrorAction SilentlyContinue).UpgradeMarker
if ($marker -ne 'keep') { $failures += "HKCU\Software\Proxima marker is '$marker'" }
$desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Proxima.lnk'
if (-not (Test-Path -LiteralPath $desktop)) { $failures += 'Desktop shortcut is missing after upgrade' }
$runningNow = @(Get-Process -Name 'Proxima' -ErrorAction SilentlyContinue)
if ($runningNow.Count -lt 1) { $failures += 'The new Proxima process is not running' }
if (Test-Path -LiteralPath $helper) { $failures += "Helper script was left behind: $helper" }
if (Test-Path -LiteralPath $staged) { $failures += "Temp installer was left behind: $staged" }
if (Test-Path -LiteralPath $pendingFile) { $failures += 'pending-update.json was left behind' }
if (Test-Path -LiteralPath $errorFile) {
  $failures += "Update error file was written: $(Get-Content -LiteralPath $errorFile -Raw)"
}
$tempLeft = @(Get-ChildItem -LiteralPath (Join-Path $env:TEMP 'Proxima') -Recurse -Force -ErrorAction SilentlyContinue)
if ($tempLeft.Count -gt 0) {
  $failures += "Temp update files remain: $($tempLeft.FullName -join ', ')"
}

if ($failures) {
  Write-Host '::error::In-place upgrade did not keep the existing install'
  $failures | ForEach-Object { Write-Host "  $_" }
  Write-UpdateDiagnostics $updates
  exit 1
}

Write-Host "Apply-update helper replaced $($before.DisplayVersion) with $expectedVersion in $installDir, restarted Proxima, and kept the save, settings, and registry marker."
