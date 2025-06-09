import { useEffect, useState, useCallback } from 'react';
import {toast} from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { Proposal, Fund, programId } from '../types';
import Proposals from '../components/Proposals/Proposals';
import FundActivity from '../components/FundActivity/FundActivity';
import FundMembers from '../components/FundMembers/FundMembers';
import FundGraph from '../components/FundGraph/FundGraph';
import {Metaplex} from '@metaplex-foundation/js';
import FundHoldings from '../components/FundHoldings/FundHoldings';

export default function FundDetails() {
  const [vecIndex, setVecIndex] = useState(0);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  // const [fundPda, setFundPda] = useState<PublicKey | null>(null);
  const [fund, setFund] = useState<Fund | null>(null);
  const [loading, setLoading] = useState(true);

  const wallet = useWallet();
  const {connection} = useConnection();
  const {fundId} = useParams();
  const metaplex = Metaplex.make(connection);

  // fetch current fund data
  const fetchFundData = useCallback(async () => {
    if (!wallet.publicKey) {
      return;
    }
    
    if (!fundId) {
      toast.error('Fund Id not found');
      return;
    }
    // console.log(fundId);
    const fundAccountPda = new PublicKey(fundId);
    // setFundPda(fundAccountPda);
    // console.log(fundAccountPda.toBase58());

    try {
      const accountInfo = await connection.getAccountInfo(fundAccountPda);
      if (!accountInfo) {
        toast.error('Fund Id not found');
        return;
      }
      const buffer = Buffer.from(accountInfo?.data);
      // console.log(buffer);
      const name_dummy = buffer.slice(0, 32).toString();
      let name = '';
      for (const c of name_dummy) {
        if (c === '\x00') break;
        name += c;
      }
      // console.log(name);
      const members: PublicKey[] = [];
      const numOfMembers = buffer.readUInt32LE(114);
      for (let i=0; i<numOfMembers; i++) {
        members.push(new PublicKey(buffer.slice(118+32*i, 150+32*i)));
      }
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
      // console.log(fund);
    } catch (err) {
      toast.error('Error fetching fund data');
      console.log(err);
    }
  }, [fundId, connection, wallet.publicKey]);

  const fetchProposalsData = useCallback(async () => {
    if (!wallet.publicKey) {
      return;
    }

    if (!fundId) {
      return;
    }

    const fundAccountPda = new PublicKey(fundId);

    try {
      if (!fund) {
        // console.log('fund nahi hai gandu');
        return;
      }

      const currentIndex = fund?.currentIndex;
      const [currentAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('proposal-aggregator'), Buffer.from([currentIndex]), fundAccountPda.toBuffer()],
        programId
      );

      const currentAggregatorInfo = await connection.getAccountInfo(currentAggregatorPda);
      if (!currentAggregatorInfo) {
        console.log('No proposal aggregator found');
        return;
      }
      const aggregatorBuffer = Buffer.from(currentAggregatorInfo.data);
      const fundAddress = new PublicKey(aggregatorBuffer.slice(0, 32));
      // console.log(fundAddress.toBase58());
      if (fundAddress.toBase58() != fundAccountPda.toBase58()) {
        console.log('Wrong Aggregator');
        return;
      }

      const proposalIndex = aggregatorBuffer.readUInt8(32);
      console.log('Aggregator Index : ', proposalIndex);

      const numOfProposals = aggregatorBuffer.readUInt32LE(33);
      setVecIndex(numOfProposals);
      let nextByte = 37;

      const proposalss: Proposal[] = [];

      for (let i=0; i<numOfProposals; i++) {
        const proposer = new PublicKey(aggregatorBuffer.slice(nextByte, nextByte+32));
        nextByte += 32;
        const numOfFromAssets = aggregatorBuffer.readUInt32LE(nextByte);
        nextByte += 4;
        const fromAssets: PublicKey[] = [];
        for (let j=0; j<numOfFromAssets; j++) {
          fromAssets.push(new PublicKey(aggregatorBuffer.slice(nextByte, nextByte+32)));
          nextByte += 32;
        }
        const numOfToAssets = aggregatorBuffer.readUInt32LE(nextByte);
        nextByte += 4;
        const toAssets: PublicKey[] = [];
        for (let j=0; j<numOfToAssets; j++) {
          toAssets.push(new PublicKey(aggregatorBuffer.slice(nextByte, nextByte+32)));
          nextByte += 32;
        }
        const numOfAmounts = aggregatorBuffer.readUInt32LE(nextByte);
        nextByte += 4;
        const amounts: bigint[] = [];
        for (let j=0; j<numOfAmounts; j++) {
          amounts.push(aggregatorBuffer.readBigInt64LE(nextByte));
          nextByte += 8;
        }
        const numOfSlippages = aggregatorBuffer.readUInt32LE(nextByte);
        nextByte += 4;
        const slippages: number[] = [];
        for (let j=0; j<numOfSlippages; j++) {
          slippages.push(aggregatorBuffer.readUInt16LE(nextByte));
          nextByte += 2;
        }
        const votesYes = aggregatorBuffer.readBigInt64LE(nextByte);
        nextByte += 8;
        const votesNo = aggregatorBuffer.readBigInt64LE(nextByte);
        nextByte += 8;
        const creationTime = aggregatorBuffer.readBigInt64LE(nextByte);
        nextByte += 8;
        const deadline = aggregatorBuffer.readBigInt64LE(nextByte);
        nextByte += 8;
        const executed = aggregatorBuffer.readUInt8(nextByte) ? true : false;
        nextByte += 1;

        proposalss.push({
          proposalIndex: currentIndex,
          vecIndex: i,
          proposer,
          numOfSwaps: numOfAmounts,
          fromAssets,
          toAssets,
          amounts,
          slippages,
          votesYes,
          votesNo,
          creationTime,
          deadline,
          executed
        });
      }

      setProposals(proposalss);
      console.log(proposals);
    } catch (err) {
      console.log('Error fetching fund proposals: ', err);
    }
  }, [fundId, wallet.publicKey, connection, fund?.currentIndex, programId])

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchFundData();
      await fetchProposalsData();
      setLoading(false);
    }

    load();
  }, [fetchFundData, fetchProposalsData]);

  return (
    <div className="p-2 text-white min-h-screen w-full bg-gradient-to-b from-[#0e1117] to-[#1b1f27]">
      {/* <h1 className="text-3xl font-bold mb-6">Fund Details</h1> */}

      <div className="grid grid-cols-[3fr_1fr] gap-2">
        {/* Left Section */}
        <div className="flex flex-col gap-2">
          {/* Graph & Members */}
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

            <div className='flex gap-2 w-[75%]'>
              {/* Fund Graph */}
              <FundGraph />
              {/* FundHoldings */}
              <FundHoldings vault={fund?.vault} connection={connection} metaplex={metaplex}/>
            </div>
          </div>

          {/* Activity */}
          {fund && (
            <FundActivity fundAddress={fund?.fund_address}/>
          )}
        </div>

        {/* Proposals */}
        {loading ? (
          <div className="bg-[#1f2937] relative flex flex-col h-full max-h-[calc(100vh-6rem)] animate-pulse">
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

            {/* Fake Footer Button to maintain layout height */}
            <div className="p-4 border-t border-gray-700 bg-[#1f2937]">
              <div className="w-full h-10 bg-gray-700 rounded-xl"></div>
            </div>
          </div>
        ) : (
          <div className="bg-[#1f2937] rounded-2xl relative flex flex-col h-full max-h-[calc(100vh-6rem)]">
            <Proposals proposals={proposals} fund={fund} vecIndex={vecIndex} fundId={fundId} />
          </div>
        )}
      </div>
    </div>
  );

}
