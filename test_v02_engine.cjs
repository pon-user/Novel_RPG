const assert=require('node:assert/strict');global.window=global;require('./data.js');const B=require('./battle.js'),D=global.GAME_DATA;
const enc=id=>D.encounters.find(e=>e.id===id);
const roster=['H','02','04','07'],equip={H:{},'02':{},'04':{},'07':{}};
const p=B.basicPlan(roster);
assert.equal(p.length,5);assert.ok(p.every(row=>roster.every(id=>!('target' in row[id]))));
const x=B.simulate({encounterId:'E01',roster,gem:'balanced',gear:equip,plan:p});assert.ok(x.logs.length);assert.ok(x.observed.length);assert.equal(x.logs[0].actorId,null);
// No enemy information in a player's plan; attacker picks target after enemies appear.
const ctx={encounterId:'E03',gem:'balanced',allies:B.makeParty(roster,'balanced',equip),enemies:enc('E03').enemies.map(row=>B.unit(row,'enemy'))};
assert.equal(B.chooseTarget(ctx,ctx.allies.find(u=>u.id==='04'),B.skill('04.basic'))[0].immuneKinds.includes('magic'),false);
assert.equal(B.chooseTarget(ctx,ctx.allies.find(u=>u.id==='02'),B.skill('02.basic'))[0].immuneKinds.includes('physical'),false);
B.addStatus(ctx.allies.find(u=>u.id==='H'),'poison',3);const target=B.chooseTarget(ctx,ctx.allies.find(u=>u.id==='07'),B.skill('07.02'))[0];assert.equal(target.id,'H');
B.validate({encounterId:'E03',roster,gem:'balanced',gear:equip,plan:p});
let count=0;const ids=['02','03','04','05','06','07'];for(const e of D.encounters){for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)for(let k=j+1;k<ids.length;k++){
 const group=['H',ids[i],ids[j],ids[k]],plan=B.autoPlan(group,'balanced');B.validate({encounterId:e.id,roster:group,gem:'balanced',gear:{},plan});const outcome=B.simulate({encounterId:e.id,roster:group,gem:'balanced',gear:{},plan});assert.ok(outcome.round<=5);count++}}
assert.equal(count,340);console.log(`PASS: ${count} combinations + dynamic target selection + poison + concealment`);
