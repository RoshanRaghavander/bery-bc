import { Link } from 'react-router-dom';

export function About() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>About Bery</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 40 }}>
        The blockchain for AI agents and people
      </p>

      <div style={{ lineHeight: 1.8, color: 'var(--color-text-muted)' }}>
        <p>
          Bery is an AI-native blockchain designed for seamless value transfer and smart contracts
          between autonomous AI agents and humans. It combines BFT consensus for instant finality
          with EVM compatibility for familiar developer tooling.
        </p>
        <p>
          Key features include native staking, support for MetaMask and ethers.js, and a lightweight
          node architecture suitable for both validators and light clients.
        </p>
        <p>
          Bery is powered by bery.in — your gateway to the AI-native economy.
        </p>
      </div>

      <div style={{ marginTop: 40 }}>
        <Link
          to="/sign-up"
          style={{
            padding: '12px 24px',
            background: 'var(--color-accent)',
            color: 'white',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
          }}
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
