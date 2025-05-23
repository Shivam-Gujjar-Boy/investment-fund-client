import FundsList from '../components/YourFunds/FundsList';

export default function YourFunds() {

  return (
    <div className="py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Your Funds</h1>
          <p className="text-gray-400 mt-2">
            Manage and view your investment funds
          </p>
        </div>
        
        <FundsList />
      </div>
    </div>
  );
}