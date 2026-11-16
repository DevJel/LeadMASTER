import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const mount = document.getElementById('root');
if (!mount) throw new Error('LeadMASTER application root is missing.');
createRoot(mount).render(<App />);
