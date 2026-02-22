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
        if (res.ok) {
          const txsRes = await fetch(`/v1/address/${q.replace(/^0x/, '')}/transactions?limit=10`);
          const txsData = await txsRes.json();
          setResult({ type: 'account', data, transactions: txsData.transactions || [] });
        } else {
          setResult({ type: 'account', data });
        }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Address</h2>
            <Link to={`/explorer/address/${(result.data.address ?? query).replace(/^0x/, '')}`} style={{ fontSize: 13, fontWeight: 500 }}>
              View full history →
            </Link>
          </div>
          <table style={{ width: '100%', fontSize: 13, marginBottom: result.transactions?.length ? 24 : 0 }}>
            <tbody>
              <tr>
                <td style={{ padding: '10px 0', color: 'var(--color-text-muted)', width: 140 }}>Address</td>
                <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)' }}>
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
          {result.transactions?.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent Transactions</h3>
              {result.transactions.slice(0, 5).map((t: any) => (
                <Link
                  key={t.txHash}
                  to={`/explorer/tx/${t.txHash}`}
                  style={{
                    display: 'block',
                    padding: '10px 0',
                    borderTop: '1px solid var(--color-border)',
                    textDecoration: 'none',
                    color: 'var(--color-accent)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}
                >
                  {String(t.txHash).slice(0, 18)}... — Block #{t.height}
                </Link>
              ))}
            </>
          )}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Transaction</h2>
            <Link to={`/explorer/tx/${result.data.hash || query}`} style={{ fontSize: 13, fontWeight: 500 }}>
              View details →
            </Link>
          </div>
          {result.data.tx ? (
            <table style={{ width: '100%', fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '10px 0', color: 'var(--color-text-muted)', width: 120 }}>Status</td>
                  <td style={{ padding: '10px 0' }}>{result.data.status || '—'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>From</td>
                  <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    <Link to={`/explorer/address/${result.data.tx.from}`}>{result.data.tx.from}</Link>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>To</td>
                  <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {result.data.tx.to ? <Link to={`/explorer/address/${result.data.tx.to}`}>{result.data.tx.to}</Link> : 'Contract Creation'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Value</td>
                  <td style={{ padding: '10px 0' }}>{(Number(result.data.tx.value || 0) / 1e18).toFixed(6)} BRY</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <pre style={{ margin: 0, padding: 16, background: 'var(--color-bg-muted)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 12, overflow: 'auto' }}>
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
