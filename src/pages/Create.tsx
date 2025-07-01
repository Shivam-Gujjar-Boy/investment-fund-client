import { useState } from 'react';
import { Users, Shield, Building2, Zap, Vote, Coins, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Create() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const navigate = useNavigate();

  const fundTypes = [
    {
      id: 1,
      type: 'Light Fund',
      title: 'Casual Collective',
      subtitle: 'Perfect for friends & colleagues',
      description: 'Start investing together without the complexity. Simple multisig setup for small to medium investments.',
      icon: Users,
      gradient: 'from-blue-500 via-cyan-500 to-teal-500',
      bgGradient: 'from-blue-500/10 via-cyan-500/10 to-teal-500/10',
      features: ['Multisig wallet security', 'No governance overhead', 'Quick setup process'],
      color: 'text-cyan-400',
      borderColor: 'border-cyan-500/30',
      hoverBorder: 'group-hover:border-cyan-400',
      glowColor: 'shadow-cyan-500/25',
    },
    {
      id: 2,
      type: 'Standard Fund',
      title: 'Professional Pool',
      subtitle: 'For serious investors',
      description: 'Structured investment fund with governance tokens and voting mechanisms for professional collaborations.',
      icon: Shield,
      gradient: 'from-purple-500 via-pink-500 to-orange-500',
      bgGradient: 'from-purple-500/10 via-pink-500/10 to-orange-500/10',
      features: ['Governance token system', 'Voting mechanisms', 'Professional structure'],
      color: 'text-pink-400',
      borderColor: 'border-pink-500/30',
      hoverBorder: 'group-hover:border-pink-400',
      glowColor: 'shadow-pink-500/25',
    },
    {
      id: 3,
      type: 'DAO-Style Fund',
      title: 'Enterprise DAO',
      subtitle: 'Full decentralized governance',
      description: 'Enterprise-grade fund with complete decentralized autonomous organization features for firms and HNIs.',
      icon: Building2,
      gradient: 'from-emerald-500 via-green-500 to-lime-500',
      bgGradient: 'from-emerald-500/10 via-green-500/10 to-lime-500/10',
      features: ['Full DAO governance', 'Detailed proposals', 'Enterprise security'],
      color: 'text-green-400',
      borderColor: 'border-green-500/30',
      hoverBorder: 'group-hover:border-green-400',
      glowColor: 'shadow-green-500/25',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 sm:w-64 md:w-80 h-48 sm:h-64 md:h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-20 -left-20 w-48 sm:w-64 md:w-80 h-48 sm:h-64 md:h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-0.5 h-0.5 sm:w-1 sm:h-1 bg-white/20 rounded-full animate-ping"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-full px-4 sm:px-6 py-2 mb-4 sm:mb-6 border border-purple-500/30">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 text-xs sm:text-sm font-medium">Decentralized Investment Platform</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-4">
              Create Your Fund
            </h1>
            <p className="text-base sm:text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Choose the perfect fund structure for your investment goals. From casual collaborations to enterprise-grade DAOs.
            </p>
          </div>

          {/* Fund Type Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-10 sm:mb-12">
            {fundTypes.map((fund) => {
              const IconComponent = fund.icon;
              return (
                <div
                  key={fund.id}
                  className={`group relative bg-gradient-to-br ${fund.bgGradient} backdrop-blur-xl rounded-2xl border ${fund.borderColor} ${fund.hoverBorder} transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${fund.glowColor} overflow-hidden active:scale-[0.98] touch-none`}
                  onMouseEnter={() => setHoveredCard(fund.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  {/* Animated border gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${fund.gradient} opacity-0 group-hover:opacity-20 group-active:opacity-30 transition-opacity duration-500 rounded-2xl`}></div>
                  {/* Content */}
                  <div className="relative p-6 sm:p-8 h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <div className={`p-2 sm:p-3 rounded-xl bg-gradient-to-r ${fund.gradient} shadow-lg`}>
                        <IconComponent className="w-6 sm:w-8 h-6 sm:h-8 text-white" />
                      </div>
                      <div className="text-right">
                        <div className={`text-xs sm:text-sm font-medium ${fund.color} mb-1`}>{fund.type}</div>
                        <div className="text-xl sm:text-2xl font-bold text-white">{fund.title}</div>
                      </div>
                    </div>
                    {/* Subtitle */}
                    <p className="text-gray-300 text-base sm:text-lg mb-3 sm:mb-4 font-medium">{fund.subtitle}</p>
                    {/* Description */}
                    <p className="text-gray-400 text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed flex-grow">{fund.description}</p>
                    {/* Features */}
                    <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                      {fund.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 sm:gap-3">
                          <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${fund.gradient}`}></div>
                          <span className="text-gray-300 text-xs sm:text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                    {/* Action Button */}
                    <button
                      onClick={() => {
                        if (fund.id === 1) {
                          navigate('light-fund');
                        }
                      }}
                      className={`w-full py-3 sm:py-4 rounded-xl bg-gradient-to-r ${fund.gradient} text-white font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25 active:scale-95 flex items-center justify-center gap-2 cursor-pointer`}
                    >
                      <span className="text-sm sm:text-base">Create {fund.type}</span>
                      <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5 transition-transform group-hover:translate-x-1 group-active:translate-x-2" />
                    </button>
                  </div>
                  {/* Hover effect overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${fund.gradient} opacity-0 group-hover:opacity-5 group-active:opacity-10 transition-opacity duration-500 rounded-2xl pointer-events-none`}></div>
                </div>
              );
            })}
          </div>

          {/* Bottom Section */}
          <div className="text-center">
            <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-4 bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-xl rounded-2xl px-4 sm:px-6 py-4 sm:py-6 border border-gray-600/30">
              <div className="flex items-center gap-2">
                <Zap className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-400" />
                <span className="text-gray-300 text-sm sm:text-base">Lightning Fast Setup</span>
              </div>
              <div className="hidden sm:block w-px h-5 sm:h-6 bg-gray-600"></div>
              <div className="flex items-center gap-2">
                <Vote className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                <span className="text-gray-300 text-sm sm:text-base">Governance Ready</span>
              </div>
              <div className="hidden sm:block w-px h-5 sm:h-6 bg-gray-600"></div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 sm:w-5 h-4 sm:h-5 text-green-400" />
                <span className="text-gray-300 text-sm sm:text-base">Multi-Asset Support</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}