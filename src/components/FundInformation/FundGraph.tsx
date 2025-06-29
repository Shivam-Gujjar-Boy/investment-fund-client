import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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

export default function FundGraph () {
    const [activeTimeframe, setActiveTimeframe] = useState('1M');

    return (
        <div className="w-[60%] bg-gradient-to-br from-purple-900/5 via-slate-800/50 to-blue-900/30 backdrop-blur-lg border border-purple-600/20 shadow-[0_0_5px_#7c3aed33] rounded-lg p-6 h-[100%] flex flex-col">
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
    )
}