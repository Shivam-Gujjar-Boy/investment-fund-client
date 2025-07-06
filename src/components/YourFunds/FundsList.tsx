import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Plus, Users, 
  Search, Settings, Wallet, 
  BarChart3, Activity,
  Eye, EyeOff, RefreshCw,
   ChevronRight, Grid3X3,
  List
} from 'lucide-react';
import { UserFund, programId } from '../../types';
import { FundCard } from './FundCards';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { PublicKey } from '@solana/web3.js';
import { fundTags } from '../../types/tags';
import { useNavigate } from 'react-router-dom';

export default function FundsList() {
  const [funds, setFunds] = useState<UserFund[] | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBalance, setShowBalance] = useState(true);

  const wallet = useWallet();
  const {connection} = useConnection();
  const {connected} = wallet;
  const navigate = useNavigate();

  const getUserFunds = async () => {
    if (!connected || !wallet || !wallet.publicKey) return;
    const user_key = wallet.publicKey;
    setLoading(true);
    try {
      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user_key.toBuffer()],
        programId
      );
      const userAccountInfo = await connection.getAccountInfo(userAccountPda);
      if (userAccountInfo !== null) {
        const buffer = userAccountInfo.data;
        const num_of_funds = buffer.readUInt32LE(59);
        if (num_of_funds === 0) return;

        const funds_pubkey: PublicKey[] = [];
        const isPendings: boolean[] = [];
        const isEligibles: boolean[] = [];
        const votesYess: (bigint | null)[] = [];
        const votesNos: (bigint | null)[] = [];

        for (let i = 0; i < num_of_funds; i++) {
          const fund_pubkey = new PublicKey(buffer.slice(63 + i * 55, 95 + i * 55));
          const isPending = buffer.readUint8(104 + i * 55) ? true : false;
          const isEligible = buffer.readUint8(105 + i * 55) ? true : false;
          isPendings.push(isPending);
          isEligibles.push(isEligible);
          funds_pubkey.push(fund_pubkey);
        }

        console.log(funds_pubkey.map(fund_pubkey => fund_pubkey.toBase58()));

        const fundAccountInfos = await connection.getMultipleAccountsInfo(funds_pubkey);
        if (!fundAccountInfos) return;

        const fundDataArray: UserFund[] = fundAccountInfos.map((acc, i) => {
          if (!acc || !acc.data) return null;
          const acc_buffer = Buffer.from(acc.data);
          const name_dummy = acc_buffer.slice(0, 32).toString();
          let name = '';
          for (const c of name_dummy) {
            if (c === '\x00') break;
            name += c;
          }
          const fundType = acc_buffer.readUint8(32);
          const totalDeposit = acc_buffer.readBigInt64LE(34);
          const created_at = acc_buffer.readBigInt64LE(75);
          const tags = acc_buffer.readUInt32LE(83);
          const maxMembers = acc_buffer.readUInt8(87);
          const members: [PublicKey, number][] = [];
          const numOfMembers = acc_buffer.readUInt32LE(88);
          console.log(numOfMembers);
          for (let i = 0; i < numOfMembers; i++) {
            members.push([new PublicKey(acc_buffer.slice(92 + 36*i, 124 + 36*i)), acc_buffer.readUInt32LE(124 + 36*i)]);
          }
          const creator = new PublicKey(acc_buffer.slice(92, 124));

          let num = 2;
          let secondaryTagId: number;
          for (let i=1; i<32; i++) {
            if (tags & num) {
              secondaryTagId = i;
            }
            num *= 2;
          }

          const secondaryTag = fundTags.find((tag) => tag.id === secondaryTagId.toString())

          return {
            fundPubkey: funds_pubkey[i],
            fundType: fundType,
            isPending: isPendings[i],
            isEligible: isEligibles[i],
            votesYes: votesYess[i],
            votesNo: votesNos[i],
            name,
            expectedMembers: maxMembers,
            numOfMembers,
            totalDeposit,
            created_at,
            is_private: 1,
            secondaryTag: secondaryTag?.name,
            creator,
            members,
          };
        }).filter((f): f is UserFund => f !== null);

        setFunds(fundDataArray);
      } else {
        toast.error("Error Extracting User funds");
        setFunds([]);
      }
    } catch (error) {
      console.error('Error fetching user data: ', error);
      setFunds([]);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getUserFunds();
  }, [connected, wallet, connection]);

  const activeFunds = funds?.filter(f => f.totalDeposit > 0n && !f.isPending) ?? [];
  const inactiveFunds = funds?.filter(f => f.totalDeposit === 0n && !f.isPending) ?? [];
  const pendingFunds = funds?.filter(f => f.isPending) ?? [];
  const currentFunds = activeTab === 'active' ? activeFunds : (activeTab === 'inactive' ? inactiveFunds : pendingFunds);

  const totalValue = activeFunds.reduce((sum, fund) => sum + Number(fund.totalDeposit), 0) / 1e6;
  const totalMembers = activeFunds.reduce((sum, fund) => sum + fund.numOfMembers, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 relative overflow-hidden">
      {/* Custom CSS for hiding scrollbars */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -328 }}
            animate={{ x: 0 }}
            exit={{ x: -328 }}
            transition={{ type: '', stiffness: 300 }}
            className="fixed top-16 left-0 bottom-0 w-[23%] bg-slate-900/95 backdrop-blur-xl border-r border-t border-indigo-800 z-50 overflow-hidden"
          >
            {/* Sidebar Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-blue-900/20" />
            
            <div 
              className="relative z-10 p-6 h-full overflow-y-auto hide-scrollbar"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                    Your Funds
                  </h1>
                </div>
                <button 
                  onClick={() => setSidebarOpen(false)} 
                  className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Stats */}
              <div className="mb-8 space-y-4">
                <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-2xl p-4 border border-slate-600/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Total Deposit</span>
                    <button onClick={() => setShowBalance(!showBalance)}>
                      {showBalance ? <Eye className="w-4 h-4 text-slate-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {showBalance ? `$${totalValue.toFixed(2)}` : '****'}
                  </div>
                  {/* <div className={`text-sm ${avgPerformance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {avgPerformance > 0 ? '+' : ''}{avgPerformance.toFixed(1)}% overall
                  </div> */}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-slate-400 text-xs">Members</span>
                    </div>
                    <div className="text-lg font-bold text-white">{totalMembers}</div>
                  </div>
                  <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-400 text-xs">Active</span>
                    </div>
                    <div className="text-lg font-bold text-white">{activeFunds.length}</div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="mb-6">
                <div className="flex flex-col gap-2">
                  {[
                    { key: 'active', label: '🚀 Active Funds', count: activeFunds.length, color: 'from-emerald-500 to-emerald-600' },
                    { key: 'inactive', label: '💤 Inactive Funds', count: inactiveFunds.length, color: 'from-slate-500 to-slate-600' },
                    { key: 'pending', label: '⏳ Pending Funds', count: pendingFunds.length, color: 'from-orange-500 to-orange-600' }
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-slate-700 px-2 py-1 rounded-full">{tab.count}</span>
                          <ChevronRight className="w-4 h-4 opacity-50" />
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mb-6">
                <h3 className="text-slate-400 text-sm font-medium mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <motion.button
                    whileHover={{ x: 4 }}
                    className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-purple-600/10 to-blue-600/10 hover:from-purple-600/20 hover:to-blue-600/20 rounded-xl transition-all duration-300 text-slate-300 hover:text-white border border-purple-500/20"
                  >
                    <Plus className="w-5 h-5" />
                    Create New Fund
                  </motion.button>
                  <motion.button
                    whileHover={{ x: 4 }}
                    className="w-full flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-700/50 rounded-xl transition-all duration-300 text-slate-300 hover:text-white border border-slate-700/30"
                  >
                    <Search className="w-5 h-5" />
                    Discover Funds
                  </motion.button>
                  <motion.button
                    whileHover={{ x: 4 }}
                    className="w-full flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-700/50 rounded-xl transition-all duration-300 text-slate-300 hover:text-white border border-slate-700/30"
                  >
                    <BarChart3 className="w-5 h-5" />
                    Analytics
                  </motion.button>
                </div>
              </div>

              {/* Settings */}
              <div className="mt-auto pt-6 border-t border-slate-700/30">
                <motion.button
                  whileHover={{ x: 4 }}
                  className="w-full flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-700/50 rounded-xl transition-all duration-300 text-slate-300 hover:text-white"
                >
                  <Settings className="w-5 h-5" />
                  Settings
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-[23%]' : 'ml-0'}`}>
        {/* Top Bar */}
        <div className={`fixed z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50 ${sidebarOpen ? 'w-[77%]' : 'w-[100%]'} top-16`}>
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              {!sidebarOpen && (
                <motion.button
                  onClick={() => setSidebarOpen(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
                >
                  <Menu className="w-5 h-5" />
                </motion.button>
              )}
              <div>
                <h2 className="text-2xl font-bold text-white capitalize">{activeTab} Funds</h2>
                <p className="text-slate-400">Manage your decentralized investment portfolio</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search funds..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>

              {/* View Mode Toggle */}
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

              {/* Notifications */}
              {/* <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all relative"
                >
                  <Bell className="w-5 h-5 text-slate-400" />
                  {notifications > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                      {notifications}
                    </div>
                  )}
                </motion.button>
              </div> */}

              {/* Refresh */}
              <motion.button
                onClick={() => getUserFunds()}
                whileHover={{ scale: 1.05, rotate: 180 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all"
              >
                <RefreshCw className="w-5 h-5 text-slate-400" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 mt-24">
          {loading ? (
            <div className="flex justify-center items-center h-96">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-slate-700 rounded-full animate-spin border-t-purple-500" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping border-t-purple-400" />
              </div>
            </div>
          ) : currentFunds.length > 0 ? (
            <motion.div
              className='flex gap-6 flex-wrap'
            >
              <AnimatePresence>
                {currentFunds
                  .filter(fund => fund.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((fund, index) => (
                    <FundCard key={fund.name + index} fund={fund} />
                  ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Wallet className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {activeTab === 'active'
                  ? "No active funds found"
                  : activeTab === 'inactive'
                  ? "No inactive funds"
                  : "No pending funds"}
              </h3>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                {activeTab === 'active'
                  ? "Start your DeFi journey by creating or joining a fund to begin investing together."
                  : activeTab === 'inactive'
                  ? "Inactive funds will appear here when you have funds with no deposits."
                  : "Pending fund approvals and invitations will be shown here."}
              </p>
              <motion.button
                onClick={() => {
                  navigate('/dashboard/create')
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                Create Your First Fund
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}