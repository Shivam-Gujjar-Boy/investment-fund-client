import { useEffect, useState, useCallback, useMemo } from 'react';
import {toast} from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import axios from 'axios';

type Token = {
  pubkey: PublicKey,
  mint: string;
  symbol: string;
  image: string;
  balance: number;
};

interface Fund {
  fund_address: PublicKey,
  name: string;
  creator: PublicKey,
  numOfMembers: number,
  members: PublicKey[];
  totalDeposit: bigint;
  governanceMint: PublicKey;
  vault: PublicKey;
  currentIndex: number;
  created_at: bigint;
  is_private: number;
}

interface Proposal {
  proposalIndex: number,
  vecIndex: number,
  proposer: PublicKey,
  fromAssets: PublicKey[],
  toAssets: PublicKey[],
  amounts: bigint[],
  slippages: number[],
  votesYes: bigint,
  votesNo: bigint,
  creationTime: bigint,
  deadline: bigint,
  executed: boolean
}

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

  const wallet = useWallet();
  const {connection} = useConnection();
  const {fundId} = useParams();

  // const programId = new PublicKey('CFdRopkCcbqxhQ46vNbw4jNZ3eQEmWZhmq5V467py9nG');
  const programId = useMemo(
    () => new PublicKey('CFdRopkCcbqxhQ46vNbw4jNZ3eQEmWZhmq5V467py9nG'),
    []
  );

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
      // if (!currentIndex) {
      //   console.log('current index not defined');
      //   return;
      // }
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
      await fetchFundData();
      await fetchProposalsData();
    }

    load();

    // fetchFundData();
    // fetchProposalsData();
  }, [fetchFundData, fetchProposalsData]);

  const dummyActivities = [
    'Alice deposited 100 USDC',
    'Bob withdrew 50 USDC',
    'Charlie voted on Proposal #1'
  ];

  // const dummyProposals = [
  //   { id: 1, title: 'Increase investment cap', description: 'Proposal to increase cap to 10,000 USDC' },
  //   { id: 2, title: 'Change governance threshold', description: 'Proposal to change voting threshold to 60%' },
  // ];

  // To open the Deposit modal
  const openDepositModal = async () => {
    setShowDepositModal(true);
    const tokens = await fetchUserTokens();
    if (!wallet.publicKey) {
      return;
    }
    const balance = await connection.getBalance(wallet.publicKey);
    tokens?.unshift({
      pubkey: new PublicKey('So11111111111111111111111111111111111111112'),
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'Unknown',
      image: '',
      balance: balance/Math.pow(10, 9),
    });
    console.log(tokens);
    if (!tokens) return;
    setUserTokens(tokens);
    if (tokens.length > 0) setSelectedToken(tokens[0]);
  };

  // To fetch user's token accounts
  const fetchUserTokens = async () => {
    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Wallet is not connected');
        return;
      }
      const user =  wallet.publicKey;
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        user,
        {programId: TOKEN_PROGRAM_ID}
      );

      console.log(tokenAccounts);

      const tokens = tokenAccounts.value
        .map((acc) => {
          const info = acc.account.data?.parsed.info;
          const mint = info.mint;
          const balance = info.tokenAmount.uiAmount;
          return {
            pubkey: acc.pubkey,
            mint,
            symbol: 'Unknown',
            image: '',
            balance,
          };
        })
        .filter((token) => token.balance > 0);

      return tokens;
    } catch (err) {
      console.error('Error feching tokens:', err);
      return [];
    }
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

      toast.success('Successfully deposited assets to fund');
    } catch (err) {
      toast.error('Error despositing assets');
      console.log(err);
    }
  };

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
      const numOfSwaps = 1;
      const amount = BigInt(1000000);
      const slippage = 500;
      const deadline = BigInt(Math.floor(Date.now()/1000)) + BigInt(1200);
      const fund_name = fund?.name;

      const nameBytes = Buffer.from(fund_name, 'utf8');
      const nameLength = nameBytes.length;

      const buffer = Buffer.alloc(1 + 1 + 8 + 2 + 8 + nameLength);
      let offset = 0;

      buffer.writeUInt8(instructionTag, offset);
      // console.log(buffer);
      offset += 1;
      buffer.writeUInt8(numOfSwaps, offset);
      // console.log(buffer);
      offset += 1;
      buffer.writeBigInt64LE(amount, offset);
      // console.log(buffer);
      offset += 8;
      buffer.writeUInt16LE(slippage, offset);
      // console.log(buffer);
      offset += 2;
      buffer.writeBigInt64LE(deadline, offset);
      // console.log(buffer);
      offset += 8;
      nameBytes.copy(buffer, offset);
      // console.log(buffer);

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
      const usdcMint = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');

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
          {pubkey: usdcMint, isSigner: false, isWritable: false},
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

      toast.success("Proposal created successfully");
    } catch (err) {
      console.log(err);
      toast.error('shivam behen ka lund hai');
    }
  }

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

      toast.success('kar diya vote launde ne');
    } catch (err) {
      console.log('vote nahi kar paya tu: ', err);
      toast.error('Sorry bhai tu vote nhi kar paaya');
    }


  }

  return (
    <div className="p-6 text-white min-h-screen bg-gradient-to-b from-[#0e1117] to-[#1b1f27]">
      <h1 className="text-3xl font-bold mb-6">Fund Details</h1>

      <div className="grid grid-cols-[2fr_1fr] gap-6">
        {/* Left Section */}
        <div className="flex flex-col gap-6">
          {/* Graph & Members */}
          <div className="flex gap-6">
            {/* Fund Graph */}
            <div className="bg-[#1f2937] p-6 rounded-2xl h-[28rem] w-full flex flex-col">
              <h2 className="text-xl font-semibold mb-4">Fund Value</h2>
              <div className="grow bg-gray-700 rounded mb-4" />
              <div className="flex gap-3 mt-2">
                {["1m", "1h", "1d", "1w", "1mo"].map(label => (
                  <button key={label} className="px-3 py-1.5 bg-gray-800 rounded hover:bg-gray-700 transition">{label}</button>
                ))}
              </div>
            </div>

            {/* Members */}
            <div className="bg-[#1f2937] p-6 rounded-2xl h-[28rem] w-[40%] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Members</h2>
              <ul className="text-sm space-y-1">
                {fund?.members.map((m, idx) => (
                  <li key={idx} className="border-b border-gray-700 pb-1">{m.toBase58()}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Activity */}
          <div className="bg-[#1f2937] p-6 rounded-2xl max-h-40 overflow-y-auto">
            <h2 className="text-xl font-semibold mb-3">Activity</h2>
            <ul className="text-sm list-disc list-inside space-y-1">
              {dummyActivities.map((a, idx) => (
                <li key={idx}>{a}</li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button onClick={openDepositModal} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-xl transition">Deposit</button>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl transition">Invite</button>
            <button className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl transition">Withdraw</button>
          </div>
        </div>

        {/* Proposals */}
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
              {/* <div className="text-lg font-medium mb-2">{p.}</div> */}
              <div className="flex justify-end gap-2">
                <button className="bg-green-600 px-3 py-1 rounded" onClick={() => handleVote(1, p.proposalIndex, p.vecIndex)}>YES</button>
                <button className="bg-red-600 px-3 py-1 rounded" onClick={() => handleVote(0, p.proposalIndex, p.vecIndex)}>NO</button>
              </div>
            </div>
          ))}
          <button onClick={handleProposalCreation} className='bg-green-600 px-4 py-2 rounded disabled:opacity-50'>Create Proposal</button>
        </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-[#1f2937] p-6 rounded-2xl w-[90%] max-w-xl text-white">
            <h2 className="text-xl font-semibold mb-4">Deposit Tokens</h2>
            <div className="flex items-center gap-4">
              <input
                type="number"
                className="bg-gray-800 px-3 py-2 rounded w-full"
                placeholder="Amount"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              <select
                className="bg-gray-800 px-3 py-2 rounded"
                value={selectedToken?.mint || ''}
                onChange={e => {
                  if (!userTokens) return;
                  setSelectedToken(userTokens.find(t => t.mint === e.target.value) || null)
                }}
              >
                {userTokens.map(token => (
                  <option key={token.mint} value={token.mint}>
                    {token.symbol} ({token.balance})
                  </option>
                ))}
              </select>
            </div>
            {amount && selectedToken && parseFloat(amount) > selectedToken.balance && (
              <p className="text-red-500 text-sm mt-2">Insufficient balance</p>
            )}
            <div className="flex justify-end mt-6 gap-4">
              <button className="bg-gray-600 px-4 py-2 rounded" onClick={() => setShowDepositModal(false)}>Cancel</button>
              <button
                onClick={handleDeposit}
                className="bg-green-600 px-4 py-2 rounded disabled:opacity-50"
                disabled={!selectedToken || !amount || parseFloat(amount) > selectedToken.balance}
              >
                Deposit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
