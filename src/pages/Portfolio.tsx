export default function Portfolio() {
  return (
    <div className="py-8 bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 min-h-screen">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          {/* <h1 className="text-3xl font-bold text-white">Your Portfolio</h1> */}
          <p className="text-gray-400 mt-2">
            Track your holdings, performance, and deep analytics across all your investment funds
          </p>
        </div>

        {/* Under Construction Banner */}
        <div className="bg-gradient-to-r from-orange-900/30 to-yellow-900/30 border border-orange-500/50 rounded-2xl p-8 mb-8 text-center shadow-2xl">
          <div className="mb-6">
            <div className="text-6xl mb-4 animate-bounce">🚧</div>
            <h2 className="text-2xl font-bold text-orange-300 mb-2">Work in Progress</h2>
            <p className="text-orange-200/80 text-lg">
              This personal portfolio section is currently under development
            </p>
          </div>
          
          <div className="bg-orange-900/20 border border-orange-600/30 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-orange-200 mb-3">Coming Soon:</h3>
            <div className="text-orange-100/90 space-y-2 text-left">
              <div className="flex items-center gap-3">
                <span className="text-green-400">✓</span>
                <span>Real-time portfolio holdings tracking</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-green-400">✓</span>
                <span>Performance analytics and insights</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-green-400">✓</span>
                <span>Detailed fund-level breakdowns</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-green-400">✓</span>
                <span>Historical performance charts</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-green-400">✓</span>
                <span>Risk analysis and diversification metrics</span>
              </div>
            </div>
          </div>

          <div className="text-orange-300/70">
            <p className="text-sm">Stay tuned for comprehensive portfolio management tools!</p>
          </div>
        </div>

        {/* Construction Site Illustration */}
        {/* <div className="text-center">
          <div className="inline-block bg-gradient-to-b from-blue-900/30 to-gray-900/30 rounded-full p-8 border border-blue-500/20">
            <div className="text-8xl mb-4">🏗️</div>
            <div className="flex justify-center items-center gap-4 text-4xl">
              <span>👷‍♂️</span>
              <span className="animate-pulse">⚡</span>
              <span>👷‍♀️</span>
            </div>
            <p className="text-gray-400 mt-4 text-sm">Our team is hard at work building this feature</p>
          </div>
        </div> */}
      </div>
    </div>
  );
}