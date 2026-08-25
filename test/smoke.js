/* Smoke-Test für index.html.
   Aufruf:  node test/smoke.js
   Extrahiert das <script> aus index.html, prüft die Syntax und führt die Logik
   gegen einen DOM-Stub aus. Der localStorage-Mock wirft absichtlich, damit die
   try/catch-Pfade im store-Wrapper mitgetestet werden. */
const fs = require("fs"), path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = html.split("<script>")[1].split("</script>")[0];

function makeEl() {
  return {
    children: [], style: {}, dataset: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
                 toggle() {}, contains(c) { return this._s.has(c); } },
    appendChild(c) { this.children.push(c); return c; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener() {}, setAttribute() {}, scrollIntoView() {},
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html || ""; },
    set textContent(v) { this._tc = v; }, get textContent() { return this._tc || ""; },
    set className(v) { this._cls = v; }, get className() { return this._cls || ""; },
    onclick: null,
  };
}
const els = {};
global.document = {
  getElementById: id => (els[id] = els[id] || makeEl()),
  createElement: () => makeEl(),
  querySelector: () => null,
  addEventListener() {},
};
global.window = {};
global.localStorage = { getItem() { throw new Error("kein localStorage"); }, setItem() { throw new Error("kein localStorage"); } };
global.navigator = {};
global.alert = () => {};
global.confirm = () => true;

let fails = 0;
global.assert = (c, m) => { if (c) console.log("  ok   " + m); else { console.error("  FAIL " + m); fails = 1; } };

const tests = `
/* ── Datenmodell ── */
assert(Object.keys(SLOTS).length === 24, "24 Slots");
assert(PLAN.reduce((a,d)=>a+d.slots.reduce((b,s)=>b+s.levels.length,0),0) === 47, "47 Levels");
assert(parseLogKey("0-1@1").x.name.length > 0, "parseLogKey mit Stufe");
assert(parseLogKey("9-9") === null, "parseLogKey unbekannt -> null");
render(); renderSession(); tick();

/* ── Progressionen ── */
assert(SLOTS["0-0"].levels.length === 3, "Muscle-up-Slot mit Band-Zwischenstufe");
assert(SLOTS["1-7"].levels.length === 3 && SLOTS["1-7"].ord === -1, "Handstand-Slot, vorgezogen");
assert(SLOTS["0-5"].ord === 3.5 && SLOTS["0-5"].levels[0].up === 5, "Uneven Pull-ups vorgezogen, Ziel 5");
var ordB = PLAN[1].slots.map((s, i) => i).sort((a, b) => (PLAN[1].slots[a].ord ?? a) - (PLAN[1].slots[b].ord ?? b));
assert(ordB[0] === 7, "Handstand steht an Tag B ganz vorne");

/* ── Wochenplan ── */
assert(splitOrder().join() === "2,1,0", "Picker-Reihenfolge Mo, Mi, So");
assert(nextSplit(0) === 0 && nextSplit(1) === 2 && nextSplit(3) === 1, "So=A, Mo=C, Mi=B");
log = {}; durs = {};
assert(nextSplit(2) === 0, "freier Tag ohne Historie -> Tag A");

/* ── Pausieren (dauerhaft, im Gegensatz zu sk = nur heute) ── */
off = [];
off.push("1-5"); off.push("0-2");
assert(off.includes("1-5"), "Uebung laesst sich pausieren");
activeSplit = 1; render();
off = off.filter(k => !k.startsWith("1-"));
assert(!off.includes("1-5") && off.includes("0-2"), "Aufheben trifft nur den eigenen Tag");
off = [];

/* ── Routinen und Cardio ── */
assert(ROUTINES.length === 3, "Routinen fuer 3 Tage");
assert(ROUTINES[0].cool[0].cardio === 1 && !ROUTINES[2].cool.some(it => it.cardio), "Cardio in A/B, nicht in C");
assert(fmtCardio({ t: "rad", min: 90, km: 40, hm: 450 }) === "Rad · 90 min · 40 km · 450 hm", "Cardio-Zeile");
cardio = {}; rout = {};
assert(routineCard(0, "c").innerHTML.indexOf("0/6") > -1, "Cool-down 0 von 6");
cardio[today()] = [{ t: "lauf", min: 20 }];
assert(routineCard(0, "c").innerHTML.indexOf("1/6") > -1, "Cardio-Eintrag hakt sich selbst ab");
cardio = {};

/* ── Satzzahl, Skip, Unlock ── */
log = {};
var e1 = entryFor("0-0", today(), true); e1.n = 7; e1.s = [[3,0]];
render();
assert(log["0-0"][0].n === 7, "Satzzahl-Override gespeichert");
log = {};
entryFor("0-5", today(), true).sk = 1; render();
assert(log["0-5"][0].sk === 1, "Skip-Flag gespeichert");
log = {};
log["0-1"] = [
  { d: "2026-07-20", s: [[8,0],[8,0],[8,0],[8,0]] },
  { d: "2026-07-21", s: [[8,0],[8,0],[8,0],[8,0]] }
];
assert(readyToProgress("0-1") === true, "Unlock nach 2 vollen Einheiten");
log["0-1"][1].s[2] = [7,0];
assert(readyToProgress("0-1") === false, "kein Unlock unter Schwelle");
log = {};

/* ── Datum, Timer, Update ── */
var now = new Date();
var lokal = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0") + "-" + String(now.getDate()).padStart(2,"0");
assert(today() === lokal, "today() = lokales Datum");
startTimer(90);
assert(timerEnd > Date.now(), "timerEnd gesetzt");
stopTimer();
assert(timerEnd === 0 && timerId === null, "Timer gestoppt");
beep(); fireAlarm(); clearAlarm();
assert(true, "Alarm ohne AudioContext stuerzt nicht ab");
startTimer(-1); tick();
assert(timerId === null, "abgelaufener Timer beendet sich selbst");
assert(vOf("x Progressionsbasiert · v2.3.4 y") === "2.3.4", "vOf extrahiert Version");
assert(checkUpdate() instanceof Promise, "checkUpdate wirft nicht");

/* ── Editoren ── */
log = {};
openEditor("1-0", 0);
assert(ed.val === 10, "Prefill 10 s bei Zeituebung");
assert(document.getElementById("editor").innerHTML.indexOf("edclock") > -1, "Hold-Timer im Editor");
closeEditor();
openCardio("2026-08-02");
assert(cd.t === "rad" && cd.min === 60, "Cardio-Editor mit Vorgabewerten");
closeEditor();
assert(cd === null && ed === null, "Editoren geschlossen");

/* ── Wake Lock ── */
var wlReq = null, wlRel = false;
navigator.wakeLock = { request: async t => { wlReq = t; return { release() { wlRel = true; } }; } };
startSession();
setTimeout(() => {
  assert(wlReq === "screen", "WakeLock bei Session-Start");
  endSession();
  assert(wlRel === true, "WakeLock bei Session-Ende freigegeben");
}, 5);

/* ── Activity-Tab ── */
log = { "0-0": [{ d: "2026-07-20", s: [[3,0],[3,0]] }] };
activeTab = 1; render();
log = {}; render();
activeTab = 0;
`;

try { new Function(app); } catch (e) { console.error("  FAIL Syntax: " + e.message); process.exit(1); }
console.log("  ok   Syntax");
eval(app + "\n" + tests);
setTimeout(() => {
  console.log(fails ? "\nFEHLGESCHLAGEN" : "\nalle Tests bestanden");
  process.exit(fails);
}, 20);
