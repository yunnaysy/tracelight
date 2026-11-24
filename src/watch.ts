import { useSyncExternalStore } from 'react'
import { WATCH_CHAIN_IDS, chainById } from './chains'
import { Activity, getChainActivity, getPrices, Prices, rpcFingerprint } from './data'
import { fmtNum, short } from './format'
import { tr } from './i18n'
import { navigate } from './router'

/* ---------------- watchlist store (localStorage, synced across tabs) ---------------- */
export type LastTx = { ts: string; dir: Activity['dir']; amount: number | null; symbol: string; chainId: number; hash: string; kind: Activity['kind'] }
export type Watched = {
  addr: string
  name: string | null
  added: number
  seen: string[]
  fp: Record<number, string>
  base?: number[]
  ready: boolean
  unseen: number
  last: LastTx | null
  checked: number
  fails: number
}

const KEY = 'tl:watch:v1'
export const MAX_WATCH = 12
const subs = new Set<() => void>()
let list: Watched[] = load()

function load(): Watched[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function save(next: Watched[]) {
  list = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  subs.forEach((f) => f())
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subs.forEach((f) => f()) } })
}
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useWatchlist = () => useSyncExternalStore(sub, () => list)
export const isWatched = (addr: string) => list.some((w) => w.addr === addr.toLowerCase())
export const unseenTotal = (l: Watched[]) => l.reduce((s, w) => s + w.unseen, 0)

export function addWatch(addr: string, name: string | null): boolean {
  const a = addr.toLowerCase()
  if (isWatched(a)) return true
  if (list.length >= MAX_WATCH) return false
  save([{ addr: a, name, added: Date.now(), seen: [], fp: {}, ready: false, unseen: 0, last: null, checked: 0, fails: 0 }, ...list])
  setTimeout(() => pollSoon(a), 50)
  return true
}
export function removeWatch(addr: string) { save(list.filter((w) => w.addr !== addr.toLowerCase())) }
export function markSeen(addr?: string) {
  const a = addr?.toLowerCase()
  if (!list.some((w) => (!a || w.addr === a) && w.unseen)) return
  save(list.map((w) => (!a || w.addr === a ? { ...w, unseen: 0 } : w)))
}
function patch(addr: string, f: (w: Watched) => Watched) { save(list.map((w) => (w.addr === addr ? f(w) : w))) }

/* ---------------- toasts ---------------- */
export type Toast = { id: number; title: string; body: string; addr: string; dir: Activity['dir'] | 'new' }
let toasts: Toast[] = []
const tsubs = new Set<() => void>()
let tid = 1
export const useToasts = () => useSyncExternalStore((f) => { tsubs.add(f); return () => { tsubs.delete(f) } }, () => toasts)
export function pushToast(t: Omit<Toast, 'id'>) {
  const id = tid++
  toasts = [...toasts.slice(-2), { ...t, id }]
  tsubs.forEach((f) => f())
  setTimeout(() => dismissToast(id), 9000)
}
export function dismissToast(id: number) { toasts = toasts.filter((t) => t.id !== id); tsubs.forEach((f) => f()) }

/* ---------------- notifications ---------------- */
export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window
export const notifyPermission = (): NotificationPermission | 'unsupported' => (notifySupported() ? Notification.permission : 'unsupported')

let swReg: Promise<ServiceWorkerRegistration | null> | null = null
function sw() {
  if (!swReg) swReg = 'serviceWorker' in navigator ? navigator.serviceWorker.register('/sw.js').catch(() => null) : Promise.resolve(null)
  return swReg
}
export async function askNotify(): Promise<NotificationPermission | 'unsupported'> {
  if (!notifySupported()) return 'unsupported'
  sw()
  if (Notification.permission === 'default') { try { return await Notification.requestPermission() } catch { return Notification.permission } }
  return Notification.permission
}
async function showNotification(title: string, body: string, addr: string, tag: string) {
  if (!notifySupported() || Notification.permission !== 'granted') return
  const opts: NotificationOptions = { body, tag, icon: '/apple-touch-icon.png', badge: '/favicon-32.png', data: { url: `/address/${addr}` } }
  // Android Chrome only allows notifications through a service worker.
  const reg = await sw()
  if (reg) { try { await reg.showNotification(title, opts); return } catch {} }
  try {
    const n = new Notification(title, opts)
    n.onclick = () => { window.focus(); navigate(`/address/${addr}`); n.close() }
  } catch {}
}
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'tl:open' && e.data.url) navigate(e.data.url) })
}

/* ---------------- poller ---------------- */
const INTERVAL = 60_000 // per address, while a tab is open
const TICK = 10_000
const LEASE = 'tl:watch:lease'
const me = Math.random().toString(36).slice(2)
let prices: Prices | undefined
let pricesAt = 0
const inflight = new Set<string>()
/** Indexers that just failed are skipped for a while (RPC fingerprint covers them) to stay gentle on free APIs. */
const skipUntil = new Map<number, number>()

