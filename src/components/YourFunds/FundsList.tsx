import { useEffect, useState } from 'react';
import FundCard from './FundCard';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import * as borsh from 'borsh';

class UserAccount {
  user: Uint8Array;
  funds: Uint8Array[];

  constructor(obj: { user: Uint8Array; funds: Uint8Array[] }) {
    this.user = obj.user;
    this.funds = obj.funds;
  }
}

class FundAccount {
  name: Uint8Array;
  creator: Uint8Array;
  members: BN;
  total_deposit: BN;
  governance_mint: Uint8Array;
  vault: Uint8Array;
  is_initialized: number;
  created_at: BN;
  is_private: number;

  constructor(props: {
    name: Uint8Array;
    creator: Uint8Array;
    members: BN;
    total_deposit: BN;
    governance_mint: Uint8Array;
    vault: Uint8Array;
    is_initialized: number;
    created_at: BN;
    is_private: number;
  }) {
    this.name = props.name;
    this.creator = props.creator;
    this.members = props.members;
    this.total_deposit = props.total_deposit;
    this.governance_mint = props.governance_mint;
    this.vault = props.vault;
    this.is_initialized = props.is_initialized;
    this.created_at = props.created_at;
    this.is_private = props.is_private;
  }
}

const userSchema = new Map([
  [UserAccount, { kind: 'struct', fields: [['user', [32]], ['funds', [[32]]]] }],
]);

const fundSchema = new Map([
  [FundAccount, {
    kind: 'struct',
    fields: [
      ['name', [32]],
      ['creator', [32]],
      ['members', [8]],
      ['total_deposit', [8]],
      ['governance_mint', [32]],
      ['vault', [32]],
      ['is_initialized', 'u8'],
      ['created_at', [8]],
      ['is_private', 'u8'],
    ],
  }],
]);

interface Fund {
  fund_address: PublicKey,
  name: string;
  creator: PublicKey;
  members: bigint;
  totalDeposit: bigint;
  governanceMint: PublicKey;
  vault: PublicKey;
  isInitialized: boolean;
  created_at: bigint;
  is_private: number;
}

const programId = new PublicKey('4d2eF5fwAaLYfuKhTGpVgdb8nMeeyQtZj4UDdU24HT3Q');

export default function FundsList() {
  const [funds, setFunds] = useState<Fund[] | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(false);
  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected } = wallet;

  function bytesToString(bytes: Uint8Array): string {
    let end = bytes.length;
    while (end > 0 && bytes[end - 1] === 0) end--;
    return new TextDecoder().decode(bytes.slice(0, end));
  }

  useEffect(() => {
    const getUserFunds = async () => {
      if (!connected || !wallet || !wallet.publicKey) return;
      const user_key = wallet.publicKey;

      setLoading(true);
      try {
        const [userAccountPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("user"), user_key.toBuffer()],
          programId
        );

        const userAccountInfo = await connection.getAccountInfo(userAccountPda);
        console.log(userAccountInfo);
        if (userAccountInfo !== null) {
          const buffer = userAccountInfo.data;
          console.log(buffer);
          const user = borsh.deserialize(userSchema, UserAccount, buffer);
          console.log(user);

          if (user.funds.length === 0) {
            setFunds([]);
            setLoading(false);
            return;
          }

          const funds_pubkey = user.funds.map(bytes => new PublicKey(bytes));
          const fundAccountInfos = await connection.getMultipleAccountsInfo(funds_pubkey);

          const fundDataArray: Fund[] = fundAccountInfos.map((acc, i) => {
            if (!acc || !acc.data) return null;
            console.log(i);
            const raw = borsh.deserialize(fundSchema, FundAccount, acc.data);
            return {
              fund_address: funds_pubkey[i],
              name: bytesToString(raw.name),
              creator: new PublicKey(raw.creator),
              members: BigInt((new BN(raw.members, 'le')).toString()),
              totalDeposit: BigInt((new BN(raw.total_deposit, 'le')).toString()),
              governanceMint: new PublicKey(raw.governance_mint),
              vault: new PublicKey(raw.vault),
              isInitialized: raw.is_initialized === 1,
              created_at: BigInt((new BN(raw.created_at, 'le')).toString()),
              is_private: raw.is_private,
            };
          }).filter((f): f is Fund => f !== null);

          setFunds(fundDataArray);
        } else {
          setFunds([]);
        }
      } catch (error) {
        console.error('Error fetching user data: ', error);
        setFunds([]);
      } finally {
        setLoading(false);
      }
    };

    getUserFunds();
  }, [connected, wallet]);

  const activeFunds = funds?.filter(fund => fund.totalDeposit) ?? [];
  const pendingFunds = funds?.filter(fund => !fund.totalDeposit) ?? [];
  const currentFunds = activeTab === 'active' ? activeFunds : pendingFunds;

  return (
    <div className="w-full animate-fade-in">
      <div className="border-b border-gray-700 mb-6">
        <nav className="flex" aria-label="Tabs">
          {['active', 'inactive'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'active' | 'inactive')}
              className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm sm:text-base transition-colors duration-200
                ${activeTab === tab
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'}`}
            >
              {tab === 'active' ? 'Active Funds' : 'Inactive Funds'}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
        </div>
      ) : currentFunds.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
          {currentFunds.map((fund) => (
            <FundCard key={fund.name} fund={fund} status={activeTab} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          {activeTab === 'active'
            ? "You don't have any active funds yet. Create one to get started or deposit assets in inactive funds!"
            : "You don't have any pending fund invitations."}
        </div>
      )}
    </div>
  );
}
