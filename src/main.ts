import './style.css';
import { startApp } from './app';
import { registerServiceWorker } from './pwa';

startApp();
if (import.meta.env.PROD) registerServiceWorker(navigator, window, document);
