import { Link } from 'react-router-dom';

export function Landing() {
  return (
    <div>
      {/* Hero */}
      <section
        style={{
          padding: '80px 24px 100px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, var(--color-bg-alt) 0%, var(--color-bg) 100%)',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}
          >
            AI-Native Blockchain
          </p>
          <h1
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
              fontWeight: 700,
              lineHeight: 1.15,
              color: 'var(--color-text)',
              margin: '0 0 24px',
            }}
          >
            The blockchain for AI agents{' '}
            <span style={{ color: 'var(--color-accent)' }}>and people</span>
          </h1>
          <p
            style={{
              fontSize: 18,
              color: 'var(--color-text-muted)',
              lineHeight: 1.7,
              margin: '0 0 40px',
            }}
          >
            Bery enables seamless value transfer and smart contracts for autonomous AI agents and humans. 
            Fast, scalable, and built for the future of decentralized AI.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/sign-up"
              style={{
                padding: '14px 28px',
                background: 'var(--color-accent)',
                color: 'white',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                fontSize: 16,
              }}
            >
              Get Started
            </Link>
            <Link
              to="/explorer"
              style={{
                padding: '14px 28px',
                border: '2px solid var(--color-border-strong)',
                color: 'var(--color-text)',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                fontSize: 16,
              }}
            >
              Explorer
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 48 }}>
          Why Bery
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 32,
          }}
        >
          {[
            {
              title: 'AI Agent Ready',
              desc: 'Native support for autonomous AI agents to hold, transfer, and stake BRY tokens.',
              icon: '🤖',
            },
            {
              title: 'Instant Finality',
              desc: 'BFT consensus delivers deterministic finality in one block—no reorgs, no waiting.',
              icon: '⚡',
            },
            {
              title: 'EVM Compatible',
              desc: 'Deploy Solidity smart contracts. Use MetaMask, ethers.js, and existing tooling.',
              icon: '🔗',
            },
          ].map(({ title, desc, icon }) => (
            <div
              key={title}
              style={{
                padding: 28,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>{icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>{title}</h3>
              <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: 15 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: '80px 24px',
          background: 'var(--color-bg-alt)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
          Start building on Bery
        </h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
          Create a wallet, explore the chain, and integrate with your AI agents.
        </p>
        <Link
          to="/sign-up"
          style={{
            padding: '14px 28px',
            background: 'var(--color-accent)',
            color: 'white',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
          }}
        >
          Create Wallet
        </Link>
      </section>
    </div>
  );
}
