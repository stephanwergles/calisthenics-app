/* Vorlagen: Kurzbeschreibung (Niveau · Tage · Minuten) und Ausrüstung */
import type { Template } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'

export const templateMeta = (tp: Template) => [L.LEVEL_LABEL[tp.level], tp.days ? tr('plan.templates.perWeek', { n: tp.days }) : null, tr('plan.templates.minutes', { n: tp.minutes })]
  .filter(Boolean).join(' · ')

export const templateGear = (tp: Template) => tp.equipment.length
  ? tp.equipment.map(e => L.EQUIPMENT_LABEL[e as keyof typeof L.EQUIPMENT_LABEL] ?? e).join(', ') : tr('plan.templates.noGear')
