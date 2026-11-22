import { useEffect, useState } from 'react'
export function navigate(to: string) {
  if (to === location.pathname + location.search) return
  history.pushState(null, '', to)
  window.dispatchEvent(new Event('tl:nav'))
  window.scrollTo({ top: 0 })
}
export function useLocation() {
  const [loc, set] = useState(() => ({ path: location.pathname, search: location.search }))
  useEffect(() => {
    const f = () => set({ path: location.pathname, search: location.search })
    window.addEventListener('popstate', f)
    window.addEventListener('tl:nav', f)
    return () => { window.removeEventListener('popstate', f); window.removeEventListener('tl:nav', f) }
  }, [])
  return loc
}
