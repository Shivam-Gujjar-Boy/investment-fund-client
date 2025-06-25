import { useState } from 'react';
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
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [rentPaid, setRentPaid] = useState<number | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function joinFund() {
    try {
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

      let proposalIndex = 0;
      for ( let i = 0; i < numOfJoinProposals; i++) {
        const joiner = new PublicKey(joinBuffer.slice(37 + i*57 , 69 + i*57));
        if (joiner.toBase58() === user.toBase58()) {
          console.log('Itthe aaya mai');
          proposalIndex = joinBuffer.readUInt8(37 + (i+1)*57 - 1);
          break;
        }
      }

      console.log('proposal index:', proposalIndex);

      const [votePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('join-vote'), Buffer.from([proposalIndex]), fundAccountPda.toBuffer()],
        programId
      );

      const accounts = [
        { pubkey: fundAccountPda, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: userAccountPda, isSigner: false, isWritable: true },
        { pubkey: rentReservePda, isSigner: false, isWritable: true },
        { pubkey: joinAggregatorPda, isSigner: false, isWritable: true },
        { pubkey: votePda, isSigner: false, isWritable: true },
        { pubkey: fund.creator, isSigner: false, isWritable: true },
      ];

      const instructionTag = 3;
      const nameBytes = Buffer.from(fund.name, 'utf8');
      const buffer = Buffer.alloc(1 + 1 + nameBytes.length);
      let offset = 0;

      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      buffer.writeUint8(proposalIndex, offset);
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
      setIsConfirming(false);
      setShowJoinModal(false);

      toast.success('Successfully joined the Fund!');
    } catch (err) {
      console.log(err);
      setIsConfirming(false);
      toast.error('Error joining fund!');
    }
  }

  async function deleteProposal() {
    try {
      const user = wallet.publicKey;
      if (!user) throw new Error('Wallet not connected');
      if (!wallet.signTransaction) throw new Error('Wallet does not support transaction signing');

      const [joinerAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), user.toBuffer()],
        programId
      );

      const fundAccountPda = fund.fundPubkey;

      const [joinProposalAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('join-proposal-aggregator'), Buffer.from([0]), fundAccountPda.toBuffer()],
        programId
      );

      const joinProposalAggregatorInfo = await connection.getAccountInfo(joinProposalAggregatorPda);
      if (!joinProposalAggregatorInfo) return;

      const joinBuffer = Buffer.from(joinProposalAggregatorInfo.data);

      const numOfJoinProposals = joinBuffer.readUInt32LE(33);
      console.log('Number of join proposals:', numOfJoinProposals);
      let proposalIndex = 0;
      if (numOfJoinProposals === 0) {
        return;
      }

      for (let i=0; i<numOfJoinProposals; i++) {
        const joiner = new PublicKey(joinBuffer.slice(37 + i*57, 69 + i*57));
        if (joiner.toBase58() === user.toBase58()) {
          proposalIndex = joinBuffer.readUInt8(37 + (i+1)*57 - 1);
          break;
        }
      }

      const [voteAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('join-vote'), Buffer.from([proposalIndex]), fundAccountPda.toBuffer()],
        programId
      );

      const [rentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('rent')],
        programId
      );

      const instructionTag = 12;
      console.log(fund.name);
      const nameBytes = Buffer.from(fund.name, 'utf8');
      const buffer = Buffer.alloc(1 + 1 + nameBytes.length);
      let offset = 0;
      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      buffer.writeUInt8(proposalIndex, offset);
      offset += 1;
      nameBytes.copy(buffer, offset);

      const instructionData = buffer;
      console.log(instructionData);

      const instruction = new TransactionInstruction({
        keys: [
          {pubkey: user, isSigner: true, isWritable: false},
          {pubkey: joinerAccountPda, isSigner: false, isWritable: true},
          {pubkey: fundAccountPda, isSigner: false, isWritable: true},
          {pubkey: joinProposalAggregatorPda, isSigner: false, isWritable: true},
          {pubkey: voteAccountPda, isSigner: false, isWritable: true},
          {pubkey: rentPda, isSigner: false, isWritable: true}
        ],
        programId,
        data: instructionData
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

      toast.success('Successfully Deleted Join Proposal');
      setIsDeleting(false);
      setShowDeleteModal(false);
    } catch (err) {
      console.log(err);
      toast.error('Failed to delete join proposal');
      setIsDeleting(false);
    }
  }

  // const getPercentage = (value: bigint, total: bigint) => {
  //   if (total === 0n) return 0;
  //   return Number((value*10000n) / total) / 100;
  // }
  
  const openJoinModal = async () => {
    setShowJoinModal(true);
    setRentPaid(null);
    const governanceRentExempt = await connection.getMinimumBalanceForRentExemption(327 + fund.name.length);
    const rent = 0.00575 + governanceRentExempt / 1_000_000_000;
    console.log(fund);
    if (fund.expectedMembers && fund.expectedMembers > 0) {
      const rentPaid = rent / fund.expectedMembers;
      setRentPaid(rentPaid);
    } else {
      setRentPaid(0);
    }
  }

  const openDeleteModal = () => {
    setShowDeleteModal(true);
  }

  return (
    <>
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
          {/* {status === 'pending' && (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              fund.isEligible ?
              'bg-green-500/20 text-green-300 border border-green-300/30' :
              (BigInt(2)*fund.votesNo > fund.totalDeposit) ?
              'bg-red-500/20 text-red-300 border border-red-300/30' :
              'bg-yellow-500/20 text-yellow-300 border border-yellow-300/30'
            } shadow-sm`}>
              {fund.isEligible ? 'Eligible' : (BigInt(2)*fund.votesNo > fund.totalDeposit) ? 'Rejected' : 'Under Voting'}
            </span>
          )} */}
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
          <div className='flex justify-between'>
            <div className='flex flex-col gap-2'>
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
            </div>
            <div className='flex items-center justify-end'>
              <p className={`text-lg font-bold ${
                fund.is_private ?
                'text-red-300' :
                'text-green-300'
              }`}>{fund.is_private ? 'Private' : 'Public'}</p>
            </div>
          </div>

          {/* Progress + Buttons */}
          <div className="flex flex-col gap-2 mt-4">
            {status === "pending" && (
              <>
                {/* Progress Bar */}
                {/* <div className="relative h-3 rounded-full bg-gray-700 overflow-hidden w-full">
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
                          className="absolute left-0 top-0 h-full bg-red-500 transition-all duration-500"
                          style={{ left: `${greenPct}%`, width: `${redPct}%` }}
                        />
                        <div
                          className="absolute left-0 top-0 h-full bg-gray-500 transition-all duration-500"
                          style={{
                            left: `${greenPct + redPct}%`,
                            width: `${grayPct}%`,
                          }}
                        />
                      </>
                    );
                  })()}
                </div> */}
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
                    openJoinModal();
                  }}
                  className="flex items-center text-lg px-3 rounded-xl font-semibold text-indigo-400 hover:text-indigo-200 transition-all"
                >
                  Join
                </button>
              )}
              {status === "pending" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openDeleteModal();
                  }}
                  className='flex items-center text-lg px-3 rounded-xl font-semibold text-indigo-400 hover:text-indigo-200 transition-all'
                >
                  Delete Proposal
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {showJoinModal && (
        <div onClick={(e) => {
          if (e.target === e.currentTarget) setShowJoinModal(false);
        }} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md">
          <div className="bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] p-6 rounded-2xl w-[90%] max-w-md border border-indigo-900/40 shadow-[0_0_25px_#7c3aed33] text-white space-y-6 animate-fadeIn">

            {/* Heading */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-indigo-300">Joining This Fund</h2>

              {/* Info Text */}
              <p className="text-sm text-indigo-100 leading-relaxed">
                You will need to pay a small amount of{" "}
                {rentPaid === null ? (
                  <span className="inline-block w-20 h-4 bg-indigo-700/30 rounded-md animate-pulse" />
                ) : (
                  <span className="font-semibold text-indigo-400">
                    {rentPaid.toFixed(5)}
                  </span>
                )}{" "}
                <span className='text-indigo-400'>SOL (fund creation) + <span className='font-semibold'>0.00022</span> SOL (fund’s accommodation)</span> to join this fund. 
                Also, you get <span className='text-green-500 font-semibold'>0.00039 SOL</span><br />
                <span>This cost will be refunded to the fund's creator.</span>
              </p>

              {/* Total */}
              <p className="pt-1">
                Required:&nbsp;
                {rentPaid === null ? (
                  <span className="inline-block w-24 h-5 bg-indigo-700/30 rounded-md animate-pulse" />
                ) : (
                  <span className="text-green-400 font-medium">{(rentPaid + 0.00022 - 0.00039).toFixed(5)} SOL</span>
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowJoinModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsConfirming(true);
                  joinFund();
                }}
                disabled={isConfirming}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  isConfirming ?
                  'bg-gray-600 cursor-not-allowed' :
                  'bg-indigo-500 hover:bg-indigo-400'
                } text-white transition-all duration-200 shadow-[0_0_10px_#6366f1aa]`}
              >
                {isConfirming ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div onClick={(e) => {
          if (e.target === e.currentTarget) setShowDeleteModal(false);
        }} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md">
          <div className="bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] p-6 rounded-2xl w-[90%] max-w-md border border-indigo-900/40 shadow-[0_0_25px_#7c3aed33] text-white space-y-6 animate-fadeIn">

            {/* Heading */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-indigo-300">Deleting Join Proposal</h2>

              {/* Info Text */}
              <p className="text-sm text-indigo-100 leading-relaxed">
                You will get
                <span className='text-indigo-400'> 0.00074 SOL</span> after deleting this proposal. <br />
              </p>

              {/* Total */}
              <p className="pt-1">
                Refund:&nbsp;
                  <span className="text-green-400 font-medium"> +0.00074 SOL</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsDeleting(true);
                  deleteProposal();
                }}
                disabled={isDeleting}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  isDeleting ?
                  'bg-gray-600 cursor-not-allowed' :
                  'bg-indigo-500 hover:bg-indigo-400'
                } text-white transition-all duration-200 shadow-[0_0_10px_#6366f1aa]`}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
