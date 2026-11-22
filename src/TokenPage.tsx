import { useState } from 'react'
import { chainById } from './chains'
import { fmtNum, fmtUsd, short } from './format'
import { ChainMark, Copy, PageHead } from './ui'
import { IconCoin, IconExt } from './icons'

export function TokenView({ token: t }: { token: any }) {
  const [bad, setBad] = useState(false)
  const chains = Object.keys(t.chain_infos || {}).map((id) => ({ id, c: chainById(id), info: t.chain_infos[id] }))
  const price = t.exchange_rate != null ? Number(t.exchange_rate) : null
  const dec = Number(t.decimals ?? 18)
  const supply = t.total_supply ? Number(t.total_supply) / 10 ** dec : null
  return (
    <div className="narrow">
      <PageHead title={t.symbol || 'Token'} sub={<span className="mono">{short(t.address_hash, 6)} <Copy text={t.address_hash} /></span>} />
      <div className="card balance">
        <div className="tok-head">
          <span className="dir tok big">{t.icon_url && !bad ? <img src={t.icon_url} alt="" onError={() => setBad(true)} /> : <IconCoin />}</span>
          <div>
            <div className="row-title">{t.name}</div>
            <div className="row-sub">{t.type} token</div>
          </div>
        </div>
        <div className="balance-l">Price</div>
        <div className="balance-v">{price != null ? fmtUsd(price) : 'Not priced'}</div>
        <div className="balance-s">Market data via Blockscout / CoinGecko</div>
      </div>
      <div className="card kv">
        <div className="kv-r"><span className="k">Market cap</span><span className="v">{t.circulating_market_cap ? fmtUsd(Number(t.circulating_market_cap), true) : '—'}</span></div>
        <div className="kv-r"><span className="k">Total supply</span><span className="v">{supply != null ? fmtNum(supply) : '—'} {t.symbol}</span></div>
        <div className="kv-r"><span className="k">Holders</span><span className="v">{t.holders_count ? Number(t.holders_count).toLocaleString('en-US') : '—'}</span></div>
        <div className="kv-r"><span className="k">Decimals</span><span className="v">{dec}</span></div>
        {chains.map(({ id, c, info }) => (
          <div className="kv-r" key={id}>
            <span className="k">{c ? <><ChainMark chain={c} /> {c.name}</> : `Chain ${id}`}</span>
            <span className="v">{info?.contract_name || 'Contract'}{info?.is_verified ? ' · verified' : ''}</span>
          </div>
        ))}
      </div>
      <div className="links">
        {chains.map(({ id, c }) => c && (
          <a key={id} className="pill link" href={`${c.explorer}/token/${t.address_hash}`} target="_blank" rel="noreferrer">{c.name} explorer <IconExt /></a>
        ))}
      </div>
    </div>
  )
}
