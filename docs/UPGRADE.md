# Bery Chain Upgrade Guide

This document describes how to upgrade the Bery network when protocol or node changes are required.

## Upgrade Types

### 1. Node Software Upgrade (No Consensus Change)

When fixing bugs, improving performance, or adding features that don't change block format or consensus:

1. **Prepare** — Build new node version
2. **Coordinate** — Notify validators of maintenance window
3. **Deploy** — Rolling restart: stop node, deploy new binary, start
4. **Verify** — Check `/ready` and block production

Validators can upgrade one at a time; the chain continues as long as quorum is met.

### 2. Config-Only Upgrade

For changes that only affect config (e.g. `BLOCK_TIME`, `CHAIN_NAME`):

1. Update env vars or `.env`
2. Restart the node
3. No coordination needed for single-validator; for multi-validator, ensure all nodes use compatible config

### 3. Hard Fork (Breaking Change)

When changing block format, tx format, or consensus rules:

1. **Propose** — Document the change, new version, and activation height
2. **Coordinate** — All validators must upgrade before the activation height
3. **Deploy** — All validators deploy the new version
4. **Activate** — At the agreed height, new rules take effect

If validators don't upgrade in sync, the chain may fork. Ensure >2/3 validators run the new version before activation.

## Version Tracking

- `CHAIN_VERSION` (optional env) — Semantic version for on-chain or external tools
- Node version is reported in `/status` or logs

## Rollback

If an upgrade fails:

1. Stop the new node
2. Restore previous binary and data
3. Restart
4. If a hard fork was partially applied, you may need to revert to a pre-fork snapshot

## Best Practices

- Test upgrades on a devnet first
- Keep backups of `data/` before major upgrades
- Use the same node version across validators when possible
