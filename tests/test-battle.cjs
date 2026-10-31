'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../docs/prologue-battle-v04.js'), 'utf8');
function fixture() {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  return context.PrologueBattle;
}
const B = require('../docs/prologue-battle-v04.js');
const basic = Array(5).fill('basic');
const plain = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function ok(condition, message) { assert.ok(condition, message); checks++; }
function eq(actual, expected, message) { assert.deepEqual(plain(actual), plain(expected), message); checks++; }
function rejects(fn, pattern, message) { assert.throws(fn, pattern, message); checks++; }
function run(encounterId, plan = basic, engine = B) { return engine.simulate({encounterId, plan, gem: null}); }
function plans(options) {
  const output = [];
  function visit(plan, used) {
    if (plan.length === 5) { output.push(plan); return; }
    for (const skill of options) {
      if (skill === 'basic' || !used.has(skill)) visit([...plan, skill], new Set([...used, skill]));
    }
  }
  visit([], new Set());
  return output;
}

// Enumerate the full player choice space; verify both tactical outcomes and save/reload replay.
const summary = {};
let total = 0;
for (const [id, encounter] of Object.entries(B.ENCOUNTERS)) {
  const candidates = plans(encounter.unlocked);
  eq(candidates.length, {'BTL-0001': 6, 'BTL-0002': 31, 'BTL-0003': 136, 'BTL-0004': 501}[id], `${id}: complete choice space`);
  summary[id] = {};
  for (const plan of candidates) {
    const savedPlan = JSON.stringify(plan);
    const result = run(id, plan);
    ok(result.won && result.remainingEnemyHP === 0 && result.remainingPartyHP > 0, `${id}: surviving victory for ${plan}`);
    eq(JSON.stringify(plan), savedPlan, 'simulation must not mutate the reservation');
    eq(run(id, JSON.parse(savedPlan)), result, 'a reloaded reservation must replay deterministically');
    eq(result.round, result.states.length, 'one snapshot per completed round');
    eq(result.allies, result.states.at(-1).allies, 'final ally state matches final snapshot');
    eq(result.enemies, result.states.at(-1).enemies, 'final enemy state matches final snapshot');
    eq(result.remainingPartyHP, result.allies.reduce((sum, unit) => sum + unit.hp, 0), 'saved party HP is consistent');
    for (const state of result.states) ok([...state.allies, ...state.enemies].every(unit => Number.isFinite(unit.hp) && unit.hp >= 0 && unit.hp <= unit.maxhp), 'HP stays in bounds');
    if (id === 'BTL-0003' && !plan.includes('fire')) eq(result.round, 5, 'no fire: the hard enemy requires round five');
    if (id === 'BTL-0003' && plan.indexOf('fire') >= 0 && plan.indexOf('fire') < 3) eq(result.round, 3, 'fire by round three enables round-three victory');
    if (id === 'BTL-0004' && !plan.includes('mark')) eq(result.round, 5, 'without targeting, round-five victory');
    if (id === 'BTL-0004' && plan[0] === 'mark') {
      eq(result.states[0].enemies.find(unit => unit.id === 'small').hp, 0, 'round-one mark defeats the lower enemy before it acts');
      eq(result.metrics.smallAttackRounds, 0, 'early small-enemy defeat prevents all its area attacks');
    }
    summary[id][result.round] = (summary[id][result.round] || 0) + 1;
  }
  total += candidates.length;
}
eq(total, 674, 'all 674 legal reservations were exercised');

const first = run('BTL-0001', ['survive', ...Array(4).fill('basic')]);
eq([first.round, first.allies[0].hp, first.metrics.avoided], [3, 300, 2], 'first lesson: two dodges and a damage-free three-round victory');
const second = run('BTL-0002', ['survive', 'heavy', 'basic', 'basic', 'basic']);
eq([second.round, second.allies[0].hp, second.metrics.avoided], [3, 300, 2], 'second lesson: heavy attack preserves damage-free three-round victory');
eq(run('BTL-0002', ['survive', 'basic', 'basic', 'basic', 'basic']).round, 4, 'two normal attacks cannot defeat battle two');
const fourthFast = run('BTL-0004', ['mark', 'heavy', 'fire', 'basic', 'basic']);
eq(fourthFast.round, 4, 'targeting and offensive follow-up enable an early victory');
ok(fourthFast.remainingPartyHP > run('BTL-0004').remainingPartyHP, 'eliminating area attacks preserves more party HP');

