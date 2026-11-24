import { createPublicClient, http, fallback } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import { CHAINS, Chain, chainById, hasHistory } from './chains'
import { fromUnits } from './format'

const AGG = 'https://multichain-aggregator.services.blockscout.com/api/v1/clusters/multichain'

/* ---------------- fetch helpers: cache, timeout, proxy fallback ---------------- */
const cache = new Map<string, { t: number; v: Promise<any> }>()

async function raw(url: string, init?: RequestInit, ms = 9000) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
  if (r.status === 404) {
    const e: any = new Error('not found'); e.status = 404; throw e
  }
  if (!r.ok) { const e: any = new Error(`HTTP ${r.status}`); e.status = r.status; throw e }
  const text = await r.text()
  if (!/^\s*[\[{]/.test(text)) throw new Error('non-JSON response')
  return JSON.parse(text)
}

const proxied = (u: string) => `/api/x?u=${encodeURIComponent(u)}`

/** GET JSON: direct first (browser IP), then via our cached edge proxy. */
export function getJSON(url: string, ttl = 20000, proxyFirst = false): Promise<any> {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.t < ttl) return hit.v
  const p = (async () => {
    const order = proxyFirst ? [proxied(url), url] : [url, proxied(url)]
    let last: any
    for (const u of order) {
      try { return await raw(u) } catch (e: any) { last = e; if (e?.status === 404) throw e }
    }
    throw last
  })()
  cache.set(url, { t: Date.now(), v: p })
  p.catch(() => cache.delete(url))
  return p
}

/* ---------------- JSON-RPC ---------------- */
let rpcId = 1
export async function rpc<T = any>(chain: Chain, method: string, params: any[] = []): Promise<T> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params })
  const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body }
  let j: any
  try { j = await raw(chain.rpc, init, 8000) } catch { j = await raw(proxied(chain.rpc), init, 10000) }
  if (j.error) throw new Error(j.error.message || 'rpc error')
  return j.result as T
}

/** Several calls in one JSON-RPC batch request: one HTTP request instead of many, gentler on free RPC limits. */
export async function rpcBatch(chain: Chain, calls: [string, any[]][]): Promise<any[]> {
  const body = JSON.stringify(calls.map(([method, params], i) => ({ jsonrpc: '2.0', id: i + 1, method, params })))
  const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body }
  let j: any
  try { j = await raw(chain.rpc, init, 8000) } catch { j = await raw(proxied(chain.rpc), init, 10000) }
  if (!Array.isArray(j)) throw new Error(j?.error?.message || 'batch not supported')
  const byId = new Map(j.map((r: any) => [r.id, r]))
  return calls.map((_, i) => {
    const r: any = byId.get(i + 1)
    if (!r || r.error) throw new Error(r?.error?.message || 'rpc error')
    return r.result
  })
}

export const ens = createPublicClient({
  chain: mainnet,
  transport: fallback([http('https://ethereum-rpc.publicnode.com'), http('https://eth.llamarpc.com')]),
})

export async function resolveName(name: string): Promise<string | null> {
  try { return await ens.getEnsAddress({ name: normalize(name) }) } catch { return null }
}
export async function reverseName(addr: string): Promise<string | null> {
  try { return await ens.getEnsName({ address: addr as `0x${string}` }) } catch { return null }
}

