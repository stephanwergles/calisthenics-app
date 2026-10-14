/* Eine Challenge: Clip der Übung, Vorgabe, Bestwert, Los, bisherige Versuche (antippen = löschen) */
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { ask, Button, Card, color, ExerciseMedia, font, Icon, SheetScreen, Text } from '@/ui'
import { ModalToolbar, Rows, Section, useIsFirst } from '@/screens/plan/parts'

export default function ChallengeScreen() {
  const { t } = useApp()
  const first = useIsFirst()
  const { id } = useLocalSearchParams<{ id: string }>()
  const c = catalogData(t.ix.catalog).challenges.find(x => x.id === id)
  if (!c) return <SheetScreen title={tr('skills.notFound')} />
  const ex = c.exercise ? t.ix.exercises.get(c.exercise) : undefined
  const attempts = L.challengeAttempts(t.activities, c.id)
  const best = L.challengeBest(c, t.activities)
  const remove = async (aid: string) => {
    if (await ask({ title: tr('challenge.deleteTitle'), message: tr('challenge.deleteMessage'), ok: tr('challenge.delete'), destructive: true })) t.removeActivity(aid)
  }
  return (
    <>
      <ModalToolbar close={first} />
      <SheetScreen title={c.name} sub={L.fmtChallengeRule(c)}
        footer={<Button variant="primary" size="lg" icon="play" title={tr('challenge.start')} onPress={() => router.push({ pathname: '/challenge-run', params: { id: c.id } })} />}>
        {ex && <ExerciseMedia exercise={ex} style={{ width: '100%', aspectRatio: 1.3 }} />}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Icon name="trophy" size={24} color={best ? color.accent : color.muted} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="eyebrow">{tr('challenge.best')}</Text>
            <Text style={{ fontFamily: font.displayBlack, fontSize: 34, lineHeight: 36, color: color.text, fontVariant: ['tabular-nums'] }}>
              {best ? L.fmtChallengeValue(c, best.value!) : '–'}
            </Text>
            <Text variant="small">{best ? L.fmtDate(best.date) : tr('challenge.noBest')}</Text>
          </View>
        </Card>
        {attempts.length > 0 && <>
          <Section title={tr('challenge.attempts')} />
          <Rows rows={attempts.map(a => ({
            key: a.id, title: L.fmtChallengeValue(c, a.value!), subtitle: [L.fmtDate(a.date), a.note].filter(Boolean).join(' · '),
            tag: a.id === best?.id ? tr('challenge.best') : undefined, label: `${L.fmtChallengeValue(c, a.value!)}, ${L.fmtDate(a.date)}. ${tr('challenge.delete')}`,
            onPress: () => void remove(a.id),
          }))} />
        </>}
      </SheetScreen>
    </>
  )
}
