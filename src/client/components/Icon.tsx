/* Eigenes kleines Icon-Set statt Text-Glyphen (✓ ▶ ■ ॥ …): einheitliche Strichstärke,
   färbt sich über currentColor, funktioniert offline und braucht keine Bibliothek.
   Raster 24×24, Strich 2, runde Enden. Rein dekorativ – das Label trägt der Button. */
const PATHS = {
  training: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  history: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
  data: 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  play: 'M8 5.5v13l10.5-6.5z',
  stop: 'M7 7h10v10H7z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  pause: 'M9 6v12M15 6v12',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  up: 'M12 19V5M6 11l6-6 6 6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  timer: 'M10 2.5h4M12 13l3-3M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  note: 'M5 4.5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4.5 3.5v-3.5H5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1zM8 9h8M8 12.5h5',
  close: 'M6 6l12 12M18 6L6 18',
} as const

export type IconName = keyof typeof PATHS
const FILLED: IconName[] = ['play', 'stop']

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  const filled = FILLED.includes(name)
  return (
    <svg className={`icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  )
}
