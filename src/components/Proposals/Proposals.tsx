import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import { Proposal, Fund, programId } from '../../types';
import { formatTimeStamp } from '../../functions/formatTimeStamp';
import { findAmmConfig } from '../../functions/pool_accounts';
import { findTickArrayAccounts } from '../../functions/tick_array';
import { Buffer } from 'buffer';

interface ProposalsProps {
  proposals: Proposal[] | null;
  fund: Fund | null;
  vecIndex: number;
  fundId: string | undefined;
}

export default function Proposals({ proposals, fund, vecIndex, fundId }: ProposalsProps) {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const wallet = useWallet();
  const { connection } = useConnection();

  // proposal creation
  const handleProposalCreation = async () => {
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
      const numOfSwaps = 2;
      const amountA = BigInt(1000000000);
      const amountB = BigInt(1000000000);
      const slippage = 900;
      const deadline = BigInt(Math.floor(Date.now()/1000)) + BigInt(300);
      const fund_name = fund?.name;

      const nameBytes = Buffer.from(fund_name, 'utf8');
      const nameLength = nameBytes.length;

      const buffer = Buffer.alloc(1 + 1 + 8 + 8 + 2 + 2 + 8 + nameLength);
      let offset = 0;

      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      buffer.writeUInt8(numOfSwaps, offset);
      offset += 1;
      buffer.writeBigInt64LE(amountA, offset);
      offset += 8;
      buffer.writeBigInt64LE(amountB, offset);
      offset += 8;
      buffer.writeUInt16LE(slippage, offset);
      offset += 2;
      buffer.writeUInt16LE(slippage, offset);
      offset += 2;
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

      const solMint = new PublicKey('So11111111111111111111111111111111111111112');
      const pumpkingMint = new PublicKey('5ovFctxb6gPZeGxT5WwDf5vLt2ichsd9qENJ92omPKiN');
      const bondMint = new PublicKey('9LC2j9sHFjNYKnqiH6PzhXnLby23DoihnuHHxLnYpKin');

      const instruction = new TransactionInstruction({
        keys: [
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: userAccountPda, isSigner: false, isWritable: true},
          {pubkey: fundAccountPda, isSigner: false, isWritable: true},
          {pubkey: currentAggregatorPda, isSigner: false, isWritable: true},
          {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: newAggregatorPda, isSigner: false, isWritable: true},
          {pubkey: voteAccountPda1, isSigner: false, isWritable: true},
          {pubkey: voteAccountPda2, isSigner: false, isWritable: true},
          {pubkey: solMint, isSigner: false, isWritable: false},
          {pubkey: solMint, isSigner: false, isWritable: false},
          {pubkey: pumpkingMint, isSigner: false, isWritable: false},
          {pubkey: bondMint, isSigner: false, isWritable: false},
        ],
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

      toast.success("Proposal created successfully");
    } catch (err) {
      console.log(err);
      toast.error('shivam behen ka lund hai');
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

      toast.success('kar diya vote launde ne');
    } catch (err) {
      console.log('vote nahi kar paya tu: ', err);
      toast.error('Sorry bhai tu vote nhi kar paaya');
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

      toast.success("Ho gya execute betche");
    } catch (err) {
      console.log(err);
      toast.error("Didn't execute!");
    }
  }

  return (
    <>
      <div className="bg-[#1f2937] p-6 rounded-2xl overflow-y-auto max-h-[calc(100vh-6rem)]">
        <h2 className="text-xl font-semibold mb-4">Proposals</h2>
        {(proposals ?? []).map(p => (
          <div
            key={p.creationTime}
            className="bg-gray-800 p-4 mb-4 rounded-xl cursor-pointer hover:bg-gray-700 transition"
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('button')) {
                setSelectedProposal(p);
              }
            }}
          >
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-sm text-gray-400">
                Proposal Index: {p.proposalIndex.toString()}
              </div>

              <div className="flex items-center text-sm text-gray-400">
                Vec Index: {p.vecIndex.toString()}
              </div>

              <div className="flex items-center text-sm text-gray-400">
                Created: {formatTimeStamp(p.creationTime)}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="bg-blue-600 px-3 py-1 rounded" onClick={() => handleExecute(p.proposalIndex, p.vecIndex)}>Execute</button>
              <button className="bg-green-600 px-3 py-1 rounded" onClick={() => handleVote(1, p.proposalIndex, p.vecIndex)}>YES</button>
              <button className="bg-red-600 px-3 py-1 rounded" onClick={() => handleVote(0, p.proposalIndex, p.vecIndex)}>NO</button>
            </div>
          </div>
        ))}
        <button onClick={handleProposalCreation} className='bg-green-600 px-4 py-2 rounded disabled:opacity-50'>Create Proposal</button>
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
    </>
  );
}