import JoinFundForm from '../components/JoinFund/JoinFundForm';

export default function Join() {
  return (
    <div className="py-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Join a Fund</h1>
          <p className="text-gray-400 mt-2">
            Join an existing investment fund using a fund code
          </p>
        </div>
        
        <JoinFundForm />
      </div>
    </div>
  );
}