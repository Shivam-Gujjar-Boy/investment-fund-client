import { ArrowRight, Users, Calendar, Wallet } from 'lucide-react';
import {toast} from 'react-hot-toast';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  PublicKey, 
  TransactionInstruction, 
  Transaction,
} from '@solana/web3.js';
import { useNavigate } from 'react-router-dom';
import { UserFund, programId } from '../../types';
import { Buffer } from 'buffer';

interface FundCardProps {
  fund: UserFund;
  status: string;
}

export default function FundCard({ fund, status }: FundCardProps) {
  const navigate = useNavigate();
  const wallet = useWallet();
  const {connection} = useConnection();

  function formatTimestamp(timestamp: bigint): string {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    console.log('Copied:', text);
    toast.success('Copied to clipboard!');
  }

  const handleLeave = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return;
    }
    const user = wallet.publicKey;
    const [fundAccountPda] = PublicKey.findProgramAddressSync([
      Buffer.from("fund"),
      Buffer.from(fund.name),
    ], programId);

    const [userSpecificPda] = PublicKey.findProgramAddressSync([
      Buffer.from("user"),
      fundAccountPda.toBuffer(),
      user.toBuffer(),
    ], programId);

    const [userAccountPda] = PublicKey.findProgramAddressSync([
      Buffer.from("user"),
      user.toBuffer(),
    ], programId);

    try {
      const nameBytes = Buffer.from(fund.name);
      const instructionData = Buffer.from([9, ...nameBytes]);

      const instruction = new TransactionInstruction({
        keys: [
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: userSpecificPda, isSigner: false, isWritable: true},
          {pubkey: fundAccountPda, isSigner: false, isWritable: true},
          {pubkey: userAccountPda, isSigner: false, isWritable: true}
        ],
        programId,
        data: instructionData
      });

      const transaction = new Transaction().add(instruction);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign the transaction
      // transaction.partialSign(governanceMint);
      const signedTransaction = await wallet.signTransaction(transaction);
      
      // Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      // Use the non-deprecated version of confirmTransaction with TransactionConfirmationStrategy
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      toast.success("You lef the fund");
    } catch (err) {
      console.log(err);
      toast.error("Not removed from fund");
    }
  }
 
  return (
    <div
      onClick={() => {
        if (!fund.isPending) {
          navigate(`${fund.fundPubkey.toBase58()}`)
        }
      }}
      className="bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] border border-indigo-900/40 backdrop-blur-md rounded-xl p-6 shadow-[0_0_10px_#7c3aed33] hover:shadow-[0_0_20px_#a78bfa55] hover:scale-[1.015] transition-all duration-300 cursor-pointer group"
    >
      {/* Title + Status */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-2xl font-extrabold text-white tracking-tight group-hover:text-indigo-300 transition">
          {fund.name} 
        </h3>
        {status === 'inactive' && (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-300/30 shadow-sm">
            Inactive
          </span>
        )}
        {status === 'pending' && (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-300/30 shadow-sm">
            {fund.isEligible ? 'Eligible' : 'Not Eligible'}
          </span>
        )}
      </div>

      {/* Info Section */}
      <div className="space-y-4 mb-6 text-sm text-indigo-100">
        <div className="flex items-center">
          <Users className="w-4 h-4 mr-2 text-indigo-400" />
          {fund.numOfMembers.toString()} Members
        </div>
        <div className="flex items-center">
          <Wallet className="w-4 h-4 mr-2 text-indigo-400" />
          Total Value: <span className="ml-1 font-semibold text-indigo-200">{Number(fund.totalDeposit.toString()).toLocaleString()}</span>
        </div>
        <div className="flex items-center">
          <Calendar className="w-4 h-4 mr-2 text-indigo-400" />
          Created: <span className="ml-1 text-indigo-200">{formatTimestamp(fund.created_at)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-indigo-800/40 space-y-2 text-sm text-indigo-300">
        <div className="flex items-center gap-1">
          <span className="text-indigo-500">Fund Address:</span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(fund.fundPubkey.toBase58());
            }}
            className="hover:text-white hover:underline cursor-pointer transition"
          >
            {truncateAddress(fund.fundPubkey.toBase58())}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-indigo-500">Creator:</span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(fund.creator.toBase58());
            }}
            className="hover:text-white hover:underline cursor-pointer transition"
          >
            {truncateAddress(fund.creator.toBase58())}
          </span>
        </div>

        <div className="flex justify-end mt-4">
            {status !== 'pending' && (
              <button className="flex items-center text-sm font-semibold text-indigo-400 hover:text-indigo-200 transition-all">
                View Details
                <ArrowRight className="ml-1 w-4 h-4" />
              </button>
            )}
            {status === 'pending' && fund.isEligible && (
              <button className="flex items-center text-sm font-semibold text-indigo-400 hover:text-indigo-200 transition-all">
                Join
              </button>
            )}
        </div>
      </div>
    </div>
  );
}
