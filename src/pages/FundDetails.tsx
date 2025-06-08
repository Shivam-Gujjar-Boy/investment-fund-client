import { useEffect, useState, useCallback } from 'react';
import {toast} from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import axios from 'axios';
import { Buffer } from 'buffer';
import { Proposal, Fund, Token, programId } from '../types';
import Proposals from '../components/Proposals/Proposals';
import FundActivity from '../components/FundActivity/FundActivity';
import FundMembers from '../components/FundMembers/FundMembers';
import FundGraph from '../components/FundGraph/FundGraph';
import { fetchUserTokens } from '../functions/fetchuserTokens';
import {Metaplex} from '@metaplex-foundation/js';

export default function FundDetails() {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [vecIndex, setVecIndex] = useState(0);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [userTokens, setUserTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [fundPda, setFundPda] = useState<PublicKey | null>(null);
  const [fund, setFund] = useState<Fund | null>(null);
  const [amount, setAmount] = useState('');
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
    console.log(fundId);
    const fundAccountPda = new PublicKey(fundId);
    setFundPda(fundAccountPda);
    console.log(fundAccountPda.toBase58());

    try {
      const accountInfo = await connection.getAccountInfo(fundAccountPda);
      if (!accountInfo) {
        toast.error('Fund Id not found');
        return;
      }
      const buffer = Buffer.from(accountInfo?.data);
      console.log(buffer);
      const name_dummy = buffer.slice(0, 32).toString();
      let name = '';
      for (const c of name_dummy) {
        if (c === '\x00') break;
        name += c;
      }
      console.log(name);
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
      console.log(fund);
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
        console.log('fund nahi hai gandu');
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
      console.log(fundAddress.toBase58());
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

  // To open the Deposit modal
  const openDepositModal = async () => {
    setShowDepositModal(true);
    const tokens = await fetchUserTokens(wallet, connection, metaplex);
    if (!wallet.publicKey) {
      return;
    }

    console.log(tokens);
    if (!tokens) return;
    setUserTokens(tokens);
    if (tokens.length > 0) setSelectedToken(tokens[0]);
  };

  // To handle deposit (program invocation)
  const handleDeposit = async () => {
    console.log(`Deposit ${amount} ${selectedToken?.symbol}`);

    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Wallet is not connected');
        return;
      }

      const user = wallet.publicKey;
      if (!selectedToken || !fund) {
        toast.error('Token or fund not selected');
        return;
      }

      const mint = new PublicKey(selectedToken?.mint);
      console.log(mint.toBase58(), '---------');

      const vaultATA = await getAssociatedTokenAddress(
        mint,
        fund.vault,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      console.log('Vault ATA', vaultATA.toBase58());

      const governanceATA = await getAssociatedTokenAddress(
        fund?.governanceMint,
        user,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      if (!fundPda) {
        toast.error('No fund pda found');
        return;
      }

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), user.toBuffer()],
        programId
      );
      
      const keyp = Keypair.generate();

      const keys = [
        {pubkey: user, isSigner: true, isWritable: true},
        {
          pubkey: selectedToken?.mint === 'So11111111111111111111111111111111111111112'
            ? keyp.publicKey
            : selectedToken?.pubkey, 
          isSigner: selectedToken?.mint === 'So11111111111111111111111111111111111111112'
            ? true
            : false, 
          isWritable: true
        },
        {pubkey: fund?.vault, isSigner: false, isWritable: true},
        {pubkey: vaultATA, isSigner: false, isWritable: true},
        {pubkey: mint, isSigner: false, isWritable: true},
        {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
        {pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
        {pubkey: fundPda, isSigner: false, isWritable: true},
        {pubkey: userAccountPda, isSigner: false, isWritable: true},
        {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
        {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
        {pubkey: governanceATA, isSigner: false, isWritable: true},
        {pubkey: fund?.governanceMint, isSigner: false, isWritable: true},
      ];

      const ui_amount = BigInt(amount);
      // Instruction tag
      const instructionTag = Buffer.from([7]);

      // transfer amount
      const mintInfo = await getMint(connection, mint);
      const decimals = mintInfo.decimals;
      const transfer_amount = ui_amount*BigInt(Math.pow(10, decimals));
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigInt64LE(transfer_amount);

      // mint amount
      const response = await axios(`https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=${transfer_amount}&slippageBps=50`);
      if (!response) {
        toast.error('Failed to fetch token price');
        return;
      }
      const mint_amount = BigInt(response.data.outAmount);
      console.log(mint_amount);

      const minTAmountBuffer = Buffer.alloc(8);
      minTAmountBuffer.writeBigInt64LE(mint_amount);

      const nameBytes = new TextEncoder().encode(fund.name);

      const instructionData = Buffer.concat([instructionTag, amountBuffer, minTAmountBuffer, nameBytes]);
      console.log(instructionData.length);

      const instruction = new TransactionInstruction({
        keys,
        programId,
        data: instructionData
      });

      const transaction = new Transaction().add(instruction);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign the transaction
      if (selectedToken?.mint === 'So11111111111111111111111111111111111111112') {
        transaction.partialSign(keyp);
      }
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

      setShowDepositModal(false);

      toast.success('Successfully deposited assets to fund');
    } catch (err) {
      toast.error('Error despositing assets');
      console.log(err);
    }
  };

  return (
    <div className="p-2 text-white min-h-screen w-full bg-gradient-to-b from-[#0e1117] to-[#1b1f27]">
      {/* <h1 className="text-3xl font-bold mb-6">Fund Details</h1> */}

      <div className="grid grid-cols-[3fr_1fr] gap-2">
        {/* Left Section */}
        <div className="flex flex-col gap-2">
          {/* Graph & Members */}
          <div className="flex gap-2">
            {/* Fund Graph */}
            <FundGraph />

            {/* Members */}
            {loading ? (
              <div className="bg-[#1f2937] p-6 h-[28rem] w-[30%] animate-pulse space-y-4">
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
              fund && <FundMembers members={fund.members} governanceMint={fund.governanceMint} />
            )}
          </div>

          {/* Activity */}
          <FundActivity />

          {/* Actions */}
          <div className="flex gap-4">
            <button onClick={openDepositModal} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-xl transition">Deposit</button>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl transition">Invite</button>
            <button className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl transition">Withdraw</button>
          </div>
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

      {/* Proposal Modal */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-[#1f2937] p-6 rounded-2xl w-[90%] max-w-2xl text-white">
            {/* <h2 className="text-2xl font-semibold mb-4">{selectedProposal.title}</h2> */}
            {/* <p className="mb-4">{selectedProposal.description}</p> */}
            <div className="flex gap-4 justify-end">
              <button className="bg-green-600 px-4 py-2 rounded">YES</button>
              <button className="bg-red-600 px-4 py-2 rounded">NO</button>
              <button className="bg-gray-600 px-4 py-2 rounded" onClick={() => setSelectedProposal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#171f32] border border-white/10 shadow-2xl rounded-3xl p-6 w-[90%] max-w-xl text-white transition-all duration-300 scale-100 relative">

            {/* Title */}
            <h2 className="text-2xl font-bold mb-6 tracking-wide">💰 Deposit Tokens</h2>

            {/* Balance Row */}
            {selectedToken && (
              <div className="flex justify-between text-xs text-white mb-2 px-1">
                <div className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  {selectedToken.symbol} balance: {selectedToken.balance}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAmount(selectedToken.balance.toString())}
                    className="text-xs bg-gray-700 text-gray-300 px-2 py-[2px] rounded hover:bg-gray-600"
                  >
                    Max
                  </button>
                  <button
                    onClick={() => setAmount((selectedToken.balance * 0.5).toFixed(6))}
                    className="text-xs bg-gray-700 text-gray-300 px-2 py-[2px] rounded hover:bg-gray-600"
                  >
                    50%
                  </button>
                </div>
              </div>
            )}

            {/* Input Box */}
            <div className="flex items-center bg-[#0c1118] rounded-2xl overflow-hidden text-white">

              {/* Token Selector */}
              <div className="flex items-center gap-1 px-4 py-3 min-w-[140px] bg-[#2c3a4e] rounded-2xl m-3 cursor-pointer">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-600 border border-gray-600">
                  {selectedToken?.image ? (
                    <img src={selectedToken.image} alt="token" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-600 rounded-full" />
                  )}
                </div>

                <select
                  value={selectedToken?.mint || ''}
                  onChange={(e) =>
                    setSelectedToken(userTokens.find((t) => t.mint === e.target.value) || null)
                  }
                  className="bg-transparent text-white text-xl outline-none cursor-pointer py-0"
                >
                  {userTokens.map((token) => (
                    <option key={token.mint} value={token.mint} className="text-black">
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Input */}
              <input
                type="number"
                // placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 text-right px-4 py-3 text-2xl bg-transparent outline-none placeholder-white"
              />
            </div>

            {/* Error */}
            {amount && selectedToken && parseFloat(amount) > selectedToken.balance && (
              <p className="text-red-500 text-sm mt-3">🚫 Insufficient balance</p>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end mt-8 gap-4">
              <button
                className="px-5 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 transition-all"
                onClick={() => {
                  const modal = document.querySelector('.animate-fadeIn');
                  if (modal) {
                    modal.classList.remove('animate-fadeIn');
                    modal.classList.add('animate-fadeOut');
                    setTimeout(() => setShowDepositModal(false), 200);
                  } else {
                    setShowDepositModal(false);
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!selectedToken || !amount || parseFloat(amount) > selectedToken.balance}
              >
                ✅ Deposit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
