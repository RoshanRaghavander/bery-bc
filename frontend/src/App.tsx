import { useState, useEffect } from 'react';
import { api, type Wallet } from './lib/api';
import { Shield, Wallet as WalletIcon, Coins, RefreshCw, Plus, Send, Lock, ArrowRight, Zap, Code, ExternalLink, Box, Search } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [chainInfo, setChainInfo] = useState<any>(null);
  
  // Tab State: 'wallet' | 'stake' | 'buy' | 'dev' | 'explorer'
  const [activeTab, setActiveTab] = useState('wallet');

  // Input States
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('100');
  const [importKey, setImportKey] = useState('');

  // Explorer States
  const [blocks, setBlocks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);

  // Initial Load
  useEffect(() => {
    fetchChainInfo();
    const interval = setInterval(fetchChainInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll Balance if wallet exists
  useEffect(() => {
    if (wallet) {
      updateBalance(wallet.address);
      const interval = setInterval(() => updateBalance(wallet.address), 5000);
      return () => clearInterval(interval);
    }
  }, [wallet]);

  // Poll Blocks if explorer is active
  useEffect(() => {
    if (activeTab === 'explorer') {
      fetchBlocks();
      const interval = setInterval(fetchBlocks, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchChainInfo = async () => {
    try {
      const info = await api.getChainInfo();
      setChainInfo(info);
    } catch (e) {
      console.error("Failed to fetch chain info", e);
    }
  };

  const fetchBlocks = async () => {
    try {
      const res = await api.getBlocks(10, 0);
      setBlocks(res.blocks);
    } catch (e) {
      console.error("Failed to fetch blocks", e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    setSearchResult(null);
    try {
      // Try fetching block by hash or height
      const res = await api.getBlock(searchQuery);
      setSearchResult({ type: 'block', data: res });
    } catch (e) {
      // If failed, try transaction? (Need api.getTransaction)
      // For now, just show error
      setSearchResult({ error: 'Not found' });
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    setLoading(true);
    try {
      const newWallet = await api.createWallet();
      setWallet(newWallet);
      await updateBalance(newWallet.address);
      alert('Wallet Created! Save your Private Key safely.');
    } catch (e) {
      console.error(e);
      alert('Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  const importWallet = async () => {
    if (!importKey) return alert('Please enter a private key');
    setLoading(true);
    try {
      const importedWallet = await api.importWallet(importKey);
      setWallet(importedWallet);
      await updateBalance(importedWallet.address);
      setImportKey('');
    } catch (e) {
      console.error(e);
      alert('Invalid Private Key');
    } finally {
      setLoading(false);
    }
  };

  const updateBalance = async (address: string) => {
    try {
      const res = await api.getBalance(address);
      setBalance(res.balance);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransfer = async () => {
    if (!wallet || !transferTo || !transferAmount) return;
    setLoading(true);
    try {
      await api.sendTransaction(transferTo, parseFloat(transferAmount), wallet);
      alert(`Sent ${transferAmount} BRY to ${transferTo}`);
      setTransferTo('');
      setTransferAmount('');
      await updateBalance(wallet.address);
    } catch (e) {
      console.error(e);
      alert('Transfer Failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      await api.purchaseTokens(parseInt(purchaseAmount), wallet.address);
      await updateBalance(wallet.address);
      alert(`Purchased ${purchaseAmount} BRY successfully!`);
    } catch (e) {
      console.error(e);
      alert('Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!wallet || !stakeAmount) return;
    setLoading(true);
    try {
      await api.stakeTokens(parseInt(stakeAmount), wallet.address, wallet.privateKey);
      alert(`Staked ${stakeAmount} BRY!`);
      setStakeAmount('');
      await updateBalance(wallet.address);
    } catch (e) {
      console.error(e);
      alert('Staking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Bery Chain
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Mainnet Alpha
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {chainInfo && (
              <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Height: <span className="text-slate-200">{chainInfo.height}</span>
                </div>
                <div>Chain ID: <span className="text-slate-200">{chainInfo.chainId}</span></div>
              </div>
            )}
            
            {wallet ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full text-sm font-mono border border-slate-700 shadow-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </div>
            ) : (
              <button 
                onClick={() => setActiveTab('wallet')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 flex items-center gap-2"
              >
                <WalletIcon className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar / Navigation */}
          <div className="lg:col-span-3 space-y-4">
            <nav className="space-y-1">
              {[
                { id: 'wallet', label: 'Wallet', icon: WalletIcon },
                { id: 'stake', label: 'Staking', icon: Lock },
                { id: 'buy', label: 'Buy Bery', icon: Coins },
                { id: 'dev', label: 'Developers', icon: Code },
                { id: 'explorer', label: 'Explorer', icon: Box },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                    activeTab === item.id 
                      ? 'bg-slate-800 text-white shadow-md border border-slate-700' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  )}
                >
                  <item.icon className={clsx("w-5 h-5", activeTab === item.id ? "text-indigo-400" : "text-slate-500")} />
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Quick Stats Card */}
            {wallet && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-slate-800 mt-8">
                <div className="text-sm text-slate-400 mb-1">Total Balance</div>
                <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                  {balance} <span className="text-sm font-normal text-indigo-400">BRY</span>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800/50 flex gap-2">
                  <button onClick={() => setActiveTab('buy')} className="flex-1 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">Buy</button>
                  <button onClick={() => setActiveTab('stake')} className="flex-1 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">Stake</button>
                </div>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                
                {/* WALLET TAB */}
                {activeTab === 'wallet' && (
                  <div className="space-y-6">
                    {!wallet ? (
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-colors group">
                          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                            <Plus className="w-6 h-6 text-indigo-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-2">Create New Wallet</h3>
                          <p className="text-slate-400 text-sm mb-6">Generate a new Bery Chain wallet securely in your browser.</p>
                          <button 
                            onClick={createWallet} 
                            disabled={loading}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-600/20"
                          >
                            {loading ? 'Creating...' : 'Create Wallet'}
                          </button>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                            <WalletIcon className="w-6 h-6 text-slate-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-2">Import Wallet</h3>
                          <p className="text-slate-400 text-sm mb-4">Access your existing wallet using your Private Key.</p>
                          <input 
                            type="password" 
                            placeholder="Enter Private Key (0x...)" 
                            value={importKey}
                            onChange={(e) => setImportKey(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 mb-4"
                          />
                          <button 
                            onClick={importWallet}
                            disabled={loading || !importKey}
                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                          >
                            Import Wallet
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Wallet Details */}
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <WalletIcon className="w-5 h-5 text-indigo-400" />
                            Wallet Details
                          </h3>
                          <div className="grid gap-4">
                            <div>
                              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Address</label>
                              <div className="flex items-center gap-2 mt-1 font-mono text-sm bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 break-all">
                                {wallet.address}
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Private Key (Keep Secret)</label>
                              <div className="flex items-center gap-2 mt-1 font-mono text-sm bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 break-all relative group">
                                <span className="blur-sm group-hover:blur-0 transition-all duration-300">{wallet.privateKey}</span>
                                <div className="absolute right-3 top-3 text-xs text-slate-600 group-hover:hidden">Hover to reveal</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Transfer Section */}
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Send className="w-5 h-5 text-green-400" />
                            Transfer Assets
                          </h3>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="block text-sm font-medium text-slate-400 mb-1">Recipient Address</label>
                              <input 
                                type="text" 
                                placeholder="0x..." 
                                value={transferTo}
                                onChange={(e) => setTransferTo(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-400 mb-1">Amount (BRY)</label>
                              <input 
                                type="number" 
                                placeholder="0.0" 
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                              />
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <button 
                              onClick={handleTransfer}
                              disabled={loading || !transferTo || !transferAmount}
                              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              Send Transaction
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STAKE TAB */}
                {activeTab === 'stake' && (
                  <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-purple-900 p-8 text-center border border-indigo-500/30">
                      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                      <div className="relative z-10">
                        <h2 className="text-3xl font-bold text-white mb-2">Stake & Earn Rewards</h2>
                        <p className="text-indigo-200 max-w-lg mx-auto mb-6">Secure the Bery network by staking your tokens. Validators earn rewards for every block produced.</p>
                        <div className="flex justify-center gap-8 mb-8">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-white">12%</div>
                            <div className="text-xs text-indigo-300 uppercase tracking-wider">APY</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-white">5s</div>
                            <div className="text-xs text-indigo-300 uppercase tracking-wider">Lock Period</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 max-w-xl mx-auto">
                      <h3 className="text-lg font-semibold text-white mb-4">Stake Tokens</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">Amount to Stake</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              value={stakeAmount}
                              onChange={(e) => setStakeAmount(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-4 pr-16 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                              placeholder="0.0"
                            />
                            <div className="absolute right-4 top-3 text-slate-500 text-sm font-medium">BRY</div>
                          </div>
                          <div className="text-right mt-1">
                             <span className="text-xs text-slate-500 cursor-pointer hover:text-indigo-400" onClick={() => setStakeAmount(balance)}>Max: {balance} BRY</span>
                          </div>
                        </div>
                        <button 
                          onClick={handleStake}
                          disabled={!wallet || loading}
                          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {wallet ? (loading ? 'Processing...' : 'Confirm Stake') : 'Connect Wallet to Stake'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* BUY TAB */}
                {activeTab === 'buy' && (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-white mb-2">Buy Bery Coins</h2>
                      <p className="text-slate-400">Instant on-ramp for AI Agents and Developers.</p>
                    </div>

                    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                      <div className="space-y-6">
                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                              <span className="text-green-500 font-bold">$</span>
                            </div>
                            <div>
                              <div className="text-sm text-slate-400">You Pay</div>
                              <input 
                                type="number" 
                                value={purchaseAmount}
                                onChange={(e) => setPurchaseAmount(e.target.value)}
                                className="bg-transparent text-xl font-bold text-white w-24 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="text-slate-500 font-medium">USD</div>
                        </div>

                        <div className="flex justify-center">
                           <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                             <ArrowRight className="w-4 h-4 text-slate-400 rotate-90" />
                           </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                              <Coins className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                              <div className="text-sm text-slate-400">You Receive</div>
                              <div className="text-xl font-bold text-white">{purchaseAmount}</div>
                            </div>
                          </div>
                          <div className="text-slate-500 font-medium">BRY</div>
                        </div>

                        <button 
                          onClick={handlePurchase}
                          disabled={!wallet || loading}
                          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {wallet ? 'Buy Now' : 'Connect Wallet to Buy'}
                        </button>
                        
                        <p className="text-xs text-center text-slate-500">
                          *Simulation Mode: This will dispense tokens from the faucet for testing purposes.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* DEV TAB */}
                {activeTab === 'dev' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        AI Agent Integration
                      </h3>
                      <p className="text-slate-400 text-sm mb-6">
                        Developers can connect their autonomous AI agents to the Bery Chain using our SDK. 
                        Give your agents a wallet to perform economic actions.
                      </p>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm text-slate-300">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-500"># Install SDK</span>
                            <span className="text-xs text-slate-600">npm</span>
                          </div>
                          <div className="text-indigo-300">npm install @bery-chain/sdk</div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm text-slate-300">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-500"># Initialize Agent Wallet</span>
                            <span className="text-xs text-slate-600">typescript</span>
                          </div>
                          <pre className="text-xs text-slate-400 overflow-x-auto">
{`import { BeryWallet } from '@bery-chain/sdk';

const agent = new BeryWallet({
  privateKey: process.env.AGENT_KEY,
  rpcUrl: 'https://rpc.berychain.xyz'
});

await agent.send(to, amount);`}
                          </pre>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                         <a href="#" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                           View Full Documentation <ExternalLink className="w-4 h-4" />
                         </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* EXPLORER TAB */}
                {activeTab === 'explorer' && (
                  <div className="space-y-6">
                    {/* Search */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search by Block Hash or Height"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button
                        onClick={handleSearch}
                        disabled={loading || !searchQuery}
                        className="px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                      >
                        {loading ? '...' : 'Search'}
                      </button>
                    </div>

                    {/* Search Result */}
                    {searchResult && (
                      <div className="p-6 rounded-2xl bg-slate-900 border border-indigo-500/50">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-white">Search Result</h3>
                          <button onClick={() => setSearchResult(null)} className="text-slate-400 hover:text-white">Close</button>
                        </div>
                        {searchResult.error ? (
                          <div className="text-red-400">{searchResult.error}</div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="text-slate-500">Hash</div>
                              <div className="col-span-2 font-mono text-indigo-400 break-all">{searchResult.data.hash}</div>
                              <div className="text-slate-500">Height</div>
                              <div className="col-span-2 text-white">{searchResult.data.header.height}</div>
                              <div className="text-slate-500">Transactions</div>
                              <div className="col-span-2 text-white">{searchResult.data.transactions.length}</div>
                              <div className="text-slate-500">Timestamp</div>
                              <div className="col-span-2 text-white">{new Date(searchResult.data.header.timestamp).toLocaleString()}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent Blocks */}
                    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Box className="w-5 h-5 text-indigo-400" />
                        Recent Blocks
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
                            <tr>
                              <th className="px-4 py-3 rounded-l-lg">Height</th>
                              <th className="px-4 py-3">Hash</th>
                              <th className="px-4 py-3">Txs</th>
                              <th className="px-4 py-3 rounded-r-lg">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {blocks.map((block) => (
                              <tr key={block.hash} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-3 font-medium text-indigo-400">#{block.height}</td>
                                <td className="px-4 py-3 font-mono text-slate-400 max-w-[200px] truncate">{block.hash}</td>
                                <td className="px-4 py-3 text-white">{block.txCount}</td>
                                <td className="px-4 py-3 text-slate-500">{new Date(block.timestamp).toLocaleTimeString()}</td>
                              </tr>
                            ))}
                            {blocks.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                  No blocks found yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
