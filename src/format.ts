import { getLang } from './i18n'

export const short = (a?: string | null, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : '—')

export function fmtNum(v: number, max = 4): string {
  if (!isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a < 0.0001) return '<0.0001'
  if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  const digits = a >= 1000 ? 2 : a >= 1 ? Math.min(max, 4) : max
  return v.toLocaleString('en-US', { maximumFractionDigits: digits })
}

export function fmtUsd(v: number | null | undefined, compact = false): string {
  if (v == null || !isFinite(v)) return '—'
  if (compact && Math.abs(v) >= 1e6) return '$' + fmtNum(v)
  const d = Math.abs(v) < 1 ? 4 : 2
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: Math.abs(v) < 1 ? 2 : 2, maximumFractionDigits: d })
}

export function fromUnits(raw: string | bigint | null | undefined, decimals = 18): number {
  if (raw == null) return 0
  const s = typeof raw === 'bigint' ? raw.toString() : String(raw)
  if (!/^\d+$/.test(s)) return Number(s) || 0
  if (decimals === 0) return Number(s)
  const pad = s.padStart(decimals + 1, '0')
  return Number(pad.slice(0, -decimals) + '.' + pad.slice(-decimals))
}

export function fmtDate(ts: string | number | Date): string {
  const d = new Date(ts)
  if (isNaN(+d)) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

export function fmtTime(ts: string | number | Date): string {
  const d = new Date(ts)
  return d.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })
}

export function ago(ts: string | number | Date): string {
  const s = Math.max(0, (Date.now() - +new Date(ts)) / 1000)
  const id = getLang() === 'id'
  if (s < 60) return id ? `${Math.floor(s)} dtk lalu` : `${Math.floor(s)}s ago`
  if (s < 3600) return id ? `${Math.floor(s / 60)} mnt lalu` : `${Math.floor(s / 60)}m ago`
  if (s < 86400) return id ? `${Math.floor(s / 3600)} jam lalu` : `${Math.floor(s / 3600)}h ago`
  return id ? `${Math.floor(s / 86400)} hr lalu` : `${Math.floor(s / 86400)}d ago`
}

export const isAddr = (q: string) => /^0x[0-9a-fA-F]{40}$/.test(q)
export const isHash = (q: string) => /^0x[0-9a-fA-F]{64}$/.test(q)
export const isName = (q: string) => /^[^\s]+\.[a-z]{2,}$/i.test(q) && !q.startsWith('0x')
