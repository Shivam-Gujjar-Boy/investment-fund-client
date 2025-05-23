export interface Fund {
  id: string;
  name: string;
  creator: string;
  members: number;
  totalValue: string;
  createdAt: string;
  status: 'active' | 'pending';
}

export interface Wallet {
  address: string;
  connected: boolean;
  balance: number;
}