// Unlock boundaries, once-only skills, exact story parties, and non-controllable NPCs.
for (const id of Object.keys(B.ENCOUNTERS)) {
  rejects(() => run(id, ['cheer', ...Array(4).fill('basic')]), /LOCKED_SKILL/, 'the chapter-one ultimate is not available in any prologue battle');
  rejects(() => run(id, ['AR-ULT', ...Array(4).fill('basic')]), /LOCKED_SKILL/, 'aliases cannot bypass the ultimate unlock');
  rejects(() => run(id, ['survive', 'survive', 'basic', 'basic', 'basic']), /SKILL_ONCE/, 'non-basic skills are once per battle');
  rejects(() => B.simulate({encounterId: id, plan: basic, gem: 'balanced'}), /GEM_NOT_AVAILABLE/, 'no prologue gem');
  rejects(() => B.simulate({encounterId: id, plan: basic, roster: ['aria', 'traveler']}), /PARTY_MUST_MATCH/, 'story companions cannot be substituted');
}
for (const [id, skill] of [['BTL-0001', 'heavy'], ['BTL-0002', 'fire'], ['BTL-0003', 'mark']]) rejects(() => run(id, [skill, ...Array(4).fill('basic')]), /LOCKED_SKILL/, 'future skills stay locked');
rejects(() => run('BTL-0004', ['charge', ...Array(4).fill('basic')]), /LOCKED_SKILL/, 'charge is not a selectable standalone skill');
rejects(() => run('BTL-0001', ['basic']), /PLAN_MUST_HAVE_FIVE_ROUNDS/, 'all five reservations are mandatory');
rejects(() => run('BTL-0003', Array.from({length: 5}, () => ({aria: {skill: 'basic'}, captain: {skill: 'guardFive'}}))), /ONLY_ARIA/, 'NPC skill input is rejected');
rejects(() => run('BTL-0003', Array.from({length: 5}, () => ({aria: 'basic', H: 'fire'}))), /ONLY_ARIA/, 'two player identifiers cannot conflict');
rejects(() => run('BTL-0004', Array.from({length: 5}, () => ({skill: 'basic', target: 'small'}))), /ONLY_ARIA/, 'manual targets cannot bypass the target-state rule');
eq(run('BTL-0001', ['AR-SURVIVE', ...Array(4).fill('AR-BASIC')]), first, 'string aliases match canonical skills');
eq(run('BTL-0001', ['survive', ...Array(4).fill('basic')].map(skill => ({aria: {skill}}))), first, 'wrapped Aria reservations remain compatible');
eq(run('BTL-0001', ['survive', ...Array(4).fill('basic')].map(skill => ({H: {skill}}))), first, 'legacy player identifier remains compatible');

// Cover and taunt have defensive priority; area attacks ignore cover and dodge.
const cover = run('BTL-0003', ['survive', 'basic', 'basic', 'basic', 'basic']);
eq(cover.logs[0].type, 'cover', 'captain covers before faster Aria acts');
for (const state of cover.states.slice(0, 3)) eq(state.allies.find(unit => unit.id === 'aria').dodge, 2, 'redirected attacks must not consume Aria dodge');
eq(cover.states[3].allies.find(unit => unit.id === 'aria').dodge, 1, 'the first unprotected single attack consumes one dodge');
const area = run('BTL-0004', ['survive', ...Array(4).fill('basic')]);
ok(area.logs.some(log => log.round === 1 && log.actorId === 'small' && log.targetId === 'aria' && log.damage > 0), 'area damage reaches Aria during dodge');
eq(area.states[0].allies.find(unit => unit.id === 'aria').dodge, 1, 'area damage does not consume the second dodge');
ok(area.logs.filter(log => log.type === 'damage' && log.actorId === 'small').every(log => !log.redirected), 'area attacks are not redirected by cover');

