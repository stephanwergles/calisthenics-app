// zuerst: Plattform-Adapter für den gemeinsamen Kern registrieren (Speicher, Token, Netz …)
import '@/platform'
import { useEffect } from 'react'
import { DarkTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useFonts } from 'expo-font'
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold } from '@expo-google-fonts/barlow'
import {
  BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, BarlowCondensed_900Black,
} from '@expo-google-fonts/barlow-condensed'
import { AppProvider, useApp } from '@/state/app'
import { Gates } from '@/screens/gates'
import { color, Toaster } from '@/ui'
import { formSheet, modal, modalWithHeader } from '@/navigation'

void SplashScreen.preventAutoHideAsync()

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.bg, card: color.card, primary: color.accent, text: color.text, border: color.line },
}

export default function RootLayout() {
  const [fonts] = useFonts({
    Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold,
    BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, BarlowCondensed_900Black,
  })
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <AppProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <Root fonts={fonts} />
        </ThemeProvider>
      </AppProvider>
    </GestureHandlerRootView>
  )
}

function Root({ fonts }: { fonts: boolean }) {
  const { t } = useApp()
  const ready = fonts && t.loaded
  useEffect(() => { if (ready) void SplashScreen.hideAsync() }, [ready])
  if (!ready) return null
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
        <Stack.Screen name="(tabs)" />
        {/* Training: Vollbild, nach unten wegwischbar (minimieren); Session-Leiste bleibt als Mini-Player */}
        <Stack.Screen name="training" options={{ presentation: 'fullScreenModal', gestureEnabled: true, gestureDirection: 'vertical' }} />
        {/* Aufgaben-Sheets */}
        <Stack.Screen name="set" options={formSheet([0.62, 1])} />
        <Stack.Screen name="exercise" options={formSheet([0.6, 1])} />
        <Stack.Screen name="activity" options={formSheet([0.7, 1])} />
        <Stack.Screen name="phase" options={formSheet([0.62, 1])} />
        <Stack.Screen name="swap" options={formSheet([0.55, 1])} />
        <Stack.Screen name="exercises" options={modalWithHeader()} />
        <Stack.Screen name="progression/[pid]" options={modalWithHeader()} />
        <Stack.Screen name="day/[id]" options={modalWithHeader()} />
        <Stack.Screen name="summary/[id]" options={{ ...modal(), gestureEnabled: true }} />
        <Stack.Screen name="suggestion" options={modalWithHeader()} />
        {/* Bereiche mit eigener Push-Navigation (Stack im Modal) */}
        <Stack.Screen name="profile" options={modal()} />
        <Stack.Screen name="templates" options={modal()} />
        <Stack.Screen name="workouts" options={modal()} />
        <Stack.Screen name="challenges" options={modal()} />
        {/* Challenge im Vollbild – kein Wegwischen mitten im Versuch */}
        <Stack.Screen name="challenge-run" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="circuit-run" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ ...modal(), gestureEnabled: false }} />
        <Stack.Screen name="consent" options={{ ...modal(), gestureEnabled: false }} />
        <Stack.Screen name="signin" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
      <Gates />
      <Toaster />
    </>
  )
}
