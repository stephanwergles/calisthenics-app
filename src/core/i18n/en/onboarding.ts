/* English: onboarding */
import type { Shape } from '..'
import type { onboarding as de } from '../de/onboarding'

export const onboarding: Shape<typeof de> = {
  step: { welcome: 'Welcome', assessment: 'Assessment', goals: 'Goals', equipment: 'Equipment', days: 'Days', suggestion: 'Plan' },
  title: 'Welcome to Lever',
  subtitle: 'Calisthenics with a plan – every exercise is a step on the way to your skill.',
  intro: 'Two ways to your plan: build it from your goals in five short steps (quick test, goals, equipment, days) – or pick a ready-made plan from the library. You can change everything later.',
  fromGoals: 'Build from my goals',
  library: 'Pick a ready-made plan',
  skip: 'Skip – use the default plan',
  suggest: 'Suggest a plan',
  skipStep: 'Skip',
}
