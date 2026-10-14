/* Rückfrage vor folgenreichen Aktionen (wie ask() im Web): natives Alert, liefert true bei OK. */
import { Alert } from 'react-native'
import { t } from '@lever/core/i18n/index.ts'

export function ask(o: { title: string; message?: string; ok: string; destructive?: boolean; cancel?: string }): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(o.title, o.message, [
      { text: o.cancel ?? t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: o.ok, style: o.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  })
}

/** Auswahl aus mehreren Aktionen (Alert mit Buttons; auf iOS 26 als Glas-Dialog) – liefert die
    gewählte id oder null bei Abbruch */
export function choose<T extends string>(o: { title: string; message?: string; options: { id: T; title: string; destructive?: boolean }[]; cancel?: string }): Promise<T | null> {
  return new Promise(resolve => {
    Alert.alert(o.title, o.message, [
      ...o.options.map(x => ({ text: x.title, style: x.destructive ? 'destructive' as const : 'default' as const, onPress: () => resolve(x.id) })),
      { text: o.cancel ?? t('common.cancel'), style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) })
  })
}

/** Hinweis mit einem Button */
export function notice(title: string, message?: string) {
  Alert.alert(title, message)
}
