import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('[desktop/main] #root element not found');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
