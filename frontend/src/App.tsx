import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { Dashboard } from './pages/Dashboard';
import { Wallet } from './pages/Wallet';
import { Blocks } from './pages/Blocks';
import { Transactions } from './pages/Transactions';
import { Explorer } from './pages/Explorer';
import { BlockDetail } from './pages/BlockDetail';
import { Docs } from './pages/Docs';
import { About } from './pages/About';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="sign-in" element={<SignIn />} />
        <Route path="sign-up" element={<SignUp />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="blocks" element={<Blocks />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="explorer" element={<Explorer />} />
        <Route path="explorer/block/:height" element={<BlockDetail />} />
        <Route path="docs" element={<Docs />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
