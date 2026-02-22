import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

export function BlockDetail() {
  const { height } = useParams<{ height: string }>();
  const [block, setBlock] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!height) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/v1/block/${height}`);
        const data = await res.json();
        if (res.ok && !cancelled) setBlock(data);
      } catch {
        if (!cancelled) setBlock(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [height]);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!block) return <div style={{ padding: 40 }}>Block not found</div>;

  const h = block.header || block;
  const txs = block.transactions || [];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
      <Link to="/blocks" style={{ fontSize: 14, color: 'var(--color-accent)', marginBottom: 16, display: 'inline-block' }}>
        ← Back to Blocks
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Block #{h.height ?? block.height}</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>
        {h.hash || block.hash}
      </p>
      <div
        style={{
          padding: 24,
          background: 'var(--color-bg-alt)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          marginBottom: 24,
        }}
      >
        <div style={{ marginBottom: 8 }}>Validator: {h.validator ?? h.proposer ?? '-'}</div>
        <div style={{ marginBottom: 8 }}>Transactions: {txs.length}</div>
        <div>Parent: {h.parentHash ?? '-'}</div>
      </div>
      {txs.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Transactions</h2>
          {txs.map((tx: any, i: number) => (
            <div
              key={i}
              style={{
                padding: 16,
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
            >
              {tx.hash ? String(tx.hash).slice(0, 20) + '...' : 'Tx #' + i}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
