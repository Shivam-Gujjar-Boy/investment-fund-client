import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionInstruction, SystemProgram, Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { Fund, programId } from '../../types';
import { extractFundData } from '../../functions/extractFundData';
import { printFundDetails } from '../../functions/printFundDetails';

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
    <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl shadow-xl overflow-hidden">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white text-lg">Preparing your dashboard...</p>
          </div>
        </div>
        ) : (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Join an Investment Fund</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="fundCode" className="block text-sm font-medium text-gray-300 mb-2">
                  Fund Name
                </label>
                <input
                  type="text"
                  id="fundCode"
                  value={fundName}
                  onChange={(e) => setFundName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors duration-200"
                  placeholder="Enter fund name to join"
                />
              </div>
              
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors duration-200"
              >
                Join Fund
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Don't have a fund code? Ask the fund creator to share their fund code or invite link with you.
              </p>
            </div>
          </div>
        )
      }
    </div>
  );
}