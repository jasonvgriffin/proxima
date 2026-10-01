const FRIENDLY = 'Proxima hit a problem. The details are in the log under %APPDATA%\\Proxima\\logs. You can keep playing.';

export function installErrorHandlers(notify: (message: string) => void) {
  let reporting = false;
  const report = (detail: string) => {
    if (reporting) return;
    reporting = true;
    try {
      void Promise.resolve(window.proxima?.reportError?.(detail)).catch(() => {});
    } catch {
      // ignore
    }
    try {
      notify(FRIENDLY);
    } catch {
      // ignore
    } finally {
      reporting = false;
    }
  };
  window.addEventListener('error', (event) => {
    report(event.error instanceof Error ? (event.error.stack || event.error.message) : event.message || 'error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    report(reason instanceof Error ? (reason.stack || reason.message) : String(reason));
  });
  window.proxima?.onFriendlyError?.((message) => notify(message));
}

export function showToast(message: string) {
  let node = document.querySelector('#toast') as HTMLElement | null;
  if (!node) {
    node = document.createElement('div');
    node.id = 'toast';
    document.body.appendChild(node);
  }
  node.hidden = false;
  node.textContent = message;
}
