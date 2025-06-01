import { useEffect, useState } from 'react';
import FundCard from './FundCard';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';

interface Fund {
  fund_address: PublicKey,
  name: string;
  creator: PublicKey,
  numOfMembers: number,
  members: PublicKey[];
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

          const num_of_funds = buffer.readUInt32LE(32);
          console.log("Number of funds: ", num_of_funds);

          const funds_pubkey: PublicKey[] = [];

          for (let i=0; i<num_of_funds; i++) {
            const fund_pubkey = new PublicKey(buffer.slice(36+i*50, 68+i*50));
            console.log(fund_pubkey.toBase58());
            funds_pubkey.push(fund_pubkey)
          }

          console.log(funds_pubkey);
          
          toast.success(" Fund Pubkeys nikal li");

          const fundAccountInfos = await connection.getMultipleAccountsInfo(funds_pubkey);
          console.log(fundAccountInfos);
          toast.success(" Fund Infos nikal liye hai");
          if (!fundAccountInfos) {
            toast.error(" Fund Infos khali hai bsdk");
            return;
          }

          const fundDataArray: Fund[] = fundAccountInfos.map((acc, i) => {
            if (!acc || !acc.data) return null;
            console.log(i);
            const buffer = Buffer.from(acc?.data);
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
            const isInitialized = buffer.readUInt8(104) ? true : false;
            const created_at = buffer.readBigInt64LE(105);
            const is_private = buffer.readUInt8(113);
            // const raw = borsh.deserialize(fundSchema, FundAccount, acc.data);
            return {
              fund_address: funds_pubkey[i],
              name,
              creator,
              numOfMembers,
              members,
              totalDeposit,
              governanceMint,
              vault,
              isInitialized,
              created_at,
              is_private,
            };
          }).filter((f): f is Fund => f !== null);

          console.log(fundDataArray);

          setFunds(fundDataArray);
        } else {
          toast.error(" User Info khali hai jiiiii");
          setFunds([]);
        }
      } catch (error) {
        console.error('Error fetching user data: ', error);
        setFunds([]);
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    getUserFunds();
  }, [connected, wallet]);

  const activeFunds = funds?.filter(fund => fund.totalDeposit > 0n) ?? [];
  const pendingFunds = funds?.filter(fund => fund.totalDeposit === 0n) ?? [];
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
