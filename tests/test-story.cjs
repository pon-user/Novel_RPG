'use strict';
// Offline checks against pinned GitHub source blobs. Fixtures are private review inputs,
// not part of the deployed docs directory.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const story = require('../docs/prologue-story-v04.js');
const battle = require('../docs/prologue-battle-v04.js');
const fixtureDir = path.join(__dirname, 'fixtures');
const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8'));
let checks = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const ok = (value, label) => { assert.ok(value, label); checks++; };
function fixture(file) { return fs.readFileSync(path.join(fixtureDir, file), 'utf8'); }
function blobSha(bytes) {
  return crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}
function proseFromSource(source) {
  const heading = '# 序章『丘の向こうの道』\n';
  const start = source.indexOf(heading);
  assert.notEqual(start, -1, 'canonical prose heading must exist');
  const fromHeading = source.slice(start);
  const managementBoundary = fromHeading.indexOf('\n---');
  const body = managementBoundary === -1 ? fromHeading : fromHeading.slice(0, managementBoundary);
  // The separator and surrounding terminal blank lines belong to source management.
  // Keep every character within the prose, including scene separators and blank lines.
  return body.replace(/\n+$/, '') + '\n';
}

eq(story.sourceRef, manifest.ref, 'story uses the reviewed GitHub commit');
eq(story.sections.length, 5, 'the approved prologue has five sections');
for (const source of manifest.sources) {
  const bytes = fs.readFileSync(path.join(fixtureDir, source.file));
  eq(blobSha(bytes), source.sha, source.file + ': exact downloaded Git blob');
}
eq(blobSha(fs.readFileSync(path.join(fixtureDir, manifest.battleDesign.file))), manifest.battleDesign.sha, 'current battle design source blob is exact');
ok(fixture('section-1-approved-reference.md').includes('![[' + story.sections[0].origin.path.replace(/\.md$/, '') + ']]'), 'resolve the first approved section embed');
eq(story.sections[0].approvedReference.sha, manifest.sources[1].sha, 'first section approval reference is pinned');
ok(fixture('progress-master.md').includes('小説本文すべて正式確定'), 'progress master confirms all prose');

let totalCharacters = 0;
for (let i = 0; i < 5; i++) {
  const section = story.sections[i];
  const source = manifest.sources.find(x => x.file === 'section-' + (i + 1) + '-source.md');
  const prose = proseFromSource(fixture(source.file));
  const reconstructed = section.pre + (section.anchor || '') + section.post;
  eq(reconstructed, prose, 'section ' + (i + 1) + ': every original prose character is present');
  eq(section.sourceLength, prose.length, 'section ' + (i + 1) + ': source length');
  eq(section.origin.path, source.path, 'section ' + (i + 1) + ': source path');
  eq(section.origin.sha, source.sha, 'section ' + (i + 1) + ': source blob');
  eq(section.updateNumber, i + 1, 'one section per MVP update');
  ok(!/本文外|制作・監査メモ|正式承認・原稿管理|正式確定・版管理記録/.test(reconstructed), 'source management notes are excluded');
  const p = section.progress;
  eq(p.route[0].placeId, p.start.placeId, 'route starts at section start');
  eq(p.route.at(-1).placeId, p.end.placeId, 'route ends at section end');
  if (i) eq(p.start.placeId, story.sections[i - 1].progress.end.placeId, 'locations are continuous between updates');
  for (const stage of [p.start, p.battle, p.end].filter(Boolean)) {
    eq(stage.items.gem, '未取得', 'no gem is acquired during the prologue');
    eq(stage.items.sword, '未取得', 'chapter one sword is not acquired early');
  }
  if (i < 4) {
    eq(section.battleId, 'BTL-000' + (i + 1), 'approved battle IDs remain in order');
    eq(reconstructed.split(section.anchor).length - 1, 1, 'each battle marker occurs once');
    eq(p.battle.companions, battle.ENCOUNTERS[section.battleId].party, 'battle participants match the story');
    eq(p.battle.skills, battle.ENCOUNTERS[section.battleId].unlocked, 'skills match the current encounter unlocks');
    ok(!p.battle.skills.includes('cheer'), 'the chapter one skill is unavailable in all four battles');
    ok(section.pre.length > 0 && section.post.length > 0, 'both sides of each battle are retained');
  } else {
    eq(section.battleId, null, 'the fifth section is noncombat');
    eq(section.anchor, null, 'the fifth section has no battle marker');
    eq(section.post, '', 'the fifth section prose is complete in pre');
    eq(p.battle, null, 'the fifth section has no battle projection');
    ok(section.pre.endsWith('　――序章『丘の向こうの道』・終――\n'), 'the complete approved ending is present');
  }
  totalCharacters += prose.length;
}

const progress = story.sections.map(x => x.progress);
eq(progress[0].start.items.order, '未受領', 'the family has not handed over the order at episode start');
eq(progress[0].start.items.money, '未受領', 'the family has not handed over payment at episode start');
eq(progress[0].battle.items.order, '携行中', 'the order is carried when the first battle starts');
eq(progress[1].battle.items.medicine, '携行中', 'medicine is received before the second battle');
eq(progress[1].battle.items.money, '支払い済み', 'medicine payment precedes the second battle');
eq(progress[1].battle.items.vial, '未取得', 'vial is not received before the rescue');
eq(progress[1].end.items.vial, '携行中', 'vial is received after the second battle');
eq(progress[2].battle.items.medicine, '配達済み', 'medicine is delivered before the third battle');
eq(progress[2].battle.items.vial, '自宅の窓辺', 'vial is left at home before the third battle');
eq(progress[3].start.cheerUnlocked, false, 'support skill is locked before the fourth battle');
eq(progress[3].end.cheerUnlocked, true, 'support skill is learned after the fourth victory');
eq(progress[3].end.placeId, 'RINEL_SQUARE', 'the fourth episode returns to the village');
eq(progress[4].end.items.map, '携行中', 'map is packed by the end of the fifth episode');
eq(progress[4].end.items.vial, '携行中', 'vial is packed by the end of the fifth episode');
eq(progress[4].end.placeId, 'RINEL_HOME', 'the prologue ends at home on departure eve');
console.log('PASS story: ' + checks + ' assertions; ' + totalCharacters + ' original prose characters, 5 approved sections and 4 battle boundaries');
