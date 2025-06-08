import { Token } from "../../types";

export const TokenSelector = ({
  tokens,
  selected,
  onChange,
}: {
  tokens: Token[];
  selected: string;
  onChange: (val: string) => void;
}) => {
  const selectedToken = tokens.find((t) => t.mint === selected);
  return (
    <div className="flex items-center gap-2 bg-[#2c3a4e] rounded-xl px-3 py-2">
      <div className="w-6 h-6 rounded-full bg-gray-600 overflow-hidden">
        {selectedToken?.image ? (
          <img src={selectedToken.image} alt="token" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-500 rounded-full" />
        )}
      </div>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-white text-sm outline-none cursor-pointer"
      >
        <option value="" disabled>Select Token</option>
        {tokens.map((token) => (
          <option key={token.mint} value={token.mint} className="text-black">
            {token.symbol}
          </option>
        ))}
      </select>
    </div>
  );
};
