import { Link } from 'react-router-dom';

export function Transactions() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Transactions</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 40 }}>
        Search and view transactions
      </p>

      <div
        style={{
          padding: 48,
          textAlign: 'center',
          background: 'var(--color-bg-alt)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <p style={{ color: 'var(--color-text-subtle)', marginBottom: 16 }}>
          Use the Explorer to search transactions by hash, address, or block.
        </p>
        <Link
          to="/explorer"
          style={{
            padding: '12px 24px',
            background: 'var(--color-accent)',
            color: 'white',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
          }}
        >
          Open Explorer
        </Link>
      </div>
    </div>
  );
}
