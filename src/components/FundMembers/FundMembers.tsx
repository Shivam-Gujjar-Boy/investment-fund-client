import { PublicKey } from '@solana/web3.js';
import { toast } from 'react-hot-toast';

interface FundMembersProps {
  members: PublicKey[] | undefined;
}

export default function FundMembers({ members }: FundMembersProps) {
  function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    console.log('Copied:', text);
    toast.success('Copied to clipboard!');
  }

  return (
    <div className="bg-[#1f2937] p-6 rounded-2xl h-[28rem] w-[40%] overflow-y-auto">
      <h2 className="text-xl font-semibold mb-4">Members</h2>
      <ul className="text-sm space-y-1">
        {members?.map((member, idx) => (
          <li key={idx} className="border-b border-gray-700 pb-1 cursor-pointer hover:underline transition" onClick={() => handleCopy(member.toBase58())}>
            {truncateAddress(member.toBase58())}
          </li>
        ))}
      </ul>
    </div>
  );
}