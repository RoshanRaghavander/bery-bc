import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Copyable } from '../components/Copyable';

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
    return () => {
      cancelled = true;
    };
  }, [height]);

  if (loading)
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 48, textAlign: 'center' }}>
        Loading...
      </div>
    );
  if (!block)
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 48, textAlign: 'center' }}>
        Block not found
      </div>
    );

  const h = block.header || block;
  const txs = block.transactions || [];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      <Link
        to="/blocks"
        style={{
          fontSize: 13,
          color: 'var(--color-accent)',
          marginBottom: 20,
          display: 'inline-block',
        }}
      >
        ← Back to Blocks
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Block #{h.height ?? block.height}</h1>
      <p
        style={{
          color: 'var(--color-text-muted)',
          marginBottom: 28,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
        }}
      >
        <Copyable value={h.hash || block.hash || ''} />
      </p>

      <div className="card card-elevated" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Block Details</h2>
        <table style={{ width: '100%', fontSize: 13 }}>
          <tbody>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)', width: 160 }}>Validator</td>
              <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)' }}>{h.validator ?? h.proposer ?? '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Transactions</td>
              <td style={{ padding: '10px 0' }}>{txs.length}</td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Parent Hash</td>
              <td style={{ padding: '10px 0' }}>
                {h.parentHash ? <Copyable value={h.parentHash} display={`${String(h.parentHash).slice(0, 18)}...`} /> : '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {txs.length > 0 && (
        <div className="card card-elevated" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Transactions</h2>
          </div>
          {txs.map((tx: any, i: number) => (
            <div
              key={i}
              style={{
                padding: '16px 24px',
                borderBottom: i < txs.length - 1 ? '1px solid var(--color-border)' : 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
              }}
            >
              {tx.hash ? (
                <Copyable value={tx.hash} display={`${String(tx.hash).slice(0, 18)}...`} suffix="..." />
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>Tx #{i}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
