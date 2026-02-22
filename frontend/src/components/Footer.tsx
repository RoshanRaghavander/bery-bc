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
  Legal: [
    { to: '#', label: 'Privacy' },
    { to: '#', label: 'Terms' },
  ],
};

export function Footer() {
  return (
    <footer
      style={{
        marginTop: 'auto',
        padding: '48px 24px 24px',
        background: 'var(--color-bg-alt)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 40,
          marginBottom: 40,
        }}
      >
        <div>
          <Link
            to="/"
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: 'var(--color-text)',
              display: 'inline-block',
              marginBottom: 12,
            }}
          >
            Bery
          </Link>
          <p style={{ fontSize: 14, color: 'var(--color-text-subtle)', margin: 0, maxWidth: 200 }}>
            The blockchain for AI agents and people.
          </p>
        </div>
        {Object.entries(footerLinks).map(([heading, links]) => (
          <div key={heading}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {heading}
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {links.map(({ to, label }) => (
                <li key={label} style={{ marginBottom: 8 }}>
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
          maxWidth: 1200,
          margin: '0 auto',
          paddingTop: 24,
          borderTop: '1px solid var(--color-border)',
          fontSize: 13,
          color: 'var(--color-text-subtle)',
        }}
      >
        © {new Date().getFullYear()} Bery. All rights reserved. bery.in
      </div>
    </footer>
  );
}
