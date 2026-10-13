/* Übungs-Metadaten (Geräte, Muster, Sehnenbelastung) für Phasen und Planvorschläge */
import type { ExerciseMeta } from '@/domain/model'
import metaJson from '@/seed/exercise-meta.json'

export const META = (metaJson as unknown as { exercises: Record<string, ExerciseMeta> }).exercises
