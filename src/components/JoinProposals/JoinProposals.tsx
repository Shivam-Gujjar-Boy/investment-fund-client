import { Fund, JoinProposal, programId } from "../../types";
import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { SYSTEM_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import toast from "react-hot-toast";

interface JoinProposalsProps {
  fund: Fund | null;
  fundId: string | undefined;
}

export default function JoinProposals({ fund, fundId }: JoinProposalsProps) {
  const [loading, setLoading] = useState(false);
  const [joinProposals, setJoinProposals] = useState<JoinProposal[] | null>(null);
  const wallet = useWallet();
  const { connection } = useConnection();

  const fetchJoinProposalsData = useCallback(async () => {
    if (!wallet.publicKey) return;
    if (!fundId) return;
    const fundAccountPda = new PublicKey(fundId);

    try {
      if (!fund) return;
      const [joinProposalAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("join-proposal-aggregator"), Buffer.from([0]), fundAccountPda.toBuffer()],
        programId,
      );
      console.log('join aggregator:', joinProposalAggregatorPda.toBase58());

      const joinProposalAggregatorInfo = await connection.getAccountInfo(joinProposalAggregatorPda);
      if (!joinProposalAggregatorInfo) {
        console.log("No Proposal aggregator found");
        return;
      }
      const aggregatorBuffer = Buffer.from(joinProposalAggregatorInfo.data);
      const fundAddress = new PublicKey(aggregatorBuffer.slice(0, 32));
      if (fundAddress.toBase58() !== fundAccountPda.toBase58()) {
        console.log("Wrong join proposal aggregator");
        return;
      }

      const numOfJoinProposals = aggregatorBuffer.readUint32LE(33);
      let nextByte = 37;
      const joinProposals: JoinProposal[] = [];

      for (let i = 0; i < numOfJoinProposals; i++) {
        const joiner = new PublicKey(aggregatorBuffer.slice(nextByte, nextByte + 32));
        nextByte += 32;
        const votesYes = aggregatorBuffer.readBigInt64LE(nextByte);
        nextByte += 8;
        const votesNo = aggregatorBuffer.readBigInt64LE(nextByte);
        nextByte += 8;
        const creationTime = aggregatorBuffer.readBigInt64LE(nextByte);
        nextByte += 8;
        const proposalIndex = aggregatorBuffer.readUInt8(nextByte);
        nextByte += 1;

        joinProposals.push({ joiner, votesYes, votesNo, creationTime, proposalIndex });
      }

      setJoinProposals(joinProposals);
      console.log(joinProposals);
    } catch (err) {
      console.log(err);
      return;
    }
  }, [fundId, fund, wallet.publicKey, connection]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchJoinProposalsData();
      setLoading(false);
    };
    load();
  }, [fetchJoinProposalsData]);

  const handleVote = async (vote: number, proposal: JoinProposal) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      console.log("Connect the wallet first");
      return;
    }
    if (!fund) {
      console.log("Fund don't exist");
      return;
    }

    if (!proposal) return;

    try {
      const governanceATA = await getAssociatedTokenAddress(
        fund.governanceMint,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const [joinAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("join-proposal-aggregator"), Buffer.from([0]), fund.fund_address.toBuffer()],
        programId,
      );

      const [voteAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("join-vote"), Buffer.from([proposal.proposalIndex]), fund.fund_address.toBuffer()],
        programId,
      );

      const joinAggregatorPdaInfo = await connection.getAccountInfo(joinAggregatorPda);
      if (!joinAggregatorPdaInfo) {
        return;
      }
      const joinBuffer = Buffer.from(joinAggregatorPdaInfo.data);

      const numOfJoinProposals = joinBuffer.readUInt32LE(33);
      if (numOfJoinProposals === 0) {
        return;
      }

      const [joinerAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), proposal.joiner.toBuffer()],
        programId
      );

      const keys = [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: voteAccountPda, isSigner: false, isWritable: true },
        { pubkey: joinAggregatorPda, isSigner: false, isWritable: true },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: fund.fund_address, isSigner: false, isWritable: true },
        { pubkey: fund.governanceMint, isSigner: false, isWritable: true },
        { pubkey: governanceATA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false},
        { pubkey: proposal.joiner, isSigner: false, isWritable: false},
        { pubkey: joinerAccountPda, isSigner: false, isWritable: true},
      ];

      const instructionTag = 11;
      const fundName = fund.name;
      const nameBytes = Buffer.from(fundName, 'utf-8');
      const nameLength = nameBytes.length;
      const buffer = Buffer.alloc(1 + 1 + 1 + nameLength);
      let offset = 0;

      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      buffer.writeUInt8(vote, offset);
      offset += 1;
      buffer.writeUInt8(proposal.proposalIndex, offset);
      offset += 1;
      nameBytes.copy(buffer, offset);
      const instructionData = buffer;
      console.log('Instruction Data:', instructionData);

      const instruction = new TransactionInstruction({ keys, data: instructionData, programId });
      const transaction = new Transaction().add(instruction);

      console.log('fund account: ', fund.fund_address.toBase58());
      console.log('vote account: ', voteAccountPda.toBase58());
      console.log('governance ata: ', governanceATA.toBase58());
      console.log('proposal aggregator: ', joinAggregatorPda.toBase58());
      console.log('proposal index:', proposal.proposalIndex);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
      toast.success("Voted successfully");
    } catch (err) {
      console.log(err);
      return;
    }
  };

  const formatTimeStamp = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

