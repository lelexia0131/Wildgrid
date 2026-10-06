import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './viewport.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
if (import.meta.env.PROD && ['http:', 'https:'].includes(location.protocol) && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}); });
}
