import { useCallback, useEffect, useRef, useState } from 'react';
import { LightFund, Metas, programId, Proposal, TOKEN_METADATA_PROGRAM_ID } from '../../types';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Metaplex } from '@metaplex-foundation/js';
import toast from 'react-hot-toast';
import axios from 'axios';
import SOL from '../../assets/SOL.jpg';
import USDC from '../../assets/USDC.png';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import { motion } from 'framer-motion';

interface ProposalProps {
  fund: LightFund,
  filterType: string,
}

const Proposals = ({fund, filterType}: ProposalProps) => {
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [activeProposals, setActiveProposals] = useState<Proposal[] | null>(null);
    const [passedProposals, setPassedProposals] = useState<Proposal[] | null>(null);
    const [failedProposals, setFailedProposals] = useState<Proposal[] | null>(null);
    const [isPassedFetched, setIsPassedFetched] = useState(false); 
    const [isFailedFetched, setIsFailedFetched] = useState(false); 
    const [metas, setMetas] = useState<Metas[]>([]);
    const [voting, setVoting] = useState(false);
    const [executionInitiated, setExecutionInitiated] = useState(false);
    const [deleting, setDeleting] = useState(false);
    // const [filter, setFilter] = useState('all');


    const {connection} = useConnection();
    const wallet = useWallet();
    const metaplex = Metaplex.make(connection);

    const voteOnProposal = async (vote: number, proposalIndex: number, vecIndex: number, proposer: PublicKey) => {
      console.log(proposalIndex);
      if (!wallet || !wallet.publicKey || !wallet.signTransaction) return;
      const user = wallet.publicKey;

      try {
        const instructionTag = 2;
        const nameBytes = Buffer.from(fund.name, 'utf8');
        const buffer = Buffer.alloc(1 + 1 + 1 + 2 + nameBytes.length);
        let offset = 0;

        buffer.writeUInt8(instructionTag, offset);
        offset += 1;
        buffer.writeUInt8(vote, offset);
        offset += 1;
        buffer.writeUInt8(proposalIndex, offset);
        offset += 1;
        buffer.writeUInt16LE(vecIndex, offset);
        offset += 2;
        nameBytes.copy(buffer, offset);

        const instructionData = buffer;

        const [proposalAggregatorPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('proposal-aggregator'), Buffer.from([proposalIndex]), fund.fundPubkey.toBuffer()],
          programId
        );

        const instruction = new TransactionInstruction({
          keys: [
            {pubkey: user, isSigner: true, isWritable: true},
            {pubkey: proposalAggregatorPda, isSigner: false, isWritable: true},
            {pubkey: fund.fundPubkey, isSigner: false, isWritable: false},
            {pubkey: proposer, isSigner: false, isWritable: false},
            {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false}
          ],
          programId,
          data: instructionData
        });

        const transaction = new Transaction().add(instruction);

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

        toast.success('Successfully Voted on Proposal');

      } catch (err) {
        console.log(err);
        toast.error('Error Voting');
      } finally {
        setVoting(false);
      }
    }

    const handleDeletion = async () => {
      if (!wallet || !wallet.publicKey || !wallet.signTransaction || !selectedProposal || !fund) {
        return;
      }

      const user = wallet.publicKey;

      console.log(selectedProposal);

      try {
        const instructionTag = 13;
        const nameBytes = Buffer.from(fund.name, 'utf8');

        const buffer = Buffer.alloc(1 + 1 + 2 + nameBytes.length);
        let offset = 0;

        buffer.writeUInt8(instructionTag, offset);
        offset += 1;
        buffer.writeUInt8(selectedProposal.proposalIndex, offset);
        offset += 1;
        buffer.writeUInt16LE(selectedProposal.vecIndex, offset);
        offset += 2;
        nameBytes.copy(buffer, offset);

        const instructionData = buffer;

        const [proposalAggregatorPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('proposal-aggregator'), Buffer.from([selectedProposal.proposalIndex]), fund.fundPubkey.toBuffer()],
          programId
        );

        const [rentPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('rent')],
          programId
        );

        const instruction = new TransactionInstruction({
          keys: [
            {pubkey: user, isSigner: true, isWritable: true},
            {pubkey: proposalAggregatorPda, isSigner: false, isWritable: true},
            {pubkey: fund.fundPubkey, isSigner: false, isWritable: false},
            {pubkey: rentPda, isSigner: false, isWritable: true}
          ],
          programId,
          data: instructionData
        });

        const transaction = new Transaction().add(instruction);

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

        toast.success('Successfully Deleted the Proposal!');

      } catch (err) {
        console.log(err);
        toast.error('Error Deleting Proposal');
      } finally {
        setDeleting(false);
      }
    }

    const fetchedProposals = useCallback(async () => {

      if (!fund) return;

      try {
        const [currentAggregatorPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("proposal-aggregator"), Buffer.from([fund.currentIndex]), fund.fundPubkey.toBuffer()],
          programId,
        );
        console.log(currentAggregatorPda.toBase58());

        const currentAggregatorInfo = await connection.getAccountInfo(currentAggregatorPda);
        if (!currentAggregatorInfo) return;

        const currentAggregatorBuffer = Buffer.from(currentAggregatorInfo.data);

        // const fetchedProposals: Proposal[] = [];
        const activePirposals: Proposal[] = [];
        const passedPirposals: Proposal[] = [];
        const failedPirposals: Proposal[] = [];
        const timestamp = Date.now();

        const numOfProposals = currentAggregatorBuffer.readUint32LE(1);
        let offset = 5;
        const tokens: Metas[] = [];

        console.log(numOfProposals);

// pub struct Proposal {
//     pub proposer: Pubkey,
//     pub cid: [u8; 59],
//     pub merkel_root: [u8; 32],
//     pub votes_yes: u64,
//     pub votes_no: u64,
//     pub creation_time: i64,
//     pub deadline: i64,
//     pub executed: u8,
//     pub vec_index: u16,
//     pub swaps_status: u16,
//     pub voters_bitmap: Vec<(u32, u8)>,
// }

        for (let i=0; i<numOfProposals; i++) {
          const isExecuted = currentAggregatorBuffer.readUInt8(offset + 155);
          console.log(isExecuted);

          const proposer = new PublicKey(currentAggregatorBuffer.slice(offset, offset + 32));
          offset += 32;
          console.log(offset);
          const cid = currentAggregatorBuffer.slice(offset, offset + 59).toString();
          offset += 59;
          console.log(cid);
          const merkelRoot = currentAggregatorBuffer.slice(offset, offset + 32).toString('hex');
          offset += 32;
          const votesYes = currentAggregatorBuffer.readBigInt64LE(offset);
          offset += 8;
          const votesNo = currentAggregatorBuffer.readBigInt64LE(offset);
          offset += 8;
          const creationTime = currentAggregatorBuffer.readBigInt64LE(offset);
          offset += 8;
          const deadline = currentAggregatorBuffer.readBigInt64LE(offset);
          offset += 8;
          offset += 1;
          const vecIndex = currentAggregatorBuffer.readUint16LE(offset);
          offset += 2;
          const swaps_status_bytes = currentAggregatorBuffer.readUInt16LE(offset);
          offset += 2;
          const numOfVoters = currentAggregatorBuffer.readUInt32LE(offset);
          console.log(numOfVoters);
          offset += 4;
          console.log("Number of Voters", numOfVoters);
          console.log('Offset = ', offset);
          const votersIndex: [number, number][] = [];
          for (let i = 0; i < numOfVoters; i++) {
            const voterIndex = currentAggregatorBuffer.readUInt32LE(offset);
            offset += 4;
            const vote = currentAggregatorBuffer.readUInt8(offset);
            offset += 1;
            votersIndex.push([voterIndex, vote]);
          }

          const voters: [PublicKey, number][] = [];

          for (const v of votersIndex) {
            const voter = fund.members.find((member) => member[1] === v[0]);
            if (voter) {
              voters.push(voter);
            }
          }

          if ((isExecuted === 0 || isExecuted === 1) && deadline > timestamp) {
            const proposalDataUrl = `https://${cid}.ipfs.w3s.link/`;
            const proposalDataResponse = await fetch(proposalDataUrl);
            if (!proposalDataResponse.ok) {
              throw new Error(`Failed to fetch metadata: ${proposalDataResponse.status}`);
            }
  
            const fetchedProposalData = await proposalDataResponse.json();
            const tags = fetchedProposalData.tags;
            const title = fetchedProposalData.title;
            const description = fetchedProposalData.description;
            const numOfSwaps = fetchedProposalData.swaps.length;
            const fromAssets: string[] = [];
            const toAssets: string[] = [];
            const amounts: number[] = [];
            const slippages: number[] = [];
            const fromDecimals: number[] = [];
  
            for (const swap of fetchedProposalData.swaps) {
              if (!tokens.some(m => m.mint === swap.fromToken)) {
                let name = '';
                let symbol = '';
                let image = '';
                if (swap.fromToken === 'So11111111111111111111111111111111111111112') {
                  name = 'SOL';
                  symbol = 'SOL';
                  image = SOL;
                } else if (swap.fromToken === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
                  name = 'USDC';
                  symbol = 'USDC';
                  image = USDC;
                }
                tokens.push({
                  mint: swap.fromToken,
                  name,
                  symbol,
                  image,
                });
              }
              if (!tokens.some(m => m.mint === swap.toToken)) {
                let name = '';
                let symbol = '';
                let image = '';
                if (swap.toToken === 'So11111111111111111111111111111111111111112') {
                  name = 'SOL';
                  symbol = 'SOL';
                  image = SOL;
                } else if (swap.toToken === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
                  name = 'USDC';
                  symbol = 'USDC';
                  image = USDC;
                }
                tokens.push({
                  mint: swap.toToken,
                  name,
                  symbol,
                  image,
                });
              }
              fromAssets.push(swap.fromToken);
              toAssets.push(swap.toToken);
              amounts.push(Number(swap.fromAmount));
              slippages.push(Number(swap.slippage));
              fromDecimals.push(Number(swap.fromDecimals));
            }

            activePirposals.push({
              tags,
              title,
              description,
              proposalIndex: fund.currentIndex,
              vecIndex,
              proposer,
              numOfSwaps,
              fromAssets,
              toAssets,
              amounts,
              slippages,
              votesYes,
              votesNo,
              creationTime,
              deadline,
              executed: isExecuted,
              voters,
              swaps_status: swaps_status_bytes,
              merkelRoot,
              fromDecimals,
              cid,
            })
          } else if ((isExecuted === 0 || isExecuted === 1) && deadline <= timestamp) {
            if (votesYes > votesNo && (votesYes + votesNo) >= fund.numOfMembers/2) {
              const proposalDataUrl = `https://${cid}.ipfs.w3s.link/`;
              const proposalDataResponse = await fetch(proposalDataUrl);
              if (!proposalDataResponse.ok) {
                throw new Error(`Failed to fetch metadata: ${proposalDataResponse.status}`);
              }
    
              const fetchedProposalData = await proposalDataResponse.json();
              const tags = fetchedProposalData.tags;
              const title = fetchedProposalData.title;
              const description = fetchedProposalData.description;
              const numOfSwaps = fetchedProposalData.swaps.length;
              const fromAssets: string[] = [];
              const toAssets: string[] = [];
              const amounts: number[] = [];
              const slippages: number[] = [];
              const fromDecimals: number[] = [];
    
              for (const swap of fetchedProposalData.swaps) {
                if (!tokens.some(m => m.mint === swap.fromToken)) {
                  let name = '';
                  let symbol = '';
                  let image = '';
                  if (swap.fromToken === 'So11111111111111111111111111111111111111112') {
                    name = 'SOL';
                    symbol = 'SOL';
                    image = SOL;
                  } else if (swap.fromToken === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
                    name = 'USDC';
                    symbol = 'USDC';
                    image = USDC;
                  }
                  tokens.push({
                    mint: swap.fromToken,
                    name,
                    symbol,
                    image,
                  });
                }
                if (!tokens.some(m => m.mint === swap.toToken)) {
                  let name = '';
                  let symbol = '';
                  let image = '';
                  if (swap.toToken === 'So11111111111111111111111111111111111111112') {
                    name = 'SOL';
                    symbol = 'SOL';
                    image = SOL;
                  } else if (swap.toToken === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
                    name = 'USDC';
                    symbol = 'USDC';
                    image = USDC;
                  }
                  tokens.push({
                    mint: swap.toToken,
                    name,
                    symbol,
                    image,
                  });
                }
                fromAssets.push(swap.fromToken);
                toAssets.push(swap.toToken);
                amounts.push(Number(swap.fromAmount));
                slippages.push(Number(swap.slippage));
                fromDecimals.push(Number(swap.fromDecimals));
              }

              activePirposals.push({
                tags,
                title,
                description,
                proposalIndex: fund.currentIndex,
                vecIndex,
                proposer,
                numOfSwaps,
                fromAssets,
                toAssets,
                amounts,
                slippages,
                votesYes,
                votesNo,
                creationTime,
                deadline,
                executed: isExecuted,
                voters,
                swaps_status: swaps_status_bytes,
                merkelRoot,
                fromDecimals,
                cid,
              })
            } else {
              failedPirposals.push({
                tags: [],
                title: '',
                description: '',
                proposalIndex: fund.currentIndex,
                vecIndex,
                proposer,
                numOfSwaps: 0,
                fromAssets: [],
                toAssets: [],
                amounts: [],
                slippages: [],
                votesYes,
                votesNo,
                creationTime,
                deadline,
                executed: isExecuted,
                voters,
                swaps_status: swaps_status_bytes,
                merkelRoot,
                fromDecimals: [],
                cid,
              })
            }
          } else if (isExecuted === 2) {
            if (swaps_status_bytes === 0) {
              failedPirposals.push({
                tags: [],
                title: '',
                description: '',
                proposalIndex: fund.currentIndex,
                vecIndex,
                proposer,
                numOfSwaps: 0,
                fromAssets: [],
                toAssets: [],
                amounts: [],
                slippages: [],
                votesYes,
                votesNo,
                creationTime,
                deadline,
                executed: isExecuted,
                voters,
                swaps_status: swaps_status_bytes,
                merkelRoot,
                fromDecimals: [],
                cid,
              })
            } else {
              passedPirposals.push({
                tags: [],
                title: '',
                description: '',
                proposalIndex: fund.currentIndex,
                vecIndex,
                proposer,
                numOfSwaps: 0,
                fromAssets: [],
                toAssets: [],
                amounts: [],
                slippages: [],
                votesYes,
                votesNo,
                creationTime,
                deadline,
                executed: isExecuted,
                voters,
                swaps_status: swaps_status_bytes,
                merkelRoot,
                fromDecimals: [],
                cid,
              })
            }
          }



          console.log(merkelRoot);


        }
        setMetas(tokens);
        setActiveProposals(activePirposals);
        setPassedProposals(passedPirposals);
        setFailedProposals(failedPirposals);
      } catch (err) {
        console.log(err);
      }
    }, [connection, fund]);

    const fetchTokenMetadata = async (proposals: Proposal[]) => {
      if (!proposals || !metas) {
        fetchedRefNew.current = false;
        return;
      }

      try {
        const filteredMetas = metas.filter((meta) => {
          if (!meta.name || !meta.symbol || !meta.image) {
            return new PublicKey(meta.mint);
          }
        });
        // const filteredMetas = metas;
        const metadataPdas = filteredMetas.map((mint) => {
          const [metadata] = PublicKey.findProgramAddressSync(
            [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), new PublicKey(mint.mint).toBuffer()],
            TOKEN_METADATA_PROGRAM_ID
          );
          return metadata;
        });

        const metadataInfos = await Promise.all(
          metadataPdas.map((pda) => 
            metaplex.nfts().findByMetadata({
              metadata: pda
            }).catch((err) => {
              console.error("Failed to fetch metadat", err);
              return null;
            })
          )
        );

        if (metadataPdas.length !== metadataInfos.length) {
          toast.error("Invalid Information!!");
          return;
        }

        for (let i = 0; i < metadataPdas.length; i++) {
          if (filteredMetas[i].mint === 'So11111111111111111111111111111111111111112' || filteredMetas[i].mint === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
            continue;
          }
          if (!metadataInfos[i]) continue;

          const symbol = metadataInfos[i]?.symbol;
          const uri = metadataInfos[i]?.uri;
          const name = metadataInfos[i]?.name;

          if (!symbol || !name) continue;
          if (uri !== "" && !uri) {
            continue;
          }

          let imageUri = '';
          if (uri !== '') {
              const response = await axios.get(uri);
              if (response) {
                  imageUri = response.data.image;
              }
          }

          filteredMetas[i].name = name;
          filteredMetas[i].symbol = symbol;
          filteredMetas[i].image = imageUri;
        }
        setMetas(filteredMetas);
      } catch (err) {
        console.log(err);
      } 
    }

    const fetchedRef = useRef(false);
    const fetchedRefNew = useRef(false);

    // main useEffect
    useEffect(() => {
      if (fetchedRef.current) return;
      fetchedRef.current = true;
      fetchedProposals();
    }, [fetchedProposals]);

    useEffect(() => {
      if (fetchedRefNew.current || !activeProposals) return;
      fetchedRefNew.current = true;
      fetchTokenMetadata(activeProposals);
    }, [activeProposals]);

    useEffect(() => {
      if (fetchedRefNew.current || !passedProposals) return;
      fetchedRefNew.current = true;
      fetchTokenMetadata(passedProposals);
    }, [passedProposals]);

    useEffect(() => {
      if (fetchedRefNew.current || !failedProposals) return;
      fetchedRefNew.current = true;
      fetchTokenMetadata(failedProposals);
    }, [failedProposals]);

    const fetchRestProposalData = async (proposals: Proposal[], type: boolean) => {
      const modifiedProposals: Proposal[] = [];
      const tokens = metas;
      for ( const proposal of proposals) {
        const cid = proposal.cid;
        const proposalDataUrl = `https://${cid}.ipfs.w3s.link/`;
        const proposalDataResponse = await fetch(proposalDataUrl);
        if (!proposalDataResponse.ok) {
          throw new Error(`Failed to fetch metadata: ${proposalDataResponse.status}`);
        }

        const fetchedProposalData = await proposalDataResponse.json();
        const tags = fetchedProposalData.tags;
        const title = fetchedProposalData.title;
        const description = fetchedProposalData.description;
        const numOfSwaps = fetchedProposalData.swaps.length;
        const fromAssets: string[] = [];
        const toAssets: string[] = [];
        const amounts: number[] = [];
        const slippages: number[] = [];
        const fromDecimals: number[] = [];

        for (const swap of fetchedProposalData.swaps) {
          if (!tokens.some(m => m.mint === swap.fromToken)) {
            let name = '';
            let symbol = '';
            let image = '';
            if (swap.fromToken === 'So11111111111111111111111111111111111111112') {
              name = 'SOL';
              symbol = 'SOL';
              image = SOL;
            } else if (swap.fromToken === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
              name = 'USDC';
              symbol = 'USDC';
              image = USDC;
            }
            tokens.push({
              mint: swap.fromToken,
              name,
              symbol,
              image,
            });
          }
          if (!tokens.some(m => m.mint === swap.toToken)) {
            let name = '';
            let symbol = '';
            let image = '';
            if (swap.toToken === 'So11111111111111111111111111111111111111112') {
              name = 'SOL';
              symbol = 'SOL';
              image = SOL;
            } else if (swap.toToken === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
              name = 'USDC';
              symbol = 'USDC';
              image = USDC;
            }
            tokens.push({
              mint: swap.toToken,
              name,
              symbol,
              image,
            });
          }
          fromAssets.push(swap.fromToken);
          toAssets.push(swap.toToken);
          amounts.push(Number(swap.fromAmount));
          slippages.push(Number(swap.slippage));
          fromDecimals.push(Number(swap.fromDecimals));
        }

        modifiedProposals.push({
          tags,
          title,
          description,
          proposalIndex: fund.currentIndex,
          vecIndex: proposal.vecIndex,
          proposer: proposal.proposer,
          numOfSwaps,
          fromAssets,
          toAssets,
          amounts,
          slippages,
          votesYes: proposal.votesYes,
          votesNo: proposal.votesNo,
          creationTime: proposal.creationTime,
          deadline: proposal.deadline,
          executed: proposal.executed,
          voters: proposal.voters,
          swaps_status: proposal.swaps_status,
          merkelRoot: proposal.merkelRoot,
          fromDecimals,
          cid,
        })
      }
      if (type) {
        setPassedProposals(modifiedProposals);
        setIsPassedFetched(true);
      } else {
        setFailedProposals(modifiedProposals);
        setIsFailedFetched(true);
      }
    }

    const handleFilterChange = async () => {
      console.log('Filter changed to:', filterType);
      if (filterType === 'passed' && !isPassedFetched && passedProposals) {
        fetchRestProposalData(passedProposals, true);
      } else if (filterType === 'failed' && !isFailedFetched && failedProposals) {
        fetchRestProposalData(failedProposals, false);
      }
    };

    useEffect(() => {
      handleFilterChange();
    }, [filterType]);


    useEffect(() => {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setSelectedProposal(null);
        }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }, []);


    useEffect(() => {
      console.log(activeProposals);
      console.log(passedProposals);
      console.log(failedProposals);
    }, [activeProposals, passedProposals, failedProposals]);

    const getStatusColor = (status: string) => {
        switch (status) {
        case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'passed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
        case 'executing': return 'bg-green-500/20 text-green-400 border-green-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
          case 'low-risk': return 'bg-purple-500/20 text-purple-400';
          case 'staking': return 'bg-blue-500/20 text-blue-400';
          case 'profit-making': return 'bg-green-500/20 text-green-400';
          case 'urgent': return 'bg-red-500/20 text-red-400';
          default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getTimeLeft = (deadline: number) => {
        const now = new Date();
        const end = new Date(deadline);
        const diff = end.getTime() - now.getTime();
        
        if (diff <= 0) return 'Expired';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        return `${hours}h`;
    };

    // handle execution of proposals
    const handleExecution = async (proposal: Proposal) => {
      if (!proposal.voters.some(v => v[0].toBase58() === wallet.publicKey?.toBase58())) {
        toast.error(`You can't initiate execution of proposal since you didn't vote`);
        return;
      }

      if (proposal.votesYes <= proposal.votesNo || ((Number(proposal.votesYes) + Number(proposal.votesNo)) / fund.numOfMembers * 100) < 30) {
        toast.error(`Execution can't be executed because of less votes`);
        return;
      }

      try {
        const response = await fetch('https://investment-fund-server-production.up.railway.app/api/init-execution', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fund: fund.name,
            vault: fund.vault.toBase58(),
            fundPubkey: fund.fundPubkey.toBase58(),
            fundType: fund.fundType,
            proposalIndex: proposal.proposalIndex,
            vecIndex: proposal.vecIndex,
            numOfSwaps: proposal.numOfSwaps,
            fromAssets: proposal.fromAssets,
            amounts: proposal.amounts,
            toAssets: proposal.toAssets,
            slippages: proposal.slippages,
          })
        });

        if (!response.ok) {
          throw new Error('Error Initiating or Executing Proposal');
        }

        const data = await response.json();
        console.log(data);

        setExecutionInitiated(false);
        toast.success('Execution Initiated');

        // make immediate changes in proposal
      } catch (err) {
        console.log(err);
        setExecutionInitiated(false);
        toast.error('Execution Initiation Failed');
      }
    }

    const ProposalCard = ({proposal}: {proposal: Proposal}) => {
      const timeLeft = getTimeLeft(Number(proposal.deadline));

      return (
        <motion.div
          layout
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          whileHover={{ y: 0, scale: 1.005 }}
          className="bg-gradient-to-br from-[#1A1C2C] to-[#111324] border border-[#2B2D43] rounded-2xl p-6 transition-all duration-300 hover:shadow-md hover:shadow-purple-500/10 group flex flex-col gap-6 justify-between">
          {/* Title + Status */}
          <div className="flex flex-col justify-between items-start">
              <div className="flex-1 w-full">
                <div className="flex gap-1 mb-2 justify-between items-start w-full">
                    <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition">
                      {proposal.title}
                    </h3>
                    <div className='flex gap-1'>
                      {proposal.tags.length ? (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getCategoryColor(proposal.tags[0])}`}>
                          {proposal.tags[0].replace("-", " ")}
                        </span>
                      ) : (
                        <></>
                      )}
                      <span className={`text-xs font-medium px-3 py-1 border rounded-full ${getStatusColor(proposal.executed === 0 ? "active" : proposal.executed === 1 ? "executing" : "passed")}`}>
                          {proposal.executed === 0 ? "active" : proposal.executed === 1 ? "executing" : "passed"}
                      </span>
                    </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{proposal.description}</p>
              </div>
          </div>

          <div className='flex flex-col gap-4'>
            {/* Voting Progress */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Votes: {fund.members.length}</span>
                  <span>Time left: {timeLeft}</span>
                </div>
                <div 
                  onClick={() => toast.success(`${proposal.votesYes} ${proposal.votesNo}`)}
                  className="relative h-3 bg-[#1C1F36] rounded-full overflow-hidden border border-slate-700/40">
                  <div className="absolute top-0 left-0 h-full bg-green-500/80" style={{ width: `${Number(proposal.votesYes)/fund.members.length * 100}%` }} />
                  <div className="absolute top-0 right-0 h-full bg-red-500/70" style={{ width: `${Number(proposal.votesNo)/fund.members.length * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-green-400">Yes: {Number(proposal.votesYes)} ({(Number(proposal.votesYes)/fund.members.length * 100).toFixed(1)}%)</span>
                  <span className="text-red-400">No: {Number(proposal.votesNo)} ({(Number(proposal.votesNo)/fund.members.length * 100).toFixed(1)}%)</span>
                </div>
            </div>

            {/* CTA Buttons */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 flex gap-2">
                {proposal.voters.some(v => v[0].toBase58() === wallet.publicKey?.toBase58()) ? (
                  <button
                    onClick={() => setSelectedProposal(proposal)}
                    className="flex-1 py-1 rounded-lg bg-gray-600 hover:bg-gray-500/50 transition text-white text-sm shadow cursor-default"
                  >
                    Already Voted
                  </button>
                ) : (
                  proposal.deadline <= Date.now() ? (
                  <button
                    onClick={() => setSelectedProposal(proposal)}
                    className="flex-1 py-1 rounded-lg bg-gray-600 hover:bg-gray-500/50 transition text-white text-sm shadow cursor-default"
                  >
                    Voting Ended
                  </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSelectedProposal(proposal);
                        }}
                        className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 transition text-white text-sm shadow"
                      >
                        Vote Yes
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProposal(proposal);
                        }}
                        className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition text-white text-sm shadow"
                      >
                        Vote No
                      </button>
                    </>
                  )
                )}
              </div>

              <div>
                <button
                  onClick={() => setSelectedProposal(proposal)}
                  className="w-full group bg-purple-500/10 hover:bg-purple-500/20 border border-purple-600/30 rounded-lg py-2 text-sm font-medium text-purple-400 transition-all"
                >
                  Details
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      );
    };


    const ProposalModal = ({ proposal, onClose }: {proposal: Proposal, onClose: () => void}) => {
      if (!proposal) return null;

      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full h-full flex flex-col p-2 gap-2 text-white">
            
            {/* Header */}
            <div className="h-[8%] rounded-xl flex justify-between p-1 items-center border-b border-slate-600 px-4">
              <div className='flex gap-4'>
                <p className="text-3xl font-bold text-slate-100 tracking-wide flex items-center gap-2">
                  📩 {proposal.title}
                </p>
                {proposal.tags.length && (
                  proposal.tags.map((tag) => {
                    return (
                    <span className={`text-sm font-medium px-3 py-2 rounded-full ${getCategoryColor(tag)}`}>
                      {tag.replace("-", " ")}
                    </span>
                    )
                  })
                )}
              </div>
              <button
                onClick={onClose}
                className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 transition rounded-xl text-white border border-slate-500"
              >
                Close
              </button>
            </div>

            {/* Content */}
            <div className="flex h-[92%] gap-2">
              
              {/* Left Section */}
              <div className="w-[55%] border border-slate-700 h-full rounded-xl flex flex-col justify-between bg-slate-900 p-4 relative">
                <div className="overflow-auto pr-2">
                  <p className="text-lg text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {proposal.description}
                  </p>
                </div>

                {/* Voting Stats */}
                <div className="bg-slate-800 p-4 rounded-b-xl absolute bottom-0 left-0 w-full">
                  <p className="text-sm text-slate-400 mb-1 font-semibold">Voting Progress</p>

                  <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden mb-3">
                    <div
                      className="bg-green-500 h-full transition-all duration-300"
                      style={{ width: `${(Number(proposal.votesYes) / fund.numOfMembers) * 100}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-sm font-medium mb-4">
                    <span className="text-green-400">
                      Yes: {(Number(proposal.votesYes) / fund.numOfMembers * 100).toFixed(2)}% ({Number(proposal.votesYes)} votes)
                    </span>
                    <span className="text-red-400">
                      No: {(Number(proposal.votesNo) / fund.numOfMembers * 100).toFixed(2)}% ({Number(proposal.votesNo)} votes)
                    </span>
                  </div>

                  {/* Time Info */}
                  <div className="grid grid-cols-3 gap-4 text-sm text-slate-300 font-medium">
                    <div className="bg-slate-700/60 p-3 rounded-xl flex flex-col items-start gap-1">
                      <p className="text-slate-400 text-xs">🕒 Created</p>
                      <p>{new Date(Number(proposal.creationTime) * 1000).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-700/60 p-3 rounded-xl flex flex-col items-start gap-1">
                      <p className="text-slate-400 text-xs">⏰ Deadline</p>
                      <p>{new Date(Number(proposal.deadline)).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-700/60 p-3 rounded-xl flex flex-col items-start gap-1">
                      <p className="text-slate-400 text-xs">⏳ Voting Ends In</p>
                      <p>
                        {(() => {
                          const now = Date.now();
                          const end = Number(proposal.deadline);
                          const diff = end - now;
                          if (diff <= 0) return 'Ended';
                          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                          return `${days}d ${hours}h ${minutes}m`;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Section */}
              <div className="w-[45%] border border-slate-700 h-full rounded-xl flex flex-col justify-between bg-slate-900 p-4">
                {/* Swaps */}
                <div className="overflow-y-auto space-y-3 h-full scrollbar-none">
                  {proposal.fromAssets.map((fromMint, index) => {
                    const toMint = proposal.toAssets[index];
                    const amount = proposal.amounts[index]/10**proposal.fromDecimals[index];
                    const slippage = proposal.slippages[index]/100;

                    const fromToken = metas.find(m => m.mint === fromMint);
                    const toToken = metas.find(m => m.mint === toMint);

                    if (!fromToken || !toToken) return null;

                    return (
                      <div
                        key={index}
                        className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center justify-between hover:border-slate-500 transition w-full"
                      >
                        {/* From Token */}
                        <div className="flex items-center gap-3">
                          <img src={fromToken.image} alt={fromToken.symbol} className="w-20 h-20 rounded-full" />
                          <div className="text-left">
                            <p className="text-xl font-semibold">{fromToken.symbol}</p>
                            <p className="text-sm text-slate-400">{fromToken.name}</p>
                          </div>
                        </div>

                        {/* Amount & Slippage */}
                        <div className="text-center text-lg text-slate-300">
                          <p>Amount: <span className='font-semibold text-green-400'>{amount} {fromToken.symbol}</span></p>
                          <p className={`text-lg ${slippage > 3 ? 'text-red-400' : slippage < 0.1 ? 'text-yellow-400' : 'text-green-400'}`}>
                            Slippage: {slippage}%
                          </p>
                        </div>

                        {/* To Token */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xl font-semibold">{toToken.symbol}</p>
                            <p className="text-sm text-slate-400">{toToken.name}</p>
                          </div>
                          <img src={toToken.image} alt={toToken.symbol} className="w-20 h-20 rounded-full" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Voting Buttons */}
                <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                  {proposal.executed === 1 ? (
                    <button className="w-full py-2 rounded-xl bg-gray-600 transition text-white font-semibold text-lg shadow cursor-default">
                      Executing...
                    </button>
                  ) : proposal.executed === 2 ? (
                    <button className="w-full py-2 rounded-xl bg-emerald-600 transition text-white font-semibold text-lg shadow cursor-default">
                      Executed
                    </button>
                  ) : (
                    <>
                      {/* DELETE BUTTON */}
                      {proposal.proposer.toBase58() === wallet.publicKey?.toBase58() &&
                        proposal.deadline > Date.now() && (
                          <button
                            onClick={() => {
                              setDeleting(true);
                              handleDeletion();
                            }}
                            disabled={deleting}
                            className={`flex-1 mr-2 py-2 rounded-xl ${
                              deleting
                                ? 'bg-gray-600 hover:bg-gray-500/50 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-500/50 cursor-pointer'
                            } transition text-white font-semibold text-lg shadow`}
                          >
                            {deleting ? 'Deleting...' : 'Delete'}
                          </button>
                        )}

                      {/* VOTING & EXECUTION LOGIC */}
                      {voting ? (
                        <button className="flex-1 py-2 rounded-xl bg-gray-600 hover:bg-gray-500/50 transition text-white font-semibold text-lg shadow cursor-not-allowed">
                          Voting...
                        </button>
                      ) : (
                        (() => {
                          const hasVoted = proposal.voters.some(
                            (v) => v[0].toBase58() === wallet.publicKey?.toBase58()
                          );
                          const deadlinePassed = proposal.deadline <= Date.now();

                          if (deadlinePassed) {
                            if (hasVoted) {
                              return (
                                <>
                                  <button className="flex-1 mr-2 py-2 rounded-xl bg-gray-600 hover:bg-gray-500/50 transition text-white font-semibold text-lg shadow cursor-default">
                                    Already Voted
                                  </button>
                                  <button
                                    onClick={() => {
                                      setExecutionInitiated(true);
                                      handleExecution(proposal);
                                    }}
                                    disabled={executionInitiated}
                                    className={`flex-1 ml-2 py-2 rounded-xl ${
                                      executionInitiated
                                        ? 'bg-gray-600 hover:bg-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-500 cursor-pointer'
                                    } transition text-white font-semibold text-lg shadow`}
                                  >
                                    {executionInitiated ? 'Executing...' : 'Initiate Execution'}
                                  </button>
                                </>
                              );
                            } else {
                              return (
                                <button className="flex-1 py-2 rounded-xl bg-gray-600 hover:bg-gray-500/50 transition text-white font-semibold text-lg shadow cursor-default">
                                  Voting Ended
                                </button>
                              );
                            }
                          } else {
                            if (hasVoted) {
                              return (
                                <button className="flex-1 py-2 rounded-xl bg-gray-600 hover:bg-gray-500/50 transition text-white font-semibold text-lg shadow cursor-default">
                                  Already Voted
                                </button>
                              );
                            } else {
                              return (
                                <>
                                  <button
                                    onClick={() => {
                                      setVoting(true);
                                      voteOnProposal(1, proposal.proposalIndex, proposal.vecIndex, proposal.proposer);
                                    }}
                                    className="flex-1 mr-2 py-2 rounded-xl bg-green-600 hover:bg-green-500 transition text-white font-semibold text-lg shadow"
                                  >
                                    Vote Yes
                                  </button>
                                  <button
                                    onClick={() => {
                                      setVoting(true);
                                      voteOnProposal(0, proposal.proposalIndex, proposal.vecIndex, proposal.proposer);
                                    }}
                                    className="flex-1 ml-2 py-2 rounded-xl bg-red-600 hover:bg-red-500 transition text-white font-semibold text-lg shadow"
                                  >
                                    Vote No
                                  </button>
                                </>
                              );
                            }
                          }
                        })()
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <>
        <div className="p-6 space-y-4 bg-gradient-to-br from-[#0B0E20] via-[#11142A] to-[#0A0C1C] min-h-screen">
          {/* Proposals Grid */}
          
            {activeProposals ? (
              activeProposals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2">
                    {filterType === 'active' ? (
                        activeProposals.map((proposal) => (
                          <ProposalCard key={proposal.creationTime} proposal={proposal} />
                        ))
                    ) : (
                      filterType === 'passed' ? (
                        !passedProposals ? (
                          <div className="w-[75vw] h-[70vh] flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-400" />
                          </div>
                        ) : passedProposals.length === 0 ? (
                          <div className="w-[75vw] h-[70vh] flex items-center justify-center text-slate-400 text-lg">
                            No passed proposals found.
                          </div>
                        ) : passedProposals[0].fromAssets.length === 0 ? (
                          <div className="w-[75vw] h-[70vh] flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-400" />
                          </div>
                        ) : (
                          passedProposals.map((proposal) => (
                            <ProposalCard key={proposal.creationTime} proposal={proposal} />
                          ))
                        )
                      ) : (
                        !failedProposals ? (
                          <div className="w-[75vw] h-[70vh] flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-pink-500" />
                          </div>
                        ) : failedProposals.length === 0 ? (
                          <div className="w-[75vw] h-[70vh] flex items-center justify-center text-slate-400 text-lg">
                            No failed proposals found.
                          </div>
                        ) : failedProposals[0].fromAssets.length === 0 ? (
                          <div className="w-[75vw] h-[70vh] flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-pink-500" />
                          </div>
                        ) : (
                          failedProposals.map((proposal) => (
                            <ProposalCard key={proposal.creationTime} proposal={proposal} />
                          ))
                        )
                      )
                    )}
                </div>              
               ) : (
                <div className='text-slate-400 italic text-xl font-semibold h-[70vh] flex justify-center items-center'>No Active Proposals</div>
              )
            ) : (
              <div className="h-[70vh] flex flex-col gap-3 justify-center items-center">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-purple-500 animate-spin" />
                  {/* <div className="absolute inset-2 rounded-full border-4 border-t-transparent border-purple-300 animate-spin" /> */}
                </div>
                <p>Loading Proposals...</p>
              </div>
            )}
          </div>
       
        {/* Modal */}
        {selectedProposal && (
          <ProposalModal
            proposal={selectedProposal}
            onClose={() => setSelectedProposal(null)}
          />
        )}
      </>
    );
};

export default Proposals;