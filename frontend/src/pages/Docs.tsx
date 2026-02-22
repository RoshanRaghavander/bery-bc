export function Docs() {
  const codeStyle = {
    background: 'var(--color-bg-muted)',
    padding: '2px 8px',
    borderRadius: 6,
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
  };
  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}` : 'https://bery.in';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Documentation</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 40, fontSize: 14 }}>
        API reference, integration guide, and token standards for Bery
      </p>

      <div style={{ lineHeight: 1.8 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Chain Parameters</h2>
        <ul style={{ color: 'var(--color-text-muted)', paddingLeft: 24, fontSize: 14 }}>
          <li>Chain ID: 8379</li>
          <li>Symbol: BRY</li>
          <li>Decimals: 18</li>
          <li>Finality: Instant (BFT)</li>
        </ul>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>REST API</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Base URL: <code style={codeStyle}>{baseUrl}/v1</code>
        </p>
        <ul style={{ color: 'var(--color-text-muted)', paddingLeft: 24, fontSize: 14 }}>
          <li><code style={codeStyle}>GET /chain/info</code> — Chain info</li>
          <li><code style={codeStyle}>GET /account/:address</code> — Balance &amp; nonce</li>
          <li><code style={codeStyle}>GET /address/:address/transactions</code> — Tx history</li>
          <li><code style={codeStyle}>POST /tx/send</code> — Submit transaction</li>
          <li><code style={codeStyle}>GET /tx/:hash</code> — Transaction by hash</li>
          <li><code style={codeStyle}>GET /block/:id</code> — Block by height or hash</li>
          <li><code style={codeStyle}>GET /blocks</code> — List blocks</li>
          <li><code style={codeStyle}>GET /contracts/:address</code> — Verified contract</li>
          <li><code style={codeStyle}>POST /contracts/verify</code> — Verify &amp; publish source (add expectedBytecode for bytecode check)</li>
          <li><code style={codeStyle}>GET /staking/info</code> — Total staked, stakers</li>
          <li><code style={codeStyle}>GET /staking/:address</code> — Stake for address</li>
        </ul>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          OpenAPI spec: <a href="/docs/openapi.yaml" style={{ color: 'var(--color-accent)' }}>{baseUrl}/docs/openapi.yaml</a>
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>JSON-RPC</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Endpoint: <code style={codeStyle}>POST {baseUrl}/rpc</code>
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Supports eth_chainId, eth_blockNumber, eth_getBalance, eth_getTransactionByHash,
          eth_sendRawTransaction, eth_call, eth_estimateGas, eth_getLogs, and other standard methods.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Integration (ethers.js)</h2>
        <pre style={{ background: 'var(--color-bg-muted)', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
{`const provider = new ethers.JsonRpcProvider("${baseUrl}/rpc");
const balance = await provider.getBalance("0x...");
const tx = await signer.sendTransaction({ to: "0x...", value: ethers.parseEther("1") });`}
        </pre>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Contract Verification</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          POST to <code style={codeStyle}>/v1/contracts/verify</code> with <code style={codeStyle}>address, name, source, abi</code>.
          Include <code style={codeStyle}>expectedBytecode</code> (hex) to verify compiled bytecode matches deployed contract.
          Once verified, source is published and available via <code style={codeStyle}>GET /v1/contracts/:address</code>.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Token Standards (ERC20 / ERC721)</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Deploy standard Solidity contracts. See <code style={codeStyle}>contracts/README.md</code> in the repo for:
        </p>
        <ul style={{ color: 'var(--color-text-muted)', paddingLeft: 24, fontSize: 14 }}>
          <li>Sample ERC20 and ERC721 contracts</li>
          <li>Foundry and Hardhat deployment steps</li>
          <li>Contract verification flow</li>
        </ul>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Upgrade Mechanism</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Bery supports config-driven upgrades. See <code style={codeStyle}>docs/UPGRADE.md</code> for:
        </p>
        <ul style={{ color: 'var(--color-text-muted)', paddingLeft: 24, fontSize: 14 }}>
          <li>Node software upgrades (rolling restart)</li>
          <li>Config-only changes</li>
          <li>Hard fork coordination</li>
        </ul>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Set <code style={codeStyle}>CHAIN_VERSION</code> in env to track chain version.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Address Format</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Secp256k1 (Ethereum-style). Keccak256(publicKey).slice(-20).
        </p>
      </div>
    </div>
  );
}
