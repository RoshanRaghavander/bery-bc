import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';

const STAKING_ADDRESS = '0x0000000000000000000000000000000000000100';

export function Staking() {
  const { address: connectedAddr, provider, type, connectMetaMask, connectWalletConnect, disconnect, ensureChain } =
    useWallet();
  const [totalStaked, setTotalStaked] = useState<string>('');
  const [myStake, setMyStake] = useState<string>('');
  const [stakersCount, setStakersCount] = useState(0);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStakingInfo = async () => {
    try {
      const res = await fetch('/v1/staking/info');
      const data = await res.json();
      if (res.ok) {
        const total = BigInt(data.totalStaked || '0');
        setTotalStaked((Number(total) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 }));
        setStakersCount(data.stakers?.length || 0);
      }
    } catch {
      setTotalStaked('—');
    }
  };

  const fetchMyStake = async (addr: string) => {
    if (!addr) return;
    try {
      const res = await fetch(`/v1/staking/${addr.replace(/^0x/, '')}`);
      const data = await res.json();
      if (res.ok) {
        const s = BigInt(data.stake || '0');
        setMyStake((Number(s) / 1e18).toFixed(6));
      } else {
        setMyStake('0');
      }
    } catch {
      setMyStake('0');
    }
  };

  useEffect(() => {
    fetchStakingInfo();
  }, []);

  useEffect(() => {
    if (connectedAddr) fetchMyStake(connectedAddr);
    else setMyStake('');
  }, [connectedAddr]);

  const stake = async () => {
    const amt = stakeAmount.trim();
    if (!amt || parseFloat(amt) <= 0) {
      setStatus('Enter a valid amount');
      return;
    }
    setLoading(true);
    setStatus('Staking...');
    try {
      await ensureChain();
      const signer = await provider!.getSigner();
      const tx = await signer.sendTransaction({
        to: STAKING_ADDRESS,
        value: ethers.parseEther(amt),
        data: '0x01', // STAKE
        gasLimit: 100000n,
      });
      setStatus(`Staking tx sent: ${tx.hash}`);
      setStakeAmount('');
      setTimeout(() => {
        fetchStakingInfo();
        fetchMyStake(connectedAddr!);
      }, 3000);
    } catch (e: any) {
      setStatus(e.message || 'Stake failed');
    } finally {
      setLoading(false);
    }
  };

  const unstake = async () => {
    const amt = unstakeAmount.trim();
    if (!amt || parseFloat(amt) <= 0) {
      setStatus('Enter a valid amount');
      return;
    }
    setLoading(true);
    setStatus('Unstaking...');
    try {
      await ensureChain();
      const signer = await provider!.getSigner();
      const amountWei = ethers.parseEther(amt);
      const data = '0x02' + amountWei.toString(16).padStart(64, '0');
      const tx = await signer.sendTransaction({
        to: STAKING_ADDRESS,
        value: 0n,
        data,
        gasLimit: 100000n,
      });
      setStatus(`Unstake tx sent: ${tx.hash}`);
      setUnstakeAmount('');
      setTimeout(() => {
        fetchStakingInfo();
        fetchMyStake(connectedAddr!);
      }, 3000);
    } catch (e: any) {
      setStatus(e.message || 'Unstake failed');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    padding: 24,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    marginBottom: 24,
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
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Staking</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 32, fontSize: 14 }}>
        Stake BRY to participate in consensus. Top stakers become validators.
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Network Stats</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Total Staked</span>
            <div style={{ fontWeight: 600 }}>{totalStaked || '—'} BRY</div>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Stakers</span>
            <div style={{ fontWeight: 600 }}>{stakersCount}</div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Your Stake</h2>
        {!type ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
            Connect a wallet to view and manage your stake.
          </p>
        ) : (
          <p style={{ fontWeight: 600, fontSize: 18, marginBottom: 16 }}>
            {myStake !== '' ? `${myStake} BRY` : 'Loading...'}
          </p>
        )}
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
      </div>

      {type && provider && (
        <>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Stake BRY</h2>
            <input
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="Amount (e.g. 100)"
              style={inputStyle}
            />
            <button onClick={stake} disabled={loading} style={btnPrimary}>
              Stake
            </button>
          </div>

          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Unstake BRY</h2>
            <input
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="Amount (e.g. 50)"
              style={inputStyle}
            />
            <button onClick={unstake} disabled={loading} style={btnPrimary}>
              Unstake
            </button>
          </div>
        </>
      )}

      {status && (
        <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>
          {status}
        </p>
      )}
    </div>
  );
}
