import { useEffect, useState, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import io from 'socket.io-client';
import axios from 'axios';
import { Clock4 } from 'lucide-react';

const socket = io(`http://localhost:5000`, {
  transports: ['websocket']
}); // Make sure this is in your .env

interface ActivityLog {
  logMessage: string;
  timestamp: string; // stored as stringified bigint
  signature: string;
  fund: string; // optional, included in socket events
}

interface ActicityProps {
  fundAddress: PublicKey | undefined
}

export default function FundActivity({fundAddress}: ActicityProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const fundRef = useRef<string | null>(null);

  useEffect(() => {
    fundRef.current = fundAddress?.toBase58() || null;
  }, [fundAddress]);

  // Fetch historical logs
  useEffect(() => {
    if (!fundAddress) return;
    const fundPubkey = fundAddress.toBase58();
    axios.get(`http://localhost:5000/api/activity/${fundPubkey}`)
      .then(res => {
        setLogs(res.data.logs || []);
      })
      .catch(err => {
        console.error('Failed to fetch logs:', err);
      });
  }, [fundAddress]);

  // Listen for real-time logs
  useEffect(() => {
    const handleLog = (activity: ActivityLog) => {
      console.log('🔥 Incoming activity:', activity);

      if (!fundRef.current || activity.fund !== fundRef.current) return;
      setLogs(prev => [activity, ...prev]);
    };

    socket.on('fund_activity', handleLog);

    return () => {
      socket.off('fund_activity', handleLog);
    };
  }, []);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(Number(BigInt(timestamp)) * 1000);
      return date.toLocaleString(); // or toLocaleTimeString() for just time
    } catch (err) {
      console.log(err);
      return 'Invalid time';
    }
  };

  return (
    <div className="bg-gradient-to-b from-[#111827] to-[#0f172a] p-6 rounded-2xl shadow-xl border border-[#2c3e50]/50 max-h-80 overflow-y-auto fancy-scrollbar">
      <h2 className="text-2xl font-bold text-white mb-4 tracking-tight flex items-center gap-2">
        <Clock4 size={20} className="text-teal-400" />
        Recent Activity
      </h2>
      <ul className="space-y-3">
        {logs.length === 0 && (
          <li className="text-gray-500 italic text-sm">No activity yet</li>
        )}
        {logs.map((log, idx) => (
          <li
            key={idx}
            className="bg-[#1e293b]/50 border border-[#334155]/50 rounded-xl px-4 py-3 transition-all duration-300 hover:border-teal-500 hover:shadow-md group flex justify-between items-start"
          >
            <div className="flex flex-col">
              <span className="text-sm text-gray-100">{log.logMessage}</span>
              <span className="text-xs text-gray-500 mt-1 group-hover:text-teal-400 transition">
                Signature: {log.signature.slice(0, 6)}...{log.signature.slice(-6)}
              </span>
            </div>
            <span
              className="text-[11px] text-gray-400 ml-3 mt-1 whitespace-nowrap tooltip"
              title={formatTime(log.timestamp)}
            >
              {new Date(Number(BigInt(log.timestamp)) * 1000).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>

      {/* Custom scrollbar styling */}
      <style>{`
        .fancy-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .fancy-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .fancy-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 9999px;
        }
        .fancy-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #0d9488;
        }
      `}</style>
    </div>
  );
}
