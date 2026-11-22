import { useEffect, useState } from 'react'
import { Chain, chainById } from './chains'
import { findTx } from './data'
import { short } from './format'
import { ChainMark, Empty, PageHead, Pills, Skeleton } from './ui'
import { TxDetailView } from './TxDetailView'

export function TxPage({ hash, chainParam }: { hash: string; chainParam: string | null }) {
  const [found, setFound] = useState<Chain[] | null>(chainParam && chainById(chainParam) ? [chainById(chainParam)!] : null)
  const [pick, setPick] = useState<string | null>(chainParam)
  useEffect(() => {
    if (chainParam && chainById(chainParam)) { setFound([chainById(chainParam)!]); setPick(chainParam); return }
    let live = true
    setFound(null)
    findTx(hash).then((c) => { if (!live) return; setFound(c); setPick(c[0] ? String(c[0].id) : null) })
    return () => { live = false }
  }, [hash, chainParam])
  const chain = found?.find((c) => String(c.id) === pick) || found?.[0]
  return (
    <div className="narrow">
      <PageHead title="Transaction" sub={<span className="mono">{short(hash, 8)}</span>} />
      {!found && <><p className="note center"><span className="spinner" /> Looking for this hash on 11 networks…</p><Skeleton rows={3} /></>}
      {found && found.length === 0 && <Empty title="Transaction not found">No supported network (Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Unichain, zkSync, Scroll, Gnosis, Avalanche) knows this hash yet. It may be on another chain or still propagating.</Empty>}
      {found && found.length > 1 && (
        <Pills value={pick || ''} onChange={setPick} items={found.map((c) => ({ id: String(c.id), label: <><ChainMark chain={c} size={12} /> {c.name}</> }))} />
      )}
      {chain && <div className="card plain"><TxDetailView chain={chain} hash={hash} /></div>}
    </div>
  )
}
