'use client'
/* Native Hülle (Capacitor, iOS). Im Browser ist alles hier wirkungslos – die Web-App bleibt
   unverändert. In der App:
   - die Oberfläche liegt im App-Paket (capacitor://localhost), nur der Sync geht an den Server,
     angemeldet per Token statt Cookie (anderer Ursprung)
   - Pausen-Ende als lokale Benachrichtigung, auch bei gesperrtem Display
   - Haptik beim Speichern und am Pausenende, Display bleibt während der Session an */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Preferences } from '@capacitor/preferences'
import { KeepAwake } from '@capacitor-community/keep-awake'

export const isNative = () => typeof window !== 'undefined' && Capacitor.isNativePlatform()

/** Server für den Sync: im Browser derselbe Ursprung, in der App die Live-Instanz */
export const apiBase = () => (isNative() ? (process.env.NEXT_PUBLIC_NATIVE_API ?? 'https://calisthenics.apps.blank-studio.de') : '')

/* ── Token (nur App) ── */
const TOKEN = 'payload-token'
export const getToken = async () => (isNative() ? (await Preferences.get({ key: TOKEN })).value : null)
export const setToken = async (token: string | null) => {
  if (!isNative()) return
  if (token) await Preferences.set({ key: TOKEN, value: token })
  else await Preferences.remove({ key: TOKEN })
}

/* ── Pausen-Benachrichtigung ── */
const REST_ID = 1
let permission: boolean | null = null

/** einmal beim Start einer Session fragen – iOS zeigt den Dialog nur beim ersten Mal */
export async function askNotifications() {
  if (!isNative() || permission !== null) return
  try {
    const p = await LocalNotifications.checkPermissions()
    permission = p.display === 'granted' || (await LocalNotifications.requestPermissions()).display === 'granted'
  } catch { permission = false }
}

/** Benachrichtigung zum Pausenende planen (ersetzt eine geplante) – null hebt sie auf.
    Aufrufe laufen nacheinander: Bei schnellem ±15 s darf kein spätes „Aufheben“ ein neueres „Planen“ überholen. */
let queue: Promise<void> = Promise.resolve()
export function scheduleRestEnd(at: number | null, body = 'Weiter mit dem nächsten Satz.') {
  if (!isNative()) return Promise.resolve()
  queue = queue.then(async () => {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] })
      if (at === null || at <= Date.now()) return
      if (permission === null) await askNotifications()
      if (!permission) return
      await LocalNotifications.schedule({ notifications: [{ id: REST_ID, title: 'Pause vorbei', body, schedule: { at: new Date(at) } }] })
    } catch { /* ohne Benachrichtigung weiter */ }
  })
  return queue
}

/* ── Haptik und wach halten ── */
export const tap = () => { if (isNative()) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined) }
export const buzz = () => { if (isNative()) void Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined) }
export async function nativeKeepAwake(on: boolean) {
  if (!isNative()) return false
  try { await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep()) } catch { /* egal */ }
  return true
}

/* ── Native Tab-Leiste (ios/App/App/LeverTabBar.swift) ── */
interface LeverTabBarPlugin {
  configure(o: { items: { id: string; title: string; symbol: string }[]; selected: string }): Promise<void>
  select(o: { id: string }): Promise<void>
  setHidden(o: { hidden: boolean }): Promise<void>
  setBadge(o: { id: string; value: string | null; tone?: 'volt' | 'error' }): Promise<void>
  setAction(o: { id: string; title?: string; symbol?: string; prominent?: boolean; position?: 'bottom' | 'topLeading' | 'topTrailing' }): Promise<void>
  removeAction(o: { id: string }): Promise<void>
  presentSheet(o: SheetSpec): Promise<{ action: string | null }>
  confirm(o: { title: string; message?: string; ok: string; destructive?: boolean }): Promise<{ ok: boolean }>
  showSheet(o: { spec: NSheet }): Promise<void>
  closeSheet(o: { id: string }): Promise<void>
  setPanel(o: { spec: NPanel | null }): Promise<void>
  setRest(o: { spec: NRest | null }): Promise<void>
  addListener(event: 'select' | 'action', cb: (d: { id: string }) => void): Promise<PluginListenerHandle>
  addListener(event: 'sheet', cb: (d: SheetEvent) => void): Promise<PluginListenerHandle>
  addListener(event: 'panel', cb: (d: PanelEvent) => void): Promise<PluginListenerHandle>
  addListener(event: 'rest', cb: (d: { type: 'minus' | 'plus' | 'go' | 'close' }) => void): Promise<PluginListenerHandle>
}
export interface SheetSpec {
  title: string
  subtitle?: string
  sections: { title: string; text: string; warn?: boolean }[]
  actions: { id: string; title: string; symbol?: string; style?: 'glass' | 'prominent' | 'destructive' }[]
}
const TabBar = registerPlugin<LeverTabBarPlugin>('LeverTabBar')

