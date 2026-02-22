import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navLinks = [
  { to: '/explorer', label: 'Explorer' },
  { to: '/blocks', label: 'Blocks' },
  { to: '/wallet', label: 'Wallet' },
  { to: '/staking', label: 'Staking' },
  { to: '/docs', label: 'Docs' },
];

export function Navbar() {
  const location = useLocation();
  const { user, logout, loading } = useAuth();

  const linkStyle = (to: string) => ({
    color: location.pathname.startsWith(to) ? 'var(--color-text)' : 'var(--color-text-muted)',
    fontWeight: 500,
    fontSize: 14,
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
  });

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(15, 15, 18, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <nav
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 24px',
          height: 'var(--navbar-height)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 32,
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ color: 'var(--color-accent)' }}>Bery</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-subtle)', fontWeight: 500 }}>.in</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {navLinks.map(({ to, label }) => (
            <Link key={to} to={to} style={linkStyle(to)}>
              {label}
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!loading &&
            (user ? (
              <>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{user.email}</span>
                <Link
                  to="/dashboard"
                  style={{
                    padding: '8px 14px',
                    background: 'var(--color-bg-muted)',
                    color: 'var(--color-text-muted)',
                    fontWeight: 500,
                    fontSize: 13,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  style={{
                    padding: '8px 14px',
                    background: 'transparent',
                    color: 'var(--color-text-muted)',
                    fontWeight: 500,
                    fontSize: 13,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/sign-in"
                  style={{
                    padding: '8px 14px',
                    color: 'var(--color-text-muted)',
                    fontWeight: 500,
                    fontSize: 13,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  Sign In
                </Link>
                <Link
                  to="/sign-up"
                  style={{
                    padding: '8px 18px',
                    background: 'var(--color-accent)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: 13,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  Get Started
                </Link>
              </>
            ))}
        </div>
      </nav>
    </header>
  );
}
