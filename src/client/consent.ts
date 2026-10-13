/* Einwilligung (Art. 9 DSGVO) und Gesundheits-Hinweis. Neue Textfassung = Version hochzählen,
   dann fragt die App erneut. Texte: ENTWURF – vor dem Store-Release rechtlich prüfen lassen.
   Die Texte selbst stehen im Wörterbuch (i18n/<sprache>/profile.ts: disclaimer, health);
   die Getter lesen immer in der aktuellen Sprache. */
import { t } from './i18n'

export const HEALTH_CONSENT_VERSION = '2026-10-13'
export const DISCLAIMER_VERSION = '2026-10-13'
export const PRIVACY_URL = 'https://calisthenics.apps.blank-studio.de/datenschutz'

export const DISCLAIMER = {
  get title() { return t('profile.disclaimer.title') },
  get text() { return t('profile.disclaimer.text') },
  get ok() { return t('profile.disclaimer.ok') },
}

export const HEALTH_CONSENT = {
  get title() { return t('profile.health.title') },
  get text() { return t('profile.health.text') },
  get short() { return t('profile.health.short') },
  get ok() { return t('profile.health.ok') },
}
