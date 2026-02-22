import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export function Blocks() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/v1/blocks?limit=20');
        const data = await res.json();
        if (res.ok && !cancelled) {
          setBlocks(data.blocks || []);
        }
      } catch {
        if (!cancelled) setBlocks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Blocks</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 40 }}>
        Latest blocks on Bery chain
      </p>

      {loading ? (
        <p>Loading blocks...</p>
      ) : blocks.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            background: 'var(--color-bg-alt)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-subtle)',
          }}
        >
          No blocks yet. Ensure the node is running and producing blocks.
        </div>
      ) : (
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {blocks.map((b: any) => {
            const h = b.header || b;
            const height = h.height ?? b.height;
            const hash = h.hash ?? b.hash ?? '';
            const txCount = (b.transactions || []).length;
            const proposer = h.validator ?? h.proposer ?? '-';
            return (
              <Link
                key={height}
                to={`/explorer/block/${height}`}
                style={{
                  display: 'block',
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--color-border)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    #{height}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-subtle)' }}>
                    {String(hash).slice(0, 18)}...
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-subtle)', marginTop: 4 }}>
                  {txCount} tx · Proposer: {String(proposer).slice(0, 10)}...
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
