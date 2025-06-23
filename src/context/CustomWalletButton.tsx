import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Wallet } from 'lucide-react';

export const CustomWalletButton = () => {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const handleClick = () => {
    if (connected) {
      disconnect();
    } else {
      setVisible(true);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="group relative px-3 py-2 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.001] hover:shadow-[0_0_10px_#8b5cf6aa] border border-purple-500/30"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-violet-600/20 to-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative flex items-center space-x-3">
        <Wallet className="w-5 h-5" />
        <span>
            {connected
                ? `${publicKey?.toBase58().slice(0, 4)}...${publicKey?.toBase58().slice(-4)}`
                : 'Connect Wallet'
            }
        </span>
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
    </button>
  );
};
