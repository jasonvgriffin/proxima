import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('in-place upgrade', () => {
  it('keeps app data and registry deletes inside the update guard', () => {
    const nsh = readFileSync('build/installer.nsh', 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      build: { appId: string; nsis: { deleteAppDataOnUninstall: boolean } };
    };
    expect(pkg.build.appId).toBe('com.jasonvgriffin.proxima');
    expect(pkg.build.nsis.deleteAppDataOnUninstall).toBe(true);
    const start = nsh.indexOf('!macro customUnInstall');
    const end = nsh.indexOf('!macroend', start);
    const macro = nsh.slice(start, end);
    const guard = macro.indexOf('${ifNot} ${isUpdated}');
    const close = macro.lastIndexOf('${endif}');
    expect(guard).toBeGreaterThan(-1);
    const body = macro.slice(guard, close);
    expect(body).toContain('RMDir /r "$APPDATA\\Proxima"');
    expect(body).toContain('RMDir /r "$TEMP\\Proxima"');
    expect(body).toContain('DeleteRegKey HKCU "Software\\com.jasonvgriffin.proxima"');
    expect(body).toContain('DeleteRegKey HKCU "Software\\Proxima"');
    const before = macro.slice(0, guard);
    expect(before).not.toContain('RMDir');
    expect(before).not.toContain('DeleteRegKey');
  });

  it('the Windows workflow installs v0.4.0 and self-updates over it', () => {
    const workflow = readFileSync('.github/workflows/windows.yml', 'utf8');
    const script = readFileSync('.github/scripts/verify-upgrade.ps1', 'utf8');
    expect(workflow).toContain('verify-upgrade');
    expect(workflow).toContain('verify-upgrade.ps1');
    expect(workflow).toMatch(/needs: \[windows, verify-uninstall, verify-upgrade\]/);
    expect(script).toContain('v0.4.0');
    expect(script).toContain('Proxima-Setup-0.4.0.exe');
    expect(script).toContain('scripts\\apply-update.cjs');
    expect(script).toContain('--spawn');
    expect(script).toContain('slot-1.json');
    expect(script).toContain('UpgradeMarker');
    expect(script).toContain('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall');
    expect(script).toContain('WOW6432Node');
    expect(script).toContain('UninstallString directory');
    expect(script).toContain('Programs\\proxima');
    expect(script).toContain('Get-FileHash');
    expect(script).toContain('Test-VersionNewer');
    expect(workflow).toContain('0.4.1-ci.');
    expect(workflow).toContain('refs/tags/v');
    expect(workflow).toContain('apply-update.ps1');
    expect(workflow).not.toContain('0.3.1-ci.');
  });
});
