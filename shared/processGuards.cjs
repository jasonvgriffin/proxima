const FRIENDLY = 'Proxima hit a problem. The details are in the log under %APPDATA%\\Proxima\\logs. You can keep playing.';

function installProcessGuards(target, log, notify) {
  const handle = (error) => {
    try {
      const text = error instanceof Error ? (error.stack || error.message) : String(error);
      log.write('error', text);
    } catch {
      // ignore
    }
    try {
      notify(FRIENDLY);
    } catch {
      // ignore
    }
  };
  target.on('uncaughtException', handle);
  target.on('unhandledRejection', (reason) => {
    handle(reason instanceof Error ? reason : new Error(String(reason)));
  });
}

module.exports = { installProcessGuards, FRIENDLY };
