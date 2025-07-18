import { PublicKey } from "@solana/web3.js";

export interface Fund {
  fund_address: PublicKey,
  fundType: number,
  name: string,
  expectedMembers: number,
  creatorExists: boolean,
  creator: PublicKey,
  numOfMembers: number,
  members: PublicKey[],
  totalDeposit: bigint,
  governanceMint: PublicKey | null,
  vault: PublicKey,
  currentIndex: number,
  created_at: bigint,
  is_private: number,
  underIncrementation: boolean,
  incrementProposer: PublicKey | null,
  isRefunded: boolean,
}

export interface LightFund {
  fundPubkey: PublicKey,
  fundType: number,
  name: string,
  expectedMembers: number,
  creatorExists: boolean,
  creator: PublicKey,
  numOfMembers: number,
  members: [PublicKey, number][],
  totalDeposit: bigint,
  vault: PublicKey,
  currentIndex: number,
  created_at: bigint,
}

export interface UserFund {
  fundPubkey: PublicKey,
  fundType: number,
  isPending: boolean,
  isEligible: boolean,
  votesYes: bigint | null,
  votesNo: bigint | null,
  name: string,
  expectedMembers: number,
  creator: PublicKey,
  numOfMembers: number,
  totalDeposit: bigint,
  created_at: bigint,
  is_private: number,
  secondaryTag: string,
  members: [PublicKey, number][],
}

export interface Token {
  pubkey: PublicKey,
  mint: string,
  name: string,
  symbol: string,
  image: string,
  balance: number,
  balance_as_usdc: number,
  decimals: number,
}

export interface ToToken {
  mint: string,
  name: string,
  symbol: string,
  image: string,
  decimals: number,
  balance: number,
}

export interface FromToken {
  mint: string,
  name: string,
  symbol: string,
  image: string,
  balance: number,
  decimals: number,
}

export interface Proposal {
  tags: string[],
  title: string,
  description: string,
  proposalIndex: number,
  vecIndex: number,
  proposer: PublicKey,
  numOfSwaps: number,
  fromAssets: string[],
  toAssets: string[],
  amounts: number[],
  slippages: number[],
  votesYes: bigint,
  votesNo: bigint,
  creationTime: bigint,
  fromDecimals: number[],
  deadline: bigint,
  executed: number,
  voters: [PublicKey, number][],
  swaps_status: number,
  merkelRoot: string,
}

export interface Metas {
  mint: string,
  name: string,
  symbol: string,
  image: string,
}

export interface LockedToken {
  mint: string,
  amount: number,
}

export interface JoinProposal {
  joiner: PublicKey,
  votesYes: bigint,
  votesNo: bigint,
  creationTime: bigint,
  proposalIndex: number,
}

export interface Member {
  name: string,
  profilePic: string,
  address: PublicKey,
  contributionPercent: number,
  joined: bigint,
}


export const programId = new PublicKey('CFdRopkCcbqxhQ46vNbw4jNZ3eQEmWZhmq5V467py9nG');
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");