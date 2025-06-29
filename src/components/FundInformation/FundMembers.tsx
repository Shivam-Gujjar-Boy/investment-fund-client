import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Eye, Loader2 } from "lucide-react";
import { LightFund, Member, programId } from "../../types";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

interface MembersProps {
  fund: LightFund,
  searchTerm: string
}

export default function FundMembers({fund, searchTerm} : MembersProps) {
  const [members, setMembers] = useState<Member[] | null>(null);

  const {connection} = useConnection();

  const fetchMembers = useCallback(async () => {
    if (!fund) return;
    if (fund.numOfMembers === 0) {
      return;
    }

    const userAccounts = fund.members.map((member) => {
      const [userAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), member.toBuffer()],
        programId
      );
      return userAccount;
    });

    try {
      const memberAccountInfos = await connection.getMultipleAccountsInfo(userAccounts);
      if (!memberAccountInfos) {
        setMembers([]);
        return;
      }
      
      const membersArray = await Promise.all(
        memberAccountInfos.map(async (acc, i) => {
          if (!acc || !acc.data) return null;
          const userBuffer = Buffer.from(acc.data);
          const userCid = userBuffer.slice(0, 59).toString();
          const numberOfFunds = userBuffer.readUInt32LE(59);
          let balance: bigint = BigInt(0);
          let joined: bigint = BigInt(0);

          for (let i = 0; i < numberOfFunds; i++) {
            const fundPubkey = new PublicKey(userBuffer.slice(63 + i * 51, 95 + i * 51));
            if (fundPubkey.equals(fund.fundPubkey)) {
              balance = userBuffer.readBigInt64LE(96 + i*51);
              joined = userBuffer.readBigInt64LE(106 + i*51 );
              break;
            }
          }
          console.log(balance);
          console.log(fund.totalDeposit);

          const metadataUrl = `https://${userCid}.ipfs.w3s.link/metadata.json`;
          const imageUrl = `https://${userCid}.ipfs.w3s.link/profile.jpg`;

          const metadataResponse = await fetch(metadataUrl);
          if (!metadataResponse.ok) throw new Error(`Failed to fetch metadata: ${metadataResponse.status}`);
          const metadata = await metadataResponse.json();

          const profileResponse = await fetch(imageUrl);
          if (!profileResponse.ok) throw new Error(`Failed to fetch profile image: ${profileResponse.status}`);
          const profileBlob = await profileResponse.blob();
          const profileImageUrl = URL.createObjectURL(profileBlob);

          return {
            name: metadata.username,
            profilePic: profileImageUrl,
            address: fund.members[i],
            contributionPercent: fund.totalDeposit === BigInt(0) ? 0 : Number(balance)/Number(fund.totalDeposit) * 100,
            joined
          } as Member;
        })
      );

      // Filter out any nulls (just in case)
      const filtered = membersArray.filter((m): m is Member => m !== null);
      setMembers(filtered);

    } catch (err) {
      console.log(err);
      setMembers([]);
    }
  }, [connection, fund]);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchMembers();
  }, [fetchMembers]);

  return (
    <div className="min-h-screen bg-slate-900/5 backdrop-blur-xl relative overflow-hidden mt-20 px-4">
      {members === null ? (
        <div className="flex justify-center items-center h-[40vh]">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-[40vh] text-white text-center space-y-2">
          <div className="text-4xl">🧑‍🤝‍🧑</div>
          <div className="text-lg font-semibold">No members found</div>
          <div className="text-sm text-gray-400">This fund doesn't have any members yet.</div>
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 p-8 max-w-7xl mx-auto">
          {members.filter(member => member.name.toLowerCase().includes(searchTerm.toLowerCase())).map((member, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative backdrop-blur-xl border border-white/10 rounded-3xl p-4 transition-all duration-500 hover:border-white/30"
            >
              <div className="relative flex flex-col items-center">
                <div className="flex justify-center items-center w-full gap-4">
                  {/* Profile Ring */}
                  <div className="relative w-32 h-32 mb-2 flex-shrink-0">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="60"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="2"
                        fill="none"
                      />
                      <motion.circle
                        cx="64"
                        cy="64"
                        r="60"
                        stroke={`url(#gradient-${index})`}
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 60}
                        strokeDashoffset={2 * Math.PI * 60 * (1 - member.contributionPercent / 100)}
                        strokeLinecap="round"
                        initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 60 * (1 - member.contributionPercent / 100) }}
                        transition={{ duration: 2, delay: index * 0.2 }}
                      />
                      <defs>
                        <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="50%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Profile Image (Clean + Perfect Fit) */}
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="absolute top-2 left-2 right-2 bottom-2 rounded-full overflow-hidden border-[3px] border-white/10 shadow-md"
                    >
                      <img
                        src={member.profilePic}
                        alt={member.name}
                        className="w-full h-full object-cover object-center"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </motion.div>

                    {/* Percentage Display */}
                    <div className="absolute inset-0 flex items-end justify-center">
                      <span className="text-md font-semibold text-white bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                        {member.contributionPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Member Info */}
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white">{member.name}</h3>
                    <p className="text-xs text-gray-400 font-mono break-all">{member.address.toBase58()}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Member since {new Date(Number(member.joined) * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 w-[90%] h-[45px] mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#14b8a6] text-white py-3 px-4 rounded-xl font-semibold flex items-center border justify-center gap-2 hover:from-purple-600 hover:to-pink-600 transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    View Profile
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white/10 backdrop-blur-sm text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}