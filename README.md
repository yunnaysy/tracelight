# Tracelight

A calm, mobile-first multichain wallet explorer. Search any **wallet address, ENS name, transaction hash or token contract** and see balances, holdings and recent activity across 11 EVM networks, using only free public data and no API keys.

**Live:** https://tracelight-explorer.vercel.app

## What it does
- **Smart search** that detects whether the input is an address, ENS name, tx hash, token contract, or token symbol.
- **Wallet view** with:
  - native balances on Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Unichain, zkSync Era, Scroll, Gnosis and Avalanche;
  - priced ERC-20 holdings, estimated USD value and chain allocation;
  - a merged activity feed (All / Incoming / Outgoing / Failed, plus a chain filter);
  - a transaction sheet for each row.
- **Transaction view** that finds the hash on every supported chain over RPC and shows:
  - status, from/to, value and fee (including the OP-stack L1 fee), gas, block, time and token movements;
  - deep links to each chain's explorer.
- **Wallet summary**: a short plain-language card (activity level, main chains, top tokens, net flow, first/last activity, patterns such as DEX swaps, bridges or spam). It is rule-based and built only from the data on the page, so there is no AI service, no key and no cost.
- **English / Indonesian** toggle (EN/ID). Indonesian uses Masuk / Keluar / Gagal everywhere, with the same direction rule on every network for native, token and failed transactions.
- **Watchlist + notifications**: tap the bell on any wallet. The list lives in localStorage. While a tab is open, Tracelight checks Ethereum, Base, Arbitrum, BNB Chain and Polygon about once a minute and shows a browser notification (Notification API through a tiny service worker, no push service) plus an in-app toast and badge. One tab polls at a time, failed sources back off, and an RPC nonce+balance check covers any indexer that is down.
- **Home** with the live ETH price, latest block and gas for every network (refreshed every 20s), and a live Ethereum transaction feed.

## Data sources (all free, no keys)
| Data | Source |
|---|---|
| Native balances, blocks, gas, tx + receipts | PublicNode JSON-RPC (zkSync: official RPC) |
| Address history, token transfers, labels | Blockscout API v2 per chain |
| BNB Chain history | Binplorer API with its public `freekey` |
| Multichain ERC-20 holdings, token search | Blockscout multichain aggregator |
| ENS forward and reverse resolution | Ethereum mainnet via viem |
| Prices | CoinGecko simple price (Blockscout stats as fallback) |

Requests go straight from the browser. If a source blocks or fails, they go through `/api/x`, a small allow-listed, cached read-only proxy on Vercel. Each section loads and fails on its own, with an honest message.

## Honesty notes
- USD values are estimates at today's price.
- Airdropped spam is common, so a token only counts toward value if it is priced, has a market cap of at least $1M, and the holding is under 0.5% of that market cap. Excluded tokens are counted and disclosed.
- Zero-value and scam-flagged token transfers (address poisoning) are hidden and counted.
- History shows the latest page per network. Gnosis and Avalanche show balances only, because no free keyless indexer is available for them. BNB Chain history covers native BNB (including failed) and BEP-20 transfers, but not zero-value contract calls that succeed.
- The watchlist only runs while a Tracelight tab is open; there is no server push.

## Stack
Vite, React 18 and TypeScript, with viem for ENS. The CSS is hand-written. Hosted on Vercel (static app plus one edge-cached function).

```bash
npm install
npm run dev
```

## Owner
Built and maintained by **Yunay**, who can be reached on X at [@madeofstardusth](https://x.com/madeofstardusth).

MIT licensed.
