import { useEffect, useState } from 'react'
import { chainById } from './chains'
import { ago, fmtNum, short } from './format'
import { IconBell, IconBellOn, IconTrash } from './icons'
import { t, tr } from './i18n'
import { navigate } from './router'
import { DirIcon, Empty, PageHead } from './ui'
import {
  addWatch, askNotify, dismissToast, isWatched, markSeen, MAX_WATCH, notifyPermission, removeWatch, unseenTotal, useToasts, useWatchlist, Watched,
} from './watch'

/** Bell button on a wallet page: adds/removes it from the watchlist and asks for notification permission once. */
export function WatchButton({ addr, name }: { addr: string; name: string | null }) {
  const l = useWatchlist()
  const on = l.some((w) => w.addr === addr.toLowerCase())
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(id) }, [msg])
  const toggle = async () => {
    if (on) { removeWatch(addr); setMsg(tr('Removed from watchlist', 'Dihapus dari pantauan')); return }
    if (!addWatch(addr, name)) { setMsg(tr(`Watchlist is full (${MAX_WATCH})`, `Pantauan penuh (${MAX_WATCH})`)); return }
    const p = await askNotify()
    setMsg(p === 'granted' ? tr('Watching · alerts on', 'Dipantau · notifikasi aktif') : tr('Watching · in-app alerts only', 'Dipantau · notifikasi di aplikasi saja'))
  }
  return (
    <span className="watchbtn-wrap">
      <button className={'roundbtn watchbtn' + (on ? ' on' : '')} aria-pressed={on} aria-label={on ? t('Watching') : t('Watch')} title={on ? t('Watching') : t('Watch')} onClick={toggle}>
        {on ? <IconBellOn /> : <IconBell />}
      </button>
      {msg && <span className="watch-tip" role="status">{msg}</span>}
    </span>
  )
}

/** Floating pill in the top bar with the unseen count. */
export function WatchNav({ active }: { active: boolean }) {
  const l = useWatchlist()
  const n = unseenTotal(l)
  return (
    <button className={'navpill' + (active ? ' on' : '')} onClick={() => navigate('/watch')} aria-label={`${t('Watchlist')}${n ? `, ${n} new` : ''}`}>
      <IconBell size={16} />
      <span className="navpill-l">{t('Watchlist')}</span>
      {n > 0 ? <span className="badge">{n > 99 ? '99+' : n}</span> : l.length > 0 ? <span className="navpill-n">{l.length}</span> : null}
    </button>
  )
}

