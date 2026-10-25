import React from 'react';
import ReactDOM from 'react-dom/client';
import { LicenseForm } from '@/components/LicenseForm';
import '../popup/style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <main style={{ maxWidth: 420 }}>
      <h1>License settings</h1>
      <LicenseForm />
    </main>
  </React.StrictMode>,
);
