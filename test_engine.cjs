const assert=require('node:assert/strict');
global.window=global;
require('./data.js');const B=require('./battle.js'), D=global.GAME_DATA;
const encounter=id=>D.encounters.find(x=>x.id===id);
const equips=()=>Object.fromEntries(['H','02','03','04','05','06','07'].map(id=>[id,{}]));
function test(id,roster=['H','02','04','07'],gem='balanced',kind='mixed'){
 const plan=B.autoPlan(roster,gem,encounter(id),kind);B.validate({encounterId:id,roster,gem,gear:equips(),plan});
 const out=B.simulate({encounterId:id,roster,gem,gear:equips(),plan});
 assert.ok(out.round>=1&&out.round<=5);assert.equal(out.states.length,out.round+1);
 return out;
}
for(const e of D.encounters){const r=test(e.id);console.log(e.id,r.won?'WIN':'LOSS',r.round,r.remainingEnemyHP,r.remainingPartyHP);}
assert.equal(D.encounters.length,17);
assert.equal(encounter('E03').enemies.find(x=>x.id==='wraith').hp,275);
assert.deepEqual(encounter('E04').enemies.find(x=>x.id==='hexer').script[1],['POISON_ALL']);
assert.equal(encounter('EP_B').enemies.find(x=>x.id==='arcane').hp,780,'R3 EP-B must remain: R4 B2 NOT adopted');
assert.equal(D.characters['04'].matk,130);assert.equal(D.characters['06'].patk,130);
// Buff stacking distinct target sets multipliatively.
const bob=B.unit('04','ally');const base=B.stats(bob,'matk');
B.addBuff(bob,['matk'],.45,3,'test');B.addBuff(bob,['patk','matk'],.35,3,'test');
assert.ok(Math.abs(B.stats(bob,'matk')/base-1.9575)<1e-8);
// E05 P1 attack-debuff only, E06 guard accepts poison.
const b=B.unit(encounter('E05').enemies[0],'enemy');
assert.equal(B.addBuff(b,['patk','matk'],-.25,4,'05',{encounterId:'E05',say:()=>{}}),true);
assert.equal(B.addBuff(b,['pdef'],-.25,4,'05',{encounterId:'E05',say:()=>{}}),false);
assert.equal(B.addStatus(B.unit(encounter('E06').enemies[1],'enemy'),'poison',3,{encounterId:'E06',say:()=>{}}),true);
const noCoverRoster=['H','03','04','05'];
const t=test('E04',noCoverRoster,'tide');
assert.ok(t.logs.some(l=>l.text.includes('毒で')||l.text.includes('猛毒で')),'Poison must tick after owner action');
// Defensive order: 02 cover applies even against fast scout.
const enc=encounter('E03');const roster=['H','02','04','06'];const p=B.autoPlan(roster,'balanced',enc);
p[0]['02']={skill:'02.02',target:'H'};
const result=B.simulate({encounterId:'E03',roster,gem:'balanced',gear:equips(),plan:p});
assert.ok(result.logs.some(x=>x.text.includes('ガルド（仮）が')&&x.text.includes('守る')),'Guard must act');
assert.ok(result.logs.findIndex(x=>x.text.includes('が主人公を単体攻撃'))<0);
// No repeated unique skills
p[1]['02']={skill:'02.02',target:'H'};
assert.throws(()=>B.validate({encounterId:'E03',roster,gem:'balanced',gear:equips(),plan:p}),/1戦で1回/);
console.log('ENGINE TESTS PASS');
