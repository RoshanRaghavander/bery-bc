# BRY Tokenomics (Solana-Style)

BRY uses a **disinflationary model** similar to Solana.

## Supply Overview

| Parameter | Value |
|-----------|-------|
| **Genesis supply** | 1,000,000,000 BRY (1B) |
| **Block reward** | ~13 BRY/block (year 1) |
| **Long-term inflation** | Target ~1.5% |
| **Hard cap** | None |

## Genesis Allocation

- Total 1B BRY at genesis, **split equally** among validators
- 1 validator → 1B BRY
- 4 validators → 250M each
- 10 validators → 100M each

## Inflation Schedule

- **Year 1**: ~8% annual (13 BRY × ~6.3M blocks ≈ 80M new BRY)
- **Long-term**: Decrease `BLOCK_REWARD` over time toward ~1.5% inflation (~15M BRY/year)
- Operators can update `BLOCK_REWARD` at upgrade cycles (see [UPGRADE.md](UPGRADE.md))

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `GENESIS_SUPPLY_TOTAL` | 1000000000 | Total BRY at genesis (split among validators) |
| `BLOCK_REWARD` | 13 | BRY per block |

## Decimals

BRY uses **18 decimals** (same as ETH).
