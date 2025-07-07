import VaultHoldings from './VaultHoldings';
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { LightFund, programId, Token } from '../../types';
import { Connection, PublicKey, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
// import axios from 'axios';
import { fetchMintMetadata } from '../../functions/fetchuserTokens';
import FundGraph from './FundGraph';
import { TrendingUp, TrendingDown, DollarSign, ArrowDownLeft, LogOut, Info, Wallet, Target, Search } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import axios from 'axios';
import SOL from '../../assets/SOL.jpg';
import USDC from '../../assets/USDC.png';

interface PerformanceProps {
  fund: LightFund,
  connection: Connection,
  metaplex: Metaplex,
  userStakePercent: number,
  setShowDepositModal: Dispatch<SetStateAction<boolean>>,
}


export default function FundPerformance ({fund, connection, metaplex, userStakePercent, setShowDepositModal}: PerformanceProps) {
    const [tokens, setTokens] = useState<Token[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [withdrawPercent, setWithdrawPercent] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const wallet = useWallet();

    const handleWithdraw = async (task: number) => {
      if (!fund || !connection || !wallet || !wallet.publicKey || !wallet.signTransaction || !tokens) return;
      const user = wallet.publicKey;

      try {
        const instructionTag = 21;
        const stake_percent: bigint = BigInt(parseInt(task ? "100" : withdrawPercent)) * BigInt(1e6);
        const nameBytes = Buffer.from(fund.name, 'utf8');
        
        const buffer = Buffer.alloc(1 + 1 + 1 + 8 + nameBytes.length);
        let offset = 0;

        buffer.writeUInt8(instructionTag, offset);
        offset += 1;
        buffer.writeUInt8(tokens?.length, offset);
        offset += 1;
        buffer.writeUint8(task, offset);
        offset += 1;
        buffer.writeBigInt64LE(stake_percent, offset);
        offset += 8;
        nameBytes.copy(buffer, offset);

        const instructionData = buffer;

        const [userAccountPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('user'), user.toBuffer()],
          programId
        );

        const keys = [
          {pubkey: user, isSigner: true, isWritable: false},
          {pubkey: userAccountPda, isSigner: false, isWritable: true},
          {pubkey: fund.fundPubkey, isSigner: false, isWritable: true},
          {pubkey: fund.vault, isSigner: false, isWritable: true},
          {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false}
        ];

        for (const token of tokens) {
          keys.push({pubkey: new PublicKey(token.mint), isSigner: false, isWritable: false});
        }

        for (const token of tokens) {
          const member_ata = await getAssociatedTokenAddress(
            new PublicKey(token.mint),
            user,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );

          keys.push({pubkey: member_ata, isSigner: false, isWritable: true});
        }

        for (const token of tokens) {
          keys.push({pubkey: token.pubkey, isSigner: false, isWritable: true});
        }

        const instruction = new TransactionInstruction({
          keys,
          programId,
          data: instructionData
        });

        const transaction = new Transaction().add(instruction);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;

        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        });

        toast.success(`You have withdrawn ${withdrawPercent}% of stake`);
        setShowWithdrawModal(false);
      } catch (err) {
        console.log(err);
        toast.error('Error withdraw stake');
      } finally {
        setWithdrawPercent('');
      }
    };

    const fetchVaultTokens = useCallback(async () => {
      try {
        if (!fund || !fund.vault) return;

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          fund.vault,
          { programId: TOKEN_PROGRAM_ID }
        );

        const tokens = (await Promise.all(
          tokenAccounts.value.map(async (acc) => {
              const info = acc.account.data.parsed.info;
              const mint = info.mint;
              const balance = info.tokenAmount.uiAmount;
              console.log(balance);
              const decimals = info.tokenAmount.decimals;
              let balance_as_usdc = balance;
              if (mint === 'So11111111111111111111111111111111111111112') {
                // fetch SOL price
                const amount = info.tokenAmount.amount;
                console.log(amount);
                try {
                  const response = await axios(
                    `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=${amount}&slippageBps=50`
                  );
                  balance_as_usdc = response.data.outAmount / 1e6;
                } catch (err) {
                  toast.error('Failed to fetch SOL price');
                }
              }
              let image = '';
              let name = 'Unknown';
              let symbol = 'UNKNOWN';
              if (mint === 'So11111111111111111111111111111111111111112') {
                image = SOL;
              } else if (mint === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
                image = USDC;
                name = 'USDC';
                symbol = 'USDC';
              }
              console.log(mint);
              return {
                pubkey: acc.pubkey,
                mint,
                name,
                symbol,
                image,
                balance,
                balance_as_usdc,
                decimals
              };
            })
        )).filter((token) => token.balance > 0);

        const tokensWithMetadata = await Promise.all(
          tokens.map(async (token) => {
            const metadata = await fetchMintMetadata(new PublicKey(token.mint), metaplex);
            return {
              ...token,
              name: metadata?.name || token.name,
              symbol: metadata?.symbol || token.symbol,
              image: metadata?.image || token.image,
            };
          })
        );

        console.log(tokens);

        setTokens(tokensWithMetadata);
      } catch (err) {
        console.error('Error fetching fund tokens:', err);
        return [];
      } finally {
        setLoading(false);
      }
    }, [connection, metaplex]);

    const fetchedRef = useRef(false);

    useEffect(() => {
      if (fetchedRef.current) return;
      fetchedRef.current = true;
      fetchVaultTokens();
    }, [fetchVaultTokens]);

    return (
        <>
          <div className="flex flex-col px-2 pt-3 text-white bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 min-h-screen mt-20">
            <div className="flex flex-col lg:flex-row gap-3 mb-3 h-[75vh]">
                {/* Left - Performance Line Chart */}
                <FundGraph />

                {/* Right - Holdings Pie Chart */}
                <div className='w-[39%] h-[100%]'>
                  {loading ? (
                    <div className="relative p-6 h-full w-full rounded-lg overflow-hidden bg-[#151A33] group transition-transform border border-indigo-500/20 shadow-[0_0_5px_#6366F140] backdrop-blur-lg flex flex-col">
                      <div className="absolute inset-0 bg-gradient-to-br from-teal-900/20 via-purple-800/10 to-indigo-900/20 opacity-40 blur-3xl group-hover:opacity-60 transition duration-1000 ease-in-out pointer-events-none" />
                      <h2 className="text-xl font-bold text-center mb-4 text-white tracking-wide relative z-10">
                        Vault Holdings
                      </h2>
                      {/* Add a nice loader here */}
                      <div className="relative z-10 mt-4 flex flex-col justify-center items-center h-[75%]">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-slate-400 mt-3">Loading tokens...</p>
                      </div>
                    </div>
                  ) : (
                    <VaultHoldings tokens={tokens}/>
                  )}
                </div>
            </div>
            {/* Fund Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-2">
              {/* Card 1: Total Fund Value */}
              <div className="bg-gradient-to-br from-[#171539] via-[#111827] to-[#171539] rounded-2xl p-5 shadow-[0_0_5px_#7c3aed22]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Total Fund Value</p>
                    <p className="text-2xl font-bold text-slate-300"><span className="text-purple-400">$</span> {(Number(fund.totalDeposit) / 1e6).toFixed(2)}</p>
                  </div>
                  <DollarSign className="w-9 h-9 text-purple-400 drop-shadow-[0_0_2px_#8b5cf660]" />
                </div>
              </div>

              {/* Card 2: Your Contribution */}
              <div className="bg-gradient-to-br from-[#171539] via-[#111827] to-[#171539] rounded-2xl p-5 shadow-[0_0_5px_#6366f140]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Your Contribution</p>
                    <p className="text-2xl font-bold text-slate-300"><span className="text-indigo-400">$</span> {(userStakePercent / 100 * Number(fund.totalDeposit) / 1e6).toFixed(2)}</p>
                  </div>
                  <Wallet className="w-9 h-9 text-indigo-400 drop-shadow-[0_0_2px_#6366f680]" />
                </div>
              </div>

              {/* Card 3: Your Stake */}
              <div className="bg-gradient-to-br from-[#171539] via-[#111827] to-[#171539] rounded-2xl p-5 shadow-[0_0_5px_#d946ef33]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Your Stake</p>
                    <p className="text-2xl font-bold text-slate-300">{userStakePercent.toFixed(2)} <span className="text-fuchsia-400">%</span></p>
                  </div>
                  <Target className="w-9 h-9 text-fuchsia-400 drop-shadow-[0_0_2px_#d946ef66]" />
                </div>
              </div>

              {/* Card 4: Current Value */}
              <div className="bg-gradient-to-br from-[#171539] via-[#111827] to-[#171539] rounded-2xl p-5 shadow-[0_0_5px_#10b98133]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Current Value</p>
                    <p className="text-2xl font-bold text-slate-300"><span className="text-emerald-400">$</span> {(userStakePercent / 100 * Number(fund.totalDeposit) / 1e6).toFixed(2)}</p>
                  </div>
                  <TrendingUp className="w-9 h-9 text-emerald-400 drop-shadow-[0_0_2px_#10b98166]" />
                </div>
              </div>
            </div>

            {/* Token Holdings Table */}
            <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b]/70 to-[#0f172a] backdrop-blur-xl border border-indigo-500/20 shadow-[0_0_30px_#7c3aed15] rounded-2xl p-6 mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-white tracking-wide">Token Holdings</h2>

                <div className="flex gap-3">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder='Search Tokens...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-slate-800/40 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                    />
                  </div>

                  {/* Withdraw Button */}
                  <button
                    onClick={() => setShowWithdrawModal(true)}
                    className="relative inline-flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-white bg-gradient-to-br from-cyan-800 via-teal-700 to-cyan-900 shadow-[0_0_2px_#22d3ee40] hover:shadow-[0_0_5px_#22d3ee80] hover:brightness-110 transition-all duration-300 group overflow-hidden"
                  >
                    <span className="absolute inset-0 bg-cyan-400 opacity-10 blur-md group-hover:opacity-20 group-hover:blur-lg transition duration-300 pointer-events-none" />
                    <ArrowDownLeft className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Withdraw</span>
                  </button>

                  {/* Leave Fund Button */}
                  <button
                    onClick={() => setShowLeaveModal(true)}
                    className="relative inline-flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-white bg-gradient-to-br from-purple-800 via-fuchsia-700 to-purple-900 shadow-[0_0_2px_#a855f740] hover:shadow-[0_0_5px_#a855f780] hover:brightness-110 transition-all duration-300 group overflow-hidden"
                  >
                    <span className="absolute inset-0 bg-purple-400 opacity-10 blur-md group-hover:opacity-20 group-hover:blur-lg transition duration-300 pointer-events-none" />
                    <LogOut className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Leave Fund</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-purple-600/20">
                      {["Token", "Price", "Balance", "Value", "24h Change", "Your Share", ""].map((head, i) => (
                        <th key={i} className={`${i === 0 ? "text-left" : "text-right"} px-4 py-3 text-slate-400 font-medium uppercase tracking-wider`}>
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tokens?.filter(token => token.symbol.toLowerCase().includes(searchTerm.toLowerCase())).map((token) => (
                      <tr key={token.symbol} className="border-b border-slate-700/20 hover:bg-slate-800/30 transition duration-150">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {token?.image ? (
                              <img src={token.image} alt="token" className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white shadow-[0_0_5px_#8b5cf660]">
                                {token.symbol.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-white">{token.name}</p>
                              <p className="text-xs text-slate-400 tracking-wider">{token.symbol}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-lg text-right font-mono text-slate-200">${token.decimals}</td>
                        <td className="py-4 px-4 text-lg text-right font-mono text-slate-200">{token.balance.toFixed(4)}</td>
                        <td className="py-4 px-4 text-lg text-right font-mono text-slate-100 font-semibold">${token.decimals}</td>

                        <td className="py-4 px-4 text-right">
                          <span className={`flex items-center justify-end gap-1 text-lg font-medium ${token.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {token.balance >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {Math.abs(token.balance)}%
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right text-lg font-mono text-slate-300">
                          ${(token.balance * userStakePercent / Number(fund.totalDeposit)).toFixed(4)}
                        </td>

                        <td className="py-4 pr-4 text-right">
                          <button
                            onClick={() => setShowDepositModal(true)}
                            className="relative inline-flex items-center justify-center px-4 py-2 font-semibold rounded-xl border border-purple-600 text-white bg-gradient-to-br from-purple-700 via-indigo-600 to-purple-800 shadow-[0_0_6px_#8b5cf633] hover:shadow-[0_0_10px_#8b5cf680] hover:brightness-110 transition duration-300 group overflow-hidden">
                            <span className="absolute inset-0 bg-purple-500 opacity-20 blur-md group-hover:opacity-30 group-hover:blur-lg transition duration-300 pointer-events-none" />
                            <span className="relative z-10">+ Deposit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Withdraw Modal */}
            {showWithdrawModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-600/30 rounded-xl p-6 w-96 mx-4">
                  <div className="flex items-center gap-3 mb-4">
                    <ArrowDownLeft className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-xl font-bold">Withdraw from Fund</h3>
                  </div>
                  
                  <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-yellow-200">Pro-rata withdrawal</p>
                        <p className="text-xs text-yellow-300 mt-1">You'll receive the same percentage from each token type.</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm text-purple-300 mb-2">Withdrawal Percentage</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={withdrawPercent}
                        onChange={(e) => setWithdrawPercent(e.target.value)}
                        placeholder="Enter percentage (1-100)"
                        max="100"
                        min="1"
                        className="w-full bg-slate-700/50 border border-purple-600/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="absolute right-3 top-3 text-gray-400">%</span>
                    </div>
                    {withdrawPercent && (
                      <p className="text-sm text-gray-400 mt-2">
                        You'll receive ~${((userStakePercent * 20) / 100)} worth of tokens
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowWithdrawModal(false)}
                      className="flex-1 bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleWithdraw(0);
                      }}
                      disabled={!withdrawPercent || parseInt(withdrawPercent) <= 0 || parseInt(withdrawPercent) > 100}
                      className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-all"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Leave Fund Modal */}
            {showLeaveModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-red-600/30 rounded-xl p-6 w-96 mx-4">
                  <div className="flex items-center gap-3 mb-4">
                    <LogOut className="w-6 h-6 text-red-400" />
                    <h3 className="text-xl font-bold">Leave Fund</h3>
                  </div>
                  
                  <div className="mb-4 p-4 bg-red-900/20 border border-red-600/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-red-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-200">Complete withdrawal</p>
                        <p className="text-xs text-red-300 mt-1">This will return your entire stake and remove you from the fund.</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Your contribution:</span>
                      <span className="font-mono">${userStakePercent}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Current value:</span>
                      <span className="font-mono">${((userStakePercent / Number(fund.totalDeposit)) * Number(fund.totalDeposit))}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium text-white border-t border-gray-600 pt-2">
                      <span>You'll receive:</span>
                      <span className="font-mono">100% of your stake</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowLeaveModal(false)}
                      className="flex-1 bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleWithdraw(1);
                      }}
                      className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-4 py-2 rounded-lg transition-all"
                    >
                      Leave Fund
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
    );
}