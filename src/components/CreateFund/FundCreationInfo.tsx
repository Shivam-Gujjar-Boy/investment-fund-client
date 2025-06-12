import React, { useRef, useState, useEffect } from 'react';

interface FundCreationInfoProps {
  handleSubmit: () => void;
  setStep: (step: number) => void;
  isSubmitting: boolean;
}

const FundCreationInfo: React.FC<FundCreationInfoProps> = ({
  handleSubmit,
  setStep,
  isSubmitting,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [expectedMembers, setExpectedMembers] = useState<number | ''>('');
  const [hasTouchedInput, setHasTouchedInput] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
        setHasScrolledToEnd(true);
      }
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const isFormValid = isChecked && Number(expectedMembers) > 0;

  return (
    <div className="space-y-6">
      <div
        ref={scrollRef}
        className="bg-[#2b2e49] border border-indigo-700 rounded-xl p-4 max-h-96 overflow-y-auto scroll-smooth"
      >
        <h2 className="text-indigo-300 text-lg font-semibold mb-4">Important Note Points (1 minute read)</h2>

        <ul className="list-disc pl-5 space-y-3 text-indigo-100 text-sm">
          <li>A unique <strong>Fund PDA Account</strong> is created to store general fund information. This is <em>not</em> user-specific.</li>
          <li>A <strong>Vault PDA Account</strong> is initialized to securely hold all fund assets and tokens.</li>
          <li>A <strong>Governance Mint Account</strong> is created to issue governance tokens to members.</li>
          <li>Tokens are earned with deposits and burnt on withdrawals. All logic is transparent and on-chain.</li>
          <li>View everything on the <a href="https://github.com/PeerFunds" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">official GitHub</a>.</li>
          <li>Metadata and user PDAs are also updated accordingly during fund activity.</li>
          <li>Fund creation costs ~<strong>0.022 SOL</strong>.</li>
          <li>
            You must specify how many members you <strong>expect to join</strong> the fund in the future.
            This number directly affects your refund eligibility.
          </li>
          <li>
            When members join, a fixed amount of SOL is deducted and stored in PeerFunds’ rent reserve.
            You will only be <strong>refunded</strong> once the expected number of members has joined.
          </li>
        </ul>

        <div className="mt-6">
          <label className="block text-indigo-200 text-sm font-medium">
            Expected Number of Members <span className="text-red-400">*</span>
          </label>
          <span className='text-xs'>(Be mindful, since you will get creation refund only when this strength is reached)</span>
          <input
            type="number"
            min={1}
            value={expectedMembers}
            onChange={(e) => setExpectedMembers(e.target.value ? parseInt(e.target.value) : '')}
            onBlur={() => setHasTouchedInput(true)}
            className="w-full mt-1 bg-[#1a1d36] border border-indigo-800 rounded-lg px-3 py-2 text-white text-sm placeholder:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            placeholder="e.g. 5"
            required
          />
          {hasTouchedInput && (!expectedMembers || expectedMembers <= 0) && (
            <p className="text-red-400 text-xs mt-1">Please enter a valid number of members.</p>
          )}
        </div>

        {hasScrolledToEnd && (
          <div className="mt-6">
            <label className="flex items-center space-x-2 text-sm text-indigo-200">
              <input
                type="checkbox"
                className="accent-indigo-500"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
              />
              <span>I acknowledge and accept all the information provided above.</span>
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-4 pt-2">
        <button
          onClick={() => setStep(1)}
          className="w-1/2 py-3 px-4 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          className={`w-1/2 py-3 px-4 rounded-xl font-semibold text-white transition-all ${
            !isFormValid || isSubmitting
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-700 to-purple-600 hover:from-indigo-600 hover:to-purple-500 shadow-md'
          }`}
        >
          {isSubmitting ? 'Creating...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
};

export default FundCreationInfo;
