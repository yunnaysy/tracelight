import { useEffect, useMemo, useState } from 'react'
import { CHAINS, Chain, hasHistory } from './chains'
import { Activity, ChainActivity, getChainActivity, getNativeBalances, getPrices, getTokenHoldings, getToken, Holding, Prices, resolveName, reverseName } from './data'
import { fmtNum, fmtUsd, isAddr, short } from './format'
import { ActivityRow, ChainMark, Copy, Empty, PageHead, Pills, Row, Skeleton } from './ui'
import { TxDetailView } from './TxDetailView'
import { navigate } from './router'
import { IconCoin } from './icons'
import { TokenView } from './TokenPage'
import { t, tr } from './i18n'
import { buildSummary } from './summary'
import { WatchButton } from './WatchUI'
import { markSeen } from './watch'

type Dir = 'all' | 'in' | 'out' | 'fail'

export function AddressPage({ q }: { q: string }) {
  const [addr, setAddr] = useState<string | null>(isAddr(q) ? q : null)
  const [name, setName] = useState<string | null>(isAddr(q) ? null : q)
  const [resolveErr, setResolveErr] = useState(false)
  const [token, setToken] = useState<any | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    setResolveErr(false); setToken(undefined)
    if (isAddr(q)) {
      setAddr(q); setName(null)
      reverseName(q).then((n) => live && setName(n))
      getToken(q).then((t) => live && setToken(t))
    } else {
      setAddr(null); setName(q)
      resolveName(q).then((a) => { if (!live) return; a ? setAddr(a) : setResolveErr(true); setToken(null) })
    }
    return () => { live = false }
  }, [q])

  if (resolveErr) return (<><PageHead title={q} /><Empty title="Name not found">{q} doesn't resolve to an address on Ethereum mainnet ENS.</Empty></>)
  if (token) return <TokenView token={token} />
  if (!addr) return (<><PageHead title={name || short(q)} sub="Resolving ENS…" /><Skeleton rows={5} /></>)
  return <Wallet addr={addr} name={name} />
}

