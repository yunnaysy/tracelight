import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'id'
const KEY = 'tl:lang'

function initial(): Lang {
  try {
    const s = localStorage.getItem(KEY)
    if (s === 'en' || s === 'id') return s
  } catch {}
  return typeof navigator !== 'undefined' && /^id\b|^in\b/i.test(navigator.language || '') ? 'id' : 'en'
}

let lang: Lang = initial()
const subs = new Set<() => void>()
if (typeof document !== 'undefined') document.documentElement.lang = lang

export function setLang(l: Lang) {
  lang = l
  try { localStorage.setItem(KEY, l) } catch {}
  document.documentElement.lang = l
  subs.forEach((f) => f())
}
export const getLang = () => lang
export function useLang(): Lang {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => lang)
}

const ID: Record<string, string> = {
  // direction + filters
  All: 'Semua',
  Incoming: 'Masuk',
  Outgoing: 'Keluar',
  Failed: 'Gagal',
  'All chains': 'Semua jaringan',
  Token: 'Token',
  'Contract call': 'Panggilan kontrak',
  'Contract creation': 'Pembuatan kontrak',
  // wallet page
  'Estimated value': 'Perkiraan nilai',
  Activity: 'Aktivitas',
  Holdings: 'Aset',
  'Reading balances from 11 networks…': 'Membaca saldo dari 11 jaringan…',
  'No transactions here': 'Belum ada transaksi',
  'Still loading other networks…': 'Masih memuat jaringan lain…',
  'Nothing matches this filter in the latest 50 transactions per network.': 'Tidak ada yang cocok dengan filter ini di 50 transaksi terbaru per jaringan.',
  'No balances found': 'Saldo tidak ditemukan',
  'This address holds no native coins or priced tokens on the supported networks.': 'Alamat ini tidak punya koin native atau token berharga di jaringan yang didukung.',
  'Show more': 'Tampilkan lagi',
  Watch: 'Pantau',
  Watching: 'Dipantau',
  // tx sheet
  Confirmed: 'Berhasil',
  Pending: 'Tertunda',
  'Token movements': 'Perpindahan token',
  Chain: 'Jaringan',
  From: 'Dari',
  To: 'Ke',
  Value: 'Nilai',
  'Network fee': 'Biaya jaringan',
  Block: 'Blok',
  Time: 'Waktu',
  // home
  'Trace any wallet, transaction or token': 'Lacak wallet, transaksi, atau token apa pun',
  'Latest on Ethereum': 'Terbaru di Ethereum',
  'Network pulse': 'Status jaringan',
  '11 networks · live public data': '11 jaringan · data publik langsung',
  // watchlist
  Watchlist: 'Pantauan',
}

/** Translate a UI string. English is the source; missing keys fall back to English. */
export function t(s: string): string {
  return lang === 'id' ? ID[s] ?? s : s
}
/** Inline pair for sentences with values: tr('Sent 3 txs', 'Kirim 3 tx'). */
export const tr = (en: string, id: string) => (lang === 'id' ? id : en)
