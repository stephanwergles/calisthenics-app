/* Sprache: Systemsprache, Deutsch oder Englisch – gilt pro Gerät. (Web: LanguagePage) */
import { t as tr, type LocaleChoice } from '@lever/core/i18n/index.ts'
import { Card, Choices, SheetScreen } from '@/ui'
import { useApp } from '@/state/app'

export function LanguagePage() {
  const { localeChoice, changeLocale } = useApp()
  const items = (['system', 'de', 'en'] as const).map(id => ({ id, title: tr(`profile.language.${id}`), on: localeChoice === id }))
  return (
    <SheetScreen title={tr('profile.language.title')} sub={tr('profile.language.sub')}>
      <Card style={{ paddingVertical: 6 }}>
        <Choices mode="radio" items={items} onToggle={id => changeLocale(id as LocaleChoice)} />
      </Card>
    </SheetScreen>
  )
}
