import { ReactNode, useEffect, useState } from 'react'
import { Chain } from './chains'
import { Activity } from './data'
import { fmtDate, fmtNum, short } from './format'
import { IconBack, IconCall, IconCopy, IconIn, IconOut, IconSearch, IconSelf, IconX } from './icons'
import { navigate } from './router'
import { isAddr, isHash, isName } from './format'

export function ChainMark({ chain, size = 14 }: { chain: Chain; size?: number }) {
  return (
    <span className="chainmark" style={{ width: size, height: size, background: chain.color, fontSize: size * 0.5 }} aria-hidden>
      {chain.name[0]}
    </span>
  )
}

export function PageHead({ title, sub, back = true, right }: { title: ReactNode; sub?: ReactNode; back?: boolean; right?: ReactNode }) {
  return (
    <div className="pagehead">
      {back ? (
        <button className="roundbtn" aria-label="Back" onClick={() => (history.length > 1 ? history.back() : navigate('/'))}><IconBack /></button>
      ) : <span className="roundbtn ghost" />}
      <div className="pagehead-t">
        <h1>{title}</h1>
        {sub && <div className="pagehead-sub">{sub}</div>}
      </div>
      {right ?? <span className="roundbtn ghost" />}
    </div>
  )
}

export function Pills<T extends string>({ items, value, onChange }: { items: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="pills" role="tablist">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} className={'pill' + (value === it.id ? ' on' : '')} onClick={() => onChange(it.id)}>
          {it.label}
          {it.count != null && <span className="pill-n">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function DirIcon({ dir }: { dir: Activity['dir'] | 'call' }) {
  const m = { in: [<IconIn />, 'in'], out: [<IconOut />, 'out'], fail: [<IconX />, 'fail'], self: [<IconSelf />, 'self'], call: [<IconCall />, 'self'] } as const
  const [icon, cls] = m[dir]
  return <span className={'dir ' + cls}>{icon}</span>
}

export function Row({ icon, title, sub, amount, amountCls, date, onClick, active }: { icon: ReactNode; title: ReactNode; sub: ReactNode; amount: ReactNode; amountCls?: string; date: ReactNode; onClick?: () => void; active?: boolean }) {
  const Tag: any = onClick ? 'button' : 'div'
  return (
    <Tag className={'row' + (active ? ' active' : '')} onClick={onClick}>
      {icon}
      <span className="row-mid">
        <span className="row-title">{title}</span>
        <span className="row-sub">{sub}</span>
      </span>
      <span className="row-right">
        <span className={'row-amt ' + (amountCls || '')}>{amount}</span>
        <span className="row-date">{date}</span>
      </span>
    </Tag>
  )
}

export function ActivityRow({ a, onClick, active }: { a: Activity; onClick: () => void; active?: boolean }) {
  const sign = a.dir === 'in' ? '+ ' : a.dir === 'out' ? '− ' : ''
  const name = a.party ? a.party.label || short(a.party.hash) : a.method || 'Contract call'
  const method = a.dir === 'fail' ? 'Failed' : a.kind === 'call' ? null : a.kind === 'token' ? 'Token' : null
  const amount = a.kind === 'call' && a.dir !== 'fail'
    ? <span className="muted-amt">{prettyMethod(a.method || 'call')}</span>
    : <>{sign}{fmtNum(a.amount ?? 0)} <span className="sym">{a.symbol}</span></>
  return (
    <Row
      onClick={onClick}
      active={active}
      icon={<DirIcon dir={a.kind === 'call' && a.dir !== 'fail' ? 'call' : a.dir} />}
      title={name}
      sub={<><ChainMark chain={a.chain} /> {a.chain.name}{method ? ` · ${method}` : ''}</>}
      amount={amount}
      amountCls={a.dir}
      date={fmtDate(a.ts)}
    />
  )
}

export const prettyMethod = (m: string) => (m.startsWith('0x') ? m.slice(0, 10) : m.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()))

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="list">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="row skel" key={i}>
          <span className="dir self" />
          <span className="row-mid"><span className="sk w60" /><span className="sk w40" /></span>
          <span className="row-right"><span className="sk w50" /><span className="sk w30" /></span>
        </div>
      ))}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card empty">
      <div className="empty-t">{title}</div>
      {children && <div className="empty-s">{children}</div>}
    </div>
  )
}

export function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button className="copy" aria-label="Copy" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200) }}>
      {ok ? <span className="copied">Copied</span> : <IconCopy />}
    </button>
  )
}

export function routeFor(qRaw: string): string {
  const q = qRaw.trim()
  if (!q) return '/'
  if (isHash(q)) return `/tx/${q}`
  if (isAddr(q)) return `/address/${q}`
  if (isName(q)) return `/address/${q.toLowerCase()}`
  return `/search?q=${encodeURIComponent(q)}`
}

export function SearchBox({ big, autoFocus, initial = '' }: { big?: boolean; autoFocus?: boolean; initial?: string }) {
  const [q, setQ] = useState(initial)
  useEffect(() => setQ(initial), [initial])
  const kind = isHash(q.trim()) ? 'Transaction' : isAddr(q.trim()) ? 'Address or token' : isName(q.trim()) ? 'ENS name' : q.trim() ? 'Token search' : null
  return (
    <form className={'search' + (big ? ' big' : '')} onSubmit={(e) => { e.preventDefault(); navigate(routeFor(q)) }} role="search">
      <IconSearch />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={typeof window !== 'undefined' && window.innerWidth < 480 ? 'Address, ENS or tx hash' : 'Address, ENS, tx hash or token'} spellCheck={false} autoCapitalize="off" autoComplete="off" autoFocus={autoFocus} aria-label="Search" />
      {kind && <span className="search-kind">{kind}</span>}
      <button type="submit" className="search-go" aria-label="Search">Go</button>
    </form>
  )
}
