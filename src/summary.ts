import { Chain } from './chains'
import { Activity, Holding } from './data'
import { ago, fmtDate, fmtUsd } from './format'
import { tr } from './i18n'

export type SummaryInput = {
  holdings: Holding[]
  total: number
  activity: Activity[]
  hiddenSpam: number
  nonces: { chain: Chain; nonce: number | null }[]
  historyChains: number
}

export type Summary = {
  headline: string
  facts: { k: string; v: string; tone?: 'in' | 'out' }[]
  tags: string[]
}

const STABLES = /^(USDC|USDT|DAI|USDE|FDUSD|USDS|PYUSD|TUSD|BUSD|USDC\.E|USDBC|LUSD|GHO|FRAX)$/i
const SWAP = /swap|exactinput|exactoutput|multicall|execute|fillorder|unoswap|aggregate/i
const BRIDGE = /bridge|portal|stargate|across|hop |layerzero|wormhole|depositeth|outboundtransfer|relay/i

const list = (xs: string[]) => {
  if (xs.length <= 1) return xs.join('')
  const and = tr(' and ', ' dan ')
  return xs.slice(0, -1).join(', ') + and + xs[xs.length - 1]
}

/**
 * Plain-language wallet summary built only from data already on the page.
 * Deterministic rules, no AI service and no API key, so it costs nothing and never invents facts.
 */
