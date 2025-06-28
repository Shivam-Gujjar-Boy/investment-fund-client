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
  ChevronRight, Grid3X3,
  List, DollarSign
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import toast from 'react-hot-toast';
import { programId } from '../types';
import VaultHoldings from '../components/FundInformation/VaultHoldings';
import { Metaplex } from '@metaplex-foundation/js';
import { fetchUserTokens } from '../functions/fetchuserTokens';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import axios from 'axios';
import FundMembersFancy from '../components/FundInformation/FundMembers';

// Dummy Data for Fund Graph for now
const dummyPerformanceData = [
  { time: 'Jan 01', value: 2400 },
  { time: 'Jan 05', value: 2550 },
  { time: 'Jan 10', value: 2620 },
  { time: 'Jan 15', value: 2500 },
  { time: 'Jan 20', value: 2680 },
  { time: 'Jan 25', value: 2750 },
  { time: 'Feb 01', value: 2700 },
  { time: 'Feb 05', value: 2890 },
  { time: 'Feb 10', value: 2920 },
  { time: 'Feb 15', value: 2780 },
  { time: 'Feb 20', value: 2840 },
  { time: 'Feb 25', value: 2970 },
  { time: 'Mar 01', value: 3100 },
  { time: 'Mar 05', value: 3240 },
  { time: 'Mar 10', value: 3170 },
  { time: 'Mar 15', value: 3300 },
  { time: 'Mar 20', value: 3430 },
  { time: 'Mar 25', value: 3390 },
  { time: 'Apr 01', value: 3500 },
  { time: 'Apr 05', value: 3620 },
  { time: 'Apr 10', value: 3570 },
  { time: 'Apr 15', value: 3700 },
  { time: 'Apr 20', value: 3840 },
  { time: 'Apr 25', value: 3920 },
  { time: 'May 01', value: 3890 },
  { time: 'May 05', value: 4050 },
  { time: 'May 10', value: 4100 },
  { time: 'May 15', value: 4220 },
  { time: 'May 20', value: 4300 },
  { time: 'May 25', value: 4390 },
  { time: 'Jun 01', value: 4520 },
  { time: 'Jun 05', value: 4600 },
];

