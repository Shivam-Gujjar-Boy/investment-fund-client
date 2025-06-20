import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { Fund, programId } from '../types';
import Proposals from '../components/Proposals/Proposals';
import JoinProposals from '../components/JoinProposals/JoinProposals';
import FundMembers from '../components/FundMembers/FundMembers';
import FundGraph from '../components/FundGraph/FundGraph';
import { Metaplex } from '@metaplex-foundation/js';
import FundHoldings from '../components/FundHoldings/FundHoldings';
import  GlobalSocketListener  from './GlobalSocketListener'; 
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';


export default function FundDetails() {
  const [fund, setFund] = useState<Fund | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIncrementModal, setShowIncrementModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isYesVoting, setIsYesVoting] = useState(false);
  const [isNoVoting, setIsNoVoting] = useState(false);
  const [newSize, setNewSize] = useState('');
  const [newIntSize, setIntNewSize] = useState(0);
  const [refundType, setRefundType] = useState('power');

  const wallet = useWallet();
  const { connection } = useConnection();
  const { fundId } = useParams();
  const metaplex = Metaplex.make(connection);

  const fetchFundData = useCallback(async () => {
    if (!wallet.publicKey) {
      return;
    }

    if (!fundId) {
      toast.error('Fund Id not found');
      return;
    }
    const fundAccountPda = new PublicKey(fundId);

    try {
      const accountInfo = await connection.getAccountInfo(fundAccountPda);
      if (!accountInfo) {
        toast.error('Fund Id not found');
        return;
      }
      const buffer = Buffer.from(accountInfo?.data);
      const name_dummy = buffer.slice(0, 26).toString();
      let name = '';
      for (const c of name_dummy) {
        if (c === '\x00') break;
        name += c;
      }
      const members: PublicKey[] = [];
      const numOfMembers = buffer.readUInt32LE(114);
      for (let i = 0; i < numOfMembers; i++) {
        members.push(new PublicKey(buffer.slice(118 + 32 * i, 150 + 32 * i)));
      }
      const isRefunded = buffer.readUInt8(26) ? true : false;
      const expectedMembers = buffer.readUint32LE(27);
      const creatorExists = buffer.readUInt8(31) ? true : false;
      const creator = new PublicKey(buffer.slice(118, 150));
      const totalDeposit = buffer.readBigInt64LE(32);
      const governanceMint = new PublicKey(buffer.slice(40, 72));
      const vault = new PublicKey(buffer.slice(72, 104));
      const currentIndex = buffer.readUInt8(104);
      const created_at = buffer.readBigInt64LE(105);
      const is_private = buffer.readUInt8(113);

      const [incrementProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('increment-proposal-account'), fundAccountPda.toBuffer()],
        programId
      );

      let underIncrementation = false;
      let incrementProposer: PublicKey | null;
      const incrementProposalInfo = await connection.getAccountInfo(incrementProposalPda);
      if (!incrementProposalInfo) {
        underIncrementation = false;
        incrementProposer = null;
      } else {
        underIncrementation = true;
        const incrementBuffer = Buffer.from(incrementProposalInfo.data);
        incrementProposer = new PublicKey(incrementBuffer.slice(0, 32));
      }

      setFund({
        fund_address: fundAccountPda,
        name,
        expectedMembers,
        creatorExists,
        creator,
        numOfMembers,
        members,
        totalDeposit,
        governanceMint,
        vault,
        currentIndex,
        created_at,
        is_private,
        underIncrementation,
        incrementProposer,
        isRefunded
      });
    } catch (err) {
      toast.error('Error fetching fund data');
      console.log(err);
    }
  }, [fundId, connection, wallet.publicKey]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchFundData();
      setLoading(false);
    };

    load();
  }, [fetchFundData]);

  const createIncrementProposal = async (newSize: number, refundType: number) => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    if (!fund) return;
    const user = wallet.publicKey;

    try {
      const [fundAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('fund'), Buffer.from(fund.name)],
        programId
      );

      const [incrementProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('increment-proposal-account'), fundAccountPda.toBuffer()],
        programId
      );

      const userTokenAccount = await getAssociatedTokenAddress(
        fund.governanceMint,
        user,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const [rentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('rent')],
        programId
      );

      const instructionTag = 14;
      const nameBytes = Buffer.from(fund.name, 'utf8');
      const buffer = Buffer.alloc(1 + 1 + 4 + nameBytes.length);
      let offset = 0;

      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      buffer.writeUInt8(refundType, offset);
      offset += 1;
      buffer.writeUInt32LE(newSize, offset);
      offset += 4;
      nameBytes.copy(buffer, offset);

      const instructionData = buffer;

      const instruction = new TransactionInstruction({
        keys: [
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: incrementProposalPda, isSigner: false, isWritable: true},
          {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: fundAccountPda, isSigner: false, isWritable: true},
          {pubkey: fund.governanceMint, isSigner: false, isWritable: true},
          {pubkey: userTokenAccount, isSigner: false, isWritable: true},
          {pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: rentPda, isSigner: false, isWritable: true}
        ],
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

      setIsCreating(false);
      setShowIncrementModal(false);
      toast.success('Fund Size Increment Proposal created successfully');
    } catch (err) {
      console.log(err);
      setIsCreating(false);
      toast.error('Failed to create fund size increment proposal')
    }
  }

  const voteOnIncrementProposal = async (vote: number) => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    if (!fund) return;
    const user = wallet.publicKey;

    try {
      const [fundAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('fund'), Buffer.from(fund.name)],
        programId
      );

      const [incrementProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('increment-proposal-account'), fundAccountPda.toBuffer()],
        programId
      );

      const tokenAccount = await getAssociatedTokenAddress(
        fund.governanceMint,
        user,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const [rentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('rent')],
        programId
      );

      const incrementProposalInfo = await connection.getAccountInfo(incrementProposalPda);
      if (!incrementProposalInfo) return;
      const incrementBuffer = Buffer.from(incrementProposalInfo.data);
      const proposer = new PublicKey(incrementBuffer.slice(0, 32));

      const instructionTag = 15;
      const nameBytes = Buffer.from(fund.name, 'utf8');
      const buffer = Buffer.alloc(1 + 1 + nameBytes.length);
      let offset = 0;

      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      buffer.writeUInt8(vote, offset);
      offset += 1;
      nameBytes.copy(buffer, offset);

      const instructionData = buffer;

      const instruction = new TransactionInstruction({
        keys: [
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: incrementProposalPda, isSigner: false, isWritable: true},
          {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: fundAccountPda, isSigner: false, isWritable: true},
          {pubkey: fund.governanceMint, isSigner: false, isWritable: true},
          {pubkey: tokenAccount, isSigner: false, isWritable: false},
          {pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: proposer, isSigner: false, isWritable: true},
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

      setIsYesVoting(false);
      setIsNoVoting(false);
      setShowVoteModal(false);
      toast.success('Voted Successfully');
    } catch (err) {
      console.log(err);
      setIsYesVoting(false);
      setIsNoVoting(false);
      toast.error('Error Voting!');
    }
  }

  const openVoteModal = async () => {
    if (!fund) return;
    setShowVoteModal(true);
    const [incrementProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('increment-proposal-account'), fund?.fund_address.toBuffer()],
        programId
    );

    const incrementProposalInfo = await connection.getAccountInfo(incrementProposalPda);
    if (!incrementProposalInfo) {
      setShowVoteModal(false);
      return;
    }
    const incrementBuffer = Buffer.from(incrementProposalInfo.data);
    const newIntSize = incrementBuffer.readUInt32LE(32);
    setIntNewSize(newIntSize);
  }

  const deleteIncrementProposal = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    if (!fund) return;
    const user = wallet.publicKey;

    try {
      const [fundAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('fund'), Buffer.from(fund.name)],
        programId
      );

      const [incrementProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('increment-proposal-account'), fundAccountPda.toBuffer()],
        programId
      );

      const [rentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('rent')],
        programId
      );

      const instructionTag = 16;
      const nameBytes = Buffer.from(fund.name, 'utf8');
      const buffer = Buffer.alloc(1 + nameBytes.length);
      let offset = 0;

      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      nameBytes.copy(buffer, offset);

      const instructionData = buffer;

      const instruction = new TransactionInstruction({
        keys: [
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: incrementProposalPda, isSigner: false, isWritable: true},
          {pubkey: fundAccountPda, isSigner: false, isWritable: true},
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

      setIsDeleting(false);
      setShowDeleteModal(false);
      toast.success('Voted Successfully');
    } catch (err) {
      console.log(err);
      setIsDeleting(false);
      toast.error('Error Voting!');
    }
  }

  if (!fund) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#0e1117] to-[#1b1f27] min-h-screen">
        <div className="flex flex-col items-center space-y-6">
          {/* Glowing Spinner */}
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-purple-600 opacity-30 animate-ping"></div>
            <div className="w-full h-full border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>

          {/* Text with glow */}
          <p className="text-purple-400 text-xl font-semibold animate-pulse drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">
            Fetching fund data...
          </p>
        </div>
      </div>
    );
  }

  const actionLabel = !fund?.underIncrementation && ((fund?.expectedMembers ?? 0) <= (fund?.members.length ?? 0))
    ? 'Upgrade'
    : !fund?.underIncrementation && (fund?.expectedMembers ?? 0 > (fund?.members.length ?? 0))
    ? 'All Set'
    : fund?.incrementProposer?.toBase58() === wallet.publicKey?.toBase58()
      ? 'Delete'
      : 'Vote';

  const getButtonClasses = () => {
    switch (actionLabel) {
      case 'Upgrade':
        return 'bg-gradient-to-tr from-purple-500 to-pink-500';
      case 'Delete':
        return 'bg-gradient-to-tr from-red-600 to-orange-500';
      case 'Vote':
        return 'bg-gradient-to-tr from-cyan-400 to-teal-500 shadow-[0_0_15px_#22d3ee80] animate-pulse';
      default:
        return '';
    }
  };

  return (
    <>
      <div className="p-2 text-white min-h-screen w-full bg-gradient-to-b from-[#0e1117] to-[#1b1f27]">
        <GlobalSocketListener currentFundPubkey={fund?.fund_address?.toBase58() || null} />
        <div className="flex relative">
          {/* Left Scrollable Section */}
          <div className="w-[74%] overflow-y-auto">
            <div className="flex flex-col gap-2">
              {/* Details, Graph, Members, and Holdings */}
              {fund ? (
              <div className="w-full p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-lg shadow-xl text-white flex flex-wrap justify-between items-top transition-all duration-300 hover:shadow-2xl hover:border-white/20 group animate-fadeIn">
                {/* Fund Name */}
                <div className="flex flex-col gap-1 w-[20%]">
                  <p className="text-xs uppercase tracking-widest text-white/50 group-hover:text-white/70 transition-all">Fund Name</p>
                  <p className="text-2xl font-bold text-cyan-400 tracking-wide group-hover:scale-105 transition-transform">{fund?.name}</p>
                </div>

                <div className="flex flex-col gap-2 w-[25%]">
                  <p className="text-xs uppercase tracking-widest text-white/50 group-hover:text-white/70 transition-all">Members</p>

                  {/* Progress Bar */}
                  <div className="relative w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-cyan-400 transition-all duration-700 ease-out"
                      style={{
                        width: `${(fund?.members.length / fund?.expectedMembers) * 100}%`,
                      }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between mt-0.5 px-3 py-2 rounded-xl bg-white/5 transition-all duration-300">
                    {/* Members Count */}
                    <p className="text-sm font-semibold text-white tracking-wide">
                      <span className="text-green-400">{fund?.members.length}</span>
                      <span className="text-white/50"> / {fund?.expectedMembers}</span> Members
                    </p>

                    {/* Upgrade Button */}
                    <button 
                      onClick={() => {
                        if (actionLabel === 'Upgrade') {
                          setShowIncrementModal(true);
                        } else if (actionLabel === 'Delete') {
                          setShowDeleteModal(true);
                        } else if (actionLabel === 'Vote') {
                          openVoteModal();
                        } else {
                          setShowInfoModal(true);
                        }
                      }}
                      className={`text-xs font-semibold px-3 py-1 rounded-md text-white transition-all duration-200 shadow-md hover:scale-105 hover:shadow-lg ${getButtonClasses()}`}
                    >
                      {actionLabel}
                    </button>
                  </div>
                </div>


                {/* Contribution */}
                <div className="flex flex-col gap-1 w-[15%]">
                  <p className="text-xs uppercase tracking-widest text-white/50 group-hover:text-white/70 transition-all">Your Contribution</p>
                  <p className="text-2xl font-semibold text-purple-400 group-hover:scale-105 transition-transform">
                    {1.111.toFixed(2)}%
                  </p>
                </div>

                {/* Created At */}
                <div className="flex flex-col gap-1 w-[12%]">
                  <p className="text-xs uppercase tracking-widest text-white/50 group-hover:text-white/70 transition-all">Created At</p>
                  <p className="text-lg font-medium text-yellow-400 group-hover:scale-105 transition-transform">
                    {new Date(Number(fund?.created_at ?? BigInt(0)) * 1000).toLocaleDateString()}
                  </p>
                </div>
              </div>
              ) : (<></>)}


              <div className="flex gap-2">
                {/* Members */}
                {loading ? (
                  <div className="bg-[#1f2937] p-6 h-[28rem] w-[25%] animate-pulse space-y-4 rounded-xl">
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
                  fund && <FundMembers members={fund.members} governanceMint={fund.governanceMint} fund={fund} />
                )}
                <div className="flex gap-2 w-[75%]">
                  {/* Fund Graph */}
                  <FundGraph />
                  {/* Fund Holdings */}
                  <FundHoldings vault={fund?.vault} connection={connection} metaplex={metaplex} />
                </div>
              </div>
              {/* Join Proposals */}
              {loading ? (
                <div>
                </div>
              ) : (
                <>
                  {fund?.is_private ? <JoinProposals fund={fund} fundId={fundId} /> : <></>}
                </>
              )}
            </div>
          </div>

          {/* Fixed Proposals Section */}
          <div className="w-[25.2%] fixed right-2 top-19 h-[calc(100vh-1rem)]">
            {loading ? (
              <div className="bg-[#1f2937] rounded-xl h-[90%] animate-pulse flex flex-col">
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  <div className="h-6 w-32 bg-gray-700 rounded mb-4"></div>
                  {[...Array(4)].map((_, idx) => (
                    <div key={idx} className="bg-gray-800 p-4 rounded-xl space-y-2">
                      <div className="h-4 w-3/4 bg-gray-700 rounded"></div>
                      <div className="h-4 w-1/2 bg-gray-700 rounded"></div>
                      <div className="h-4 w-1/4 bg-gray-700 rounded"></div>
                      <div className="flex gap-2 mt-4">
                        <div className="h-6 w-20 bg-gray-700 rounded"></div>
                        <div className="h-6 w-14 bg-gray-700 rounded"></div>
                        <div className="h-6 w-14 bg-gray-700 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-700 bg-[#1f2937]">
                  <div className="w-full h-10 bg-gray-700 rounded-xl"></div>
                </div>
              </div>
            ) : (
              <div className="bg-[#1f2937] rounded-xl h-[90%] flex flex-col overflow-y-auto fancy-scrollbar">
                <Proposals fund={fund} fundId={fundId} />
              </div>
            )}
          </div>
        </div>

        {/* Custom Scrollbar Styles */}
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
            background: #6366f1;
          }
          
          .hide-scrollbar {
            -ms-overflow-style: none;  /* Internet Explorer 10+ */
            scrollbar-width: none;  /* Firefox */
          }
          .hide-scrollbar::-webkit-scrollbar { 
            display: none;  /* Safari and Chrome */
          }
        `}</style>
      </div>
      {showIncrementModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIncrementModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md"
        >
          <div className="bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] p-6 rounded-2xl w-[90%] max-w-md border border-indigo-900/40 shadow-[0_0_25px_#7c3aed33] text-white space-y-6 animate-fadeIn">

            {/* Heading */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-indigo-300">Increase Fund Members Limit</h2>
            </div>

            {/* Input + Explanation */}
            <div className="flex flex-col gap-3">

              {/* Number Input */}
              <input
                type="number"
                placeholder="Enter increment amount"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 text-white placeholder-white/50 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 shadow-inner backdrop-blur-sm"
              />

              {/* Explanation */}
              <p className="text-sm text-indigo-200 bg-indigo-900/20 px-3 py-2 rounded-xl shadow-inner border border-indigo-700/40">
                <span className="font-semibold text-indigo-300">Note:</span> A fee of <span className="text-purple-400">0.00151 SOL</span> will be temporarily deducted if your voting power is under 50%. Upon proposal execution or deletion, you'll be <span className="text-green-400">fully refunded</span>. You may choose to get the refund as either SOL or <span className="text-yellow-400">voting power equivalent</span> to a 0.00151 SOL deposit into the fund.
              </p>

              {/* Toggle Bar */}
              <div className="w-full bg-white/10 rounded-xl p-1 flex justify-between items-center border border-indigo-700/30 shadow-inner">
                <button
                  onClick={() => setRefundType('power')}
                  className={`w-1/2 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    refundType === 'power'
                      ? 'bg-indigo-500 text-white shadow-md'
                      : 'text-indigo-300 hover:bg-white/5'
                  }`}
                >
                  Voting Power
                </button>
                <button
                  onClick={() => setRefundType('sol')}
                  className={`w-1/2 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    refundType === 'sol'
                      ? 'bg-indigo-500 text-white shadow-md'
                      : 'text-indigo-300 hover:bg-white/5'
                  }`}
                >
                  SOL
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowIncrementModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsCreating(true);
                    createIncrementProposal(Number(newSize), refundType === 'sol' ? 1 : 0);
                  }}
                  disabled={isCreating || !newSize}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    isCreating || !newSize
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-indigo-500 hover:bg-indigo-400'
                  } text-white transition-all duration-200 shadow-[0_0_10px_#6366f1aa]`}
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showVoteModal && (
        <div onClick={(e) => {
          if (e.target === e.currentTarget) setShowVoteModal(false);
        }} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md">
          <div className="bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] p-6 rounded-2xl w-[90%] max-w-md border border-indigo-900/40 shadow-[0_0_25px_#7c3aed33] text-white space-y-6 animate-fadeIn">

            {/* Heading */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-indigo-300">Vote to increase Fund members limit to {newIntSize}</h2>

              {/* Info Text */}
            </div>

            {/*Action Buttons */}
            <div className="flex flex-col gap-3">

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowVoteModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsYesVoting(true);
                    voteOnIncrementProposal(1);
                  }}
                  disabled={isYesVoting}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    isYesVoting
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-400'
                  } text-white transition-all duration-200 shadow-[0_0_10px_#6366f1aa]`}
                >
                  Yes
                </button>
                <button
                  onClick={() => {
                    setIsNoVoting(true);
                    voteOnIncrementProposal(0);
                  }}
                  disabled={isNoVoting}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    isNoVoting
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-red-500 hover:bg-red-400'
                  } text-white transition-all duration-200 shadow-[0_0_10px_#6366f1aa]`}
                >
                  No
                </button>
              </div>
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
              <h2 className="text-2xl font-bold text-indigo-300">Delete Your Increment Proposal</h2>

              {/* Info Text */}
            </div>

            {/* Input + Action Buttons */}
            <div className="flex flex-col gap-3 pt-4">

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsDeleting(true);
                    deleteIncrementProposal();
                  }}
                  disabled={isDeleting}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    isDeleting
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-indigo-500 hover:bg-indigo-400'
                  } text-white transition-all duration-200 shadow-[0_0_10px_#6366f1aa]`}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showInfoModal && (
        <div onClick={(e) => {
          if (e.target === e.currentTarget) setShowInfoModal(false);
        }} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md">
          <div className="bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] p-6 rounded-2xl w-[90%] max-w-md border border-indigo-900/40 shadow-[0_0_25px_#7c3aed33] text-white space-y-6 animate-fadeIn">

            {/* Heading */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-indigo-300">Members Count Info</h2>

              {/* Info Text */}
              <p className='text-sm'>
                Fund still has vacant positions for new members. Once the fund is filled, anyone can initiate the Fund Limit Increment Proposal by clicking on the <span className='font-semibold text-violet-400'>Upgrade</span> button, and entering the New Fund Size Limit.
              </p>
              {fund.creator.toBase58() === wallet.publicKey?.toBase58() && !fund.isRefunded ? (
                <p className="text-sm text-violet-300 bg-violet-950/40 border border-violet-600 px-4 py-2 rounded-2xl shadow-md backdrop-blur-sm hover:shadow-violet-700/30 transition duration-300">
                  You’ll get the fund creation refund automatically when the fund is <span className='font-semibold text-red-300'>FULL</span> (reaches {fund.expectedMembers} members).
                </p>
              ) : (
                fund.creator.toBase58() === wallet.publicKey?.toBase58() && fund.isRefunded ? (
                  <p className="text-sm text-violet-300 bg-violet-950/40 border border-violet-600 px-4 py-2 rounded-2xl shadow-md backdrop-blur-sm hover:shadow-violet-700/30 transition duration-300">
                    You've refunded the fund creations costs, since fund already reached the initial expected members.
                  </p>
                ) : (
                  <></>
                )
              )}
            </div>

            {/* Input + Action Buttons */}
            <div className="flex flex-col gap-3 pt-4">

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-700 hover:bg-violet-600 text-white transition-all duration-200"
                >
                  Ok
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}