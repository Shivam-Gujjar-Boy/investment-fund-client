import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {toast} from 'react-hot-toast';
import { PublicKey, TransactionInstruction, SystemProgram, Transaction } from '@solana/web3.js';
import { programId } from '../types';
import { Buffer } from 'buffer';

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

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), user.toBuffer()],
        programId,
      );

      try {
        const accountInfo = await connection.getAccountInfo(userAccountPda);
        if (accountInfo !== null) {
          console.log("User already exists");
          toast.success('User Account found and logged in!');
          const account_buffer = Buffer.from(accountInfo.data);
          const public_key = new PublicKey(account_buffer.slice(0, 32));
          console.log('Users Wallet address: ', public_key.toBase58());
          const number_of_funds = account_buffer.readUInt32LE(32);
          console.log('Number of funds: ', number_of_funds);
          for (let i=0; i<number_of_funds; i++) {
            console.log(`fund number ${i}: ${(new PublicKey(account_buffer.slice(36+i*50, 68+i*50))).toBase58()}`);
            console.log(`user's governance token balance in fund ${i} = ${account_buffer.readBigInt64LE(68+i*50)}`);
            console.log(`user's number of proposals in fund ${i} = ${account_buffer.readUInt16LE(76+i*50)}`);
            console.log(`user's join time in fund ${i} = ${account_buffer.readBigInt64LE(78+i*50)}`);
          }
          navigate('/dashboard/create');
        } else {
          if (!wallet.signTransaction || !wallet.publicKey) {
            return;
          }

          try {
            const instructionData = Buffer.from([6]);

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

            const accountInfo = await connection.getAccountInfo(userAccountPda);
            if (!accountInfo) return;
            const account_buffer = Buffer.from(accountInfo.data);
            const public_key = new PublicKey(account_buffer.slice(0, 32));
            console.log('Users Wallet address: ', public_key.toBase58());
            const number_of_funds = account_buffer.readUInt32LE(32);
            console.log('Number of funds: ', number_of_funds);
            for (let i=0; i<number_of_funds; i++) {
              console.log(`fund number ${i}: ${(new PublicKey(account_buffer.slice(36+i*50, 68+i*50))).toBase58()}`);
              console.log(`user's governance token balance in fund ${i} = ${account_buffer.readBigInt64LE(68+i*50)}`);
              console.log(`user's number of proposals in fund ${i} = ${account_buffer.readUInt16LE(76+i*50)}`);
              console.log(`user's join time in fund ${i} = ${account_buffer.readBigInt64LE(78+i*50)}`);
            }

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
  }, [connected, navigate, wallet, connection]);

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

        <main className="flex-1 px-4 sm:px-8 lg:px-16 py-10">
          <div className="max-w-6xl mx-auto">
            <section className="text-center mb-20">
              <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6">
                Decentralized <span className="text-gradient">Investment Funds</span>
              </h1>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Create and manage trustless investment funds on the Solana blockchain. Join forces with friends, colleagues or communities.
              </p>
              <div className="mt-8">
                <WalletMultiButton />
              </div>
            </section>

            <section className="mb-24">
              <div className="grid sm:grid-cols-4 gap-8">
                {['Create a Fund', 'Join Together', 'Invest Together', 'Grow Together'].map((title, i) => (
                  <div key={i} className="glass rounded-2xl p-6 text-center border border-indigo-800 hover:shadow-[0_0_10px_#a78bfa55] hover:scale-[1.01] transition-all duration-300 group">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                      {i + 1}
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                    <p className="text-gray-400 text-sm">
                      {i === 0
                        ? 'Start a DAO-style fund and set governance rules.'
                        : i === 1
                        ? 'Collaboratively pool resources for smarter investing.'
                        : i === 2
                        ? 'Invest through decentralized proposals on-chain!'
                        : 'See returns, PnL, and distribute profits fairly.'}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-24 grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">Why PeerFunds?</h2>
                <p className="text-gray-300">
                  Whether you're a solo crypto trader or a team of enthusiastic friends, PeerFunds empowers you to invest with trustless collaboration.
                  On-chain governance, proposal voting, and fund transparency ensure every decision is made fairly.
                </p>
                <p className="text-gray-400 text-sm">
                  🔒 Trustless voting system<br />
                  📈 Performance analytics and portfolio insights<br />
                  🧠 Learn by joining funds, even with minimal risk
                </p>
              </div>
              <div className="h-64 bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-300">
                {/* Add illustration/image here */}
                [ IMAGE PLACEHOLDER ]
              </div>
            </section>

            <section className="mb-24 grid md:grid-cols-2 gap-12 items-center">
              <div className="h-64 bg-purple-800/30 rounded-xl flex items-center justify-center text-purple-300">
                {/* Add illustration/image here */}
                [ IMAGE PLACEHOLDER ]
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">Not Just Investing – It's Learning</h2>
                <p className="text-gray-300">
                  Beginners can join public funds, learn how proposals work, and participate in governance without affecting real fund outcomes.
                  Small voting powers ensure minimal risk, while real-time engagement drives crypto knowledge growth.
                </p>
                <p className="text-sm text-gray-400">
                  🧩 Proposals with real-time outcomes<br />
                  📊 PnL dashboards, voting analytics, and educational feedback<br />
                  🧪 Learn by doing — not just reading
                </p>
              </div>
            </section>

            <section className="text-center mb-10">
              <h2 className="text-2xl font-bold text-white mb-3">Ready to Join the Future of Community Investing?</h2>
              <p className="text-gray-300 max-w-xl mx-auto mb-6">
                Connect your wallet and dive into the world of decentralized fund management. It takes just a few seconds to get started.
              </p>
              <WalletMultiButton />
            </section>
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