import { useEffect, useState, useRef } from 'react';
import {toast} from 'react-hot-toast';
import { 
  PublicKey, 
  SystemProgram, 
  TransactionInstruction, 
  Transaction,
} from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';
import { SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Fund, programId, TOKEN_METADATA_PROGRAM_ID } from '../../types';
import { extractFundData } from '../../functions/extractFundData';
import { printFundDetails } from '../../functions/printFundDetails';
import { Buffer } from 'buffer';

let debounceTimer: NodeJS.Timeout;

export default function CreateFundForm() {
  const [fundName, setFundName] = useState('');
  const [step, setStep] = useState(1);
  const [nameTaken, setNameTaken] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [expectedMembers, setExpectedMembers] = useState<number | ''>('');
  const [hasTouchedInput, setHasTouchedInput] = useState(false);

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
        const res = await axios(`https://peerfunds.onrender.com/api/funds/exists/${fundName}`);
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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
        setHasScrolledToEnd(true);
      }
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmit();
  };

  const handleSubmit = async () => {

    if (step === 1) {
      if (!fundName.trim()) {
        return;
      }

      if (nameTaken) {
        return;
      }

      setPrivacy(!isPublic);

      // const generatedCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      // setFundCode(generatedCode);
      // const baseUrl = window.location.origin;
      // setInviteLink(`${baseUrl}/dashboard/join?code=${generatedCode}`);
      setStep(2);
    } else {
      if (!wallet.publicKey || !wallet.signTransaction) {
        return;
      }

      setIsSubmitting(true);

      try {
        const creator = wallet.publicKey;

        if (!creator) throw new Error('Wallet not connected');

        // Generate fund account PDA
        const [fundAccountPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('fund'), Buffer.from(fundName)],
          programId,
        );

        // Generate governance mint
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

        const [proposalAggregatorAccount] = PublicKey.findProgramAddressSync(
          [Buffer.from('proposal-aggregator'), Buffer.from([0]), fundAccountPda.toBuffer()],
          programId
        );

        // Instruction data
        const nameBytes = new TextEncoder().encode(fundName);
        console.log("Fund name in bytes : ", nameBytes);

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
            {pubkey: proposalAggregatorAccount, isSigner: false, isWritable: true}
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
        console.log("Proposal Aggregator key : ", proposalAggregatorAccount.toBase58());
        
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
        const fund: Fund | null = extractFundData(fundAccountInfo);
        if (!fund) return;
        fund.fund_address = fundAccountPda;
        printFundDetails(fund);

        const res = await axios.post('https://peerfunds.onrender.com/api/funds', {
          name: fund.name
        });
        if (res.status === 201) {
          console.log('Fund name added in database');
        }

        // Reset form
        setFundName('');
        setStep(1);
      } catch (error) {
        console.error('Error creating fund:', error);
        toast.error('Error creating fund');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const isFormValid = isChecked && Number(expectedMembers) > 0;

  return (
    <div className="max-w-2xl mx-auto bg-[#1e2035]/80 backdrop-blur-2xl rounded-2xl border border-indigo-900 shadow-[0_0_10px_#6d28d9aa] transition-all overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">
          {step === 1 ? 'Create a New Investment Fund' : '🔍 Before You Create a Fund '}
        </h2>

        {step === 1 ? (
          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* Fund Name Input */}
            <div>
              <label htmlFor="fundName" className="block text-sm font-semibold text-indigo-200 mb-2">
                Fund Name
              </label>
              <input
                type="text"
                id="fundName"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                maxLength={32}
                className={`w-full px-4 py-3 rounded-lg bg-[#2a2d4a] text-white placeholder:text-gray-400 border ${
                  nameTaken
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-indigo-700 focus:border-indigo-500 focus:ring-indigo-600'
                } focus:ring-2 focus:ring-opacity-50 outline-none transition-all`}
                placeholder="e.g. QuantumEdge DAO"
              />
              {nameTaken && (
                <p className="text-sm text-red-400 mt-2">⚠️ Fund name already taken</p>
              )}
            </div>

            {/* Public Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 text-indigo-500 border-gray-400 focus:ring-indigo-500 rounded"
              />
              <label htmlFor="isPublic" className="ml-2 text-sm text-indigo-200">
                Make this fund public
              </label>
            </div>

            {/* Info Box Based on Fund Privacy */}
            <div className="bg-[#2b2e49] border border-indigo-700 rounded-xl p-4 text-sm text-indigo-100 space-y-2">
              <h3 className="font-semibold text-indigo-300">👥 How Invitations Work in PeerFunds</h3>

              {isPublic ? (
                <ul className="list-disc pl-5 space-y-1">
                  <li>This fund is <span className="text-green-400 font-medium">public</span>.</li>
                  <li>Anyone can join by visiting the Join page and entering the fund name.</li>
                  <li>Once the transaction is confirmed, they are instantly added to the fund.</li>
                </ul>
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  <li>This fund is <span className="text-yellow-400 font-medium">private</span>.</li>
                  <li>When someone tries to join using the Join page, a <strong>join proposal</strong> is created.</li>
                  <li>Existing members must vote to approve or reject the proposal using their governance voting power.</li>
                  <li>If majority approval is achieved, the new user is added to the fund automatically.</li>
                  <li>This mechanism ensures fund <strong>privacy, security</strong>, and <strong>member control</strong>.</li>
                </ul>
              )}
            </div>

            {/* Continue Button */}
            <button
              type="submit"
              disabled={!fundName.trim() || nameTaken || checking}
              className={`w-full py-3 px-4 rounded-xl font-medium text-white transition-all duration-200 ${
                !fundName.trim() || nameTaken || checking
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 shadow-md'
              }`}
            >
              Continue
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div
              ref={scrollRef}
              className="bg-[#2b2e49] border border-indigo-700 rounded-xl p-4 max-h-96 overflow-y-auto scroll-smooth"
            >
              <h2 className="text-indigo-300 text-lg font-semibold mb-4">Important Note Points (1 minute read)</h2>

              <ul className="list-disc pl-5 space-y-3 text-indigo-100 text-sm">
                <li>A unique <strong>Fund PDA Account</strong> is created to store general fund information. This is <em>not</em> user-specific.</li>
                <li>A <strong>Vault PDA Account</strong> is initialized to securely hold all fund assets and tokens.</li>
                <li>A <strong>Governance Mint Account</strong> is created to issue governance tokens to members.</li>
                <li>Tokens are earned with deposits and burnt on withdrawals. All logic is transparent and on-chain.</li>
                <li>View everything on the <a href="https://github.com/Shivam-Gujjar-Boy/investment-fund" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">official GitHub</a>.</li>
                <li>Metadata and user PDAs are also updated accordingly during fund activity.</li>
                <li>Fund creation costs ~<strong>0.022 SOL</strong>.</li>
                <li>
                  You must specify how many members you <strong>expect to join</strong> the fund in the future.
                  This number directly affects your refund eligibility.
                </li>
                <li>
                  When members join, a fixed amount of SOL is deducted and stored in PeerFunds’ rent reserve.
                  You will only be <strong>refunded</strong> once the expected number of members has joined.
                </li>
              </ul>

              <div className="mt-6">
                <label className="block text-indigo-200 text-sm font-medium">
                  Expected Number of Members <span className="text-red-400">*</span>
                </label>
                <span className='text-xs'>(Be mindful, since you will get creation refund only when this strength is reached)</span>
                <input
                  type="number"
                  min={1}
                  value={expectedMembers}
                  onChange={(e) => setExpectedMembers(e.target.value ? parseInt(e.target.value) : '')}
                  onBlur={() => setHasTouchedInput(true)}
                  className="w-full mt-1 bg-[#1a1d36] border border-indigo-800 rounded-lg px-3 py-2 text-white text-sm placeholder:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="e.g. 5"
                  required
                />
                {hasTouchedInput && (!expectedMembers || expectedMembers <= 0) && (
                  <p className="text-red-400 text-xs mt-1">Please enter a valid number of members.</p>
                )}
              </div>

              {hasScrolledToEnd && (
                <div className="mt-6">
                  <label className="flex items-center space-x-2 text-sm text-indigo-200">
                    <input
                      type="checkbox"
                      className="accent-indigo-500"
                      checked={isChecked}
                      onChange={(e) => setIsChecked(e.target.checked)}
                    />
                    <span>I acknowledge and accept all the information provided above.</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-4 pt-2">
              <button
                onClick={() => setStep(1)}
                className="w-1/2 py-3 px-4 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isFormValid || isSubmitting}
                className={`w-1/2 py-3 px-4 rounded-xl font-semibold text-white transition-all ${
                  !isFormValid || isSubmitting
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-700 to-purple-600 hover:from-indigo-600 hover:to-purple-500 shadow-md'
                }`}
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