// Default order, mark propagation to NPCs, expiry, tie-breaking, and dead-target fallback.
eq(fourthFast.logs.filter(log => log.round === 1 && log.type === 'damage' && ['aria', 'traveler', 'captain'].includes(log.actorId)).map(log => [log.actorId, log.targetId, log.damage]), [['aria', 'small', 50], ['traveler', 'small', 59], ['captain', 'small', 96]], 'mark guides all allied single attacks before the small enemy can act');
ok(fourthFast.logs.filter(log => log.round === 2 && log.type === 'damage' && log.actorId !== 'big').every(log => log.targetId === 'big'), 'a dead marked enemy yields to the upper living enemy');
const expiryEngine = fixture();
expiryEngine.CHARACTER.big.hp = 20000;
expiryEngine.CHARACTER.small.hp = 10000;
const expiry = run('BTL-0004', ['mark', ...Array(4).fill('basic')], expiryEngine);
for (const round of [1, 2, 3]) ok(expiry.logs.filter(log => log.round === round && log.type === 'damage' && expiryEngine.ENCOUNTERS['BTL-0004'].party.includes(log.actorId)).every(log => log.targetId === 'small'), `mark includes application round through round ${round}`);
ok(expiry.logs.filter(log => log.round === 4 && log.type === 'damage' && expiryEngine.ENCOUNTERS['BTL-0004'].party.includes(log.actorId)).every(log => log.targetId === 'big'), 'mark expires before round four');
expiryEngine.CHARACTER.big.hp = 10000;
eq(run('BTL-0004', ['mark', ...Array(4).fill('basic')], expiryEngine).logs.find(log => log.type === 'mark').targetId, 'big', 'equal maximum HP uses screen order');

// Keep enemies alive in isolated fixtures to observe every fixed NPC action and release.
const longEngine = fixture();
longEngine.CHARACTER.e3.hp = 10000;
const long = run('BTL-0003', basic, longEngine);
eq(long.won, false, 'surviving the round limit does not count as victory');
eq(long.finishReason, 'round_limit', 'unresolved combat has an explicit outcome');
eq(long.logs.filter(log => log.actorId === 'captain' && ['cover', 'taunt', 'charge', 'release'].includes(log.type)).map(log => [log.round, log.type, log.skill || null]), [[1, 'cover', null], [2, 'taunt', null], [4, 'charge', 'guardFive'], [5, 'release', 'guardFive']], 'captain follows the fixed defensive and charge schedule');
eq(long.logs.filter(log => log.actorId === 'memberA' && ['buff', 'charge', 'release'].includes(log.type)).map(log => [log.round, log.type, log.skill]), [[1, 'buff', 'defUp'], [2, 'charge', 'water'], [3, 'release', 'water'], [4, 'charge', 'mageFire'], [5, 'release', 'mageFire']], 'the same member A follows the magic schedule');
eq(long.logs.filter(log => log.round === 4 && log.type === 'damage' && ['captain', 'memberA'].includes(log.actorId)).length, 0, 'charging NPCs do not also perform a normal attack');
eq(long.logs.filter(log => log.round === 5 && log.type === 'damage' && log.actorId === 'captain').length, 5, 'the five-hit attack is released exactly once');
for (const [id, hp] of [['captain', 80]]) {
  const deadEngine = fixture(); deadEngine.CHARACTER[id].hp = hp;
  const dead = run('BTL-0004', basic, deadEngine);
  ok(dead.logs.some(log => log.actorId === id && log.type === 'charge_cancel'), 'death cancels the prepared attack explicitly');
  ok(!dead.logs.some(log => log.actorId === id && log.type === 'release'), 'a dead NPC cannot release a charged skill');
  ok(!dead.allies.find(unit => unit.id === id).charging, 'the cancelled charge is not persisted as active');
}
const badCharge = fixture(); badCharge.ENCOUNTERS['BTL-0003'].npc.memberA[2] = 'basic';
rejects(() => run('BTL-0003', basic, badCharge), /CHARGE_INTERRUPTED/, 'a second action cannot interrupt a pending charge');
const doubleCharge = fixture(); doubleCharge.ENCOUNTERS['BTL-0003'].npc.memberA[3] = 'water';
rejects(() => run('BTL-0003', basic, doubleCharge), /NPC_SKILL_REUSED/, 'a charged skill cannot be prepared twice');
const noCharge = fixture(); noCharge.ENCOUNTERS['BTL-0003'].npc.memberA[0] = '@release';
rejects(() => run('BTL-0003', basic, noCharge), /BAD_CHARGE_SEQUENCE/, 'release cannot happen without preparation');

