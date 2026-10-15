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
  owner: 'offected',
  version: '2.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'lever',
  userInterfaceStyle: 'dark',
  backgroundColor: BG,
  ios: {
    bundleIdentifier: dev ? 'de.offected.lever.dev' : 'de.offected.lever',
    appleTeamId: '3498DS659A',
    // Build-Nummer setzt scripts/ios-release.sh (Zeitstempel) – gilt für App und Widget-Erweiterung
    buildNumber: process.env.BUILD_NUMBER ?? '1',
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    // Sign in with Apple (Capability/Entitlement; der Server prüft das Token: POST /api/auth/apple)
    usesAppleSignIn: true,
    // Universal Links: Konto-Mails (/konto/…) öffnen die App – Gegenstück: /.well-known/apple-app-site-association
    // (Entwicklungs-App: mode=developer umgeht Apples Zwischenspeicher)
    associatedDomains: [`applinks:${new URL(process.env.EXPO_PUBLIC_API_URL ?? 'https://calisthenics.apps.blank-studio.de').host}${dev ? '?mode=developer' : ''}`],
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
    'expo-apple-authentication',
    ['expo-notifications', { color: '#D4FF3A' }],
    // Live Activity (Sperrbildschirm/Dynamic Island) – das Layout registriert src/live/session-activity.tsx zur Laufzeit
    ['expo-widgets', {}],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    eas: { projectId: '993ef6ae-3e63-4ab5-8ac0-8ff909413a80' },
    /** Server für Anmeldung und Sync */
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://calisthenics.apps.blank-studio.de',
  },
}

export default config
