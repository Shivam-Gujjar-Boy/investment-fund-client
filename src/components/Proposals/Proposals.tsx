import { useState, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import { Proposal, Fund, Token, programId } from '../../types';
import { formatTimeStamp } from '../../functions/formatTimeStamp';
import { findAmmConfig } from '../../functions/pool_accounts';
import { findTickArrayAccounts } from '../../functions/tick_array';
import { Buffer } from 'buffer';
import { fetchVaultTokens } from '../../functions/fetchuserTokens';
import { Metaplex } from '@metaplex-foundation/js';
import { TokenSelector } from './TokenSelector';
import { Filter } from "lucide-react";

interface ProposalsProps {
  fund: Fund | null;
  fundId: string | undefined;
}

interface ProposalSwap {
  fromMint: string,
  toMint: string,
  amount: string,
  slippage: string
}

export default function Proposals({ fund, fundId }: ProposalsProps) {
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [vecIndex, setVecIndex] = useState(0);
  const [sortOption, setSortOption] = useState<'creationTime' | 'deadline'>('creationTime');
  const [filterOption, setFilterOption] = useState<'all' | 'executed' | 'nonExecuted'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const filteredAndSortedProposals = [...(proposals ?? [])]
    .filter((p) => {
      if (filterOption === 'executed') return p.executed;
      if (filterOption === 'nonExecuted') return !p.executed;
      return true;
    })
    .sort((a, b) => {
      const field = sortOption === 'creationTime' ? 'creationTime' : 'deadline';
      return a[field] > b[field] ? -1 : a[field] < b[field] ? 1 : 0;
    });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [userTokens, setUserTokens] = useState<Token[]>([]);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [selectedFromToken, setSelectedFromToken] = useState<Token | null>(null);
  const [deadline, setDeadline] = useState<string>('');
  const [swaps, setSwaps] = useState([
    { fromMint: '', toMint: '', amount: '', slippage: '0.5' }
  ]);

  const wallet = useWallet();
  const { connection } = useConnection();
  const metaplex = Metaplex.make(connection);

  const updateSwap = (index: number, field: string, value: string) => {
    const updated = [...swaps];
    updated[index] = {...updated[index], [field]: value};
    setSwaps(updated);
  };

  const isSwapValid = (swap: ProposalSwap) => {
    return (
      swap.fromMint.trim() !== '' &&
      swap.toMint.trim() !== '' &&
      swap.amount.trim() !== '' &&
      !isNaN(Number(swap.amount)) &&
      swap.slippage.trim() !== '' &&
      !isNaN(Number(swap.slippage))
    );
  };

  const addSwap = () => {
    const lastSwap = swaps[swaps.length - 1];
    if (!isSwapValid(lastSwap)) return;
    if (swaps.length < 4) {
      setSwaps([...swaps, { fromMint: '', toMint: '', amount: '', slippage: '0.5' }]);
    }
  };

  const removeSwap = (index: number) => {
    const updated = swaps.filter((_, i) => i !== index);
    setSwaps(updated);
  };

  // To open the Deposit modal
  const openProposalModal = async () => {
    setShowProposalModal(true);
    const tokens = await fetchVaultTokens(fund?.vault, connection, metaplex);
    if (!wallet.publicKey) {
      return;
    }

    console.log(tokens);
    if (!tokens) return;
    setUserTokens(tokens);
    if (tokens.length > 0) setSelectedFromToken(tokens[0]);
  };

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

      for (let i = 0; i < numOfProposals; i++) {
        const proposer = new PublicKey(aggregatorBuffer.slice(nextByte, nextByte + 32));
        nextByte += 32;
        const numOfFromAssets = aggregatorBuffer.readUInt32LE(nextByte);
        nextByte += 4;
        const fromAssets: PublicKey[] = [];
        for (let j = 0; j < numOfFromAssets; j++) {
          fromAssets.push(new PublicKey(aggregatorBuffer.slice(nextByte, nextByte + 32)));
          nextByte += 32;
        }
        const numOfToAssets = aggregatorBuffer.readUInt32LE(nextByte);
        nextByte += 4;
        const toAssets: PublicKey[] = [];
        for (let j = 0; j < numOfToAssets; j++) {
          toAssets.push(new PublicKey(aggregatorBuffer.slice(nextByte, nextByte + 32)));
          nextByte += 32;
        }
        const numOfAmounts = aggregatorBuffer.readUInt32LE(nextByte);
        nextByte += 4;
        const amounts: bigint[] = [];
        for (let j = 0; j < numOfAmounts; j++) {
          amounts.push(aggregatorBuffer.readBigInt64LE(nextByte));
          nextByte += 8;
        }
        const numOfSlippages = aggregatorBuffer.readUInt32LE(nextByte);
        nextByte += 4;
        const slippages: number[] = [];
        for (let j = 0; j < numOfSlippages; j++) {
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
  }, [fundId, fund, wallet.publicKey, connection, refresh]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchProposalsData();
      setLoading(false);
    };

    load();
  }, [fetchProposalsData]);
  
  // proposal creation
  const handleProposalCreation = async (swaps: ProposalSwap[], deadline: bigint) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return;
    }

    if (!fund) {
      return;
    }

    console.log(fund);

    const user = wallet.publicKey;

    try {
      const instructionTag = 1;
      const numOfSwaps = swaps.length;
      const amounts: bigint[] = [];
      const slippages: number[] = [];
      for (const swap of swaps) {
        amounts.push(BigInt(swap.amount));
        slippages.push(parseInt(swap.slippage));
      }

      console.log(amounts, slippages);
      const fund_name = fund?.name;

      const nameBytes = Buffer.from(fund_name, 'utf8');
      const nameLength = nameBytes.length;

      const buffer = Buffer.alloc(1 + 1 + 8*numOfSwaps + 2*numOfSwaps + 8 + nameLength);
      let offset = 0;

      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      buffer.writeUInt8(numOfSwaps, offset);
      offset += 1;
      for (const amount of amounts) {
        buffer.writeBigInt64LE(amount*BigInt(1000000000), offset);
        offset += 8;
      }
      for (const slippage of slippages) {
        buffer.writeUInt16LE(slippage, offset);
        offset += 2;
      }
      buffer.writeBigInt64LE(deadline, offset);
      offset += 8;
      nameBytes.copy(buffer, offset);

      const instructionData = buffer;
      console.log(instructionData);

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), user.toBuffer()],
        programId
      );

      const [fundAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('fund'), Buffer.from(fund.name)],
        programId
      );

      const [currentAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('proposal-aggregator'), Buffer.from([fund.currentIndex]), fundAccountPda.toBuffer()],
        programId
      );

      const [newAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('proposal-aggregator'), Buffer.from([fund.currentIndex + 1]), fundAccountPda.toBuffer()],
        programId
      );

      console.log(fundAccountPda.toBase58());
      const [voteAccountPda1] = PublicKey.findProgramAddressSync(
        [Buffer.from('vote'), Buffer.from([fund.currentIndex]), Buffer.from([(vecIndex)]), fundAccountPda.toBuffer()],
        programId
      );

      const [voteAccountPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from('vote'), Buffer.from([fund.currentIndex + 1]), Buffer.from([0]), fundAccountPda.toBuffer()],
        programId
      );

      // const solMint = new PublicKey('So11111111111111111111111111111111111111112');
      // const pumpkingMint = new PublicKey('5ovFctxb6gPZeGxT5WwDf5vLt2ichsd9qENJ92omPKiN');
      // const bondMint = new PublicKey('9LC2j9sHFjNYKnqiH6PzhXnLby23DoihnuHHxLnYpKin');

      const keys = [
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: userAccountPda, isSigner: false, isWritable: true},
          {pubkey: fundAccountPda, isSigner: false, isWritable: true},
          {pubkey: currentAggregatorPda, isSigner: false, isWritable: true},
          {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: newAggregatorPda, isSigner: false, isWritable: true},
          {pubkey: voteAccountPda1, isSigner: false, isWritable: true},
          {pubkey: voteAccountPda2, isSigner: false, isWritable: true},
      ];

      for (const swap of swaps) {
        keys.push(
          {pubkey: new PublicKey(swap.fromMint), isSigner: false, isWritable: true}
        );
      }

      for (const swap of swaps) {
        keys.push(
          {pubkey: new PublicKey(swap.toMint), isSigner: false, isWritable: true}
        );
      }

      const instruction = new TransactionInstruction({
        keys,
        programId,
        data: instructionData
      });

      const transaction = new Transaction().add(instruction);

      console.log("current index: ", fund.currentIndex);
      console.log("Current aggregator: ", currentAggregatorPda.toBase58());
      console.log("New aggregator: ", newAggregatorPda.toBase58());
      console.log("vote account 1: ", voteAccountPda1.toBase58());
      console.log("vote account 2: ", voteAccountPda2.toBase58());

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });
      // const p: Proposals[] = [];
      // setProposals(proposals);
      setRefresh(refresh + 1);

      setShowProposalModal(false);
      setIsCreating(false);

      toast.success("Proposal created successfully");
    } catch (err) {
      console.log(err);
      toast.error('Error Creating Proposal');
    }
  }

  // voting on a proposal
  const handleVote = async (vote: number, proposalIndex: number, vecIndex: number) => {
    console.log('proposal index: ', proposalIndex);
    console.log('vote index: ', vecIndex);

    if (!fund) {
      console.log('fund hi na hai');
      return;
    }

    if (!wallet.publicKey || !wallet.signTransaction) {
      console.log('wallet hi na hai');
      return;
    }

    const user = wallet.publicKey;
    try {
      const instructionTag = 2;
      const fundName = fund.name;
      const nameBytes = Buffer.from(fundName, 'utf8');
      console.log(fundName);
      const [fundpda] = PublicKey.findProgramAddressSync(
        [Buffer.from('fund'), Buffer.from(fundName)],
        programId
      );
      console.log('fund: ', fundpda.toBase58());
      const nameLength = nameBytes.length;

      const buffer = Buffer.alloc(1 + 1 + 1 + 1 + nameLength);
      let offset = 0;

      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      buffer.writeUInt8(vote, offset);
      offset += 1;
      buffer.writeUInt8(proposalIndex, offset);
      offset += 1;
      buffer.writeUInt8(vecIndex, offset);
      offset += 1;
      nameBytes.copy(buffer, offset);

      const instructionData = buffer;
      if (!fundId) {
        console.log('fund id hi na hai');
        return;
      }
      const fundAccountPda = new PublicKey(fundId);

      const [voteAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vote'), Buffer.from([proposalIndex]), Buffer.from([vecIndex]), fundAccountPda.toBuffer()],
        programId
      );

      const [proposalAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('proposal-aggregator'), Buffer.from([proposalIndex]), fundAccountPda.toBuffer()],
        programId
      );

      const governanceATA = await getAssociatedTokenAddress(
        fund?.governanceMint,
        user,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const governanceMint = new PublicKey(fund.governanceMint);

      const instruction = new TransactionInstruction({
        keys: [
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: voteAccountPda, isSigner: false, isWritable: true},
          {pubkey: proposalAggregatorPda, isSigner: false, isWritable: true},
          {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: fundAccountPda, isSigner: false, isWritable: true},
          {pubkey: governanceMint, isSigner: false, isWritable: true},
          {pubkey: governanceATA, isSigner: false, isWritable: true},
        ],
        programId,
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);

      console.log('fund account: ', fundAccountPda.toBase58());
      console.log('vote account: ', voteAccountPda.toBase58());
      console.log('governance ata: ', governanceATA.toBase58());
      console.log('proposal aggregator: ', proposalAggregatorPda.toBase58());

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      toast.success('Voted Successfully');
    } catch (err) {
      console.log('vote nahi kar paya tu: ', err);
      toast.error('Error while voting');
    }
  }

  // execution of a proposal
  const handleExecute = async (proposalIndex: number, vecIndex: number) => {
    if (!proposals) {
      console.log('proposals khali hai');
      return;
    }

    if (!fund) {
      console.log('fund hi na hai');
      return;
    }

    if (!wallet.publicKey || !wallet.signTransaction) {
      console.log('wallet hi na hai');
      return;
    }

    const user = wallet.publicKey;
    try {
      const proposal = proposals[vecIndex];
      const numOfSwaps = proposal.numOfSwaps;
      console.log('swaps:', numOfSwaps);

      const transaction = new Transaction();

      const pumpkingMint = new PublicKey('5ovFctxb6gPZeGxT5WwDf5vLt2ichsd9qENJ92omPKiN');
      const bondMint = new PublicKey('9LC2j9sHFjNYKnqiH6PzhXnLby23DoihnuHHxLnYpKin');

      const outputMints: PublicKey[] = [];
      if (proposal.toAssets[0].toBase58() == pumpkingMint.toBase58()) {
        outputMints.push(pumpkingMint);
      } else {
        outputMints.push(bondMint);
      }
      console.log(outputMints[0].toBase58());

      for (let i=0; i<numOfSwaps; i++) {
        const instructionTag = 4;
        const fundName = fund.name;
        const nameBytes = Buffer.from(fundName, 'utf8');
        console.log(fundName);
        const [fundpda] = PublicKey.findProgramAddressSync(
          [Buffer.from('fund'), Buffer.from(fundName)],
          programId
        );
        console.log('fund: ', fundpda.toBase58());
        const nameLength = nameBytes.length;

        const buffer = Buffer.alloc(1 + 1 + 1 + 1 + nameLength);
        let offset = 0;

        buffer.writeUInt8(instructionTag, offset);
        offset += 1;
        buffer.writeUInt8(i, offset);
        offset += 1;
        buffer.writeUInt8(proposalIndex, offset);
        offset += 1;
        buffer.writeUInt8(vecIndex, offset);
        offset += 1;
        nameBytes.copy(buffer, offset);

        const instructionData = buffer;
        console.log('instruction data hai ye: ', instructionData);

        const [proposalAggregatorPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('proposal-aggregator'), Buffer.from([proposalIndex]), fundpda.toBuffer()],
          programId
        );
        const solMint = new PublicKey('So11111111111111111111111111111111111111112');

        const raydiumClmmProgram = new PublicKey('devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH');
        const input_token_account = await getAssociatedTokenAddress(
          solMint,
          fund.vault,
          true,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const output_token_account = await getAssociatedTokenAddress(
          outputMints[i],
          fund.vault,
          true,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        console.log('input token account = ', input_token_account.toBase58());
        console.log('output token account = ', output_token_account.toBase58());
        const memo_program = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

        const accs = await findAmmConfig(outputMints[i]);
        if (!accs) return;
        console.log("Input vault: ", accs[2].toBase58())
        console.log("Output vault: ", accs[3].toBase58())
        const keys = [
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: fundpda, isSigner: false, isWritable: true},
          {pubkey: fund.vault, isSigner: false, isWritable: true},
          {pubkey: proposalAggregatorPda, isSigner: false, isWritable: true},
          {pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: raydiumClmmProgram, isSigner: false, isWritable: false},
          {pubkey: accs[0], isSigner: false, isWritable: true},
          {pubkey: accs[1], isSigner: false, isWritable: true},
          {pubkey: input_token_account, isSigner: false, isWritable: true},
          {pubkey: output_token_account, isSigner: false, isWritable: true},
          {pubkey: accs[2], isSigner: false, isWritable: true},
          {pubkey: accs[3], isSigner: false, isWritable: true},
          {pubkey: accs[4], isSigner: false, isWritable: true},
          {pubkey: solMint, isSigner: false, isWritable: true},
          {pubkey: outputMints[i], isSigner: false, isWritable: true},
          {pubkey: memo_program, isSigner: false, isWritable: false},
          {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
        ];
        
        const ticks = await findTickArrayAccounts(accs[1]);
        if (!ticks) return;
        for (const tick of ticks) {
          keys.push({
            pubkey: tick, isSigner: false, isWritable: true
          });
        }
        keys.push({
          pubkey: accs[5], isSigner: false, isWritable: true
        });
        const instruction = new TransactionInstruction({
          keys,
          programId,
          data: instructionData,
        });
        transaction.add(instruction);
      }
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      toast.success("Proposal Executed Successfully");
    } catch (err) {
      console.log(err);
      toast.error("Didn't execute!");
    }
  }

  const getSymbol = (mint: string) => {
    return userTokens.find(t => t.mint === mint)?.symbol || '';
  }

  return (
    <>
      { loading ? (
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
      <div className="relative flex flex-col h-[41rem] bg-gradient-to-b from-[#1e293b] via-[#111827] to-black rounded-2xl overflow-hidden border border-gray-700 shadow-[0_0_15px_#00000088]">

        {/* Top Scrollable Content */}
        <div className="flex-1 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          
          {/* Heading & Filter */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-white tracking-tight">Proposals</h2>
            
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-xl transition-all shadow-md"
              >
                <Filter size={16} />
                Filter & Sort
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-[#0f172a] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-[#1e293b]">
                    Sort by
                  </div>
                  <ul className="text-sm text-gray-200 divide-y divide-gray-700">
                    {["creationTime", "deadline"].map((opt) => (
                      <li
                        key={opt}
                        onClick={() => { setSortOption(opt); setDropdownOpen(false); }}
                        className={`px-4 py-3 cursor-pointer hover:bg-gray-700 ${
                          sortOption === opt ? 'bg-gray-700' : ''
                        }`}
                      >
                        {opt === "creationTime" ? "Creation Time" : "Deadline"}
                      </li>
                    ))}
                  </ul>

                  <div className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-[#1e293b]">
                    Filter by
                  </div>
                  <ul className="text-sm text-gray-200 divide-y divide-gray-700">
                    {["all", "executed", "nonExecuted"].map((opt) => (
                      <li
                        key={opt}
                        onClick={() => { setFilterOption(opt); setDropdownOpen(false); }}
                        className={`px-4 py-3 cursor-pointer hover:bg-gray-700 ${
                          filterOption === opt ? 'bg-gray-700' : ''
                        }`}
                      >
                        {opt === "nonExecuted" ? "Non-Executed" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Proposal Cards */}
          {filteredAndSortedProposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-white space-y-4 mt-20">
              <div className="text-5xl">📭</div>
              <h2 className="text-xl font-semibold">No Proposals Yet</h2>
              <p className="text-gray-400 max-w-sm">
                Be the first to create a proposal and shape the future.
              </p>
            </div>
          ) : (
            filteredAndSortedProposals.map((p) => (
              <div
                key={p.creationTime.toString()}
                className="bg-[#111827] border border-gray-700 rounded-2xl p-5 mb-5 cursor-pointer hover:scale-[1.015] transition-transform duration-300 shadow-md hover:shadow-xl group"
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("button")) {
                    setSelectedProposal(p);
                  }
                }}
              >
                <div className="space-y-3 mb-4 text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>
                      <span className="text-gray-300 font-medium">Proposal Index:</span> {p.proposalIndex.toString()}
                    </span>
                    {p.executed ? (
                      <span className="text-xs bg-green-700 text-white px-2 py-1 rounded-full">Executed</span>
                    ) : p.deadline > BigInt(Math.floor(Date.now() / 1000)) ? (
                      <span className="text-xs bg-yellow-700 text-white px-2 py-1 rounded-full">Under Voting</span>
                    ) : (
                      <span className="text-xs bg-blue-700 text-white px-2 py-1 rounded-full">Executable</span>
                    )}
                  </div>

                  <div><span className="text-gray-300 font-medium">Vec Index:</span> {p.vecIndex.toString()}</div>
                  <div><span className="text-gray-300 font-medium">Created:</span> {formatTimeStamp(p.creationTime)}</div>
                  <div><span className="text-gray-300 font-medium">Deadline:</span> {formatTimeStamp(p.deadline)}</div>
                </div>

                {/* Vote Progress Bar & Buttons */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 h-3 rounded-full bg-gray-700 overflow-hidden">
                    {p.votesYes + p.votesNo === 0n ? (
                      <div className="absolute inset-0 bg-gray-500 transition-all duration-500" />
                    ) : (
                      <>
                        <div
                          className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-500"
                          style={{ width: `${Number(p.votesYes * 100n / (p.votesYes + p.votesNo))}%` }}
                        />
                        <div
                          className="absolute top-0 right-0 h-full bg-red-500 transition-all duration-500"
                          style={{ width: `${Number(p.votesNo * 100n / (p.votesYes + p.votesNo))}%` }}
                        />
                      </>
                    )}
                  </div>

                  {!p.executed && (
                    <div className="flex gap-2">
                      {p.deadline < BigInt(Math.floor(Date.now() / 1000)) && (
                        <button
                          className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-md text-xs font-medium transition"
                          onClick={() => handleExecute(p.proposalIndex, p.vecIndex)}
                        >
                          Execute
                        </button>
                      )}
                      {p.deadline >= BigInt(Math.floor(Date.now() / 1000)) && (
                        <>
                          <button
                            className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded-md text-xs font-medium transition"
                            onClick={() => handleVote(1, p.proposalIndex, p.vecIndex)}
                          >
                            YES
                          </button>
                          <button
                            className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded-md text-xs font-medium transition"
                            onClick={() => handleVote(0, p.proposalIndex, p.vecIndex)}
                          >
                            NO
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sticky Footer Button */}
        <div className="p-4 bg-[#0f172a] border-t border-gray-700 shadow-inner">
          <button
            onClick={openProposalModal}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:brightness-110 px-4 py-3 rounded-xl transition text-white font-semibold shadow-lg"
          >
            + Create Proposal
          </button>
        </div>
      </div>
      )}


      {/* Proposal Modal */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-[#111827]/90 backdrop-blur-2xl p-6 rounded-2xl w-[95%] max-w-3xl text-white shadow-2xl border border-gray-700 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">
                Proposal #{selectedProposal.vecIndex}
              </h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedProposal.executed ? 'bg-green-700' : 'bg-yellow-600'
                }`}
              >
                {selectedProposal.executed ? 'Executed' : 'Pending'}
              </span>
            </div>

            {/* Proposer Info */}
            <div className="text-sm text-gray-400 mb-6">
              Proposed by: <span className="text-white font-medium">{selectedProposal.proposer.toBase58()}</span>
            </div>

            {/* Swaps Breakdown */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">🌀 Swaps ({selectedProposal.numOfSwaps})</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600">
                {selectedProposal.fromAssets.map((from, i) => (
                  <div key={i} className="p-3 bg-gray-800 rounded-lg flex flex-col gap-1 shadow">
                    <div className="text-sm text-gray-300">
                      <span className="text-white font-medium">From:</span> {from.toBase58()}
                    </div>
                    <div className="text-sm text-gray-300">
                      <span className="text-white font-medium">To:</span> {selectedProposal.toAssets[i].toBase58()}
                    </div>
                    <div className="text-sm text-gray-300">
                      <span className="text-white font-medium">Amount:</span> {Number(selectedProposal.amounts[i])}
                    </div>
                    <div className="text-sm text-gray-300">
                      <span className="text-white font-medium">Slippage:</span> {selectedProposal.slippages[i]/100}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vote Progress */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">📊 Vote Summary</h3>
              <div className="relative h-4 rounded-full bg-gray-700 overflow-hidden">
                {selectedProposal.votesYes + selectedProposal.votesNo === 0n ? (
                  <div className="absolute top-0 left-0 w-full h-full bg-gray-500" />
                ) : (
                  <>
                    <div
                      className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-500"
                      style={{
                        width: `${Number(selectedProposal.votesYes * 100n / (selectedProposal.votesYes + selectedProposal.votesNo))}%`,
                      }}
                    />
                    <div
                      className="absolute top-0 right-0 h-full bg-red-500 transition-all duration-500"
                      style={{
                        width: `${Number(selectedProposal.votesNo * 100n / (selectedProposal.votesYes + selectedProposal.votesNo))}%`,
                      }}
                    />
                  </>
                )}
              </div>
              <div className="flex justify-between text-xs mt-1 text-gray-400">
                <span>
                  {selectedProposal.votesYes + selectedProposal.votesNo === 0n
                    ? '0%'
                    : `${Number(selectedProposal.votesYes * 100n / (selectedProposal.votesYes + selectedProposal.votesNo))}%`
                  } YES
                </span>
                <span>
                  {selectedProposal.votesYes + selectedProposal.votesNo === 0n
                    ? '0%'
                    : `${Number(selectedProposal.votesNo * 100n / (selectedProposal.votesYes + selectedProposal.votesNo))}%`
                  } NO
                </span>
              </div>
            </div>

            {/* Time Info */}
            <div className="mb-6 flex justify-between text-sm text-gray-400">
              <div>
                ⏱️ <span className="text-white">Created:</span>{' '}
                {new Date(Number(selectedProposal.creationTime) * 1000).toLocaleString()}
              </div>
              <div>
                ⏳ <span className="text-white">Deadline:</span>{' '}
                {new Date(Number(selectedProposal.deadline) * 1000).toLocaleString()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
              {selectedProposal.deadline > Date.now() && (
                <button 
                    className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg font-semibold transition"
                    onClick={() => handleVote(1, selectedProposal.proposalIndex, selectedProposal.vecIndex)}
                >
                  YES
                </button>
              )}
              {selectedProposal.deadline > Date.now() && (
                <button 
                  className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg font-semibold transition"
                  onClick={() => handleVote(0, selectedProposal.proposalIndex, selectedProposal.vecIndex)}
                >
                  NO
                </button>
              )}
              {selectedProposal.deadline < Date.now() && selectedProposal.votesYes > selectedProposal.votesNo && !selectedProposal.executed && (
                <button
                  className='bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-semibold transition'
                  onClick={() => handleExecute(selectedProposal.proposalIndex, selectedProposal.vecIndex)}
                >
                  Execute
                </button>
              )}
              <button
                className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-semibold transition"
                onClick={() => setSelectedProposal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-[#171f32] border border-white/10 shadow-2xl rounded-3xl p-6 w-[95%] max-w-2xl text-white relative">
            <h2 className="text-2xl font-bold mb-6">📝 Create Proposal</h2>

            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-1">⏳ Proposal Deadline</label>
              <input
                type="datetime-local"
                className="bg-[#1f2937] text-white px-3 py-2 rounded-xl w-full outline-none"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            {swaps.map((swap, index) => {
              const fromSymbol = getSymbol(swap.fromMint);
              const toSymbol = getSymbol(swap.toMint);
              const isExpanded = index === swaps.length - 1;
              return (
                <div key={index} className="bg-[#0c1118] p-4 rounded-2xl mb-4 space-y-3 relative">
                  {!isExpanded ? (
                    <div className="text-sm text-gray-300">
                      {swap.amount || '—'} {fromSymbol || '?'} → {toSymbol || '?'} (slip. {swap.slippage || '0'}%)
                    </div>
                  ) : (
                    <>
                      {swaps.length > 1 && (
                        <button
                          onClick={() => removeSwap(index)}
                          className="absolute top-2 right-2 text-red-400 hover:text-red-300"
                        >
                          ✖
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 w-20">From:</span>
                        <TokenSelector
                          tokens={userTokens}
                          selected={swap.fromMint}
                          onChange={(mint) => updateSwap(index, 'fromMint', mint)}
                        />
                        <div className='text-sm'>Select SOL for now (since on devnet)</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 w-20">To:</span>
                        <TokenSelector
                          tokens={userTokens}
                          selected={swap.toMint}
                          onChange={(mint) => updateSwap(index, 'toMint', mint)}
                        />
                        <div className='text-sm'>Select either BOND/PKING (since on devnet)</div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-sm text-gray-400">Amount</label>
                          <input
                            type="number"
                            placeholder="0.0"
                            className="w-full px-3 py-2 mt-1 rounded-lg bg-[#1f2937] outline-none"
                            value={swap.amount}
                            onChange={(e) => updateSwap(index, 'amount', e.target.value)}
                          />
                        </div>
                        <div className="w-1/3">
                          <label className="text-sm text-gray-400">Slippage (%)</label>
                          <input
                            type="number"
                            placeholder="0.5"
                            className="w-full px-3 py-2 mt-1 rounded-lg bg-[#1f2937] outline-none"
                            value={swap.slippage}
                            onChange={(e) => updateSwap(index, 'slippage', e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            <button
              onClick={addSwap}
              disabled={swaps.length >= 4}
              className="flex items-center gap-2 text-sm bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-xl transition mb-6 disabled:opacity-40"
            >
              ➕ Add Swap
            </button>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowProposalModal(false)}
                className="px-5 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const validSwaps = swaps.filter(isSwapValid);
                  if (validSwaps.length === swaps.length) {
                    const formatted = swaps.map(swap => ({
                      fromMint: swap.fromMint,
                      toMint: swap.toMint,
                      amount: swap.amount,
                      slippage: (Number(parseFloat(swap.slippage) * 100)).toString(),
                    }));

                    if (!deadline) {
                      toast.error('Please set deadline');
                      return;
                    }

                    const deadlineTimestamp = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
                    setIsCreating(true);
                    handleProposalCreation(formatted, deadlineTimestamp);
                    setIsCreating(false);
                  } else {
                    toast.error('Please complete all fields');
                    return;
                  }
                }}
                disabled={isCreating}
                className={`px-5 py-2 rounded-xl transition ${
                  isCreating ? "bg-green-400 cursor-not-allowed opacity-50" : "bg-green-600 hover:bg-green-500"
                }`}
              >
                {isCreating ? "Creating..." : "✅ Create Proposal"}
              </button>

            </div>
          </div>
        </div>
      )}
    </>
  );
}