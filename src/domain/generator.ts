/* Prototyp „Training aus Skills“ (ROADMAP v3, Phase 3.1/3.2): baut aus Ziel-Skills, Equipment,
   Trainingstagen und aktuellen Stufen einen Wochenplan. Reine, deterministische Funktion – keine
   Datenbank, keine UI. Daten: src/seed/catalog.json, exercise-meta.json, skills.json.

   Ablauf
   1. Slots sammeln (je Progression höchstens einmal pro Woche):
      Skill-Leitern → Support-Leitern → unerfüllte Voraussetzungen → fehlende Grundmuster → Ausgleich Zug/Druck
   2. Auf Tage verteilen (schwerste Skills zuerst): Skill an den Tag mit der längsten Pause davor,
      Support/Voraussetzung zum Tag ihres Skills, gleiche Region zusammen, Zug und Druck möglichst
      getrennt; hart: keine hohe Belastung derselben Sehne an zwei Kalender-Folgetagen
   3. Volumen aus den Stufen-Zielen, ans Zeitbudget angepasst (erst Sätze kürzen, dann Ausgleich und
      Grundmuster streichen – Skills bleiben)
   4. Reihenfolge je Einheit: Skill, Kraft, Rumpf, Zubehör */
import type {
  Block, Catalog, Equipment, Exercise, ExerciseMeta, GeneratedPlan, GeneratorInput, Pattern, PlanDay,
  PlanSlot, Progression, Region, Skill, SlotKind, SplitTemplate, Tendon, Weekday,
} from './model.ts'

export const WEEK: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const BASE_PATTERNS: Pattern[] = ['vertical-pull', 'horizontal-pull', 'vertical-push', 'horizontal-push', 'squat', 'hinge', 'core']
const PATTERN_LABEL: Record<Pattern, string> = {
  'vertical-pull': 'Zug vertikal', 'horizontal-pull': 'Zug horizontal', 'vertical-push': 'Druck vertikal',
  'horizontal-push': 'Druck horizontal', squat: 'Kniebeuge', hinge: 'Hüftstreckung', core: 'Rumpf', isolation: 'Isolation',
}
const ALWAYS: Equipment[] = ['floor', 'wall']
const WARMUP_MIN = 10
const HIGH = 2                       // ab dieser Sehnenbelastung gilt die Folgetag-Regel
const PUSH_PULL_RATIO = 1.5          // Sätze Zug : Druck höchstens so weit auseinander

export interface GeneratorData {
  catalog: Catalog
  meta: Record<string, ExerciseMeta>
  skills: Skill[]
  splits?: SplitTemplate[]
}

type Theme = SplitTemplate['themes'][number]
const isUpper = (t: Theme) => t.regions.includes('pull') || t.regions.includes('push')

/** Themen der Vorlage so auf die Wochentage legen, dass schwere Skills die längste Pause davor
    bekommen und Oberkörper-Themen nicht an Kalender-Folgetagen liegen (alle Reihenfolgen probieren) */
export function assignThemes(themes: Theme[], days: Weekday[], rest: Map<Weekday, number>, weights: { region: Region; weight: number }[]): Map<Weekday, Theme> {
  const perms: Theme[][] = []
  const seen = new Set<string>()
  const walk = (left: Theme[], acc: Theme[]) => {
    if (!left.length) { const key = acc.map(t => t.id).join(); if (!seen.has(key)) { seen.add(key); perms.push(acc) } return }
    left.forEach((t, i) => walk([...left.slice(0, i), ...left.slice(i + 1)], [...acc, t]))
  }
  walk(themes, [])
  const score = (perm: Theme[]) => {
    let s = 0
    for (const { region, weight } of weights) {
      const hosts = days.filter((d, i) => perm[i].regions.includes(region))
      if (hosts.length) s += Math.max(...hosts.map(d => rest.get(d)!)) * weight
    }
    days.forEach((d, i) => days.forEach((o, j) => { if (i < j && adjacent(d, o) && isUpper(perm[i]) && isUpper(perm[j])) s -= 5 }))
    return s
  }
  const best = perms.reduce((a, b) => (score(b) > score(a) ? b : a))
  return new Map(days.map((d, i) => [d, best[i]]))
}