export function buildSummary(x: SummaryInput): Summary {
  const now = Date.now()
  const acts = x.activity
  const sentAllTime = x.nonces.reduce((s, n) => s + (n.nonce || 0), 0)
  const times = acts.map((a) => +new Date(a.ts)).filter((t) => isFinite(t))
  const last = times.length ? Math.max(...times) : null
  const first = times.length ? Math.min(...times) : null
  const in30 = acts.filter((a) => now - +new Date(a.ts) < 30 * 864e5).length
  const nIn = acts.filter((a) => a.dir === 'in').length
  const nOut = acts.filter((a) => a.dir === 'out').length
  const nFail = acts.filter((a) => a.dir === 'fail').length
  const usdIn = acts.filter((a) => a.dir === 'in').reduce((s, a) => s + (a.usd || 0), 0)
  const usdOut = acts.filter((a) => a.dir === 'out').reduce((s, a) => s + (a.usd || 0), 0)

  // chains by activity count, then by value
  const actByChain = new Map<string, number>()
  acts.forEach((a) => actByChain.set(a.chain.name, (actByChain.get(a.chain.name) || 0) + 1))
  const valByChain = new Map<string, number>()
  x.holdings.forEach((h) => valByChain.set(h.chain.name, (valByChain.get(h.chain.name) || 0) + (h.usd || 0)))
  const topActChains = [...actByChain.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
  const topValChains = [...valByChain.entries()].filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]).map(([n]) => n)
  const mainChains = (topActChains.length ? topActChains : topValChains).slice(0, 2)
  const nonceChains = x.nonces.filter((n) => (n.nonce || 0) > 0).map((n) => n.chain.name)

  // tokens by value
  const bySym = new Map<string, number>()
  x.holdings.forEach((h) => bySym.set(h.symbol, (bySym.get(h.symbol) || 0) + (h.usd || 0)))
  const topTokens = [...bySym.entries()].filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const stableUsd = [...bySym.entries()].filter(([s]) => STABLES.test(s)).reduce((s, [, v]) => s + v, 0)

  // activity level
  let level: string
  if (!acts.length && sentAllTime === 0) level = tr('Unused wallet', 'Wallet belum dipakai')
  else if (last && now - last > 180 * 864e5) level = tr('Dormant wallet', 'Wallet tidak aktif')
  else if (in30 >= 30) level = tr('Very active wallet', 'Wallet sangat aktif')
  else if (in30 >= 5) level = tr('Active wallet', 'Wallet aktif')
  else if (acts.length || sentAllTime) level = tr('Occasionally used wallet', 'Wallet jarang dipakai')
  else level = tr('Quiet wallet', 'Wallet sepi')

  const parts: string[] = [level]
  if (mainChains.length) parts[0] += tr(`, mostly on ${list(mainChains)}`, `, paling sering di ${list(mainChains)}`)
  let headline = parts[0] + '.'
  if (x.total >= 1 && topTokens.length) {
    const share = Math.round((topTokens[0][1] / x.total) * 100)
    headline += tr(
      ` Holds about ${fmtUsd(x.total, true)}, ${share >= 50 ? 'mostly' : 'led by'} ${topTokens[0][0]}${share < 99 ? ` (${share}%)` : ''}.`,
      ` Menyimpan sekitar ${fmtUsd(x.total, true)}, ${share >= 50 ? 'sebagian besar' : 'terbanyak'} ${topTokens[0][0]}${share < 99 ? ` (${share}%)` : ''}.`,
    )
  } else if (x.total < 1) headline += tr(' Balance is close to zero.', ' Saldonya hampir nol.')

  const facts: Summary['facts'] = []
  facts.push({
    k: tr('Activity', 'Aktivitas'),
    v: tr(`${in30} tx in 30 days · ${sentAllTime.toLocaleString('en-US')} sent all-time`, `${in30} tx dalam 30 hari · ${sentAllTime.toLocaleString('id-ID')} dikirim sejak awal`),
  })
  if (last) facts.push({ k: tr('Last active', 'Terakhir aktif'), v: `${ago(last)} · ${fmtDate(last)}` })
  if (first && last && first !== last) facts.push({ k: tr('Loaded range', 'Rentang data'), v: `${fmtDate(first)} – ${fmtDate(last)}` })
  if (usdIn > 0 || usdOut > 0) {
    const net = usdIn - usdOut
    facts.push({ k: tr('Net flow', 'Arus bersih'), v: `${net >= 0 ? '+' : '−'}${fmtUsd(Math.abs(net), true)} (${tr('in', 'masuk')} ${fmtUsd(usdIn, true)} · ${tr('out', 'keluar')} ${fmtUsd(usdOut, true)})`, tone: net >= 0 ? 'in' : 'out' })
  }
  if (topTokens.length) facts.push({ k: tr('Top tokens', 'Token utama'), v: topTokens.map(([s, v]) => `${s} ${Math.round((v / Math.max(x.total, 1e-9)) * 100)}%`).join(' · ') })
  if (nonceChains.length) facts.push({ k: tr('Has sent on', 'Pernah kirim di'), v: tr(`${nonceChains.length} network${nonceChains.length === 1 ? '' : 's'}`, `${nonceChains.length} jaringan`) + ` · ${nonceChains.slice(0, 4).join(', ')}${nonceChains.length > 4 ? '…' : ''}` })

  // patterns
  const tags: string[] = []
  const swaps = acts.filter((a) => a.method && SWAP.test(a.method)).length
  const bridges = acts.filter((a) => (a.method && BRIDGE.test(a.method)) || (a.party?.label && BRIDGE.test(a.party.label))).length
  if (swaps >= 3) tags.push(tr(`${swaps} DEX swaps`, `${swaps} swap di DEX`))
  if (bridges >= 1) tags.push(tr('Uses bridges', 'Pakai bridge'))
  if (nIn >= 5 && nIn >= nOut * 3) tags.push(tr('Mostly receives', 'Lebih banyak menerima'))
  else if (nOut >= 5 && nOut >= nIn * 3) tags.push(tr('Mostly sends', 'Lebih banyak mengirim'))
  if (nFail >= 3 && nFail / Math.max(acts.length, 1) >= 0.1) tags.push(tr(`${Math.round((nFail / acts.length) * 100)}% failed`, `${Math.round((nFail / acts.length) * 100)}% gagal`))
  if (actByChain.size >= 3) tags.push(tr(`Active on ${actByChain.size} networks`, `Aktif di ${actByChain.size} jaringan`))
  if (x.total > 10 && stableUsd / x.total >= 0.5) tags.push(tr('Mostly stablecoins', 'Dominan stablecoin'))
  if (x.hiddenSpam >= 10) tags.push(tr(`${x.hiddenSpam} spam tokens filtered`, `${x.hiddenSpam} token spam disaring`))
  const party = new Map<string, number>()
  // only interactions the wallet started (outgoing or contract calls); incoming spam would skew this
  acts.forEach((a) => (a.dir === 'out' || a.kind === 'call') && a.dir !== 'fail' && a.party?.label && !/_|tracker|airdrop|reward|claim/i.test(a.party.label) && party.set(a.party.label, (party.get(a.party.label) || 0) + 1))
  const topParty = [...party.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topParty && topParty[1] >= 3) tags.push(tr(`Often uses ${topParty[0]}`, `Sering pakai ${topParty[0]}`))

  return { headline, facts, tags }
}
