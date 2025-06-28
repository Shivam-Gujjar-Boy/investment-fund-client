import { motion } from 'framer-motion';
import { 
  DollarSign, Shield,
  ArrowUpRight,
  Timer, Users, UserPlus2,
  ArrowDownLeft
} from 'lucide-react';
import { programId, UserFund } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import toast from 'react-hot-toast';
import { useState } from 'react';

interface FundCardProps {
    fund: UserFund;
    status: string
}

export const FundCard = ({ fund, status }: FundCardProps) => {
    // console.log(status);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [inviteePubkey, setInviteePubkey] = useState('');

    const navigate = useNavigate();

    const wallet = useWallet();
    const {connection} = useConnection();

    const encode = (num: string) => {
        if (num >= '0' && num <= '1') {
            return '0';
        } else if (num > '1' && num <= '4') {
            return '1';
        } else if (num > '4' && num <= '7') {
            return '2';
        } else {
            return '3';
        }
    }

    const handleInvitations = async (response: number) => {
        if(!fund) return;
        if(!wallet.publicKey || !wallet.signTransaction) return;

        try {
            const instructionTag = 19;
            const nameBytes = Buffer.from(fund.name);

            const buffer = Buffer.alloc(1 + 1 + nameBytes.length);
            let offset = 0;
            buffer.writeUint8(instructionTag, offset);
            offset += 1;
            buffer.writeUInt8(response, offset);
            offset += 1;
            nameBytes.copy(buffer, offset);

            const instructionData = buffer;

            const [userPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("user"), wallet.publicKey.toBuffer()],
                programId,
            );

            const userInfo = await connection.getAccountInfo(userPda);
            if (!userInfo) return;
            const userBuffer = Buffer.from(userInfo.data);

            let firstBytee = 0;
            let secondBytee = 0;
            const numOfFunds = userBuffer.readUInt32LE(59);
            for (let i=0; i<numOfFunds; i++) {
                const fundPublickey = new PublicKey(userBuffer.slice(63 + i*51, 95 + i*51));
                if (fundPublickey.toBase58() === fund.fundPubkey.toBase58()) {
                    firstBytee = userBuffer.readUInt8(95 + i*51);
                    secondBytee = userBuffer.readUInt8(105 + i*51);
                    break;
                }
            }

            const fundInfo = await connection.getAccountInfo(fund.fundPubkey);
            if (!fundInfo) return;
            const fundBuffer = Buffer.from(fundInfo.data);

            let inviter: string = '';

            const numOfMembers = fundBuffer.readUInt32LE(87);
            console.log(numOfMembers);
            for (let i=0; i<numOfMembers; i++) {
                const member = new PublicKey(fundBuffer.slice(91 + i*32, 123 + i*32));
                const encoder = new TextEncoder();
                const data = encoder.encode(member.toBase58());
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

                let count = 0;
                let numbers = '';
                for (const c of hash) {
                    if (c >= '0' && c <= '9') {
                        numbers += encode(c);
                        count ++;
                    }
                    if (count == 7) break;
                }

                if (count != 7) {
                    for (let i=count; i<7; i++) {
                        numbers += '0';
                    }
                }

                const a = numbers.slice(0, 3);
                const b = numbers.slice(3, 7);

                let firstByte = 0;
                for (let i=0; i<a.length; i++) {
                    firstByte += parseInt(a[i])*(4**(3-i));
                }

                let secondByte = 0;
                for (let i=0; i<b.length; i++) {
                    secondByte += parseInt(b[i])*(4**(3-i));
                }

                if (firstByte === firstBytee && secondByte === secondBytee) {
                    inviter = member.toBase58();
                }
            }

            console.log(inviter);

            const instruction = new TransactionInstruction({
                keys: [
                    {pubkey: wallet.publicKey, isSigner: true, isWritable: true},
                    {pubkey: userPda, isSigner: false, isWritable: true},
                    {pubkey: fund.fundPubkey, isSigner: false, isWritable: true},
                    {pubkey: new PublicKey(inviter), isSigner: false, isWritable: true},
                    {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
                ],
                programId,
                data: instructionData,
            });

            const transaction = new Transaction().add(instruction);

            // Get recent blockhash
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

            toast.success(`${response ? 'Accepted' : 'Rejected'} invitation successfully`);

        } catch (err) {
            console.log(err);
            toast.error(`Couldn't ${response ? "accept" : "reject"} the invitation.`);
        }
    }

    const inviteToFund = async () => {
        if(!fund) return;
        if(!wallet.publicKey || !wallet.signTransaction) return;
        const user = wallet.publicKey;

        try {
            const instructionTag = 20;
            const nameBytes = Buffer.from(fund.name, 'utf8');

            const encoder = new TextEncoder();
            const data = encoder.encode(user.toBase58());
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            let count = 0;
            let numbers = '';
            for (const c of hash) {
                if (c >= '0' && c <= '9') {
                    numbers += encode(c);
                    count ++;
                }
                if (count == 7) break;
            }

            if (count != 7) {
                for (let i=count; i<7; i++) {
                    numbers += '0';
                }
            }

            const a = numbers.slice(0, 3);
            const b = numbers.slice(3, 7);

            let firstByte = 0;
            for (let i=0; i<a.length; i++) {
                firstByte += parseInt(a[i])*(4**(3-i));
            }

            let secondByte = 0;
            for (let i=0; i<b.length; i++) {
                secondByte += parseInt(b[i])*(4**(3-i));
            }

            const buffer = Buffer.alloc(1 + 1 + 1 + nameBytes.length);
            let offset = 0;

            buffer.writeUInt8(instructionTag, offset);
            offset += 1;
            buffer.writeUInt8(firstByte, offset);
            offset += 1;
            buffer.writeUInt8(secondByte, offset);
            offset += 1;
            nameBytes.copy(buffer, offset);

            const instructionData = buffer;

            const [fundAccountPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('light-fund'), Buffer.from(fund.name)],
                programId
            );

            const invitee = new PublicKey(inviteePubkey);

            const [joinerAccountPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('user'), invitee.toBuffer()],
                programId
            );

            const instruction = new TransactionInstruction({
                keys: [
                    {pubkey: user, isSigner: true, isWritable: true},
                    {pubkey: invitee, isSigner: false, isWritable: true},
                    {pubkey: joinerAccountPda, isSigner: false, isWritable: true},
                    {pubkey: fundAccountPda, isSigner: false, isWritable: false},
                    {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false}
                ],
                programId,
                data: instructionData
            });

            const transaction = new Transaction().add(instruction);

            // Get recent blockhash
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

            toast.success('Invited Successfully');

            setIsInviting(false);
            setShowInviteModal(false);
        } catch (err) {
            console.log(err);
            toast.error('Error Inviting To Fund');
            setIsInviting(false);
        }
    }
    
    return (
    <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        whileHover={{ y: 0, scale: 1.005 }}
        className="mt-2 group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-slate-700/50 hover:border-purple-500/50 w-[350px]"
    >
        <div className="relative p-6 z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    // fund.category === 'DeFi' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                    // fund.category === 'Crypto' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                    // fund.category === 'Yield' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                    'bg-gradient-to-br from-orange-500 to-orange-600'
                }`}>
                    {/* {fund.category === 'DeFi' ? <Zap className="w-6 h-6 text-white" /> :
                    fund.category === 'Crypto' ? <Coins className="w-6 h-6 text-white" /> :
                    fund.category === 'Yield' ? <Target className="w-6 h-6 text-white" /> : */}
                    <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg group-hover:text-purple-300 transition-colors">
                    {fund.name}
                    </h3>
                    <p className="text-slate-400 text-sm">{fund.fundType === 0 ? 'Light Fund' : fund.fundType === 1 ? 'Standard Fund' : 'DAO-Style'} • {fund.secondaryTag}</p>
                </div>
                </div>
                <div className="flex items-center gap-2">
                {fund.isPending && <Timer className="w-4 h-4 text-orange-400" />}
                {fund.isEligible && <Shield className="w-4 h-4 text-emerald-400" />}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Value</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-white font-bold text-lg">
                    ${(Number(fund.totalDeposit) / 1e9).toFixed(2)} SOL
                </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Performance</span>
                    {/* {fund.performance > 0 ? 
                    <TrendingUp className="w-4 h-4 text-emerald-400" /> : 
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    } */}
                </div>
                {/* <p className={`font-bold text-lg ${fund.performance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fund.performance > 0 ? '+' : ''}{fund.performance.toFixed(1)}%
                </p> */}
                </div>
            </div>

            {/* Members Progress */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Members</span>
                <span className="text-slate-300 text-sm">{fund.numOfMembers}/{fund.expectedMembers}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(fund.numOfMembers / fund.expectedMembers) * 100}%` }}
                />
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                {fund.fundType === 0 && fund.isPending && (
                    <motion.button
                        onClick={() => {
                            handleInvitations(1);
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <ArrowUpRight className="w-4 h-4" />
                            Accept
                    </motion.button>
                )}
                {fund.fundType === 0 && fund.isPending && (
                    <motion.button
                        onClick={() => {
                            handleInvitations(0);
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-gradient-to-r from-rose-500 to-amber-500 text-white py-2 px-4 rounded-xl font-medium hover:from-rose-600 hover:to-amber-600 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <ArrowDownLeft className="w-4 h-4" />
                            Reject
                    </motion.button>
                )}
                {fund.fundType !== 0 && fund.isPending && (
                    <motion.button
                        onClick={() => {
                            navigate('/dashboard/fund-details');
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <ArrowUpRight className="w-4 h-4" />
                            Delete
                    </motion.button>
                )}
                {fund.fundType !== 0 && fund.isPending && fund.isEligible && (
                    <motion.button
                        onClick={() => {
                            navigate('/dashboard/fund-details');
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <ArrowUpRight className="w-4 h-4" />
                            Join
                    </motion.button>
                )}
                {fund.fundType !== 0 && fund.isPending && (
                    <motion.button
                        onClick={() => {
                            navigate('/dashboard/fund-details');
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <ArrowUpRight className="w-4 h-4" />
                            Delete
                    </motion.button>
                )}
                {fund.fundType !== 0 && fund.isPending && (
                    <motion.button
                        onClick={() => {
                            navigate('/dashboard/fund-details');
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <ArrowUpRight className="w-4 h-4" />
                            Delete
                    </motion.button>
                )}
                {!fund.isPending && (
                    <motion.button
                        onClick={() => {
                            navigate(`/dashboard/funds/${fund.fundPubkey.toBase58()}`);
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <ArrowUpRight className="w-4 h-4" />
                            View Details
                    </motion.button>
                )}
                {fund.fundType === 0 && !fund.isPending && (
                    <motion.button
                    onClick={() => setShowInviteModal(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-xl transition-colors"
                        >
                        <UserPlus2 className="w-4 h-4" />
                    </motion.button>
                )}
            </div>
            {showInviteModal && (
                <div onClick={(e) => {
                        if (e.target === e.currentTarget) setShowInviteModal(false);
                    }}
                    className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md'>
                <div className='h-full bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] p-4 rounded-2xl w-[100%] max-w-md border border-indigo-900/40 shadow-[0_0_25px_#7c3aed33] text-white space-y-2 animate-fadeIn'>

                    {/* Heading */}
                    <div className="">
                        {/* <h2 className="text-2xl font-bold text-indigo-300">Inviting To This Fund</h2> */}
                        <div className="space-y-4 text-sm text-slate-300">
                            <div className="bg-slate-800/60 border-indigo-700/40 rounded-xl p-4 shadow-inner shadow-indigo-900/20">
                                <p>
                                <span className="text-indigo-400 font-semibold">Invite Cost:</span>{' '}
                                <span className="text-white font-medium">0.00058 SOL</span>
                                </p>
                                <p className="">
                                This amount will be <span className="text-green-400 font-semibold">fully refunded</span> instantly once the invitee
                                either accepts or rejects the invitation.
                                </p>
                            </div>

                            <div>
                                <label htmlFor="inviteePubkey" className="block mb-3 text-indigo-300 font-medium">
                                Invitee's Wallet Address
                                </label>
                                <input
                                id="inviteePubkey"
                                type="text"
                                placeholder="Enter wallet public key..."
                                value={inviteePubkey}
                                onChange={(e) => setInviteePubkey(e.target.value)}
                                className="w-full mb-2 px-4 py-3 rounded-xl bg-[#0f172a] border border-indigo-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 shadow-[0_0_12px_#7c3aed22]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowInviteModal(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                            setIsInviting(true);
                            inviteToFund();
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                            isInviting ?
                            'bg-gray-600 cursor-not-allowed' :
                            'bg-indigo-500 hover:bg-indigo-400'
                            } text-white transition-all duration-200 shadow-[0_0_3px_#6366f1aa]`}
                        >
                            {isInviting ? 'Inviting...' : 'Invite'}
                        </button>
                    </div>
                </div>
                </div>
            )}
        </div>
    </motion.div>
)};