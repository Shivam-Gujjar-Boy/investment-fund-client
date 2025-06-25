import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Users,
  Search, Settings, Wallet,
  BarChart3, Activity,
  Eye, EyeOff, RefreshCw,
  ChevronRight, Grid3X3,
  List, DollarSign
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';

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

const dummyHoldingsData = [
  { name: 'SOL', value: 400 },
  { name: 'USDC', value: 300 },
  { name: 'BTC', value: 200 },
  { name: 'ETH', value: 100 },
];

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

export default function FundsList() {
  const [activeTab, setActiveTab] = useState('performance');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBalance, setShowBalance] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState('1M');
  // const [hoverIndex, setHoverIndex] = useState<number | null>(null);

// const leftSegment = hoverIndex !== null ? [{ startIndex: 0, endIndex: hoverIndex }] : [{ startIndex: 0, endIndex: dummyPerformanceData.length - 1 }];
// const rightSegment = hoverIndex !== null ? [{ startIndex: hoverIndex, endIndex: dummyPerformanceData.length - 1 }] : [];

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
        className="fixed top-16 left-0 bottom-0 w-[23%] bg-slate-900/95 backdrop-blur-xl border-r border-t border-indigo-800 z-50 overflow-hidden"
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
                Arbitrage Hunters
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
                      <span className="text-slate-400 text-sm">Total Portfolio</span>
                      <button onClick={() => setShowBalance(!showBalance)}>
                        {showBalance
                          ? <Eye className="w-4 h-4 text-slate-400" />
                          : <EyeOff className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-slate-400 text-xs">Members</span>
                      </div>
                    </div>
                    <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-400 text-xs">Active</span>
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
      <div className={`transition-all duration-300 ml-[23%]`}>
        <div className={`fixed z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50 w-[77%] top-16`}>
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
                  placeholder="Search funds..."
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
        {/* <div className="pt-40 px-6 text-white">Your content goes here</div> */}
        <div className="pt-28 px-2 text-white bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 h-screen">
          <div className="flex flex-col xl:flex-row gap-3 h-full">
            {/* Left - Holdings Pie Chart */}
            <div className="w-full xl:w-[41%] bg-slate-800/40 rounded-lg p-6 border border-slate-700/40 shadow-xl h-[60%]">
              <h3 className="text-lg font-semibold mb-4">Fund Holdings Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={dummyHoldingsData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    fill="#8884d8"
                    label
                  >
                    {dummyHoldingsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4b5563', color: 'white' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Right - Performance Line Chart */}
            <div className="w-[680px] bg-gradient-to-br from-purple-900/5 via-slate-800/50 to-blue-900/30 backdrop-blur-lg border border-purple-600/20 shadow-[0_0_5px_#7c3aed33] rounded-lg p-6 fixed right-2 top-44">
              <div className="flex items-center justify-between mb-4">
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
              <ResponsiveContainer width="100%" height={440}>
                <LineChart
                  data={dummyPerformanceData}
                  margin={{ top: 40, right: 40, left: 0, bottom: 20 }}
                  // onMouseMove={(e) => {
                  //   if (e && e.activeTooltipIndex != null) {
                  //     setHoverIndex(e.activeTooltipIndex);
                  //   }
                  // }}
                  // onMouseLeave={() => setHoverIndex(null)}
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
                    // segments={leftSegment}
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
                    // segments={rightSegment}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
