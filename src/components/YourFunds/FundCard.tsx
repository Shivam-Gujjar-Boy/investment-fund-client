import { ArrowRight, Users, Calendar, Wallet } from 'lucide-react';
import {toast} from 'react-hot-toast';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  PublicKey, 
  SystemProgram, 
  TransactionInstruction, 
  Transaction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { useNavigate } from 'react-router-dom';
import { Fund, programId } from '../../types';

interface FundCardProps {
  fund: Fund;
  status: string;
}

export default function FundCard({ fund, status }: FundCardProps) {
  const navigate = useNavigate();
  const wallet = useWallet();
  const {connection} = useConnection();

  function formatTimestamp(timestamp: bigint): string {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    console.log('Copied:', text);
    toast.success('Copied to clipboard!');
  }

  const handleDeposit = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return;
    }
    const user = wallet.publicKey;

    try {
      const nameBytes = Buffer.from(fund.name);
      const instructionData = Buffer.alloc(1 + 8 + nameBytes.length);
      instructionData.writeInt8(1, 0);
      instructionData.writeBigInt64LE(BigInt(100000000), 1);
      nameBytes.copy(instructionData, 9);

      const [fundAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('fund'), Buffer.from(fund.name)],
        programId
      );

      const [governanceMint] = PublicKey.findProgramAddressSync(
        [Buffer.from('governance'), fundAccountPda.toBuffer()],
        programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), fundAccountPda.toBuffer()],
        programId
      );

      const [userSpecificPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), fundAccountPda.toBuffer(), user.toBuffer()],
        programId
      );

      const governanceATA = await getAssociatedTokenAddress(
        governanceMint,
        user,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      console.log('Governance Token Account: ', governanceATA.toBase58());

      const instruction = new TransactionInstruction({
        keys: [
          {pubkey: governanceMint, isSigner: false, isWritable: true},
          {pubkey: vaultPda, isSigner: false, isWritable: true},
          {pubkey: fundAccountPda, isSigner: false, isWritable: true},
          {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
          {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: governanceATA, isSigner: false, isWritable: true},
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: userSpecificPda, isSigner: false, isWritable: true},
          {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
          {pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
        ],
        programId,
        data: instructionData
      });

      const transaction = new Transaction().add(instruction);

      console.log("ATA key : ", governanceATA.toBase58());
      console.log("Governance Mint account key : ", governanceMint.toBase58());
      console.log("Vault account key : ", vaultPda.toBase58());
      console.log("Fund account key : ", fundAccountPda.toBase58());
      console.log("User specific key : ", userSpecificPda.toBase58());
      
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign the transaction
      // transaction.partialSign(governanceMint);
      const signedTransaction = await wallet.signTransaction(transaction);
      
      // Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      // Use the non-deprecated version of confirmTransaction with TransactionConfirmationStrategy
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      toast.success(`Successfully deposited 0.1 SOL to fund's vault!`);
    } catch (err) {
      console.log('Error depositing :', err);
      toast.error('Error while depositing!');
    }
  }

  const handleLeave = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return;
    }
    const user = wallet.publicKey;
    const [fundAccountPda] = PublicKey.findProgramAddressSync([
      Buffer.from("fund"),
      Buffer.from(fund.name),
    ], programId);

    const [userSpecificPda] = PublicKey.findProgramAddressSync([
      Buffer.from("user"),
      fundAccountPda.toBuffer(),
      user.toBuffer(),
    ], programId);

    const [userAccountPda] = PublicKey.findProgramAddressSync([
      Buffer.from("user"),
      user.toBuffer(),
    ], programId);

    try {
      const nameBytes = Buffer.from(fund.name);
      const instructionData = Buffer.from([9, ...nameBytes]);

      const instruction = new TransactionInstruction({
        keys: [
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: userSpecificPda, isSigner: false, isWritable: true},
          {pubkey: fundAccountPda, isSigner: false, isWritable: true},
          {pubkey: userAccountPda, isSigner: false, isWritable: true}
        ],
        programId,
        data: instructionData
      });

      const transaction = new Transaction().add(instruction);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign the transaction
      // transaction.partialSign(governanceMint);
      const signedTransaction = await wallet.signTransaction(transaction);
      
      // Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      // Use the non-deprecated version of confirmTransaction with TransactionConfirmationStrategy
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      toast.success("You lef the fund");
    } catch (err) {
      console.log(err);
      toast.error("Not removed from fund");
    }
  }

// 
  return (
    <div onClick={() => navigate(`${fund.fund_address.toBase58()}`)} className="bg-gray-800 rounded-2xl p-6 transition-all hover:shadow-xl hover:shadow-purple-900/30 hover:scale-[1.015] duration-300 cursor-pointer">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white tracking-tight">{fund.name}</h3>
        {status === 'inactive' && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-300">
            Inactive
          </span>
        )}
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center text-sm text-gray-400">
          <Users className="w-4 h-4 mr-2" />
          {fund.numOfMembers.toString()} Members
        </div>

        <div className="flex items-center text-sm text-gray-400">
          <Wallet className="w-4 h-4 mr-2" />
          Total Value: {Number(fund.totalDeposit.toString()).toLocaleString()}
        </div>

        <div className="flex items-center text-sm text-gray-400">
          <Calendar className="w-4 h-4 mr-2" />
          Created: {formatTimestamp(fund.created_at)}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-700 space-y-2 text-sm">
        <div className="text-gray-500">
          Fund Address:{' '}
          <span
            onClick={() => handleCopy(fund.fund_address.toBase58())}
            className="text-gray-300 hover:text-white cursor-pointer hover:underline transition"
          >
            {truncateAddress(fund.fund_address.toBase58())}
          </span>
        </div>

        <div className="text-gray-500">
          Creator:{' '}
          <span
            onClick={() => handleCopy(fund.creator.toBase58())}
            className="text-gray-300 hover:text-white cursor-pointer hover:underline transition"
          >
            {truncateAddress(fund.creator.toBase58())}
          </span>
        </div>
        <div className='flex justify-between'>
          <div className='flex justify-end' onClick={handleDeposit}>
            <button className='flex items-center text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors'>
              Deposit
              </button>
          </div>
          <div className='flex justify-end' onClick={handleLeave}>
            <button className='flex items-center text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors'>
              Leave 
              </button>
          </div>
          <div className="flex justify-end">
            <button className="flex items-center text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              View Details
              <ArrowRight className="ml-1 w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
