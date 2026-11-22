import { useLocation, navigate } from './router'
import { Home } from './Home'
import { AddressPage } from './AddressPage'
import { TxPage } from './TxPage'
import { SearchPage } from './SearchPage'
import { SearchBox } from './ui'
import { IconGit } from './icons'

export default function App() {
  const { path, search } = useLocation()
  const params = new URLSearchParams(search)
  const seg = path.split('/').filter(Boolean).map(decodeURIComponent)
  let page: JSX.Element
  if (seg[0] === 'address' && seg[1]) page = <AddressPage key={seg[1]} q={seg[1]} />
  else if (seg[0] === 'tx' && seg[1]) page = <TxPage key={seg[1]} hash={seg[1]} chainParam={params.get('chain')} />
  else if (seg[0] === 'search') page = <SearchPage q={params.get('q') || ''} />
  else page = <Home />
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>
          <span className="brand-dot" />tracelight
        </a>
        {path !== '/' && <div className="topsearch"><SearchBox /></div>}
        <a className="roundbtn" href="https://github.com/yunnaysy/tracelight" target="_blank" rel="noreferrer" aria-label="Source on GitHub"><IconGit /></a>
      </header>
      <main className="main">{page}</main>
      <footer className="foot">
        Public data from Blockscout, PublicNode RPC, ENS and CoinGecko. Values are estimates, not financial advice.
      </footer>
    </div>
  )
}
