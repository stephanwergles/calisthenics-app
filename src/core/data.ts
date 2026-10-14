/* Daten für Ziele, Planvorschläge, Phasen und Einstufung: aus dem Katalog vom Server (im
   Admin-Panel gepflegt), solange keiner da ist (offline, ältere Server) die mitgelieferten Seed-Daten. */
import type { AssessmentData, Catalog, ExerciseMeta, Skill, SplitTemplate, Template } from '../domain/model.ts'
import metaJson from '../seed/exercise-meta.json'
import skillsJson from '../seed/skills.json'
import splitsJson from '../seed/splits.json'
import assessmentJson from '../seed/assessment.json'
import templatesJson from '../seed/templates.json'

const BUNDLED = {
  meta: (metaJson as unknown as { exercises: Record<string, ExerciseMeta> }).exercises,
  skills: (skillsJson as unknown as { skills: Skill[] }).skills,
  splits: (splitsJson as unknown as { splits: SplitTemplate[] }).splits,
  assessment: assessmentJson as unknown as AssessmentData,
  templates: (templatesJson as unknown as { templates: Template[] }).templates,
}

export interface CatalogData { meta: Record<string, ExerciseMeta>; skills: Skill[]; splits: SplitTemplate[]; assessment: AssessmentData; templates: Template[] }

const cache = new WeakMap<Catalog, CatalogData>()
export function catalogData(c: Catalog): CatalogData {
  let d = cache.get(c)
  if (!d) {
    d = {
      meta: c.meta && Object.keys(c.meta).length ? c.meta : BUNDLED.meta,
      skills: c.skills?.length ? c.skills : BUNDLED.skills,
      splits: c.splits?.length ? c.splits : BUNDLED.splits,
      assessment: c.assessment?.tests.length ? c.assessment : BUNDLED.assessment,
      templates: c.templates?.length ? c.templates : BUNDLED.templates,
    }
    cache.set(c, d)
  }
  return d
}
