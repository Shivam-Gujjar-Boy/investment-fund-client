import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Create from './Create';
import Join from './Join';
import YourFunds from './YourFunds';
import Portfolio from './Portfolio';
import Discover from './Discover';
import FundDetails from './FundDetails';

export default function Dashboard() {
  return (
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard/create" replace />} />
          <Route path="create" element={<Create />} />
          <Route path="join" element={<Join />} />
          <Route path="funds" element={<YourFunds />} />
          <Route path='funds/:fundId' element={<FundDetails />}/>
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="discover" element={<Discover />}/>
          <Route path="*" element={<Navigate to="/dashboard/create" replace />} />
        </Routes>
      </Layout>
  );
}