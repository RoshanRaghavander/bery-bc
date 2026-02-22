import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Copyable } from '../components/Copyable';

export function TxDetail() {
  const { hash } = useParams<{ hash: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = hash?.replace(/^0x/, '');
    if (!h) return;
    let cancelled = false;
    fetch(`/v1/tx/${h}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hash]);

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 48, textAlign: 'center' }}>
        Loading...
      </div>
    );
  }
  if (!data || data.error) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 48, textAlign: 'center' }}>
        Transaction not found
      </div>
    );
  }

  const tx = data.tx || {};
  const from = tx.from || '-';
  const to = tx.to || '-';
  const value = tx.value != null ? (Number(tx.value) / 1e18).toFixed(6) : '0';

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      <Link to="/explorer" style={{ fontSize: 13, color: 'var(--color-accent)', marginBottom: 20, display: 'inline-block' }}>
        ← Explorer
      </Link>
      <div className="card card-elevated" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Transaction</h1>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 500,
              background: data.status === 'confirmed' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
              color: data.status === 'confirmed' ? 'var(--color-success)' : 'var(--color-warning)',
            }}
          >
            {data.status || 'unknown'}
          </span>
        </div>
        <table style={{ width: '100%', fontSize: 13 }}>
          <tbody>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)', width: 140 }}>Hash</td>
              <td style={{ padding: '10px 0' }}>
                <Copyable value={data.hash || hash || ''} />
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Block</td>
              <td style={{ padding: '10px 0' }}>
                {data.blockHeight != null ? (
                  <Link to={`/explorer/block/${data.blockHeight}`} style={{ color: 'var(--color-accent)' }}>
                    #{data.blockHeight}
                  </Link>
                ) : (
                  'Pending'
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>From</td>
              <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)' }}>
                <Link to={`/explorer/address/${from}`} style={{ color: 'var(--color-accent)' }}>
                  {from}
                </Link>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>To</td>
              <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)' }}>
                {to ? (
                  <Link to={`/explorer/address/${to}`} style={{ color: 'var(--color-accent)' }}>
                    {to}
                  </Link>
                ) : (
                  'Contract Creation'
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Value</td>
              <td style={{ padding: '10px 0' }}>{value} BRY</td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Nonce</td>
              <td style={{ padding: '10px 0' }}>{tx.nonce ?? '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
