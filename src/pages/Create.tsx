import CreateFundForm from '../components/CreateFund/CreateFundForm';

export default function Create() {
  return (
    <div className="py-8 bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Create a New Fund</h1>
          <p className="text-gray-400 mt-2">
            Set up an investment fund and invite others to join
          </p>
        </div>
        
        <CreateFundForm />
      </div>
    </div>
  );
}