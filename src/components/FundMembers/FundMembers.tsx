import { useEffect, useState } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { toast } from 'react-hot-toast';

interface FundMembersProps {
  members: PublicKey[] | undefined;
  governanceMint: PublicKey | null;
}

interface MemberInfo {
  pubkey: PublicKey;
  balance: number;
}

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

export default function FundMembers({ members, governanceMint }: FundMembersProps) {
  const [memberInfos, setMemberInfos] = useState<MemberInfo[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [animate, setAnimate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!members || !governanceMint) return;

    const fetchBalances = async () => {
      setLoading(true);
      try {
        const infos: MemberInfo[] = [];

        for (const member of members) {
          try {
            const ata = await getAssociatedTokenAddress(governanceMint, member);
            const accountInfo = await getAccount(connection, ata);
            const balance = Number(accountInfo.amount);
            infos.push({ pubkey: member, balance });
          } catch (err) {
            console.warn(`Could not fetch account for ${member.toBase58()}:`, err);
            infos.push({ pubkey: member, balance: 0 });
          }
        }

        setMemberInfos(infos);
        setTotalBalance(infos.reduce((sum, i) => sum + i.balance, 0));

        // Delay animation trigger to allow DOM to render first
        setTimeout(() => setAnimate(true), 100);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch balances:', error);
        toast.error('Error fetching member balances');
      }
    };
    
    fetchBalances();
  }, [members, governanceMint]);

  function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  }

  return loading ? (
    <div className="bg-[#1f2937] p-6  h-[28rem] w-[25%] animate-pulse space-y-4">
      <div className="h-6 w-32 bg-gray-700 rounded mb-4"></div>
      <ul className="space-y-4">
        {[...Array(5)].map((_, idx) => (
          <li key={idx} className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-gray-700 rounded"></div>
              <div className="h-4 w-12 bg-gray-700 rounded"></div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div className="h-2.5 w-1/2 bg-gray-600 rounded-full"></div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <div className="bg-[#1f2937] p-6  h-[28rem] w-[25%] overflow-y-auto">
      <h2 className="text-xl font-semibold mb-4">Members</h2>
      <ul className="space-y-4 text-sm">
        {memberInfos.map(({ pubkey, balance }) => {
          const percentage = totalBalance > 0 ? (balance / totalBalance) * 100 : 0;
          const shortAddr = truncateAddress(pubkey.toBase58());

          return (
            <li key={pubkey.toBase58()} className="cursor-pointer" onClick={() => handleCopy(pubkey.toBase58())}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-200">{shortAddr}</span>
                <span className="text-green-400 font-medium">{percentage.toFixed(2)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-400 to-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: animate ? `${percentage}%` : `0%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
