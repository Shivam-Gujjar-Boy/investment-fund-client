import { motion } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, DollarSign, Shield,
  ArrowUpRight,
  Timer, Users, UserPlus2,
  ArrowDownLeft
} from 'lucide-react';
import { UserFund } from '../../types';
import { useNavigate } from 'react-router-dom';

interface FundCardProps {
    fund: UserFund;
    status: string
}

export const FundCard = ({ fund, status }: FundCardProps) => {
    console.log(status);
    const navigate = useNavigate();
    return (
    <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        whileHover={{ y: 0, scale: 1.005 }}
        className="mt-2 group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-slate-700/50 hover:border-purple-500/50 w-[330px]"
    >
        <div className="relative p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                // fund.category === 'DeFi' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                // fund.category === 'Crypto' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                // fund.category === 'Yield' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                'bg-gradient-to-br from-orange-500 to-orange-600'
            }`}>
                {/* {fund.category === 'DeFi' ? <Zap className="w-6 h-6 text-white" /> :
                fund.category === 'Crypto' ? <Coins className="w-6 h-6 text-white" /> :
                fund.category === 'Yield' ? <Target className="w-6 h-6 text-white" /> : */}
                <Users className="w-6 h-6 text-white" />
            </div>
            <div>
                <h3 className="font-bold text-white text-lg group-hover:text-purple-300 transition-colors">
                {fund.name}
                </h3>
                <p className="text-slate-400 text-sm">{fund.fundType === 0 ? 'Light Fund' : fund.fundType === 1 ? 'Standard Fund' : 'DAO-Style'} • {fund.secondaryTag}</p>
            </div>
            </div>
            <div className="flex items-center gap-2">
            {fund.isPending && <Timer className="w-4 h-4 text-orange-400" />}
            {fund.isEligible && <Shield className="w-4 h-4 text-emerald-400" />}
            </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
            <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Value</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-white font-bold text-lg">
                ${(Number(fund.totalDeposit) / 1e9).toFixed(2)} SOL
            </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
            <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Performance</span>
                {/* {fund.performance > 0 ? 
                <TrendingUp className="w-4 h-4 text-emerald-400" /> : 
                <TrendingDown className="w-4 h-4 text-red-400" />
                } */}
            </div>
            {/* <p className={`font-bold text-lg ${fund.performance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fund.performance > 0 ? '+' : ''}{fund.performance.toFixed(1)}%
            </p> */}
            </div>
        </div>

        {/* Members Progress */}
        <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Members</span>
            <span className="text-slate-300 text-sm">{fund.numOfMembers}/{fund.expectedMembers}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(fund.numOfMembers / fund.expectedMembers) * 100}%` }}
            />
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
            {fund.fundType === 0 && fund.isPending && (
                <motion.button
                    onClick={() => {
                        navigate('/dashboard/fund-details');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        Accept
                </motion.button>
            )}
            {fund.fundType === 0 && fund.isPending && (
                <motion.button
                    onClick={() => {
                        navigate('/dashboard/fund-details');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-gradient-to-r from-rose-500 to-amber-500 text-white py-2 px-4 rounded-xl font-medium hover:from-rose-600 hover:to-amber-600 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <ArrowDownLeft className="w-4 h-4" />
                        Reject
                </motion.button>
            )}
            {fund.fundType !== 0 && fund.isPending && (
                <motion.button
                    onClick={() => {
                        navigate('/dashboard/fund-details');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        Delete
                </motion.button>
            )}
            {fund.fundType !== 0 && fund.isPending && fund.isEligible && (
                <motion.button
                    onClick={() => {
                        navigate('/dashboard/fund-details');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        Join
                </motion.button>
            )}
            {fund.fundType !== 0 && fund.isPending && (
                <motion.button
                    onClick={() => {
                        navigate('/dashboard/fund-details');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        Delete
                </motion.button>
            )}
            {fund.fundType !== 0 && fund.isPending && (
                <motion.button
                    onClick={() => {
                        navigate('/dashboard/fund-details');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        Delete
                </motion.button>
            )}
            {!fund.isPending && (
                <motion.button
                    onClick={() => {
                        navigate('/dashboard/fund-details');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        View Details
                </motion.button>
            )}
            {fund.fundType === 0 && !fund.isPending && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-xl transition-colors"
                    >
                    <UserPlus2 className="w-4 h-4" />
                </motion.button>
            )}
        </div>
        </div>
    </motion.div>
)};