return (
  <>
    {loading ? (
      <div className="bg-[#1f2937] rounded-2xl h-[20rem] animate-pulse flex flex-col"></div>
    ) : (
      (joinProposals && joinProposals?.length > 0) ? (<div className="relative flex flex-col h-[22rem] bg-gradient-to-r from-[#1e293b] via-[#111827] to-black rounded-2xl overflow-hidden border border-gray-700 shadow-[0_0_15px_#00000088]">
        {/* Header */}
        <div className="flex justify-between items-center p-6">
          <h2 className="text-2xl font-semibold text-white tracking-tight">Join Proposals</h2>
        </div>

        {/* Proposal Cards */}
        <div className="flex-1 px-6 pb-6 overflow-x-auto flex flex-row gap-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {joinProposals?.map((proposal) => (
              <div
                key={proposal.creationTime.toString()}
                className="bg-[#111827] border border-gray-700 rounded-2xl p-5 min-w-[20rem] max-w-[20rem] flex flex-col justify-between hover:scale-[1.015] transition-transform duration-300 shadow-md hover:shadow-xl"
              >
                <div className="space-y-3 text-sm text-gray-400">
                  <div className="flex justify-between items-center">
                    <span>
                      <span className="text-gray-300 font-medium">Joiner:</span>{' '}
                      {proposal.joiner.toBase58().slice(0, 4)}...
                      {proposal.joiner.toBase58().slice(-4)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-300 font-medium">Created:</span>{' '}
                    {formatTimeStamp(proposal.creationTime)}
                  </div>
                  <div>
                    <span className="text-gray-300 font-medium">Yes Votes:</span>{' '}
                    {proposal.votesYes.toString()}
                  </div>
                  <div>
                    <span className="text-gray-300 font-medium">No Votes:</span>{' '}
                    {proposal.votesNo.toString()}
                  </div>
                  <div>
                    <span className="text-gray-300 font-medium">Proposal Index:</span>{' '}
                    {proposal.proposalIndex.toString()}
                  </div>
                </div>

                {/* Vote Progress & Buttons */}
                <div className="mt-4">
                  <div className="relative h-3 rounded-full bg-gray-700 overflow-hidden mb-3">
                    {proposal.votesYes + proposal.votesNo === 0n ? (
                      <div className="absolute inset-0 bg-gray-500 transition-all duration-500" />
                    ) : (
                      <>
                        <div
                          className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-500"
                          style={{
                            width: `${Number(
                              (proposal.votesYes * 100n) /
                                (proposal.votesYes + proposal.votesNo)
                            )}%`,
                          }}
                        />
                        <div
                          className="absolute top-0 right-0 h-full bg-red-500 transition-all duration-500"
                          style={{
                            width: `${Number(
                              (proposal.votesNo * 100n) /
                                (proposal.votesYes + proposal.votesNo)
                            )}%`,
                          }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded-md text-xs font-medium transition flex-1"
                      onClick={() => handleVote(1, proposal)}
                    >
                      YES
                    </button>
                    <button
                      className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded-md text-xs font-medium transition flex-1"
                      onClick={() => handleVote(0, proposal)}
                    >
                      NO
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>) : (
        <></>
      )
    )}
  </>
);


}