import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionInstruction, SystemProgram, Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { programId } from '../../types';
import { extractFundData } from '../../functions/extractFundData';
import { Buffer } from 'buffer';

export default function JoinFundForm() {
  const [fundName, setFundName] = useState('');
  const [fundStatus, setFundStatus] = useState<{ exists: boolean; isPrivate: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrivateJoinModal, setShowPrivateJoinModal] = useState(false);
  const [showPublicJoinModal, setShowPublicJoinModal] = useState(false);
  const [rentPaid, setRentPaid] = useState<number | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected } = wallet;

  useEffect(() => {
    setFundStatus(null);
  }, [fundName]);

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
        const fund = extractFundData(fundAccountInfo);
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

  async function joinPublicFund() {
    try {
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

      const [rentReservePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("rent")],
        programId,
      )

      const accounts = [
        { pubkey: fundAccountPda, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: userAccountPda, isSigner: false, isWritable: true },
        { pubkey: rentReservePda, isSigner: false, isWritable: true},
      ];

      const nameBytes = new TextEncoder().encode(fundName);
      const instructionData = Buffer.from([3, 0, ...nameBytes]);

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
    } catch (err) {
      console.log(err);
      toast.error('Error joining fund');
    }
  }

  async function createJoinProposal() {
    try {
      const user = wallet.publicKey;
      if (!user) throw new Error('Wallet not connected');
      if (!wallet.signTransaction) throw new Error('Wallet does not support transaction signing');


      const [fundAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fund"), Buffer.from(fundName)],
        programId,
      );

      const [joinAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("join-proposal-aggregator"), Buffer.from([0]), fundAccountPda.toBuffer()],
        programId,
      );

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user.toBuffer()],
        programId,
      );

      const joinAggregatorPdaInfo = await connection.getAccountInfo(joinAggregatorPda);
      if (!joinAggregatorPdaInfo) {
        return;
      };
      const joinBuffer = Buffer.from(joinAggregatorPdaInfo.data);
      const numOfJoinProposals = joinBuffer.readUInt32LE(33);
      console.log('Number of join proposals:', numOfJoinProposals);
      let proposalIndex = 0;
      if (numOfJoinProposals !== 0) {
        proposalIndex = joinBuffer.readUInt8(37 + (numOfJoinProposals)*57 - 1) + 1;
      }
      const [voteAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("join-vote"), Buffer.from([proposalIndex]), fundAccountPda.toBuffer()],
        programId,
      );
      console.log('Proposal Index:', proposalIndex);

      const accounts = [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: joinAggregatorPda, isSigner: false, isWritable: true },
        { pubkey: fundAccountPda, isSigner: false, isWritable: true },
        { pubkey: voteAccountPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: userAccountPda, isSigner: false, isWritable: true },
      ];

      const nameBytes = new TextEncoder().encode(fundName);
      const instructionData = Buffer.from([10, ...nameBytes]);

      const instruction = new TransactionInstruction({
        keys: accounts,
        programId,
        data: instructionData,
      });

      console.log("Join agggregator: ", joinAggregatorPda.toBase58());
      console.log("Fund Account: ", fundAccountPda.toBase58());
      console.log("Vote Account: ", voteAccountPda.toBase58());
      console.log("User Account: ", userAccountPda.toBase58());

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

      toast.success('Join Proposal created successfully');
      
      return signature;
    } catch (err) {
      console.log(err);
      toast.error('Error creating join proposal');
    }
  }

  async function handleJoinFund() {
    if (!fundStatus || !fundStatus.exists) {
      return;
    }
    if (!wallet || !connected || !wallet.publicKey || !wallet.signTransaction) {
      toast.error('Please connect a wallet that supports transaction signing');
      return;
    }
    // setLoading(true);
    try {
      if (!fundStatus.isPrivate) {
        await joinPublicFund();
        setShowPrivateJoinModal(false);
      } else {
        await createJoinProposal();
        setShowPublicJoinModal(false);
      }
      setIsConfirming(false);
    } catch (err) {
      console.error('Error joining fund:', err);
      setIsConfirming(false);
      setShowPrivateJoinModal(false);
      setShowPublicJoinModal(false);
    } finally {
      setLoading(false);
      setIsConfirming(false);
      setShowPrivateJoinModal(false);
      setShowPublicJoinModal(false);
    }
  }

  const openPrivateJoinModal = () => {
    setShowPrivateJoinModal(true);
    setRentPaid(0.00167);
  }

  const openPublicJoinModal = async () => {
    setShowPublicJoinModal(true);
    setRentPaid(null);
    const [fundAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fund'), Buffer.from(fundName)],
      programId
    );
    const fundAccountInfo = await connection.getAccountInfo(fundAccountPda);
    if (!fundAccountInfo) return;
    const fundBuffer = Buffer.from(fundAccountInfo.data);
    const expectedMembers = fundBuffer.readUInt32LE(27);
    const governanceRentExempt = await connection.getMinimumBalanceForRentExemption(327 + fundName.length);
    const rent = 0.00575 + governanceRentExempt / 1_000_000_000;
    if (expectedMembers && expectedMembers > 0) {
      const rentPaid = rent / expectedMembers;
      setRentPaid(rentPaid);
    } else {
      setRentPaid(0);
    }
  }

  const buttonText = fundStatus && fundStatus.exists ? (fundStatus.isPrivate ? 'Create Join Proposal' : 'Join Fund') : 'Check Fund Status';
  const buttonAction = fundStatus && fundStatus.exists ? (fundStatus.isPrivate ? openPrivateJoinModal : openPublicJoinModal) : checkFundStatus;

  return (
    <>
      <div className="w-3xl mx-auto bg-[#1e2035]/80 backdrop-blur-2xl border border-indigo-900 shadow-[0_0_10px_#6d28d9aa] rounded-2xl overflow-hidden transition-all">
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
                  <li>This costs around <span className="text-purple-400 font-medium">0.00167 SOL</span> for join proposal creation.</li>
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
          </div>
        )}
      </div>
      {showPrivateJoinModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md'>
          <div className='bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] p-6 rounded-2xl w-[90%] max-w-md border border-indigo-900/40 shadow-[0_0_25px_#7c3aed33] text-white space-y-6 animate-fadeIn'>

            {/* Heading */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-indigo-300">Creating Join Proposal</h2>

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
                <span className='text-indigo-400'>SOL (proposal creation).</span><br />
                <span>This cost will be refunded to your wallet if <span className='font-semibold text-orange-400'>your proposal is accepted and you join the fund</span> or if <span className='font-semibold text-orange-400'>you cancel the proposal</span>. 
                You can cancel the proposal at any time by navigating to the pending funds.</span>
              </p>

              {/* Total */}
              <p className="pt-1">
                Required:&nbsp;
                {rentPaid === null ? (
                  <span className="inline-block w-24 h-5 bg-indigo-700/30 rounded-md animate-pulse" />
                ) : (
                  <span className="text-green-400 font-medium">{(rentPaid).toFixed(5)} SOL</span>
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowPrivateJoinModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsConfirming(true);
                  handleJoinFund();
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
      {showPublicJoinModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md'>
          <div className='bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] p-6 rounded-2xl w-[90%] max-w-md border border-indigo-900/40 shadow-[0_0_25px_#7c3aed33] text-white space-y-6 animate-fadeIn'>

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
                <span className='text-indigo-400'>SOL (fund creation) + <span className='font-semibold'>0.00057</span> SOL (fund’s accommodation)</span> to join this fund. <br />
                <span>This cost will be refunded to the fund's creator.</span>
              </p>

              {/* Total */}
              <p className="pt-1">
                Required:&nbsp;
                {rentPaid === null ? (
                  <span className="inline-block w-24 h-5 bg-indigo-700/30 rounded-md animate-pulse" />
                ) : (
                  <span className="text-green-400 font-medium">{(rentPaid + 0.00057).toFixed(5)} SOL</span>
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowPublicJoinModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsConfirming(true);
                  handleJoinFund();
                }}
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
    </>
  );
}