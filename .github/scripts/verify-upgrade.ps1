# Install the last published Proxima setup, write a save and a settings file,
# then install the build under test over it. An upgrade must keep the install
# directory, leave a single uninstall entry at the new version, and leave the
# save, settings, and HKCU\Software\Proxima marker in place.
#
# Update PreviousRelease when a newer installer has actually been published.
# Until then this job upgrades from v0.3.0, which is the uninstaller players have.
$ErrorActionPreference = 'Stop'

$PreviousRelease = 'v0.3.0'
$PreviousAsset = 'Proxima-Setup-0.3.0.exe'

function Get-UninstallEntries {
  Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
    Where-Object { (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DisplayName -like 'Proxima*' }
}

function Wait-InstallerSettled {
  param([scriptblock]$Ready)
  $deadline = (Get-Date).AddSeconds(180)
  do {
    if (& $Ready) { return }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw 'Timed out waiting for the installer to settle'
}

$releaseDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'release'
if (-not (Test-Path -LiteralPath $releaseDir)) { $releaseDir = (Resolve-Path 'release').Path }
$newSetup = Get-ChildItem -LiteralPath $releaseDir -Filter 'Proxima-Setup-*.exe' | Select-Object -First 1
if (-not $newSetup) { throw 'New Proxima-Setup executable was not downloaded' }
if ($newSetup.Name -notmatch 'Proxima-Setup-(\d+\.\d+\.\d+)\.exe') {
  throw "Cannot read a version from $($newSetup.Name)"
}
$expectedVersion = $Matches[1]
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
if ($beforeEntries.Count -ne 1) { throw "Expected one uninstall entry after $PreviousRelease, found $($beforeEntries.Count)" }
$before = Get-ItemProperty $beforeEntries[0].PSPath
$installDir = $before.InstallLocation.TrimEnd('\')
Write-Host "Installed $PreviousRelease at $installDir ($($before.DisplayVersion))"
if (-not (Test-Path -LiteralPath (Join-Path $installDir 'Proxima.exe'))) {
  throw 'Previous install did not write Proxima.exe'
}
$exeBefore = (Get-Item -LiteralPath (Join-Path $installDir 'Proxima.exe')).LastWriteTimeUtc

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

Write-Host "Upgrading in place with $($newSetup.Name)"
$upgrade = Start-Process -FilePath $newSetup.FullName -ArgumentList '/S' -Wait -PassThru
Write-Host "Upgrade installer exit code: $($upgrade.ExitCode)"
if ($upgrade.ExitCode -ne 0) { throw "Upgrade installer failed with exit code $($upgrade.ExitCode)" }

Wait-InstallerSettled {
  $entries = @(Get-UninstallEntries)
  if ($entries.Count -ne 1) { return $false }
  $props = Get-ItemProperty $entries[0].PSPath
  return $props.DisplayVersion -eq $expectedVersion
}

$afterEntries = @(Get-UninstallEntries)
if ($afterEntries.Count -ne 1) {
  $afterEntries | ForEach-Object { Write-Host $_.PSPath }
  throw "Expected one Proxima uninstall entry after upgrade, found $($afterEntries.Count)"
}
$after = Get-ItemProperty $afterEntries[0].PSPath
$afterDir = $after.InstallLocation.TrimEnd('\')
Write-Host "After upgrade: version $($after.DisplayVersion) at $afterDir"

$failures = @()
if ($after.DisplayVersion -ne $expectedVersion) {
  $failures += "DisplayVersion is $($after.DisplayVersion), expected $expectedVersion"
}
if ($afterDir -ne $installDir) {
  $failures += "Install directory changed from $installDir to $afterDir"
}
if (-not (Test-Path -LiteralPath (Join-Path $installDir 'Proxima.exe'))) {
  $failures += 'Proxima.exe is missing from the original install directory'
}
if (-not (Test-Path -LiteralPath (Join-Path $installDir 'Uninstall Proxima.exe'))) {
  $failures += 'Uninstall Proxima.exe is missing after the upgrade'
}
$exeAfter = (Get-Item -LiteralPath (Join-Path $installDir 'Proxima.exe')).LastWriteTimeUtc
if ($exeAfter -le $exeBefore) {
  $failures += 'Proxima.exe was not replaced by the new build'
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

if ($failures) {
  Write-Host '::error::In-place upgrade did not keep the existing install'
  $failures | ForEach-Object { Write-Host "  $_" }
  exit 1
}

Write-Host 'In-place upgrade kept the directory, one uninstall entry, the save, settings, and the registry marker.'
