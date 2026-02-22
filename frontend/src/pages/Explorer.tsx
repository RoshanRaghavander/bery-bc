import { useState } from 'react';

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
      const isHash = /^0x?[a-fA-F0-9]{64}$/.test(q.replace('0x', ''));
      const isNumber = /^\d+$/.test(q);
      if (isHash) {
        const res = await fetch(`/v1/tx/${q.replace('0x', '')}`);
        const data = await res.json();
        setResult({ type: 'tx', data });
      } else if (isNumber) {
        const res = await fetch(`/v1/block/${q}`);
        const data = await res.json();
        setResult({ type: 'block', data });
      } else {
        const res = await fetch(`/v1/account/${q.replace('0x', '')}`);
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
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Explorer</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>
        Search by block height, transaction hash, or address
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Height, hash, or address"
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 15,
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
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {result && (
        <div
          style={{
            padding: 24,
            background: 'var(--color-bg-alt)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            overflow: 'auto',
          }}
        >
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {result.type === 'error'
              ? 'Not found'
              : JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
