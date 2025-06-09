export default function FundGraph() {
  return (
    <div className="bg-[#1f2937]/60 backdrop-blur-md shadow-lg border border-white/10 flex flex-col w-[55%] p-6 h-[28rem]">
      <h2 className="text-xl font-semibold mb-4">Fund Value</h2>
      <div className="grow bg-gray-700 rounded mb-2" />
      <div className="flex gap-3 mt-1">
        {["1m", "1h", "1d", "1w", "1mo"].map(label => (
          <button 
            key={label} 
            className="px-3 py-1.5 bg-gray-800 rounded hover:bg-gray-700 transition"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
// bg-[#1f2937] p-6 h-[28rem] flex flex-col w-[55%]