interface Candidate {
  progression: Progression
  exercise: Exercise
  meta: ExerciseMeta
  kind: SlotKind
  reason: string
  skill?: string        // Skill, zu dem der Slot gehört (Skill/Support/Voraussetzung)
  sets: number
  minutes: number
}

/** Kalender-Abstand zum vorigen Trainingstag (zyklisch über die Woche); ein Tag allein = 7 */
export function restDays(days: Weekday[]): Map<Weekday, number> {
  const sorted = [...new Set(days)].sort((a, b) => WEEK.indexOf(a) - WEEK.indexOf(b))
  return new Map(sorted.map((d, i) => {
    const prev = sorted[(i - 1 + sorted.length) % sorted.length]
    const gap = (WEEK.indexOf(d) - WEEK.indexOf(prev) + 7) % 7
    return [d, gap === 0 ? 7 : gap]
  }))
}
/** zwei Tage liegen im Kalender direkt hintereinander (auch So → Mo) */
export const adjacent = (a: Weekday, b: Weekday) => {
  const d = Math.abs(WEEK.indexOf(a) - WEEK.indexOf(b))
  return d === 1 || d === 6
}

export function usable(meta: ExerciseMeta | undefined, equipment: Equipment[]): boolean {
  if (!meta) return false
  const have = new Set([...equipment, ...ALWAYS])
  return meta.equipment.some(alt => alt.every(e => have.has(e)))
}

/** Minuten für einen Slot: Arbeit + Pause je Satz (Halteübungen nach Zielzeit, „pro Seite“ doppelt) */
export function slotMinutes(exercise: Exercise, target: Progression['steps'][number]['target'], sets: number): number {
  const work = (exercise.unit === 'seconds' ? (target.max ?? 30) : 40) * (exercise.perSide ? 2 : 1)
  return Math.round(sets * (work + target.restSec) / 30) / 2
}

