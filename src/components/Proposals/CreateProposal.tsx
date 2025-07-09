import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  ArrowDownUp,
  ArrowRight,
  ArrowLeft,
  Tag,
  DollarSign,
  ArrowDown,
  ClipboardIcon,
} from "lucide-react";
import { FromToken, LightFund, programId, Token, ToToken } from "../../types";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fetchMintMetadata } from "../../functions/fetchuserTokens";
import { Connection, PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Metaplex, token } from "@metaplex-foundation/js";
import SOL from '../../assets/SOL.jpg';
import USDC from '../../assets/USDC.png';
import { availableTags } from "../../types/tags";
import toast from "react-hot-toast";

interface Swap {
  fromToken: FromToken;
  fromAmount: string;
  toToken: ToToken;
  slippage: string;
}

interface ProposalData {
  title: string;
  description: string;
  swaps: Swap[];
  tags: string[];
  deadline: string;
}

interface CreateProposalProps {
  fund: LightFund;
  connection: Connection;
  metaplex: Metaplex;
}

const CreateProposal = ({
  fund,
  connection,
  metaplex,
}: CreateProposalProps) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [proposalData, setProposalData] = useState<ProposalData>({
    title: "",
    description: "",
    swaps: [],
    tags: [],
    deadline: "",
  });
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const [selectedFromToken, setSelectedFromToken] = useState<FromToken | null>(null);
  const [selectedToToken, setSelectedToToken] = useState<ToToken | null>(null);
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('');
  
  const [toTokenMints, setToTokenMints] = useState<string[]>([]);
  const [toTokens, setToTokens] = useState<ToToken[] | null>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState<boolean>(false);
  const [showToTokensModal, setShowToTokensModal] = useState(false);
  const [showFromTokensModal, setShowFromTokensModal] = useState(false);
  const [search, setSearch] = useState('');
  const [mintExists, setMintExists] = useState<number>(0);
  const [newToken, setNewToken] = useState<ToToken | null>(null);
  const [fromTokens, setFromTokens] = useState<FromToken[]>([]);
  const [expectedFromTokens, setExpectedFromTokens] = useState<FromToken[]>([]);
  const [expectedAmount, setExpectedAmount] = useState(0);

  const [proposal, setProposal] = useState<ProposalData>({
    title: '',
    description: '',
    swaps: [],
    tags: [],
    deadline: ''
  });

  const [swap, setSwap] = useState<Swap>({
  fromToken: {
    mint: "",
    name: "",
    symbol: "",
    image: "",
    balance: 0,
  },
  fromAmount: '',
  toToken: {
    mint: "",
    name: "",
    symbol: "",
    image: "",
    decimals: 0,
    balance: 0,
  },
  slippage: '',
  });

  const [currentSwapIndex, setCurrentSwapIndex] = useState(0);


  const wallet = useWallet();

  // check for valid pubkey
  const isValidPubkey = (input: string) => {
    try {
      new PublicKey(input);
      return true;
    } catch (err) {
      return false;
    }
  };

  // filter tokens based on search parameter
  const filteredTokens = (() => {
    if (isValidPubkey(search)) {
      return toTokens?.filter(token => token.mint === search);
    } else {
      return toTokens?.filter(token => token.symbol.toLowerCase().includes(search.toLowerCase()));
    }
  })();

  // run check everytime when search parameter changes
  useEffect(() => {
    const runCheck = async () => {
      // console.log('running check');
      if (isValidPubkey(search) && filteredTokens?.length === 0) {
        const exists = await checkIfMintExists(search);
        if (!exists) return;
        setMintExists(exists);
        // console.log(`Mint was ${exists === 1 ? 'Wrong' : 'Correct'}`);
        if (exists === 2) {
          await fetchTokenMetas(search);
        }
      } else {
        setMintExists(0);
      }
    };
    runCheck();
  }, [search]);

  // check if search mint account exists
  const checkIfMintExists = async (mint: string) => {
    try {
      const mintInfo = await connection.getAccountInfo(new PublicKey(mint));
      if (!mintInfo) {
        return 1;
      }
      return 2;
    } catch (err) {
      console.log('Error checking mint, ', err);
    }
  }

  // fetch vault tokens
  const fetchVaultTokens = useCallback(async () => {
    try {
      if (!fund || !fund.vault) return;

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        fund.vault,
        { programId: TOKEN_PROGRAM_ID }
      );

      const tokens = tokenAccounts.value
        .map((acc) => {
          const info = acc.account.data.parsed.info;
          const mint = info.mint;
          const balance = info.tokenAmount.uiAmount;
          const decimals = info.tokenAmount.decimals;

          let image = '';
          let name = 'Unknown';
          let symbol = 'UNKNOWN';
          if (mint === 'So11111111111111111111111111111111111111112') {
            image = SOL;
          } else if (mint === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
            image = USDC;
            name = 'USDC';
            symbol = 'USDC';
          }

          // console.log(mint);
          return {
            pubkey: acc.pubkey,
            mint,
            name,
            symbol,
            image,
            balance,
            balance_as_usdc: balance,
            decimals,
          };
        })
        .filter((token) => token.balance > 0);

      const tokensWithMetadata = await Promise.all(
        tokens.map(async (token) => {
          const metadata = await fetchMintMetadata(
            new PublicKey(token.mint),
            metaplex
          );
          return {
            ...token,
            name: metadata?.name || token.name,
            symbol: metadata?.symbol || token.symbol,
            image: metadata?.image || token.image,
          };
        })
      );

      // console.log(tokens);

      setTokens(tokensWithMetadata);

      setFromTokens(tokensWithMetadata.map(({pubkey, ...rest}) => {
        // console.log(pubkey);
        return rest;
      }));

      setSelectedFromToken(
        tokensWithMetadata.length
          ? (({ pubkey, ...rest }) => {
            // console.log(pubkey);
            return rest;
          })(tokensWithMetadata[0])
          : null
      );

      // console.log('DONE FETCHING VAULT TOKENS');
    } catch (err) {
      console.error("Error fetching fund tokens:", err);
      return [];
    }
  }, [connection, metaplex, fund]);

  // fetch mints of to tokens from backend
  const fetchAllToTokenMints = useCallback(async () => {
    try {
      const response = await fetch('https://investment-fund-server-production.up.railway.app/api/token/get-all-tokens');
      if (!response.ok) {
        throw new Error('Failed to fetch tokens');
      }
      const data = await response.json();
      setToTokenMints(data);
      // console.log('DONE FETCHING MINTS FROM DATABASE');
      // console.log(data);
    } catch (err) {
      console.error('Error fetching tokens:', err);
      toast.error('Failed to fetch tokens');
    }
  }, []);

  useEffect(() => {
    fetchToTokens();
  }, [toTokenMints]);

  // when to tokens change, reset the selected one to index 0
  useEffect(() => {
    if (!toTokens || toTokens.length === 0) return;
    setSelectedToToken(toTokens.length ? toTokens[0] : null);
  }, [toTokens]);

  // fetch to tokens with metadata
  const fetchToTokens = async () => {
    // console.log('Trying to fetch metadatas');
    // console.log(toTokenMints);
    if (!toTokenMints || toTokenMints.length === 0) return;
    try {
      const toTokenss = toTokenMints.map((toTokenMint) => {

        let image = '';
        let name = 'Unknown';
        let symbol = 'UNKNOWN';
        if (toTokenMint === 'So11111111111111111111111111111111111111112') {
          image = SOL;
        } else if (toTokenMint === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
          image = USDC;
          name = 'USDC';
          symbol = 'USDC';
        }

        return {
          mint: toTokenMint,
          name,
          symbol,
          image,
          decimals: 0,
          balance: 0,
        };
      });

      const toTokensWithMetadata = await Promise.all(
        toTokenss.map(async (toToken) => {
          const metadata = await fetchMintMetadata(new PublicKey(toToken.mint), metaplex);
          return {
            ...toToken,
            name: metadata?.name || toToken.name,
            symbol: metadata?.symbol || toToken.symbol,
            image: metadata?.image || toToken.image,
          }
        })
      );

      setToTokens(toTokensWithMetadata);
      // console.log('DONE FETCHING TO TOKENS METADATA');
      // console.log('To Tokens:', toTokens);

    } catch (err) {
      console.log(err);
    }
  };

  // fetch metadata for newly entered mint account
  const fetchTokenMetas = async (mint: string) => {

    let image = '';
    let name = 'Unknown';
    let symbol = 'UNKNOWN';
    if (mint === 'So11111111111111111111111111111111111111112') {
      image = SOL;
    } else if (mint === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
      image = USDC;
      name = 'USDC';
      symbol = 'USDC';
    }

    let toToken = {
      mint,
      name,
      symbol,
      image,
      decimals: 0,
      balance: 0,
    };

    const tukenMetadata = await fetchMintMetadata(new PublicKey(mint), metaplex);
    toToken = {
      ...toToken,
      name: tukenMetadata?.name || toToken.name,
      symbol: tukenMetadata?.symbol || toToken.symbol,
      image: tukenMetadata?.image || toToken.image,
    };

    setNewToken(toToken);
  }



  const handleInputChange = (field: keyof ProposalData, value: string) => {
    setProposalData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSwapChange = (updatedFields: Partial<Swap>) => {
    setSwap((prev) => {
      return {...prev, ...updatedFields}
    });
  };





  const fetchExpectedPrice = async (inputMint: string, outputMint: string, inputDecimals: number, outputDecimals: number, val: string) => {
    const solMint = new PublicKey('So11111111111111111111111111111111111111112');
    const programId = new PublicKey('devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH');
    const dataSize = 1544;

    if (inputMint === solMint.toBase58()) {
      const accounts = await connection.getProgramAccounts(programId, {
          filters: [
              {dataSize},
              {
                  memcmp: {
                      offset: 73,
                      bytes: solMint.toBase58()
                  },
              },
              {
                  memcmp: {
                      offset: 105,
                      bytes: outputMint
                  },
              },
          ],
          dataSlice: {offset: 0, length: 0},
          commitment: 'confirmed',
      });

      if (accounts.length === 0) {
        return;
      }

      console.log(accounts.length);

      let bestAmount = 0;

      for (const acc of accounts) {
        const accInfo = await connection.getAccountInfo(acc.pubkey, 'confirmed');
        if (!accInfo) continue;
        const buffer = Buffer.from(accInfo.data);
        const rawSqrtPrice = buffer.readBigUInt64LE(253) + (buffer.readBigUInt64LE(261) << 64n);
        const sqrtPrice = Number(rawSqrtPrice)/(Number(1n << 64n));
        const expectedPrice = (sqrtPrice**2)*1000;
        const expectedAmount = (expectedPrice*(Number(val)));
        bestAmount = expectedAmount > bestAmount ? expectedAmount : bestAmount;
        console.log(expectedAmount);
        console.log(`Amount: ${val}`);
      }
      setExpectedAmount(bestAmount);
    } else if (outputMint === solMint.toBase58()) {
      const accounts = await connection.getProgramAccounts(programId, {
          filters: [
              {dataSize},
              {
                  memcmp: {
                      offset: 73,
                      bytes: solMint.toBase58()
                  },
              },
              {
                  memcmp: {
                      offset: 105,
                      bytes: inputMint
                  },
              },
          ],
          dataSlice: {offset: 0, length: 0},
          commitment: 'confirmed',
      });

      if (accounts.length === 0) {
        return;
      }
      
      console.log(accounts.length);

      let bestAmount = 0;
      
      for (const acc of accounts) {
        const accInfo = await connection.getAccountInfo(acc.pubkey, 'confirmed');
        if (!accInfo) continue;
        const buffer = Buffer.from(accInfo.data);
        const rawSqrtPrice = buffer.readBigUInt64LE(253) + (buffer.readBigUInt64LE(261) << 64n);
        const sqrtPrice = Number(rawSqrtPrice)/(Number(1n << 64n));
        const expectedPrice = (sqrtPrice**2)*1000;
        const expectedAmount = (Number(val)/expectedPrice);
        bestAmount = expectedAmount > bestAmount ? expectedAmount : bestAmount;
        console.log(expectedAmount);
        console.log(`Amount: ${val}`);
      }
      setExpectedAmount(bestAmount);
    } else {
      const inputAccounts = await connection.getProgramAccounts(programId, {
          filters: [
              {dataSize},
              {
                  memcmp: {
                      offset: 73,
                      bytes: solMint.toBase58()
                  },
              },
              {
                  memcmp: {
                      offset: 105,
                      bytes: inputMint
                  },
              },
          ],
          dataSlice: {offset: 0, length: 0},
          commitment: 'confirmed',
      });

      if (inputAccounts.length === 0) {
        return;
      }
      
      console.log(inputAccounts.length);

      let bestInputPrice = 0;
      
      for (const acc of inputAccounts) {
        const accInfo = await connection.getAccountInfo(acc.pubkey, 'confirmed');
        if (!accInfo) continue;
        const buffer = Buffer.from(accInfo.data);
        const rawSqrtPrice = buffer.readBigUInt64LE(253) + (buffer.readBigUInt64LE(261) << 64n);
        const sqrtPrice = Number(rawSqrtPrice)/(Number(1n << 64n));
        const inputExpectedPrice = (sqrtPrice**2)*1000;
        // const expectedAmount = (Number(val)/inputExpectedPrice);
        bestInputPrice = inputExpectedPrice > bestInputPrice ? inputExpectedPrice : bestInputPrice;
        console.log(bestInputPrice);
        console.log(`Amount: ${val}`);
      }

//-----------------------------------------------------------------------------------------------------------------//

      const outputAccounts = await connection.getProgramAccounts(programId, {
          filters: [
              {dataSize},
              {
                  memcmp: {
                      offset: 73,
                      bytes: solMint.toBase58()
                  },
              },
              {
                  memcmp: {
                      offset: 105,
                      bytes: inputMint
                  },
              },
          ],
          dataSlice: {offset: 0, length: 0},
          commitment: 'confirmed',
      });

      if (outputAccounts.length === 0) {
        return;
      }
      
      console.log(outputAccounts.length);

      let bestOutputPrice = 0;
      
      for (const acc of outputAccounts) {
        const accInfo = await connection.getAccountInfo(acc.pubkey, 'confirmed');
        if (!accInfo) continue;
        const buffer = Buffer.from(accInfo.data);
        const rawSqrtPrice = buffer.readBigUInt64LE(253) + (buffer.readBigUInt64LE(261) << 64n);
        const sqrtPrice = Number(rawSqrtPrice)/(Number(1n << 64n));
        const outputExpectedPrice = (sqrtPrice**2)*1000;
        // const expectedAmount = (Number(val)/outputExpectedPrice);
        bestOutputPrice = outputExpectedPrice > bestOutputPrice ? outputExpectedPrice : bestOutputPrice;
        console.log(bestOutputPrice);
        console.log(`Amount: ${val}`);
      }

      const expectedAmount = (bestInputPrice/bestOutputPrice)*Number(val);
      setExpectedAmount(expectedAmount);
    }
  }






  const addSwap = () => {
    if ( !swap ||!swap.toToken ||
        !swap.fromToken ||
        swap.toToken.mint === swap.fromToken.mint || 
        Number(slippage) >= 100 || 
        Number(swap.fromAmount) > swap.fromToken?.balance || 
        !swap.fromAmount ||
        !swap.slippage) {
      console.log("Invalid Swap");
      return;
    }

    console.log(currentSwapIndex);
    setCurrentSwapIndex(currentSwapIndex + 1);
    setAmount("");
    setSlippage("");
    setExpectedAmount(0);

    let frmTokens: FromToken[] = fromTokens;
    let exptdTokens: FromToken[] = expectedFromTokens;

    const A = swap.fromToken;
    const B = swap.toToken;

    const A_in_from = fromTokens.some(t => t.mint === A.mint);
    const B_in_from = fromTokens.some(t => t.mint === B.mint);
    const A_in_expected = expectedFromTokens.some(t => t.mint === A.mint);
    const B_in_expected = expectedFromTokens.some(t => t.mint === B.mint);

    // === CASE 1: A and B both in fromTokens ===
    if (A_in_from && B_in_from) {
      frmTokens = fromTokens.map(token => {
        if (token.mint === A.mint) {
          token.balance -= Number(swap.fromAmount);
        }
        return token;
      });

      exptdTokens.push({
        mint: B.mint,
        name: B.name,
        symbol: B.symbol,
        image: B.image,
        balance: expectedAmount + frmTokens.filter(token => token.mint === B.mint)[0].balance,
      });

      frmTokens = frmTokens.filter(token => token.mint !== B.mint); // remove B from fromTokens
    }

    // === CASE 2: A in fromTokens, B in expectedFromTokens ===
    else if (A_in_from && B_in_expected) {
      frmTokens = fromTokens.map(token => {
        if (token.mint === A.mint) {
          token.balance -= Number(swap.fromAmount);
        }
        return token;
      });

      exptdTokens = expectedFromTokens.map(token => {
        if (token.mint === B.mint) {
          token.balance += expectedAmount;
        }
        return token;
      });
    }

    // === CASE 3: A in expectedFromTokens, B in fromTokens ===
    else if (A_in_expected && B_in_from) {
      exptdTokens = expectedFromTokens.map(token => {
        if (token.mint === A.mint) {
          token.balance -= (Number(swap.fromAmount) * token.balance) / 100;
        }
        return token;
      });

      exptdTokens.push({
        mint: B.mint,
        name: B.name,
        symbol: B.symbol,
        image: B.image,
        balance: expectedAmount + frmTokens.filter(token => token.mint === B.mint)[0].balance,
      });

      frmTokens = frmTokens.filter(token => token.mint !== B.mint); // remove B from fromTokens
    }

    // === CASE 4: A and B both in expectedFromTokens ===
    else if (A_in_expected && B_in_expected) {
      exptdTokens = expectedFromTokens.map(token => {
        if (token.mint === A.mint) {
          token.balance -= (Number(swap.fromAmount) * token.balance) / 100;
        }
        if (token.mint === B.mint) {
          token.balance += expectedAmount;
        }
        return token;
      });
    }

    setFromTokens(frmTokens);
    setExpectedFromTokens(exptdTokens);


    setProposalData((prev) => ({
      ...prev,
      swaps: [
        ...prev.swaps,
        { fromToken: swap.fromToken, fromAmount: "", toToken: swap.toToken, slippage: "0.5" },
      ],
    }));
    // also handle the modifications in the from tokens and expected tokens lists and their balances ****

  };

  // const removeSwap = (index: number) => {
  //   if (proposalData.swaps.length > 1) {
  //     const updatedSwaps = proposalData.swaps.filter((_, i) => i !== index);
  //     setProposalData((prev) => ({
  //       ...prev,
  //       swaps: updatedSwaps,
  //     }));
  //   }
  // };

  const addTag = (tag: string) => {
    if (!proposalData.tags.includes(tag)) {
      setProposalData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
    }
    setIsTagDropdownOpen(false);
  };

  const removeTag = (tagToRemove: string) => {
    setProposalData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // const handleSubmit = () => {
  //   console.log("Proposal Created:", proposalData);
  //   alert("Proposal created successfully!");
  //   setCurrentStep(1);
  //   setProposalData({
  //     title: "",
  //     description: "",
  //     swaps: [{ fromToken: , fromAmount: "", toToken: "", slippage: "0.5" }],
  //     tags: [],
  //     deadline: "",
  //   });
  //   setIsTagDropdownOpen(false);
  // };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return proposalData.title.trim() && proposalData.description.trim()
          ? true
          : false;
      // case 2:
      //   return proposalData.swaps.every(
      //     (swap) =>
      //       swap.fromToken.trim() &&
      //       swap.fromAmount.trim() &&
      //       swap.toToken.trim()
      //   );
      case 3:
        return !!proposalData.deadline;
      default:
        return false;
    }
  };

  // add mew mint to database
  const addToken = async () => {
    if (!newToken) return;
    try {
      const response = await fetch('https://investment-fund-server-production.up.railway.app/api/token/add-new-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mint: newToken.mint }),
      });

      if (!response.ok) {
        throw new Error('Failed to add token');
      }

      const data = await response.json();
      toast.success('Token added successfully 🎉');
      console.log('Added token:', data);

      const currentToTokenMints = toTokenMints;
      currentToTokenMints.push(newToken.mint);
      setToTokenMints(currentToTokenMints);

      if (toTokens) {
        const currentToTokens = toTokens;
        currentToTokens?.push(newToken);
        setToTokens(currentToTokens);
      }

      setSearch('');
      // Optionally refresh token list or close modal here
    } catch (err) {
      console.error('Error adding token:', err);
      toast.error('Failed to add token 😔');
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFromTokensModal(false);
        setShowToTokensModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const fetchActiveProposals = useCallback(async () => {
    if (!fund) return;

    try {
      const currentAggregatorIndex = fund.currentIndex;
      const [currentAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('proposal-aggregator'), Buffer.from([currentAggregatorIndex]), fund.fundPubkey.toBuffer()],
        programId
      );

      const currentAggregatorInfo = await connection.getAccountInfo(currentAggregatorPda);
      if (!currentAggregatorInfo) return;

      const currentAggregatorBuffer = Buffer.from(currentAggregatorInfo.data);

      const numOfProposals = currentAggregatorBuffer.readUint32LE(1);
      let offset = 5;
      for (let i=0; i<numOfProposals; i++) {
        const isExecuted = currentAggregatorBuffer.readUInt8(offset + 123) ? true : false;
        if (!isExecuted) {
          const cid = currentAggregatorBuffer.slice(offset + 32, offset + 91).toString();
          // fetch proposal from tokens, and their amounts, and accordingly deduct that amount from the fromTokens
        }
        const numOfVoters = currentAggregatorBuffer.readUInt32LE(offset + 126);
        offset += (130 + (numOfVoters * 5));
      }
    } catch (err) {
      console.log(err);
    }
  }, [connection, fund]);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchVaultTokens();
    fetchAllToTokenMints();
    fetchActiveProposals();
  }, [fetchVaultTokens, fetchAllToTokenMints, fetchActiveProposals]);



  useEffect(() => {
    if (selectedFromToken) {
      handleSwapChange({ fromToken: selectedFromToken });
    }
  }, [selectedFromToken]);

  useEffect(() => {
    if (selectedToToken) {
      handleSwapChange({ toToken: selectedToToken });
    }
  }, [selectedToToken]);

  useEffect(() => {
    handleSwapChange({ fromAmount: amount });
  }, [amount]);

  useEffect(() => {
    handleSwapChange({ slippage });
  }, [slippage]);

  return (
    <>
      <div className="min-h-screen bg-slate-900 p-4">
        <div className=" mx-auto">
          {/* Proposals Section */}
          <div className="bg-slate-800 rounded-xl p-2 mb-8">
            <div className="bg-slate-900 rounded-xl p-6 w-full">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Create Proposal</h2>
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">
                    Step {currentStep} of 3
                  </span>
                  <span className="text-sm text-gray-400">
                    {currentStep === 1
                      ? "Basic Info"
                      : currentStep === 2
                      ? "Swaps"
                      : "Details"}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                  />
                </div>
              </div>

              {/* Step Content */}
              <div className="space-y-6">
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white mb-4">
                      Basic Information
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Proposal Title *{" "}
                        <span className="text-xs text-violet-300">
                          (Max 50 characters)
                        </span>
                      </label>
                      <input
                        maxLength={50}
                        type="text"
                        value={proposalData.title}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleInputChange("title", e.target.value)
                        }
                        className="w-full bg-slate-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                        placeholder="Enter proposal title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Description *{" "}
                        <span className="text-xs text-violet-300">
                          (Max 100 characters)
                        </span>
                      </label>
                      <textarea
                        maxLength={100}
                        value={proposalData.description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          handleInputChange("description", e.target.value)
                        }
                        rows={4}
                        className="w-full bg-slate-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                        placeholder="Describe your proposal in detail"
                      />
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-semibold text-white">
                        Token Swaps
                      </h3>
                      {/* <button
                        onClick={addSwap}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <Plus size={16} />
                        Add Swap
                      </button> */}
                    </div>

                    <div className="min-h-[330px] flex gap-2">
                      <div className="w-[49%] p-3 rounded-3xl bg-slate-800/50 backdrop-blur-lg shadow-inner">
                        <div className="h-full flex flex-col">

                          {/* From Tokens Area */}
                          <div className="h-[40%] rounded-3xl flex flex-col justify-end bg-slate-800">
                            {tokens && tokens.length > 0 && selectedFromToken ? (
                              <div className="mx-5 h-[19.5%] text-xs flex justify-between">
                                <p className="flex justify-center items-center">From Token</p>
                                <div className="flex justify-between items-center gap-2">
                                  {amount && selectedFromToken && parseFloat(amount) > selectedFromToken.balance && (
                                    <p className="text-red-500 text-sm mb-1">🚫 Insufficient balance</p>
                                  )}
                                  <div className="flex items-center gap-1 mb-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                    Balance: {selectedFromToken.balance}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setAmount(selectedFromToken.balance.toString())}
                                      className="text-xs bg-gray-700 text-gray-300 px-2 mb-1 rounded hover:bg-gray-600 transition"
                                    >
                                      Max
                                    </button>
                                    <button
                                      onClick={() => setAmount((selectedFromToken.balance * 0.5).toFixed(6))}
                                      className="text-xs bg-gray-700 text-gray-300 px-2 mb-1 rounded hover:bg-gray-600 transition"
                                    >
                                      50%
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mx-5 h-[19.5%] flex justify-between text-xs">
                                <div className="flex justify-center items-center">
                                  From Token
                                </div>
                                <div className="flex justify-between items-center text-xs gap-2 text-white px-1 min-h-[24px] animate-pulse">
                                  {/* Left: Icon + Gray Line */}
                                  <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 bg-gray-700 rounded" />
                                    <div className="h-3 w-28 bg-gray-700 rounded" />
                                  </div>

                                  {/* Right: Fake Buttons */}
                                  <div className="flex gap-2">
                                    <div className="h-[18px] w-10 bg-gray-700 rounded mb-1" />
                                    <div className="h-[18px] w-10 bg-gray-700 rounded" />
                                  </div>
                                </div>
                              </div>
                            )}
                            {tokens && (
                              <div className="bg-[#0f161f] h-[77%] rounded-3xl p-3 flex">
                                <div
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setShowFromTokensModal(true);
                                  }} 
                                  className="flex items-center justify-start px-2 gap-1 py-2 bg-[#2c3a4e] rounded-2xl cursor-pointer w-[35%] h-full">
                                  <div className="w-10 h-10 bg-gray-600 rounded-full">
                                    {selectedFromToken ? (
                                      <div className="w-10 h-10 bg-gray-600 rounded-full">
                                        {selectedFromToken?.image ? (
                                          <img src={selectedFromToken.image} alt="token" className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                          <div className="w-full h-full bg-gray-600 rounded-full" />
                                        )}
                                      </div>
                                    ) : (
                                      <div className="w-full h-full bg-gray-600 rounded-full" />
                                    )}
                                  </div>
                                  {selectedFromToken && (
                                    <p className="text-xl ml-2" onClick={(e) => {
                                      e.preventDefault();
                                      console.log("Selected From Token:", selectedFromToken);
                                    }}>{selectedFromToken.symbol}</p>
                                  )}
                                </div>
                                {selectedFromToken && selectedToToken && (
                                  <input
                                    type="text"
                                    value={amount}
                                    onChange={(e) => {
                                      let val = e.target.value;

                                      if (!/^\d*\.?\d*$/.test(val)) return;

                                      const decimals = selectedFromToken?.decimals ?? 0;
                                      if (val.includes('.')) {
                                        const [intPart, decimalPart] = val.split('.');
                                        if (decimalPart.length > decimals) {
                                          val = `${intPart}.${decimalPart.slice(0, decimals)}`;
                                        }
                                      }

                                      if (val === "") {
                                        setAmount("")
                                      } else {
                                        setAmount(val);
                                      }
                                      fetchExpectedPrice(selectedFromToken?.mint, selectedToToken?.mint, 9, 6, val)
                                      console.log(val);
                                    }}
                                    placeholder="Enter Amount"
                                    className="flex-1 text-right px-4 py-3 text-4xl bg-transparent outline-none placeholder:text-2xl placeholder-slate-700 w-[65%]"
                                  />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Direction Button */}
                          <div
                            className="h-4 w-full flex justify-center items-center"
                          >
                            <div
                              className={`z-10 rounded-full w-10 h-10 bg-blue-300 p-2 cursor-pointer transition-shadow duration-300 ${
                                isHovered ? "scale-105  " : ""
                              }`}
                              onMouseEnter={() => setIsHovered(true)}
                              onMouseLeave={() => setIsHovered(false)}
                            >
                              {isHovered ? (
                                <ArrowDownUp className="w-full h-full text-black transition-all duration-200" />
                              ) : (
                                <ArrowDown className="w-full h-full text-black transition-all duration-200" />
                              )}
                            </div>
                          </div>
                          
                          {/* To Tokens + Slippage Area */}
                          <div className="h-[40%] rounded-3xl flex flex-col justify-end bg-slate-800">
                            {tokens && tokens.length > 0 && selectedToToken ? (
                              <div className="mx-5 h-[19.5%] text-xs flex justify-between">
                                <p className="flex justify-center items-center">To Token</p>
                                <div className="flex justify-between items-center gap-2">
                                </div>
                              </div>
                            ) : (
                              <div className="mx-5 h-[19.5%] flex justify-between text-xs">
                                <div className="flex justify-center items-center">
                                  To Token
                                </div>
                                <div className="flex justify-between items-center text-xs gap-2 text-white px-1 min-h-[24px] animate-pulse">
                                  {/* Left: Icon + Gray Line */}
                                  <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 bg-gray-700 rounded" />
                                    <div className="h-3 w-28 bg-gray-700 rounded" />
                                  </div>

                                  {/* Right: Fake Buttons */}
                                  <div className="flex gap-2">
                                    <div className="h-[18px] w-10 bg-gray-700 rounded mb-1" />
                                    <div className="h-[18px] w-10 bg-gray-700 rounded" />
                                  </div>
                                </div>
                              </div>
                            )}
                            {tokens && (
                              <div className="bg-[#0f161f] h-[77%] rounded-3xl p-3 flex">
                                <div
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setShowToTokensModal(true);
                                  }} 
                                  className="flex items-center justify-start px-2 gap-1 py-2 bg-[#2c3a4e] rounded-2xl cursor-pointer w-[35%] h-full">
                                  <div className="w-10 h-10 bg-gray-600 rounded-full">
                                    {selectedToToken ? (
                                      <div className="w-10 h-10 bg-gray-600 rounded-full">
                                        {selectedToToken?.image ? (
                                          <img src={selectedToToken.image} alt="token" className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                          <div className="w-full h-full bg-gray-600 rounded-full" />
                                        )}
                                      </div>
                                    ) : (
                                      <div className="w-full h-full bg-gray-600 rounded-full" />
                                    )}
                                  </div>
                                  {selectedToToken && (
                                    <p className="text-xl ml-2" onClick={(e) => {
                                      e.preventDefault();
                                      console.log("Selected From Token:", selectedToToken);
                                    }}>{selectedToToken.symbol}</p>
                                  )}
                                </div>
                                <div className="w-[65%] text-4xl px-4 py-3 text-right flex-1 justify-items-end">
                                  {expectedAmount ? (
                                    <>{expectedAmount.toFixed(3)}</>
                                  ) : (
                                    <div className="w-[50%] h-10 bg-gray-800/40 animate-pulse rounded-md" />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="mt-4 h-12 flex justify-between items-center gap-2">
                            {/* Slippage Section */}
                            <div className="w-[61%] h-full px-4 flex items-center border border-gray-900 rounded-lg bg-gray-800 shadow-sm">
                              <input
                                type="text"
                                step="0.1"
                                min="0"
                                max="100"
                                placeholder="Slippage"
                                value={slippage}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!/^\d*\.?\d*$/.test(val)) return;
                                  setSlippage(val);
                                }}
                                className="w-full outline-none bg-transparent text-sm font-medium text-white placeholder-gray-400"
                              />
                            </div>
                            {/* Add Button Section */}
                            <div className="w-[35%] h-full">
                              <button 
                                onClick={() => addSwap()}
                                className="w-full h-full bg-black text-white font-semibold text-sm rounded-lg hover:bg-gray-800 transition duration-200">
                                Add
                              </button>
                            </div>
                          </div>
                          
                            {/* Add Button */}
                            {/* <div className="w-[20%] h-[50%]">
                              <button
                                onClick={() => {
                                  addSwap();
                                }}
                                className="w-full h-full border border-emerald-500 rounded-full flex items-center justify-center gap-2 text-sm font-semibold text-emerald-300 bg-slate-900/60 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all duration-300 shadow-inner shadow-emerald-500/10 backdrop-blur-md group"
                              >
                                Add
                                <span className="transform transition-transform duration-300 group-hover:translate-x-1 group-hover:text-emerald-400">
                                  <ArrowRight className="w-4 h-4" />
                                </span>
                              </button>
                            </div> */}
                          </div>

                        </div>
                      </div>
                      <div className=" w-[49%]"></div>

                    {/* {proposalData.swaps.map((swap, index) => (
                      <div
                        key={index}
                        className="bg-slate-800 rounded-lg p-4 space-y-4"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300 font-medium">
                            Swap {index + 1}
                          </span>
                          {proposalData.swaps.length > 1 && (
                            <button
                              onClick={() => removeSwap(index)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              From Token *
                            </label>
                            <input
                              type="text"
                              value={swap.fromToken}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                              ) =>
                                handleSwapChange(
                                  index,
                                  "fromToken",
                                  e.target.value
                                )
                              }
                              className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                              placeholder="e.g., USDC"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Amount *
                            </label>
                            <input
                              type="number"
                              value={swap.fromAmount}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                              ) =>
                                handleSwapChange(
                                  index,
                                  "fromAmount",
                                  e.target.value
                                )
                              }
                              className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              To Token *
                            </label>
                            <input
                              type="text"
                              value={swap.toToken}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                              ) =>
                                handleSwapChange(index, "toToken", e.target.value)
                              }
                              className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                              placeholder="e.g., ETH"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Slippage (%)
                            </label>
                            <input
                              type="number"
                              value={swap.slippage}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                              ) =>
                                handleSwapChange(
                                  index,
                                  "slippage",
                                  e.target.value
                                )
                              }
                              className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                              placeholder="0.5"
                              step="0.1"
                            />
                          </div>
                        </div>
                      </div>
                    ))} */}
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white mb-4">
                      Final Details
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Tags
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                          className="w-full bg-slate-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-left focus:outline-none focus:border-purple-500 flex items-center justify-between"
                        >
                          <span className="text-gray-400">
                            Select tags for your proposal
                          </span>
                          <Tag size={16} className="text-gray-400" />
                        </button>
                        {isTagDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-gray-600 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                            {availableTags
                              .filter((tag) => !proposalData.tags.includes(tag))
                              .map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => addTag(tag)}
                                  className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors"
                                >
                                  {tag}
                                </button>
                              ))}
                            {availableTags.filter(
                              (tag) => !proposalData.tags.includes(tag)
                            ).length === 0 && (
                              <div className="px-4 py-2 text-gray-400">
                                All tags selected
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {proposalData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {proposalData.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
                            >
                              {tag}
                              <button
                                onClick={() => removeTag(tag)}
                                className="text-purple-200 hover:text-white"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Proposal Deadline *
                      </label>
                      <input
                        type="datetime-local"
                        value={proposalData.deadline}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleInputChange("deadline", e.target.value)
                        }
                        className="w-full bg-slate-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-700">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    currentStep === 1
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  }`}
                >
                  <ArrowLeft size={16} />
                  Previous
                </button>
                <div className="flex gap-3">
                  {currentStep < 3 ? (
                    <button
                      onClick={handleNext}
                      disabled={!canProceed()}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                        canProceed()
                          ? "bg-purple-600 hover:bg-purple-700 text-white"
                          : "bg-gray-700 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Next
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      // onClick={handleSubmit}
                      disabled={!canProceed()}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                        canProceed()
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-gray-700 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Create Proposal
                      <DollarSign size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showToTokensModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111827] w-[460px] max-h-[90vh] rounded-2xl p-6 text-white overflow-hidden shadow-2xl relative animate-fadeIn">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Select a token</h2>
              <button onClick={() => {
                setShowToTokensModal(false);
                setSearch('');
              }} className="text-gray-400 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="bg-[#1F2937] rounded-xl px-4 py-3 flex items-center gap-2 mb-4">
              <input
                type="text"
                placeholder="Search by token or paste address"
                className="bg-transparent text-white placeholder-gray-400 w-full focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M16 11a5 5 0 11-10 0 5 5 0 0110 0z" />
              </svg>
            </div>

            {/* Token List */}
            <div className="overflow-y-auto max-h-[300px] space-y-2 pr-1 scrollbar-none">
                {filteredTokens && filteredTokens.length > 0 ? (
                  filteredTokens.map((token) => (
                    <div
                      onClick={() => {
                        setSelectedToToken(token);
                        if (token?.mint === selectedFromToken?.mint) {
                          setSelectedFromToken(null);
                        }
                        setShowToTokensModal(false);
                        setSearch('');
                      }}
                      key={token.mint}
                      className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-gray-700/30 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <img src={token.image} alt={token.symbol} className="w-8 h-8 rounded-full" />
                        <div>
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-sm text-gray-400">{token.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 max-w-[120px] truncate">
                          {token.mint.slice(0, 4)}...{token.mint.slice(-4)}
                        </span>
                        <ClipboardIcon
                          onClick={() => navigator.clipboard.writeText(token.mint)}
                          className="w-4 h-4 text-gray-400 hover:text-white cursor-pointer"
                        />
                      </div>
                    </div>
                  ))
                ) : isValidPubkey(search) ? (
                  mintExists === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-6">Checking token mint...</div>
                  ) : mintExists === 2 ? (
                    newToken ? (
                      <div className="flex items-center justify-between gap-4 bg-gray-800/50 px-4 py-3 rounded-xl mt-4">
                        
                        <img src={newToken.image} alt={newToken.symbol} className="w-12 h-12 rounded-full" />
                        
                        <div className="flex flex-col text-left flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold text-base">{newToken.symbol}</span>
                            <span className="text-sm text-gray-400">({newToken.name})</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{newToken.mint.slice(0, 6)}...{newToken.mint.slice(-6)}</span>
                            <ClipboardIcon
                              onClick={() => navigator.clipboard.writeText(newToken.mint)}
                              className="w-4 h-4 text-gray-400 hover:text-white cursor-pointer"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => addToken()}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition text-white text-sm font-medium shadow-sm">
                          Add Token
                        </button>
                      </div>
                    ) : (
                      <div className="text-center text-green-400 text-sm py-6">This token exists ✅</div>
                    )
                  ) : (
                    <div className="text-center text-gray-400 text-sm py-6">No tokens found for this mint.</div>
                  )
                ) : (
                  <div className="text-center text-gray-400 text-sm py-6">No tokens found.</div>
                )}
            </div>

            {/* Note */}
            <div className="mt-4 bg-gray-800/50 text-sm text-gray-400 rounded-xl px-4 py-3">
              Can’t find the token you’re looking for? Try entering the mint address.
            </div>
          </div>
        </div>
      )}
      {showFromTokensModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111827] min-h-[50vh] rounded-2xl p-4 py-6 text-white overflow-hidden shadow-2xl relative flex flex-col animate-fadeIn">

            {/* Header */}
            <div className="flex justify-between items-center mb-6 ml-2">
              <h2 className="text-lg font-semibold">Token Overview</h2>
              <button onClick={() => setShowFromTokensModal(false)} className="text-gray-400 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Dual Columns */}
            <div className="grid grid-cols-2 gap-3 h-[40vh]">
              
              {/* Left: Current Tokens */}
              <div className="bg-[#1F2937] rounded-2xl p-3 h-[41vh] scrollbar-thin">
                <h3 className="text-base font-semibold mb-4 ml-4">Current Tokens</h3>
                <div className="max-h-[360px] space-y-3 pr-1 overflow-y-auto h-[85%] scrollbar-none">
                  {fromTokens && fromTokens.length > 0 ? (
                    fromTokens.map((token) => (
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedFromToken(token);
                          if (token?.mint === selectedToToken?.mint) {
                            setSelectedToToken(null);
                          }
                          setShowFromTokensModal(false);
                        }}
                        key={token.mint}
                        className="flex justify-between items-center px-2 py-2 rounded-lg gap-10 hover:bg-gray-700/30 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <img src={token.image} alt={token.symbol} className="w-8 h-8 rounded-full" />
                          <div>
                            <div className="font-medium">{token.symbol}</div>
                            <div className="text-sm text-gray-400">{token.name}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          <span className="text-xs text-emerald-400 font-medium">Balance: {token.balance} </span>
                          <div className="flex items-center gap-2 text-gray-400">
                            <span className="text-sm max-w-[120px] truncate">
                              {token.mint.slice(0, 4)}...{token.mint.slice(-4)}
                            </span>
                            <ClipboardIcon
                              onClick={() => navigator.clipboard.writeText(token.mint)}
                              className="w-4 h-4 hover:text-white cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-400 text-sm py-6">No current tokens found.</div>
                  )}
                </div>
              </div>

              {/* Right: Expected Tokens */}
              <div className="bg-[#1F2937] rounded-2xl p-4 h-[41vh] scrollbar-thin">
                <h3 className="text-base font-semibold mb-4">Expected Tokens</h3>
                <div className="overflow-y-auto max-h-[360px] space-y-3 pr-1 h-[85%] scrollbar-none">
                  {expectedFromTokens && expectedFromTokens.length > 0 ? (
                    expectedFromTokens.map((token) => (
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedFromToken(token);
                          if (token?.mint === selectedToToken?.mint) {
                            setSelectedToToken(null);
                          }
                          setShowFromTokensModal(false);
                        }}
                        key={token.mint}
                        className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-gray-700/30 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <img src={token.image} alt={token.symbol} className="w-8 h-8 rounded-full" />
                          <div>
                            <div className="font-medium">{token.symbol}</div>
                            <div className="text-sm text-gray-400">{token.name}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          <span className="text-xs text-emerald-400 font-medium">{token.balance.toFixed(3)}</span>
                          <div className="flex items-center gap-2 text-gray-400">
                            <span className="text-sm max-w-[120px] truncate">
                              {token.mint.slice(0, 4)}...{token.mint.slice(-4)}
                            </span>
                            <ClipboardIcon
                              onClick={() => navigator.clipboard.writeText(token.mint)}
                              className="w-4 h-4 hover:text-white cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-400 text-sm py-6">No expected tokens found.</div>
                  )}
                </div>
              </div>

            </div>

            {/* Optional Note */}
            <div className="mt-6 bg-gray-800/50 text-sm text-gray-400 rounded-xl px-4 py-3">
              Current tokens represent what the vault holds. Expected tokens reflect the state after proposal execution.
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default CreateProposal;
