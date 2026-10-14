/* Entwurf eines Runden-Blocks, solange er bearbeitet wird: geteilt zwischen Editor
   (workouts/circuit) und Übungsauswahl (workouts/circuit-add). Erst „Speichern“ schreibt in den
   Plan – ein halbfertiger Block (ohne Übung) wäre für den Sync ungültig. */
import { useSyncExternalStore } from 'react'
import type { Circuit } from '@lever/domain/model.ts'

let draft: Circuit | null = null
const subs = new Set<() => void>()

export const circuitDraft = {
  get: () => draft,
  set(next: Circuit | null) { draft = next; subs.forEach(f => f()) },
  update(fn: (c: Circuit) => Circuit) { if (draft) circuitDraft.set(fn(draft)) },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } },
}

export const useCircuitDraft = () => useSyncExternalStore(circuitDraft.subscribe, circuitDraft.get)
