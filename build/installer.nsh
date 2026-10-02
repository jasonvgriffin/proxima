; Extra uninstall cleanup for Proxima, included through build.nsis.include.
;
; Permanent rule: a newer Proxima-Setup-X.exe installed over an existing
; install upgrades in place. It keeps the install directory, and it keeps
; %APPDATA%\Proxima (saves, settings, logs) and HKCU\Software\Proxima.
; A real uninstall still removes those, plus shortcuts and the install folder.
;
; electron-builder runs this uninstaller with --updated during an upgrade.
; ${isUpdated} is that switch. deleteAppDataOnUninstall in package.json is
; also skipped by electron-builder's own ${ifNot} ${isUpdated} block.
; Do not delete app data, saves, or these registry keys outside the guard.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    ; Electron keeps app data per user even for per-machine installs.
    ${if} $installMode == "all"
      SetShellVarContext current
    ${endif}

    ; App data: saves, settings, Electron caches, Crashpad dumps.
    RMDir /r "$APPDATA\Proxima"
    RMDir /r "$APPDATA\proxima"
    RMDir /r "$APPDATA\com.jasonvgriffin.proxima"

    ; Local app data: caches, crash dumps, electron-updater downloads.
    RMDir /r "$LOCALAPPDATA\Proxima"
    RMDir /r "$LOCALAPPDATA\proxima"
    RMDir /r "$LOCALAPPDATA\Proxima-updater"
    RMDir /r "$LOCALAPPDATA\proxima-updater"
    RMDir /r "$LOCALAPPDATA\com.jasonvgriffin.proxima"

    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}

    ; Registry keys for the appId and the product name.
    DeleteRegKey HKCU "Software\com.jasonvgriffin.proxima"
    DeleteRegKey HKCU "Software\Proxima"
    DeleteRegKey HKCU "Software\proxima"

    ; Make sure the install folder itself goes (the uninstaller runs from a
    ; temp copy, so the folder is not locked by it).
    ; Temp update downloads and the apply-update helper live here. This stays
    ; inside the isUpdated guard so an upgrade does not delete the setup it is
    ; running, or the saves and settings the helper is keeping.
    RMDir /r "$TEMP\Proxima"
    SetOutPath $TEMP
    RMDir /r "$INSTDIR"
  ${endif}
!macroend