export function WatchPage() {
  const l = useWatchlist()
  const [perm, setPerm] = useState(notifyPermission())
  const [input, setInput] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const n = unseenTotal(l)
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const v = input.trim()
    if (!/^0x[0-9a-fA-F]{40}$/.test(v)) { setErr(tr('Paste a full 0x address (ENS: open the wallet and tap the bell).', 'Tempel alamat 0x lengkap (ENS: buka wallet lalu ketuk lonceng).')); return }
    if (isWatched(v)) { setErr(tr('Already on your watchlist.', 'Sudah ada di pantauan.')); return }
    if (!addWatch(v, null)) { setErr(tr(`Watchlist is full (${MAX_WATCH}).`, `Pantauan penuh (${MAX_WATCH}).`)); return }
    setInput(''); setErr(null)
    askNotify().then(setPerm)
  }
  return (
    <div className="narrow">
      <PageHead title={t('Watchlist')} sub={l.length ? tr(`${l.length} wallet${l.length === 1 ? '' : 's'} · checked every minute`, `${l.length} wallet · dicek tiap menit`) : tr('Get alerted when a wallet moves', 'Dapat notifikasi saat wallet bergerak')} />

      <div className="card notif">
        <div className="notif-t">
          {perm === 'granted' ? tr('Browser notifications are on', 'Notifikasi browser aktif')
            : perm === 'denied' ? tr('Browser notifications are blocked', 'Notifikasi browser diblokir')
            : perm === 'unsupported' ? tr('This browser has no notifications', 'Browser ini tidak mendukung notifikasi')
            : tr('Turn on browser notifications', 'Aktifkan notifikasi browser')}
        </div>
        <div className="notif-s">
          {perm === 'denied' ? tr('Allow notifications for this site in your browser settings. Alerts still show here while the tab is open.', 'Izinkan notifikasi untuk situs ini di pengaturan browser. Peringatan tetap muncul di sini selama tab terbuka.')
            : tr('Tracelight checks Ethereum, Base, Arbitrum, BNB Chain and Polygon while this tab is open. Nothing leaves your device: the list lives in this browser.', 'Tracelight mengecek Ethereum, Base, Arbitrum, BNB Chain, dan Polygon selama tab ini terbuka. Daftarnya hanya tersimpan di browser ini.')}
        </div>
        {perm === 'default' && <button className="cta" onClick={() => askNotify().then(setPerm)}>{tr('Allow notifications', 'Izinkan notifikasi')}</button>}
      </div>

      <form className="search watchadd" onSubmit={add}>
        <input value={input} onChange={(e) => { setInput(e.target.value); setErr(null) }} placeholder={tr('Add a 0x address to watch', 'Tambah alamat 0x untuk dipantau')} spellCheck={false} autoCapitalize="off" autoComplete="off" aria-label={tr('Address to watch', 'Alamat untuk dipantau')} />
        <button type="submit" className="search-go">{tr('Add', 'Tambah')}</button>
      </form>
      {err && <p className="note err">{err}</p>}

      {l.length === 0 ? (
        <Empty title={tr('No wallets yet', 'Belum ada wallet')}>{tr('Open any wallet and tap the bell next to its name, or paste an address above.', 'Buka wallet mana pun lalu ketuk lonceng di samping namanya, atau tempel alamat di atas.')}</Empty>
      ) : (
        <>
          {n > 0 && <div className="watch-head"><span>{tr(`${n} new since you last looked`, `${n} baru sejak terakhir dilihat`)}</span><button className="linkish" onClick={() => markSeen()}>{tr('Mark all read', 'Tandai sudah dibaca')}</button></div>}
          <div className="list">{l.map((w) => <WatchRow key={w.addr} w={w} />)}</div>
        </>
      )}
    </div>
  )
}

function WatchRow({ w }: { w: Watched }) {
  const c = w.last ? chainById(w.last.chainId) : null
  const lastTxt = w.last
    ? `${w.last.dir === 'in' ? t('Incoming') : w.last.dir === 'out' ? t('Outgoing') : w.last.dir === 'fail' ? t('Failed') : tr('Self', 'Ke diri sendiri')}${w.last.kind !== 'call' && w.last.amount ? ` ${fmtNum(w.last.amount)} ${w.last.symbol}` : ''} · ${c?.name ?? ''}`
    : !w.ready ? tr('Checking…', 'Mengecek…') : tr('No recent transactions', 'Belum ada transaksi terbaru')
  return (
    <div className="row watchrow">
      <button className="watchrow-main" onClick={() => { markSeen(w.addr); navigate(`/address/${w.addr}`) }}>
        <DirIcon dir={w.last ? (w.last.kind === 'call' && w.last.dir !== 'fail' ? 'call' : w.last.dir) : 'self'} />
        <span className="row-mid">
          <span className="row-title">{w.name || short(w.addr, 4)}{w.unseen > 0 && <span className="badge inline">{w.unseen} {tr('new', 'baru')}</span>}</span>
          <span className="row-sub">{lastTxt}</span>
        </span>
        <span className="row-right">
          <span className="row-date">{w.last ? ago(w.last.ts) : ''}</span>
          <span className="row-date">{w.checked ? tr(`checked ${ago(w.checked)}`, `dicek ${ago(w.checked)}`) : ''}</span>
        </span>
      </button>
      <button className="roundbtn sm ghostbtn" aria-label={tr('Remove', 'Hapus')} onClick={() => removeWatch(w.addr)}><IconTrash /></button>
    </div>
  )
}

export function Toasts() {
  const ts = useToasts()
  if (!ts.length) return null
  return (
    <div className="toasts" aria-live="polite">
      {ts.map((x) => (
        <div className="toast" key={x.id}>
          <DirIcon dir={x.dir === 'new' ? 'self' : x.dir} />
          <div className="toast-m">
            <div className="toast-t">{x.title}</div>
            <div className="toast-s">{x.body}</div>
          </div>
          <button className="toast-go" onClick={() => { dismissToast(x.id); markSeen(x.addr); navigate(`/address/${x.addr}`) }}>{tr('View', 'Lihat')}</button>
        </div>
      ))}
    </div>
  )
}
