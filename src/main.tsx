import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WalletContextProvider } from './context/WalletContextProvider.tsx';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletContextProvider>
      <App />
    </WalletContextProvider>
  </StrictMode>,
);
