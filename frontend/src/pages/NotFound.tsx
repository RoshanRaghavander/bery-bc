import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 72, fontWeight: 700, margin: 0, color: 'var(--color-text-muted)' }}>404</h1>
      <p style={{ fontSize: 18, color: 'var(--color-text-muted)', marginTop: 16, marginBottom: 32 }}>
        Page not found
      </p>
      <Link
        to="/"
        style={{
          padding: '12px 24px',
          background: 'var(--color-accent)',
          color: 'white',
          fontWeight: 600,
          borderRadius: 'var(--radius-md)',
          fontSize: 14,
        }}
      >
        Go home
      </Link>
    </div>
  );
}
