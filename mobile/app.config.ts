/* Expo-Konfiguration der Lever-App. Bundle-ID wie die bisherige Capacitor-App: die Expo-App
   ersetzt sie als nächste Version derselben App. Für die Entwicklung (APP_VARIANT=development)
   eigene ID, damit Simulator/Gerät beide Apps nebeneinander haben können. */
import type { ExpoConfig } from 'expo/config'
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('./scripts/media.js').generate()   // Clip-Tabelle aktuell halten

const dev = process.env.APP_VARIANT === 'development'
const BG = '#101010'

const config: ExpoConfig = {
  name: dev ? 'Lever Dev' : 'Lever',
  slug: 'lever',
  version: '2.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'lever',
  userInterfaceStyle: 'dark',
  backgroundColor: BG,
  ios: {
    bundleIdentifier: dev ? 'de.offected.lever.dev' : 'de.offected.lever',
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    infoPlist: { CFBundleDisplayName: dev ? 'Lever Dev' : 'Lever' },
  },
  android: {
    package: dev ? 'de.offected.lever.dev' : 'de.offected.lever',
    adaptiveIcon: { backgroundColor: BG, foregroundImage: './assets/splash.png' },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: BG, image: './assets/splash.png', imageWidth: 224 }],
    'expo-sqlite',
    'expo-secure-store',
    'expo-localization',
    ['expo-audio', { microphonePermission: false }],
    'expo-video',
    'expo-sharing',
    ['expo-notifications', { color: '#D4FF3A' }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    /** Server für Anmeldung und Sync */
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://calisthenics.apps.blank-studio.de',
  },
}

export default config
