import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";

const timeFrames = ["1m", "1h", "1d", "1w", "1mo"];

const generateDummyData = (label: string) => {
  const points = {
    "1m": 30,
    "1h": 50,
    "1d": 80,
    "1w": 100,
    "1mo": 150,
  }[label];

  return Array.from({ length: points }, (_, i) => ({
    time: `${i}`,
    value: Math.round(
      1000 + Math.sin(i / 5) * 200 + Math.random() * 100
    ),
  }));
};

export default function FundGraph() {
  const [selected, setSelected] = useState("1d");
  const [data, setData] = useState(() => generateDummyData("1d"));

  useEffect(() => {
    setData(generateDummyData(selected));
  }, [selected]);

  return (
    <motion.div
      className="relative bg-[#1f2937]/60 backdrop-blur-md shadow-2xl border border-white/10 rounded-2xl flex flex-col w-[55%] p-6 h-[28rem] overflow-hidden"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <h2 className="text-xl font-bold text-white text-center mb-4 group-hover:text-indigo-400 transition duration-300">
        Fund Value
      </h2>

      <div className="grow -ml-4 -mr-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="strokeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#cbd5e1" hide />
            <YAxis stroke="#cbd5e1" width={35} fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: 10,
                color: "#e2e8f0",
                fontSize: 13,
              }}
              labelStyle={{ color: "#94a3b8" }}
              formatter={(value: any) => [`$${value}`, "Value"]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="url(#strokeGradient)"
              strokeWidth={3}
              dot={false}
              isAnimationActive={true}
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <motion.div
        className="flex justify-center gap-3 mt-4 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {timeFrames.map((label) => (
          <button
            key={label}
            onClick={() => setSelected(label)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition duration-300 hover:bg-gray-700 hover:text-teal-300 ${
              selected === label
                ? "bg-gray-700 text-teal-400 scale-105"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </motion.div>

      {/* Glowing Blur Background */}
      <div className="absolute -inset-1 bg-gradient-to-tr from-purple-900/30 via-indigo-700/10 to-teal-600/20 opacity-25 blur-3xl pointer-events-none animate-pulse" />
    </motion.div>
  );
}