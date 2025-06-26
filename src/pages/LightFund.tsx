import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Wallet, Users, Tag, Zap, Shield, DollarSign, CheckCircle, AlertCircle, Sparkles, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { fundTags } from '../types/tags';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@metaplex-foundation/js';
import { programId } from '../types';
import { SYSTEM_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import toast from 'react-hot-toast';
import { Transaction, TransactionInstruction } from '@solana/web3.js';

interface FundTag {
  id: string;
  name: string;
  auto: boolean;
}

interface FormData {
  fundName: string;
  maxMemberCount: number;
  memberAddresses: string[];
  addMembersLater: boolean;
  selectedTags: string[];
}

interface FormErrors {
  fundName?: string;
  members?: string;
  maxMemberCount?: string;
}

// interface Step {
//   number: number;
//   title: string;
//   icon: React.ComponentType<any>;
// }

const LightFund = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>({
    fundName: '',
    maxMemberCount: 10,
    memberAddresses: [],
    addMembersLater: true,
    selectedTags: []
  });
  const [rentCost, setRentCost] = useState<number>(0.00419);
  const [memberCost, setMemberCost] = useState<number>(0);
  const [errors, setErrors] = useState<FormErrors>({});

  const [showCreationDetails, setShowCreationDetails] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const wallet = useWallet();
  const {connection} = useConnection();

  const getMultisigType = (count: number): string => {
    if (count&1) {
      return `${(count + 1)/2}-of-${count}`;
    } else {
      return `${(count/2) + 1}-of-${count}`;
    }
  };

  useEffect(() => {
    // Auto-select required tags
    const autoTags = fundTags.filter(tag => tag.auto).map(tag => tag.id);
    setFormData(prev => ({
      ...prev,
      selectedTags: [...new Set([...prev.selectedTags, ...autoTags])]
    }));
  }, []);

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

  useEffect(() => {
    // Calculate member cost
    const baseCost = 0.000355;
    const maxMemberCount = formData.addMembersLater ? formData.maxMemberCount : formData.memberAddresses.length;
    setMemberCost(baseCost * maxMemberCount);
  }, [formData.maxMemberCount, formData.memberAddresses, formData.addMembersLater]);

  const validateStep = (step: number) => {
    const newErrors: FormErrors = {};
    
    if (step === 1) {
      if (!formData.fundName.trim()) {
        newErrors.fundName = 'Fund name is required';
      } else if (formData.fundName.length > 32) {
        newErrors.fundName = 'Fund name must be 32 characters or less';
      }
    }
    
    if (step === 2) {
      if (!formData.addMembersLater && formData.memberAddresses.length === 0) {
        newErrors.members = 'At least one member address is required';
      }
      if (!formData.addMembersLater) {
        for (let i=0; i<formData.memberAddresses.length; i++) {
          if (formData.memberAddresses[i].length === 0) {
            newErrors.members = 'Addresses can not be empty';
            break;
          }
          if (formData.memberAddresses[i] === wallet.publicKey?.toBase58()) {
            newErrors.members = `Members Wallet should not be same as creator's`;
          }
        }
        if (hasDuplicates(formData.memberAddresses)) {
          newErrors.members = 'Members wallet should be all different';
        }
      }
      if (formData.addMembersLater && formData.maxMemberCount < 1) {
        newErrors.maxMemberCount = 'Minimum 2 members required';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const hasDuplicates = (arr: string[]) => new Set(arr).size !== arr.length;

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev: number) => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev: number) => Math.max(prev - 1, 1));
  };

  const addMemberAddress = () => {
    if (formData.memberAddresses.length >= 19) return;
    setFormData((prev: FormData) => ({
      ...prev,
      memberAddresses: [...prev.memberAddresses, '']
    }));
  };

  const updateMemberAddress = (index: number, value: string) => {
    setFormData((prev: FormData) => ({
      ...prev,
      memberAddresses: prev.memberAddresses.map((addr, i) => i === index ? value : addr)
    }));
  };

  const removeMemberAddress = (index: number) => {
    setFormData((prev: FormData) => ({
      ...prev,
      memberAddresses: prev.memberAddresses.filter((_, i) => i !== index)
    }));
  };

  const toggleTag = (tagId: string) => {
    const tag: FundTag | undefined = fundTags.find((t: FundTag) => t.id === tagId);
    if (!tag || tag.auto) return; // Can't toggle auto tags
    
    setFormData(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tagId)
        ? prev.selectedTags.filter(id => id !== tagId)
        : [...prev.selectedTags, tagId]
    }));
  };

  const handleCreate = async () => {

    if (!formData) return;
    if (!wallet || !wallet.publicKey || !wallet.signTransaction) return;
    const user = wallet.publicKey;

    try {
      console.log(formData);
      const instructionTag = 18;
      const nameBytes = Buffer.from(formData.fundName, 'utf8');
      let tags = 0;

      for (const id of formData.selectedTags) {
        let tag = 1;
        tag = tag << Number(id);
        tags = tags | tag;
      }

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
      console.log(a, b);
      console.log(hash);

      let firstByte = 0;
      for (let i=0; i<a.length; i++) {
        firstByte += parseInt(a[i])*(4**(3-i));
      }

      let secondByte = 0;
      for (let i=0; i<b.length; i++) {
        secondByte += parseInt(b[i])*(4**(3-i));
      }

      console.log(firstByte, secondByte);

      const buffer = Buffer.alloc(1 + 1 + 1 + 1 + 1 + 1 + 4 + nameBytes.length);
      let offset = 0;
      buffer.writeUint8(instructionTag, offset);
      offset += 1;
      buffer.writeUint8(firstByte, offset);
      offset += 1;
      buffer.writeUInt8(secondByte, offset);
      offset += 1;
      buffer.writeUInt8((formData.addMembersLater ? 1 : 0), offset);
      offset += 1;
      buffer.writeUint8(formData.memberAddresses.length, offset); // current number of members
      offset += 1;
      buffer.writeUint8((formData.addMembersLater ? formData.maxMemberCount : 20), offset); // max number of members
      offset += 1;
      buffer.writeUint32LE(tags, offset);
      offset += 4;
      nameBytes.copy(buffer, offset);

      const instructionData = buffer;
      console.log(instructionData);

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), wallet.publicKey.toBuffer()],
        programId
      );

      const [fundPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("light-fund"), Buffer.from(formData.fundName)],
        programId,
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), fundPda.toBuffer()],
        programId,
      );

      const [proposalAggregatorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal-aggregator"), Buffer.from([0]), fundPda.toBuffer()],
        programId,
      );

      const keys = [
        {pubkey: wallet.publicKey, isSigner: true, isWritable: true},
        {pubkey: userAccountPda, isSigner: false, isWritable: true},
        {pubkey: vaultPda, isSigner: false, isWritable: true},
        {pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false},
        {pubkey: fundPda, isSigner: false, isWritable: true},
        {pubkey: proposalAggregatorPda, isSigner: false, isWritable: true},
      ];
      
      if (!formData.addMembersLater) {
        for (const address of formData.memberAddresses) {
          keys.push({pubkey: new PublicKey(address), isSigner: false, isWritable: true});
        }
        for (const address of formData.memberAddresses) {
          const member = new PublicKey(address);
          const [memberPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("user"), member.toBuffer()],
            programId,
          );
          const memberInfo = await connection.getAccountInfo(memberPda);
          if (!memberInfo) {
            toast.error("All invited members should have an account on PeerFunds");
            return;
          }
          keys.push({pubkey: memberPda, isSigner: false, isWritable: true});
        }
      }

      const instruction = new TransactionInstruction({
        keys,
        programId,
        data: instructionData,
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

      setIsCreating(false);

    } catch (err) {
      console.log(err);
      setIsCreating(false);
    }
  }
  

  const steps = [
    { number: 1, title: 'Fund Details', icon: Zap },
    { number: 2, title: 'Members', icon: Users },
    { number: 3, title: 'Tags & Review', icon: Tag }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900 p-4 flex relative">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Vertical Progress Steps */}
      <div className="flex justify-center w-[15%] h-full fixed top-16">
        <div className="relative flex flex-col items-start space-y-0 w-full pl-3">
          <div className='flex pl-36'>
            <div className={`h-24 transition-all duration-300 bg-gradient-to-r from-purple-600 to-indigo-600 w-1.5`} />
            <div className={`h-24 transition-all duration-300 bg-gradient-to-r from-purple-600 to-indigo-600 w-1.5`} />
          </div>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <div key={step.number} className="flex items-center justify-end pr-7 space-x-4 relative z-10 w-full">
                {/* Step Text */}
                <span className={`absolute -left-2 top-7 text-md font-medium w-28 text-right ${
                  isActive ? 'text-purple-300' : 'text-gray-500'
                }`}>
                  {step.title}
                </span>

                {/* Circle + Line Container */}
                <div className="flex flex-col items-center">
                  {/* Circle */}
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg shadow-violet-500/25'
                      : isActive
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-purple-500 shadow-lg shadow-purple-500/25'
                      : 'bg-slate-800 border-slate-600'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : (
                      <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    )}
                  </div>

                  {/* Vertical Line */}
                  <div className={`flex ${isCompleted ? '' : 'gap-1'}`}>
                    {index < steps.length - 1 && (
                      <div className={`w-1 h-12 transition-all duration-300 ${
                        isCompleted ? 'bg-gradient-to-r from-purple-600 to-indigo-600 w-1.5' : 'bg-slate-700'
                      }`} />
                    )}
                    {index < steps.length - 1 && (
                      <div className={`w-1 h-12 transition-all duration-300 ${
                        isCompleted ? 'bg-gradient-to-r from-purple-600 to-indigo-600 w-1.5' : 'bg-slate-700'
                      }`} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div className='flex pl-36 gap-1'>
            <div className={`h-96 transition-all duration-300 bg-slate-700 w-1`} />
            <div className={`h-96 transition-all duration-300 bg-slate-700 w-1`} />
          </div>
        </div>
      </div>

      <div className="w-full mx-auto relative">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent mb-2">
            Create Your Fund
          </h1>
          <p className="text-gray-400">Build a decentralized multisig fund in minutes</p>
        </div>

        <div className='flex w-full gap-10 justify-center relative pl-10'>

          {/* Main Form */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl px-8 py-6 w-[65%] border-indigo-900 shadow-[0_0_10px_#6d28d9aa]">
            <AnimatePresence mode='wait'>
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
            {/* Step 1: Fund Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className='flex justify-between'>
                  <div className="text-start">
                    <h2 className="text-2xl font-bold text-white mb-2">Fund Details</h2>
                    <p className="text-gray-400">Let's start with the basics</p>
                  </div>
                  <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border-purple-500/30 rounded-full px-6 py-3 mb-4">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span className="text-purple-300 font-semibold">Light Fund Creation</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Fund Name
                      <span className="text-purple-400 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.fundName}
                        onChange={(e) => setFormData(prev => ({ ...prev, fundName: e.target.value }))}
                        maxLength={32}
                        className={`w-full px-4 py-3 bg-slate-900/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-300 ${
                          errors.fundName 
                            ? 'border-red-500 focus:ring-red-500/20' 
                            : 'border-slate-600 focus:border-purple-500 focus:ring-purple-500/20'
                        }`}
                        placeholder="Enter your fund name"
                      />
                      <span className={`absolute right-3 top-3 text-sm ${
                        formData.fundName.length > 28 ? 'text-orange-400' : 'text-gray-500'
                      }`}>
                        {formData.fundName.length}/32
                      </span>
                    </div>
                    {errors.fundName && (
                      <p className="mt-2 text-sm text-red-400 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.fundName}
                      </p>
                    )}
                  </div>

                  {/* Rent Cost Display */}
                  <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-2 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className='flex gap-3'>
                            <h3 className="text-lg font-semibold text-white">Creation Cost</h3>
                            <div className="flex justify-end">
                              <button
                                onClick={() => setShowCreationDetails(true)}
                                className="text-sm font-medium text-purple-400 hover:text-pink-400 transition-colors">
                                Details
                              </button>
                            </div>
                          </div>
                          <p className="text-gray-400 text-sm">One-time fund creation fee</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                          {rentCost} SOL
                        </p>
                        <p className="text-gray-400 text-sm">≈ ${(rentCost * 140).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Members */}
            {currentStep === 2 && (
              <div className="space-y-2">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Fund Members</h2>
                  <p className="text-gray-400">Add members to your multisig fund</p>
                </div>

                <div className="space-y-2">
                  {/* Add Members Toggle */}
                  <div className="w-fit mx-auto bg-slate-800 rounded-full p-1 flex gap-1 relative border">
                    {/* Active background indicator */}
                    <div
                      className={`absolute top-1 h-10 w-[48.5%] rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 ${
                        formData.addMembersLater ? 'translate-x-full' : ''
                      }`}
                    />

                    {/* Toggle options */}
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, addMembersLater: false }))}
                      className={`z-10 w-32 text-sm font-semibold h-10 rounded-full transition-all duration-200 ${
                        !formData.addMembersLater ? 'text-white' : 'text-gray-300 hover:bg-slate-700'
                      }`}
                    >
                      Add Now
                    </button>
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, addMembersLater: true }))}
                      className={`z-10 w-32 text-sm font-semibold h-10 rounded-full transition-all duration-200 ${
                        formData.addMembersLater ? 'text-white' : 'text-gray-300 hover:bg-slate-700'
                      }`}
                    >
                      Add Later
                    </button>
                  </div>

                  {formData.addMembersLater ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Maximum number of members <span className='text-xs text-indigo-400'>(including you)</span>
                      </label>
                      <div className='relative'>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={formData.maxMemberCount}
                          onChange={(e) => setFormData(prev => ({ ...prev, maxMemberCount: parseInt(e.target.value)}))}
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        />
                      <span className={`absolute right-3 top-3 text-sm ${
                        formData.maxMemberCount > 19 ? 'text-orange-400' : 'text-gray-500'
                      }`}>
                        Max 20
                      </span>                        
                      </div>
                      
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2">
                        <div className="flex items-center space-x-3">
                          <Shield className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="text-blue-300 font-medium">
                              Multisig Type: <span className='font-semibold text-violet-300'>{getMultisigType(formData.maxMemberCount)}</span>
                            </p>
                            <p className="text-blue-400/70 text-sm">
                              {formData.maxMemberCount&1 ? (formData.maxMemberCount + 1)/2 : (formData.maxMemberCount / 2) + 1} signatures required out of {formData.maxMemberCount} members
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-md font-medium text-gray-300">
                          Member Wallet Addresses
                        </label>
                        <button
                          onClick={addMemberAddress}
                          className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white text-sm font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Member</span>
                        </button>
                      </div>

                      <div className={`space-y-3 max-h-40 overflow-y-auto scrollbar-none ${
                        formData.memberAddresses.length === 0 ?
                        '' :
                        'border-x p-2'
                      }`}>
                        {formData.memberAddresses.map((address, index) => (
                          <div key={index} className="flex items-center space-x-3">
                            <div className="flex-1 relative">
                              <Wallet className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                              <input
                                required={true}
                                type="text"
                                value={address}
                                onChange={(e) => updateMemberAddress(index, e.target.value)}
                                className="w-full pl-12 pr-4 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                placeholder="Wallet address"
                              />
                            </div>
                            <button
                              onClick={() => removeMemberAddress(index)}
                              className="p-1 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-all duration-300"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {formData.memberAddresses.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2">
                          <div className="flex items-center space-x-3">
                            <Shield className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-blue-300 font-medium">
                                Multisig Type: <span className='font-semibold text-violet-300'>{getMultisigType(formData.memberAddresses.length + 1)}</span>
                              </p>
                              <p className="text-blue-400/70 text-sm">
                                {Math.ceil((formData.memberAddresses.length + 1) * ((formData.memberAddresses.length + 1) <= 3 ? 0.67 : (formData.memberAddresses.length + 1) <= 7 ? 0.6 : 0.55))} signatures required out of {formData.memberAddresses.length + 1} members
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {errors.members && (
                        <p className="text-sm text-red-400 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.members}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Member Cost Display */}
                  <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className='flex gap-3'>
                            <h3 className="text-lg font-semibold text-white">Member Invitation Cost</h3>
                            {!formData.addMembersLater && (
                              <div className="flex justify-end">
                                <button
                                  onClick={() => setShowCreationDetails(true)}
                                  className="text-sm font-medium text-purple-400 hover:text-pink-400 transition-colors">
                                  Details
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm">Refunded when members join</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                          {formData.addMembersLater ? '0.00' : (memberCost === 0 ? '0.00' : (memberCost.toFixed(6)))} SOL
                        </p>
                        <p className="text-gray-400 text-sm">≈ ${formData.addMembersLater ? '0.00' : (memberCost * 140).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Tags & Review */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Fund Tags & Review</h2>
                  <p className="text-gray-400">Customize your fund's characteristics</p>
                </div>

                <div className="space-y-4 flex justify-between items-center">
                  <div className='w-[40%] max-h-96 overflow-auto'>
                    <label className="block text-sm font-medium text-gray-300 mb-4">
                      Fund Tags
                      <span className="text-gray-500 ml-2">(Auto-selected tags cannot be removed)</span>
                    </label>
                    <div className="flex flex-wrap gap-2 overflow-y-auto px-1 py-1">
                      {fundTags.map((tag) => {
                        const isSelected = formData.selectedTags.includes(tag.id);
                        const isAuto = tag.auto;

                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            disabled={isAuto}
                            className={`relative group px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 border
                              ${isSelected
                                ? 'text-violet-500 border-violet-500 shadow-md scale-[1.02]'
                                : 'bg-[#1e293b] text-gray-300 border-slate-600 hover:bg-slate-600/50 hover:text-white'}
                              ${isAuto ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-100'}
                            `}
                          >
                            <span className="whitespace-nowrap">{tag.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Final Review */}
                  <div className="w-[55%] bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600 rounded-xl p-6 space-y-4">
                    <h3 className="text-xl font-bold text-white mb-4">Fund Summary</h3>
                    
                    <div className="flex flex-col justify-between">
                      <div className="space-y-1 h-[55%]">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Fund Name:</span>
                          <span className="text-white font-medium">{formData.fundName || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Members:</span>
                          <span className="text-white font-medium">
                            {formData.addMembersLater ? formData.maxMemberCount : formData.memberAddresses.length + 1}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Multisig Type:</span>
                          <span className="text-white font-medium">
                            {formData.addMembersLater 
                              ? getMultisigType(formData.maxMemberCount)
                              : getMultisigType(formData.memberAddresses.length + 1)
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Tags:</span>
                          <span className="text-white font-medium">{formData.selectedTags.length}</span>
                        </div>
                      </div>

                      <div className='border border-dashed my-4'></div>
                      
                      <div className="space-y-2 h-[40%]">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Creation Cost:</span>
                          <span className="text-white font-medium">{rentCost.toFixed(5)} SOL</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Member Cost:</span>
                          <span className="text-white font-medium">{(formData.addMembersLater ? 0 : memberCost).toFixed(5)} SOL</span>
                        </div>
                        <div className="border-t border-slate-600 pt-3">
                          <div className="flex justify-between">
                            <span className="text-gray-300 font-medium">Total:</span>
                            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                              {(rentCost + (formData.addMembersLater ? 0 : memberCost)).toFixed(5)} SOL
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-700">
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  currentStep === 1
                    ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-slate-700 text-white hover:bg-slate-600 hover:shadow-lg'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>

              <div className="flex items-center space-x-2">
                {currentStep < 3 ? (
                  <button
                    onClick={nextStep}
                    className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105"
                  >
                    <span>Continue</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsCreating(true);
                      handleCreate();
                    }}
                    disabled={isCreating}
                    className={`flex items-center space-x-2 px-8 py-3 ${
                      isCreating ?
                      'bg-gradient-to-r from-gray-500 to-gray-500 rounded-xl cursor-not-allowed' :
                      'bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl'
                    } text-white font-medium hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 transform`}
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>{isCreating ? 'Creating...' : 'Create Fund'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Cost Summary */}
        <div className="fixed bottom-6 right-6 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-sm shadow-indigo-500">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Total Cost</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {(rentCost + (formData.addMembersLater ? 0 : memberCost)).toFixed(5)} SOL
            </p>
            <p className="text-gray-500 text-xs">≈ ${((rentCost + (formData.addMembersLater ? 0 : memberCost)) * 140).toFixed(2)}</p>
          </div>
        </div>
      </div>
      {showCreationDetails && (
        <div onClick={(e) => {
          if (e.target === e.currentTarget) setShowCreationDetails(false);
        }} className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md'>
          <div className='bg-gradient-to-br from-[#1f1f2f] to-[#2b2b40] p-6 rounded-2xl w-[90%] max-w-xl border border-indigo-900/40 shadow-[0_0_25px_#7c3aed33] text-white space-y-6 animate-fadeIn'>

            {currentStep === 1 ? (
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-indigo-300">Creating This Fund</h2>

                {/* Info Text */}
                <p className="text-sm text-indigo-100 leading-relaxed">
                  You will need to pay a small amount of{" "}
                  {rentCost === null ? (
                    <span className="inline-block w-20 h-4 bg-indigo-700/30 rounded-md animate-pulse" />
                  ) : (
                    <span className="font-semibold text-indigo-400">
                      {rentCost.toFixed(5)}
                    </span>
                  )}{" "}
                  <span className='text-indigo-400'>SOL</span> to create this fund. <br />
                  <span>A part of this cost will be refunded to the you when the invited members join and refund amount increase as more members are invited.</span>
                  <div className='border border-dashed my-2'></div>
                  <ul className="list-disc pl-5 space-y-3 text-indigo-100 text-sm">
                    <li>A unique <strong>Fund Account (Multisig)</strong> is created to store general fund information. This is <em>not</em> user-specific.</li>
                    <li>A <strong>Vault Account</strong> is initialized to securely hold all fund assets and tokens.</li>
                    <li>View everything on the <a href="https://github.com/Shivam-Gujjar-Boy/investment-fund" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">official GitHub</a>.</li>
                    <li>A <strong>Proposal Aggregator PDA Account</strong> is created which hold all the fund's proposals data.</li>
                    <li>Fund creation costs ~<strong>{(rentCost - 0.000355).toFixed(5)} SOL</strong>. You'll get refund only from this cost.</li>
                    <li>Extra ~<strong>0.000355 SOL</strong> is to increase size of your account to store this fund-specifc data.</li>
                    <li>
                      You must specify how many members you <strong>expect to join</strong> the fund in the future.
                      This number directly affects your refund eligibility.
                    </li>
                    <li>
                      When members join, a pre-calculated amount of SOL is deducted and immediately sent to your wallet address (fully on-chain).
                    </li>
                  </ul>
                  <div className='border border-dashed my-2'></div>
                </p>

                {/* Total */}
                <p className="pt-1">
                  Required:&nbsp;
                  {rentCost === null ? (
                    <span className="inline-block w-24 h-5 bg-indigo-700/30 rounded-md animate-pulse" />
                  ) : (
                    <span className="text-green-400 font-medium">{(rentCost).toFixed(5)} SOL</span>
                  )}
                </p>
              </div>
            ): (
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-indigo-300">Inviting Members</h2>

                {/* Info Text */}
                <div className="text-sm text-indigo-100 leading-relaxed space-y-2">
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      Each invite costs <span className="font-semibold text-indigo-400">~0.000355 SOL</span> for member account upgrade.
                    </li>
                    <li>
                      This invite cost is <span className="text-indigo-400 font-medium">fully refunded</span> to you when the member joins.
                    </li>
                    <li>
                      Joining members also pay a small fund creation fee — instantly refunded to you.
                    </li>
                    <li>
                      All refunds happen <span className="text-indigo-400 font-medium">on-chain, instantly</span>, no manual steps.
                    </li>
                    <li>
                      The more members join, the more of your original creation cost gets refunded.
                    </li>
                  </ul>

                  <p className="text-sm text-indigo-300">
                    ⚠️ Refunds depend on expected member count — set it wisely to maximize your returns.
                  </p>
                </div>
                {/* Total */}
                <p className="pt-1">
                  Required:&nbsp;
                  {memberCost === null ? (
                    <span className="inline-block w-24 h-5 bg-indigo-700/30 rounded-md animate-pulse" />
                  ) : (
                    <span className="text-green-400 font-medium">{(memberCost).toFixed(5)} SOL</span>
                  )}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowCreationDetails(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LightFund;