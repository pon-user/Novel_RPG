'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const B = require('../docs/prologue-battle-v04.js');
const source = fs.readFileSync(path.join(__dirname, '../docs/prologue-battle-v04.js'), 'utf8');
let checks = 0;
const plain = value => JSON.parse(JSON.stringify(value));
const eq = (a, b, message) => { assert.deepEqual(plain(a), plain(b), message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const basic = Array(5).fill('basic');
const run = (id, plan = basic, engine = B) => engine.simulate({encounterId: id, plan, gem: null});
const fixture = () => { const context = vm.createContext({}); vm.runInContext(source, context); return context.PrologueBattle; };
function plans(options) {
  const output = [];
  function visit(plan, used) {
    if (plan.length === 5) { output.push(plan); return; }
    for (const skill of options) if (skill === 'basic' || !used.has(skill)) visit([...plan, skill], new Set([...used, skill]));
  }
  visit([], new Set());
  return output;
}
const legacyResults = [];
for (const [id, encounter] of Object.entries(B.ENCOUNTERS)) {
  for (const plan of plans(encounter.unlocked)) {
    const result = run(id, plan);
    const original = plain(result);
    delete original.telemetry;
    legacyResults.push({id, plan, result: original});
    eq(result.telemetry.version, 1, 'versioned additive telemetry');
    eq(result.telemetry.turns.length, result.round, 'one actual pre-action snapshot per executed turn');
    eq(result.telemetry.summary.damageTaken, encounter.party.reduce((sum, id) => sum + B.CHARACTER[id].hp, 0) - result.remainingPartyHP, 'received damage is actual party HP loss');
    eq(result.telemetry.summary.avoided, result.logs.filter(event => event.type === 'dodge').length, 'avoid count comes from actual events');
    let sequence = 0;
    let telemetryDamage = 0;
    for (const turn of result.telemetry.turns) {
      const start = [...turn.start.allies, ...turn.start.enemies];
      const previous = result.states[turn.round - 2];
      for (const unit of start) {
        const previousUnit = previous && [...previous.allies, ...previous.enemies].find(u => u.id === unit.id);
        eq(unit.hp, previousUnit ? previousUnit.hp : B.CHARACTER[unit.id].hp, 'turn begins at the preceding end HP, never the current end HP');
        eq(unit.alive, unit.hp > 0, 'KO is explicit in the start snapshot');
        ok(unit.statuses.every(status => status.remainingRounds === null || status.remainingRounds >= 0), 'expired statuses are not displayed with negative duration');
      }
      for (const action of turn.actions) {
        eq(action.sequence, ++sequence, 'actions are ordered across the entire battle');
        ok(/[\u3040-\u30ff\u3400-\u9fff]/u.test(action.skillName), 'every actual action has a Japanese skill label');
        for (const event of action.effects) {
          ok(typeof event.text === 'string' && /[\u3040-\u30ff\u3400-\u9fff]/u.test(event.text), 'every effect has player-facing Japanese text');
          if (event.kind === 'damage') {
            telemetryDamage++;
            eq(event.hpBefore - event.damage, event.hpAfter, 'damage event contains the immediate post-hit HP');
            ok(event.hpAfter >= 0 && event.hpAfter <= event.maxhp, 'per-hit HP is bounded');
          }
        }
      }
      const end = result.states[turn.round - 1];
      eq(turn.end.allies.map(u => u.hp), end.allies.map(u => u.hp), 'telemetry end and original snapshot agree');
      eq(turn.end.enemies.map(u => u.hp), end.enemies.map(u => u.hp), 'enemy end snapshot agrees');
    }
    eq(telemetryDamage, result.logs.filter(event => event.type === 'damage').length, 'no actual hit is omitted or duplicated');
  }
}
eq(legacyResults.length, 674, 'all legal reservations were covered');
// Frozen before instrumentation from reviewed v0.5 commit 9ea01e7.
// Includes every existing result field (states/logs/metrics/outcome), not only win/lose.
eq(crypto.createHash('sha256').update(JSON.stringify(legacyResults)).digest('hex'), '17deaf3c018e411bf01d030c7adf884bea7f9bf154d0b2c704b4124f430f1cfc', 'all 674 v0.5 results remain byte-identical after removing the additive telemetry field');

const first = run('BTL-0001', ['survive', ...basic.slice(1)]);
eq(first.telemetry.turns[0].start.allies[0].statuses, [], 'initial state must not leak the already-computed first-turn dodge buff');
eq(first.telemetry.turns[1].start.allies[0].statuses.find(s => s.kind === 'dodge').charges, 1, 'second turn starts with the unspent dodge charge');
ok(!first.telemetry.turns[2].start.allies[0].statuses.some(s => s.kind === 'dodge'), 'consumed dodge is absent next turn');
eq(first.telemetry.summary.damageTaken, 0, 'damage-free victory is an observed fact');
eq(first.telemetry.summary.avoided, 2, 'two avoided attacks are observed');

const third = run('BTL-0003');
const startUnit = (result, round, id) => [...result.telemetry.turns[round - 1].start.allies, ...result.telemetry.turns[round - 1].start.enemies].find(u => u.id === id);
eq(startUnit(third, 2, 'captain').statuses.find(s => s.kind === 'cover').remainingRounds, 2, 'cover includes the application turn');
eq(startUnit(third, 3, 'captain').statuses.find(s => s.kind === 'cover').remainingRounds, 1, 'cover duration counts down before actions');
ok(!startUnit(third, 4, 'captain').statuses.some(s => ['cover', 'taunt'].includes(s.kind)), 'cover and taunt expire before round four');
eq(startUnit(third, 2, 'aria').statuses.find(s => s.kind === 'buff').remainingRounds, 1, 'defense buff includes application turn');
ok(!startUnit(third, 3, 'aria').statuses.some(s => s.kind === 'buff'), 'expired defense buff is absent before turn three');
eq(startUnit(third, 3, 'memberA').charge, {skillId: 'water', skillName: '水魔法', readyAt: 3}, 'the charging state exists before its release action');
eq(third.telemetry.turns[2].actions.find(a => a.actorId === 'memberA').phase, 'release', 'release is distinguished from preparation');
const redirected = third.telemetry.turns[0].actions.find(a => a.actorId === 'e3').effects;
ok(redirected.findIndex(e => e.kind === 'redirect') < redirected.findIndex(e => e.kind === 'damage'), 'cover is recorded before the actual redirected hit');

const longEngine = fixture();
longEngine.CHARACTER.big.hp = 20000;
longEngine.CHARACTER.small.hp = 10000;
const marked = run('BTL-0004', ['mark', ...basic.slice(1)], longEngine);
eq(startUnit(marked, 2, 'small').statuses.find(s => s.kind === 'mark').remainingRounds, 2, 'mark duration is accurate at turn start');
ok(!startUnit(marked, 4, 'small').statuses.some(s => s.kind === 'mark'), 'mark has expired before fourth turn');
const fiveHits = marked.telemetry.turns[4].actions.find(a => a.actorId === 'captain').effects.filter(e => e.kind === 'damage');
eq(fiveHits.map(e => e.hit), [1, 2, 3, 4, 5], 'multi-hit damage is preserved in actual processing order');
eq(fiveHits.slice(1).map(e => e.hpBefore), fiveHits.slice(0, -1).map(e => e.hpAfter), 'each hit starts from the previous immediate HP');

const fourth = run('BTL-0004');
const damage = (result, round, actorId, targetId) => result.telemetry.turns[round - 1].actions.find(a => a.actorId === actorId).effects.find(e => e.kind === 'damage' && e.targetId === targetId);
const unbuffed = fixture(); unbuffed.SKILLS.defUp.pct = 0;
eq(damage(fourth, 1, 'big', 'aria').defensePrevented, damage(run('BTL-0004', basic, unbuffed), 1, 'big', 'aria').damage - damage(fourth, 1, 'big', 'aria').damage, 'defense attribution is the exact same-hit formula difference');
const unweakened = fixture(); unweakened.SKILLS.feint.weakens = 0;
eq(damage(fourth, 2, 'big', 'aria').feintPrevented, damage(run('BTL-0004', basic, unweakened), 2, 'big', 'aria').damage - damage(fourth, 2, 'big', 'aria').damage, 'feint attribution is the exact same-hit formula difference');
ok(damage(fourth, 4, 'small', 'memberA').chargeExtra > 0, 'charge risk records actual additional received damage');
const fast = run('BTL-0004', ['mark', 'heavy', 'fire', 'basic', 'basic']);
eq(fast.telemetry.summary.markedTargets, [{id: 'small', name: '小型魔獣', round: 1}], 'targeting feedback identifies the actual target');
eq(fast.telemetry.summary.markFollowupHits, 2, 'only actual subsequent attacks are credited to the active mark');
eq(startUnit(fast, 2, 'small').alive, false, 'the next start state preserves defeated enemies as KO');
const deathEngine = fixture(); deathEngine.CHARACTER.captain.hp = 80;
const death = run('BTL-0004', basic, deathEngine);
const cancelled = death.telemetry.turns.flatMap(turn => turn.actions.flatMap(action => action.effects)).find(event => event.kind === 'cancel');
ok(cancelled && cancelled.targetId === 'captain' && cancelled.skillName === '5連撃', 'KO reports which prepared skill was actually cancelled');
ok(!death.telemetry.summary.chargedReleases.some(event => event.actorId === 'captain'), 'cancelled preparation is not credited with a release');

const old = plain(fourth); delete old.telemetry;
const oldJSON = JSON.stringify(old);
eq(B.telemetryFor(old), fourth.telemetry, 'v0.5 history is reconstructed from an exact replay without a saved plan');
eq(JSON.stringify(old), oldJSON, 'legacy result is never mutated during reconstruction');
eq(B.telemetryFor(old, basic), fourth.telemetry, 'optional active reservation reproduces the same timeline');
const oldFast = plain(fast); delete oldFast.telemetry;
eq(B.telemetryFor(oldFast, basic), fast.telemetry, 'a wrong optional plan falls back to an exact legal-reservation replay');
const invented = plain(old); invented.logs[0].text = '異なる戦闘記録';
eq(B.telemetryFor(invented), null, 'unmatched saved records never acquire fabricated telemetry');
const reconstructed = B.telemetryFor(old); reconstructed.turns[0].start.allies[0].hp = 0;
eq(B.telemetryFor(old).turns[0].start.allies[0].hp, 300, 'cache returns a defensive copy');
console.log(`PASS telemetry: ${checks} assertions; all 674 legacy battle results unchanged, correct pre-action states, ordered effects and strict v0.5 history replay`);
