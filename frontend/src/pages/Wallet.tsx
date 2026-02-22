import { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet, RPC_URL } from '../hooks/useWallet';

export function Wallet() {
  const { address: connectedAddr, provider, type, connectMetaMask, connectWalletConnect, disconnect, ensureChain } = useWallet();
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<{ address: string; privateKey: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [faucetToken, setFaucetToken] = useState('');
  const [faucetStatus, setFaucetStatus] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendStatus, setSendStatus] = useState('');

  const effectiveAddress = connectedAddr || address.trim() || wallet?.address;

  const checkBalance = async (addr?: string) => {
    const target = addr || effectiveAddress;
    if (!target) return;
    setLoading(true);
    setBalance(null);
    try {
      const res = await fetch(`/v1/account/${target.replace(/^0x/, '')}`);
      const data = await res.json();
      if (res.ok) {
        const wei = BigInt(data.balance || '0');
        const bry = Number(wei) / 1e18;
        setBalance(bry.toFixed(6) + ' BRY');
      } else {
        setBalance('Error');
      }
    } catch {
      setBalance('Error');
    } finally {
      setLoading(false);
    }
  };

  const createWallet = () => {
    const w = ethers.Wallet.createRandom();
    setWallet({ address: w.address, privateKey: w.privateKey });
    setAddress(w.address);
    setBalance(null);
    setShowKey(false);
  };

  const requestFaucet = async () => {
    const addr = address.trim() || wallet?.address;
    if (!addr) {
      setFaucetStatus('Enter or create an address first');
      return;
    }
    setFaucetStatus('Requesting...');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (faucetToken.trim()) headers['x-faucet-token'] = faucetToken.trim();
      const res = await fetch('/v1/faucet', {
        method: 'POST',
        headers,
        body: JSON.stringify({ address: addr.replace(/^0x/, ''), amount: '1000000000000000000' }),
      });
      const data = await res.json();
      if (res.ok) {
        setFaucetStatus(`Success! Tx: ${data.hash || data.message || 'broadcast'}`);
        setTimeout(() => checkBalance(addr), 2000);
      } else {
        setFaucetStatus(data.error || 'Faucet request failed');
      }
    } catch (e: any) {
      setFaucetStatus(e.message || 'Request failed');
    }
  };

  const sendTx = async () => {
    if (!sendTo.trim() || !sendAmount.trim()) {
      setSendStatus('Enter recipient and amount');
      return;
    }
    setSendStatus('Sending...');
    try {
      let signer: ethers.Signer;
      if (provider && connectedAddr) {
        await ensureChain();
        signer = await provider.getSigner();
      } else if (wallet?.privateKey) {
        const p = new ethers.JsonRpcProvider(RPC_URL);
        signer = new ethers.Wallet(wallet.privateKey, p);
      } else {
        setSendStatus('Connect MetaMask/WalletConnect or create wallet first');
        return;
      }
      const tx = await signer.sendTransaction({
        to: sendTo.trim(),
        value: ethers.parseEther(sendAmount.trim()),
        gasLimit: 21000n,
      });
      setSendStatus(`Tx sent: ${tx.hash}`);
      setSendAmount('');
      setTimeout(() => checkBalance(connectedAddr || wallet?.address), 2000);
    } catch (e: any) {
      setSendStatus(e.message || 'Send failed');
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Wallet</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 40 }}>
        Create a wallet, get BRY from faucet, and send
      </p>

      {/* Connect Wallet (MetaMask / WalletConnect) */}
      <div style={{ padding: 24, background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>1. Connect Wallet</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Use MetaMask or WalletConnect for production.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={connectMetaMask} style={{ padding: '10px 20px', background: '#f6851b', color: 'white', fontWeight: 600, border: 'none', borderRadius: 8 }}>
            MetaMask
          </button>
          <button onClick={connectWalletConnect} style={{ padding: '10px 20px', background: '#3396ff', color: 'white', fontWeight: 600, border: 'none', borderRadius: 8 }}>
            WalletConnect
          </button>
          {type && <button onClick={disconnect} style={{ padding: '10px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>Disconnect</button>}
        </div>
        {connectedAddr && <p style={{ marginTop: 12, fontSize: 13, fontFamily: 'var(--font-mono)' }}>{connectedAddr}</p>}
      </div>

      {/* Create Wallet (dev) */}
      <div style={{ padding: 24, background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Or Create New (client-side)</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Generate a new address. Private key stays in your browser.
        </p>
        <button onClick={createWallet} style={{ padding: '10px 20px', background: 'var(--color-accent)', color: 'white', fontWeight: 600, border: 'none', borderRadius: 8 }}>
          Create Wallet
        </button>
        {wallet && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-subtle)' }}>Address</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>{wallet.address}</div>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--color-text-subtle)' }}>Private Key</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>
                {showKey ? wallet.privateKey : '••••••••'}
              </div>
              <button onClick={() => setShowKey(!showKey)} style={{ marginTop: 4, fontSize: 12, padding: '4px 8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                {showKey ? 'Hide' : 'Show'} (save it—you can’t recover it)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Balance & Faucet */}
      <div style={{ padding: 24, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>2. Balance & Faucet</h2>
        <input
          value={address || connectedAddr || ''}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address or use connected/created wallet"
          style={{ width: '100%', padding: 10, marginBottom: 8, border: '1px solid var(--color-border)', borderRadius: 8 }}
        />
        <input
          value={faucetToken}
          onChange={(e) => setFaucetToken(e.target.value)}
          placeholder="Faucet token (if required)"
          style={{ width: '100%', padding: 10, marginBottom: 8, border: '1px solid var(--color-border)', borderRadius: 8 }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => checkBalance()} disabled={loading} style={{ padding: '10px 20px', background: 'var(--color-accent)', color: 'white', fontWeight: 600, border: 'none', borderRadius: 8 }}>
            {loading ? 'Loading...' : 'Check Balance'}
          </button>
          <button onClick={requestFaucet} style={{ padding: '10px 20px', background: 'var(--color-success)', color: 'white', fontWeight: 600, border: 'none', borderRadius: 8 }}>
            Request 1 BRY
          </button>
        </div>
        {balance !== null && <p style={{ marginTop: 12, fontWeight: 600 }}>Balance: {balance}</p>}
        {faucetStatus && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-subtle)' }}>{faucetStatus}</p>}
      </div>

      {/* Send */}
      <div style={{ padding: 24, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>3. Send BRY</h2>
        <input
          value={sendTo}
          onChange={(e) => setSendTo(e.target.value)}
          placeholder="Recipient address"
          style={{ width: '100%', padding: 10, marginBottom: 8, border: '1px solid var(--color-border)', borderRadius: 8 }}
        />
        <input
          value={sendAmount}
          onChange={(e) => setSendAmount(e.target.value)}
          placeholder="Amount (e.g. 0.1)"
          style={{ width: '100%', padding: 10, marginBottom: 8, border: '1px solid var(--color-border)', borderRadius: 8 }}
        />
        <button onClick={sendTx} style={{ padding: '10px 20px', background: 'var(--color-accent)', color: 'white', fontWeight: 600, border: 'none', borderRadius: 8 }}>
          Send
        </button>
        {sendStatus && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-subtle)' }}>{sendStatus}</p>}
      </div>
    </div>
  );
}
