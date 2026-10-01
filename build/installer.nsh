; Extra uninstall cleanup for Proxima, included through build.nsis.include.
;
; electron-builder's uninstaller already removes the install folder, the
; shortcuts, the HKCU uninstall entry and its own Software\{guid} key, and
; (deleteAppDataOnUninstall) %APPDATA%\Proxima. This macro removes everything
; else the app may leave behind so a real uninstall leaves no trace.
;
; Everything here is skipped when ${isUpdated} is true: a newer build runs the
; old uninstaller with --updated during an upgrade or reinstall, and saves in
; %APPDATA%\Proxima\saves must survive that.

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
    SetOutPath $TEMP
    RMDir /r "$INSTDIR"
  ${endif}
!macroend
