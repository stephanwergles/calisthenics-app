/* Anmeldung als Pflicht: ohne Konto ist das die einzige Route (Auth-Wrapper per Stack.Protected im
   Root-Layout) – Lever sichert und gleicht alles über das Konto ab. Sobald angemeldet, schaltet der
   Wrapper auf die App um. In der Entwicklungs-App (__DEV__) geht es zum Testen auch ohne Konto weiter. */
import { View } from 'react-native'
import { t as tr } from '@lever/core/i18n/index.ts'
import { Button, color, GUTTER } from '@/ui'
import { AccountPage } from '@/screens/profile/account'
import { skipSignIn } from '@/screens/gates'

export default function SignInGate() {
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <AccountPage gate />
      {__DEV__ && (
        <View style={{ paddingHorizontal: GUTTER, paddingBottom: 30 }}>
          <Button variant="ghost" title={tr('profile.gateDevSkip')} onPress={skipSignIn} />
        </View>
      )}
    </View>
  )
}
