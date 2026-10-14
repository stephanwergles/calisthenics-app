/* Übersetzungen der Oberfläche (de/en). Quelle ist Deutsch (i18n/de/*), Englisch (i18n/en/*) muss
   dieselben Schlüssel haben – fehlt einer, schlägt die Typprüfung fehl.

     t('home.start')                       → Text
     t('plan.days', { n: 3 })              → „{n} Tage“ mit Variable
     tn('plan.exercises', 5)               → Plural: Schlüssel mit .one / .other, {n} wird ersetzt

   Rein und ohne React: auch logic.ts darf es nutzen. Die Sprache stellt TrainingApp ein (setLocale)
   und rendert danach neu. Datum/Zahl: intl() liefert das passende Locale für toLocale*String. */
import { messages as de } from './de/index.ts'
import { messages as en } from './en/index.ts'
import { platform } from '../platform.ts'

export type Locale = 'de' | 'en'
type Tree = { [k: string]: string | Tree }
type Leaves<T, P extends string = ''> = { [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`> }[keyof T & string]
export type Key = Leaves<typeof de>
/** Englisch muss die Form des deutschen Wörterbuchs haben */
export type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> }

const DICTS: Record<Locale, Tree> = { de: de as unknown as Tree, en: en as unknown as Tree }
let current: Locale = 'de'
export const getLocale = () => current
export function setLocale(l: Locale) { current = l }
/** Locale für Intl (Datum, Zahlen) */
export const intl = () => (current === 'de' ? 'de-DE' : 'en-GB')

function lookup(key: string, locale: Locale): string | undefined {
  let node: string | Tree | undefined = DICTS[locale]
  for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined
  return typeof node === 'string' ? node : undefined
}
const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s

export function t(key: Key, vars?: Record<string, string | number>): string {
  return fill(lookup(key, current) ?? lookup(key, 'de') ?? key, vars)
}
/** Plural: key.one bei n = 1, sonst key.other; {n} wird ersetzt */
export function tn(key: string, n: number, vars?: Record<string, string | number>): string {
  const k = `${key}.${n === 1 ? 'one' : 'other'}`
  return fill(lookup(k, current) ?? lookup(k, 'de') ?? k, { n, ...vars })
}

/* Sprachwahl pro Gerät: 'de' | 'en' | 'system' (ausdrücklich gewählt). Ohne Wahl gilt die
   Systemsprache – solange Englisch Beta ist, ohne Wahl Deutsch. */
const STORE = 'lever-locale'
export const EN_BETA = true
export type LocaleChoice = Locale | 'system'
const systemLocale = (): Locale => (platform().systemLanguage().toLowerCase().startsWith('de') ? 'de' : 'en')
function savedChoice(): LocaleChoice | null {
  const v = platform().prefs.get(STORE); if (v === 'de' || v === 'en' || v === 'system') return v
  return null
}
/** was die Sprachwahl anzeigt: ohne gespeicherte Wahl in der Beta „Deutsch“, sonst „Systemsprache“ */
export const currentChoice = (): LocaleChoice => savedChoice() ?? (EN_BETA ? 'de' : 'system')
export function initialLocale(): Locale {
  const c = savedChoice()
  if (c === 'de' || c === 'en') return c
  return c === 'system' || !EN_BETA ? systemLocale() : 'de'
}
export function saveLocale(c: LocaleChoice) {
  platform().prefs.set(STORE, c)
}
