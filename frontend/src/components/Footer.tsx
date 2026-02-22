import { Link } from 'react-router-dom';

const footerLinks = {
  Product: [
    { to: '/explorer', label: 'Explorer' },
    { to: '/blocks', label: 'Blocks' },
    { to: '/wallet', label: 'Wallet' },
  ],
  Resources: [
    { to: '/docs', label: 'Documentation' },
    { to: '/about', label: 'About' },
  ],
};

export function Footer() {
  return (
    <footer
      style={{
        marginTop: 'auto',
        padding: '40px 24px 24px',
        background: 'var(--color-bg-alt)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 48,
          marginBottom: 32,
        }}
      >
        <div>
          <Link
            to="/"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--color-text)',
              display: 'inline-block',
              marginBottom: 12,
            }}
          >
            <span style={{ color: 'var(--color-accent)' }}>Bery</span>.in
          </Link>
          <p style={{ fontSize: 13, color: 'var(--color-text-subtle)', margin: 0, maxWidth: 260 }}>
            The blockchain for AI agents and people. Fast, EVM-compatible, built for the future.
          </p>
        </div>
        {Object.entries(footerLinks).map(([heading, links]) => (
          <div key={heading}>
            <h4
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                margin: '0 0 16px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {heading}
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {links.map(({ to, label }) => (
                <li key={label} style={{ marginBottom: 10 }}>
                  <Link to={to} style={{ fontSize: 14, color: 'var(--color-text-subtle)' }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          paddingTop: 24,
          borderTop: '1px solid var(--color-border)',
          fontSize: 13,
          color: 'var(--color-text-subtle)',
        }}
      >
        © {new Date().getFullYear()} Bery. bery.in
      </div>
    </footer>
  );
}
