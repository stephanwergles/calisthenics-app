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

/** Hinweis mit einem Button */
export function notice(title: string, message?: string) {
  Alert.alert(title, message)
}