export const nativeTabs = {
  async configure(items: { id: string; title: string; symbol: string }[], selected: string, onSelect: (id: string) => void, onAction: (id: string) => void) {
    if (!isNative()) return false
    try {
      await TabBar.addListener('select', d => onSelect(d.id))
      await TabBar.addListener('action', d => onAction(d.id))
      await TabBar.configure({ items, selected })
      return true
    } catch { return false }
  },
  select: (id: string) => { if (isNative()) void TabBar.select({ id }).catch(() => undefined) },
  hide: (hidden: boolean) => { if (isNative()) void TabBar.setHidden({ hidden }).catch(() => undefined) },
  badge: (id: string, value: string | null, tone?: 'volt' | 'error') => {
    if (isNative()) void TabBar.setBadge({ id, value, tone }).catch(() => undefined)
  },
}

/* ── Native Glas-Buttons und Sheets ── */
export const nativeActions = {
  set: (id: string, o: { title?: string; symbol?: string; prominent?: boolean; position?: 'bottom' | 'topLeading' | 'topTrailing' }) => {
    if (isNative()) void TabBar.setAction({ id, ...o }).catch(() => undefined)
  },
  remove: (id: string) => { if (isNative()) void TabBar.removeAction({ id }).catch(() => undefined) },
}
/** natives iOS-Sheet; liefert die gewählte Aktion oder null (weggewischt) */
export async function nativeSheet(spec: SheetSpec): Promise<string | null> {
  if (!isNative()) return null
  try { return (await TabBar.presentSheet(spec)).action } catch { return null }
}

/** Rückfrage vor folgenreichen Aktionen: in der App ein iOS-Alert mit deutschen Knöpfen
    (rot bei destructive), im Browser der normale Dialog */
export async function ask(o: { title: string; message?: string; ok: string; destructive?: boolean }): Promise<boolean> {
  if (isNative()) {
    try { return (await TabBar.confirm(o)).ok } catch { /* Plugin fehlt (alte App) → Browser-Dialog */ }
  }
  return window.confirm([o.title, o.message].filter(Boolean).join('\n\n'))
}

/* ── Native Sheets ────────────────────────────────────────────────────────────
   Die Web-App beschreibt ein Sheet als Bausteine, iOS zeichnet es mit UIKit (echtes Glas,
   Detents). Ereignisse kommen zurück; ein erneutes showSheet mit gleicher id aktualisiert. */
export interface NButton { id: string; title: string; symbol?: string; style?: 'glass' | 'prominent' | 'destructive' }
export type NBlock =
  | { type: 'section'; title: string }
  | { type: 'text'; text: string; title?: string; style?: 'body' | 'muted' | 'small' | 'note' | 'warn' | 'accent' }
  | { type: 'stats'; items: { value: string; label: string; accent?: boolean; delta?: string }[] }
  | { type: 'segments'; done: number; total: number; label?: string }
  | { type: 'progress'; value: string }
  | { type: 'row'; id?: string; title: string; subtitle?: string; eyebrow?: string; trailing?: string; delta?: string
      state?: 'open' | 'done' | 'skipped' | 'paused' | 'next'; chips?: string[]; symbol?: 'none' }
  | { type: 'check'; id: string; title: string; subtitle?: string; on: boolean }
  | { type: 'disclosure'; id: string; title: string; trailing?: string; on: boolean }
  | { type: 'record'; title: string; subtitle: string; value: string }
  | { type: 'ladder'; title: string; subtitle: string; state: 'done' | 'current' | 'locked'; label: string }
  | { type: 'stepper'; id: string; label: string; value: string }
  | { type: 'segmented'; id: string; options: { id: string; title: string }[]; selected: string }
  | { type: 'field'; id: string; label?: string; value: string; placeholder?: string }
  | { type: 'button'; id: string; title: string; symbol?: string; style?: NButton['style'] }
  | { type: 'buttons'; buttons: NButton[] }
  | { type: 'compare'; title: string; before: number; now: number; max: number; delta: string }
