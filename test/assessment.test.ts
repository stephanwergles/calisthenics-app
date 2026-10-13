import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Catalog, Skill, SplitTemplate } from '../src/domain/model.ts'
import { placement, suggestSkills, suggestSplits, type AssessmentData } from '../src/domain/assessment.ts'

const json = (f: string) => JSON.parse(readFileSync(new URL(`../src/seed/${f}`, import.meta.url), 'utf8'))
const catalog = json('catalog.json') as Catalog
const assessment = json('assessment.json') as AssessmentData
const skills = json('skills.json').skills as Skill[]
const splits = json('splits.json').splits as SplitTemplate[]

test('Einstufungs-Regeln zeigen nur auf existierende Leitern und Tests', () => {
  for (const r of assessment.rules) {
    assert.ok(catalog.progressions.some(p => p.id === r.progression), r.progression)
    assert.ok(assessment.tests.some(t => t.id === r.test), r.test)
    assert.deepEqual([...r.thresholds].sort((a, b) => a - b), r.thresholds, 'Schwellen aufsteigend')
  }
})

test('Einstufung: heutiges Level ergibt plausible Startstufen', () => {
  // 8–10 Klimmzüge, 20 Dips, kurzer L-Sit (CLAUDE.md)
  const cur = placement(assessment, catalog, { 'pull-ups': 9, dips: 20, 'push-ups': 30, hollow: 40, 'l-sit': 10, handstand: 30, pistol: 1, 'leg-raise': 10 })
  assert.equal(cur['pull-up'], 0, 'unter 10 Klimmzügen noch ohne Gewicht')
  assert.equal(cur.dip, 1, '20 Dips → mit Zusatzgewicht')
  assert.equal(cur['muscle-up-pull'], 0)
  assert.equal(cur['l-sit'], 0)
  assert.equal(cur.pistol, 0, 'Pistol nur mit Hilfe → assistiert')
  assert.equal(placement(assessment, catalog, { pistol: 3 }).pistol, 2, 'nie über die letzte Stufe')
})

test('Skill-Vorschläge: erfüllte Voraussetzungen zuerst, erreichte Skills ans Ende', () => {
  const s = suggestSkills(skills, catalog, { 'pull-up': 1, dip: 1, hollow: 0 })
  assert.equal(s[0].missing.length, 0, 'ganz oben: alle Voraussetzungen erfüllt')
  assert.equal(s[0].reached, false)
  const mu = s.find(x => x.skill === 'muscle-up')!
  assert.deepEqual(mu.missing, [])
  const hs = s.find(x => x.skill === 'handstand')!
  assert.ok(hs.missing.length === 1, 'Hollow Rocks fehlen')
  const done = suggestSkills(skills, catalog, { pistol: 2, 'pull-up': 1, dip: 1 })
  const firstReached = done.findIndex(x => x.reached)
  assert.ok(firstReached > 0 && done.slice(firstReached).every(x => x.reached), 'erreichte Skills am Ende')
  assert.ok(done.find(x => x.skill === 'pistol')!.reached)
})

test('Skill-Vorschläge: schwere Skills ohne Voraussetzungen gelten nicht als „realistisch als Nächstes“', () => {
  const meta = json('exercise-meta.json').exercises
  // Fortgeschrittener: Klimmzüge und Dips mit Gewicht, L-Sit auf Parallettes
  const s = suggestSkills(skills, catalog, { 'pull-up': 1, dip: 1, 'l-sit': 1 }, meta)
  const tier = (id: string) => s.find(x => x.skill === id)?.tier
  assert.notEqual(tier('human-flag'), 'next', 'Human Flag (Endstufe 5) ist für Niveau 3 kein nächster Schritt')
  assert.notEqual(tier('back-lever'), 'next')
  assert.ok(s.findIndex(x => x.skill === 'muscle-up') < s.findIndex(x => x.skill === 'human-flag'), 'Muscle-up vor Human Flag')
})

test('Split-Vorschläge passen zur Tageszahl', () => {
  assert.equal(suggestSplits(splits, 3, ['pull', 'push', 'core'])[0].id, 'ppl-3')
  assert.equal(suggestSplits(splits, 3, ['legs'])[0].id, 'full-3')
  for (const n of [2, 3, 4, 5, 6]) assert.ok(suggestSplits(splits, n, []).every(s => s.themes.length === n) && suggestSplits(splits, n, []).length > 0, `${n} Tage`)
})
