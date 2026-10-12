import type { CapacitorConfig } from '@capacitor/cli'

/* iOS-Hülle: die Oberfläche liegt im App-Paket (native/www, erzeugt von scripts/native-web.ts),
   der Sync geht an die Live-Instanz. Details in README.md, Abschnitt „iOS-App“. */
const config: CapacitorConfig = {
  appId: 'de.blankstudio.calisthenics',
  appName: 'Calisthenics',
  webDir: 'native/www',
  backgroundColor: '#101010',
  ios: { contentInset: 'never', backgroundColor: '#101010', scheme: 'Calisthenics' },
  plugins: {
    LocalNotifications: { presentationOptions: ['banner', 'sound'] },
  },
}

export default config
