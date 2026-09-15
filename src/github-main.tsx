import React from 'react';
import ReactDOM from 'react-dom/client';

import { AuthShell } from '@/app/auth-shell';
import '@/app/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthShell />
  </React.StrictMode>,
);
