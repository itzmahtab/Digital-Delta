import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[App] SW registered:', registration.scope);
      })
      .catch((error) => {
        console.error('[App] SW registration failed:', error);
      });
  });
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1B4F72',
            color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif',
          },
          success: {
            style: {
              background: '#1E8449',
            },
          },
          error: {
            style: {
              background: '#C0392B',
            },
          },
          loading: {
            style: {
              background: '#2E86C1',
            },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);