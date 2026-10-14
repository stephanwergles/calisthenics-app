/* Cardio anlegen, bearbeiten, löschen (Route activity, natives formSheet mit Liquid Glass).
   Params: date (YYYY-MM-DD), optional id (bearbeiten), optional from=day (geöffnet aus dem Tag im
   Verlauf – nach dem Löschen schließen dann beide). (Web: ActivitySheet in Sheets.tsx) */
import { useState } from 'react'
import { Platform, ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { platform } from '@lever/core/platform.ts'
import type { Activity } from '@lever/domain/model.ts'
import { useApp } from '@/state/app'
import { Button, ButtonRow, color, GUTTER, Segmented, space, Stepper, Text } from '@/ui'
import { confirmRemoveActivity } from './actions'

type Kind = Activity['kind']

export function ActivityEditor() {
  const { t } = useApp()
  const insets = useSafeAreaInsets()
  const p = useLocalSearchParams<{ date?: string; id?: string; from?: string }>()
  const existing = p.id ? t.activities.find(a => a.id === p.id) : undefined
  const date = existing?.date ?? (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : t.today)
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'run')
  const [min, setMin] = useState(existing?.durationMin ?? 20)
  const [km, setKm] = useState(existing?.distanceKm ?? 0)
  const [hm, setHm] = useState(existing?.elevationM ?? 0)

  const kinds: { id: Kind; title: string }[] = [
    { id: 'run', title: tr('logic.activity.run') },
    { id: 'ride', title: tr('logic.activity.ride') },
    // „Workout“ (z. B. Cindy) legt das Formular nicht an, ein vorhandener Eintrag behält die Art
    ...(existing?.kind === 'workout' ? [{ id: 'workout' as const, title: tr('logic.activity.workout') }] : []),
  ]

  const save = () => {
    // Zeitstempel statt laufender Nummer: nach dem Löschen eines Eintrags würde eine Nummer kollidieren
    const base: Activity = existing ?? { id: `${date}-${kind}-${Date.now().toString(36)}`, date, kind }
    const { distanceKm: _k, elevationM: _h, ...rest } = base
    t.addActivity({ ...rest, kind, durationMin: min, ...(km ? { distanceKm: km } : {}), ...(hm ? { elevationM: hm } : {}) })
    platform().signals.haptic('success')
    router.back()
  }
  const remove = async () => {
    if (!existing || !(await confirmRemoveActivity(t, existing))) return
    if (p.from === 'day') router.dismiss(2)
    else router.back()
  }

  const num = (n: number) => L.fmtNum(n)
  return (
    <View style={{ flex: 1, backgroundColor: Platform.OS === 'ios' ? 'transparent' : color.card }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 28, paddingBottom: 16, gap: space.md }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4, marginBottom: 4 }}>
          <Text variant="display" accessibilityRole="header">{existing ? tr('history.cardioEdit') : tr('sheets.cardio.title')}</Text>
          <Text variant="muted">{L.fmtDate(date)}</Text>
        </View>
        <Segmented<Kind> label={tr('sheets.cardio.kind')} options={kinds} value={kind} onChange={setKind} />
        <Stepper label={tr('sheets.cardio.minutes')} value={num(min)}
          onMinus={() => setMin(v => Math.max(5, v - 5))} onPlus={() => setMin(v => v + 5)} />
        <Stepper label={tr('sheets.cardio.km')} value={num(km)}
          onMinus={() => setKm(v => Math.max(0, +(v - 1).toFixed(1)))} onPlus={() => setKm(v => +(v + 1).toFixed(1))} />
        <Stepper label={tr('sheets.cardio.elevation')} value={num(hm)}
          onMinus={() => setHm(v => Math.max(0, v - 50))} onPlus={() => setHm(v => v + 50)} />
      </ScrollView>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 4, gap: 10 }}>
        <ButtonRow>
          <Button style={{ flex: 1 }} title={tr('common.cancel')} onPress={() => router.back()} />
          <Button style={{ flex: 2 }} variant="primary" icon="check" title={tr('common.save')} onPress={save} />
        </ButtonRow>
        {existing && <Button variant="danger" icon="trash" block title={tr('history.deleteActivity')} onPress={() => void remove()} />}
      </View>
    </View>
  )
}
