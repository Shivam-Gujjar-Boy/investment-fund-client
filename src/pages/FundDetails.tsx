import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { Fund } from '../types';
import Proposals from '../components/Proposals/Proposals';
import JoinProposals from '../components/JoinProposals/JoinProposals';
import FundMembers from '../components/FundMembers/FundMembers';
import FundGraph from '../components/FundGraph/FundGraph';
import { Metaplex } from '@metaplex-foundation/js';
import FundHoldings from '../components/FundHoldings/FundHoldings';
import  GlobalSocketListener  from './GlobalSocketListener'; 


export default function FundDetails() {
  // const [vecIndex, setVecIndex] = useState(0);
  // const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [fund, setFund] = useState<Fund | null>(null);
  const [loading, setLoading] = useState(true);

  const wallet = useWallet();
  const { connection } = useConnection();
  const { fundId } = useParams();
  const metaplex = Metaplex.make(connection);

  const fetchFundData = useCallback(async () => {
    if (!wallet.publicKey) {
      return;
    }

    if (!fundId) {
      toast.error('Fund Id not found');
      return;
    }
    const fundAccountPda = new PublicKey(fundId);

    try {
      const accountInfo = await connection.getAccountInfo(fundAccountPda);
      if (!accountInfo) {
        toast.error('Fund Id not found');
        return;
      }
      const buffer = Buffer.from(accountInfo?.data);
      const name_dummy = buffer.slice(0, 27).toString();
      let name = '';
      for (const c of name_dummy) {
        if (c === '\x00') break;
        name += c;
      }
      const members: PublicKey[] = [];
      const numOfMembers = buffer.readUInt32LE(114);
      for (let i = 0; i < numOfMembers; i++) {
        members.push(new PublicKey(buffer.slice(118 + 32 * i, 150 + 32 * i)));
      }
      const expectedMembers = buffer.readUint32LE(27);
      const creatorExists = buffer.readUInt8(31) ? true : false;
      const creator = new PublicKey(buffer.slice(118, 150));
      const totalDeposit = buffer.readBigInt64LE(32);
      const governanceMint = new PublicKey(buffer.slice(40, 72));
      const vault = new PublicKey(buffer.slice(72, 104));
      const currentIndex = buffer.readUInt8(104);
      const created_at = buffer.readBigInt64LE(105);
      const is_private = buffer.readUInt8(113);
      setFund({
        fund_address: fundAccountPda,
        name,
        expectedMembers,
        creatorExists,
        creator,
        numOfMembers,
        members,
        totalDeposit,
        governanceMint,
        vault,
        currentIndex,
        created_at,
        is_private,
      });
    } catch (err) {
      toast.error('Error fetching fund data');
      console.log(err);
    }
  }, [fundId, connection, wallet.publicKey]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchFundData();
      // await fetchProposalsData();
      setLoading(false);
    };

    load();
  }, [fetchFundData]);

  return (
    <div className="p-2 text-white min-h-screen w-full bg-gradient-to-b from-[#0e1117] to-[#1b1f27]">
      <GlobalSocketListener currentFundPubkey={fund?.fund_address?.toBase58() || null} />
      <div className="flex relative">
        {/* Left Scrollable Section */}
        <div className="w-3/4 pr-4 overflow-y-auto h-[calc(100vh-1rem)]">
          <div className="flex flex-col gap-2">
            {/* Graph, Members, and Holdings */}
            <div className="flex gap-2">
              {/* Members */}
              {loading ? (
                <div className="bg-[#1f2937] p-6 h-[28rem] w-[25%] animate-pulse space-y-4">
                  <div className="h-6 w-32 bg-gray-700 rounded mb-4"></div>
                  <ul className="space-y-4">
                    {[...Array(5)].map((_, idx) => (
                      <li key={idx} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="h-4 w-24 bg-gray-700 rounded"></div>
                          <div className="h-4 w-12 bg-gray-700 rounded"></div>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                          <div className="h-2.5 w-1/2 bg-gray-600 rounded-full"></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                fund && <FundMembers members={fund.members} governanceMint={fund.governanceMint} fund={fund} />
              )}
              <div className="flex gap-2 w-[75%]">
                {/* Fund Graph */}
                <FundGraph />
                {/* Fund Holdings */}
                <FundHoldings vault={fund?.vault} connection={connection} metaplex={metaplex} />
              </div>
            </div>
            {/* Join Proposals */}
            {loading ? (
              //  className="bg-[#1f2937] rounded-2xl h-[20rem] animate-pulse flex flex-col"
              <div>
              </div>
            ) : (
              <JoinProposals fund={fund} fundId={fundId} />
            )}
          </div>
        </div>

        {/* Fixed Proposals Section */}
        <div className="w-1/4 fixed right-2 top-19 h-[calc(100vh-1rem)]">
          {loading ? (
            <div className="bg-[#1f2937] rounded-2xl h-[41rem] animate-pulse flex flex-col">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div className="h-6 w-32 bg-gray-700 rounded mb-4"></div>
                {[...Array(4)].map((_, idx) => (
                  <div key={idx} className="bg-gray-800 p-4 rounded-xl space-y-2">
                    <div className="h-4 w-3/4 bg-gray-700 rounded"></div>
                    <div className="h-4 w-1/2 bg-gray-700 rounded"></div>
                    <div className="h-4 w-1/4 bg-gray-700 rounded"></div>
                    <div className="flex gap-2 mt-4">
                      <div className="h-6 w-20 bg-gray-700 rounded"></div>
                      <div className="h-6 w-14 bg-gray-700 rounded"></div>
                      <div className="h-6 w-14 bg-gray-700 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-700 bg-[#1f2937]">
                <div className="w-full h-10 bg-gray-700 rounded-xl"></div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1f2937] rounded-2xl h-full flex flex-col overflow-y-auto fancy-scrollbar">
              <Proposals fund={fund} fundId={fundId} />
            </div>
          )}
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .fancy-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .fancy-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .fancy-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 9999px;
        }
        .fancy-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #6366f1;
        }
        
        .hide-scrollbar {
          -ms-overflow-style: none;  /* Internet Explorer 10+ */
          scrollbar-width: none;  /* Firefox */
        }
        .hide-scrollbar::-webkit-scrollbar { 
          display: none;  /* Safari and Chrome */
        }
      `}</style>
    </div>
  );
}