// Defense and attack weakening must change actual damage, including the charging multiplier.
const fourth = run('BTL-0004');
const normalHit = fourth.logs.find(log => log.actorId === 'small' && log.targetId === 'memberA' && log.round === 3);
const chargedHit = fourth.logs.find(log => log.actorId === 'small' && log.targetId === 'memberA' && log.round === 4);
eq(chargedHit.damage, Math.floor(normalHit.damage * 1.2), 'charging increases the actual received damage by 20%');
const unbuffedEngine = fixture(); unbuffedEngine.SKILLS.defUp.pct = 0;
ok(run('BTL-0004', basic, unbuffedEngine).logs.find(log => log.actorId === 'big' && log.round === 1 && log.type === 'damage').damage > fourth.logs.find(log => log.actorId === 'big' && log.round === 1 && log.type === 'damage').damage, 'defense up mitigates the large enemy');
const unweakenedEngine = fixture(); unweakenedEngine.SKILLS.feint.weakens = 0;
ok(run('BTL-0004', basic, unweakenedEngine).logs.find(log => log.actorId === 'big' && log.round === 2 && log.type === 'damage').damage > fourth.logs.find(log => log.actorId === 'big' && log.round === 2 && log.type === 'damage').damage, 'feint lowers the large enemy damage');
const directCaptainEngine = fixture(); directCaptainEngine.CHARACTER.big.hp = 10000;
const directCaptain = run('BTL-0004', basic, directCaptainEngine).logs.find(log => log.round === 4 && log.actorId === 'big' && log.type === 'damage');
eq([directCaptain.targetId, directCaptain.redirected, directCaptain.charging], ['captain', false, true], 'attacking an already targeted charging captain is not a redirection');
const lossEngine = fixture(); lossEngine.CHARACTER.aria.hp = 1; lossEngine.CHARACTER.e1.spd = 200;
const loss = run('BTL-0001', basic, lossEngine);
eq([loss.won, loss.finishReason, loss.remainingPartyHP, loss.round], [false, 'annihilated', 0, 1], 'party annihilation cannot award victory');

// The BTL dispatcher must leave the old E03 battle runner available.
const legacyContext = vm.createContext({window: {}});
for (const file of ['data.js', 'prologue-battle-v04.js', 'battle-c1.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs', file), 'utf8'), legacyContext, {filename: file});
const engine = legacyContext.window.BattleEngine;
eq(engine.simulate({encounterId: 'BTL-0001', plan: ['survive', ...Array(4).fill('basic')], gem: null}), first, 'the public dispatcher uses the new prologue runner');
const roster = ['H', '02', '03', '04'];
const legacyInput = {encounterId: 'E03', roster, gem: 'balanced', gear: {}, plan: engine.basicPlan(roster)};
eq(engine.simulate(legacyInput), engine.legacySimulate(legacyInput), 'legacy encounter dispatch preserves the old result');
console.log(`PASS battle: ${checks} assertions; ${total} legal reservations; victory rounds ${JSON.stringify(summary)}`);
