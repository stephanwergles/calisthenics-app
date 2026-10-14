/* Einfache Bremse je Schlüssel (Person/IP): höchstens `limit` Anfragen im gleitenden Fenster.
   Im Speicher des Server-Prozesses – reicht für eine Instanz (pm2, ein Prozess). Bei mehreren
   Instanzen müsste das in die Datenbank oder einen gemeinsamen Speicher. */
export function createLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>()
  return {
    /** true = erlaubt; false = zu viele Anfragen (die Anfrage zählt dann nicht mit) */
    take(key: string): boolean {
      const t = now(), from = t - windowMs
      const list = (hits.get(key) ?? []).filter(x => x > from)
      if (list.length >= limit) { hits.set(key, list); return false }
      list.push(t); hits.set(key, list)
      if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some(x => x > from)) hits.delete(k)
      return true
    },
    /** Sekunden bis wieder eine Anfrage frei ist */
    retryAfter(key: string): number {
      const list = hits.get(key) ?? []
      return list.length ? Math.max(1, Math.ceil((list[0] + windowMs - now()) / 1000)) : 0
    },
  }
}

/** Adresse der anfragenden Person hinter nginx (Ploi): X-Real-IP setzt nginx selbst; bei
    X-Forwarded-For zählt nur der letzte Eintrag – die vorderen kann jede:r mitschicken. */
export function clientIp(headers: Pick<Headers, 'get'> | undefined): string | null {
  const real = headers?.get('x-real-ip')?.trim()
  if (real) return real
  const fwd = headers?.get('x-forwarded-for')?.split(',').map(s => s.trim()).filter(Boolean)
  return fwd?.length ? fwd[fwd.length - 1] : null
}
