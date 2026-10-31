'use strict';
const assert = require('node:assert/strict');
const State = require('../docs/prologue-state.js');
const battle = require('../docs/prologue-battle-v04.js');
const story = require('../docs/prologue-story-v04.js');
let checks = 0;
function eq(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++; }
function ok(value, label) { assert.ok(value, label); checks++; }
function rejects(fn, label) { assert.throws(fn, undefined, label); checks++; }
const copy = value => JSON.parse(JSON.stringify(value));
function memory(initial = {}) {
  return {values: {...initial}, writes: 0, getItem(key) { return this.values[key] ?? null; }, setItem(key, value) { this.writes++; this.values[key] = value; }};
}
function boot(storage = memory(), engine = battle) { return State.create({storage, story, engine, battle}); }
function assertRestores(controller, storage, label) { eq(boot(storage).snapshot(), controller.snapshot(), label); }
const plans = [
  ['survive', 'basic', 'basic', 'basic', 'basic'],
  ['survive', 'heavy', 'basic', 'basic', 'basic'],
  ['survive', 'basic', 'fire', 'heavy', 'basic'],
  ['mark', 'fire', 'heavy', 'basic', 'basic']
];

const storage = memory();
let c = boot(storage);
eq(c.snapshot().action, 'hold', 'hold is the initial action');
eq(c.snapshot().phase, 'ready');
rejects(() => c.startUpdate(), 'hold never advances story');
rejects(() => c.completeSection(), 'cannot skip before an update');
rejects(() => c.runBattle(), 'cannot battle before an update');
eq(storage.writes, 0, 'invalid operations do not write');
c.setReadingSize('large');
assertRestores(c, storage, 'reading preference saves');
c.setAction('main');
assertRestores(c, storage, 'action saves immediately');
c.startUpdate();
eq(c.snapshot().current, 0);
eq(c.snapshot().completedCount, 0);
eq(c.snapshot().plan, Array(5).fill('basic'), 'optimal plan is never pre-filled');
rejects(() => c.startUpdate(), 'double update cannot skip a section');
c.setPage(3);
assertRestores(c, storage, 'reading page resumes');
rejects(() => c.completeSection(), 'battle required before completing first section');
c.goBattle();
eq(c.snapshot().page, 0);
assertRestores(c, storage, 'battle preparation resumes');
for (let i = 0; i < 5; i++) c.setPlan(i, plans[0][i]);
assertRestores(c, storage, 'all reservation edits persist');
c.runBattle();
eq(c.snapshot().phase, 'result');
eq(c.snapshot().result.round, 3);
eq(c.snapshot().result.remainingPartyHP, 300);
rejects(() => c.setPlan(0, 'basic'), 'won result cannot be changed');
rejects(() => c.runBattle(), 'won battle is never replayed by duplicate click');
assertRestores(c, storage, 'resolved result resumes without re-simulation');
c.readPost();
c.setPage(2);
assertRestores(c, storage, 'post-battle page resumes');
c.completeSection();
eq(c.snapshot().completedCount, 1);
eq(c.snapshot().phase, 'ready');
eq(c.snapshot().action, 'hold', 'every next update requires deliberate selection');
rejects(() => c.completeSection(), 'completed section cannot be committed twice');
assertRestores(c, storage, 'completed first update resumes');

for (let section = 1; section < 5; section++) {
  c = boot(storage);
  c.setAction('main');
  c.startUpdate();
  eq(c.snapshot().current, section, 'exactly the next section starts');
  eq(c.snapshot().history.length, section, 'history only grows on completion');
  assertRestores(c, storage, `update ${section + 1} start survives reload`);
  if (section < 4) {
    c.goBattle();
    rejects(() => c.setPlan(0, 'cheer'), 'chapter-one skill remains locked');
    for (let i = 0; i < 5; i++) c.setPlan(i, plans[section][i]);
    c.runBattle();
    ok(c.snapshot().result.won);
    assertRestores(c, storage, `battle ${section + 1} result resumes`);
    c.readPost();
    c.completeSection();
  } else {
    rejects(() => c.goBattle(), 'fifth update is noncombat');
    c.completeSection();
  }
  eq(c.snapshot().completedCount, section + 1);
  assertRestores(c, storage, `update ${section + 1} completion survives reload`);
}
eq(c.snapshot().phase, 'done');
eq(c.snapshot().completedCount, 5, 'exactly five manual updates complete the prologue');
eq(c.snapshot().history.map(entry => entry.section), [0, 1, 2, 3, 4]);
ok(c.snapshot().cheerUnlocked, 'fourth battle unlock is retained');
eq(c.snapshot().items.gem, '未取得');
eq(c.snapshot().items.sword, '未取得');
eq(c.snapshot().items.vial, '携行中');
eq(c.snapshot().items.map, '携行中');
eq(c.snapshot().items.medicine, '配達済み');
rejects(() => c.startUpdate(), 'no sixth update exists');
rejects(() => c.completeSection(), 'complete is idempotently rejected');
const saved = c.exportSave();
const imported = boot();
imported.importSave(saved);
eq(imported.snapshot().history, c.snapshot().history, 'backup restores battle outcomes');
eq(imported.snapshot().items, c.snapshot().items, 'backup restores inventory');
const history = imported.historyResult(0);
history.won = false;
ok(imported.historyResult(0).won, 'history result is defensive copy');
eq(imported.historyResult(4), null, 'fifth update has no battle result');
eq(imported.historyResult(5), null, 'unknown history result is null');