export default function FundsList() {
  const [fund, setFund] = useState<LightFund | null>(null);
  const [activeTab, setActiveTab] = useState('performance');
  const [viewMode, setViewMode] = useState('grid');
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
  const [activeTimeframe, setActiveTimeframe] = useState('1M');
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
      const name_dummy = buffer.slice(0, 31).toString();
      let name = '';
      for (const c of name_dummy) {
        if (c === '\x00') break;
        name += c;
      }
      const fundType = buffer.readUInt8(31);
      if (fundType === 0) {
        const members: PublicKey[] = [];
        const numOfMembers = buffer.readUInt32LE(87);
        for (let i = 0; i < numOfMembers; i++) {
          members.push(new PublicKey(buffer.slice(91 + 32 * i, 123 + 32 * i)));
        }
        const expectedMembers = buffer.readUint8(86);
        const creatorExists = buffer.readUInt8(32) ? true : false;
        const creator = new PublicKey(buffer.slice(91, 123));
        const totalDeposit = buffer.readBigInt64LE(33);
        const vault = new PublicKey(buffer.slice(41, 73));
        const currentIndex = buffer.readUInt8(73);
        const created_at = buffer.readBigInt64LE(74);

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
          const fundId = new PublicKey(userBuffer.slice(63 + i*51 , 95 + i*51));
          if (fundId.toBase58() === fundAccountPda.toBase58()) {
            contribution = userBuffer.readBigInt64LE(96 + i*51);
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
      // console.log(mint.toBase58(), '---------');

      const vaultATA = await getAssociatedTokenAddress(
        mint,
        fund.vault,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // console.log('Vault ATA', vaultATA.toBase58());

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
        { pubkey: fund.fundPubkey, isSigner: false, isWritable: true },
        { pubkey: userAccountPda, isSigner: false, isWritable: true },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },

      ];
      // console.log("user wallet", user.toBase58());
      // console.log("member ata", keyp.publicKey.toBase58(), " ", selectedToken.pubkey.toBase58());
      // console.log("vault", fund.vault.toBase58());
      // console.log("vault ata", vaultATA.toBase58());
      // console.log("mint account", mint.toBase58());
      // console.log("token program", TOKEN_PROGRAM_ID.toBase58());
      // console.log("ata program", ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());
      // console.log("fund account", fund.fundPubkey.toBase58());
      // console.log("user pda", userAccountPda.toBase58());
      // console.log("system program", SYSTEM_PROGRAM_ID.toBase58());
      // console.log("rentsysvar", SYSVAR_RENT_PUBKEY.toBase58());

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

      const response = await axios(`https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=${transferAmount}&slippageBps=50`);
      if (!response) {
        toast.error('Failed to fetch token price');
        return;
      }
      let mint_amount = transferAmount;
      if (selectedToken.mint !== 'So11111111111111111111111111111111111111112') {
        mint_amount = BigInt(response.data.outAmount);
      }
      console.log(mint_amount);

      const minTAmountBuffer = Buffer.alloc(8);
      minTAmountBuffer.writeBigInt64LE(mint_amount);

      console.log(amountBuffer, minTAmountBuffer);

      const nameBytes = new TextEncoder().encode(fund.name);
      const fundType = Buffer.from([0]);

      const instructionData = Buffer.concat([instructionTag, fundType, amountBuffer, minTAmountBuffer, nameBytes]);
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

  const fundValue = Number(fund.totalDeposit) / 1e9;


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 relative overflow-hidden">
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
        className="fixed top-16 left-0 bottom-0 w-[21%] bg-slate-900/95 backdrop-blur-xl border-r border-t border-indigo-800 z-50 overflow-hidden"
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
                      <span className="text-slate-400 text-sm">Fund Portfolio</span>
                      <button onClick={() => setShowBalance(!showBalance)}>
                        {showBalance
                          ? <Eye className="w-4 h-4 text-slate-400" />
                          : <EyeOff className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {showBalance ? `${fundValue.toFixed(2)} SOL` : '****'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-slate-400 text-xs">Members</span>
                      </div>
                      <div className="text-lg font-bold text-white">{fund.numOfMembers}/{fund.expectedMembers}</div>
                    </div>
                    <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-400 text-xs">Contribution</span>
                      </div>
                      <div className="text-lg font-bold text-white">{Number(fund.totalDeposit) === 0 ? '0%' : `${Number(contribution /fund.totalDeposit)*100}%`}</div>
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
      <div className={`transition-all duration-300 ml-[21%]`}>
        <div className={`fixed z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50 w-[79%] top-16`}>
          <div className="flex items-center justify-between p-6">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {activeTab === 'performance' ? 'Fund Performance & Holdings' :
                  activeTab === 'members' ? 'Fund Members' : 'Proposals'}
              </h2>
              <p className="text-slate-400">Manage your decentralized investment portfolio</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder='Search Funds...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>

              <div className="flex bg-slate-800/50 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <motion.button
                whileHover={{ scale: 1.05, rotate: 180 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all"
              >
                <RefreshCw className="w-5 h-5 text-slate-400" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'performance' && (
          <div className="pt-28 px-2 text-white bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 h-screen">
            <div className="flex gap-3 h-full">
              {/* Left - Performance Line Chart */}
              <div className="w-[60%] bg-gradient-to-br from-purple-900/5 via-slate-800/50 to-blue-900/30 backdrop-blur-lg border border-purple-600/20 shadow-[0_0_5px_#7c3aed33] rounded-lg p-6 h-[85%] flex flex-col">
                <div className="flex items-center justify-between mb-4 h-[10%]">
                  <h3 className="text-lg font-semibold">Fund Value Over Time</h3>
                  <div className="flex gap-2">
                    {["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"].map((label) => (
                      <button
                        key={label}
                        onClick={() => setActiveTimeframe(label)}
                        className={`px-3 py-1 rounded-lg text-sm transition-all duration-300 border ${
                          activeTimeframe === label
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-slate-700/30 text-slate-300 border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart
                    data={dummyPerformanceData}
                    margin={{ top: 40, right: 40, left: 0, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid stroke="#475569" strokeDasharray="4 4" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#cbd5e1" />
                    <YAxis stroke="#cbd5e1" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#7c3aed",
                        color: "white",
                        borderRadius: 10,
                      }}
                      cursor={{ stroke: "#7c3aed", strokeWidth: 2, opacity: 0.2 }}
                    />

                    {/* Left highlighted segment */}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="url(#lineGradient)"
                      strokeWidth={4}
                      dot={false}
                      isAnimationActive={false}
                    />

                    {/* Right faded segment */}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#8b5cf6"
                      strokeWidth={4}
                      strokeDasharray="6 6"
                      opacity={0.2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Right - Holdings Pie Chart */}
              <div className='w-[39%] h-[85%]'>
                <VaultHoldings vault={fund?.vault} connection={connection} metaplex={metaplex}/>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'members' && <FundMembersFancy fund={fund} />}
      </div>
      {showDepositModal && (
        <div onClick={(e) => {
          if (e.target === e.currentTarget) setShowDepositModal(false);
        }} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-[#171f32] border border-white/10 shadow-2xl rounded-3xl p-6 w-[90%] max-w-xl text-white transition-all duration-300 scale-100 relative animate-fadeIn">
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
