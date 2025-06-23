import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Wallet, Users, Tag, Zap, Shield, DollarSign, CheckCircle, AlertCircle, Sparkles, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface FundTag {
  id: string;
  name: string;
  auto: boolean;
  color: string;
}

interface FormData {
  fundName: string;
  memberCount: number;
  memberAddresses: string[];
  addMembersLater: boolean;
  selectedTags: string[];
}

interface FormErrors {
  fundName?: string;
  members?: string;
  memberCount?: string;
}

interface Step {
  number: number;
  title: string;
  icon: React.ComponentType<any>;
}

const LightFund = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>({
    fundName: '',
    memberCount: 3,
    memberAddresses: [],
    addMembersLater: true,
    selectedTags: []
  });
  const [rentCost, setRentCost] = useState<number>(0.025);
  const [memberCost, setMemberCost] = useState<number>(0);
  const [errors, setErrors] = useState<FormErrors>({});

  const fundTags = [
    { id: 'light-fund', name: 'Light Fund', auto: true, color: 'from-blue-500 to-cyan-500' },
    { id: 'no-governance', name: 'No Governance', auto: true, color: 'from-purple-500 to-pink-500' },
    { id: 'multisig', name: 'Multisig', auto: true, color: 'from-green-500 to-emerald-500' },
    { id: 'instant-withdraw', name: 'Instant Withdraw', auto: false, color: 'from-orange-500 to-red-500' },
    { id: 'time-locked', name: 'Time Locked', auto: false, color: 'from-indigo-500 to-purple-500' },
    { id: 'democratic', name: 'Democratic', auto: false, color: 'from-pink-500 to-rose-500' },
    { id: 'treasury', name: 'Treasury', auto: false, color: 'from-yellow-500 to-orange-500' },
    { id: 'investment', name: 'Investment', auto: false, color: 'from-teal-500 to-blue-500' },
    { id: 'dao', name: 'DAO', auto: false, color: 'from-violet-500 to-purple-500' },
    { id: 'defi', name: 'DeFi', auto: false, color: 'from-cyan-500 to-blue-500' },
    { id: 'yield-farming', name: 'Yield Farming', auto: false, color: 'from-lime-500 to-green-500' },
    { id: 'staking', name: 'Staking', auto: false, color: 'from-emerald-500 to-teal-500' },
    { id: 'nft', name: 'NFT', auto: false, color: 'from-rose-500 to-pink-500' },
    { id: 'gaming', name: 'Gaming', auto: false, color: 'from-purple-500 to-indigo-500' },
    { id: 'social', name: 'Social', auto: false, color: 'from-pink-500 to-purple-500' },
    { id: 'charity', name: 'Charity', auto: false, color: 'from-green-500 to-lime-500' },
    { id: 'research', name: 'Research', auto: false, color: 'from-blue-500 to-indigo-500' },
    { id: 'education', name: 'Education', auto: false, color: 'from-indigo-500 to-blue-500' },
    { id: 'privacy', name: 'Privacy', auto: false, color: 'from-gray-500 to-slate-500' },
    { id: 'cross-chain', name: 'Cross Chain', auto: false, color: 'from-rainbow-500 to-rainbow-600' },
    { id: 'layer2', name: 'Layer 2', auto: false, color: 'from-blue-500 to-purple-500' },
    { id: 'experimental', name: 'Experimental', auto: false, color: 'from-red-500 to-orange-500' },
    { id: 'stable', name: 'Stable', auto: false, color: 'from-green-500 to-blue-500' },
    { id: 'high-risk', name: 'High Risk', auto: false, color: 'from-red-500 to-pink-500' },
    { id: 'low-risk', name: 'Low Risk', auto: false, color: 'from-green-500 to-emerald-500' },
    { id: 'long-term', name: 'Long Term', auto: false, color: 'from-blue-500 to-indigo-500' },
    { id: 'short-term', name: 'Short Term', auto: false, color: 'from-orange-500 to-red-500' },
    { id: 'automated', name: 'Automated', auto: false, color: 'from-purple-500 to-blue-500' },
    { id: 'manual', name: 'Manual', auto: false, color: 'from-gray-500 to-blue-500' },
    { id: 'transparent', name: 'Transparent', auto: false, color: 'from-cyan-500 to-teal-500' },
    { id: 'private', name: 'Private', auto: false, color: 'from-slate-500 to-gray-500' },
    { id: 'community', name: 'Community', auto: false, color: 'from-pink-500 to-purple-500' }
  ];

  const getMultisigType = (count: number): string => {
    if (count <= 3) return `${Math.ceil(count * 0.67)}/${count}`;
    if (count <= 7) return `${Math.ceil(count * 0.6)}/${count}`;
    return `${Math.ceil(count * 0.55)}/${count}`;
  };

  useEffect(() => {
    // Auto-select required tags
    const autoTags = fundTags.filter(tag => tag.auto).map(tag => tag.id);
    setFormData(prev => ({
      ...prev,
      selectedTags: [...new Set([...prev.selectedTags, ...autoTags])]
    }));
  }, []);

  useEffect(() => {
    // Calculate member cost
    const baseCost = 0.001;
    const memberCount = formData.addMembersLater ? formData.memberCount : formData.memberAddresses.length;
    setMemberCost(baseCost * memberCount);
  }, [formData.memberCount, formData.memberAddresses, formData.addMembersLater]);

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
      if (formData.addMembersLater && formData.memberCount < 2) {
        newErrors.memberCount = 'Minimum 2 members required';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev: number) => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev: number) => Math.max(prev - 1, 1));
  };

  const addMemberAddress = () => {
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
  

  const steps = [
    { number: 1, title: 'Fund Details', icon: Zap },
    { number: 2, title: 'Members', icon: Users },
    { number: 3, title: 'Tags & Review', icon: Tag }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900 p-4 mt-2">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="w-full mx-auto relative">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent mb-2">
            Create Your Fund
          </h1>
          <p className="text-gray-400">Build a decentralized multisig fund in minutes</p>
        </div>

        <div className='flex w-full gap-10 items-start relative'>
          {/* Vertical Progress Steps */}
          <div className="flex justify-center w-[15%] h-full">
            <div className="relative flex flex-col items-start space-y-0 pt-4">

              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.number;
                const isCompleted = currentStep > step.number;

                return (
                  <div key={step.number} className="flex items-center space-x-4 relative z-10">
                    {/* Step Text */}
                    <span className={`text-md font-medium w-28 text-right ${
                      isActive ? 'text-purple-300' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </span>

                    {/* Circle + Line Container */}
                    <div className="flex flex-col items-center">
                      {/* Circle */}
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        isCompleted
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 border-green-500 shadow-lg shadow-green-500/25'
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
                      {index < steps.length - 1 && (
                        <div className={`w-0.5 h-12 transition-all duration-300 ${
                          isCompleted ? 'bg-gradient-to-b from-green-500 to-emerald-500' : 'bg-slate-700'
                        }`} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Main Form */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 w-[65%] border-indigo-900 shadow-[0_0_10px_#6d28d9aa]">
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
                          <h3 className="text-lg font-semibold text-white">Creation Cost</h3>
                          <p className="text-gray-400 text-sm">One-time fund creation fee</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                          {rentCost} SOL
                        </p>
                        <p className="text-gray-400 text-sm">≈ $5.25</p>
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
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                          Number of Members
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="20"
                          value={formData.memberCount}
                          onChange={(e) => setFormData(prev => ({ ...prev, memberCount: parseInt(e.target.value) || 2 }))}
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        />
                      </div>
                      
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                          <Shield className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="text-blue-300 font-medium">
                              Multisig Type: {getMultisigType(formData.memberCount)}
                            </p>
                            <p className="text-blue-400/70 text-sm">
                              {Math.ceil(formData.memberCount * (formData.memberCount <= 3 ? 0.67 : formData.memberCount <= 7 ? 0.6 : 0.55))} signatures required out of {formData.memberCount} members
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-300">
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

                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {formData.memberAddresses.map((address, index) => (
                          <div key={index} className="flex items-center space-x-3">
                            <div className="flex-1 relative">
                              <Wallet className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                              <input
                                type="text"
                                value={address}
                                onChange={(e) => updateMemberAddress(index, e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                placeholder="Wallet address"
                              />
                            </div>
                            <button
                              onClick={() => removeMemberAddress(index)}
                              className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-all duration-300"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {formData.memberAddresses.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                          <div className="flex items-center space-x-3">
                            <Shield className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-blue-300 font-medium">
                                Multisig Type: {getMultisigType(formData.memberAddresses.length + 1)}
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
                  <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">Member Invitation Cost</h3>
                          <p className="text-gray-400 text-sm">Refunded when members join</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                          {memberCost.toFixed(3)} SOL
                        </p>
                        <p className="text-gray-400 text-sm">≈ ${(memberCost * 210).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Tags & Review */}
            {currentStep === 3 && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Fund Tags & Review</h2>
                  <p className="text-gray-400">Customize your fund's characteristics</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-4">
                      Fund Tags
                      <span className="text-gray-500 ml-2">(Auto-selected tags cannot be removed)</span>
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                      {fundTags.map((tag) => {
                        const isSelected = formData.selectedTags.includes(tag.id);
                        const isAuto = tag.auto;
                        
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            disabled={isAuto}
                            className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 border ${
                              isSelected
                                ? `bg-gradient-to-r ${tag.color} text-white border-transparent shadow-lg`
                                : 'bg-slate-700/50 border-slate-600 text-gray-300 hover:bg-slate-600/50'
                            } ${isAuto ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                          >
                            {tag.name}
                            {isAuto && (
                              <div className="absolute -top-2 -right-2 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                                <span className="text-xs text-white font-bold">!</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Final Review */}
                  <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600 rounded-xl p-6 space-y-4">
                    <h3 className="text-xl font-bold text-white mb-4">Fund Summary</h3>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Fund Name:</span>
                          <span className="text-white font-medium">{formData.fundName || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Members:</span>
                          <span className="text-white font-medium">
                            {formData.addMembersLater ? formData.memberCount : formData.memberAddresses.length + 1}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Multisig Type:</span>
                          <span className="text-white font-medium">
                            {formData.addMembersLater 
                              ? getMultisigType(formData.memberCount)
                              : getMultisigType(formData.memberAddresses.length + 1)
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Tags:</span>
                          <span className="text-white font-medium">{formData.selectedTags.length}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Creation Cost:</span>
                          <span className="text-white font-medium">{rentCost} SOL</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Member Cost:</span>
                          <span className="text-white font-medium">{memberCost.toFixed(3)} SOL</span>
                        </div>
                        <div className="border-t border-slate-600 pt-3">
                          <div className="flex justify-between">
                            <span className="text-gray-300 font-medium">Total:</span>
                            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                              {(rentCost + memberCost).toFixed(3)} SOL
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
                    onClick={() => console.log('Create Fund', formData)}
                    className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 transform hover:scale-105"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>Create Fund</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Cost Summary */}
        <div className="fixed bottom-6 right-6 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Total Cost</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {(rentCost + memberCost).toFixed(3)} SOL
            </p>
            <p className="text-gray-500 text-xs">≈ ${((rentCost + memberCost) * 210).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LightFund;