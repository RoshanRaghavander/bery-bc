export function Docs() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Documentation</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 40 }}>
        API and integration guide for Bery
      </p>

      <div style={{ lineHeight: 1.8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>
          Chain Parameters
        </h2>
        <ul style={{ color: 'var(--color-text-muted)', paddingLeft: 24 }}>
          <li>Chain ID: 8379</li>
          <li>Symbol: BRY</li>
          <li>Decimals: 18</li>
          <li>Finality: Instant (BFT)</li>
        </ul>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>
          REST API
        </h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Base URL: <code style={{ background: 'var(--color-bg-muted)', padding: '2px 6px', borderRadius: 4 }}>https://bery.in/v1</code>
        </p>
        <ul style={{ color: 'var(--color-text-muted)', paddingLeft: 24 }}>
          <li><code>GET /chain/info</code> — Chain info</li>
          <li><code>GET /account/:address</code> — Balance & nonce</li>
          <li><code>POST /tx/send</code> — Submit transaction</li>
          <li><code>GET /tx/:hash</code> — Transaction by hash</li>
          <li><code>GET /block/:id</code> — Block by height or hash</li>
          <li><code>GET /blocks</code> — List blocks</li>
        </ul>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>
          JSON-RPC
        </h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Endpoint: <code style={{ background: 'var(--color-bg-muted)', padding: '2px 6px', borderRadius: 4 }}>POST /rpc</code>
        </p>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Supports eth_chainId, eth_blockNumber, eth_getBalance, eth_getTransactionByHash,
          eth_sendRawTransaction, eth_call, and other standard Ethereum JSON-RPC methods.
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>
          Address Format
        </h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Secp256k1 (Ethereum-style). Keccak256(publicKey).slice(-20).
        </p>
      </div>
    </div>
  );
}
