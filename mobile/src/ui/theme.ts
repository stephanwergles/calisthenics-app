/* Design-Tokens der Expo-App – dieselben Werte wie die Web-App (src/app/(frontend)/styles.css).
   Akzent Volt nur hier ändern (Marke: art/brand/mark.py). Dunkles Erscheinungsbild immer. */

export const color = {
  bg: '#101010',
  card: '#1a1a1a',
  card2: '#232323',
  line: '#2e2e2e',
  text: '#ededed',
  muted: '#979797',
  chalk: '#f4f4f4',
  accent: '#D4FF3A',
  onAccent: '#101010',
  accentDim: 'rgba(212, 255, 58, 0.10)',
  accentHi: 'rgba(212, 255, 58, 0.22)',
  accentLine: 'rgba(212, 255, 58, 0.45)',
  danger: '#ff6b5e',
  dangerDim: 'rgba(255, 90, 80, 0.10)',
  dangerLine: 'rgba(255, 90, 80, 0.28)',
  /** Glasflächen (Buttons, Segmente) */
  glass: 'rgba(255, 255, 255, 0.07)',
  glassLine: 'rgba(255, 255, 255, 0.12)',
  ghost: 'rgba(255, 255, 255, 0.055)',
  scrim: 'rgba(0, 0, 0, 0.5)',
} as const

/** Schriftfamilien (über expo-font aus app.config.ts eingebunden) */
export const font = {
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemi: 'Barlow_600SemiBold',
  bodyBold: 'Barlow_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  displayBold: 'BarlowCondensed_700Bold',
  display: 'BarlowCondensed_800ExtraBold',
  displayBlack: 'BarlowCondensed_900Black',
} as const

export const radius = { sm: 8, md: 11, lg: 14, xl: 18, card: 20, sheet: 30, pill: 999 } as const
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 32 } as const
/** Mindestgröße für Touch-Ziele (Gym, schwitzige Finger) */
export const TAP = 44
/** Seitenrand der Screens */
export const GUTTER = 20
