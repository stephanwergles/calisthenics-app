/* Vier Tabs als echte native Tab-Leiste (iOS 26 Liquid Glass): Heute · Plan · Skills · Log.
   Über der Leiste die laufende Session als Mini-Player (BottomAccessory). Punkt am Plan-Tab,
   solange ein Planvorschlag auf Bestätigung wartet. */
import { NativeTabs } from 'expo-router/native-tabs'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { SessionBar } from '@/components/session-bar'
import { color, md, sf } from '@/ui'

export default function TabsLayout() {
  const { t, ps } = useApp()
  return (
    <NativeTabs tintColor={color.accent} minimizeBehavior="onScrollDown" labelStyle={{ fontFamily: 'Barlow_600SemiBold' }}>
      {t.active ? (
        <NativeTabs.BottomAccessory>
          <Accessory />
        </NativeTabs.BottomAccessory>
      ) : null}
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Label>{tr('app.tab.train')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={sf('today') as never} md={md('today') as never} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(plan)">
        <NativeTabs.Trigger.Label>{tr('app.tab.plan')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={sf('plan') as never} md={md('plan') as never} />
        {ps.suggestion ? <NativeTabs.Trigger.Badge> </NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(skills)">
        <NativeTabs.Trigger.Label>{tr('app.tab.skills')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={sf('skills') as never} md={md('skills') as never} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(log)">
        <NativeTabs.Trigger.Label>{tr('app.tab.history')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={sf('history') as never} md={md('history') as never} />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

function Accessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement()
  return <SessionBar compact={placement === 'inline'} />
}
