import { Metaplex } from "@metaplex-foundation/js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchMintMetadata } from "../../functions/fetchuserTokens";
import { Token } from "../../types";
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
  Legend,
} from 'recharts';
import { Loader2 } from "lucide-react";

const COLORS = [
  '#6366F1', '#14B8A6', '#F59E0B', '#093cd6', '#10B981',
  '#8B5CF6', '#EC4899', '#F97316', '#3B82F6', '#22C55E'
];

interface VaultHoldingsProps {
  vault: PublicKey | undefined,
  connection: Connection,
  metaplex: Metaplex
}

export default function VaultHoldings({ vault, connection, metaplex }: VaultHoldingsProps) {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const fetchVaultTokens = useCallback(async () => {
    try {
      if (!vault) return;

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        vault,
        { programId: TOKEN_PROGRAM_ID }
      );

      const tokens = tokenAccounts.value
        .map((acc) => {
          const info = acc.account.data.parsed.info;
          const mint = info.mint;
          const balance = info.tokenAmount.uiAmount;
          const decimals = info.decimals;
          return {
            pubkey: acc.pubkey,
            mint,
            symbol: 'Unknown',
            image: '',
            balance,
            decimals
          };
        })
        .filter((token) => token.balance > 0);

      const response = await axios(`https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=1000000&slippageBps=50`);
      const price = response.data.outAmount;

      const tokensWithMetadata = await Promise.all(
        tokens.map(async (token) => {
          const metadata = await fetchMintMetadata(new PublicKey(token.mint), metaplex);
          if (token.mint !== 'So11111111111111111111111111111111111111112') {
            token.balance = (token.balance) * (price / 1_000_000_000);
          }
          console.log(`${token.symbol}'s balance:`, token.balance);
          return {
            ...token,
            symbol: metadata?.symbol || token.symbol,
            image: metadata?.image || token.image,
          };
        })
      );

      setTokens(tokensWithMetadata);
    } catch (err) {
      console.error('Error fetching fund tokens:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [connection, metaplex, vault]);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchVaultTokens();
  }, [fetchVaultTokens]);

  const totalBalance = tokens?.reduce((sum, token) => sum + (token.balance || 0), 0) || 0;

  const chartData = tokens?.map((token) => ({
    name: token.symbol,
    value: token.balance,
    image: token.image,
  })) || [];

  const renderActiveShape = (props: any) => {
    const {
      cx, cy, innerRadius, outerRadius, startAngle, endAngle,
      fill
    } = props;

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <text x={cx} y={cy - 10} textAnchor="middle" fill="#f9fafb" fontSize={20} fontWeight="700">
          ${totalBalance.toFixed(2)}
        </text>
        <text x={cx} y={cy + 15} textAnchor="middle" fill="#9ca3af" fontSize={12}>
          {tokens?.length || 0} Tokens
        </text>
      </g>
    );
  };

  return (
    <div className="relative p-6 h-full w-full rounded-lg overflow-hidden bg-[#151A33] group transition-transform border border-indigo-500/20 shadow-[0_0_5px_#6366F140] backdrop-blur-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-900/20 via-purple-800/10 to-indigo-900/20 opacity-40 blur-3xl group-hover:opacity-60 transition duration-1000 ease-in-out pointer-events-none" />

      <h2 className="text-xl font-bold text-center mb-4 text-white tracking-wide relative z-10">
        Vault Holdings
      </h2>

      {loading ? (
        <div className="flex justify-center items-center h-64 relative z-10">
          <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
        </div>
      ) : tokens && tokens.length > 0 ? (
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <defs>
              {chartData.map((_, i) => (
                <linearGradient id={`gradient${i}`} x1="0" y1="0" x2="1" y2="1" key={i}>
                  <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>

            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={150}
              activeIndex={activeIndex ?? -1}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              animationDuration={500}
              animationEasing="ease-out"
              paddingAngle={3}
              isAnimationActive
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#gradient${index})`}
                  style={{
                    transition: 'all 0.4s ease',
                    filter: activeIndex === index ? 'drop-shadow(0 0 10px rgba(94,234,212,0.45)) brightness(1.2)' : 'brightness(1)'
                  }}
                />
              ))}
            </Pie>

            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{
                backgroundColor: 'rgba(31, 41, 55, 0.95)',
                border: '1px solid #374151',
                borderRadius: '12px',
                padding: '12px 16px',
                color: '#f9fafb',
                backdropFilter: 'blur(12px)',
              }}
              formatter={(value: number, name: string, extra: any) => {
                const payload = extra?.payload;
                const image = payload?.image;
                const symbol = payload?.name;
                return [
                  <div className="flex items-center space-x-2">
                    {image && <img src={image} className="w-4 h-4 rounded-full" />}
                    <span className="text-white font-semibold">{symbol}</span>
                  </div>,
                  <span className="text-emerald-400">${value.toFixed(4)}</span>
                ];
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{
                color: '#e5e7eb',
                paddingTop: '20px',
                fontSize: '13px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center text-gray-400 flex flex-col items-center justify-center h-64 z-10 relative">
          <div className="text-6xl mb-4 animate-bounce">📊</div>
          <div className="text-lg">No holdings found in this vault.</div>
          <div className="text-sm text-gray-500 mt-2">
            The vault appears to be empty or contains no valid tokens.
          </div>
        </div>
      )}
    </div>
  );
}
