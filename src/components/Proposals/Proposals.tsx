import { useState } from 'react';
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
import { fetchUserTokens } from '../../functions/fetchuserTokens';
import { Metaplex } from '@metaplex-foundation/js';
import { TokenSelector } from './TokenSelector';
import { Filter } from "lucide-react";

interface ProposalsProps {
  proposals: Proposal[] | null;
  fund: Fund | null;
  vecIndex: number;
  fundId: string | undefined;
}

interface ProposalSwap {
  fromMint: string,
  toMint: string,
  amount: string,
  slippage: string
}

export default function Proposals({ proposals, fund, vecIndex, fundId }: ProposalsProps) {
  const [sortOption, setSortOption] = useState<'creationTime' | 'deadline'>('creationTime');
  const [filterOption, setFilterOption] = useState<'all' | 'executed' | 'nonExecuted'>('all');
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
    const tokens = await fetchUserTokens(wallet, connection, metaplex);
    if (!wallet.publicKey) {
      return;
    }

    console.log(tokens);
    if (!tokens) return;
    setUserTokens(tokens);
    if (tokens.length > 0) setSelectedFromToken(tokens[0]);
  };

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
        buffer.writeBigInt64LE(amount, offset);
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
        [Buffer.from('vote'), Buffer.from([fund.currentIndex]), Buffer.from([(vecIndex + 1)]), fundAccountPda.toBuffer()],
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
      setShowProposalModal(false);

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

      const transaction = new Transaction();

      const pumpkingMint = new PublicKey('5ovFctxb6gPZeGxT5WwDf5vLt2ichsd9qENJ92omPKiN');
      const bondMint = new PublicKey('9LC2j9sHFjNYKnqiH6PzhXnLby23DoihnuHHxLnYpKin');
      const outputMints: PublicKey[] = [pumpkingMint, bondMint];

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

        const accs = await findAmmConfig(i);
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

  // 🔄 Show shimmer while loading
  if (!proposals || proposals.length === 0) {
    return (
      <div className="bg-[#1f2937] relative flex flex-col h-full max-h-[calc(100vh-6rem)] animate-pulse">
        <div className="p-6 overflow-y-auto scrollbar-none flex-1 space-y-4">
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
    );
  }

  const getSymbol = (mint: string) => {
    return userTokens.find(t => t.mint === mint)?.symbol || '';
  }

  return (
    <>
      <div className="bg-[#1f2937] relative flex flex-col h-full max-h-[calc(100vh-6rem)]">
        <div className="p-6 overflow-y-auto scrollbar-none flex-1">
          {/* Heading with Filter */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Proposals</h2>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition"
              >
                <Filter size={16} />
                Filter & Sort
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-600 rounded-xl shadow-lg z-10">
                  <div className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wide">
                    Sort by
                  </div>
                  <ul className="text-sm text-gray-200">
                    <li
                      onClick={() => {
                        setSortOption('creationTime');
                        setDropdownOpen(false);
                      }}
                      className={`px-4 py-2 hover:bg-gray-700 cursor-pointer ${
                        sortOption === 'creationTime' ? 'bg-gray-700' : ''
                      }`}
                    >
                      Creation Time
                    </li>
                    <li
                      onClick={() => {
                        setSortOption('deadline');
                        setDropdownOpen(false);
                      }}
                      className={`px-4 py-2 hover:bg-gray-700 cursor-pointer ${
                        sortOption === 'deadline' ? 'bg-gray-700' : ''
                      }`}
                    >
                      Deadline
                    </li>
                  </ul>
                  <div className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wide">
                    Filter by
                  </div>
                  <ul className="text-sm text-gray-200">
                    <li
                      onClick={() => {
                        setFilterOption('all');
                        setDropdownOpen(false);
                      }}
                      className={`px-4 py-2 hover:bg-gray-700 cursor-pointer ${
                        filterOption === 'all' ? 'bg-gray-700' : ''
                      }`}
                    >
                      All
                    </li>
                    <li
                      onClick={() => {
                        setFilterOption('executed');
                        setDropdownOpen(false);
                      }}
                      className={`px-4 py-2 hover:bg-gray-700 cursor-pointer ${
                        filterOption === 'executed' ? 'bg-gray-700' : ''
                      }`}
                    >
                      Executed
                    </li>
                    <li
                      onClick={() => {
                        setFilterOption('nonExecuted');
                        setDropdownOpen(false);
                      }}
                      className={`px-4 py-2 hover:bg-gray-700 cursor-pointer ${
                        filterOption === 'nonExecuted' ? 'bg-gray-700' : ''
                      }`}
                    >
                      Non-executed
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>


          {/* Proposal Cards */}
          {filteredAndSortedProposals.map((p) => (
            <div
              key={p.creationTime.toString()}
              className="bg-gray-800 p-4 mb-4 rounded-xl cursor-pointer hover:bg-gray-700 transition-all shadow-sm border"
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("button")) {
                  setSelectedProposal(p);
                }
              }}
            >
              <div className="space-y-2 mb-4">
                <div className="text-sm text-gray-400 flex justify-between">
                  <div className='flex gap-2'>
                    <span className="font-medium text-gray-300">Proposal Index:</span>{" "}
                    {p.proposalIndex.toString()}
                  </div>
                  {p.executed ? (
                    <span className="text-xs bg-green-700 text-white px-2 py-1 rounded-full">Executed</span>
                  ) : p.deadline > BigInt(Math.floor(Date.now() / 1000)) ? (
                    <span className="text-xs bg-yellow-700 text-white px-2 py-1 rounded-full">Under Voting</span>
                  ) : (
                    <span className="text-xs bg-blue-700 text-white px-2 py-1 rounded-full">Executable</span>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  <span className="font-medium text-gray-300">Vec Index:</span>{" "}
                  {p.vecIndex.toString()}
                </div>
                <div className="text-sm text-gray-400">
                  <span className="font-medium text-gray-300">Created:</span>{" "}
                  {formatTimeStamp(p.creationTime)}
                </div>
                <div className="text-sm text-gray-400">
                  <span className="font-medium text-gray-300">Deadline:</span>{" "}
                  {formatTimeStamp(p.deadline)}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                {!p.executed && (
                  <div className="flex justify-end gap-2 mt-2">
                    {p.deadline < BigInt(Math.floor(Date.now() / 1000)) && (
                      <button
                        className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm"
                        onClick={() => handleExecute(p.proposalIndex, p.vecIndex)}
                      >
                        Execute
                      </button>
                    )}
                    {p.deadline >= BigInt(Math.floor(Date.now() / 1000)) && (
                      <button
                        className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-sm"
                        onClick={() => handleVote(1, p.proposalIndex, p.vecIndex)}
                      >
                        YES
                      </button>
                    )}
                    {p.deadline >= BigInt(Math.floor(Date.now() / 1000)) && (
                      <button
                        className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm"
                        onClick={() => handleVote(0, p.proposalIndex, p.vecIndex)}
                      >
                        NO
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Fixed Footer Button */}
        <div className="p-4 border-t border-gray-700 bg-[#1f2937]">
          <button
            onClick={openProposalModal}
            className="w-full bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl transition disabled:opacity-50 text-white font-medium"
          >
            Create Proposal
          </button>
        </div>
      </div>


      {/* Proposal Modal */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-[#1f2937] p-6 rounded-2xl w-[90%] max-w-2xl text-white">
            <div className="flex gap-4 justify-end">
              <button className="bg-green-600 px-4 py-2 rounded">YES</button>
              <button className="bg-red-600 px-4 py-2 rounded">NO</button>
              <button className="bg-gray-600 px-4 py-2 rounded" onClick={() => setSelectedProposal(null)}>Close</button>
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
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 w-20">To:</span>
                        <TokenSelector
                          tokens={userTokens}
                          selected={swap.toMint}
                          onChange={(mint) => updateSwap(index, 'toMint', mint)}
                        />
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
                      slippage: (Number(parseFloat(swap.slippage)*100)).toString(),
                    }));
                    if (!deadline) {
                      toast.error('Please set deadline');
                      return;
                    }
                    const deadlineTimestamp = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
                    handleProposalCreation(formatted, deadlineTimestamp);
                  } else {
                    toast.error('Please complete all fields');
                    return;
                  }
                }}
                className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 transition"
              >
                ✅ Create Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}