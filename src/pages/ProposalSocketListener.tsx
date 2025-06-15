// components/ProposalSocketListener.tsx
import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';

const socket = io(`https://peerfunds.onrender.com`, {
  transports: ['websocket'],
});

interface ActivityLog {
  fundName: string;
  logMessage: string;
  timestamp: string;
  signature: string;
  fund: string;
}

interface ProposalSocketListenerProps {
  currentFundPubkey: string | null; // Optional: to filter to specific fund
}

export default function ProposalSocketListener({ currentFundPubkey }: ProposalSocketListenerProps) {
  const fundRef = useRef<string | null>(currentFundPubkey);

  useEffect(() => {
    fundRef.current = currentFundPubkey;
  }, [currentFundPubkey]);

  useEffect(() => {
    const handleLog = (activity: ActivityLog) => {
      console.log('🌐 Global activity detected:', activity);

      // Optional filter
      if (fundRef.current && activity.fund !== fundRef.current && !activity.logMessage.includes("Proposal")) return;

      toast.custom((t) => (
        <div
          className={`bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-lg border border-teal-500 transition-all duration-300 ease-out ${
            t.visible ? 'animate-slide-in' : 'animate-slide-out'
          } hover:scale-[1.02] hover:shadow-[0_0_15px_#14b8a6aa]`}
          style={{ width: '600px', maxWidth: '90%' }}
        >
          <p className="text-sm font-medium">{activity.logMessage}</p>
        </div>
      ), {
        duration: 4000,
        position: 'top-right',
      });
    };

    socket.on('fund_activity', handleLog);
    return () => {
      socket.off('fund_activity', handleLog);
    };
  }, []);

  return null; // no UI
}
