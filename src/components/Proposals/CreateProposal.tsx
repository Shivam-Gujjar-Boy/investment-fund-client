import React, { useState } from 'react';
import { X, Plus, Trash2, ArrowRight, ArrowLeft, Calendar, Tag, DollarSign } from 'lucide-react';

// Define interfaces for type safety
interface Swap {
  fromToken: string;
  fromAmount: string;
  toToken: string;
  slippage: string;
}

interface ProposalData {
  title: string;
  description: string;
  swaps: Swap[];
  tags: string[];
  deadline: string;
}

const App: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [proposalData, setProposalData] = useState<ProposalData>({
    title: '',
    description: '',
    swaps: [{ fromToken: '', fromAmount: '', toToken: '', slippage: '0.5' }],
    tags: [],
    deadline: ''
  });

  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState<boolean>(false);

  // Available tags list
  const availableTags: string[] = [
    'profit-making',
    'urgent',
    'low-risk',
    'high-yield',
    'defi',
    'arbitrage',
    'liquidity',
    'governance',
    'staking',
    'yield-farming',
    'cross-chain',
    'experimental',
    'conservative',
    'long-term',
    'short-term',
    'community',
    'partnership',
    'research',
    'development',
    'marketing'
  ];

  const handleInputChange = (field: keyof ProposalData, value: string) => {
    setProposalData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSwapChange = (index: number, field: keyof Swap, value: string) => {
    const updatedSwaps = [...proposalData.swaps];
    updatedSwaps[index][field] = value;
    setProposalData(prev => ({
      ...prev,
      swaps: updatedSwaps
    }));
  };

  const addSwap = () => {
    setProposalData(prev => ({
      ...prev,
      swaps: [...prev.swaps, { fromToken: '', fromAmount: '', toToken: '', slippage: '0.5' }]
    }));
  };

  const removeSwap = (index: number) => {
    if (proposalData.swaps.length > 1) {
      const updatedSwaps = proposalData.swaps.filter((_, i) => i !== index);
      setProposalData(prev => ({
        ...prev,
        swaps: updatedSwaps
      }));
    }
  };

  const addTag = (tag: string) => {
    if (!proposalData.tags.includes(tag)) {
      setProposalData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
    setIsTagDropdownOpen(false);
  };

  const removeTag = (tagToRemove: string) => {
    setProposalData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    console.log('Proposal Created:', proposalData);
    alert('Proposal created successfully!');
    setIsFormOpen(false);
    setCurrentStep(1);
    setProposalData({
      title: '',
      description: '',
      swaps: [{ fromToken: '', fromAmount: '', toToken: '', slippage: '0.5' }],
      tags: [],
      deadline: ''
    });
    setIsTagDropdownOpen(false);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setCurrentStep(1);
    setProposalData({
      title: '',
      description: '',
      swaps: [{ fromToken: '', fromAmount: '', toToken: '', slippage: '0.5' }],
      tags: [],
      deadline: ''
    });
    setIsTagDropdownOpen(false);
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return proposalData.title.trim() && proposalData.description.trim();
      case 2:
        return proposalData.swaps.every(swap => 
          swap.fromToken.trim() && swap.fromAmount.trim() && swap.toToken.trim()
        );
      case 3:
        return !!proposalData.deadline;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className=" mx-auto">

        {/* Proposals Section */}
        <div className="bg-slate-800 rounded-xl p-2 mb-8">

            <div className="bg-slate-900 rounded-xl p-6 w-full">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Create Proposal</h2>
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">Step {currentStep} of 3</span>
                  <span className="text-sm text-gray-400">
                    {currentStep === 1 ? 'Basic Info' : currentStep === 2 ? 'Swaps' : 'Details'}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentStep / 3) * 100}%` }}
                  />
                </div>
              </div>

              {/* Step Content */}
              <div className="space-y-6">
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white mb-4">Basic Information</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Proposal Title *
                      </label>
                      <input
                        maxLength={50}
                        type="text"
                        value={proposalData.title}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('title', e.target.value)}
                        className="w-full bg-slate-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                        placeholder="Enter proposal title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Description *
                      </label>
                      <textarea
                        maxLength={100}
                        value={proposalData.description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('description', e.target.value)}
                        rows={4}
                        className="w-full bg-slate-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                        placeholder="Describe your proposal in detail"
                      />
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-semibold text-white">Token Swaps</h3>
                      <button
                        onClick={addSwap}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <Plus size={16} />
                        Add Swap
                      </button>
                    </div>

                    {proposalData.swaps.map((swap, index) => (
                      <div key={index} className="bg-slate-800 rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300 font-medium">Swap {index + 1}</span>
                          {proposalData.swaps.length > 1 && (
                            <button
                              onClick={() => removeSwap(index)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              From Token *
                            </label>
                            <input
                              type="text"
                              value={swap.fromToken}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSwapChange(index, 'fromToken', e.target.value)}
                              className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                              placeholder="e.g., USDC"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Amount *
                            </label>
                            <input
                              type="number"
                              value={swap.fromAmount}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSwapChange(index, 'fromAmount', e.target.value)}
                              className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              To Token *
                            </label>
                            <input
                              type="text"
                              value={swap.toToken}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSwapChange(index, 'toToken', e.target.value)}
                              className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                              placeholder="e.g., ETH"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Slippage (%)
                            </label>
                            <input
                              type="number"
                              value={swap.slippage}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSwapChange(index, 'slippage', e.target.value)}
                              className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                              placeholder="0.5"
                              step="0.1"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white mb-4">Final Details</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Tags
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                          className="w-full bg-slate-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-left focus:outline-none focus:border-purple-500 flex items-center justify-between"
                        >
                          <span className="text-gray-400">Select tags for your proposal</span>
                          <Tag size={16} className="text-gray-400" />
                        </button>
                        {isTagDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-gray-600 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                            {availableTags
                              .filter(tag => !proposalData.tags.includes(tag))
                              .map(tag => (
                                <button
                                  key={tag}
                                  onClick={() => addTag(tag)}
                                  className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors"
                                >
                                  {tag}
                                </button>
                              ))}
                            {availableTags.filter(tag => !proposalData.tags.includes(tag)).length === 0 && (
                              <div className="px-4 py-2 text-gray-400">All tags selected</div>
                            )}
                          </div>
                        )}
                      </div>
                      {proposalData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {proposalData.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
                            >
                              {tag}
                              <button
                                onClick={() => removeTag(tag)}
                                className="text-purple-200 hover:text-white"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Proposal Deadline *
                      </label>
                      <input
                        type="datetime-local"
                        value={proposalData.deadline}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('deadline', e.target.value)}
                        className="w-full bg-slate-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-700">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    currentStep === 1
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  <ArrowLeft size={16} />
                  Previous
                </button>
                <div className="flex gap-3">
                  {currentStep < 3 ? (
                    <button
                      onClick={handleNext}
                      disabled={!canProceed()}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                        canProceed()
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Next
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={!canProceed()}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                        canProceed()
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Create Proposal
                      <DollarSign size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;