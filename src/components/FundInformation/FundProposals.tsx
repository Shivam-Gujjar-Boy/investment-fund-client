import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, MoreHorizontal, CheckCircle, XCircle, Calendar, Target, Zap, Copy } from 'lucide-react';
import { LightFund, Metas, programId, Proposal, TOKEN_METADATA_PROGRAM_ID } from '../../types';
import { PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Metaplex } from '@metaplex-foundation/js';
import toast from 'react-hot-toast';
import axios from 'axios';

interface ProposalProps {
  fund: LightFund
}

const Proposals = ({fund}: ProposalProps) => {
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [proposals, setProposals] = useState<Proposal[] | null>(null);
    const [metas, setMetas] = useState<Metas[]>([]);
    // const [filter, setFilter] = useState('all');


    const {connection} = useConnection();
    const wallet = useWallet();
    const metaplex = Metaplex.make(connection);

    // Dummy data for proposals
    // const proposals = [
    //   {
    //     id: 1,
    //     title: "Swap 50,000 USDC to SOL",
    //     description: "Strategic position building in SOL before anticipated market rally",
    //     proposer: {
    //       address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    //       name: "CryptoWhale",
    //       image: "https://api.dicebear.com/7.x/avataaars/svg?seed=CryptoWhale"
    //     },
    //     swap: {
    //       from: { symbol: "USDC", amount: 50000, icon: "💵" },
    //       to: { symbol: "SOL", amount: 454.5, icon: "🟣" }
    //     },
    //     slippage: 0.5,
    //     deadline: "2025-07-10T10:00:00Z",
    //     createdAt: "2025-07-06T08:30:00Z",
    //     votes: {
    //       yes: 67,
    //       no: 23,
    //       total: 90
    //     },
    //     status: "active",
    //     category: "swap"
    //   },
    //   {
    //     id: 2,
    //     title: "Diversify into AI Tokens",
    //     description: "Allocate 30% of portfolio to emerging AI cryptocurrency projects",
    //     proposer: {
    //       address: "8XzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtBWWN",
    //       name: "AIEnthusiast",
    //       image: "https://api.dicebear.com/7.x/avataaars/svg?seed=AIEnthusiast"
    //     },
    //     swap: {
    //       from: { symbol: "USDC", amount: 75000, icon: "💵" },
    //       to: { symbol: "AI-BASKET", amount: 75000, icon: "🤖" }
    //     },
    //     slippage: 1.0,
    //     deadline: "2025-07-12T15:00:00Z",
    //     createdAt: "2025-07-05T14:20:00Z",
    //     votes: {
    //       yes: 45,
    //       no: 55,
    //       total: 100
    //     },
    //     status: "active",
    //     category: "diversification"
    //   },
    //   {
    //     id: 3,
    //     title: "Take Profit on BONK",
    //     description: "Sell 80% of BONK holdings while price is at multi-month highs",
    //     proposer: {
    //       address: "7YzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtCWWO",
    //       name: "ProfitTaker",
    //       image: "https://api.dicebear.com/7.x/avataaars/svg?seed=ProfitTaker"
    //     },
    //     swap: {
    //       from: { symbol: "BONK", amount: 2500000, icon: "🐕" },
    //       to: { symbol: "USDC", amount: 12500, icon: "💵" }
    //     },
    //     slippage: 2.0,
    //     deadline: "2025-07-08T12:00:00Z",
    //     createdAt: "2025-07-06T06:15:00Z",
    //     votes: {
    //       yes: 78,
    //       no: 12,
    //       total: 90
    //     },
    //     status: "active",
    //     category: "profit-taking"
    //   },
    //   {
    //     id: 4,
    //     title: "Emergency Exit Strategy",
    //     description: "Convert all positions to stablecoins due to market uncertainty",
    //     proposer: {
    //       address: "6XzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtEWWP",
    //       name: "RiskManager",
    //       image: "https://api.dicebear.com/7.x/avataaars/svg?seed=RiskManager"
    //     },
    //     swap: {
    //       from: { symbol: "ALL", amount: 250000, icon: "🔄" },
    //       to: { symbol: "USDC", amount: 245000, icon: "💵" }
    //     },
    //     slippage: 1.5,
    //     deadline: "2025-07-07T20:00:00Z",
    //     createdAt: "2025-07-06T10:45:00Z",
    //     votes: {
    //       yes: 23,
    //       no: 67,
    //       total: 90
    //     },
    //     status: "active",
    //     category: "emergency"
    //   }
    // ];

    const fetchedProposals = useCallback(async () => {

      if (!fund) return;

      try {
        const [currentAggregatorPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("proposal-aggregator"), Buffer.from([fund.currentIndex]), fund.fundPubkey.toBuffer()],
          programId,
        );

        const currentAggregatorInfo = await connection.getAccountInfo(currentAggregatorPda);
        if (!currentAggregatorInfo) return;

        const currentAggregatorBuffer = Buffer.from(currentAggregatorInfo.data);

        const fetchedProposals: Proposal[] = [];

        const numOfProposals = currentAggregatorBuffer.readUint32LE(1);
        let offset = 5;
        const tokens: Metas[] = [];
        for (let i=0; i<numOfProposals; i++) {
          const isExecuted = currentAggregatorBuffer.readUInt8(offset + 123);
          if (!isExecuted) {
            const proposer = new PublicKey(currentAggregatorBuffer.slice(offset, offset + 32));
            offset += 32;
            const cid = currentAggregatorBuffer.slice(offset, offset + 59).toString();
            offset += 59;
            const proposalDataUrl = `https://${cid}.ipfs.w3s.link/`;
            const proposalDataResponse = await fetch(proposalDataUrl);
            if (!proposalDataResponse.ok) {
              throw new Error(`Failed to fetch metadata: ${proposalDataResponse.status}`);
            }

            const fetchedProposalData = await proposalDataResponse.json();
            const tags = fetchedProposalData.tags;
            const title = fetchedProposalData.title;
            const description = fetchedProposalData.description;
            const numOfSwaps = fetchedProposalData.swaps.length;
            const fromAssets: string[] = [];
            const toAssets: string[] = [];
            const amounts: number[] = [];
            const slippages: number[] = [];

            for (const swap of fetchedProposalData.swaps) {
              if (!tokens.some(m => m.mint === swap.fromToken)) {
                tokens.push({
                  mint: swap.fromToken,
                  name: "",
                  symbol: "",
                  image: "",
                })
              }
              if (!tokens.some(m => m.mint === swap.toToken)) {
                tokens.push({
                  mint: swap.toToken,
                  name: "",
                  symbol: "",
                  image: "",
                })
              }
              fromAssets.push(swap.fromToken);
              toAssets.push(swap.toToken);
              amounts.push(Number(swap.fromAmount));
              slippages.push(Number(swap.slippage));
            }

            const votesYes = currentAggregatorBuffer.readBigInt64LE(offset);
            offset += 8;
            const votesNo = currentAggregatorBuffer.readBigInt64LE(offset);
            offset += 8;
            const creationTime = currentAggregatorBuffer.readBigInt64LE(offset);
            offset += 8;
            const deadline = currentAggregatorBuffer.readBigInt64LE(offset);
            offset += 8;
            const vecIndex = currentAggregatorBuffer.readUint16LE(offset);
            offset = 2;
            const numOfVoters = currentAggregatorBuffer.readUInt32LE(offset);
            offset += 4;
            const votersIndex: [number, number][] = []; 
            for (let i = 0; i < numOfVoters; i++) {
              const voterIndex = currentAggregatorBuffer.readUInt32LE(offset);
              offset += 4;
              const vote = currentAggregatorBuffer.readUInt8(offset);
              offset += 1;
              votersIndex.push([voterIndex, vote]);
            }

            const voters: [PublicKey, number][] = [];

            for (const v of votersIndex) {
              const voter = fund.members.find((member) => member[1] === v[0]);
              if (voter) {
                voters.push(voter);
              }
            }

            fetchedProposals.push({
              tags,
              title,
              description,
              proposalIndex: fund.currentIndex,
              vecIndex,
              proposer,
              numOfSwaps,
              fromAssets,
              toAssets,
              amounts,
              slippages,
              votesYes,
              votesNo,
              creationTime,
              deadline,
              executed: isExecuted,
              voters,
            })
          } else {
            const numOfVoters = currentAggregatorBuffer.readUInt32LE(offset + 126);
            offset += (130 + (numOfVoters * 5));
          }
        }
        setMetas(tokens);
        setProposals(fetchedProposals);
      } catch (err) {
        console.log(err);
      }
    }, [connection, fund]);

    const fetchTokenMetadata = async () => {
      if (!proposals || !metas) return;

      try {
        const filteredMetas = metas.filter((meta) => {
          if (!meta.name || !meta.symbol || !meta.image) {
            return new PublicKey(meta.mint);
          } 
        });
        const metadataPdas = filteredMetas.map((mint) => {
          const [metadata] = PublicKey.findProgramAddressSync(
            [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), new PublicKey(mint.mint).toBuffer()],
            TOKEN_METADATA_PROGRAM_ID
          );
          return metadata;
        });

        const metadataInfos = await Promise.all(
          metadataPdas.map((pda) => 
            metaplex.nfts().findByMetadata({
              metadata: pda
            }).catch((err) => {
              console.error("Failed to fetch metadat", err);
              return null;
            })
          )
        );

        if (metadataPdas.length !== metadataInfos.length) {
          toast.error("Invalid Information!!");
          return;
        }

        for (let i = 0; i < metadataPdas.length; i++) {
          if (!metadataInfos[i]) continue;

          const symbol = metadataInfos[i]?.symbol;
          const uri = metadataInfos[i]?.uri;
          const name = metadataInfos[i]?.name;

          if (!symbol || !name) continue;
          if (uri !== "" && !uri) {
            continue;
          }

          let imageUri = '';
          if (uri !== '') {
              const response = await axios.get(uri);
              if (response) {
                  imageUri = response.data.image;
              }
          }

          filteredMetas[i].name = name;
          filteredMetas[i].symbol = symbol;
          filteredMetas[i].image = imageUri;
        }
        setMetas(filteredMetas);
      } catch (err) {
        console.log(err);
      } 
    }

    const fetchedRef = useRef(false);
    const fetchedRefNew = useRef(false);

    // main useEffect
    useEffect(() => {
      if (fetchedRef.current) return;
      fetchedRef.current = true;
      fetchedProposals();
    }, [fetchedProposals]);

    useEffect(() => {
      if (fetchedRefNew.current) return;
      fetchedRefNew.current = true;
      fetchTokenMetadata();
    }, [proposals]);

    const getStatusColor = (status: string) => {
        switch (status) {
        case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'passed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
        case 'swap': return 'bg-purple-500/20 text-purple-400';
        case 'diversification': return 'bg-blue-500/20 text-blue-400';
        case 'profit-taking': return 'bg-green-500/20 text-green-400';
        case 'emergency': return 'bg-red-500/20 text-red-400';
        default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getTimeLeft = (deadline: number) => {
        const now = new Date();
        const end = new Date(deadline);
        const diff = end - now;
        
        if (diff <= 0) return 'Expired';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        return `${hours}h`;
    };

    const getVotePercentage = (votes) => {
        if (votes.total === 0) return { yes: 0, no: 0 };
        return {
        yes: (votes.yes / votes.total) * 100,
        no: (votes.no / votes.total) * 100
        };
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const ProposalCard = (proposal: Proposal) => {
    const votePercentage = getVotePercentage(proposal.votesYes);
    const timeLeft = getTimeLeft(Number(proposal.deadline));

    return (
        <div className="bg-gradient-to-br from-[#1A1C2C] to-[#111324] border border-[#2B2D43] rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 group space-y-6">
        {/* Title + Status */}
        <div className="flex justify-between items-start">
            <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition">
                {proposal.title}
                </h3>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${getCategoryColor(proposal.tags[0])}`}>
                {proposal.tags[0].replace("-", " ")}
                </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{proposal.description}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
            <span className={`text-xs font-medium px-3 py-1 border rounded-full ${getStatusColor(proposal.executed ? "passed" : "active")}`}>
                {proposal.executed ? "passed" : "active"}
            </span>
            <button onClick={() => setSelectedProposal(proposal)} className="text-slate-500 hover:text-white transition">
                <MoreHorizontal className="w-5 h-5" />
            </button>
            </div>
        </div>

        {/* Proposer Info */}
        {/* <div className="flex items-center gap-3 text-sm text-slate-300 mb-4">
            <img
            src={proposal.proposer.image}
            alt={proposal.proposer.name}
            className="w-8 h-8 rounded-full border-2 border-purple-500/30 shadow-md"
            />
            <div className="flex flex-col">
            <span>{proposal.proposer.name}</span>
            <button
                onClick={() => copyToClipboard(proposal.proposer.address)}
                className="font-mono text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
            >
                {proposal.proposer.address.slice(0, 6)}...{proposal.proposer.address.slice(-4)}
                <Copy className="w-3 h-3" />
            </button>
            </div>
        </div> */}

        {/* Swap Section */}
        {/* <div className="bg-[#1C1F36] border border-[#2A2D4A] rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-5">
            <TokenCard token={proposal.toAssets} />
            <ArrowRight className="w-5 h-5 text-purple-400" />
            <TokenCard token={proposal.swap.to} />
            </div>
            <div className="text-right text-xs text-slate-400">
            <div className="mb-1">Slippage</div>
            <div className="text-sm font-medium text-white">{proposal.slippage}%</div>
            </div>
        </div> */}

        {/* Voting Progress */}
        {/* <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-400">
            <span>Votes: {proposal.votes.total}</span>
            <span>Time left: {timeLeft}</span>
            </div>
            <div className="relative h-3 bg-[#1C1F36] rounded-full overflow-hidden border border-slate-700/40">
            <div className="absolute top-0 left-0 h-full bg-green-500/80" style={{ width: `${votePercentage.yes}%` }} />
            <div className="absolute top-0 right-0 h-full bg-red-500/70" style={{ width: `${votePercentage.no}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1">
            <span className="text-green-400">Yes: {proposal.votes.yes} ({votePercentage.yes.toFixed(1)}%)</span>
            <span className="text-red-400">No: {proposal.votes.no} ({votePercentage.no.toFixed(1)}%)</span>
            </div>
        </div> */}

        {/* CTA Buttons */}
        <div className="grid grid-cols-3 gap-4">
            <button className="group bg-green-500/10 hover:bg-green-500/20 border border-green-600/30 rounded-lg py-2 text-sm font-medium text-green-400 flex items-center justify-center gap-2 transition-all">
            <CheckCircle className="w-4 h-4 group-hover:scale-110 transition" />
            Vote Yes
            </button>
            <button className="group bg-red-500/10 hover:bg-red-500/20 border border-red-600/30 rounded-lg py-2 text-sm font-medium text-red-400 flex items-center justify-center gap-2 transition-all">
            <XCircle className="w-4 h-4 group-hover:scale-110 transition" />
            Vote No
            </button>
            <button
            onClick={() => setSelectedProposal(proposal)}
            className="group bg-purple-500/10 hover:bg-purple-500/20 border border-purple-600/30 rounded-lg py-2 text-sm font-medium text-purple-400 transition-all"
            >
            Details
            </button>
        </div>
        </div>
    );
    };

    // TokenCard subcomponent for cleaner layout
    // const TokenCard = ({ token }) => (
    // <div className="text-center space-y-0.5">
    //     <div className="text-2xl">{token.icon}</div>
    //     <div className="text-sm font-medium text-white">{token.symbol}</div>
    //     <div className="text-xs text-slate-400">{formatNumber(token.amount)}</div>
    // </div>
    // );


  // const ProposalModal = ({ proposal, onClose }) => {
  //   if (!proposal) return null;

  //   const votePercentage = getVotePercentage(proposal.votes);
  //   const timeLeft = getTimeLeft(proposal.deadline);

  //   return (
  //     <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
  //       <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
  //         <div className="p-6">
  //           <div className="flex justify-between items-start mb-6">
  //             <div>
  //               <h2 className="text-2xl font-bold text-white mb-2">{proposal.title}</h2>
  //               <p className="text-slate-400">{proposal.description}</p>
  //             </div>
  //             <button
  //               onClick={onClose}
  //               className="text-slate-400 hover:text-white transition-colors"
  //             >
  //               <XCircle className="w-6 h-6" />
  //             </button>
  //           </div>

  //           {/* Proposer Details */}
  //           <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
  //             <h3 className="text-lg font-semibold text-white mb-3">Proposer</h3>
  //             <div className="flex items-center gap-4">
  //               <img 
  //                 src={proposal.proposer.image} 
  //                 alt={proposal.proposer.name}
  //                 className="w-12 h-12 rounded-full"
  //               />
  //               <div>
  //                 <div className="font-medium text-white">{proposal.proposer.name}</div>
  //                 <div className="text-sm text-slate-400 font-mono flex items-center gap-2">
  //                   {proposal.proposer.address}
  //                   <button 
  //                     onClick={() => copyToClipboard(proposal.proposer.address)}
  //                     className="text-slate-500 hover:text-slate-300"
  //                   >
  //                     <Copy className="w-4 h-4" />
  //                   </button>
  //                 </div>
  //               </div>
  //             </div>
  //           </div>

  //           {/* Swap Details */}
  //           <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
  //             <h3 className="text-lg font-semibold text-white mb-3">Swap Details</h3>
  //             <div className="grid grid-cols-2 gap-4 mb-4">
  //               <div className="text-center p-4 bg-slate-800/50 rounded-lg">
  //                 <div className="text-3xl mb-2">{proposal.swap.from.icon}</div>
  //                 <div className="font-medium text-white">{proposal.swap.from.symbol}</div>
  //                 <div className="text-lg font-bold text-white">{formatNumber(proposal.swap.from.amount)}</div>
  //               </div>
  //               <div className="text-center p-4 bg-slate-800/50 rounded-lg">
  //                 <div className="text-3xl mb-2">{proposal.swap.to.icon}</div>
  //                 <div className="font-medium text-white">{proposal.swap.to.symbol}</div>
  //                 <div className="text-lg font-bold text-white">{formatNumber(proposal.swap.to.amount)}</div>
  //               </div>
  //             </div>
  //             <div className="flex justify-between text-sm">
  //               <span className="text-slate-400">Slippage Tolerance: <span className="text-white">{proposal.slippage}%</span></span>
  //               <span className="text-slate-400">Time Left: <span className="text-white">{timeLeft}</span></span>
  //             </div>
  //           </div>

  //           {/* Voting Stats */}
  //           <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
  //             <h3 className="text-lg font-semibold text-white mb-3">Voting Status</h3>
  //             <div className="space-y-4">
  //               <div className="relative bg-slate-800/50 rounded-full h-4 overflow-hidden">
  //                 <div 
  //                   className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-500"
  //                   style={{ width: `${votePercentage.yes}%` }}
  //                 />
  //                 <div 
  //                   className="absolute top-0 right-0 h-full bg-red-500 transition-all duration-500"
  //                   style={{ width: `${votePercentage.no}%` }}
  //                 />
  //               </div>
  //               <div className="grid grid-cols-2 gap-4">
  //                 <div className="text-center p-3 bg-green-500/10 rounded-lg">
  //                   <div className="text-2xl font-bold text-green-400">{proposal.votes.yes}</div>
  //                   <div className="text-sm text-green-400">Yes Votes</div>
  //                   <div className="text-xs text-slate-400">{votePercentage.yes.toFixed(1)}%</div>
  //                 </div>
  //                 <div className="text-center p-3 bg-red-500/10 rounded-lg">
  //                   <div className="text-2xl font-bold text-red-400">{proposal.votes.no}</div>
  //                   <div className="text-sm text-red-400">No Votes</div>
  //                   <div className="text-xs text-slate-400">{votePercentage.no.toFixed(1)}%</div>
  //                 </div>
  //               </div>
  //             </div>
  //           </div>

  //           {/* Timeline */}
  //           <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
  //             <h3 className="text-lg font-semibold text-white mb-3">Timeline</h3>
  //             <div className="space-y-2">
  //               <div className="flex items-center gap-3 text-sm">
  //                 <Calendar className="w-4 h-4 text-slate-400" />
  //                 <span className="text-slate-400">Created:</span>
  //                 <span className="text-white">{new Date(proposal.createdAt).toLocaleString()}</span>
  //               </div>
  //               <div className="flex items-center gap-3 text-sm">
  //                 <Target className="w-4 h-4 text-slate-400" />
  //                 <span className="text-slate-400">Deadline:</span>
  //                 <span className="text-white">{new Date(proposal.deadline).toLocaleString()}</span>
  //               </div>
  //             </div>
  //           </div>

  //           {/* Action Buttons */}
  //           <div className="flex gap-3">
  //             <button className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg py-3 px-4 font-medium transition-all duration-200 flex items-center justify-center gap-2">
  //               <CheckCircle className="w-5 h-5" />
  //               Vote Yes
  //             </button>
  //             <button className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg py-3 px-4 font-medium transition-all duration-200 flex items-center justify-center gap-2">
  //               <XCircle className="w-5 h-5" />
  //               Vote No
  //             </button>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // };

  return (
    <div className="p-6 space-y-4 bg-gradient-to-br from-[#0B0E20] via-[#11142A] to-[#0A0C1C] min-h-screen">

      {/* Proposals Grid */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2">
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div> */}

      {/* Modal */}
      {/* {selectedProposal && (
        <ProposalModal
          proposal={selectedProposal}
          onClose={() => setSelectedProposal(null)}
        />
      )} */}
    </div>
  );
};

export default Proposals;