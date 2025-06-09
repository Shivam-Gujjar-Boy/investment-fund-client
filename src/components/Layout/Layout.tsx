import { ReactNode } from 'react';
import Navbar from './Navbar';
import { useWallet } from '@solana/wallet-adapter-react';
import { Navigate } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { connected } = useWallet();

  if (!connected) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-16 min-w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
