import packageJson from '../package.json';

/** The running build. Electron's app.getVersion() reads this same package.json field. */
export const APP_VERSION: string = packageJson.version;
