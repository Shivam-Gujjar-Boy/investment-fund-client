import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {toast} from 'react-hot-toast';
import { PublicKey, TransactionInstruction, SystemProgram, Transaction } from '@solana/web3.js';

export default function Home() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const {connection} = useConnection();
  const { connected } = wallet;
  const [loading, setLoading] = useState(false);
  
  // Redirect to dashboard if connected by creating the account if doesn't exist
  useEffect(() => {
    const handleUser = async () => {
      if (!connected || !wallet) return;

      const user = wallet.publicKey;
      if (!user) throw new Error('Wallet not connected');

      setLoading(true);

      console.log(user, connected);
      const programId = new PublicKey('CFdRopkCcbqxhQ46vNbw4jNZ3eQEmWZhmq5V467py9nG');

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), user.toBuffer()],
        programId,
      );

      try {
        const accountInfo = await connection.getAccountInfo(userAccountPda);
        if (accountInfo !== null) {
          console.log("User already exists");
          toast.success('User Account found and logged in!');
          navigate('/dashboard/create');
        } else {
          if (!wallet.signTransaction || !wallet.publicKey) {
            return;
          }

          try {
            const instructionData = Buffer.from([7]);

            const instruction = new TransactionInstruction({
              keys: [
                {pubkey: user, isSigner: true, isWritable: true},
                {pubkey: userAccountPda, isSigner: false, isWritable: true},
                {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
              ],
              programId,
              data: instructionData,
            });

            const transaction = new Transaction().add(instruction);

            console.log("User account key : ", userAccountPda.toBase58());

            const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = user;

            const signedTransaction = await wallet.signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTransaction.serialize());

            await connection.confirmTransaction({
              signature,
              blockhash,
              lastValidBlockHeight
            });

            console.log("User PDA created");
            toast.success('User Account created and logged in');
            navigate('/dashboard/create');

          } catch (userCreationErr) {
            console.log('Error creating User PDA : ', userCreationErr);
            toast.error('Error creating User Account');
          }
        }
      } catch (err) {
        console.log("Error checking user PDA existance : ", err);
        toast.error('Error fetching User Account!')
      } finally {
        setLoading(false);
      }
    };

    handleUser();
  }, [connected, navigate, wallet]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white text-lg">Preparing your dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          <header className="pt-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <h1 className="text-xl sm:text-2xl font-bold text-white">PeerFunds</h1>
            </div>
          </header>

          <main className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-3xl w-full">
              <div className="text-center mb-12">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
                  Decentralized <span className="text-gradient">Investment Funds</span>
                </h1>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
                  Create and manage investment funds on the Solana blockchain with friends, colleagues, or communities.
                </p>
              </div>

              <WalletMultiButton />

              <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div className="glass rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold">1</span>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Create a Fund</h3>
                  <p className="text-gray-400 text-sm">Start an investment fund and invite others to join</p>
                </div>

                <div className="glass rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold">2</span>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Join Together</h3>
                  <p className="text-gray-400 text-sm">Pool resources with members for greater investment power</p>
                </div>

                <div className="glass rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold">3</span>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Grow Together</h3>
                  <p className="text-gray-400 text-sm">Track performance and distribute returns transparently</p>
                </div>
              </div>
            </div>
          </main>

          <footer className="py-6 text-center text-gray-500 text-sm">
            <p>Powered by Solana Blockchain</p>
          </footer>
        </>
      )}
    </div>
  );
}