import { Metaplex } from "@metaplex-foundation/js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchMintMetadata } from "../../functions/fetchuserTokens";
import { Token } from "../../types";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sector
} from 'recharts';
import { Loader2 } from "lucide-react";

const COLORS = [
  '#6366F1', '#14B8A6', '#F59E0B', '#EF4444', '#10B981',
  '#8B5CF6', '#EC4899', '#F97316', '#3B82F6', '#22C55E'
];

interface FundHoldingsProps {
  vault: PublicKey | undefined,
  connection: Connection,
  metaplex: Metaplex
}

export default function FundHoldings({ vault, connection, metaplex }: FundHoldingsProps) {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
                    return {
                        pubkey: acc.pubkey,
                        mint,
                        symbol: 'Unknown',
                        image: '',
                        balance,
                    };
                })
                .filter((token) => token.balance > 0);

            const response = await axios(`https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=1000000&slippageBps=50`);
            const price = response.data.outAmount;
            // console.log(price);

            const tokensWithMetadata = await Promise.all(
                tokens.map(async (token) => {
                    const metadata = await fetchMintMetadata(new PublicKey(token.mint), metaplex);
                    if (token.mint !== 'So11111111111111111111111111111111111111112') {
                        token.balance = (token.balance/1000000)*(price/1000000000);
                    }
                    // console.log('balances: ', balance);
                    return {
                        ...token,
                        symbol: metadata?.symbol || token.symbol,
                        image: metadata?.image || token.image,
                        // balance,
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

    useEffect(() => {
        fetchVaultTokens();
    }, [fetchVaultTokens]);

    const totalBalance = tokens?.reduce((sum, token) => sum + (token.balance || 0), 0) || 0;
    const chartData = tokens?.map((token) => ({
        name: token.symbol,
        value: Number(token.balance),
        percentage: ((token.balance / totalBalance) * 100).toFixed(2),
    })) || [];

    const renderActiveShape = (props: any) => {
        const {
            cx, cy, innerRadius, outerRadius, startAngle, endAngle,
            fill, payload, percent
        } = props;

        return (
            <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 15} // Slightly larger when active
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{
                    filter: 'brightness(1.1)',
                    transition: 'all 0.3s ease-in-out'
                }}
            />
            <text x={cx} y={cy - 10} textAnchor="middle" fill="#f9fafb" fontSize={16} fontWeight="600">
                {payload.name}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="#9ca3af" fontSize={13}>
                {`${(percent * 100).toFixed(2)}%`}
            </text>
            </g>
        );
    };

    const renderCustomizedLabel = (props: any) => {
        const { cx, cy, midAngle, innerRadius, outerRadius, percent, index } = props;
        
        if (percent < 0.05) return null; // Don't show labels for slices less than 5%
        
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text 
                x={x} 
                y={y} 
                fill="white" 
                textAnchor={x > cx ? 'start' : 'end'} 
                dominantBaseline="central"
                fontSize={12}
                fontWeight="500"
            >
                {`${(percent * 100).toFixed(1)}%`}
            </text>
        );
    };

    return (
        <div className="bg-[#1f2937] shadow-md p-6 text-white h-[28rem] w-[45%]">
        <h2 className="text-xl font-semibold text-center mb-4">Vault Holdings</h2>

        {loading ? (
            <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
            </div>
        ) : tokens && tokens.length > 0 ? (
            <div style={{ 
                transition: 'transform 0.3s ease-in-out',
                transform: hoveredIndex !== null ? 'scale(1.02)' : 'scale(1)',
                transformOrigin: 'center'
            }}>
            <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={130}
                        innerRadius={60}
                        paddingAngle={2}
                        activeIndex={activeIndex ?? -1}
                        activeShape={renderActiveShape}
                        labelLine={false}
                        label={renderCustomizedLabel}
                        onMouseEnter={(_, index) => {
                            setActiveIndex(index);
                            setHoveredIndex(index);
                        }}
                        onMouseLeave={() => {
                            setActiveIndex(null);
                            setHoveredIndex(null);
                        }}
                        isAnimationActive={true}
                        animationBegin={0}
                        animationDuration={800}
                    >
                        {chartData.map((_, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={COLORS[index % COLORS.length]}
                                style={{
                                    transition: 'all 0.3s ease-in-out',
                                    filter: hoveredIndex === index ? 'brightness(1.2)' : 'brightness(1)',
                                }}
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        cursor={{ fill: 'transparent' }}
                        position={{ x: undefined, y: undefined }}
                        allowEscapeViewBox={{ x: false, y: false }}
                        contentStyle={{
                            backgroundColor: 'rgba(31, 41, 55, 0.95)',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#f9fafb',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            backdropFilter: 'blur(10px)',
                            padding: '12px 16px'
                        }}
                        labelStyle={{ color: '#f9fafb', fontWeight: '600', marginBottom: '4px' }}
                        formatter={(value: number, name: string, props: any) => [
                            <span style={{ color: '#10b981' }}>{`${value.toFixed(4)} tokens`}</span>,
                            <span style={{ color: '#e5e7eb' }}>{name}</span>
                        ]}
                    />
                    <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ 
                            color: '#e5e7eb',
                            paddingTop: '20px',
                            fontSize: '14px'
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
            </div>
        ) : (
            <div className="text-center text-gray-400 flex flex-col items-center justify-center h-64">
                <div className="text-6xl mb-4">📊</div>
                <div className="text-lg">No holdings found in this vault.</div>
                <div className="text-sm text-gray-500 mt-2">The vault appears to be empty or contains no valid tokens.</div>
            </div>
        )}
        </div>
    );
}