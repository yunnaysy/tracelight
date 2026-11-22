import { useEffect, useState } from 'react'
import { Chain } from './chains'
import { getTx, TxDetail } from './data'
import { fmtNum, fmtTime, fmtUsd, short, ago } from './format'
import { ChainMark, Copy, DirIcon, prettyMethod } from './ui'
import { IconExt, IconX } from './icons'
import { navigate } from './router'
import { getPrices, nativeUsd, Prices } from './data'

export function useTx(chain: Chain | null, hash: string) {
  const [s, set] = useState<{ loading: boolean; tx: TxDetail | null; err?: string }>({ loading: true, tx: null })
  useEffect(() => {
    if (!chain) return
    let live = true
    set({ loading: true, tx: null })
    getTx(chain, hash).then((tx) => live && set({ loading: false, tx, err: tx ? undefined : 'Transaction not found on ' + chain.name }))
      .catch(() => live && set({ loading: false, tx: null, err: `Couldn't reach ${chain.name} right now. Try again in a moment.` }))
    return () => { live = false }
  }, [chain?.id, hash])
  return s
}

export function TxDetailView({ chain, hash, perspective, onClose }: { chain: Chain; hash: string; perspective?: string; onClose?: () => void }) {
  const { loading, tx, err } = useTx(chain, hash)
  const [prices, setPrices] = useState<Prices>()
  useEffect(() => { getPrices().then(setPrices).catch(() => {}) }, [])
  const price = nativeUsd(prices, chain)
  const me = perspective?.toLowerCase()
  const dir = !tx ? 'self' : tx.status === 'failed' ? 'fail' : me && tx.to?.toLowerCase() === me ? 'in' : me && tx.from.toLowerCase() === me ? 'out' : 'self'

  return (
    <div className="detail">
      <div className="detail-top">
        {onClose && <button className="roundbtn sm" aria-label="Close" onClick={onClose}><IconX /></button>}
      </div>
      {loading && <div className="detail-loading"><span className="spinner" /> Reading {chain.name} RPC…</div>}
      {!loading && err && <div className="detail-err">{err}</div>}
      {tx && (
        <>
          <div className="detail-hero">
            <DirIcon dir={dir as any} />
            <Headline tx={tx} me={me} dir={dir} />
            {price != null && tx.value > 0 && <div className="detail-usd">≈ {fmtUsd(tx.value * price)} at today's price</div>}
            <div className={'status ' + tx.status}>{tx.status === 'success' ? 'Confirmed' : tx.status === 'failed' ? 'Failed' : 'Pending'}{tx.method ? ` · ${prettyMethod(tx.method)}` : ''}</div>
          </div>

          {tx.transfers.length > 0 && (
            <div className="card kv">
              <div className="kv-h">Token movements</div>
              {tx.transfers.map((t, i) => (
                <div className="kv-r" key={i}>
                  <span className="k">{short(t.from)} → {short(t.to)}</span>
                  <span className="v strong">{fmtNum(t.amount)} {t.symbol}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card kv">
            <KV k="Chain" v={<><ChainMark chain={chain} /> {chain.name}</>} />
            <KV k="Hash" v={<span className="mono">{short(tx.hash, 8)} <Copy text={tx.hash} /></span>} />
            <KV k="From" v={<Addr a={tx.from} label={tx.fromLabel} />} />
            <KV k="To" v={tx.to ? <Addr a={tx.to} label={tx.toLabel} /> : tx.created ? <span>Contract created <Addr a={tx.created} /></span> : '—'} />
            <KV k="Value" v={`${fmtNum(tx.value, 8)} ${chain.symbol}`} />
            <KV k="Network fee" v={tx.fee != null ? <>{fmtNum(tx.fee, 8)} {chain.symbol}{price != null && <span className="muted"> · {fmtUsd(tx.fee * price)}</span>}</> : '—'} />
            {tx.gasPriceGwei != null && <KV k="Gas" v={`${tx.gasUsed?.toLocaleString('en-US')} used · ${fmtNum(tx.gasPriceGwei, 4)} gwei`} />}
            <KV k="Block" v={tx.block != null ? tx.block.toLocaleString('en-US') : 'Pending'} />
            <KV k="Time" v={tx.ts ? <>{fmtTime(tx.ts)} <span className="muted">· {ago(tx.ts)}</span></> : '—'} />
            <KV k="Nonce" v={String(tx.nonce)} />
          </div>

          <div className="links">
            <a className="pill link" href={`${chain.explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer">Open in {new URL(chain.explorer).hostname.replace('www.', '')} <IconExt /></a>
            {chain.bs && <a className="pill link" href={`${chain.bs}/tx/${tx.hash}`} target="_blank" rel="noreferrer">Blockscout <IconExt /></a>}
          </div>
        </>
      )}
    </div>
  )
}

function Headline({ tx, me, dir }: { tx: TxDetail; me?: string; dir: string }) {
  if (tx.value > 0 || !tx.transfers.length) {
    if (tx.value === 0) return <div className="detail-amt">{tx.method ? prettyMethod(tx.method) : tx.created ? 'Contract creation' : 'Contract call'}</div>
    return <div className={'detail-amt ' + dir}>{dir === 'in' ? '+ ' : dir === 'out' ? '− ' : ''}{fmtNum(tx.value, 6)} <span className="sym">{tx.chain.symbol}</span></div>
  }
  const mine = me ? tx.transfers.find((t) => t.to.toLowerCase() === me || t.from.toLowerCase() === me) : null
  const t = mine || tx.transfers[0]
  const d = me ? (t.to.toLowerCase() === me ? 'in' : t.from.toLowerCase() === me ? 'out' : '') : ''
  return <div className={'detail-amt ' + d}>{d === 'in' ? '+ ' : d === 'out' ? '− ' : ''}{fmtNum(t.amount)} <span className="sym">{t.symbol}</span></div>
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="kv-r"><span className="k">{k}</span><span className="v">{v}</span></div>
}
function Addr({ a, label }: { a: string; label?: string | null }) {
  return (
    <span className="addr">
      <button className="linkish" onClick={() => navigate(`/address/${a}`)}>{label || short(a, 6)}</button>
      <Copy text={a} />
    </span>
  )
}
