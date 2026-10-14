/* Ausrüstung: Geräte als Kacheln mit Bild (Standbild einer Übung, die das Gerät zeigt) und einem
   Satz Erklärung. Boden und Wand gelten immer. (Web: EquipmentSheet) */
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import type { Equipment } from '@lever/domain/model.ts'
import { SheetScreen } from '@/ui'
import { useApp } from '@/state/app'
import { NextFooter, Tiles, type Tile } from './parts'
import { blurb, useProfile, type Next } from './shared'

/** Bild je Gerät: Übung, die es zeigt; ohne Übung ein Symbol */
const GEAR_ART: Partial<Record<Equipment, string>> = {
  bar: 'pull-up', rings: 'ring-push-up', parallettes: 'l-sit-parallettes', 'dip-bars': 'dip', band: 'muscle-up-band',
  box: 'pike-push-up-elevated', weight: 'dip-weighted', pole: '',
}

export function EquipmentPage({ next }: { next?: Next }) {
  const { t } = useApp()
  const { profile, change } = useProfile(t)
  const items = (Object.entries(L.EQUIPMENT_LABEL) as [Equipment, string][]).map(([id, title]): Tile => ({
    id, title, subtitle: blurb(`profile.equipment.blurb.${id}`), exercise: t.ix.exercises.get(GEAR_ART[id] ?? ''), icon: 'figure',
    on: profile.equipment.includes(id),
  }))
  const toggle = (id: string, on: boolean) => change(p => ({
    ...p, equipment: on ? [...new Set([...p.equipment, id as Equipment])] : p.equipment.filter(e => e !== id),
  }))
  return (
    <SheetScreen title={tr('profile.row.equipment')} sub={tr('profile.equipment.sub')} footer={next ? <NextFooter next={next} /> : undefined}>
      <Tiles items={items} onToggle={toggle} />
    </SheetScreen>
  )
}
