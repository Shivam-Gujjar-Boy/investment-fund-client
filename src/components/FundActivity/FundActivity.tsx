interface FundActivityProps {
  activities?: string[];
}

export default function FundActivity({ activities }: FundActivityProps) {
  const dummyActivities = [
    'Alice deposited 100 USDC',
    'Bob withdrew 50 USDC',
    'Charlie voted on Proposal #1'
  ];

  const displayActivities = activities || dummyActivities;

  return (
    <div className="bg-[#1f2937] p-6 max-h-40 overflow-y-auto">
      <h2 className="text-xl font-semibold mb-3">Activity</h2>
      <ul className="text-sm list-disc list-inside space-y-1">
        {displayActivities.map((activity, idx) => (
          <li key={idx}>{activity}</li>
        ))}
      </ul>
    </div>
  );
}