export function generatePlan(data: GeneratorData, input: GeneratorInput): GeneratedPlan {
  const { catalog, meta } = data
  const warnings: string[] = []
  const exercises = new Map(catalog.exercises.map(e => [e.id, e]))
  const progressions = new Map(catalog.progressions.map(p => [p.id, p]))
  const skills = input.skills.map(id => data.skills.find(s => s.id === id)).filter((s): s is Skill => !!s)
  for (const id of input.skills) if (!skills.some(s => s.id === id)) warnings.push(`Unbekannter Skill: ${id}`)

  /* ── 1. Slots sammeln ── */
  const used = new Set<string>()
  const candidates: Candidate[] = []
  const stepOf = (p: Progression) => Math.min(input.current[p.id] ?? 0, p.steps.length - 1)
  /** aktuelle Stufe, sonst die nächst-leichtere, zuletzt die nächst-schwerere mit vorhandenem Equipment
      (z. B. Negativ-Muscle-ups statt Muscle-ups mit Band, wenn kein Band da ist) */
  const resolve = (p: Progression) => {
    const at = stepOf(p)
    const order = [...Array.from({ length: at + 1 }, (_, i) => at - i), ...Array.from({ length: p.steps.length - at - 1 }, (_, i) => at + 1 + i)]
    for (const i of order) {
      const ex = exercises.get(p.steps[i].exercise)
      if (ex && usable(meta[ex.id], input.equipment)) return { ex, target: p.steps[i].target }
    }
    return null
  }
  const add = (pid: string, kind: SlotKind, reason: string, skill?: string): boolean => {
    if (used.has(pid)) return true
    const p = progressions.get(pid)
    if (!p) { warnings.push(`Leiter fehlt im Katalog: ${pid}`); return false }
    const r = resolve(p)
    if (!r) return false
    used.add(pid)
    candidates.push({ progression: p, exercise: r.ex, meta: meta[r.ex.id], kind, reason, skill, sets: r.target.sets,
      minutes: slotMinutes(r.ex, r.target, r.target.sets) })
    return true
  }

  for (const s of skills) {
    const ok = s.targets.map(pid => add(pid, 'skill', s.name, s.id))
    if (!ok.some(Boolean)) warnings.push(`${s.name}: mit dem vorhandenen Equipment nicht trainierbar`)
  }
  for (const s of skills) for (const pid of s.support) add(pid, 'support', `Unterstützt ${s.name}`, s.id)
  for (const s of skills) for (const pre of s.prerequisites) {
    if ((input.current[pre.progression] ?? 0) >= pre.minStep) continue
    const p = progressions.get(pre.progression)
    const goal = p ? exercises.get(p.steps[Math.min(pre.minStep, p.steps.length - 1)].exercise)?.name : pre.progression
    if (!add(pre.progression, 'prerequisite', `Voraussetzung ${s.name}: ${goal}`, s.id))
      warnings.push(`${s.name}: Voraussetzung ${goal} mit dem Equipment nicht trainierbar`)
  }
  // fehlende Grundmuster mit der leichtesten passenden Leiter auffüllen
  for (const pattern of BASE_PATTERNS) {
    if (candidates.some(c => c.meta.pattern === pattern)) continue
    const pick = catalog.progressions
      .filter(p => !used.has(p.id))
      .map(p => ({ p, r: resolve(p) }))
      .filter(x => x.r && meta[x.r.ex.id]?.pattern === pattern)
      .sort((a, b) => meta[a.r!.ex.id].difficulty - meta[b.r!.ex.id].difficulty)[0]
    if (pick) add(pick.p.id, 'base', `Grundmuster: ${PATTERN_LABEL[pattern]}`)
    else warnings.push(`Grundmuster ${PATTERN_LABEL[pattern]}: keine Leiter mit dem vorhandenen Equipment`)
  }
  // Ausgleich Zug/Druck (nach Sätzen)
  const setsOf = (region: string) => candidates.filter(c => c.progression.region === region).reduce((n, c) => n + c.sets, 0)
  for (let i = 0; i < 4; i++) {
    const pull = setsOf('pull'), push = setsOf('push')
    const need = pull > push * PUSH_PULL_RATIO ? 'push' : push > pull * PUSH_PULL_RATIO ? 'pull' : null
    if (!need) break
    const pick = catalog.progressions
      .filter(p => p.region === need && !used.has(p.id))
      .map(p => ({ p, r: resolve(p) }))
      .filter(x => x.r)
      .sort((a, b) => meta[a.r!.ex.id].difficulty - meta[b.r!.ex.id].difficulty)[0]
    if (!pick) { warnings.push(`Ausgleich ${need === 'push' ? 'Druck' : 'Zug'}: keine weitere Leiter verfügbar`); break }
    add(pick.p.id, 'balance', `Ausgleich ${need === 'push' ? 'Druck' : 'Zug'}`)
  }

  /* ── 2. Auf Tage verteilen ── */
  const rest = restDays(input.days)
  const days = [...rest.keys()]
  if (!days.length) return { days: [], warnings: [...warnings, 'Keine Trainingstage angegeben'] }
  const plan = new Map<Weekday, Candidate[]>(days.map(d => [d, []]))
  // Split-Vorlage: Thema je Tag; Slots nur an Tage, deren Thema ihre Region erlaubt
  let themeOf = new Map<Weekday, Theme>()
  if (input.split) {
    const tpl = data.splits?.find(t => t.id === input.split)
    if (!tpl) warnings.push(`Unbekannte Split-Vorlage: ${input.split}`)
    else if (tpl.themes.length !== days.length) warnings.push(`${tpl.name} hat ${tpl.themes.length} Tage, gewählt sind ${days.length} – ohne Vorlage verteilt`)
    else {
      const weights = candidates.filter(c => c.kind === 'skill').map(c => ({ region: (c.progression.region ?? 'core') as Region, weight: c.meta.difficulty }))
      themeOf = assignThemes(tpl.themes, days, rest, weights)
    }
  }
  const allowed = (d: Weekday, c: { progression: Progression }) => {
    const t = themeOf.get(d)
    return !t || t.regions.includes((c.progression.region ?? 'core') as Region)
  }
  const minutesOf = (d: Weekday) => WARMUP_MIN + plan.get(d)!.reduce((n, c) => n + c.minutes, 0)
  const highTendons = (c: Candidate) => (Object.entries(c.meta.stress) as [Tendon, number][]).filter(([, v]) => v >= HIGH).map(([t]) => t)
  const conflicts = (d: Weekday, c: Candidate) => days.filter(o => o !== d && adjacent(o, d))
    .some(o => plan.get(o)!.some(x => highTendons(x).some(t => highTendons(c).includes(t))))
  const opposite = (r?: string) => (r === 'pull' ? 'push' : r === 'push' ? 'pull' : null)
  const KIND_ORDER: SlotKind[] = ['skill', 'support', 'prerequisite', 'base', 'balance']
  const queue = [...candidates].sort((a, b) =>
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.meta.difficulty - a.meta.difficulty)

  // Oberkörper-Skills (Zug, Druck, Stütz) nicht an Folgetage legen – Sehnen und Nervensystem brauchen Pause
  const upper = (c: Candidate) => c.progression.region !== 'legs'
  const upperSkillNear = (d: Weekday) => days.filter(o => o !== d && adjacent(o, d))
    .some(o => plan.get(o)!.some(x => x.kind === 'skill' && upper(x)))
  for (const c of queue) {
    const score = (d: Weekday) => {
      const here = plan.get(d)!
      let s = 0
      if (c.kind === 'skill') {
        s += rest.get(d)! * c.meta.difficulty * 0.6
        s -= 3 * here.filter(x => x.kind === 'skill' && x.skill !== c.skill).length
        if (upper(c) && upperSkillNear(d)) s -= 4
      }
      if (c.skill && c.kind !== 'skill' && here.some(x => x.kind === 'skill' && x.skill === c.skill)) s += 6
      if (here.some(x => x.progression.region === c.progression.region)) s += 3
      if (here.some(x => x.progression.region === opposite(c.progression.region))) s -= 2
      if (minutesOf(d) + c.minutes > input.minutes) s -= 10
      return s - 0.05 * minutesOf(d)
    }
    const fits = days.filter(d => allowed(d, c))
    if (!fits.length) warnings.push(`${c.exercise.name}: passt zu keinem Tagesthema der Vorlage`)
    const pool = fits.length ? fits : days
    const free = pool.filter(d => !conflicts(d, c))
    if (!free.length) warnings.push(`${c.exercise.name}: an jedem Tag Sehnen-Konflikt mit dem Folgetag`)
    const best = (free.length ? free : pool).reduce((a, b) => (score(b) > score(a) ? b : a))
    plan.get(best)!.push(c)
  }

  const weekSets = (r: string) => days.flatMap(d => plan.get(d)!).filter(x => x.progression.region === r).reduce((n, x) => n + x.sets, 0)
  const balanced = (extraRegion?: string, extra = 0) => {
    const pull = weekSets('pull') + (extraRegion === 'pull' ? extra : 0), push = weekSets('push') + (extraRegion === 'push' ? extra : 0)
    return !pull || !push || Math.max(pull, push) / Math.min(pull, push) <= PUSH_PULL_RATIO
  }

  /* ── 2b. Freie Zeit: Skills ein zweites Mal üben (Skill-Arbeit profitiert von Häufigkeit) ── */
  for (const d of days) {
    for (const s of skills) {
      if (minutesOf(d) >= input.minutes * 0.6) break
      if (plan.get(d)!.some(x => x.skill === s.id && x.kind === 'skill')) continue
      const first = queue.find(x => x.kind === 'skill' && x.skill === s.id)
      if (!first) continue
      const t = first.progression.steps.find(x => x.exercise === first.exercise.id)!.target
      const sets = Math.max(3, t.sets - 1)
      const again: Candidate = { ...first, kind: 'skill', reason: `${s.name} · 2. Einheit`, sets, minutes: slotMinutes(first.exercise, t, sets) }
      if (!allowed(d, again) || conflicts(d, again) || minutesOf(d) + again.minutes > input.minutes) continue
      if (upper(again) && upperSkillNear(d) && days.length > 2) continue
      if (!balanced(again.progression.region, again.sets)) continue
      plan.get(d)!.push(again)
    }
  }

  /* ── 3. Zeitbudget ── */
  const SHRINK: SlotKind[] = ['balance', 'base', 'prerequisite', 'support', 'skill']
  for (const d of days) {
    const list = plan.get(d)!
    for (const kind of SHRINK) {               // erst Sätze kürzen (min. 2, Skills min. 3)
      for (const c of list.filter(x => x.kind === kind).reverse()) {
        const floor = kind === 'skill' ? 3 : 2
        while (minutesOf(d) > input.minutes && c.sets > floor) {
          c.sets--
          const t = c.progression.steps.find(s => s.exercise === c.exercise.id)!.target
          c.minutes = slotMinutes(c.exercise, t, c.sets)
        }
      }
    }
    for (const kind of ['balance', 'base'] as SlotKind[]) {   // dann streichen
      for (const c of list.filter(x => x.kind === kind).reverse()) {
        if (minutesOf(d) <= input.minutes) break
        list.splice(list.indexOf(c), 1)
        warnings.push(`${d}: ${c.exercise.name} (${c.reason}) gestrichen – Zeitbudget`)
      }
    }
    if (minutesOf(d) > input.minutes) warnings.push(`${d}: ${minutesOf(d)} min trotz Kürzung über dem Budget von ${input.minutes} min`)
  }

  /* ── 3b. Zug/Druck nachziehen: Kürzungen können den Ausgleich kippen – die stärkere Seite kürzen ── */
  for (let guard = 0; guard < 40 && !balanced(); guard++) {
    const strong = weekSets('pull') > weekSets('push') ? 'pull' : 'push'
    const victim = days.flatMap(d => plan.get(d)!)
      .filter(x => x.progression.region === strong && x.sets > (x.kind === 'skill' ? 3 : 2))
      .sort((a, b) => SHRINK.indexOf(a.kind) - SHRINK.indexOf(b.kind) || b.sets - a.sets)[0]
    if (!victim) break
    victim.sets--
    victim.minutes = slotMinutes(victim.exercise, victim.progression.steps.find(x => x.exercise === victim.exercise.id)!.target, victim.sets)
  }
  if (!balanced()) warnings.push(`Zug/Druck unausgeglichen (${weekSets('pull')} : ${weekSets('push')} Sätze) – mit Equipment und Budget nicht auszugleichen`)

  /* ── 4. Reihenfolge und Ausgabe ── */
  const blockOf = (c: Candidate): Block => c.kind === 'skill' ? 'skill' : c.meta.pattern === 'core' ? 'core' : c.meta.pattern === 'isolation' ? 'accessory' : 'strength'
  const BLOCK_ORDER: Block[] = ['skill', 'strength', 'core', 'accessory', 'extra']
  const out: PlanDay[] = days.map(d => {
    const slots: PlanSlot[] = plan.get(d)!
      .sort((a, b) => BLOCK_ORDER.indexOf(blockOf(a)) - BLOCK_ORDER.indexOf(blockOf(b)) || b.meta.difficulty - a.meta.difficulty)
      .map(c => ({ progression: c.progression.id, exercise: c.exercise.id, kind: c.kind, block: blockOf(c), sets: c.sets, minutes: c.minutes, reason: c.reason }))
    return { day: d, restBefore: rest.get(d)!, ...(themeOf.get(d) ? { theme: themeOf.get(d)!.name } : {}), slots, minutes: minutesOf(d) }
  })
  return { days: out, warnings }
}
