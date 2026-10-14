/* Navigation: Präsentationsarten und Header-Bausteine an einer Stelle.
   - formSheet: Aufgabe mit Detents (Satz erfassen, Phase, Cardio) – Hintergrund Liquid Glass (iOS 26)
   - modal: großes Sheet (iOS pageSheet), darin ggf. eigener Stack mit Push-Seiten
   - stackScreenOptions: Push-Seiten mit transparentem nativen Header → Zurück ist der echte
     Glas-Button von iOS, Titel steht im Inhalt (Display-Schrift)
   - CloseButton / HeaderButton: native Toolbar-Buttons (Glas) oben rechts */
import { Platform } from 'react-native'
import { router, Stack, useNavigation } from 'expo-router'
import type { NativeStackNavigationOptions } from 'expo-router'
import { t } from '@lever/core/i18n/index.ts'
import { color, font } from '@/ui/theme'
import { sf, type IconName } from '@/ui/icon'

export const formSheet = (detents: number[] = [0.6, 1]): NativeStackNavigationOptions => ({
  presentation: 'formSheet',
  sheetGrabberVisible: true,
  sheetAllowedDetents: detents,
  contentStyle: { backgroundColor: Platform.OS === 'ios' ? 'transparent' : color.card },
  headerShown: false,
})

export const modal = (): NativeStackNavigationOptions => ({
  presentation: 'modal',
  headerShown: false,
  contentStyle: { backgroundColor: color.bg },
})

/** Modal ohne eigenen Stack, aber mit transparentem nativen Kopf für Glas-Buttons (Schließen,
    Zurück) – im Root-Layout gesetzt; Optionen aus dem Screen selbst greifen hier nicht zuverlässig */
export const modalWithHeader = (): NativeStackNavigationOptions => ({
  ...modal(),
  headerShown: true,
  headerTransparent: true,
  headerShadowVisible: false,
  title: '',
  headerTitle: '',
  headerBackButtonDisplayMode: 'minimal',
  headerTintColor: color.text,
})

/** für Stacks in Modals und Tabs: transparenter Header, nur Glas-Zurück ohne Text */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerTransparent: true,
  headerShadowVisible: false,
  title: '',
  headerTitle: '',
  headerBackButtonDisplayMode: 'minimal',
  headerTintColor: color.text,
  contentStyle: { backgroundColor: color.bg },
}

/** Glas-Button oben rechts im nativen Header (iOS-Toolbar) */
export function HeaderButton({ icon, onPress, label, prominent }: { icon: IconName; onPress: () => void; label: string; prominent?: boolean }) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button icon={sf(icon) as never} onPress={onPress} accessibilityLabel={label} variant={prominent ? 'prominent' : 'plain'}
        tintColor={prominent ? color.accent : undefined} />
    </Stack.Toolbar>
  )
}

/** Schließen (Modal ganz zu) */
export function CloseButton({ onPress }: { onPress?: () => void }) {
  return <HeaderButton icon="close" label={t('common.close')} onPress={onPress ?? (() => router.dismiss())} />
}

/** Schließen nur, wenn die Seite die erste im Modal-Stack ist (direkt geöffnet, z. B. /profile/days);
    weiter hinten gibt es das native Zurück */
export function CloseIfRoot() {
  const nav = useNavigation()
  if ((nav.getState()?.index ?? 0) !== 0) return null
  return <CloseButton />
}

/** Kopf der Tab-Seiten: großer iOS-Titel (Barlow Condensed), der beim Scrollen klein und sticky
    wird, rechts der Profil-Button. Die ScrollView muss das erste Element der Seite sein. */
export function TabHeader({ title, syncError }: { title: string; syncError?: boolean }) {
  return (
    <>
      <Stack.Screen options={{
        title: title.toUpperCase(),
        headerTitle: title.toUpperCase(),
        headerLargeTitleEnabled: true,
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeTitleStyle: { fontFamily: font.displayBlack, fontSize: 42, color: color.text },
        headerTitleStyle: { fontFamily: font.display, fontSize: 20, color: color.text },
      }} />
      <HeaderButton icon={syncError ? 'warning' : 'user'} label={t('app.profileButton', { status: '' })} onPress={() => router.push('/profile')} />
    </>
  )
}
