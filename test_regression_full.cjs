const assert=require('node:assert/strict'),fs=require('node:fs');global.window=global;require('./data.js');require('./samples.js');const E=require('./battle.js'),D=GAME_DATA;
const choose=(arr,n)=>n===0?[[]]:arr.flatMap((x,i)=>choose(arr.slice(i+1),n-1).map(t=>[x,...t]));
const teams=choose(['02','03','04','05','06','07'],3);
const report={engine:'playable browser JS port',tests:[],smoke:{total:0,success:0,errors:[]},samples:{}};
function test(name,fn){try{fn();report.tests.push({name,pass:true})}catch(e){report.tests.push({name,pass:false,error:e.message});throw e}}
const basicGear=(roster,gem)=>Object.fromEntries(roster.map(id=>{let ori=id==='H'?(gem==='tide'?'magic':'physical'):['02','06'].includes(id)?'physical':'magic';let a=D.gearsByFamily.mixed[ori];return [id,{W:a.find(x=>x[0]==='W'),A:a.find(x=>x[0]==='A'),X:a.find(x=>x[0]==='X')}]}));
const get=id=>D.encounters.find(e=>e.id===id);
test('17 unique encounters, 20 roster choices',()=>{assert.equal(D.encounters.length,17);assert.equal(teams.length,20);assert.equal(new Set(D.encounters.map(e=>e.id)).size,17)});
test('exactly only E03 S9 and E04 C13 proposals enabled',()=>{
 assert.equal(get('E03').enemies.find(x=>x.id==='wraith').hp,275);
 assert.equal(get('E03').enemies.find(x=>x.id==='executioner').hp,740);
 assert.deepEqual(get('E04').enemies.find(x=>x.id==='hexer').script[1],['POISON_ALL']);
 assert.deepEqual(get('E04').enemies.find(x=>x.id==='hexer').script[3],['POISON_ALL']);
 assert.equal(get('EP_B').enemies.find(x=>x.id==='arcane').hp,780);
 assert.equal(get('EP_B').objective,'defeat');
});
test('S5 buffs + defense priority + legacy skill IDs + attack130',()=>{
 assert.equal(D.skills['03.01'].pct,.45);assert.equal(D.skills['03.ult'].pct,.35);
 assert.equal(D.skills['05.02'].pct,-.25);
 assert.equal(D.skills['02.05'].label,'鉄壁');assert.equal(D.skills['02.06'].label,'破砕');
 assert.equal(D.skills['02.12'].type,'cover_aoe');assert.equal(D.characters['04'].matk,130);assert.equal(D.characters['06'].patk,130);
});
test('stacked buff damage = 1.9575',()=>{let u=E.unit('04','ally'),x=E.stats(u,'matk');E.addBuff(u,['matk'],.45,3);E.addBuff(u,['patk','matk'],.35,3);assert.ok(Math.abs(E.stats(u,'matk')/x-1.9575)<1e-10)});
test('all 17 encounters × all 20 rosters run in 5 turns',()=>{
 for(const encounter of D.encounters)for(const team of teams){const roster=['H',...team],gem='balanced',gear=basicGear(roster,gem),plan=E.autoPlan(roster,gem,encounter);
  try{const x=E.simulate({encounterId:encounter.id,roster,gem,gear,plan});report.smoke.total++;report.smoke.success+=Number(x.round>=1&&x.round<=5&&x.states.length===x.round+1)}catch(e){report.smoke.errors.push({encounter:encounter.id,roster,error:e.message})}
 }
 assert.equal(report.smoke.success,340);assert.equal(report.smoke.errors.length,0);
});
test('02 area cover intercepts E13 AoE',()=>{
 const roster=['H','02','06','07'],gem='balanced',gear=basicGear(roster,gem),enc=get('E13'),plan=E.autoPlan(roster,gem,enc);
 plan[0]['02']={skill:'02.12',target:'06'};for(let i=1;i<5;i++)if(plan[i]['02'].skill==='02.12')plan[i]['02']={skill:'02.basic',target:enc.enemies[0].id};
 const x=E.simulate({encounterId:'E13',roster,gem,gear,plan});assert.ok(x.metrics.aoeCover>0);
});
test('07 cures enemy poison in round2 and buff is granted',()=>{
 const s=GAME_SAMPLES.E04,x=E.simulate({encounterId:'E04',roster:s.roster,gem:s.gem,gear:s.equipment,plan:s.plan});assert.ok(x.won);assert.ok(x.metrics.purification>0);
});
test('physical defense priority acts before 145-speed scout',()=>{
 const roster=['H','02','04','06'],gem='balanced',gear=basicGear(roster,gem),enc=get('E03'),plan=E.autoPlan(roster,gem,enc);
 plan[0]['02']={skill:'02.02',target:'H'};
 const x=E.simulate({encounterId:'E03',roster,gem,gear,plan});let i=x.logs.findIndex(l=>l.text.includes('庇護')),j=x.logs.findIndex(l=>l.text.includes('双壁の斥候 →'));assert.ok(i>=0&&j>=0&&i<j);
});
test('E03/E04 witnessed demonstration victories',()=>{
 for(let id of ['E03','E04']){let s=GAME_SAMPLES[id],x=E.simulate({encounterId:id,roster:s.roster,gem:s.gem,gear:s.equipment,plan:s.plan});report.samples[id]={win:x.won,round:x.round,remainingPartyHP:x.remainingPartyHP};assert.ok(x.won)}
});
test('each unique skill once per encounter',()=>{
 const s=GAME_SAMPLES.E03;let plan=JSON.parse(JSON.stringify(s.plan));plan[1]['02']=JSON.parse(JSON.stringify(plan[0]['02']));assert.throws(()=>E.validate({encounterId:'E03',roster:s.roster,gem:s.gem,gear:s.equipment,plan}),/1戦で1回/);
});
fs.writeFileSync('test-results.json',JSON.stringify(report,null,2));console.log('PASS',report.tests.length,'regressions /',report.smoke.total,'battle simulations');console.log('DEMO WINS',report.samples);
