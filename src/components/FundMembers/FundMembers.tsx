import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Fund, Token, programId } from '../../types';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Metaplex } from '@metaplex-foundation/js';
import { fetchUserTokens } from '../../functions/fetchuserTokens';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID, getAccount, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import axios from 'axios';
import FundActivity from '../FundActivity/FundActivity'; // Adjust the path as necessary

interface FundMembersProps {
  members: PublicKey[] | undefined;
  governanceMint: PublicKey | null;
  fund: Fund;
}

interface MemberInfo {
  pubkey: PublicKey;
  balance: number;
}

export default function FundMembers({ members, governanceMint, fund }: FundMembersProps) {
  const [isDepositing, setisDepositing] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [userTokens, setUserTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [memberInfos, setMemberInfos] = useState<MemberInfo[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [animate, setAnimate] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);

  const wallet = useWallet();
  const { connection } = useConnection();
  const metaplex = Metaplex.make(connection);

  useEffect(() => {
    if (!members || !governanceMint) return;

    const fetchBalances = async () => {
      setLoading(true);
      try {
        const infos: MemberInfo[] = [];

        for (const member of members) {
          try {
            // const ata = await getAssociatedTokenAddress(governanceMint, member);
            const ata = await getAssociatedTokenAddress(
              governanceMint,
              member,
              false,
              TOKEN_2022_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            );
            const accountInfo = await getAccount(connection, ata, 'confirmed', TOKEN_2022_PROGRAM_ID);
            const balance = Number(accountInfo.amount);
            console.log(accountInfo);
            infos.push({ pubkey: member, balance });
          } catch (err) {
            console.warn(`Could not fetch account for ${member.toBase58()}:`, err);
            infos.push({ pubkey: member, balance: 0 });
          }
        }

        setMemberInfos(infos);
        setTotalBalance(infos.reduce((sum, i) => sum + i.balance, 0));

        setTimeout(() => setAnimate(true), 100);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch balances:', error);
        toast.error('Error fetching member balances');
      }
    };

    fetchBalances();
  }, [members, governanceMint]);

  function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  }

  const openDepositModal = async () => {
    setShowDepositModal(true);
    const tokens = await fetchUserTokens(wallet, connection, metaplex);
    if (!wallet.publicKey) {
      return;
    }

    console.log(tokens);
    if (!tokens) return;
    setUserTokens(tokens);
    if (tokens.length > 0) setSelectedToken(tokens[0]);
  };

  const handleDeposit = async () => {
    console.log(`Deposit ${amount} ${selectedToken?.symbol}`);

    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Wallet is not connected');
        return;
      }

      const user = wallet.publicKey;
      if (!selectedToken || !fund) {
        toast.error('Token or fund not selected');
        return;
      }

      const mint = new PublicKey(selectedToken?.mint);
      console.log(mint.toBase58(), '---------');

      const vaultATA = await getAssociatedTokenAddress(
        mint,
        fund.vault,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      console.log('Vault ATA', vaultATA.toBase58());

      const governanceATA = await getAssociatedTokenAddress(
        fund?.governanceMint,
        user,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      if (!fund.fund_address) {
        toast.error('No fund pda found');
        return;
      }

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), user.toBuffer()],
        programId
      );

      const keyp = Keypair.generate();

      const keys = [
        { pubkey: user, isSigner: true, isWritable: true },
        {
          pubkey: selectedToken?.mint === 'So11111111111111111111111111111111111111112'
            ? keyp.publicKey
            : selectedToken?.pubkey,
          isSigner: selectedToken?.mint === 'So11111111111111111111111111111111111111112'
            ? true
            : false,
          isWritable: true
        },
        { pubkey: fund?.vault, isSigner: false, isWritable: true },
        { pubkey: vaultATA, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: fund.fund_address, isSigner: false, isWritable: true },
        { pubkey: userAccountPda, isSigner: false, isWritable: true },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: governanceATA, isSigner: false, isWritable: true },
        { pubkey: fund?.governanceMint, isSigner: false, isWritable: true },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },

      ];
      console.log("user wallet", user.toBase58());
      console.log("member ata", keyp.publicKey.toBase58(), " ", selectedToken.pubkey.toBase58());
      console.log("vault", fund.vault.toBase58());
      console.log("vault ata", vaultATA.toBase58());
      console.log("mint account", mint.toBase58());
      console.log("token program", TOKEN_PROGRAM_ID.toBase58());
      console.log("ata program", ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());
      console.log("fund account", fund.fund_address.toBase58());
      console.log("user pda", userAccountPda.toBase58());
      console.log("system program", SYSTEM_PROGRAM_ID.toBase58());
      console.log("rentsysvar", SYSVAR_RENT_PUBKEY.toBase58());
      console.log("governance token account", governanceATA.toBase58());
      console.log("governance mint", fund?.governanceMint.toBase58());
      console.log("token program 2022", TOKEN_2022_PROGRAM_ID.toBase58());

      const ui_amount = BigInt(amount);
      const instructionTag = Buffer.from([7]);
      const mintInfo = await getMint(connection, mint);
      const decimals = mintInfo.decimals;
      const transfer_amount = ui_amount * BigInt(Math.pow(10, decimals));
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigInt64LE(transfer_amount);

      const response = await axios(`https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=${transfer_amount}&slippageBps=50`);
      if (!response) {
        toast.error('Failed to fetch token price');
        return;
      }
      const mint_amount = BigInt(response.data.outAmount);
      console.log(mint_amount);

      const minTAmountBuffer = Buffer.alloc(8);
      minTAmountBuffer.writeBigInt64LE(mint_amount);

      const nameBytes = new TextEncoder().encode(fund.name);

      const instructionData = Buffer.concat([instructionTag, amountBuffer, minTAmountBuffer, nameBytes]);
      console.log(instructionData.length);

      const instruction = new TransactionInstruction({
        keys,
        programId,
        data: instructionData
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      if (selectedToken?.mint === 'So11111111111111111111111111111111111111112') {
        transaction.partialSign(keyp);
      }
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      setShowDepositModal(false);
      toast.success('Successfully deposited assets to fund');
    } catch (err) {
      toast.error('Error depositing assets');
      console.log(err);
    }
  };

  return (
    <div className="bg-gradient-to-b from-[#1f2937] to-[#0f172a] h-[28rem] w-[25%] relative rounded-2xl shadow-[0_0_20px_#6366f155] border border-white/10 transition-all duration-500 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-0">
        <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          👥 Members
        </h2>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden px-6 pt-4">
        {loading ? (
          <div className="animate-pulse space-y-4 h-full overflow-y-auto">
            <ul className="space-y-4">
              {[...Array(5)].map((_, idx) => (
                <li key={idx} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-24 bg-gray-700 rounded" />
                    <div className="h-4 w-12 bg-gray-700 rounded" />
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div className="h-2.5 w-1/2 bg-gray-600 rounded-full" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-700 scrollbar-track-gray-800">
            <div className="space-y-4 text-sm">
              <ul className="space-y-4">
                {memberInfos.map(({ pubkey, balance }) => {
                  const percentage = totalBalance > 0 ? (balance / totalBalance) * 100 : 0;
                  const shortAddr = truncateAddress(pubkey.toBase58());

                  return (
                    <li
                      key={pubkey.toBase58()}
                      className="cursor-pointer group"
                      onClick={() => handleCopy(pubkey.toBase58())}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-300 group-hover:text-white transition-all font-mono">
                          {shortAddr}
                        </span>
                        <span className="text-green-400 font-semibold">{percentage.toFixed(2)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-green-400 via-teal-400 to-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: animate ? `${percentage}%` : `0%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Buttons at Bottom */}
      <div className="flex-shrink-0 bg-[#111827] pt-3 pb-4 px-6 space-y-3 border-t border-gray-700 rounded-b-2xl">
        {['Deposit', 'Invite', 'Withdraw', 'Activities'].map((label, idx) => (
          <button
            onClick={() => {
              if (label === 'Deposit') {
                openDepositModal();
              } else if (label === 'Activities') {
                setShowActivityModal(true);
              }
            }}
            key={idx}
            className={`w-full py-2 rounded-lg text-sm font-semibold text-white transition duration-300 shadow-md hover:shadow-lg ${
              label === 'Activities'
                ? 'bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600'
                : 'bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Modals */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#171f32] border border-white/10 shadow-2xl rounded-3xl p-6 w-[90%] max-w-xl text-white transition-all duration-300 scale-100 relative">
            <h2 className="text-2xl font-bold mb-6 tracking-wide">💰 Deposit Tokens</h2>
            {selectedToken && (
              <div className="flex justify-between text-xs text-white mb-2 px-1">
                <div className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  {selectedToken.symbol} balance: {selectedToken.balance}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAmount(selectedToken.balance.toString())}
                    className="text-xs bg-gray-700 text-gray-300 px-2 py-[2px] rounded hover:bg-gray-600"
                  >
                    Max
                  </button>
                  <button
                    onClick={() => setAmount((selectedToken.balance * 0.5).toFixed(6))}
                    className="text-xs bg-gray-700 text-gray-300 px-2 py-[2px] rounded hover:bg-gray-600"
                  >
                    50%
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center bg-[#0c1118] rounded-2xl overflow-hidden text-white">
              <div className="flex items-center gap-1 px-4 py-3 min-w-[140px] bg-[#2c3a4e] rounded-2xl m-3 cursor-pointer">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-600 border border-gray-600">
                  {selectedToken?.image ? (
                    <img src={selectedToken.image} alt="token" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-600 rounded-full" />
                  )}
                </div>
                <select
                  value={selectedToken?.mint || ''}
                  onChange={(e) =>
                    setSelectedToken(userTokens.find((t) => t.mint === e.target.value) || null)
                  }
                  className="bg-transparent text-white text-xl outline-none cursor-pointer py-0"
                >
                  {userTokens.map((token) => (
                    <option key={token.mint} value={token.mint} className="text-black">
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 text-right px-4 py-3 text-2xl bg-transparent outline-none placeholder-white"
              />
            </div>
            {amount && selectedToken && parseFloat(amount) > selectedToken.balance && (
              <p className="text-red-500 text-sm mt-3">🚫 Insufficient balance</p>
            )}
            <div className="flex justify-end mt-8 gap-4">
              <button
                className="px-5 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 transition-all"
                onClick={() => {
                  const modal = document.querySelector('.animate-fadeIn');
                  if (modal) {
                    modal.classList.remove('animate-fadeIn');
                    modal.classList.add('animate-fadeOut');
                    setTimeout(() => setShowDepositModal(false), 200);
                  } else {
                    setShowDepositModal(false);
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setisDepositing(true);
                  handleDeposit();
                }}
                className={`px-5 py-2 rounded-xl ${
                  isDepositing ?
                  'bg-gray-600 hover:bg-gray-500' :
                  'bg-green-600 hover:bg-green-500'
                } transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
                disabled={!selectedToken || !amount || parseFloat(amount) > selectedToken.balance || isDepositing}
              >
                {isDepositing ? 'Depositing...' : 'Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#171f32] border border-white/10 shadow-2xl rounded-3xl p-6 w-[90%] max-w-3xl text-white transition-all duration-300 scale-100 relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold tracking-wide">Fund Activities</h2>
              <button
                onClick={() => setShowActivityModal(false)}
                className="text-gray-400 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>
            <FundActivity fundAddress={fund.fund_address} />
          </div>
        </div>
      )}
    </div>
  );
}