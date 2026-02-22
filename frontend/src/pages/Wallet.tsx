import { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet, RPC_URL } from '../hooks/useWallet';

export function Wallet() {
  const { address: connectedAddr, provider, type, connectMetaMask, connectWalletConnect, disconnect, ensureChain } =
    useWallet();
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

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    marginBottom: 12,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-bg-muted)',
    color: 'var(--color-text)',
    fontSize: 14,
  };

  const cardStyle = {
    padding: 24,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    marginBottom: 24,
  };

  const btnPrimary = {
    padding: '10px 20px',
    background: 'var(--color-accent)',
    color: 'white',
    fontWeight: 600,
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
  };

  const btnSecondary = {
    padding: '10px 20px',
    background: 'var(--color-bg-muted)',
    color: 'var(--color-text)',
    fontWeight: 500,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Wallet</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 32, fontSize: 14 }}>
        Create a wallet, get BRY from faucet, and send
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Connect Wallet</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Use MetaMask or WalletConnect for production.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={connectMetaMask} style={{ ...btnPrimary, background: '#f6851b' }}>
            MetaMask
          </button>
          <button onClick={connectWalletConnect} style={{ ...btnPrimary, background: '#3396ff' }}>
            WalletConnect
          </button>
          {type && (
            <button onClick={disconnect} style={btnSecondary}>
              Disconnect
            </button>
          )}
        </div>
        {connectedAddr && (
          <p style={{ marginTop: 16, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            {connectedAddr}
          </p>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Create New Wallet</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Generate a new address. Private key stays in your browser.
        </p>
        <button onClick={createWallet} style={btnPrimary}>
          Create Wallet
        </button>
        {wallet && (
          <div style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                Address
              </label>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all', color: 'var(--color-accent)' }}>
                {wallet.address}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                Private Key
              </label>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all', marginBottom: 8 }}>
                {showKey ? wallet.privateKey : '••••••••'}
              </div>
              <button onClick={() => setShowKey(!showKey)} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>
                {showKey ? 'Hide' : 'Show'} (save it—you can&apos;t recover it)
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Balance & Faucet</h2>
        <input
          value={address || connectedAddr || ''}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address or use connected/created wallet"
          style={inputStyle}
        />
        <input
          value={faucetToken}
          onChange={(e) => setFaucetToken(e.target.value)}
          placeholder="Faucet token (if required)"
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => checkBalance()} disabled={loading} style={btnPrimary}>
            {loading ? 'Loading...' : 'Check Balance'}
          </button>
          <button
            onClick={requestFaucet}
            style={{ ...btnPrimary, background: 'var(--color-success)' }}
          >
            Request 1 BRY
          </button>
        </div>
        {balance !== null && (
          <p style={{ marginTop: 16, fontWeight: 600, fontSize: 15 }}>Balance: {balance}</p>
        )}
        {faucetStatus && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>{faucetStatus}</p>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Send BRY</h2>
        <input
          value={sendTo}
          onChange={(e) => setSendTo(e.target.value)}
          placeholder="Recipient address"
          style={inputStyle}
        />
        <input
          value={sendAmount}
          onChange={(e) => setSendAmount(e.target.value)}
          placeholder="Amount (e.g. 0.1)"
          style={inputStyle}
        />
        <button onClick={sendTx} style={btnPrimary}>
          Send
        </button>
        {sendStatus && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>{sendStatus}</p>
        )}
      </div>
    </div>
  );
}
