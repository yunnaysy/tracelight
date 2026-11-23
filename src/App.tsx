import { useLocation, navigate } from './router'
import { Home } from './Home'
import { AddressPage } from './AddressPage'
import { TxPage } from './TxPage'
import { SearchPage } from './SearchPage'
import { SearchBox } from './ui'
import { IconXLogo } from './icons'
import { LogoMark } from './LogoMark'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const X_URL = 'https://x.com/madeofstardusth'

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
          <LogoMark size={28} className="brand-mark" />
          <span className="brand-word">Tracelight</span>
        </a>
        {path !== '/' && <div className="topsearch"><SearchBox /></div>}
        <OwnerButton />
      </header>
      <main className="main">{page}</main>
      <footer className="foot">
        <a className="credit" href={X_URL} target="_blank" rel="noopener noreferrer">Built by Yunay · <IconXLogo size={11} /> @madeofstardusth</a>
        <div>Public data from Blockscout, PublicNode RPC, ENS and CoinGecko. Values are estimates, not financial advice.</div>
      </footer>
    </div>
  )
}

function OwnerButton() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])
  return (
    <div className="owner">
      <button className="ownerchip" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="owner-av">Y</span><span className="owner-l">Built by Yunay</span>
      </button>
      {open && createPortal(
        <>
          <div className="owner-scrim" onClick={() => setOpen(false)} />
          <div className="owner-sheet" role="dialog" aria-label="About the owner">
            <span className="grab only-m-grab" />
            <div className="owner-head">
              <span className="owner-av big">Y</span>
              <div>
                <div className="owner-name">Built by Yunay</div>
                <div className="owner-handle">@madeofstardusth</div>
              </div>
            </div>
            <p className="owner-p">tracelight is an independent multichain wallet explorer designed and built by Yunay. Questions, feedback or collaboration: reach out on X.</p>
            <a className="owner-x" href={X_URL} target="_blank" rel="noopener noreferrer"><IconXLogo size={15} /> Follow @madeofstardusth</a>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
