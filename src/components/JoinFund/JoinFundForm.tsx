import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionInstruction, SystemProgram, Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
// import axios from 'axios';
import { Fund, programId } from '../../types';
import { extractFundData } from '../../functions/extractFundData';
import { printFundDetails } from '../../functions/printFundDetails';
import { Buffer } from 'buffer';

export default function JoinFundForm() {
  const [fundName, setFundName] = useState('');
  const location = useLocation();
  const wallet = useWallet();
  const {connection} = useConnection();
  const {connected} = wallet;
  const [loading, setLoading] = useState(false);

  // Check if there's a code in the URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setFundName(codeParam);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fundName.trim()) {
      return;
    }

    // try {
    //   const res = await axios(`http://locakhost:5000/api/funds/exists/${fundName}`);
    //   console.log(res.data.exists);
    //   if (!res.data.exists) {
    //     toast.error('No such fund exists');
    //     return;
    //   }
    // } catch (err) {
    //   console.log('Error checking fund name:', err);
    //   toast.error('Error checking fund name');
    //   return;
    // }
    
    // Here the blockchain interaction would occur (to be handled by the user later)
    if (!wallet || !connected || !wallet.publicKey || !wallet.signTransaction) {
      return;
    }

    setLoading(true);

    const user = wallet.publicKey;

    if (!user) throw new Error('Wallet not connected');

    try {
      const [fundAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fund"), Buffer.from(fundName)],
        programId,
      );

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user.toBuffer()],
        programId,
      );

      const accounts = [
        {pubkey: fundAccountPda, isSigner: false, isWritable: true},
        {pubkey: user, isSigner: true, isWritable: true},
        {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
        {pubkey: userAccountPda, isSigner: false, isWritable: true},
      ];

      console.log(userAccountPda.toBase58());

      const nameBytes = new TextEncoder().encode(fundName);
      const instructionData = Buffer.from([3, ...nameBytes]);

      const instruction = new TransactionInstruction({
        keys: accounts,
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

      // Printing created accounts data for debugging
      const fundAccountInfo = await connection.getAccountInfo(fundAccountPda);
      const fund: Fund | null = extractFundData(fundAccountInfo);
      if (!fund) return;
      fund.fund_address = fundAccountPda;
      printFundDetails(fund);

      toast.success('Successfully joined the Fund!');
      setLoading(false);
    } catch (err) {
      console.log("Error adding to the fund : ", err);
      toast.error('Failed to join the fund :(');
      setLoading(false);
    }
    
    // Reset form
    setFundName('');
  };

  return (
    <div className="max-w-2xl mx-auto bg-[#1e2035]/80 backdrop-blur-2xl border border-indigo-900 shadow-[0_0_10px_#6d28d9aa] rounded-2xl overflow-hidden transition-all">
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="flex flex-col items-center space-y-5">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_#9333ea99]"></div>
            <p className="text-indigo-200 text-lg font-medium animate-pulse">Preparing joining transaction...</p>
          </div>
        </div>
      ) : (
        <div className="p-8">
          <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">
            Join an Investment Fund
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
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

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-semibold transition-all shadow-md"
            >
              Join Fund
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