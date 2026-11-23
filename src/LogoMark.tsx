import { useId } from 'react'

type Props = { size?: number; className?: string; title?: string }

/** Charcoal rounded-square mark: a white path through three chain nodes. */
export function LogoMark({ size = 28, className, title = 'Tracelight' }: Props) {
  const raw = useId().replace(/:/g, '')
  const og = `tl-o-${raw}`
  const gl = `tl-g-${raw}`
  const rm = `tl-r-${raw}`
  const gw = `tl-w-${raw}`
  const ho = `tl-h-${raw}`
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={og} x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#443D37" />
          <stop offset="0.5" stopColor="#322B25" />
          <stop offset="1" stopColor="#241F1B" />
        </linearGradient>
        <linearGradient id={gl} x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6B645E" />
          <stop offset="0.1" stopColor="#534C46" />
          <stop offset="0.3" stopColor="#453E38" />
          <stop offset="0.65" stopColor="#362F29" />
          <stop offset="1" stopColor="#2C2623" />
        </linearGradient>
        <linearGradient id={rm} x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.40" />
          <stop offset="0.15" stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="0.75" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.26" />
        </linearGradient>
        <filter id={gw} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.45" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <mask id={ho}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="12.8" cy="46" r="1.62" fill="#000" />
          <circle cx="30.17" cy="30.67" r="1.77" fill="#000" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="14.2" fill={`url(#${og})`} />
      <rect x="6" y="6" width="52" height="52" rx="10.2" fill={`url(#${gl})`} />
      <rect x="6" y="6" width="52" height="52" rx="10.2" fill="none" stroke={`url(#${rm})`} strokeWidth="0.7" />
      <path
        d="M 12.80 46.00 C 22.66 46.54 25.68 36.92 30.17 30.67 C 34.30 30.20 36.52 33.87 40.68 33.78 C 45.72 31.07 45.75 21.73 53.03 21.56"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        mask={`url(#${ho})`}
      />
      <circle cx="12.80" cy="46.00" r="2.20" stroke="#fff" strokeWidth="1.2" />
      <circle cx="30.17" cy="30.67" r="2.35" stroke="#fff" strokeWidth="1.2" />
      <circle cx="53.03" cy="21.56" r="1.72" fill="#fff" filter={`url(#${gw})`} />
    </svg>
  )
}
