import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/700.css';
import '@fontsource/fraunces/600.css';
import './styles.css';
import { App } from './ui/app';

const root = document.querySelector('#app');
if (!root) throw new Error('Proxima has no #app root');
new App(root as HTMLElement);
