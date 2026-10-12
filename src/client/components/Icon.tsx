/* Icons aus Lucide (lucide-react, ISC) – landen im App-Bundle, also offline verfügbar;
   ins Bundle kommen nur die hier genannten. Komponenten nutzen ausschließlich <Icon name>,
   damit das Set an einer Stelle austauschbar bleibt. Rein dekorativ – das Label trägt der Button. */
import {
  ArrowUp, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Database, Dumbbell, List, Lock,
  MessageSquareText, Minus, Network, Pause, Play, Plus, SkipForward, Square, Timer, Trophy, Undo2, X, type LucideIcon,
} from 'lucide-react'

const ICONS = {
  training: Dumbbell, history: CalendarDays, data: Database,
  play: Play, stop: Square, check: Check, pause: Pause, minus: Minus, plus: Plus, undo: Undo2, up: ArrowUp,
  left: ChevronLeft, right: ChevronRight, down: ChevronDown, timer: Timer, note: MessageSquareText, close: X,
  lock: Lock, trophy: Trophy, list: List, skip: SkipForward, skills: Network,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS
const FILLED: IconName[] = ['play', 'stop']

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  const C = ICONS[name]
  return <C className={`icon${className ? ` ${className}` : ''}`} size={size} strokeWidth={2} aria-hidden="true" focusable="false"
    {...(FILLED.includes(name) ? { fill: 'currentColor' } : {})} />
}