/** Only one open tab polls at a time, so several tabs don't multiply requests. */
function holdLease(): boolean {
  try {
    const cur = JSON.parse(localStorage.getItem(LEASE) || 'null')
    if (cur && cur.id !== me && Date.now() - cur.t < TICK * 3) return false
    localStorage.setItem(LEASE, JSON.stringify({ id: me, t: Date.now() }))
    return true
  } catch { return true }
}

function describe(a: Activity): { title: string; body: string } {
  const amt = a.kind === 'call' ? '' : `${fmtNum(a.amount ?? 0)} ${a.symbol}`
  const title = a.dir === 'in' ? tr(`Incoming ${amt}`, `Masuk ${amt}`)
    : a.dir === 'out' ? (amt ? tr(`Outgoing ${amt}`, `Keluar ${amt}`) : tr('New outgoing transaction', 'Transaksi keluar baru'))
    : a.dir === 'fail' ? tr('Failed transaction', 'Transaksi gagal')
    : tr('New transaction', 'Transaksi baru')
  return { title: title.trim(), body: a.chain.name }
}

async function check(w: Watched) {
  if (inflight.has(w.addr)) return
  inflight.add(w.addr)
  try {
    if (!prices || Date.now() - pricesAt > 300_000) { prices = await getPrices().catch(() => prices); pricesAt = Date.now() }
    const chains = WATCH_CHAIN_IDS.map((id) => chainById(id)!).filter(Boolean)
    const res = await Promise.all(chains.map((c) => (skipUntil.get(c.id) || 0) > Date.now()
      ? Promise.resolve({ chain: c, ok: false, items: [] as Activity[], hiddenSpam: 0 })
      : getChainActivity(c, w.addr, prices, 20_000).then((r) => { if (!r.ok) skipUntil.set(c.id, Date.now() + (r.limited ? 300_000 : 600_000)); return r })))
    const base = new Set(w.base || [])
    const fresh: Activity[] = []
    const fp = { ...w.fp }
    let anyOk = false, fpChanged: string[] = []
    const ids = new Set(w.seen)
    for (const r of res) {
      if (r.ok) {
        anyOk = true
        if (base.has(r.chain.id)) for (const a of r.items) if (!ids.has(a.id)) fresh.push(a)
        base.add(r.chain.id)
      } else {
        // indexer blocked or rate-limited: fall back to an RPC nonce+balance fingerprint
        const f = await rpcFingerprint(r.chain, w.addr)
        if (f) { anyOk = true; if (fp[r.chain.id] && fp[r.chain.id] !== f) fpChanged.push(r.chain.name); fp[r.chain.id] = f }
      }
    }
    const all = res.flatMap((r) => r.items).sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
    const newest = all[0]
    const seen = [...new Set([...all.map((a) => a.id), ...w.seen])].slice(0, 600)
    const cur = list.find((x) => x.addr === w.addr)
    if (!cur) return
    // first successful pass only records a baseline; it never notifies
    const notify = cur.ready ? fresh.filter((a) => +new Date(a.ts) > Math.max(cur.added - 60_000, Date.now() - 6 * 3600_000)).sort((a, b) => +new Date(a.ts) - +new Date(b.ts)) : []
    const nNew = notify.length + (cur.ready ? fpChanged.length : 0)
    patch(w.addr, (x) => ({
      ...x, seen, fp, base: [...base], ready: x.ready || anyOk, checked: Date.now(), fails: anyOk ? 0 : Math.min(x.fails + 1, 5),
      unseen: x.unseen + nNew,
      last: newest && (!x.last || +new Date(newest.ts) >= +new Date(x.last.ts))
        ? { ts: newest.ts, dir: newest.dir, amount: newest.amount, symbol: newest.symbol, chainId: newest.chain.id, hash: newest.hash, kind: newest.kind }
        : x.last,
    }))
    const who = cur.name || short(cur.addr)
    for (const a of notify.slice(-3)) {
      const d = describe(a)
      pushToast({ title: d.title, body: `${who} · ${d.body}`, addr: cur.addr, dir: a.dir })
      showNotification(`${d.title}`, `${who} · ${d.body}`, cur.addr, a.id)
    }
    if (cur.ready && fpChanged.length) {
      const title = tr('New activity', 'Aktivitas baru')
      pushToast({ title, body: `${who} · ${fpChanged.join(', ')}`, addr: cur.addr, dir: 'new' })
      showNotification(title, `${who} · ${fpChanged.join(', ')}`, cur.addr, `${cur.addr}:${Date.now()}`)
    }
  } finally {
    inflight.delete(w.addr)
  }
}

function due(w: Watched) { return Date.now() - w.checked > INTERVAL * 2 ** w.fails }

function tick() {
  if (!list.length || !holdLease()) return
  const next = [...list].filter(due).sort((a, b) => a.checked - b.checked)[0]
  if (next) check(next)
}

export function pollSoon(addr: string) {
  const w = list.find((x) => x.addr === addr.toLowerCase())
  if (w && holdLease()) check(w)
}

let started = false
export function startWatcher() {
  if (started || typeof window === 'undefined') return
  started = true
  if (notifyPermission() === 'granted') sw()
  setTimeout(tick, 1500)
  setInterval(tick, TICK)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick() })
}
