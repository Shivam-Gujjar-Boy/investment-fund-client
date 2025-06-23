import { PublicKey } from "@solana/web3.js";

export interface Fund {
  fund_address: PublicKey,
  name: string,
  expectedMembers: number,
  creatorExists: boolean,
  creator: PublicKey,
  numOfMembers: number,
  members: PublicKey[],
  totalDeposit: bigint,
  governanceMint: PublicKey,
  vault: PublicKey,
  currentIndex: number,
  created_at: bigint,
  is_private: number,
  underIncrementation: boolean,
  incrementProposer: PublicKey | null,
  isRefunded: boolean,
}

export interface UserFund {
  fundPubkey: PublicKey,
  isPending: boolean,
  isEligible: boolean,
  votesYes: bigint,
  votesNo: bigint,
  name: string,
  expectedMembers: number,
  creatorExists: boolean,
  creator: PublicKey,
  numOfMembers: number,
  members: PublicKey[],
  totalDeposit: bigint,
  governanceMint: PublicKey,
  vault: PublicKey,
  currentIndex: number,
  created_at: bigint,
  is_private: number,
}

export interface Token {
  pubkey: PublicKey,
  mint: string,
  symbol: string,
  image: string,
  balance: number,
  decimals: number,
};

export interface Proposal {
  proposalIndex: number,
  vecIndex: number,
  proposer: PublicKey,
  numOfSwaps: number,
  fromAssets: PublicKey[],
  toAssets: PublicKey[],
  amounts: bigint[],
  slippages: number[],
  votesYes: bigint,
  votesNo: bigint,
  creationTime: bigint,
  deadline: bigint,
  executed: boolean,
  userVoted: boolean,
}

export interface JoinProposal {
  joiner: PublicKey,
  votesYes: bigint,
  votesNo: bigint,
  creationTime: bigint,
  proposalIndex: number,
}


export const programId = new PublicKey('CFdRopkCcbqxhQ46vNbw4jNZ3eQEmWZhmq5V467py9nG');
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");