const before = imported.exportSave();
for (const invalid of ['{', '{}', JSON.stringify({...JSON.parse(saved), schema: 'future-v9'}), JSON.stringify({...JSON.parse(saved), completedCount: 4}), JSON.stringify({...JSON.parse(saved), items: {}})]) {
  rejects(() => imported.importSave(invalid), 'invalid import is rejected');
  eq(imported.exportSave(), before, 'invalid import is atomic');
}
const malformedHistory = JSON.parse(saved);
malformedHistory.history[0].result.states = [];
rejects(() => imported.importSave(JSON.stringify(malformedHistory)), 'unsafe battle shape is rejected');
const brokenHP = JSON.parse(saved);
brokenHP.history[0].result.allies[0].hp = null;
rejects(() => imported.importSave(JSON.stringify(brokenHP)), 'invalid HP is rejected');
const brokenOrder = JSON.parse(saved);
brokenOrder.history.reverse();
rejects(() => imported.importSave(JSON.stringify(brokenOrder)), 'history order is checked');

for (const raw of ['{bad', JSON.stringify({schema: 'future-v9'}), JSON.stringify({...JSON.parse(saved), phase: 'pre', current: 88})]) {
  const damagedStorage = memory({[State.KEY]: raw});
  const damaged = boot(damagedStorage);
  eq(damaged.storageStatus().mode, 'blocked');
  ok(!damaged.storageStatus().ok);
  damaged.setReadingSize('large');
  eq(damagedStorage.getItem(State.KEY), raw, 'corrupt raw save is never silently overwritten');
  eq(damagedStorage.writes, 0);
  damaged.reset();
  eq(damaged.snapshot().completedCount, 0);
  eq(damaged.storageStatus().mode, 'saved', 'explicit reset clears protection');
  ok(JSON.parse(damagedStorage.getItem(State.KEY)).schema === State.SCHEMA);
}
const quotaStorage = memory();
quotaStorage.setItem = function() { throw Error('quota exceeded'); };
const quota = boot(quotaStorage);
quota.setAction('main');
quota.startUpdate();
eq(quota.snapshot().phase, 'pre', 'storage failure retains in-memory progress');
eq(quota.storageStatus().mode, 'memory');
ok(!quota.storageStatus().ok && quota.storageStatus().error, 'storage failure is visible');
const rescue = boot();
rescue.importSave(quota.exportSave());
eq(rescue.snapshot().phase, 'pre', 'export rescues progress even when autosave fails');
const unavailable = boot({getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }});
eq(unavailable.storageStatus().mode, 'memory', 'unavailable storage is distinct from corrupted save');

const loseEngine = {
  validate: battle.validate,
  simulate(args) {
    const result = copy(battle.simulate(args));
    const end = result.states.at(-1);
    end.allies.forEach(unit => { unit.hp = 0; });
    end.enemies.forEach(unit => { unit.hp = unit.maxhp; });
    result.allies = copy(end.allies); result.enemies = copy(end.enemies);
    result.remainingPartyHP = 0;
    result.remainingEnemyHP = result.enemies.reduce((sum, unit) => sum + unit.hp, 0);
    result.won = false; result.finishReason = 'annihilated';
    return result;
  }
};
const defeatedStorage = memory();
const defeated = boot(defeatedStorage, loseEngine);
defeated.setAction('main'); defeated.startUpdate(); defeated.goBattle(); defeated.runBattle();
eq(defeated.snapshot().phase, 'result');
ok(!defeated.snapshot().result.won);
rejects(() => defeated.readPost(), 'defeat cannot unlock postbattle prose');
rejects(() => defeated.completeSection(), 'defeat cannot grant rewards or progress');
eq(defeated.snapshot().history.length, 0);
eq(defeated.snapshot().items, boot().snapshot().items, 'defeat does not grant even the first section rewards');
assertRestores(defeated, defeatedStorage, 'defeat resumes for retry');
const retry = boot(defeatedStorage);
retry.setPlan(0, 'survive');
eq(retry.snapshot().phase, 'battle');
eq(retry.snapshot().result, null);
retry.runBattle(); retry.readPost(); retry.completeSection();
eq(retry.snapshot().completedCount, 1, 'retry commits only the same first update');
eq(retry.snapshot().history.length, 1);

const duplicate = boot(); duplicate.setAction('main'); duplicate.startUpdate(); duplicate.goBattle();
duplicate.setPlan(0, 'survive'); duplicate.setPlan(1, 'survive');
const duplicateBefore = duplicate.exportSave();
rejects(() => duplicate.runBattle(), 'once-per-battle skill duplicates are rejected by engine');
eq(duplicate.exportSave(), duplicateBefore, 'invalid reservation cannot resolve or mutate progress');
console.log(`PASS state: ${checks} checks; five updates, autosave/reload at every phase, failure/retry, corrupt-save protection, quota fallback, atomic import.`);
