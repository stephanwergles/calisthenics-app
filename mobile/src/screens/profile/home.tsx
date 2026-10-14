/* Profil: Statistik, gruppierte Listen wie die iOS-Einstellungen (Training, App, Konto & Sync,
   Daten, Hilfe, Rechtliches), unten Wortmarke + Version. Einzelne Bereiche als Push-Seiten.
   (Web: ProfileSheet, DataView) */
import { useState } from 'react'
import { View } from 'react-native'
import { router, type Href } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import { HEALTH_CONSENT } from '@lever/core/consent.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { ask, Button, Card, color, font, ListGroup, SheetScreen, Text, Wordmark } from '@/ui'
import { CloseButton } from '@/navigation'
import { useApp } from '@/state/app'
import { confirmDeleteAccount, openPrivacy } from './account'
import { GroupLabel } from './parts'
import { APP_VERSION, manualSync, profileSummary, syncStatus } from './shared'

const go = (path: string) => () => router.push(path as Href)

export function ProfileHome() {
  const { t, localeChoice } = useApp()
  const s = t.sync
  const sets = t.sessions.reduce((n, x) => n + x.sets.length, 0)
  const sum = profileSummary(t)
  const syncing = s.phase === 'syncing'
  const [dataMsg, setDataMsg] = useState<{ text: string; warn?: boolean } | null>(null)

  const exportJson = async () => {
    try {
      const file = new File(Paths.cache, `calisthenics-v2-${t.today}.json`)
      if (file.exists) file.delete()
      file.create()
      file.write(JSON.stringify(t.exportData(), null, 2))
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: tr('profile.export') })
      toast(tr('common.toast.exported'), 'success')
    } catch (e) { toast(tr('profile.exportFailed', { msg: (e as Error).message }), 'error') }
  }
  const importV1 = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true })
      if (r.canceled || !r.assets[0]) return
      const v1 = JSON.parse(await new File(r.assets[0].uri).text())
      if (!v1 || typeof v1.log !== 'object') throw new Error(tr('profile.v1.notV1'))
      if (!await ask({ title: tr('profile.v1.askTitle'), message: tr('profile.v1.askMessage'), ok: tr('common.apply') })) return
      const res = await t.importV1(v1)
      toast(tr('common.toast.imported'), 'success')
      setDataMsg({ text: [
        tr('profile.v1.imported', { sessions: res.sessions, sets: res.sets, activities: res.activities }),
        ...(res.dropped.length ? [tr('profile.v1.dropped', { n: res.dropped.length })] : []),
        ...res.warnings.map(w => tr('profile.v1.hint1', { msg: w })),
      ].join('\n') })
    } catch (e) { setDataMsg({ text: tr('profile.v1.failed', { msg: (e as Error).message }), warn: true }) }
  }

  return (
    <>
      <CloseButton />
      <SheetScreen title={tr('profile.title')} sub={s.account ? `${s.account.email} · ${syncStatus(s)}` : tr('profile.localOnly')}>
        {/* Statistik */}
        <Card style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 18 }}>
          {[[t.sessions.length, tr('profile.stats.sessions')], [sets, tr('profile.stats.sets')], [t.activities.length, tr('profile.stats.cardio')]].map(([v, label]) => (
            <View key={String(label)} style={{ alignItems: 'center', gap: 2 }} accessible accessibilityLabel={`${v} ${label}`}>
              <Text variant="num" selectable>{v}</Text>
              <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 }}>{label}</Text>
            </View>
          ))}
        </Card>
        {!t.persistent && <Text variant="small" style={{ color: color.danger }}>{tr('profile.notPersistent')}</Text>}

        <GroupLabel title={tr('profile.section.training')} />
        <ListGroup rows={[
          { title: tr('profile.row.goals'), subtitle: sum.goals, icon: 'target', onPress: () => { router.dismissAll(); router.navigate('/skills') } },
          { title: tr('profile.row.equipment'), subtitle: sum.equipment, icon: 'dumbbell', onPress: go('/profile/equipment') },
          { title: tr('profile.row.days'), subtitle: sum.days, icon: 'calendar', onPress: go('/profile/days') },
          { title: tr('profile.row.assessment'), subtitle: sum.assessment, icon: 'gauge', onPress: go('/profile/assessment') },
        ]} />

        <GroupLabel title={tr('profile.section.app')} />
        <ListGroup rows={[{ title: tr('profile.row.language'), trailing: tr(`profile.language.${localeChoice}`), icon: 'globe', onPress: go('/profile/language') }]} />

        <GroupLabel title={tr('profile.section.account')} />
        {s.account ? (
          <>
            {s.consentMissing && (
              <Card>
                <Text variant="body" style={{ color: color.danger }}>{tr('profile.consentPaused')}</Text>
                <Button variant="primary" title={HEALTH_CONSENT.ok} onPress={() => void t.acceptHealthConsent().catch(e => toast((e as Error).message, 'error'))} />
              </Card>
            )}
            <ListGroup rows={[{ title: tr('profile.accountRow'), subtitle: `${s.account.email}\n${syncStatus(s)}`, icon: 'user', onPress: go('/profile/account') }]} />
            <Button icon="sync" title={syncing ? tr('profile.sync.syncing') : tr('profile.syncNow')} busy={syncing} onPress={() => void manualSync(t)} />
          </>
        ) : (
          <ListGroup rows={[{ title: tr('profile.signInRow'), subtitle: tr('profile.signInRowSub'), icon: 'user', onPress: go('/profile/account') }]} />
        )}

        <GroupLabel title={tr('profile.section.data')} />
        <ListGroup rows={[
          { title: tr('profile.export'), icon: 'share', onPress: () => void exportJson() },
          { title: tr('profile.importV1'), subtitle: tr('profile.v1.hint'), icon: 'import', onPress: () => void importV1() },
        ]} />
        {dataMsg && <Text variant="small" accessibilityLiveRegion="polite" style={{ color: dataMsg.warn ? color.danger : color.muted, marginLeft: 4 }}>{dataMsg.text}</Text>}

        <GroupLabel title={tr('profile.section.help')} />
        <ListGroup rows={[{ title: tr('profile.feedbackRow.title'), subtitle: tr('profile.feedbackRow.sub'), icon: 'feedback', onPress: go('/profile/feedback') }]} />

        <GroupLabel title={tr('profile.section.legal')} />
        <ListGroup rows={[{ title: tr('common.privacy'), icon: 'privacy', onPress: openPrivacy }]} />
        {s.account && <ListGroup rows={[{ title: tr('profile.deleteAccount'), icon: 'trash', danger: true, onPress: () => void confirmDeleteAccount(t) }]} />}

        {/* Marke und Version – Erkennungszeichen, welcher Stand läuft */}
        <View style={{ alignItems: 'center', gap: 8, marginTop: 28 }} accessible accessibilityLabel={`Lever ${tr('profile.footer', { v: APP_VERSION })}`}>
          <Wordmark height={18} />
          <Text variant="small" selectable>{tr('profile.footer', { v: APP_VERSION })}</Text>
        </View>
      </SheetScreen>
    </>
  )
}