export interface NSheet { id: string; title: string; subtitle?: string; detents?: ('auto' | 'medium' | 'large')[]; blocks: NBlock[]; footer?: NButton[] }
export interface SheetEvent { sheet: string; type: 'tap' | 'toggle' | 'text' | 'dismiss'; id?: string; value?: unknown }

const sheetHandlers = new Map<string, (e: SheetEvent) => void>()
let sheetListening = false
export const nativeSheets = {
  show: (spec: NSheet) => { if (isNative()) void TabBar.showSheet({ spec }).catch(() => undefined) },
  close: (id: string) => { if (isNative()) void TabBar.closeSheet({ id }).catch(() => undefined) },
  on(id: string, handler: (e: SheetEvent) => void) {
    if (!sheetListening && isNative()) { sheetListening = true; void TabBar.addListener('sheet', e => sheetHandlers.get(e.sheet)?.(e)) }
    sheetHandlers.set(id, handler)
    return () => { if (sheetHandlers.get(id) === handler) sheetHandlers.delete(id) }
  },
}

/* Erfassungs-Panel im Training (dauerhaftes natives Sheet mit zwei Höhen) */
export interface NPanel {
  key: string; caption: string; value: string; unit?: string; weight?: string; seconds: boolean
  timerPhase: 'idle' | 'prep' | 'hold' | 'done'; timerLeft?: number; timerShare?: number; timerTitle?: string
  primary: 'save' | 'timer'; doneHint?: string
  /** sub = Zusatzgewicht („+5“), zweite Zeile im Kreis */
  tiles: { n: number; text: string; sub?: string; state: 'done' | 'current' | 'open'; note?: boolean }[]
  canRemove: boolean; stateText?: string; stateButton?: string
}
export interface PanelEvent { type: 'minus' | 'plus' | 'wminus' | 'wplus' | 'timer' | 'cancel' | 'save' | 'tile' | 'add' | 'remove' | 'state' | 'height'; value?: unknown }
let panelHandler: ((e: PanelEvent) => void) | null = null
let heightHandler: ((h: number) => void) | null = null
let panelListening = false
export const nativePanel = {
  set: (spec: NPanel | null) => { if (isNative()) void TabBar.setPanel({ spec }).catch(() => undefined) },
  on(handler: (e: PanelEvent) => void) {
    if (!panelListening && isNative()) {
      panelListening = true
      void TabBar.addListener('panel', e => (e.type === 'height' ? heightHandler?.(Number(e.value)) : panelHandler?.(e)))
    }
    panelHandler = handler
    return () => { if (panelHandler === handler) panelHandler = null }
  },
  onHeight(h: (px: number) => void) { heightHandler = h; return () => { if (heightHandler === h) heightHandler = null } },
}

/* Pausen-Screen (nativ): Ring und Countdown rechnet iOS selbst aus dem Endzeitpunkt */
export interface NRest { end: number | null; total: number; ringing: boolean; saved?: string; nextTitle?: string; nextSubtitle?: string }
let restHandler: ((t: 'minus' | 'plus' | 'go' | 'close') => void) | null = null
let restListening = false
export const nativeRest = {
  set: (spec: NRest | null) => { if (isNative()) void TabBar.setRest({ spec }).catch(() => undefined) },
  on(h: (t: 'minus' | 'plus' | 'go' | 'close') => void) {
    if (!restListening && isNative()) { restListening = true; void TabBar.addListener('rest', e => restHandler?.(e.type)) }
    restHandler = h
    return () => { if (restHandler === h) restHandler = null }
  },
}
