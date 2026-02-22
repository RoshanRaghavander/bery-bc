import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copyable } from '../components/Copyable';

export function Explorer() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    try {
      const isHash = /^0x?[a-fA-F0-9]{64}$/.test(q.replace(/^0x/, ''));
      const isNumber = /^\d+$/.test(q);
      if (isHash) {
        const res = await fetch(`/v1/tx/${q.replace(/^0x/, '')}`);
        const data = await res.json();
        setResult({ type: 'tx', data });
      } else if (isNumber) {
        const res = await fetch(`/v1/block/${q}`);
        const data = await res.json();
        setResult({ type: 'block', data });
      } else {
        const res = await fetch(`/v1/account/${q.replace(/^0x/, '')}`);
        const data = await res.json();
        setResult({ type: 'account', data });
      }
    } catch {
      setResult({ type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Explorer</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 28, fontSize: 14 }}>
        Search by block height, transaction hash, or address
      </p>

      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 32,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 8,
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Height, hash, or address..."
          style={{
            flex: 1,
            padding: '12px 16px',
            border: 'none',
            background: 'var(--color-bg-muted)',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            fontFamily: 'var(--font-mono)',
          }}
        />
        <button
          onClick={search}
          disabled={loading}
          style={{
            padding: '12px 24px',
            background: 'var(--color-accent)',
            color: 'white',
            fontWeight: 600,
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {result && result.type === 'error' && (
        <div
          style={{
            padding: 32,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
          }}
        >
          No results found
        </div>
      )}

      {result && result.type === 'account' && (
        <div className="card card-elevated" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Address</h2>
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ padding: '10px 0', color: 'var(--color-text-muted)', width: 140 }}>Address</td>
                <td style={{ padding: '10px 0' }}>
                  <Copyable value={result.data.address ?? query} display={`${String(result.data.address ?? query).slice(0, 10)}...${String(result.data.address ?? query).slice(-8)}`} />
                </td>
              </tr>
              <tr>
                <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Balance</td>
                <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)' }}>
                  {result.data.balance ? `${(Number(result.data.balance) / 1e18).toFixed(6)} BRY` : '0 BRY'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Nonce</td>
                <td style={{ padding: '10px 0' }}>{result.data.nonce ?? 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {result && result.type === 'block' && (
        <div className="card card-elevated" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Block #{result.data?.header?.height ?? result.data?.height}</h2>
            <Link
              to={`/explorer/block/${result.data?.header?.height ?? result.data?.height}`}
              style={{ fontSize: 13, fontWeight: 500 }}
            >
              View details →
            </Link>
          </div>
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ padding: '10px 0', color: 'var(--color-text-muted)', width: 140 }}>Height</td>
                <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)' }}>{result.data?.header?.height ?? result.data?.height}</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Hash</td>
                <td style={{ padding: '10px 0' }}>
                  <Copyable value={result.data?.header?.hash ?? result.data?.hash ?? ''} display={`${String(result.data?.header?.hash ?? result.data?.hash ?? '').slice(0, 18)}...`} />
                </td>
              </tr>
              <tr>
                <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Transactions</td>
                <td style={{ padding: '10px 0' }}>{(result.data?.transactions || []).length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {result && result.type === 'tx' && (
        <div className="card card-elevated" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Transaction</h2>
          <pre
            style={{
              margin: 0,
              padding: 16,
              background: 'var(--color-bg-muted)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
