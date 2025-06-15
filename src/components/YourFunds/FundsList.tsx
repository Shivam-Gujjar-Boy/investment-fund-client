import { useEffect, useState } from 'react';
import FundCard from './FundCard';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { UserFund, programId } from '../../types';
import { Buffer } from 'buffer';


export default function FundsList() {
  const [funds, setFunds] = useState<UserFund[] | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive' | 'pending'>('active');
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
          
          if (num_of_funds === 0) return;

          const isPendings: boolean[] = [];
          const isEligibles: boolean[] = [];

          for (let i=0; i<num_of_funds; i++) {
            const fund_pubkey = new PublicKey(buffer.slice(36+i*50, 68+i*50));
            const isPending = buffer.readUint8(76 + i*50) ? true : false;
            const isEligible = buffer.readUint8(77 + i*50) ? true : false;
            console.log(fund_pubkey.toBase58());
            isPendings.push(isPending);
            isEligibles.push(isEligible);
            funds_pubkey.push(fund_pubkey)
          }

          console.log(funds_pubkey);

          const fundAccountInfos = await connection.getMultipleAccountsInfo(funds_pubkey);
          console.log(fundAccountInfos);

          if (!fundAccountInfos) {

            return;
          }

          const fundDataArray: UserFund[] = fundAccountInfos.map((acc, i) => {
            if (!acc || !acc.data) return null;
            console.log(i);
            const acc_buffer = Buffer.from(acc?.data);
            console.log("Length of account data is : ", acc_buffer.length);
            console.log('Account data is : ', acc_buffer);
            const name_dummy = acc_buffer.slice(0, 32).toString();
            let name = '';
            for (const c of name_dummy) {
                if (c === '\x00') break;
                name += c;
            }
            console.log(name);

            const totalDeposit = acc_buffer.readBigInt64LE(32);
            console.log(totalDeposit);
            const governanceMint = new PublicKey(acc_buffer.slice(40, 72));
            console.log(governanceMint.toBase58());
            const vault = new PublicKey(acc_buffer.slice(72, 104));
            console.log(vault.toBase58());
            const currentIndex = acc_buffer.readUInt8(104);
            console.log(currentIndex);
            const created_at = acc_buffer.readBigInt64LE(105);
            console.log(created_at);
            const is_private = acc_buffer.readUInt8(113);
            console.log(is_private);
            const members: PublicKey[] = [];
            console.log(members);
            const numOfMembers = acc_buffer.readUInt32LE(114);
            console.log(numOfMembers);
            const creator = new PublicKey(acc_buffer.slice(118, 150));
            console.log(creator.toBase58());
            for (let i=0; i<numOfMembers; i++) {
              members.push(new PublicKey(acc_buffer.slice(118+(i*32), 150+(i*32))));
              console.log(members);
            }

            return {
              fundPubkey: funds_pubkey[i],
              isPending: isPendings[i],
              isEligible: isEligibles[i],
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
            };
          }).filter((f): f is UserFund => f !== null);

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
  }, [connected, wallet, connection]);

  const activeFunds = funds?.filter(fund => fund.totalDeposit > 0n && !fund.isPending) ?? [];
  const inactiveFunds = funds?.filter(fund => fund.totalDeposit === 0n && !fund.isPending) ?? [];
  const pendingFunds = funds?.filter(fund => fund.isPending) ?? [];
  const currentFunds = activeTab === 'active' ? activeFunds : (activeTab === 'inactive' ? inactiveFunds : pendingFunds);

  return (
    <div className="w-full animate-fade-in">
      <div className="border-b border-gray-700 mb-6">
        <nav className="flex" aria-label="Tabs">
          {['active', 'inactive', 'pending'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'active' | 'inactive' | 'pending')}
              className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm sm:text-base transition-colors duration-200
                ${activeTab === tab
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'}`}
            >
              {tab === 'active' ? 'Active Funds' : (tab === 'inactive' ? 'Inactive Funds' : 'Pending Funds')}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
        </div>
      ) : currentFunds.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
          {currentFunds.map((fund) => (
            <FundCard key={fund.name} fund={fund} status={activeTab} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          {activeTab === 'active'
            ? "You don't have any active funds yet. Create one to get started or deposit assets in inactive funds!"
            : (
              activeTab === 'inactive'
              ? "You don't have any inactive funds right now."
              : "You don't have any pending funds."
            )}
        </div>
      )}
    </div>
  );
}
