/* Param-Format der Route day/[id]: was ein Tipp im Verlauf öffnet.
     s:<sessionId>   Einheit
     a:<activityId>  Cardio-Eintrag
     e:<YYYY-MM-DD>  Tag ohne Eintrag */
export type DayItem = { kind: 'session' | 'activity' | 'empty'; id: string }

const PREFIX = { session: 's', activity: 'a', empty: 'e' } as const

export const dayParam = (d: DayItem) => `${PREFIX[d.kind]}:${d.id}`

export function parseDayParam(raw: string | string[] | undefined): DayItem | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (!v) return null
  const i = v.indexOf(':')
  if (i < 0) return null
  const p = v.slice(0, i), id = v.slice(i + 1)
  const kind = p === 's' ? 'session' : p === 'a' ? 'activity' : p === 'e' ? 'empty' : null
  return kind && id ? { kind, id } : null
}

export const dayHref = (d: DayItem) => ({ pathname: '/day/[id]' as const, params: { id: dayParam(d) } })
