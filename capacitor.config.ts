import type { CapacitorConfig } from '@capacitor/cli'

/* iOS-Hülle: die Oberfläche liegt im App-Paket (native/www, erzeugt von scripts/native-web.ts),
   der Sync geht an die Live-Instanz. Details in README.md, Abschnitt „iOS-App“. */
const config: CapacitorConfig = {
  appId: 'de.blank-studio.lever',
  appName: 'Lever',
  webDir: 'native/www',
  backgroundColor: '#101010',
  ios: { contentInset: 'never', backgroundColor: '#101010' },
  plugins: {
    LocalNotifications: { presentationOptions: ['banner', 'sound'] },
  },
}

export default config
