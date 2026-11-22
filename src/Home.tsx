import { useEffect, useState } from 'react'
import { CHAINS, chainById } from './chains'
import { getLatestTxs, getPrices, getPulse, Prices, Pulse } from './data'
import { ago, fmtNum, fmtUsd, short, fromUnits } from './format'
import { ChainMark, DirIcon, Empty, PageHead, Row, SearchBox, Skeleton, prettyMethod } from './ui'
import { navigate } from './router'
import { TxDetailView } from './TxDetailView'

const EXAMPLES = [
  { label: 'vitalik.eth', q: '/address/vitalik.eth' },
  { label: 'Active Base wallet', q: '/address/0x849151d7D0bF1F34b70d5caD5149D28CC2308bf1' },
  { label: 'USDC token', q: '/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
]

export function Home() {
  const [prices, setPrices] = useState<Prices>()
  const [pulse, setPulse] = useState<Pulse[] | null>(null)
  const [txs, setTxs] = useState<any[] | null>(null)
  const [txErr, setTxErr] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let live = true
    const load = () => {
      getPrices().then((p) => live && setPrices(p)).catch(() => {})
      Promise.all(CHAINS.map(getPulse)).then((p) => live && setPulse(p))
      getLatestTxs(chainById(1)!).then((t) => { if (live) { setTxs(t.slice(0, 12)); setTxErr(false) } }).catch(() => live && setTxErr(true))
    }
    load()
    const a = setInterval(load, 20000)
    const b = setInterval(() => setNow(Date.now()), 1000)
    return () => { live = false; clearInterval(a); clearInterval(b) }
  }, [])

  const eth = prices?.ethereum
  const latestTx = txs?.[0]?.hash
  return (
    <div className="split">
      <section className="col-main">
        <PageHead back={false} title="Explorer" sub="11 networks · live public data" />
        <div className="card searchcard">
          <div className="searchcard-t">Trace any wallet, transaction or token</div>
          <SearchBox big />
          <div className="chips">
            {EXAMPLES.map((e) => <button key={e.label} className="chip" onClick={() => navigate(e.q)}>{e.label}</button>)}
            {latestTx && <button className="chip" onClick={() => navigate(`/tx/${latestTx}?chain=1`)}>Latest Ethereum tx</button>}
          </div>
        </div>

        <div className="card balance">
          <div className="balance-l">Ether price</div>
          <div className="balance-v">{eth ? fmtUsd(eth.usd) : <span className="sk w50 tall" />}</div>
          <div className="balance-s">
            {eth?.usd_24h_change != null && <span className={eth.usd_24h_change >= 0 ? 'up' : 'down'}>{eth.usd_24h_change >= 0 ? '+' : ''}{eth.usd_24h_change.toFixed(2)}% 24h</span>}
            {prices && <> · BNB {fmtUsd(prices.binancecoin?.usd)} · POL {fmtUsd(prices['polygon-ecosystem-token']?.usd)} · AVAX {fmtUsd(prices['avalanche-2']?.usd)}</>}
          </div>
        </div>

        <div className="section-h"><h2>Latest on Ethereum</h2><span className="live"><i /> Live</span></div>
        {txErr && !txs ? <Empty title="Feed unavailable">Blockscout's Ethereum feed didn't respond. It refreshes every 20 seconds.</Empty> : !txs ? <Skeleton rows={6} /> : (
          <div className="list">
            {txs.map((t) => {
              const v = fromUnits(t.value, 18)
              const failed = t.status === 'error'
              return (
                <Row key={t.hash} active={sel === t.hash} onClick={() => setSel(t.hash)}
                  icon={<DirIcon dir={failed ? 'fail' : v > 0 ? 'self' : 'call'} />}
                  title={t.to?.ens_domain_name || t.to?.name || short(t.to?.hash || t.created_contract?.hash)}
                  sub={<><ChainMark chain={chainById(1)!} /> from {t.from?.ens_domain_name || short(t.from?.hash)}</>}
                  amount={v > 0 ? <>{fmtNum(v)} <span className="sym">ETH</span></> : <span className="muted-amt">{t.method ? prettyMethod(t.method) : 'Call'}</span>}
                  amountCls={failed ? 'fail' : ''}
                  date={t.timestamp ? ago(Math.min(+new Date(t.timestamp), now)) : 'pending'} />
              )
            })}
          </div>
        )}
      </section>

      <aside className="col-side">
        {sel ? (
          <div className="sheet-wrap" onClick={() => setSel(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <span className="grab" />
              <TxDetailView chain={chainById(1)!} hash={sel} onClose={() => setSel(null)} />
            </div>
          </div>
        ) : null}
        <div className={sel ? 'only-m-hidden' : ''}>
          <div className="section-h"><h2>Network pulse</h2><span className="muted small">RPC · every 20s</span></div>
          {!pulse ? <Skeleton rows={6} /> : (
            <div className="list">
              {pulse.map((p) => (
                <Row key={p.chain.id} onClick={undefined}
                  icon={<span className="dir net" style={{ background: p.chain.color + '1A', color: p.chain.color }}><b>{p.chain.name[0]}</b></span>}
                  title={p.chain.name}
                  sub={p.ok ? <>Block {p.block!.toLocaleString('en-US')}</> : 'RPC unreachable'}
                  amount={p.ok ? <>{fmtNum(p.gasGwei!, p.gasGwei! < 0.01 ? 6 : 3)} <span className="sym">gwei</span></> : '—'}
                  date={p.ok && p.ts ? ago(p.ts) : ''} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
