import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Application Render Error:", error);
  rootElement.innerHTML = `
    <div style="padding: 2rem; color: #ef4444; background: #0f172a; font-family: monospace; height: 100vh;">
      <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">System Error</h1>
      <p>Unable to load the application.</p>
      <pre style="background: #1e293b; padding: 1rem; border-radius: 0.5rem; overflow: auto; margin-top: 1rem;">${error instanceof Error ? error.message : String(error)}</pre>
    </div>
  `;
}