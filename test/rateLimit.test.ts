import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLimiter } from '../src/sync/rateLimit.ts'

test('Bremse: höchstens limit Anfragen im Fenster, danach wieder frei', () => {
  let t = 0
  const l = createLimiter(3, 1000, () => t)
  assert.deepEqual([l.take('a'), l.take('a'), l.take('a'), l.take('a')], [true, true, true, false])
  assert.equal(l.take('b'), true, 'andere Person unabhängig')
  assert.equal(l.retryAfter('a'), 1)
  t = 1001
  assert.equal(l.take('a'), true, 'nach dem Fenster wieder frei')
})

test('Adresse hinter nginx: X-Real-IP, sonst letzter X-Forwarded-For-Eintrag', async () => {
  const { clientIp } = await import('../src/sync/rateLimit.ts')
  assert.equal(clientIp(new Headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' })), '1.2.3.4')
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '6.6.6.6, 5.5.5.5' })), '5.5.5.5', 'vordere Einträge sind fälschbar')
  assert.equal(clientIp(new Headers()), null)
  assert.equal(clientIp(undefined), null)
})
