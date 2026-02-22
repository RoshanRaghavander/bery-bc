import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../hooks/useWallet';

interface ChainInfo {
  chainId: number;
  name: string;
  symbol: string;
  height: number;
  peers: number;
  mempoolSize: number;
  finality?: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const { address: walletAddress } = useWallet();
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [infoRes, blocksRes] = await Promise.all([
          fetch('/v1/chain/info'),
          fetch('/v1/blocks?limit=5'),
        ]);
        const infoData = await infoRes.json();
        const blocksData = await blocksRes.json();
        if (!cancelled) {
          setChainInfo(infoData);
          setBlocks(blocksData.blocks || []);
        }
      } catch {
        if (!cancelled) setChainInfo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const addr = walletAddress?.replace(/^0x/, '');
    if (!addr) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    fetch(`/v1/account/${addr}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.balance != null) {
          const bry = Number(data.balance) / 1e18;
          setBalance(bry.toFixed(6) + ' BRY');
        }
      })
      .catch(() => { if (!cancelled) setBalance(null); });
    return () => { cancelled = true; };
  }, [walletAddress]);

  const statCards = [
    { label: 'Balance', value: balance ?? (walletAddress ? '—' : 'Connect wallet'), to: '/wallet' },
    { label: 'Network Height', value: chainInfo?.height ?? '—', to: '/blocks' },
    { label: 'Peers', value: chainInfo?.peers ?? '—', to: '/blocks' },
    { label: 'Mempool', value: chainInfo?.mempoolSize ?? '—', to: '/blocks' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          {user ? `Welcome back, ${user.email}` : 'Overview of Bery network'}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {statCards.map(({ label, value, to }) => (
          <Link
            key={label}
            to={to}
            style={{
              padding: 24,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'border-color 0.15s ease',
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: 'var(--color-text-subtle)',
                margin: '0 0 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
              }}
            >
              {label}
            </p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0, fontFamily: label === 'Balance' ? 'inherit' : 'var(--font-mono)' }}>
              {loading && value === '—' ? '...' : value}
            </p>
          </Link>
        ))}
      </div>

      <div
        style={{
          padding: 28,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 32,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            to="/wallet"
            style={{
              padding: '12px 20px',
              background: 'var(--color-accent)',
              color: 'white',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
            }}
          >
            Open Wallet
          </Link>
          <Link
            to="/blocks"
            style={{
              padding: '12px 20px',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontWeight: 500,
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              background: 'var(--color-bg-muted)',
            }}
          >
            View Blocks
          </Link>
          <Link
            to="/explorer"
            style={{
              padding: '12px 20px',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontWeight: 500,
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              background: 'var(--color-bg-muted)',
            }}
          >
            Explorer
          </Link>
        </div>
      </div>

      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Recent Blocks</h2>
          <Link to="/blocks" style={{ fontSize: 13, fontWeight: 500 }}>
            View all →
          </Link>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
            Loading blocks...
          </div>
        ) : blocks.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
            No blocks yet
          </div>
        ) : (
          <div>
            {blocks.map((b: any, i: number) => {
              const h = b.header || b;
              const height = h.height ?? b.height;
              const hash = h.hash ?? b.hash ?? '';
              const txCount = (b.transactions || []).length;
              return (
                <Link
                  key={height}
                  to={`/explorer/block/${height}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 60px',
                    gap: 16,
                    padding: '14px 24px',
                    borderBottom: i < blocks.length - 1 ? '1px solid var(--color-border)' : 'none',
                    textDecoration: 'none',
                    color: 'inherit',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>
                    #{height}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {String(hash).slice(0, 16)}...
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{txCount} tx</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
