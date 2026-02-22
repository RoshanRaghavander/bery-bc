import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navLinks = [
  { to: '/explorer', label: 'Explorer' },
  { to: '/blocks', label: 'Blocks' },
  { to: '/docs', label: 'Docs' },
  { to: '/about', label: 'About' },
];

export function Navbar() {
  const location = useLocation();
  const { user, logout, loading } = useAuth();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ color: 'var(--color-accent)' }}>Bery</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-subtle)', fontWeight: 500 }}>.in</span>
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
          }}
        >
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={{
                color: location.pathname === to ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontWeight: 500,
                fontSize: 15,
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!loading && (
            user ? (
              <>
                <Link to="/dashboard" style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                  {user.email}
                </Link>
                <button
                  onClick={logout}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    color: 'var(--color-text-muted)',
                    fontWeight: 500,
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
                    padding: '8px 16px',
                    color: 'var(--color-text-muted)',
                    fontWeight: 500,
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
                    borderRadius: 'var(--radius-md)',
                    transition: 'background var(--transition)',
                  }}
                >
                  Get Started
                </Link>
              </>
            )
          )}
        </div>
      </nav>
    </header>
  );
}
