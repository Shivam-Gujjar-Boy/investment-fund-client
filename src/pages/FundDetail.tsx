import { useState, useCallback, useEffect} from 'react';
import { LightFund, Token } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  Plus, Users,
  Search, Settings, Wallet,
  BarChart3, Activity,
  Eye, EyeOff, RefreshCw,
  ChevronRight, DollarSign
} from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import toast from 'react-hot-toast';
import { programId } from '../types';
import { Metaplex } from '@metaplex-foundation/js';
import { fetchUserTokens } from '../functions/fetchuserTokens';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import axios from 'axios';
import FundMembers from '../components/FundInformation/FundMembers';
import FundPerformance from '../components/FundInformation/FundPerformance';
import Proposals from '../components/FundInformation/FundProposals';
import CreateProposal from '../components/Proposals/CreateProposal';

export default function FundsList() {
  const [fund, setFund] = useState<LightFund | null>(null);
  const [activeTab, setActiveTab] = useState('performance');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBalance, setShowBalance] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [contribution, setContribution] = useState<bigint>(BigInt(0));
  const [loading, setLoading] = useState(false);
  const [isDepositing, setisDepositing] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState('');
  const [userTokens, setUserTokens] = useState<Token[]>([]);
  const [inviteAddress, setInviteAddress] = useState('');
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [proposalStatus, setProposalStatus] = useState('all');
  if (loading) {console.log()}

  const wallet = useWallet();
  const {connection} = useConnection();
  const { fundId } = useParams();
  const metaplex = Metaplex.make(connection);

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

  const fetchFundData = useCallback(async () => {
    if (!wallet.publicKey) {
      return;
    }

    if (!fundId) {
      toast.error("Fund ID not found!");
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
      const name_dummy = buffer.slice(0, 32).toString();
      let name = '';
      for (const c of name_dummy) {
        if (c === '\x00') break;
        name += c;
      }
      const fundType = buffer.readUInt8(32);
      if (fundType === 0) {
        const members: [PublicKey, number][] = [];
        const numOfMembers = buffer.readUInt32LE(88);
        for (let i = 0; i < numOfMembers; i++) {
          members.push([new PublicKey(buffer.slice(92 + 36*i, 124 + 36*i)), buffer.readUInt32LE(124 + 36*i)]);
        }
        const expectedMembers = buffer.readUint8(87);
        const creatorExists = buffer.readUInt8(33) ? true : false;
        const creator = new PublicKey(buffer.slice(91, 123));
        const totalDeposit = buffer.readBigInt64LE(34);
        const vault = new PublicKey(buffer.slice(42, 74));
        const currentIndex = buffer.readUInt8(74);
        const created_at = buffer.readBigInt64LE(75);

        const [userPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("user"), wallet.publicKey.toBuffer()],
          programId,
        )

        const userAccountInfo = await connection.getAccountInfo(userPda);
        if (!userAccountInfo) return;

        const userBuffer = Buffer.from(userAccountInfo.data);
        const noOfFunds = userBuffer.readUint32LE(59);
        let contribution: bigint = BigInt(0);

        for (let i = 0; i < noOfFunds; i++) {
          const fundId = new PublicKey(userBuffer.slice(63 + i*55 , 95 + i*55));
          if (fundId.toBase58() === fundAccountPda.toBase58()) {
            contribution = userBuffer.readBigInt64LE(96 + i*55);
            break;
          }
        }

        setContribution(contribution);

        setFund({
          fundPubkey: fundAccountPda,
          fundType,
          name,
          expectedMembers,
          creatorExists,
          creator,
          numOfMembers,
          members,
          totalDeposit,
          vault,
          currentIndex,
          created_at,
        });
      }
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


  const handleDeposit = async () => {
    console.log(`Deposit ${amount} ${selectedToken?.symbol}`);
    if (!selectedToken) return;

    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        setisDepositing(false);
        toast.error('Wallet is not connected');
        return;
      }

      const user = wallet.publicKey;
      if (!selectedToken || !fund) {
        setisDepositing(false);
        toast.error('Token or fund not selected');
        return;
      }

      const mint = new PublicKey(selectedToken?.mint);

      const vaultATA = await getAssociatedTokenAddress(
        selectedToken.mint === 'So11111111111111111111111111111111111111111' ? new PublicKey('So11111111111111111111111111111111111111112') : mint,
        fund.vault,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      if (!fund.fundPubkey) {
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
          pubkey: selectedToken?.mint === 'So11111111111111111111111111111111111111111'
            ? keyp.publicKey
            : selectedToken?.pubkey,
          isSigner: selectedToken?.mint === 'So11111111111111111111111111111111111111111'
            ? true
            : false,
          isWritable: true
        },
        { pubkey: fund?.vault, isSigner: false, isWritable: true },
        { pubkey: vaultATA, isSigner: false, isWritable: true },
        {
          pubkey: selectedToken.mint === 'So11111111111111111111111111111111111111111'
            ? new PublicKey('So11111111111111111111111111111111111111112')
            : mint,
          isSigner: false,
          isWritable: true
        },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: fund.fundPubkey, isSigner: false, isWritable: true },
        { pubkey: userAccountPda, isSigner: false, isWritable: true },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },

      ];

      let transferAmount: bigint = BigInt(0);
      if (!amount.includes('.')) {
        transferAmount = BigInt(amount + '0'.repeat(selectedToken.decimals));
      } else {
        const [inPart, fracPart = ''] = amount.split('.');
        const paddedFrac = fracPart.slice(0, selectedToken.decimals).padEnd(selectedToken.decimals, '0');
        const fullStr = inPart + paddedFrac;
        transferAmount = BigInt(fullStr);
      }
      const instructionTag = Buffer.from([7]);
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigInt64LE(transferAmount);

      let mint_amount = transferAmount;
      if (selectedToken.mint === 'So11111111111111111111111111111111111111111' || selectedToken.mint === 'So11111111111111111111111111111111111111112') {
      const response = await axios(`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=${transferAmount}&slippageBps=50`);
        if (!response) {
          toast.error('Failed to fetch token price');
          return;
        }
        mint_amount = BigInt(response.data.outAmount);
        console.log(`SOL is being deposited worth $${mint_amount/BigInt(1000000)}`);
      }
      console.log(mint_amount);

      const minTAmountBuffer = Buffer.alloc(8);
      minTAmountBuffer.writeBigInt64LE(mint_amount);

      console.log(amountBuffer, minTAmountBuffer);

      const nameBytes = new TextEncoder().encode(fund.name);
      let tag = 0;
      if (selectedToken.pubkey.toBase58() === 'So11111111111111111111111111111111111111111') {
        tag = 1;
      }
      const isUnwrapped = Buffer.from([tag]);
      const fundType = Buffer.from([0]);

      const instructionData = Buffer.concat([instructionTag, isUnwrapped, fundType, amountBuffer, minTAmountBuffer, nameBytes]);
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

      if (selectedToken?.mint === 'So11111111111111111111111111111111111111111') {
        transaction.partialSign(keyp);
      }
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      setisDepositing(false);
      setShowDepositModal(false);
      toast.success('Successfully deposited assets to fund');
    } catch (err) {
      toast.error('Error depositing assets');
      console.log(err);
      setisDepositing(false);
    }
  };

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

  const fundValue = Number(fund.totalDeposit) / 1e6;


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 relative overflow-hidden flex flex-col lg:flex-row">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Sidebar */}
      <motion.div
        initial={{ x: -328 }}
        animate={{ x: 0 }}
        exit={{ x: -328 }}
        transition={{ type: '', stiffness: 300 }}
        className="lg:fixed lg:top-16 top-0 left-0 bottom-0 lg:w-[21%] w-full z-40 lg:h-auto h-screen bg-slate-900/95 backdrop-blur-xl border-r border-t border-indigo-800 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-blue-900/20" />

        {/* Sidebar Inner Content */}
        <div className="relative z-10 p-6 h-full overflow-y-auto hide-scrollbar">
          {/* Top Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                {fund.name}
              </h1>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
            >
              <motion.div
                animate={{ rotate: showSettings ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Settings className="w-5 h-5" />
              </motion.div>
            </button>
          </div>

          {/* Animated Switch Between Sidebar and Settings */}
          <AnimatePresence mode="wait">
            {!showSettings ? (
              <motion.div
                key="mainSidebar"
                initial={{ x: 100, opacity: 1 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                {/* Stats Section */}
                <div className="mb-8 space-y-4">
                  <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-2xl p-4 border border-slate-600/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400 text-sm">Fund Deposit</span>
                      <button onClick={() => setShowBalance(!showBalance)}>
                        {showBalance
                          ? <Eye className="w-4 h-4 text-slate-400" />
                          : <EyeOff className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {showBalance ? `$${fundValue.toFixed(2)}` : '****'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-slate-400 text-xs">Members</span>
                      </div>
                      <div className='flex justify-between items-center'>
                        <div className="text-lg font-bold text-white">{fund.numOfMembers}/{fund.expectedMembers}</div>
                        <button className='border w-5 h-5 rounded-full hover:bg-slate-700 flex justify-center items-center'>+</button>
                      </div>
                    </div>
                    <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-400 text-xs">Contribution</span>
                      </div>
                      <div className='flex justify-between items-center'>
                        <div className="text-lg font-bold text-white">{Number(fund.totalDeposit) === 0 ? '0%' : `${(Number(contribution) /Number(fund.totalDeposit)*100).toFixed(2)}%`}</div>
                        <button className='border w-5 h-5 rounded-full hover:bg-slate-700 flex justify-center items-center'>+</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="mb-6">
                  <div className="flex flex-col gap-2">
                    {[
                      { key: 'performance', label: '🚀 Performance', color: 'from-emerald-500 to-emerald-600' },
                      { key: 'members', label: '💤 Members', color: 'from-slate-500 to-slate-600' },
                      { key: 'proposals', label: '⏳ Proposals', color: 'from-orange-500 to-orange-600' }
                    ].map(tab => (
                      <motion.button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        whileHover={{ x: 4 }}
                        className={`relative group py-3 px-4 rounded-xl text-left transition-all duration-300 font-medium overflow-hidden ${
                          activeTab === tab.key
                            ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-white border border-purple-500/30'
                            : 'bg-slate-800/30 hover:bg-slate-700/50 text-slate-300 border border-slate-700/30'
                        }`}
                      >
                        {activeTab === tab.key && (
                          <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${tab.color}`} />
                        )}
                        <div className="flex items-center justify-between">
                          <span>{tab.label}</span>
                          <ChevronRight className="w-4 h-4 opacity-50" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="">
                  <h3 className="text-slate-400 text-sm font-medium mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    <motion.button
                      onClick={openDepositModal}
                      whileHover={{ x: 4 }}
                      className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-purple-600/10 to-blue-600/10 hover:from-purple-600/20 hover:to-blue-600/20 rounded-xl transition-all duration-300 text-slate-300 hover:text-white border border-purple-500/20"
                    >
                      <Plus className="w-5 h-5" />
                      Deposit
                    </motion.button>
                    <motion.button
                      onClick={() => setActiveTab('performance')}
                      whileHover={{ x: 4 }}
                      className="w-full flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-700/50 rounded-xl transition-all duration-300 text-slate-300 hover:text-white border border-slate-700/30"
                    >
                      <DollarSign className="w-5 h-5" />
                      Withdraw
                    </motion.button>
                    <motion.button
                      whileHover={{ x: 4 }}
                      className="w-full flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-700/50 rounded-xl transition-all duration-300 text-slate-300 hover:text-white border border-slate-700/30"
                    >
                      <BarChart3 className="w-5 h-5" />
                      Activities
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="settingsSidebar"
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-bold text-white">⚙️ Settings</h2>
                <div className="space-y-4 text-sm text-slate-300">
                  <div>
                    <label className="block mb-1">Dark Mode</label>
                    <button className="w-full bg-slate-800/30 hover:bg-slate-700/50 rounded-xl p-3 text-left">
                      Toggle Theme
                    </button>
                  </div>
                  <div>
                    <label className="block mb-1">Notification Preferences</label>
                    <button className="w-full bg-slate-800/30 hover:bg-slate-700/50 rounded-xl p-3 text-left">
                      Manage Notifications
                    </button>
                  </div>
                  <div>
                    <label className="block mb-1">Security</label>
                    <button className="w-full bg-slate-800/30 hover:bg-slate-700/50 rounded-xl p-3 text-left">
                      Wallet Re-authentication
                    </button>
                  </div>
                  <div>
                    <label className="block mb-1">About</label>
                    <p className="bg-slate-800/30 rounded-xl p-3">
                      Version 1.0.0<br />
                      Built with 💜 by your team.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Top Bar and Main Content */}
      <div className="flex-1 flex flex-col lg:ml-[21%] w-full">
        <div className={`fixed z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50 w-[79%] top-16`}>
          <div className="flex items-center justify-between p-6">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {activeTab === 'performance' ? 'Fund Performance & Holdings' :
                  activeTab === 'members' ? 'Fund Members' : 'Proposals'}
              </h2>
            </div>
            <div className='flex gap-2'>
              {activeTab === 'members' && (
                <>
                  <div className="relative">
                    {showInviteInput ? (
                      <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50 px-4 py-2 rounded-xl"
                      >
                        <input
                          type="text"
                          placeholder="Enter wallet address..."
                          value={inviteAddress}
                          onChange={(e) => setInviteAddress(e.target.value)}
                          className="bg-transparent outline-none text-white placeholder-slate-400 w-48"
                        />
                        <button
                          className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:brightness-110 transition"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setShowInviteInput(false);
                            setInviteAddress('');
                          }}
                          className="text-slate-400 hover:text-red-400 text-sm font-medium transition"
                        >
                          Cancel
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowInviteInput(true)}
                        className="bg-gradient-to-br from-purple-700 to-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-sm border border-purple-600 shadow-[0_0_6px_#7c3aed50] hover:shadow-[0_0_10px_#7c3aed80] transition-all"
                      >
                        Invite
                      </motion.button>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder='Search Members...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                    />
                  </div>
                </>
              )}
              {activeTab === 'proposals' && (
                <div className="flex items-center gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-1 flex">
                    {['all', 'active', 'passed', 'failed'].map((filterType) => (
                      <button
                        key={filterType}
                        onClick={() => setProposalStatus(filterType)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                          proposalStatus === filterType
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={() => setActiveTab("create-proposal")}
                      className="px-6 py-2 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 active:from-teal-700 active:to-emerald-700 text-white font-semibold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out">
                      Create Proposal
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all">
                <motion.button
                  whileTap={{ scale: 0.95, rotate: 90 }}
                >
                  <RefreshCw className="w-5 h-5 text-slate-400" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'performance' && (
          <FundPerformance fund={fund} connection={connection} metaplex={metaplex} userStakePercent={Number(contribution)/Number(fund.totalDeposit) * 100} setShowDepositModal={setShowDepositModal}/>
        )}
        {activeTab === 'members' && <FundMembers fund={fund} searchTerm={searchTerm} />}
        {activeTab === 'proposals' && (
          // <div className='mt-40 border'>Hello behen ke tako</div>
          <div className='mt-20'>
            <Proposals />
          </div>
        )}
        {activeTab === 'create-proposal' && (
          <div className='mt-20'>
            <CreateProposal fund={fund} connection={connection} metaplex={metaplex} />
          </div>
        )}
      </div>
      {showDepositModal && (
        <div onClick={(e) => {
          if (e.target === e.currentTarget) setShowDepositModal(false);
        }} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-[#171f32] border border-white/10 shadow-2xl rounded-3xl p-6 w-[90%] max-w-xl text-white transition-all duration-300 scale-100 relative animate-fadeIn">
            <h2 className="text-2xl font-bold mb-6 tracking-wide">💰 Deposit Tokens</h2>
            {userTokens && userTokens.length > 0 && selectedToken ? (
              <div className="flex justify-between text-xs text-white mb-2 px-1 min-h-[24px]">
                {/* Left: Token Balance */}
                <div className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  {selectedToken.symbol} balance: {selectedToken.balance}
                </div>

                {/* Right: Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setAmount(selectedToken.balance.toString())}
                    className="text-xs bg-gray-700 text-gray-300 px-2 py-[2px] rounded hover:bg-gray-600 transition"
                  >
                    Max
                  </button>
                  <button
                    onClick={() => setAmount((selectedToken.balance * 0.5).toFixed(6))}
                    className="text-xs bg-gray-700 text-gray-300 px-2 py-[2px] rounded hover:bg-gray-600 transition"
                  >
                    50%
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center text-xs text-white mb-2 px-1 min-h-[24px] animate-pulse">
                {/* Left: Icon + Gray Line */}
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-gray-700 rounded" />
                  <div className="h-3 w-28 bg-gray-700 rounded" />
                </div>

                {/* Right: Fake Buttons */}
                <div className="flex gap-2">
                  <div className="h-[18px] w-10 bg-gray-700 rounded" />
                  <div className="h-[18px] w-10 bg-gray-700 rounded" />
                </div>
              </div>
            )}
            <div className="flex items-center bg-[#0c1118] rounded-2xl overflow-x-auto text-white pr-2 min-h-[80px]">
              {(userTokens && userTokens.length > 0) ? (
                <>
                  {/* Token Selector */}
                  <div className="flex items-center justify-start px-2 gap-1 py-2 bg-[#2c3a4e] rounded-2xl m-3 cursor-pointer w-[30%]">
                    <div className="w-10 h-10 bg-gray-600 rounded-full">
                      {selectedToken?.image ? (
                        <img src={selectedToken.image} alt="token" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full bg-gray-600 rounded-full" />
                      )}
                    </div>
                    <select
                      value={selectedToken?.mint || ''}
                      onChange={(e) =>
                        setSelectedToken(userTokens.find((t) => t.mint === e.target.value) || null)
                      }
                      className="bg-transparent text-white text-xl outline-none cursor-pointer w-[60%]"
                    >
                      {userTokens.map((token) => (
                        <option key={token.mint} value={token.mint} className="text-black">
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount Input */}
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      let val = e.target.value;
                      const decimals = selectedToken?.decimals ?? 0;

                      if (val.includes('.')) {
                        const [inPart, decimalPart] = val.split('.');
                        if (decimalPart.length > decimals) {
                          val = `${inPart}.${decimalPart.slice(0, decimals)}`
                        }
                      }

                      setAmount(val);
                    }}
                    className="flex-1 text-right px-4 py-3 text-2xl bg-transparent outline-none placeholder-white"
                  />
                </>
              ) : (
                // 🌀 Loader Placeholder
                <div className="w-full flex justify-between items-center animate-pulse">
                  {/* Loader Token Box */}
                  <div className="flex items-center gap-3 bg-[#2c3a4e] px-3 py-2 rounded-2xl w-[30%] m-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-full" />
                    <div className="h-4 w-16 bg-gray-700 rounded" />
                  </div>
                </div>
              )}
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
    </div>
  );
}
