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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <Navbar />
      <main className="pt-16 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}