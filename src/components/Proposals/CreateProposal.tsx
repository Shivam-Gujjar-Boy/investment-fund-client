import React, { useCallback, useEffect, useRef, useState } from "react";
import {motion} from 'framer-motion';
import clsx from "clsx";
import { createHash } from 'crypto';
import {
  X,
  ArrowDownUp,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ClipboardIcon,
  RefreshCw,
  CalendarDays,
  TimerReset,
} from "lucide-react";
import { FromToken, LightFund, LockedToken, programId, Token, ToToken } from "../../types";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fetchMintMetadata } from "../../functions/fetchuserTokens";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Metaplex } from "@metaplex-foundation/js";
import SOL from '../../assets/SOL.jpg';
import USDC from '../../assets/USDC.png';
import { availableTags } from "../../types/tags";
import toast from "react-hot-toast";
import { SYSTEM_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import bs58 from 'bs58';

interface Swap {
  fromToken: FromToken;
  fromAmount: string;
  toToken: ToToken;
  slippage: string;
  hashString: string;
  rawHash: Buffer<ArrayBufferLike>,
}

interface SwapWithoutHash {
  fromMint: string,
  toMint: string,
  amount: bigint,
  slippage: number,
};

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

enum Status {
  None = 1,
  Uploading = 2,
  Creating = 3,
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
  const [showToTokensModal, setShowToTokensModal] = useState(false);
  const [showFromTokensModal, setShowFromTokensModal] = useState(false);
  const [search, setSearch] = useState('');
  const [mintExists, setMintExists] = useState<number>(0);
  const [newToken, setNewToken] = useState<ToToken | null>(null);
  const [fromTokens, setFromTokens] = useState<FromToken[]>([]);
  const [expectedFromTokens, setExpectedFromTokens] = useState<FromToken[]>([]);
  const [expectedAmount, setExpectedAmount] = useState(0);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [lockedTokens, setLockedTokens] = useState<LockedToken[] | null>(null);
  const [deadlineMode, setDeadlineMode] = useState("timer");
  const [timerHours, setTimerHours] = useState('');
  const [timerMinutes, setTimerMinutes] = useState('');
  const [timerSeconds, setTimerSeconds] = useState('');
  const [selectedDateTime, setSelectedDateTime] = useState("");
  const [proposalStatus, setProposalStatus] = useState<Status>(Status.None);

  // Required functions to add to your component:
  const applyTimer = () => {
    const now = new Date();
    const future = new Date(now.getTime() + (Number(timerHours) * 3600 + Number(timerMinutes) * 60 + Number(timerSeconds)) * 1000);
    if (future.getTime() - now.getTime() <= 30000) {
      toast.error('Deadline should be atleast 5 minutes');
      setProposalData((prev) => ({
        ...prev,
        deadline: '',
      }));
      return;
    }
    handleInputChange("deadline", future.getTime().toString());
  };

  const applyDateTime = () => {
    if (selectedDateTime) {
      const now = new Date();
      const future = new Date(selectedDateTime);
      if (future.getTime() - now.getTime() <= 300000) {
        toast.error('Deadline should be atleast 5 minutes');
        setProposalData((prev) => ({
          ...prev,
          deadline: '',
        }));
        return;
      }
      handleInputChange("deadline", future.getTime().toString());
    }
  };

  // useEffect(() => {
  //   toast.success(`Proposal Deadline: ${proposalData.deadline}`);
  // }, [proposalData]);

  const raw = Buffer.from([0]);

  const [tooltipState, setTooltipState] = useState({
    visible: false,
    content: {
      mint: '',
      name: '',
      symbol: '',
      image: '',
      decimals: 0,
      balance: 0,
    },
    x: 0,
    y: 0
  });

  const [swap, setSwap] = useState<Swap>({
    fromToken: {
      mint: "",
      name: "",
      symbol: "",
      image: "",
      decimals: 0,
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
    hashString: '',
    rawHash: raw
  });

  const [currentSwapIndex, setCurrentSwapIndex] = useState(0);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);


  const wallet = useWallet();

  // check for valid pubkey
  const isValidPubkey = (input: string) => {
    try {
      new PublicKey(input);
      return true;
    } catch (err) {
      if (err) {
        return false;
      }
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

      setFromTokens(tokensWithMetadata.map(({pubkey, balance_as_usdc, ...rest}) => {
        if (pubkey && balance_as_usdc) return rest;
        return rest;
      }));

      setSelectedFromToken(() => {
        const selected = tokensWithMetadata.find(
          (token) => token.mint !== selectedToToken?.mint
        );

        if (!selected) return null;

        // Destructure to remove `pubkey` and `balance_as_usdc`
        const { pubkey, balance_as_usdc, ...rest } = selected;
        if (pubkey && balance_as_usdc) return rest;
        return rest;
      });

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

    const selected = toTokens.find(
      (token) => token.mint !== selectedFromToken?.mint
    );

    setSelectedToToken(selected || null);
  }, [toTokens, selectedFromToken]);

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
          decimals: 6,
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
            decimals: metadata?.decimals || toToken.decimals
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
      decimals: 6,
      balance: 0,
    };

    const tukenMetadata = await fetchMintMetadata(new PublicKey(mint), metaplex);
    toToken = {
      ...toToken,
      name: tukenMetadata?.name || toToken.name,
      symbol: tukenMetadata?.symbol || toToken.symbol,
      image: tukenMetadata?.image || toToken.image,
      decimals: tukenMetadata?.decimals || toToken.decimals
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



  const fetchExpectedPrice = async (inputMint: string, outputMint: string, val: string) => {
    if (!val || val === '0') {
      console.log('Setting Expected Amoun to Zero');
      setExpectedAmount(0);
      return;
    }
    setFetchingPrice(true);
    const solMint = new PublicKey('So11111111111111111111111111111111111111112');
    const programId = new PublicKey('devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH');
    const dataSize = 1544;

    try {
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
                        bytes: outputMint
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
    } catch (err) {
      console.log(err);
    } finally {
      setFetchingPrice(false);
    }
  }



  const addSwap = () => {
    if ( !swap ||!swap.toToken ||
        !swap.fromToken ||
        swap.toToken.mint === swap.fromToken.mint || 
        Number(slippage) >= 100 || 
        Number(swap.fromAmount) > swap.fromToken?.balance || 
        !swap.fromAmount ||
        !swap.slippage ||
        fetchingPrice ||
        !expectedAmount ) {
      console.log("Invalid Swap");
      toast.error('Correctly fill the details');
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
        decimals: B.decimals
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
          token.balance -= (Number(swap.fromAmount));
        }
        return token;
      });

      exptdTokens.push({
        mint: B.mint,
        name: B.name,
        symbol: B.symbol,
        image: B.image,
        balance: expectedAmount + frmTokens.filter(token => token.mint === B.mint)[0].balance,
        decimals: B.decimals
      });

      frmTokens = frmTokens.filter(token => token.mint !== B.mint); // remove B from fromTokens
    }

    // === CASE 4: A and B both in expectedFromTokens ===
    else if (A_in_expected && B_in_expected) {
      exptdTokens = expectedFromTokens.map(token => {
        if (token.mint === A.mint) {
          token.balance -= (Number(swap.fromAmount));
        }
        if (token.mint === B.mint) {
          token.balance += expectedAmount;
        }
        return token;
      });
    }

    // === CASE 5: A in fromTokens and B in none ===
    else if (A_in_from) {
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
        balance: expectedAmount,
        decimals: B.decimals
      });
    }

    // === CASE 6: A in expectedFromTokens and B in none ===
    else if (A_in_expected) {
      exptdTokens = expectedFromTokens.map(token => {
        if (token.mint === A.mint) {
          token.balance -= (Number(swap.fromAmount));
        }
        return token;
      });

      exptdTokens.push({
        mint: B.mint,
        name: B.name,
        symbol: B.symbol,
        image: B.image,
        balance: expectedAmount,
        decimals: B.decimals
      });
    }

    const swapData = {
      fromMint: swap.fromToken.mint,
      toMint: swap.toToken.mint,
      amount: BigInt(Number(swap.fromAmount)*(10**(Number(swap.fromToken.decimals)))),
      slippage: (Number(swap.slippage)*100),
    };

    const {hashString, rawHash} = hashSwapStruct(swapData);

    setFromTokens(frmTokens);
    setExpectedFromTokens(exptdTokens);


    setProposalData((prev) => ({
      ...prev,
      swaps: [
        ...prev.swaps,
        { fromToken: swap.fromToken, fromAmount: swap.fromAmount, toToken: swap.toToken, slippage: swap.slippage, hashString, rawHash },
      ],
    }));

  };

  function hashSwapStruct(swap: SwapWithoutHash) {
      const fromMintBuf = bs58.decode(swap.fromMint);
      const toMintBuf = bs58.decode(swap.toMint);
      
      const amountBuf = Buffer.alloc(8);
      amountBuf.writeBigUInt64LE(BigInt(swap.amount));
      
      const slippageBuf = Buffer.alloc(2);
      slippageBuf.writeUInt16LE(Number(swap.slippage));
      
      // Debug logging
      console.log('fromMint string:', swap.fromMint);
      console.log('fromMintBuf bytes:', Array.from(fromMintBuf));
      console.log('toMint string:', swap.toMint);
      console.log('toMintBuf bytes:', Array.from(toMintBuf));
      console.log('amount:', swap.amount);
      console.log('amountBuf bytes:', Array.from(amountBuf));
      console.log('slippage:', swap.slippage);
      console.log('slippageBuf bytes:', Array.from(slippageBuf));
      
      const all = Buffer.concat([fromMintBuf, toMintBuf, amountBuf, slippageBuf]);
      console.log('Total bytes to hash:', Array.from(all));
      console.log('Total length:', all.length);
      
      const hashString = createHash('sha256').update(all).digest('hex');
      const rawHash = createHash('sha256').update(all).digest();
      return {hashString, rawHash};
  }

  const toggleTag = (tag: string) => {
    if (!proposalData.tags.includes(tag)) {
      setProposalData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
    } else {
      setProposalData((prev) => ({
        ...prev,
        tags: prev.tags.filter((tagg) => tagg !== tag),
      }));
    }
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

  function hashPair(a: Buffer<ArrayBuffer>, b: Buffer<ArrayBuffer>) {
    return createHash('sha256').update(Buffer.concat([a, b])).digest();
  }

  const padToPowerOfTwo = (leaves: Buffer<ArrayBuffer>[]) => {
    const n = leaves.length;
    let power = 1;
    while (power < n) power *= 2;

    const padded = [...leaves];
    const last = leaves[leaves.length - 1];
    while (padded.length < power) {
      padded.push(last); // pad with last hash
    }
    return padded;
  }

  // Main: compute Merkle root
  function computeMerkleRoot(hexHashes: Buffer<ArrayBufferLike>[]) {
    // Convert all hex hashes to buffers
    let level = padToPowerOfTwo(hexHashes.map(h => h));
    console.log(level.length);

    while (level.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < level.length; i += 2) {
        const combined = hashPair(level[i], level[i + 1]);
        nextLevel.push(combined);
      }
      level = nextLevel;
    }
    return level[0]; // Merkle root as hex
  }

  const handleSubmit = async () => {
    if (!proposalData.deadline) {
      toast.error(`Invalid Deadline`);
    }
    console.log("Proposal Created:", proposalData);

    if (!wallet || !wallet.publicKey || !wallet.signTransaction) {
      return;
    }

    const user = wallet.publicKey;

    try {
      const response = await fetch('https://investment-fund-server-production.up.railway.app/api/proposal/upload-proposal', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: fund.name,
          title: proposalData.title,
          description: proposalData.description,
          tags: proposalData.tags,
          deadline: proposalData.deadline,
          swaps: proposalData.swaps.map((swap) => ({
            fromToken: swap.fromToken.mint,
            fromAmount: (Number(swap.fromAmount)*(10**swap.fromToken.decimals)).toString(),
            toToken: swap.toToken.mint,
            slippage: (Number(swap.slippage)*100).toString(),
            hash: swap.hashString,
            fromDecimals: swap.fromToken.decimals,
          }))
        })
      });

      if (!response.ok) {
        toast.error('Error Uploading to IPFS');
        return;
      }

      const data = await response.json();
      toast.success('Proposal Data uploaded on IPFS');
      console.log(data.cid);
      setProposalStatus(Status.Creating);

      const swapHashes = proposalData.swaps.map(swap => swap.rawHash);
      const merkleRoot = computeMerkleRoot(swapHashes);
      // console.log(swapHashes);
      // console.log(merkleRoot);

      ////////////////////////////////////////////////////////////////

      // const cid = 'bafkreifszdbyfmuj2my6z6y5hbxocmzmfgbrsyi2hgeksds2egah4opcpy';
      const instructionTag = 1;
      const nameBytes = Buffer.from(fund.name, 'utf8');
      // const merkelBytes = Buffer.from(merkleRoot, 'utf8');
      const cidBytes = Buffer.from(data.cid, 'utf8');
      console.log(merkleRoot.length);

      const buffer = Buffer.alloc(1 + 8 + 59 + 32 + nameBytes.length);
      let offset = 0;

      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      buffer.writeBigInt64LE(BigInt(proposalData.deadline), offset);
      offset += 8;
      cidBytes.copy(buffer, offset);
      offset += 59;
      merkleRoot.copy(buffer, offset);
      offset += 32;
      nameBytes.copy(buffer, offset);

      const instructionData = buffer;
      console.log(instructionData.length);
      console.log(instructionData);

      const currentAggregatorIndex = fund.currentIndex;

      const [currentAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('proposal-aggregator'), Buffer.from([currentAggregatorIndex]), fund.fundPubkey.toBuffer()],
        programId
      );

      const [newAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('proposal-aggregator'), Buffer.from([currentAggregatorIndex + 1]), fund.fundPubkey.toBuffer()],
        programId
      );

      const instruction = new TransactionInstruction({
        keys: [
          {pubkey: user, isSigner: true, isWritable: true},
          {pubkey: fund.fundPubkey, isSigner: false, isWritable: true},
          {pubkey: currentAggregatorPda, isSigner: false, isWritable: true},
          {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
          {pubkey: newAggregatorPda, isSigner: false, isWritable: true}
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


      toast.success("Proposal created successfully!");
      setCurrentStep(1);
      setProposalData({
        title: "",
        description: "",
        swaps: [],
        tags: [],
        deadline: "",
      });
    } catch (err) {
      console.log(err);
      toast.error('Error Creating Proposal');
    }
    setProposalStatus(Status.None);
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return proposalData.title.trim() && proposalData.description.trim()
          ? true
          : false;
      case 2:
        return proposalData.swaps.length === 0 ? false : true
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

  // ESC key modal closing
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

  // fetch Active proposals and make expected changes in token balances by deucting locked amounts
  const fetchLockedTokens = useCallback(async () => {
    if (!fund) return;

    try {
      let currentAggregatorIndex = fund.currentIndex;
      const [currentAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('proposal-aggregator'), Buffer.from([currentAggregatorIndex]), fund.fundPubkey.toBuffer()],
        programId
      );


      const currentAggregatorInfo = await connection.getAccountInfo(currentAggregatorPda);
      if (!currentAggregatorInfo) return;


      const currentAggregatorBuffer = Buffer.from(currentAggregatorInfo.data);

      const numOfProposals = currentAggregatorBuffer.readUint32LE(1);
      let offset = 5;
      const lockedTokensList: LockedToken[] = [];
      for (let i=0; i<numOfProposals; i++) {
        const isExecuted = currentAggregatorBuffer.readUInt8(offset + 123) ? true : false;
        if (!isExecuted) {
          const cid = currentAggregatorBuffer.slice(offset + 32, offset + 91).toString();
          // fetch proposal from tokens, and their amounts, and accordingly deduct that amount from the fromTokens
          const proposalDataUrl = `https://${cid}.ipfs.w3s.link/`;
          const proposalDataResponse = await fetch(proposalDataUrl);
          if (!proposalDataResponse.ok) {
            throw new Error(`Failed to fetch metadata: ${proposalDataResponse.status}`);
          }

          const fetchedProposalData = await proposalDataResponse.json();
          for (const swap of fetchedProposalData.swaps) {
            const fromTokenMint = swap.fromToken;
            const transferAmount = swap.fromAmount;
            console.log("Transfer Amount =", transferAmount);
            if (lockedTokensList.some(t => t.mint === fromTokenMint)) {
              lockedTokensList.map(t => {
                if (t.mint === fromTokenMint) {
                  t.amount += Number(transferAmount);
                }
                return t;
              })
            } else {
              lockedTokensList.push({mint: fromTokenMint, amount: Number(transferAmount)});
            }
          }

        }
        const numOfVoters = currentAggregatorBuffer.readUInt32LE(offset + 126);
        offset += (130 + (numOfVoters * 5));
      }

      if (currentAggregatorIndex > 0) {
        currentAggregatorIndex -= 1;
        const [currentAggregatorPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('proposal-aggregator'), Buffer.from([currentAggregatorIndex]), fund.fundPubkey.toBuffer()],
          programId
        );

        const currentAggregatorInfo = await connection.getAccountInfo(currentAggregatorPda);
        if (!currentAggregatorInfo) return;

        const currentAggregatorBuffer = Buffer.from(currentAggregatorInfo.data);

        const numOfProposals = currentAggregatorBuffer.readUint32LE(1);
        let offset = 5;
        const lockedTokensList: LockedToken[] = [];
        for (let i=0; i<numOfProposals; i++) {
          const isExecuted = currentAggregatorBuffer.readUInt8(offset + 123) ? true : false;
          if (!isExecuted) {
            const cid = currentAggregatorBuffer.slice(offset + 32, offset + 91).toString();
            // fetch proposal from tokens, and their amounts, and accordingly deduct that amount from the fromTokens
            const proposalDataUrl = `https://${cid}.ipfs.w3s.link/`;
            const proposalDataResponse = await fetch(proposalDataUrl);
            if (!proposalDataResponse.ok) {
              throw new Error(`Failed to fetch metadata: ${proposalDataResponse.status}`);
            }

            const fetchedProposalData = await proposalDataResponse.json();
            for (const swap of fetchedProposalData.swaps) {
              const fromTokenMint = swap.fromToken;
              const transferAmount = swap.fromAmount;
              if (lockedTokensList.some(t => t.mint === fromTokenMint)) {
                lockedTokensList.map(t => {
                  if (t.mint === fromTokenMint) {
                    t.amount = t.amount +  parseInt(transferAmount);
                  }
                  return t;
                })
                continue;
              } else {
                lockedTokensList.push({mint: fromTokenMint, amount: parseInt(transferAmount)});
              }
              console.log(lockedTokensList);
            }

          }
          const numOfVoters = currentAggregatorBuffer.readUInt32LE(offset + 126);
          offset += (130 + (numOfVoters * 5));
        }
      }

      setLockedTokens(lockedTokensList);
    } catch (err) {
      console.log(err);
    }
  }, [connection, fund]);


  const fetchedRef = useRef(false);
  const fetchedRefV2 = useRef(false);

  // main useEffect
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchVaultTokens();
    fetchAllToTokenMints();
    fetchLockedTokens();
  }, [fetchVaultTokens, fetchAllToTokenMints, fetchLockedTokens]);


  useEffect(() => {
    if (fetchedRefV2.current) return;
    if (fromTokens.length && lockedTokens && lockedTokens.length !== 0) {
      console.log(fromTokens);
      console.log(lockedTokens);
      const fromTukens = fromTokens;
      for (const lockedToken of lockedTokens) {
        fromTukens.map(fromTuken => {
          if (fromTuken.mint === lockedToken.mint) {
            fromTuken.balance -= lockedToken.amount;
          }
        })
      }
      setFromTokens(fromTukens);
      fetchedRefV2.current = true;
    }
  }, [fromTokens, lockedTokens]);

  // const handleInterChange = async () => {
  //   if (!selectedFromToken || !selectedToToken) return;

  //   if (fromTokens.some(t => t.mint === selectedToToken.mint))
  // }

  // Handling SWAP changes
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
                          (Max 5000 characters)
                        </span>
                      </label>
                      <textarea
                        maxLength={5000}
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
                  (fromTokens && toTokens && tokens && lockedTokens) ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-semibold text-white">
                          Token Swaps
                        </h3>
                      </div>

                      <div className="h-[330px] flex gap-2">
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
                                        onClick={() => {
                                          const amnt = selectedFromToken.balance.toString();
                                          setAmount(amnt);
                                          if (selectedToToken) {
                                            fetchExpectedPrice(selectedFromToken.mint, selectedToToken?.mint, amnt);
                                          }
                                        }}
                                        className="text-xs bg-gray-700 text-gray-300 px-2 mb-1 rounded hover:bg-gray-600 transition"
                                      >
                                        Max
                                      </button>
                                      <button
                                        onClick={() => {
                                          const amnt = (selectedFromToken.balance * 0.5);
                                          setAmount(amnt.toFixed(6));
                                          if (selectedToToken) {
                                            fetchExpectedPrice(selectedFromToken.mint, selectedToToken?.mint, amnt.toString());
                                          }
                                        }}
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

                                        setAmount(val);

                                        if (debounceRef.current) {
                                          clearTimeout(debounceRef.current);
                                        }

                                        debounceRef.current = setTimeout(() => {
                                          fetchExpectedPrice(selectedFromToken?.mint, selectedToToken?.mint, val);
                                          console.log(val);
                                        }, 500);
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
                                onClick={(e) => {
                                  e.preventDefault();
                                  // handleInterChange();
                                }}
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
                              <div className="mx-5 h-[19.5%] text-xs flex justify-between">
                                <p className="flex justify-center items-center">To Token</p>
                                {selectedFromToken && selectedToToken && (
                                  <div className="flex items-center gap-4 p-2 bg-slate-800/50 rounded-xl transition-all">
                                    <motion.button
                                      whileTap={{ scale: 0.95, rotate: 90 }}
                                    >
                                      <RefreshCw
                                        onClick={(e) => {
                                          e.preventDefault();
                                          fetchExpectedPrice(selectedFromToken?.mint, selectedToToken?.mint, amount);
                                        }}
                                        className="w-4 h-4 text-slate-300" />
                                    </motion.button>
                                  </div>
                                )}
                              </div>
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
                                    {!fetchingPrice ? (
                                      <>~{expectedAmount ? expectedAmount.toFixed(3) : '0'}</>
                                    ) : (
                                      <div className="w-[50%] h-10 bg-gray-800/40 animate-pulse rounded-md" />
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="mt-4 h-12 flex justify-between items-center gap-2">
                              {/* Slippage Section */}
                              <div className="w-[61%] h-full px-4 flex items-center border border-gray-900 rounded-lg bg-gray-800 shadow-sm gap-2">
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
                                  className="w-[60%] outline-none bg-transparent text-sm font-medium text-white placeholder-gray-400"
                                />
                                <button onClick={() => setSlippage('0.1')} className="border border-slate-600 text-xs rounded p-1 w-[13%] cursor-pointer hover:bg-slate-600">0.1%</button>
                                <button onClick={() => setSlippage('0.5')} className="border border-slate-600 text-xs rounded p-1 w-[13%] cursor-pointer hover:bg-slate-600">0.5%</button>
                                <button onClick={() => setSlippage('1')} className="border border-slate-600 text-xs rounded p-1 w-[13%] cursor-pointer hover:bg-slate-600">1%</button>
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
                          </div>
                        </div>
                        <div className="relative w-[49%] h-full">
                          {/* Tooltip Portal - positioned at the top level */}
                          {tooltipState.visible && (
                            <div 
                              className="absolute z-[100] px-3 py-2 bg-slate-800 text-white rounded-xl shadow-lg text-xs w-max max-w-[200px] text-center pointer-events-none"
                              style={{
                                left: tooltipState.x,
                                top: tooltipState.y,
                                transform: 'translate(-50%, -100%)'
                              }}
                            >
                              <div className="font-semibold truncate">{tooltipState.content?.name}</div>
                              <div className="text-slate-400">{tooltipState.content?.symbol}</div>
                              <div className="text-slate-500 text-[10px]">
                                {tooltipState.content?.mint?.slice(0, 4)}...{tooltipState.content?.mint?.slice(-4)}
                              </div>
                              {/* Tooltip arrow */}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 rotate-45 mt-[-6px] z-[-1]" />
                            </div>
                          )}
                          
                          <div className="w-full h-full p-3 bg-slate-800/50 rounded-3xl flex justify-center items-start relative">
                            <div className="flex flex-col gap-2 w-full h-full overflow-y-auto scrollbar-none">
                              <div
                                onClick={(e) => {
                                  e.preventDefault();
                                  setProposalData((prev) => ({
                                    ...prev,
                                    swaps: []
                                  }));
                                  setFromTokens((tokens ?? []).map(({ pubkey, balance_as_usdc, ...rest }) => {
                                    return rest;
                                    if (pubkey && balance_as_usdc) return rest;
                                  }));
                                  setExpectedFromTokens([]);
                                }}
                                className="absolute z-50 right-3 bottom-3 px-4 py-1.5 rounded-xl bg-slate-800 border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:text-white hover:border-emerald-400 shadow-md shadow-emerald-500/10 backdrop-blur-md transition-all cursor-pointer"
                              >
                                Clear
                              </div>
                              {proposalData.swaps.length === 0 ? (
                                <div className="w-full h-full flex justify-center items-center">
                                  <p className="text-slate-500 text-lg font-medium tracking-wide italic">
                                    Added swaps will appear here
                                  </p>
                                </div>
                              ) : (
                                proposalData.swaps.map((swap, index) => (
                                  <div key={index} className="relative bg-slate-900 rounded-3xl p-4 shadow-sm shadow-emerald-400/10 backdrop-blur-md hover:shadow-emerald-500/20 transition-all duration-300 overflow-visible">
                                    {/* Amount + Slippage */}
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 text-center text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full shadow-sm border border-slate-700">
                                      <span className="mr-3 text-emerald-300">Amount: {Number(swap.fromAmount).toFixed(3)}</span>
                                      <span className="text-orange-300">Slippage: {swap.slippage}%</span>
                                    </div>

                                    {/* Main Swap Row */}
                                    <div className="relative flex items-center justify-between">
                                      {/* From Token */}
                                      <div className="flex flex-col items-center gap-2 w-1/4 relative">
                                        <img
                                          src={swap.fromToken.image || '/fallback.png'}
                                          alt={swap.fromToken.symbol}
                                          className="w-14 h-14 rounded-full object-cover bg-slate-700 shadow-inner shadow-black/40 cursor-pointer"
                                          onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const containerRect = e.currentTarget.closest('.w-\\[49\\%\\]').getBoundingClientRect();
                                            setTooltipState({
                                              visible: true,
                                              content: swap.fromToken,
                                              x: rect.left + rect.width / 2 - containerRect.left,
                                              y: rect.top - containerRect.top - 10
                                            });
                                          }}
                                          onMouseLeave={() => setTooltipState({ visible: false, content: {
                                            mint: '',
                                            name: '',
                                            symbol: '',
                                            image: '',
                                            decimals: 0,
                                            balance: 0,
                                          }, x: 0, y: 0 })}
                                        />
                                      </div>

                                      {/* Arrow */}
                                      <div className="w-full flex justify-center items-center relative">
                                        <div className="w-full h-0.5 bg-gradient-to-r from-emerald-400/20 via-emerald-500 to-emerald-400/20"></div>
                                        <ArrowRight className="absolute text-emerald-400 bg-slate-900 p-1 rounded-full border border-emerald-500 shadow-md w-5 h-5" />
                                      </div>

                                      {/* To Token */}
                                      <div className="flex flex-col items-center gap-2 w-1/4 relative">
                                        <img
                                          src={swap.toToken.image || '/fallback.png'}
                                          alt={swap.toToken.symbol}
                                          className="w-14 h-14 rounded-full object-cover bg-slate-700 shadow-inner shadow-black/40 cursor-pointer"
                                          onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const containerRect = e.currentTarget.closest('.w-\\[49\\%\\]').getBoundingClientRect();
                                            setTooltipState({
                                              visible: true,
                                              content: swap.toToken,
                                              x: rect.left + rect.width / 2 - containerRect.left,
                                              y: rect.top - containerRect.top - 10
                                            });
                                          }}
                                          onMouseLeave={() => setTooltipState({ visible: false, content: {
                                            mint: '',
                                            name: '',
                                            symbol: '',
                                            image: '',
                                            decimals: 0,
                                            balance: 0,
                                          }, x: 0, y: 0 })}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center items-center min-h-[150px]">
                      <div className="relative flex items-center justify-center w-16 h-16">
                        <div className="absolute w-full h-full rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                        <div className="absolute w-10 h-10 rounded-full border-4 border-purple-500 border-b-transparent animate-spin reverse-slow" />
                        <div className="absolute w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-purple-500 shadow-lg shadow-purple-500/30" />
                      </div>
                    </div>
                  )
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="flex flex-col lg:flex-row gap-3 w-full">
                      {/* Left Section - Proposal Preview */}
                      <div className="w-full lg:w-3/4 bg-slate-900 rounded-2xl p-3 shadow-lg border border-slate-700 h-[60vh]">
                        <h2 className="text-2xl font-bold text-white mb-6">Proposal Preview</h2>

                        <div className="flex flex-col lg:flex-row gap-3 h-[49vh]">
                          {/* Left Side: Title & Description */}
                          <div className="w-full lg:w-1/2 space-y-4 border p-2 rounded-2xl border-slate-700/50">
                            <div>
                              <h3 className="text-md text-purple-400 font-semibold mb-1">Title</h3>
                              <p className="text-white/90 border border-slate-700/50 p-2 rounded-lg text-lg font-semibold overflow-x-auto scrollbar-none">{proposalData.title || 'No title provided'}</p>
                            </div>

                            <div>
                              <h3 className="text-md text-purple-400 font-semibold mb-1">Description</h3>
                              <p className="text-white/90 whitespace-pre-wrap border border-slate-700/50 p-2 text-sm rounded-lg overflow-y-auto scrollbar-none h-[30vh]">{proposalData.description || 'No description provided'}</p>
                            </div>
                          </div>

                          {/* Right Side: Swaps */}
                          <div className="w-full lg:w-1/2 border p-2 rounded-2xl border-slate-700/50 h-full">
                            <h3 className="text-lg text-purple-400 font-semibold mb-3">Swaps</h3>
                            {proposalData.swaps.length === 0 ? (
                              <p className="text-slate-500 italic">No swaps added yet</p>
                            ) : (
                              <div className="space-y-2 overflow-y-auto h-[88%] scrollbar-none">
                                {proposalData.swaps.map((swap, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-slate-800/60 p-4 rounded-xl flex items-center justify-between gap-4 shadow-inner"
                                  >
                                    <div className="flex items-center gap-3 w-1/4">
                                      <img
                                        src={swap.fromToken.image || '/fallback.png'}
                                        alt={swap.fromToken.symbol}
                                        className="w-10 h-10 rounded-full object-cover bg-slate-700"
                                      />
                                    </div>

                                    <div className="text-center w-1/2 text-sm text-slate-300">
                                      <p>Amount: <span className="text-emerald-400">{swap.fromAmount}</span></p>
                                      <p>Slippage: <span className="text-orange-400">{swap.slippage}%</span></p>
                                    </div>

                                    <div className="flex items-center gap-3 w-1/4 justify-end">
                                      <img
                                        src={swap.toToken.image || '/fallback.png'}
                                        alt={swap.toToken.symbol}
                                        className="w-10 h-10 rounded-full object-cover bg-slate-700"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="w-full lg:w-[30%] bg-slate-900 rounded-2xl p-3 shadow-lg border border-slate-700 space-y-2 flex flex-col justify-between">
                        <h3 className="text-xl font-semibold text-white">Finalize Proposal</h3>
                        
                        {/* Tags */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
                          <div className="flex flex-wrap gap-2 overflow-y-auto px-1 py-1">
                            {availableTags.map((tag) => {
                              const isSelected = proposalData.tags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  onClick={() => toggleTag(tag)}
                                  className={`relative group px-2 py-0.5 rounded-full text-xs font-semibold transition-all duration-300 border
                                    ${isSelected
                                      ? 'text-violet-500 border-violet-500 shadow-md scale-[1.02]'
                                      : 'bg-[#1e293b] text-gray-300 border-slate-600 hover:bg-slate-600/50 hover:text-white'}
                                  `}
                                >
                                  <span className="whitespace-nowrap">{tag}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Deadline Selector with Timer/DateTime Toggle */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Proposal Deadline *</label>

                          {/* Tabs */}
                          <div className="flex gap-2 mb-3 justify-start">
                            <button
                              className={clsx(
                                "flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-medium transition-all",
                                deadlineMode === "timer"
                                  ? "bg-purple-700 text-white"
                                  : "bg-slate-800 text-gray-400 hover:text-white"
                              )}
                              onClick={() => setDeadlineMode("timer")}
                            >
                              <TimerReset size={14} />
                              Timer
                            </button>
                            <button
                              className={clsx(
                                "flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-medium transition-all",
                                deadlineMode === "datetime"
                                  ? "bg-purple-700 text-white"
                                  : "bg-slate-800 text-gray-400 hover:text-white"
                              )}
                              onClick={() => setDeadlineMode("datetime")}
                            >
                              <CalendarDays size={14} />
                              Set Time
                            </button>
                          </div>

                          {/* Content Area */}
                          <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 space-y-3">
                            {deadlineMode === "timer" ? (
                              <div className="space-y-2">
                                <div className="flex gap-2 items-end">
                                  {/* Hours */}
                                  <div className="flex flex-col">
                                    <label className="text-xs text-gray-300 mb-1">Hours</label>
                                    <input
                                      type="text"
                                      value={timerHours}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "") return setTimerHours("");
                                        if (/^\d+$/.test(val)) setTimerHours(String(Math.max(0, Number(val))));
                                      }}
                                      className="bg-slate-900 text-white px-2 py-1 rounded-lg border border-slate-700 w-16 text-sm"
                                    />
                                  </div>

                                  {/* Minutes */}
                                  <div className="flex flex-col">
                                    <label className="text-xs text-gray-300 mb-1">Min</label>
                                    <input
                                      type="text"
                                      value={timerMinutes}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "") return setTimerMinutes("");
                                        if (/^\d+$/.test(val)) {
                                          const num = Number(val);
                                          if (num <= 59) setTimerMinutes(String(num));
                                        }
                                      }}
                                      className="bg-slate-900 text-white px-2 py-1 rounded-lg border border-slate-700 w-16 text-sm"
                                    />
                                  </div>

                                  {/* Seconds */}
                                  <div className="flex flex-col">
                                    <label className="text-xs text-gray-300 mb-1">Sec</label>
                                    <input
                                      type="text"
                                      value={timerSeconds}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "") return setTimerSeconds("");
                                        if (/^\d+$/.test(val)) {
                                          const num = Number(val);
                                          if (num <= 59) setTimerSeconds(String(num));
                                        }
                                      }}
                                      className="bg-slate-900 text-white px-2 py-1 rounded-lg border border-slate-700 w-16 text-sm"
                                    />
                                  </div>
                                </div>
                                
                                <button
                                  onClick={applyTimer}
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium shadow transition-colors"
                                >
                                  Apply Timer
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <input
                                  type="datetime-local"
                                  value={selectedDateTime}
                                  onChange={(e) => setSelectedDateTime(e.target.value)}
                                  className="w-full bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
                                />
                                <button
                                  onClick={applyDateTime}
                                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium shadow transition-colors"
                                >
                                  Set Date & Time
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
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
                      onClick={() => {
                        setProposalStatus(Status.Uploading);
                        handleSubmit();
                      }}
                      disabled={!canProceed()}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                        (canProceed() && proposalStatus === Status.None)
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-gray-700 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {proposalStatus === Status.None ? 'Create Proposal' : proposalStatus === Status.Uploading ? 'Uploading...' : 'Creating...'}
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
