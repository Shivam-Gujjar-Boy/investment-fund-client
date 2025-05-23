import React, { useState } from 'react';
// import './FundDetails.css'; // optional for CSS styles if separated

export default function FundDetails() {
  const [selectedProposal, setSelectedProposal] = useState(null);

  const dummyMembers = [
    { name: 'Alice', investment: 100 },
    { name: 'Bob', investment: 200 },
    { name: 'Charlie', investment: 150 },
  ];

  const dummyActivities = [
    'Alice deposited 100 USDC',
    'Bob withdrew 50 USDC',
    'Charlie voted on Proposal #1'
  ];

  const dummyProposals = [
    { id: 1, title: 'Increase investment cap', description: 'Proposal to increase cap to 10,000 USDC' },
    { id: 2, title: 'Change governance threshold', description: 'Proposal to change voting threshold to 60%' },
  ];

  return (
    <div className="p-4 text-white min-h-screen bg-gradient-to-b from-[#0e1117] to-[#1b1f27]">
      <h1 className="text-2xl font-bold mb-4">Fund Details</h1>

      <div className="grid grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* Fund Info / Graph */}
          <div className="bg-[#1f2937] p-4 rounded-xl">
            <h2 className="text-xl font-semibold mb-2">Fund Value Graph</h2>
            <div className="h-40 bg-gray-700 rounded" />
            <div className="flex gap-2 mt-2">
              {["1m", "1h", "1d", "1w", "1m"].map(label => (
                <button key={label} className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700">{label}</button>
              ))}
            </div>
          </div>

          {/* Members Info */}
          <div className="bg-[#1f2937] p-4 rounded-xl max-h-40 overflow-y-auto">
            <h2 className="text-xl font-semibold mb-2">Members</h2>
            <ul className="text-sm">
              {dummyMembers.map((m, idx) => (
                <li key={idx}>{m.name}: {m.investment} USDC</li>
              ))}
            </ul>
          </div>

          {/* Activities */}
          <div className="bg-[#1f2937] p-4 rounded-xl max-h-40 overflow-y-auto">
            <h2 className="text-xl font-semibold mb-2">Activity</h2>
            <ul className="text-sm list-disc list-inside">
              {dummyActivities.map((a, idx) => (
                <li key={idx}>{a}</li>
              ))}
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded">Deposit</button>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">Invite</button>
            <button className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded">Withdraw</button>
          </div>
        </div>

        {/* Right Column - Proposals */}
        <div className="bg-[#1f2937] p-4 rounded-xl overflow-y-auto max-h-[calc(100vh-6rem)]">
          <h2 className="text-xl font-semibold mb-4">Proposals</h2>
          {dummyProposals.map(p => (
            <div
              key={p.id}
              className="bg-gray-800 p-3 mb-4 rounded cursor-pointer hover:bg-gray-700"
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('button')) {
                  setSelectedProposal(p);
                }
              }}
            >
              <div className="text-lg font-medium mb-2">{p.title}</div>
              <div className="flex justify-end gap-2">
                <button className="bg-green-600 px-3 py-1 rounded">YES</button>
                <button className="bg-red-600 px-3 py-1 rounded">NO</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Proposal Modal */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-[#1f2937] p-6 rounded-xl w-1/2 text-white">
            <h2 className="text-2xl font-semibold mb-4">{selectedProposal.title}</h2>
            <p className="mb-4">{selectedProposal.description}</p>
            <div className="flex gap-4 justify-end">
              <button className="bg-green-600 px-4 py-2 rounded">YES</button>
              <button className="bg-red-600 px-4 py-2 rounded">NO</button>
              <button className="bg-gray-600 px-4 py-2 rounded" onClick={() => setSelectedProposal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
