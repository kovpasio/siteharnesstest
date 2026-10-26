import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/manrope';
import '@fontsource-variable/space-grotesk';
import '@/index.css';
import App from '@/App';
import { AuthProvider } from '@/context/AuthContext';
import { SoundProvider } from '@/context/SoundContext';
import { ToastProvider } from '@/context/ToastContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SoundProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SoundProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
