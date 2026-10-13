/* Rechte: Katalog nur für Admins änderbar, Personen sehen nur sich selbst, Rolle nur durch Admins */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as A from '../src/access.ts'

const req = (user: unknown) => ({ req: { user } }) as never
const admin = { id: 1, role: 'admin' }, athlete = { id: 2, role: 'athlete' }

test('Katalog: lesen angemeldet, ändern nur Admin', () => {
  assert.equal(A.loggedIn(req(athlete)), true)
  assert.equal(A.loggedIn(req(null)), false)
  assert.equal(A.isAdmin(req(admin)), true)
  assert.equal(A.isAdmin(req(athlete)), false)
  assert.equal(A.isAdmin(req({ id: 3 })), false, 'ohne Rolle kein Admin')
  assert.equal(A.isAdmin(req(null)), false)
})

test('Personen: nur sich selbst, Admin alle; Admin-Panel nur Admin', () => {
  assert.deepEqual(A.selfOrAdmin(req(athlete)), { id: { equals: 2 } })
  assert.equal(A.selfOrAdmin(req(admin)), true)
  assert.equal(A.selfOrAdmin(req(null)), false)
  assert.equal(A.adminPanel(req(admin)), true)
  assert.equal(A.adminPanel(req(athlete)), false)
})

test('Rolle: nur Admins dürfen sie setzen', () => {
  assert.equal(A.adminField(req(admin)), true)
  assert.equal(A.adminField(req(athlete)), false)
})

test('Nutzerdaten gehören immer der anfragenden Person', () => {
  const data = { user: 99 }
  A.setOwner({ req: { user: athlete }, operation: 'create', data } as never)
  assert.equal(data.user, 2, 'fremde Besitzer-ID wird überschrieben')
  assert.deepEqual(A.ownDocs(req(athlete)), { user: { equals: 2 } })
})