function Wallet({ addr, name }: { addr: string; name: string | null }) {
  const [prices, setPrices] = useState<Prices>()
  const [natives, setNatives] = useState<{ chain: Chain; ok: boolean; nonce: number | null; h: Holding | null }[] | null>(null)
  const [tokens, setTokens] = useState<{ items: Holding[]; hidden: number; ok: boolean } | null>(null)
  const [acts, setActs] = useState<Record<number, ChainActivity | 'loading'>>({})
  const [dir, setDir] = useState<Dir>('all')
  const [chainF, setChainF] = useState<string>('all')
  const [tab, setTab] = useState<'activity' | 'holdings'>('activity')
  const [sel, setSel] = useState<Activity | null>(null)
  const [limit, setLimit] = useState(30)

  useEffect(() => {
    let live = true
    markSeen(addr)
    setNatives(null); setTokens(null); setSel(null); setDir('all'); setChainF('all'); setLimit(30)
    setActs(Object.fromEntries(CHAINS.filter(hasHistory).map((c) => [c.id, 'loading' as const])))
    getPrices().catch(() => ({} as Prices)).then((p) => {
      if (!live) return
      setPrices(p)
      getNativeBalances(addr, p).then((n) => live && setNatives(n))
      CHAINS.filter(hasHistory).forEach((c) => getChainActivity(c, addr, p).then((r) => live && setActs((s) => ({ ...s, [c.id]: r }))))
    })
    getTokenHoldings(addr).then((t) => live && setTokens(t))
    return () => { live = false }
  }, [addr])

  const holdings = useMemo(() => {
    const list = [...(natives || []).map((n) => n.h).filter((h): h is Holding => !!h && h.amount > 0), ...(tokens?.items || [])]
    return list.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1))
  }, [natives, tokens])

  const total = holdings.reduce((s, h) => s + (h.usd ?? 0), 0)
  const byChain = useMemo(() => {
    const m = new Map<number, number>()
    holdings.forEach((h) => m.set(h.chain.id, (m.get(h.chain.id) || 0) + (h.usd ?? 0)))
    return [...m.entries()].map(([id, v]) => ({ chain: CHAINS.find((c) => c.id === id)!, v })).filter((x) => x.v > 0.005).sort((a, b) => b.v - a.v)
  }, [holdings])

  const loadedActs = Object.values(acts).filter((a): a is ChainActivity => a !== 'loading')
  const loadingChains = Object.values(acts).filter((a) => a === 'loading').length
  const all = useMemo(() => loadedActs.flatMap((a) => a.items).sort((a, b) => +new Date(b.ts) - +new Date(a.ts)), [acts])
  const hiddenSpam = loadedActs.reduce((s, a) => s + a.hiddenSpam, 0)
  const unavailable = CHAINS.filter((c) => !hasHistory(c) || (acts[c.id] && acts[c.id] !== 'loading' && !(acts[c.id] as ChainActivity).ok))
  const limited = loadedActs.some((a) => a.limited)

  const byDir = all.filter((a) => chainF === 'all' || String(a.chain.id) === chainF)
  const shown = byDir.filter((a) => dir === 'all' || a.dir === dir)
  const count = (d: Dir) => byDir.filter((a) => d === 'all' || a.dir === d).length
  const chainCounts = CHAINS.map((c) => ({ c, n: all.filter((a) => a.chain.id === c.id).length })).filter((x) => x.n > 0)
  const priced = natives && tokens

  const title = name || short(addr, 4)
  return (
    <div className="split">
      <section className="col-main">
        <PageHead title={title} sub={<span className="mono">{short(addr, 6)} <Copy text={addr} /></span>} right={<WatchButton addr={addr} name={name} />} />

        <div className="card balance">
          <div className="balance-l">{t('Estimated value')}</div>
          <div className="balance-v">{priced ? fmtUsd(total) : <span className="sk w50 tall" />}</div>
          <div className="balance-s">
            {priced ? <>{tr(`${holdings.length} assets on ${byChain.length} chain${byChain.length === 1 ? '' : 's'}`, `${holdings.length} aset di ${byChain.length} jaringan`)}{tokens && tokens.hidden > 0 ? tr(` · ${tokens.hidden} unpriced or suspicious tokens excluded`, ` · ${tokens.hidden} token tanpa harga atau mencurigakan tidak dihitung`) : ''}</> : t('Reading balances from 11 networks…')}
          </div>
          {byChain.length > 0 && (
            <>
              <div className="alloc" aria-label="Chain allocation">
                {byChain.map((x) => <span key={x.chain.id} style={{ flexGrow: x.v, background: x.chain.color }} title={`${x.chain.name} ${fmtUsd(x.v)}`} />)}
              </div>
              <div className="alloc-legend">
                {byChain.slice(0, 5).map((x) => (
                  <span key={x.chain.id}><ChainMark chain={x.chain} size={10} /> {x.chain.name} <b>{((x.v / total) * 100).toFixed(x.v / total < 0.01 ? 2 : 1)}%</b></span>
                ))}
              </div>
            </>
          )}
          <div className="seg">
            <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>{t('Activity')}</button>
            <button className={tab === 'holdings' ? 'on' : ''} onClick={() => setTab('holdings')}>{t('Holdings')}</button>
          </div>
        </div>

        <SummaryCard
          ready={!!priced && loadingChains === 0}
          input={{ holdings, total, activity: all, hiddenSpam, nonces: (natives || []).map((n) => ({ chain: n.chain, nonce: n.nonce })), historyChains: loadedActs.filter((a) => a.ok).length }}
        />

        <div className={'tabpane ' + (tab === 'activity' ? 'show' : 'hide-m')}>
          <Pills<Dir>
            value={dir}
            onChange={setDir}
            items={[
              { id: 'all', label: t('All'), count: count('all') },
              { id: 'in', label: t('Incoming'), count: count('in') },
              { id: 'out', label: t('Outgoing'), count: count('out') },
              { id: 'fail', label: t('Failed'), count: count('fail') },
            ]}
          />
          {chainCounts.length > 1 && (
            <div className="chips">
              <button className={'chip' + (chainF === 'all' ? ' on' : '')} onClick={() => setChainF('all')}>{t('All chains')}</button>
              {chainCounts.map(({ c, n }) => (
                <button key={c.id} className={'chip' + (chainF === String(c.id) ? ' on' : '')} onClick={() => setChainF(String(c.id))}><ChainMark chain={c} size={12} /> {c.name} <span className="chip-n">{n}</span></button>
              ))}
            </div>
          )}
          {all.length === 0 && loadingChains > 0 ? <Skeleton rows={6} /> : shown.length === 0 ? (
            <Empty title={t('No transactions here')}>{loadingChains > 0 ? t('Still loading other networks…') : t('Nothing matches this filter in the latest 50 transactions per network.')}</Empty>
          ) : (
            <div className="list">
              {shown.slice(0, limit).map((a) => <ActivityRow key={a.id} a={a} active={sel?.id === a.id} onClick={() => setSel(a)} />)}
              {shown.length > limit && <button className="pill more" onClick={() => setLimit((l) => l + 30)}>{t('Show more')} ({shown.length - limit})</button>}
            </div>
          )}
          <p className="note">
            {tr('Latest page of history per network via Blockscout (BNB Chain via Binplorer)', 'Halaman riwayat terbaru per jaringan lewat Blockscout (BNB Chain lewat Binplorer)')}{loadingChains > 0 ? tr(` · loading ${loadingChains} more…`, ` · memuat ${loadingChains} lagi…`) : ''}.
            {hiddenSpam > 0 && tr(` ${hiddenSpam} spam or unpriced token transfers hidden.`, ` ${hiddenSpam} transfer token spam atau tanpa harga disembunyikan.`)}
            {unavailable.length > 0 && tr(` History not available right now for ${unavailable.map((c) => c.name).join(', ')} (balances still shown).`, ` Riwayat belum tersedia untuk ${unavailable.map((c) => c.name).join(', ')} (saldo tetap tampil).`)}
            {limited && tr(' A free data source is rate-limiting; try again in a minute.', ' Sumber data gratis sedang membatasi permintaan; coba lagi sebentar lagi.')}
          </p>
        </div>

        <div className={'tabpane only-m ' + (tab === 'holdings' ? 'show' : 'hide-m')}>
          <Holdings holdings={holdings} loading={!priced} natives={natives} />
        </div>
      </section>

      <aside className="col-side">
        {sel ? (
          <div className="sheet-wrap" onClick={() => setSel(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <span className="grab" />
              <TxDetailView chain={sel.chain} hash={sel.hash} perspective={addr} onClose={() => setSel(null)} />
            </div>
          </div>
        ) : (
          <div className="only-d">
            <h2 className="side-h">{t('Holdings')}</h2>
            <Holdings holdings={holdings} loading={!priced} natives={natives} />
          </div>
        )}
      </aside>
    </div>
  )
}

function Holdings({ holdings, loading, natives }: { holdings: Holding[]; loading: boolean; natives: { chain: Chain; ok: boolean }[] | null }) {
  if (loading) return <Skeleton rows={5} />
  const failed = (natives || []).filter((n) => !n.ok).map((n) => n.chain.name)
  return (
    <>
      {holdings.length === 0 ? <Empty title={t('No balances found')}>{t('This address holds no native coins or priced tokens on the supported networks.')}</Empty> : (
        <div className="list">
          {holdings.slice(0, 40).map((h, i) => (
            <Row
              key={i}
              onClick={h.contract ? () => navigate(`/address/${h.contract}`) : undefined}
              icon={<TokenIcon h={h} />}
              title={h.native ? `${h.symbol}` : h.name}
              sub={<><ChainMark chain={h.chain} /> {h.chain.name} · {fmtNum(h.amount)} {h.symbol}</>}
              amount={fmtUsd(h.usd)}
              date={h.price != null ? `@ ${fmtUsd(h.price)}` : 'no price'}
            />
          ))}
        </div>
      )}
      {failed.length > 0 && <p className="note">{tr(`Couldn't reach ${failed.join(', ')} RPC just now, so those balances are missing.`, `RPC ${failed.join(', ')} belum bisa dihubungi, jadi saldonya belum tampil.`)}</p>}
    </>
  )
}

function TokenIcon({ h }: { h: Holding }) {
  const [bad, setBad] = useState(false)
  if (h.icon && !bad) return <span className="dir tok"><img src={h.icon} alt="" onError={() => setBad(true)} /></span>
  return <span className="dir tok" style={{ color: h.chain.color }}>{h.native ? <b>{h.symbol.slice(0, 1)}</b> : <IconCoin />}</span>
}

function SummaryCard({ ready, input }: { ready: boolean; input: Parameters<typeof buildSummary>[0] }) {
  const [open, setOpen] = useState(false)
  if (!ready) return (
    <div className="card summary" aria-busy="true">
      <div className="summary-l">{tr('Wallet summary', 'Ringkasan wallet')}</div>
      <span className="sk w60" /><span className="sk w40" style={{ marginTop: 10 }} />
    </div>
  )
  const s = buildSummary(input)
  const facts = open ? s.facts : s.facts.slice(0, 3)
  return (
    <div className="card summary">
      <div className="summary-l">{tr('Wallet summary', 'Ringkasan wallet')}</div>
      <p className="summary-h">{s.headline}</p>
      {s.tags.length > 0 && <div className="summary-tags">{(open ? s.tags : s.tags.slice(0, 3)).map((x) => <span key={x} className="tag">{x}</span>)}</div>}
      <dl className="summary-facts">
        {facts.map((f) => (<div key={f.k}><dt>{f.k}</dt><dd className={f.tone || ''}>{f.v}</dd></div>))}
      </dl>
      <div className="summary-foot">
        <span>{tr('Built from the on-chain data on this page. No AI service, no guesses.', 'Disusun dari data on-chain di halaman ini. Tanpa layanan AI, tanpa tebakan.')}</span>
        {(s.facts.length > 3 || s.tags.length > 3) && <button className="linkish" onClick={() => setOpen((o) => !o)}>{open ? tr('Less', 'Ringkas') : tr('More', 'Selengkapnya')}</button>}
      </div>
    </div>
  )
}
