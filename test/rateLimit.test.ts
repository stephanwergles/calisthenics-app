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
