import { render } from 'solid-js/web';
import App from './App';
import { IS_TELEGRAM } from './utils/detection';

const root = document.getElementById('root')!;

if (IS_TELEGRAM && typeof document !== 'undefined') {
  document.documentElement.classList.add('tg-webapp');
  console.log('✅ Telegram WebApp detected, class "tg-webapp" added to <html>');
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => {
    document.addEventListener(ev, (e) => e.preventDefault());
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => {
    const tag = ((e.target as HTMLElement)?.tagName || '').toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => e.preventDefault());
} else {
  document.documentElement.classList.add('app-shell');
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => {
    const tag = ((e.target as HTMLElement)?.tagName || '').toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => e.preventDefault());
}

render(() => <App />, root);


