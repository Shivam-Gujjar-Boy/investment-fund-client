import { useEffect, useState } from 'react';
// import { useToast } from '../../hooks/useToast';
import {toast} from 'react-hot-toast';
import { 
  // Keypair, 
  PublicKey, 
  SystemProgram, 
  TransactionInstruction, 
  Transaction,
} from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';
import { SYSVAR_RENT_PUBKEY } from '@solana/web3.js';

let debounceTimer: NodeJS.Timeout;

export default function CreateFundForm() {
  const [fundName, setFundName] = useState('');
  const [step, setStep] = useState(1);
  const [fundCode, setFundCode] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [nameTaken, setNameTaken] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  // const { toast } = useToast();

  const wallet = useWallet();
  const { connection } = useConnection();

  // Check if fund name exists (debounced)
  useEffect(() => {
    if (!fundName.trim()) {
      setNameTaken(false);
      return;
    }

    setChecking(true);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const res = await axios(`http://localhost:5000/api/funds/exists/${fundName}`);
        console.log(res.data.exists);
        setNameTaken(res.data.exists);
      } catch (err) {
        console.error('Error checking fund name:', err);
        setNameTaken(false);
      } finally {
        setChecking(false);
      }
    }, 500); // debounce delay
  }, [fundName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === 1) {
      if (!fundName.trim()) {
        return;
      }

      if (nameTaken) {
        return;
      }

      setPrivacy(!isPublic);

      const generatedCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      setFundCode(generatedCode);
      const baseUrl = window.location.origin;
      setInviteLink(`${baseUrl}/dashboard/join?code=${generatedCode}`);
      setStep(2);
    } else {
      if (!wallet.publicKey || !wallet.signTransaction) {
        return;
      }

      setIsSubmitting(true);

      try {
        const programId = new PublicKey('CFdRopkCcbqxhQ46vNbw4jNZ3eQEmWZhmq5V467py9nG');
        const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
        const creator = wallet.publicKey;

        if (!creator) throw new Error('Wallet not connected');

        // Generate fund account PDA
        const [fundAccountPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('fund'), Buffer.from(fundName)],
          programId,
        );

        // Generate governance mint
        // const governanceMint = Keypair.generate();
        const [governanceMint] = PublicKey.findProgramAddressSync(
          [Buffer.from('governance'), fundAccountPda.toBuffer()],
          programId,
        );

        // Generate vault PDA
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), fundAccountPda.toBuffer()],
          programId,
        );

        const [metadataPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            governanceMint.toBuffer()
          ],
          TOKEN_METADATA_PROGRAM_ID
        );

        const [rentPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("rent")],
          programId,
        );

        const [userAccountPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('user'), creator.toBuffer()],
          programId
        );

        // Instruction data
        const nameBytes = new TextEncoder().encode(fundName);
        console.log("Fund name in bytes : ", nameBytes);
        // const priv = new Uint8Array(1);
        // const instructionData = Buffer.from([0, ...nameBytes]);
        let instructionData;
        if (privacy) {
          instructionData = Buffer.from([0, 1, ...nameBytes]);
        } else {
          instructionData = Buffer.from([0, 0, ...nameBytes]);
        }

        // Create instruction
        const instruction = new TransactionInstruction({
          keys: [
            {pubkey: governanceMint, isSigner: false, isWritable: true},
            {pubkey: vaultPda, isSigner: false, isWritable: true},
            {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
            {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
            {pubkey: fundAccountPda, isSigner: false, isWritable: true},
            {pubkey: creator, isSigner: true, isWritable: true},
            {pubkey: metadataPda, isSigner: false, isWritable: true},
            {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
            {pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false},
            {pubkey: userAccountPda, isSigner: false, isWritable: true},
            
          ],
          programId,
          data: instructionData
        });

        const transaction = new Transaction().add(instruction);

        console.log("Rent account key : ", rentPda.toBase58());
        console.log("Governance Mint account key : ", governanceMint.toBase58());
        console.log("Vault account key : ", vaultPda.toBase58());
        console.log("Fund account key : ", fundAccountPda.toBase58());
        console.log("User account key : ", userAccountPda.toBase58());
        
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

        toast.success('Successfully created fund');

        // Printing created accounts data for debugging
        const fundAccountInfo = await connection.getAccountInfo(fundAccountPda);
        if (!fundAccountInfo) return;
        const fund_buffer = Buffer.from(fundAccountInfo.data);
        const name_dummy = fund_buffer.slice(0, 32).toString();
        let name = '';
        for (const c of name_dummy) {
            if (c === '\x00') break;
            name += c;
        }
        console.log(name);
        const totalDeposit = fund_buffer.readBigInt64LE(32);
        console.log(totalDeposit);
        const governance_mint = new PublicKey(fund_buffer.slice(40, 72));
        console.log(governance_mint);
        const vault = new PublicKey(fund_buffer.slice(72, 104));
        console.log(vault);
        const isInitialized = fund_buffer.readUInt8(104) ? true : false;
        console.log(isInitialized);
        const created_at = fund_buffer.readBigInt64LE(105);
        console.log(created_at);
        const is_private = fund_buffer.readUInt8(113);
        console.log(is_private);
        const members: PublicKey[] = [];
        console.log(members);
        const numOfMembers = fund_buffer.readUInt32LE(114);
        console.log(numOfMembers);
        const fund_creator = new PublicKey(fund_buffer.slice(118, 150));
        console.log(fund_creator.toBase58());

        // Reset form
        setFundName('');
        setFundCode('');
        setInviteLink('');
        setStep(1);
      } catch (error) {
        console.error('Error creating fund:', error);
        toast.error('Error creating fund');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl shadow-xl overflow-hidden transform transition-all">
      <div className="p-8">
        <h2 className="text-2xl font-bold text-white mb-6">
          {step === 1 ? 'Create a New Investment Fund' : 'Share Your Fund'}
        </h2>

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="fundName" className="block text-sm font-medium text-gray-300 mb-2">
                Fund Name
              </label>
              <input
                type="text"
                id="fundName"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                maxLength={32}
                className={`w-full px-4 py-3 rounded-lg bg-gray-700 text-white border ${
                  nameTaken
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
                } focus:ring-2 focus:ring-opacity-50 transition-colors duration-200`}
                placeholder="Enter a name for your investment fund"
              />
              {nameTaken && (
                <p className="text-sm text-red-400 mt-2">Fund name already taken</p>
              )}
            </div>

            {/* ✅ Checkbox for Public/Private fund */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-300">
                Keep your fund public
              </label>
            </div>

            <button
              type="submit"
              disabled={!fundName.trim() || nameTaken || checking}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors duration-200 ${
                !fundName.trim() || nameTaken || checking
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              Continue
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300">Fund Code</span>
                <button
                  onClick={() => copyToClipboard(fundCode)}
                  className="text-indigo-400 hover:text-indigo-300 text-sm"
                >
                  Copy
                </button>
              </div>
              <div className="bg-gray-800 p-3 rounded border border-gray-600 font-mono text-white">
                {fundCode}
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300">Invite Link</span>
                <button
                  onClick={() => copyToClipboard(inviteLink)}
                  className="text-indigo-400 hover:text-indigo-300 text-sm"
                >
                  Copy
                </button>
              </div>
              <div className="bg-gray-800 p-3 rounded border border-gray-600 font-mono text-white text-sm break-all">
                {inviteLink}
              </div>
            </div>

            <p className="text-gray-400 text-sm">
              Share this fund code or invite link with others you want to invite to your investment fund.
            </p>

            <div className="flex justify-between gap-4">
              <button
                onClick={() => setStep(1)}
                className="w-1/2 py-3 px-4 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-medium transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-1/2 py-3 px-4 rounded-lg ${
                  isSubmitting 
                    ? 'bg-gray-500 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-500'
                } text-white font-medium transition-colors duration-200`}
              >
                {isSubmitting ? 'Creating...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}