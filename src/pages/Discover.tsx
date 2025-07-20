import { Shield, Users, TrendingUp, Vote, Globe, Building2, Sparkles, ChevronRight, Star, Award, PiggyBank, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Discover() {
  const navigate = useNavigate();

  const fundTypes = [
    {
      type: "Light Fund",
      subtitle: "Private & Democratic",
      description: "Perfect for friends, family, or small groups who want to invest together with equal voting power.",
      features: ["Private membership", "Equal voting rights", "Invite-only access", "Democratic decisions"],
      icon: Users,
      gradient: "from-purple-600 to-indigo-600",
      bgGradient: "from-purple-900/30 via-indigo-900/30 to-gray-900/30",
      borderColor: "border-purple-500/30"
    },
    {
      type: "Standard Fund",
      subtitle: "Public & Merit-Based",
      description: "Open to everyone with voting power proportional to contribution. Learn while you earn.",
      features: ["Public access", "Contribution-based voting", "Learn from experienced traders", "Transparent operations"],
      icon: Globe,
      gradient: "from-violet-600 to-purple-600",
      bgGradient: "from-violet-900/30 via-purple-900/30 to-gray-900/30",
      borderColor: "border-violet-500/30"
    },
    {
      type: "DAO-Style Fund",
      subtitle: "Professional & Customizable",
      description: "Enterprise-grade solution with custom governance rules for organizations and institutions.",
      features: ["Custom governance", "Professional management", "Enterprise security", "Tailored solutions"],
      icon: Building2,
      gradient: "from-indigo-600 to-blue-600",
      bgGradient: "from-indigo-900/30 via-blue-900/30 to-gray-900/30",
      borderColor: "border-indigo-500/30"
    }
  ];

  const keyFeatures = [
    {
      icon: PiggyBank,
      title: "Multi-Token Support",
      description: "Deposit any token - SOL, USDC, meme coins, or your favorite altcoins. Complete flexibility.",
      color: "text-purple-400"
    },
    {
      icon: Vote,
      title: "Proposal System",
      description: "Create investment proposals, explain your strategy, and let the community vote on execution.",
      color: "text-violet-400"
    },
    {
      icon: Shield,
      title: "Trustless Security",
      description: "Smart contracts handle everything. No central authority, no single point of failure.",
      color: "text-indigo-400"
    },
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Track fund performance, your voting history, and PnL with comprehensive dashboards.",
      color: "text-purple-400"
    },
    {
      icon: TrendingUp,
      title: "Profit Distribution",
      description: "Automatic and fair profit sharing based on your contribution and fund rules.",
      color: "text-violet-400"
    },
    {
      icon: Sparkles,
      title: "Learn by Doing",
      description: "Start small, learn from experienced traders, and grow your crypto knowledge practically.",
      color: "text-indigo-400"
    }
  ];

  const benefits = [
    "🔒 **Trustless Operations** - Smart contracts eliminate counterparty risk",
    "🌐 **Global Access** - Invest with people worldwide, 24/7",
    "📊 **Transparent Voting** - Every decision is recorded on-chain",
    "⚡ **Instant Execution** - Proposals execute automatically when approved",
    "🎯 **Risk Management** - Diversify through collective decision-making",
    "🚀 **No Minimum** - Start with any amount, even $1"
  ];

  return (
    <div className="py-8 bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Hero Section */}
        <section className="text-center mb-20 animate-fadeInScale">
          <div className="relative">
            <h1 className="text-5xl sm:text-7xl font-bold text-white mb-8 animate-textGlow">
              Discover the Future of{' '}
              <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent animate-pulse">
                Collective Investing
              </span>
            </h1>
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-r from-purple-500/20 to-violet-500/20 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute -bottom-10 -left-10 w-16 h-16 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse"></div>
          </div>
          <p className="text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed mb-12 animate-slideInUp">
            Join thousands of investors who are revolutionizing DeFi through <span className="text-purple-400 font-semibold">collaborative fund management</span>. 
            Whether you're a beginner or expert, there's a fund type perfect for your journey.
          </p>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mb-16">
            {[
              { number: "500+", label: "Active Funds" },
              { number: "$2.5M+", label: "Total Value Locked" },
              { number: "10k+", label: "Community Members" },
              { number: "98%", label: "Success Rate" }
            ].map((stat, i) => (
              <div key={i} className="text-center group hover:scale-110 transition-transform duration-300">
                <div className="text-3xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors duration-300">
                  {stat.number}
                </div>
                <div className="text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fund Types */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold text-white text-center mb-4 animate-textGlow">
            Choose Your Fund Type
          </h2>
          <p className="text-xl text-gray-300 text-center mb-16 max-w-3xl mx-auto">
            Every investor is different. That's why we offer three distinct fund types, each designed for specific needs and experience levels.
          </p>
          
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {fundTypes.map((fund, i) => (
              <div 
                key={i} 
                className={`group relative bg-gray-800/20 backdrop-blur-xl rounded-3xl p-8 border ${fund.borderColor} hover:border-purple-500/50 hover:shadow-[0_0_40px_#8b5cf622] hover:scale-105 transition-all duration-500 cursor-pointer`}
              >
                <div className="relative z-10">
                  <div className={`w-16 h-16 bg-gradient-to-r ${fund.gradient} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                    <fund.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors duration-300">
                    {fund.type}
                  </h3>
                  <p className="text-purple-400 font-semibold mb-4">{fund.subtitle}</p>
                  <p className="text-gray-300 mb-6 leading-relaxed">{fund.description}</p>
                  
                  <div className="space-y-3">
                    {fund.features.map((feature, j) => (
                      <div key={j} className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                        <span className="text-gray-300 group-hover:text-white transition-colors duration-300">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div
                    onClick={() => navigate('/dashboard/create')}
                    className="mt-8 flex items-center justify-between">
                    <span className="text-purple-400 font-semibold group-hover:text-purple-300 transition-colors duration-300">
                      Learn More
                    </span>
                    <ChevronRight className="w-5 h-5 text-purple-400 group-hover:text-purple-300 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-violet-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </div>
            ))}
          </div>
          
          {/* Professional Fund CTA */}
          <div className="text-center bg-gradient-to-r from-purple-900/20 via-indigo-900/20 to-violet-900/20 rounded-3xl p-8 border border-purple-500/30 backdrop-blur-xl">
            <Building2 className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-4">Need a Professional Fund?</h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Organizations and institutions can get custom DAO-style funds with tailored governance rules. 
              Contact us for enterprise solutions.
            </p>
            <button className="bg-gradient-to-r from-purple-600 to-violet-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-purple-500 hover:to-violet-500 transition-all duration-300 hover:scale-105">
              Contact Us
            </button>
          </div>
        </section>

        {/* Key Features */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold text-white text-center mb-4 animate-textGlow">
            Powerful Features for Modern Investors
          </h2>
          <p className="text-xl text-gray-300 text-center mb-16 max-w-3xl mx-auto">
            Our platform combines the best of traditional fund management with cutting-edge blockchain technology.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {keyFeatures.map((feature, i) => (
              <div 
                key={i} 
                className="group bg-gray-800/20 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/30 hover:border-purple-500/50 hover:shadow-[0_0_30px_#8b5cf622] hover:scale-105 transition-all duration-500"
              >
                <div className="w-14 h-14 bg-gradient-to-r from-purple-600/20 to-violet-600/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <feature.icon className={`w-7 h-7 ${feature.color} group-hover:scale-110 transition-transform duration-300`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-4 group-hover:text-purple-300 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-400 group-hover:text-gray-300 transition-colors duration-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="mb-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl font-bold text-white mb-6 animate-textGlow">
                Why Choose <span className="text-purple-400">PeerFunds</span>?
              </h2>
              <p className="text-xl text-gray-300 leading-relaxed mb-8">
                We've built the most advanced, secure, and user-friendly platform for decentralized investment fund management. 
                Here's what sets us apart:
              </p>
              
              <div className="space-y-4">
                {benefits.map((benefit, i) => (
                  <div key={i} className="flex items-start space-x-4 group hover:scale-105 transition-all duration-300">
                    <div className="text-2xl mt-1">{benefit.split(' ')[0]}</div>
                    <div className="text-gray-300 group-hover:text-white transition-colors duration-300">
                      <span dangerouslySetInnerHTML={{
                        __html: benefit.substring(benefit.indexOf(' ') + 1).replace(/\*\*(.*?)\*\*/g, '<strong class="text-purple-400">$1</strong>')
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-purple-900/30 via-indigo-900/30 to-gray-900/30 rounded-3xl p-8 border border-purple-500/30 backdrop-blur-xl">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500/20 to-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <Award className="w-10 h-10 text-purple-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Trusted by Thousands</h3>
                  <p className="text-gray-300 mb-6">
                    Join a community of successful investors who have already discovered the power of collaborative investing.
                  </p>
                  <div className="flex justify-center space-x-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-6 h-6 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-400">"Best DeFi investment platform I've used" - Community Member</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center mb-16 animate-fadeInScale">
          <div className="bg-gradient-to-r from-purple-900/30 via-violet-900/30 to-indigo-900/30 rounded-3xl p-12 border border-purple-500/30 backdrop-blur-xl">
            <div className="relative">
              <h2 className="text-4xl font-bold text-white mb-6 animate-textGlow">
                Ready to Start Your <span className="text-purple-400">Investment Journey</span>?
              </h2>
              <div className="absolute -top-5 -right-5 w-16 h-16 bg-gradient-to-r from-purple-500/20 to-violet-500/20 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute -bottom-5 -left-5 w-12 h-12 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse"></div>
            </div>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8 leading-relaxed">
              Explore available funds, or create your own. 
              The future of investing is collaborative, transparent, and decentralized.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => navigate('/dashboard/create')}
                className="bg-gradient-to-r from-purple-600 to-violet-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-purple-500 hover:to-violet-500 transition-all duration-300 hover:scale-110 flex items-center space-x-2">
                <span>Start by Creating a Fund</span>
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/dashboard/create')}
                className="border border-purple-500/50 text-purple-300 px-8 py-4 rounded-xl font-semibold hover:bg-purple-500/10 transition-all duration-300 hover:scale-105">
                Learn More
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}