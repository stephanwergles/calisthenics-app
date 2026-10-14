/* Anmeldung als Pflicht (Vollbild, nicht wegwischbar): ohne Konto keine Trainingsdaten – Lever
   sichert und gleicht alles über das Konto ab. Schließt sich selbst, sobald angemeldet. In der
   Entwicklungs-App (Metro, __DEV__) geht es zum Testen auch ohne Konto weiter. */
import { useEffect } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, color, GUTTER } from '@/ui'
import { AccountPage } from '@/screens/profile/account'
import { skipSignIn } from '@/screens/gates'

export default function SignInGate() {
  const { t } = useApp()
  useEffect(() => { if (t.sync.account) router.back() }, [t.sync.account])
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <AccountPage gate />
      {__DEV__ && (
        <View style={{ paddingHorizontal: GUTTER, paddingBottom: 30 }}>
          <Button variant="ghost" title={tr('profile.gateDevSkip')} onPress={() => { skipSignIn(); router.back() }} />
        </View>
      )}
    </View>
  )
}
