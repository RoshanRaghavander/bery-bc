import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Copyable } from '../components/Copyable';

export function AddressDetail() {
  const { address } = useParams<{ address: string }>();
  const [account, setAccount] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const addr = address?.replace(/^0x/, '');
    if (!addr) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [accRes, txsRes] = await Promise.all([
          fetch(`/v1/account/${addr}`),
          fetch(`/v1/address/${addr}/transactions?limit=50`),
        ]);
        const accData = await accRes.json();
        const txsData = await txsRes.json();
        if (!cancelled) {
          setAccount(accRes.ok ? accData : null);
          setTxs(txsData.transactions || []);
        }
      } catch {
        if (!cancelled) setAccount(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 48, textAlign: 'center' }}>
        Loading...
      </div>
    );
  }
  if (!account) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 48, textAlign: 'center' }}>
        Address not found
      </div>
    );
  }

  const balance = Number(account.balance || 0) / 1e18;
  const displayAddr = account.address || address;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      <Link to="/explorer" style={{ fontSize: 13, color: 'var(--color-accent)', marginBottom: 20, display: 'inline-block' }}>
        ← Explorer
      </Link>
      <div className="card card-elevated" style={{ padding: 24, marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Address</h1>
        <table style={{ width: '100%', fontSize: 13 }}>
          <tbody>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)', width: 140 }}>Address</td>
              <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)' }}>
                <Copyable value={displayAddr} />
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Balance</td>
              <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)' }}>{balance.toFixed(6)} BRY</td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-muted)' }}>Nonce</td>
              <td style={{ padding: '10px 0' }}>{account.nonce ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card card-elevated" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Transaction History</h2>
        </div>
        {txs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
            No transactions yet
          </div>
        ) : (
          txs.map((t: any) => (
            <Link
              key={t.txHash}
              to={`/explorer/tx/${t.txHash}`}
              style={{
                display: 'block',
                padding: '16px 24px',
                borderBottom: '1px solid var(--color-border)',
                textDecoration: 'none',
                color: 'inherit',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
              }}
            >
              <Copyable value={t.txHash} display={`${String(t.txHash).slice(0, 18)}...`} />
              <span style={{ marginLeft: 16, color: 'var(--color-text-muted)' }}>Block #{t.height}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
