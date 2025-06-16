import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import { Toaster } from 'react-hot-toast';
// import ProposalSocketListener from './pages/ProposalSocketListener';

function App() {
  return (
  
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {/* <ProposalSocketListener/> */}
        <Toaster position='top-right'/>
      </BrowserRouter>
    
  );
}

export default App;