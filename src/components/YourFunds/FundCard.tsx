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
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';

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

  async function joinFund() {
    const user = wallet.publicKey;
    if (!user) throw new Error('Wallet not connected');
    if (!wallet.signTransaction) throw new Error('Wallet does not support transaction signing');

    const [fundAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fund"), Buffer.from(fund.name)],
      programId,
    );
    const [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user.toBuffer()],
      programId,
    );

    const [rentReservePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("rent")],
      programId,
    )

    const [joinAggregatorPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("join-proposal-aggregator"), Buffer.from([0]), fundAccountPda.toBuffer()],
      programId,
    )

    const joinAggregatorPdaInfo = await connection.getAccountInfo(joinAggregatorPda);
    if (!joinAggregatorPdaInfo) {
      return;
    }
    const joinBuffer = Buffer.from(joinAggregatorPdaInfo.data);
    const numOfJoinProposals = joinBuffer.readUint32LE(33);
    let i = 0;

    for ( ; i < numOfJoinProposals; i++) {
      const joiner = new PublicKey(joinBuffer.slice(37 + i*57 , 69 + i*57));
      if (joiner.toBase58() === user.toBase58()) {
        break;
      }
    }

    const accounts = [
      { pubkey: fundAccountPda, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: userAccountPda, isSigner: false, isWritable: true },
      { pubkey: rentReservePda, isSigner: false, isWritable: true},
      { pubkey: joinAggregatorPda, isSigner: false, isWritable: true},
      { pubkey: fund.creator, isSigner: false, isWritable: true},
    ];

    const instructionTag = 3;
    const nameBytes = Buffer.from(fund.name, 'utf8');
    const buffer = Buffer.alloc(1 + 1 + nameBytes.length);
    let offset = 0;

    buffer.writeUInt8(instructionTag, offset);
    offset += 1;
    buffer.writeUint8(i, offset);
    offset += 1;
    nameBytes.copy(buffer, offset);

    const instructionData = buffer;

    const instruction = new TransactionInstruction({
      keys: accounts,
      programId,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey!;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    toast.success('Successfully joined the Fund!');
  }

  const getPercentage = (value: bigint, total: bigint) => {
    if (total === 0n) return 0;
    return Number((value*10000n) / total) / 100;
  }

// bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] border border-indigo-900/40 backdrop-blur-md rounded-xl p-6 shadow-[0_0_10px_#7c3aed33] hover:shadow-[0_0_20px_#a78bfa55] hover:scale-[1.015] transition-all duration-300 cursor-pointer group
 
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
            {fund.isEligible ? 'Eligible' : (BigInt(2)*fund.votesNo > fund.totalDeposit) ? 'Rejected' : 'Under Voting'}
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

      {/* Progress + Buttons */}
      <div className="flex flex-col gap-2 mt-4">
        {status === "pending" && (
          <>
            {/* Progress Bar */}
            <div className="relative h-3 rounded-full bg-gray-700 overflow-hidden w-full">
              {(() => {
                const green = fund.votesYes;
                const red = fund.votesNo;
                const total = fund.totalDeposit;
                const gray = total - green - red;

                const greenPct = getPercentage(green, total);
                const grayPct = getPercentage(gray, total);
                const redPct = getPercentage(red, total);

                return (
                  <>
                    <div
                      className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${greenPct}%` }}
                    />
                    <div
                      className="absolute left-0 top-0 h-full bg-gray-500 transition-all duration-500"
                      style={{ left: `${greenPct}%`, width: `${grayPct}%` }}
                    />
                    <div
                      className="absolute left-0 top-0 h-full bg-red-500 transition-all duration-500"
                      style={{
                        left: `${greenPct + grayPct}%`,
                        width: `${redPct}%`,
                      }}
                    />
                  </>
                );
              })()}
            </div>
          </>
        )}

        <div className="flex justify-end items-center mt-2 gap-3">
          {status !== "pending" && (
            <button className="flex items-center text-sm font-semibold text-indigo-400 hover:text-indigo-200 transition-all">
              View Details
              <ArrowRight className="ml-1 w-4 h-4" />
            </button>
          )}
          {status === "pending" && fund.isEligible && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                joinFund();
              }}
              className="flex items-center text-lg px-3 rounded-xl font-semibold text-indigo-400 hover:text-indigo-200 transition-all"
            >
              Join
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
