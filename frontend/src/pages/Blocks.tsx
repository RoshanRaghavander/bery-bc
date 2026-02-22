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
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Blocks</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 28, fontSize: 14 }}>
        Latest blocks on Bery chain
      </p>

      {loading ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-muted)',
          }}
        >
          Loading blocks...
        </div>
      ) : blocks.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-muted)',
          }}
        >
          No blocks yet. Ensure the node is running and producing blocks.
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 80px',
              gap: 16,
              padding: '14px 24px',
              background: 'var(--color-bg-muted)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <div>Block</div>
            <div>Hash</div>
            <div>Txns</div>
          </div>
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
                  gridTemplateColumns: '100px 1fr 80px',
                  gap: 16,
                  padding: '16px 24px',
                  borderBottom: i < blocks.length - 1 ? '1px solid var(--color-border)' : 'none',
                  textDecoration: 'none',
                  color: 'inherit',
                  alignItems: 'center',
                  background: i % 2 === 0 ? 'var(--color-surface)' : 'transparent',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>
                  #{height}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {String(hash).slice(0, 18)}...
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{txCount}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
