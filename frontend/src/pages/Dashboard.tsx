import { Link } from 'react-router-dom';

export function Dashboard() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Dashboard</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 40 }}>
        Overview of your Bery activity
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 24,
          marginBottom: 48,
        }}
      >
        {[
          { label: 'Balance', value: '0 BRY', to: '/wallet' },
          { label: 'Transactions', value: '0', to: '/transactions' },
          { label: 'Network Height', value: '—', to: '/blocks' },
        ].map(({ label, value, to }) => (
          <Link
            key={label}
            to={to}
            style={{
              padding: 24,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <p style={{ fontSize: 14, color: 'var(--color-text-subtle)', margin: '0 0 8px' }}>
              {label}
            </p>
            <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{value}</p>
          </Link>
        ))}
      </div>

      <div
        style={{
          padding: 32,
          background: 'var(--color-bg-alt)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link
            to="/wallet"
            style={{
              padding: '12px 20px',
              background: 'var(--color-accent)',
              color: 'white',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
            }}
          >
            Open Wallet
          </Link>
          <Link
            to="/blocks"
            style={{
              padding: '12px 20px',
              border: '1px solid var(--color-border-strong)',
              color: 'var(--color-text)',
              fontWeight: 500,
              borderRadius: 'var(--radius-md)',
            }}
          >
            View Blocks
          </Link>
          <Link
            to="/explorer"
            style={{
              padding: '12px 20px',
              border: '1px solid var(--color-border-strong)',
              color: 'var(--color-text)',
              fontWeight: 500,
              borderRadius: 'var(--radius-md)',
            }}
          >
            Explorer
          </Link>
        </div>
      </div>
    </div>
  );
}
