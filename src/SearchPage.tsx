import { useEffect, useState } from 'react'
import { chainById } from './chains'
import { searchTokens } from './data'
import { fmtUsd, short } from './format'
import { ChainMark, Empty, PageHead, Row, SearchBox, Skeleton } from './ui'
import { navigate } from './router'
import { IconCoin } from './icons'

export function SearchPage({ q }: { q: string }) {
  const [res, setRes] = useState<any[] | null>(null)
  useEffect(() => { let live = true; setRes(null); searchTokens(q).then((r) => live && setRes(r)); return () => { live = false } }, [q])
  return (
    <div className="narrow">
      <PageHead title="Search" sub={`Tokens matching “${q}”`} />
      <SearchBox initial={q} />
      {!res ? <Skeleton rows={5} /> : res.length === 0 ? <Empty title="No matches">Try a full 0x address, a 66-character tx hash, or an ENS name like vitalik.eth.</Empty> : (
        <div className="list">
          {res.slice(0, 25).map((t) => {
            const cid = Object.keys(t.chain_infos || {})[0]
            const c = chainById(cid)
            return (
              <Row key={t.address_hash + cid} onClick={() => navigate(`/address/${t.address_hash}`)}
                icon={<span className="dir tok">{t.icon_url ? <img src={t.icon_url} alt="" /> : <IconCoin />}</span>}
                title={`${t.name} (${t.symbol})`}
                sub={<>{c ? <><ChainMark chain={c} /> {c.name}</> : `Chain ${cid}`} · {short(t.address_hash)}</>}
                amount={t.exchange_rate ? fmtUsd(Number(t.exchange_rate)) : '—'}
                date={t.circulating_market_cap ? `MC ${fmtUsd(Number(t.circulating_market_cap), true)}` : t.holders_count ? `${Number(t.holders_count).toLocaleString('en-US')} holders` : ''} />
            )
          })}
        </div>
      )}
    </div>
  )
}
