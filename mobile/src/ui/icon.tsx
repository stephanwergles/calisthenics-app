/* Icons: SF Symbols auf iOS, Material Symbols auf Android (expo-symbols). Komponenten nutzen nur
   diese Namen – das Set bleibt an einer Stelle austauschbar. Rein dekorativ: das Label trägt der
   Button bzw. die Zeile (accessibilityLabel). */
import { SymbolView, type SymbolWeight } from 'expo-symbols'
import type { ColorValue } from 'react-native'
import { color as C } from './theme'

const ICONS = {
  training: { ios: 'figure.strengthtraining.traditional', android: 'fitness_center' },
  today: { ios: 'figure.strengthtraining.traditional', android: 'fitness_center' },
  plan: { ios: 'list.bullet.rectangle', android: 'view_list' },
  skills: { ios: 'point.3.connected.trianglepath.dotted', android: 'hub' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  user: { ios: 'person.crop.circle', android: 'account_circle' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  stop: { ios: 'stop.fill', android: 'stop' },
  pause: { ios: 'pause.fill', android: 'pause' },
  check: { ios: 'checkmark', android: 'check' },
  checkCircle: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  circle: { ios: 'circle', android: 'radio_button_unchecked' },
  minus: { ios: 'minus', android: 'remove' },
  plus: { ios: 'plus', android: 'add' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo' },
  up: { ios: 'arrow.up', android: 'arrow_upward' },
  down: { ios: 'chevron.down', android: 'expand_more' },
  collapse: { ios: 'chevron.up', android: 'expand_less' },
  lower: { ios: 'arrow.down', android: 'arrow_downward' },
  left: { ios: 'chevron.left', android: 'chevron_left' },
  right: { ios: 'chevron.right', android: 'chevron_right' },
  close: { ios: 'xmark', android: 'close' },
  timer: { ios: 'timer', android: 'timer' },
  note: { ios: 'text.bubble', android: 'chat' },
  lock: { ios: 'lock.fill', android: 'lock' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events' },
  list: { ios: 'list.bullet', android: 'list' },
  skip: { ios: 'forward.end', android: 'skip_next' },
  trash: { ios: 'trash', android: 'delete' },
  adjust: { ios: 'slider.horizontal.3', android: 'tune' },
  edit: { ios: 'pencil', android: 'edit' },
  sync: { ios: 'arrow.triangle.2.circlepath', android: 'sync' },
  share: { ios: 'square.and.arrow.up', android: 'ios_share' },
  import: { ios: 'square.and.arrow.down', android: 'download' },
  target: { ios: 'target', android: 'my_location' },
  dumbbell: { ios: 'dumbbell', android: 'fitness_center' },
  gauge: { ios: 'gauge.with.dots.needle.33percent', android: 'speed' },
  globe: { ios: 'globe', android: 'language' },
  feedback: { ios: 'bubble.left.and.text.bubble.right', android: 'forum' },
  privacy: { ios: 'hand.raised', android: 'privacy_tip' },
  signOut: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  run: { ios: 'figure.run', android: 'directions_run' },
  bike: { ios: 'figure.outdoor.cycle', android: 'directions_bike' },
  walk: { ios: 'figure.walk', android: 'directions_walk' },
  hike: { ios: 'figure.hiking', android: 'hiking' },
  swim: { ios: 'figure.pool.swim', android: 'pool' },
  row: { ios: 'figure.rower', android: 'rowing' },
  climb: { ios: 'figure.climbing', android: 'landscape' },
  jumprope: { ios: 'figure.jumprope', android: 'sports' },
  cardio: { ios: 'figure.mixed.cardio', android: 'favorite' },
  bolt: { ios: 'bolt.fill', android: 'bolt' },
  flame: { ios: 'flame.fill', android: 'local_fire_department' },
  info: { ios: 'info.circle', android: 'info' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  swap: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  grid: { ios: 'square.grid.2x2', android: 'grid_view' },
  arrowRight: { ios: 'arrow.right', android: 'arrow_forward' },
  figure: { ios: 'figure.cross.training', android: 'sports_gymnastics' },
  video: { ios: 'play.rectangle', android: 'smart_display' },
  medical: { ios: 'cross.case', android: 'medical_services' },
  airplane: { ios: 'airplane', android: 'flight' },
  bed: { ios: 'bed.double', android: 'hotel' },
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 20, color = C.text, weight = 'semibold' }: {
  name: IconName; size?: number; color?: ColorValue; weight?: SymbolWeight
}) {
  const n = ICONS[name]
  return (
    <SymbolView
      name={{ ios: n.ios as never, android: n.android as never }}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  )
}

/** SF-Symbol-Name für native Stellen (NativeTabs, Menüs) */
export const sf = (name: IconName) => ICONS[name].ios
export const md = (name: IconName) => ICONS[name].android

/** Symbol je Aktivitäts-Art (Cardio, Challenge) */
export function activityIcon(kind: string): IconName {
  const map: Record<string, IconName> = { run: 'run', ride: 'bike', walk: 'walk', hike: 'hike', swim: 'swim', row: 'row', climb: 'climb', jumprope: 'jumprope', challenge: 'flame' }
  return map[kind] ?? 'cardio'
}
