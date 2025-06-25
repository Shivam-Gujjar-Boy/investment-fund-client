import FundsList from '../components/YourFunds/FundsList';

export default function YourFunds() {

  return (
    <div className="bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 min-h-screen">
      <div className="w-full mx-auto">
        <FundsList />
      </div>
    </div>
  );
}