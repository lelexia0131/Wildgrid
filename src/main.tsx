import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerOfflineCache } from './platform/runtime';
import App from './ui/App';
import './ui/styles/styles.css';
import './ui/styles/viewport.css';
import './ui/styles/hints.css';
import './ui/styles/sandbox.css';
import './ui/styles/survival.css';
import './ui/styles/fonts.css';
import './ui/styles/hero.css';
import './ui/styles/notebook.css';
import './ui/styles/completion.css';
import './ui/styles/adventure-badges.css';
import './assets/art.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
registerOfflineCache();