/* ---------------- prices ---------------- */
export type Prices = Record<string, { usd: number; usd_24h_change?: number }>
export async function getPrices(): Promise<Prices> {
  const ids = [...new Set(CHAINS.map((c) => c.cg))].join(',')
  try {
    return await getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`, 60000, true)
  } catch {
    // fallback: ETH price from Blockscout stats
    const s = await getJSON('https://eth.blockscout.com/api/v2/stats', 60000)
    return { ethereum: { usd: Number(s.coin_price), usd_24h_change: s.coin_price_change_percentage } }
  }
}
export const nativeUsd = (p: Prices | undefined, c: Chain) => p?.[c.cg]?.usd ?? null

/* ---------------- network pulse ---------------- */
export type Pulse = { chain: Chain; block?: number; gasGwei?: number; ts?: number; ok: boolean }
export async function getPulse(chain: Chain): Promise<Pulse> {
  try {
    const [bn, gp] = await rpcBatch(chain, [['eth_blockNumber', []], ['eth_gasPrice', []]])
    return { chain, block: parseInt(bn, 16), gasGwei: Number(BigInt(gp)) / 1e9, ok: true, ts: Date.now() }
  } catch {
    return { chain, ok: false }
  }
}

/* ---------------- address: balances & holdings ---------------- */
export type Holding = {
  chain: Chain
  symbol: string
  name: string
  amount: number
  usd: number | null
  price: number | null
  native: boolean
  contract?: string
  icon?: string | null
}

export async function getNativeBalances(addr: string, prices?: Prices) {
  return Promise.all(
    CHAINS.map(async (c) => {
      try {
        const [b, n] = await rpcBatch(c, [['eth_getBalance', [addr, 'latest']], ['eth_getTransactionCount', [addr, 'latest']]])
        const amount = fromUnits(BigInt(b), 18)
        const price = nativeUsd(prices, c)
        return { chain: c, ok: true, nonce: n ? parseInt(n, 16) : null, h: { chain: c, symbol: c.symbol, name: c.symbol, amount, price, usd: price != null ? amount * price : null, native: true } as Holding }
      } catch {
        return { chain: c, ok: false, nonce: null, h: null }
      }
    }),
  )
}

/**
 * ERC-20 holdings from the Blockscout multichain aggregator.
 * Airdropped spam is common, so a token only counts toward value when it is priced,
 * has a real market cap (>= $1M), and the holding is < 0.5% of that market cap.
 */
export async function getTokenHoldings(addr: string): Promise<{ items: Holding[]; hidden: number; ok: boolean }> {
  try {
    let items: any[] = []
    let next: any = null
    for (let i = 0; i < 3; i++) {
      const qs = new URLSearchParams({ page_size: '50', ...(next?.page_token ? { page_token: next.page_token } : {}) })
      const j = await getJSON(`${AGG}/addresses/${addr}/tokens?${qs}`, 60000)
      items = items.concat(j.items || [])
      next = j.next_page_params
      if (!next) break
    }
    const out: Holding[] = []
    let hidden = 0
    for (const it of items) {
      const t = it.token || {}
      if (t.type !== 'ERC-20') continue
      const dec = Number(t.decimals ?? 18)
      const price = t.exchange_rate != null ? Number(t.exchange_rate) : null
      const mcap = Number(t.circulating_market_cap || 0)
      for (const [cid, v] of Object.entries<string>(it.chain_values || {})) {
        const chain = chainById(cid)
        if (!chain) continue
        const amount = fromUnits(v, dec)
        const usd = price != null ? amount * price : null
        const legit = price != null && mcap >= 1e6 && usd != null && usd < mcap * 0.005
        if (!legit) { hidden++; continue }
        if (usd! < 0.01) continue
        out.push({ chain, symbol: t.symbol || '?', name: t.name || t.symbol || 'Token', amount, usd, price, native: false, contract: t.address_hash, icon: t.icon_url })
      }
    }
    return { items: out, hidden, ok: true }
  } catch {
    return { items: [], hidden: 0, ok: false }
  }
}

/* ---------------- address: activity ---------------- */
export type Party = { hash: string; label: string | null; contract?: boolean }
export type Activity = {
  id: string
  chain: Chain
  hash: string
  ts: string
  dir: 'in' | 'out' | 'self' | 'fail'
  party: Party | null
  amount: number | null
  symbol: string
  usd: number | null
  method: string | null
  kind: 'native' | 'token' | 'call'
}

const party = (p: any): Party | null => (p?.hash ? { hash: p.hash, label: p.ens_domain_name || p.name || null, contract: !!p.is_contract } : null)

export type ChainActivity = { chain: Chain; ok: boolean; items: Activity[]; hiddenSpam: number; limited?: boolean }

/** Direction from the searched address's point of view. Same rule on every chain and source. */
export function direction(me: string, from: string, to: string, failed = false): Activity['dir'] {
  if (failed) return 'fail'
  if (from === me && to === me) return 'self'
  return to === me ? 'in' : 'out'
}

const isRateLimit = (e: any) => e?.status === 429 || /429|rate/i.test(String(e?.message || ''))

export async function getChainActivity(chain: Chain, addr: string, prices?: Prices, ttl = 30000): Promise<ChainActivity> {
  if (!hasHistory(chain)) return { chain, ok: false, items: [], hiddenSpam: 0 }
  if (!chain.bs) return getBinplorerActivity(chain, addr, prices, ttl)
  const me = addr.toLowerCase()
  try {
    const [txs, tts] = await Promise.all([
      getJSON(`${chain.bs}/api/v2/addresses/${addr}/transactions`, ttl),
      getJSON(`${chain.bs}/api/v2/addresses/${addr}/token-transfers?type=ERC-20`, ttl).catch(() => ({ items: [] })),
    ])
    const items: Activity[] = []
    let hiddenSpam = 0
    const tokenHashes = new Set<string>()
    for (const t of tts.items || []) {
      const tok = t.token || {}
      const scam = t.from?.is_scam || t.to?.is_scam || tok.reputation === 'scam' || tok.reputation === 'spam'
      const price = tok.exchange_rate != null ? Number(tok.exchange_rate) : null
      const amount = fromUnits(t.total?.value, Number(t.total?.decimals ?? tok.decimals ?? 18))
      // zero-value transfers are a common address-poisoning pattern
      if (scam || price == null || amount === 0) { hiddenSpam++; continue }
      const hash = t.transaction_hash || t.tx_hash
      const from = (t.from?.hash || '').toLowerCase(), to = (t.to?.hash || '').toLowerCase()
      const dir = direction(me, from, to)
      tokenHashes.add(hash)
      items.push({
        id: `${chain.id}:${hash}:${t.log_index}`, chain, hash, ts: t.timestamp,
        dir, party: party(dir === 'in' ? t.from : t.to), amount, symbol: tok.symbol || 'TOKEN',
        usd: amount * price, method: t.method && !t.method.startsWith('0x') ? t.method : null, kind: 'token',
      })
    }
    for (const x of txs.items || []) {
      const from = (x.from?.hash || '').toLowerCase(), to = (x.to?.hash || '').toLowerCase()
      const failed = x.status === 'error' || (x.result && x.result !== 'success' && x.result !== 'pending')
      const value = fromUnits(x.value, 18)
      if (!failed && value === 0 && tokenHashes.has(x.hash)) continue
      const dir = direction(me, from, to, !!failed)
      const price = nativeUsd(prices, chain)
      items.push({
        id: `${chain.id}:${x.hash}`, chain, hash: x.hash, ts: x.timestamp,
        dir, party: party(to === me ? x.from : x.to || x.created_contract),
        amount: value, symbol: chain.symbol, usd: price != null ? value * price : null,
        method: x.method || (x.created_contract ? 'Contract creation' : null), kind: value === 0 ? 'call' : 'native',
      })
    }
    return { chain, ok: true, items, hiddenSpam }
  } catch (e) {
    return { chain, ok: false, items: [], hiddenSpam: 0, limited: isRateLimit(e) }
  }
}

/**
 * BNB Chain history from Binplorer (Ethplorer for BSC) using its public `freekey`.
 * Native BNB transfers (including failed ones) + BEP-20 transfers. Free, no signup.
 */
const BINPLORER = 'https://api.binplorer.com'
async function getBinplorerActivity(chain: Chain, addr: string, prices?: Prices, ttl = 30000): Promise<ChainActivity> {
  const me = addr.toLowerCase()
  try {
    const [txs, ops] = await Promise.all([
      getJSON(`${BINPLORER}/getAddressTransactions/${me}?apiKey=freekey&limit=50&showZeroValues=1`, ttl),
      getJSON(`${BINPLORER}/getAddressHistory/${me}?apiKey=freekey&limit=50&type=transfer`, ttl).catch(() => ({ operations: [] })),
    ])
    if (!Array.isArray(txs) && txs?.error) throw Object.assign(new Error(txs.error.message || 'binplorer'), { status: txs.error.code === 429 ? 429 : 0 })
    const items: Activity[] = []
    let hiddenSpam = 0
    const tokenHashes = new Set<string>()
    for (const o of ops?.operations || []) {
      const tok = o.tokenInfo || {}
      const price = tok.price && tok.price.rate != null ? Number(tok.price.rate) : null
      const mcap = tok.price ? Number(tok.price.marketCapUsd || 0) : 0
      const dec = Number(tok.decimals ?? 18), rawV = String(o.value ?? '0')
      const amount = /^\d+$/.test(rawV) ? fromUnits(rawV, dec) : Number(rawV) / 10 ** dec
      if (price == null || mcap < 1e5 || amount === 0) { hiddenSpam++; continue }
      const from = (o.from || '').toLowerCase(), to = (o.to || '').toLowerCase()
      const dir = direction(me, from, to)
      tokenHashes.add(o.transactionHash)
      items.push({
        id: `${chain.id}:${o.transactionHash}:${from}:${to}:${tok.address}`, chain, hash: o.transactionHash, ts: new Date(o.timestamp * 1000).toISOString(),
        dir, party: { hash: dir === 'in' ? from : to, label: null }, amount, symbol: tok.symbol || 'TOKEN', usd: amount * price, method: null, kind: 'token',
      })
    }
    const price = nativeUsd(prices, chain)
    for (const x of Array.isArray(txs) ? txs : []) {
      const from = (x.from || '').toLowerCase(), to = (x.to || '').toLowerCase()
      const failed = x.success === false
      const value = Number(x.value) || 0
      if (!failed && value === 0 && tokenHashes.has(x.hash)) continue
      const dir = direction(me, from, to, failed)
      items.push({
        id: `${chain.id}:${x.hash}`, chain, hash: x.hash, ts: new Date(x.timestamp * 1000).toISOString(),
        dir, party: { hash: to === me ? from : to, label: null }, amount: value, symbol: chain.symbol,
        usd: price != null ? value * price : null, method: null, kind: value === 0 ? 'call' : 'native',
      })
    }
    return { chain, ok: true, items, hiddenSpam }
  } catch (e) {
    return { chain, ok: false, items: [], hiddenSpam: 0, limited: isRateLimit(e) }
  }
}

/** Cheap RPC fingerprint (nonce + balance) used by the watchlist when an indexer is unreachable. */
export async function rpcFingerprint(chain: Chain, addr: string): Promise<string | null> {
  try {
    const [n, b] = await rpcBatch(chain, [['eth_getTransactionCount', [addr, 'latest']], ['eth_getBalance', [addr, 'latest']]])
    return `${parseInt(n, 16)}:${BigInt(b).toString()}`
  } catch { return null }
}

/* ---------------- home: latest transactions on a chain ---------------- */
export async function getLatestTxs(chain: Chain): Promise<any[]> {
  const j = await getJSON(`${chain.bs}/api/v2/main-page/transactions`, 15000)
  return Array.isArray(j) ? j : j.items || []
}

/* ---------------- tx detail via RPC (works on every chain) ---------------- */
export type TxDetail = {
  chain: Chain
  hash: string
  status: 'success' | 'failed' | 'pending'
  from: string
  to: string | null
  created?: string | null
  value: number
  fee: number | null
  gasUsed?: number
  gasPriceGwei?: number
  block: number | null
  ts: number | null
  nonce: number
  method?: string | null
  fromLabel?: string | null
  toLabel?: string | null
  transfers: { token: string; symbol: string; from: string; to: string; amount: number }[]
}

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export async function findTx(hash: string): Promise<Chain[]> {
  const res = await Promise.all(CHAINS.map(async (c) => { try { return (await rpc(c, 'eth_getTransactionByHash', [hash])) ? c : null } catch { return null } }))
  return res.filter(Boolean) as Chain[]
}

async function erc20Meta(chain: Chain, token: string) {
  const call = (data: string) => rpc<string>(chain, 'eth_call', [{ to: token, data }, 'latest']).catch(() => '0x')
  const [sym, dec] = await Promise.all([call('0x95d89b41'), call('0x313ce567')])
  let symbol = 'TOKEN'
  try {
    if (sym.length >= 194) {
      const len = parseInt(sym.slice(66, 130), 16)
      symbol = new TextDecoder().decode(Uint8Array.from((sym.slice(130, 130 + len * 2).match(/../g) || []).map((h) => parseInt(h, 16))))
    } else if (sym.length === 66) {
      symbol = new TextDecoder().decode(Uint8Array.from((sym.slice(2).match(/../g) || []).map((h) => parseInt(h, 16)).filter(Boolean)))
    }
  } catch {}
  const decimals = dec && dec !== '0x' ? parseInt(dec, 16) : 18
  return { symbol: symbol.slice(0, 16) || 'TOKEN', decimals: decimals > 36 ? 18 : decimals }
}

export async function getTx(chain: Chain, hash: string): Promise<TxDetail | null> {
  const tx: any = await rpc(chain, 'eth_getTransactionByHash', [hash])
  if (!tx) return null
  const rc: any = await rpc(chain, 'eth_getTransactionReceipt', [hash]).catch(() => null)
  const blockNum = tx.blockNumber ? parseInt(tx.blockNumber, 16) : null
  const blk: any = blockNum != null ? await rpc(chain, 'eth_getBlockByNumber', [tx.blockNumber, false]).catch(() => null) : null
  let fee: number | null = null
  let gasPriceGwei: number | undefined
  if (rc) {
    const gp = BigInt(rc.effectiveGasPrice || tx.gasPrice || '0x0')
    gasPriceGwei = Number(gp) / 1e9
    let f = BigInt(rc.gasUsed) * gp
    if (rc.l1Fee) f += BigInt(rc.l1Fee) // OP-stack L1 data fee
    fee = fromUnits(f, 18)
  }
  const transfers: TxDetail['transfers'] = []
  const logs = (rc?.logs || []).filter((l: any) => l.topics?.[0] === TRANSFER && l.topics.length === 3 && l.data && l.data !== '0x').slice(0, 8)
  const metas = new Map<string, Promise<{ symbol: string; decimals: number }>>()
  for (const l of logs) if (!metas.has(l.address)) metas.set(l.address, erc20Meta(chain, l.address))
  for (const l of logs) {
    const m = await metas.get(l.address)!
    transfers.push({ token: l.address, symbol: m.symbol, from: '0x' + l.topics[1].slice(26), to: '0x' + l.topics[2].slice(26), amount: fromUnits(BigInt(l.data.slice(0, 66)), m.decimals) })
  }
  const d: TxDetail = {
    chain, hash, transfers,
    status: !rc ? 'pending' : rc.status === '0x1' ? 'success' : 'failed',
    from: tx.from, to: tx.to, created: rc?.contractAddress || null,
    value: fromUnits(BigInt(tx.value), 18), fee, gasUsed: rc ? parseInt(rc.gasUsed, 16) : undefined, gasPriceGwei,
    block: blockNum, ts: blk ? parseInt(blk.timestamp, 16) * 1000 : null, nonce: parseInt(tx.nonce, 16),
  }
  // optional enrichment (method name, labels) from Blockscout when reachable
  if (chain.bs) {
    try {
      const j = await getJSON(`${chain.bs}/api/v2/transactions/${hash}`, 60000)
      d.method = j.method || null
      d.fromLabel = j.from?.ens_domain_name || j.from?.name || null
      d.toLabel = j.to?.ens_domain_name || j.to?.name || null
    } catch {}
  }
  return d
}

/* ---------------- token contract lookup ---------------- */
export async function getToken(addr: string): Promise<any | null> {
  try {
    const j = await getJSON(`${AGG}/search/tokens?q=${addr}`, 60000)
    return (j.items || []).find((t: any) => t.address_hash?.toLowerCase() === addr.toLowerCase()) || null
  } catch { return null }
}
export async function searchTokens(q: string): Promise<any[]> {
  try { const j = await getJSON(`${AGG}/search/tokens?q=${encodeURIComponent(q)}`, 60000); return j.items || [] } catch { return [] }
}
