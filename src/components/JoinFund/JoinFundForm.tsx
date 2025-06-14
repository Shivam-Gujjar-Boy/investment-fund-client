import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionInstruction, SystemProgram, Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { Fund, programId } from '../../types';
import { extractFundData } from '../../functions/extractFundData';
import { Buffer } from 'buffer';
// import { isSigner } from '@metaplex-foundation/js';

export default function JoinFundForm() {
  const [fundName, setFundName] = useState('');
  const [fundStatus, setFundStatus] = useState<{ exists: boolean; isPrivate: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected } = wallet;

  // Extract fund name from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setFundName(codeParam);
    }
  }, [location]);

  // Reset fundStatus when fundName changes
  useEffect(() => {
    setFundStatus(null);
  }, [fundName]);

  // Check fund status
  async function checkFundStatus() {
    if (!fundName.trim()) {
      toast.error('Please enter a fund name');
      return;
    }
    setLoading(true);
    try {
      const [fundAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fund"), Buffer.from(fundName)],
        programId,
      );
      const fundAccountInfo = await connection.getAccountInfo(fundAccountPda);
      if (!fundAccountInfo) {
        setFundStatus({ exists: false, isPrivate: false });
        toast.error(`No fund with name "${fundName}" exists`);
      } else {
        const fund: Fund | null = extractFundData(fundAccountInfo);
        if (!fund) {
          throw new Error('Failed to extract fund data');
        }
        setFundStatus({ exists: true, isPrivate: fund.is_private === 1 });
      }
    } catch (err) {
      console.error('Error checking fund status:', err);
      toast.error('Failed to check fund status');
    } finally {
      setLoading(false);
    }
  }

  // Join public fund
  async function joinPublicFund() {
    const user = wallet.publicKey;
    if (!user) throw new Error('Wallet not connected');
    if (!wallet.signTransaction) throw new Error('Wallet does not support transaction signing');

    const [fundAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fund"), Buffer.from(fundName)],
      programId,
    );
    const [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user.toBuffer()],
      programId,
    );
    const [rentAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("rent")],
      programId,
    );

    const accounts = [
      { pubkey: fundAccountPda, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: userAccountPda, isSigner: false, isWritable: true },
      { pubkey: rentAccountPda,isSigner: false, isWritable: true},
    ];

    const [joinProposalAggregatorAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("join-proposal-aggregator"), Buffer.from([0]), fundAccountPda.toBuffer()],
      programId,
    )

    const joinProposalInfo = await connection.getAccountInfo(joinProposalAggregatorAccount);
    if (!joinProposalInfo) {return;}
    const joinProposalBuffer = Buffer.from(joinProposalInfo.data); 
    const vecIndex = joinProposalBuffer.readUint32LE(33);

    const nameBytes = new TextEncoder().encode(fundName);
    const instructionData = Buffer.from([3,vecIndex, ...nameBytes]);

    const instruction = new TransactionInstruction({
      keys: accounts,
      programId,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = user;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    toast.success('Successfully joined the Fund!');
  }

  // Create join proposal for private fund (placeholder)
  async function createJoinProposal() {
    const user = wallet.publicKey;

    if (!user) throw new Error('Wallet not connected');
    if (!wallet.signTransaction) throw new Error('Wallet does not support transaction signing');

    const [fundAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fund"), Buffer.from(fundName)],
      programId,
    );
    const [joinProposalAggregatorAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("join-proposal-aggregator"), Buffer.from([0]), fundAccountPda.toBuffer()],
      programId,
    )

    const joinProposalInfo = await connection.getAccountInfo(joinProposalAggregatorAccount);
    if (!joinProposalInfo) {return;}
    const joinProposalBuffer = Buffer.from(joinProposalInfo.data); 
    const vecIndex = joinProposalBuffer.readUint32LE(33);

    const [joinVoteAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("join-vote"), Buffer.from([vecIndex]), fundAccountPda.toBuffer()],
      programId,
    )

    const accounts = [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: joinProposalAggregatorAccount, isSigner: false, isWritable: true },
      { pubkey: fundAccountPda, isSigner: false, isWritable: true },
      { pubkey: joinVoteAccount, isSigner: false, isWritable: true},
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const nameBytes = new TextEncoder().encode(fundName);
    const instructionData = Buffer.from([10,...nameBytes]); // Adjust based on your program

    const instruction = new TransactionInstruction({
      keys: accounts,
      programId,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = user;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    toast.success('Proposal created successfully!');
  }

  // Handle join fund action
  async function handleJoinFund() {
    if (!fundStatus || !fundStatus.exists) {
      return;
    }
    if (!wallet || !connected || !wallet.publicKey || !wallet.signTransaction) {
      toast.error('Please connect a wallet that supports transaction signing');
      return;
    }
    setLoading(true);
    try {
      if (!fundStatus.isPrivate) {
        await joinPublicFund();
      } else {
        await createJoinProposal();
      }
    } catch (err) {
      console.error('Error joining fund:', err);
      toast.error('Failed to join the fund');
    } finally {
      setLoading(false);
    }
  }

  const buttonText = fundStatus && fundStatus.exists ? 'Join Fund' : 'Check Fund Status';
  const buttonAction = fundStatus && fundStatus.exists ? handleJoinFund : checkFundStatus;

  return (
    <div className="max-w-2xl mx-auto bg-[#1e2035]/80 backdrop-blur-2xl border border-indigo-900 shadow-[0_0_10px_#6d28d9aa] rounded-2xl overflow-hidden transition-all">
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="flex flex-col items-center space-y-5">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_#9333ea99]"></div>
            <p className="text-indigo-200 text-lg font-medium animate-pulse">Processing...</p>
          </div>
        </div>
      ) : (
        <div className="p-8">
          <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">
            Join an Investment Fund
          </h2>
          <form className="space-y-6">
            <div>
              <label htmlFor="fundCode" className="block text-sm font-semibold text-indigo-300 mb-2">
                Fund Name
              </label>
              <input
                type="text"
                id="fundCode"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#2a2d4a] text-white placeholder:text-gray-400 border border-indigo-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 outline-none transition-all"
                placeholder="Enter fund name to join"
              />
            </div>
            {fundStatus && !fundStatus.exists && (
              <div className="mb-4 text-red-400">
                No fund with name "{fundName}" exists.
              </div>
            )}
            {fundStatus && fundStatus.exists && (
              <div className="mb-4">
                <p className="text-white">
                  This fund is {fundStatus.isPrivate ? 'private' : 'public'}.
                </p>
                {fundStatus.isPrivate ? (
                  <p className="text-yellow-400">You need to create a join proposal to join this fund.</p>
                ) : (
                  <p className="text-green-400">You can join this fund instantly.</p>
                )}
              </div>
            )}
            <div className="bg-[#2b2e49] border border-indigo-700 rounded-xl p-4 text-sm text-indigo-100 space-y-2">
              <h3 className="font-semibold text-indigo-300">🔐 Joining Process</h3>
              <p>If the fund is <span className="text-green-400 font-medium">public</span>:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>You will be instantly added to the fund after confirming the transaction.</li>
                <li>A small amount of <span className="text-purple-400 font-medium">0.00057 SOL</span> will be charged to reallocate your global user account and store fund-specific info.</li>
              </ul>
              <p>If the fund is <span className="text-yellow-400 font-medium">private</span>:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>A <strong>join proposal</strong> will be created in the fund.</li>
                <li>This costs around <span className="text-purple-400 font-medium">0.002 SOL</span> (includes both proposal and addition handling fees).</li>
                <li>Existing members will vote to approve or reject your request using governance tokens.</li>
                <li>There is <strong>no deadline</strong> for the proposal — once required votes are reached, you’ll be added and notified automatically.</li>
                <li>The <strong>required votes</strong> threshold is set by the fund creator and can be modified later through governance voting.</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={buttonAction}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-semibold transition-all shadow-md"
            >
              {buttonText}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-indigo-200 text-sm">
              Don’t have a fund code? Ask the fund creator to share their code or invite link with you.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}