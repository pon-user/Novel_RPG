/* NovelRPG prologue adapter v0.4. New mode; old v0.3 remains immutable.
 * Combat formula matches the v0.3 C1 basic mitigation rule.
 * NPCs are scripted, never player-controlled. Spec numbers are provisional.
 */
(function(root){
"use strict";
const copy=x=>JSON.parse(JSON.stringify(x));
const CHARACTER={
 aria:{name:"アリア",hp:300,patk:100,matk:85,pdef:90,mdef:90,spd:150},
 captain:{name:"自警団長",hp:400,patk:110,matk:25,pdef:170,mdef:90,spd:100},
 memberA:{name:"自警団員A",hp:280,patk:55,matk:110,pdef:85,mdef:100,spd:105},
 traveler:{name:"旅人",hp:290,patk:95,matk:30,pdef:105,mdef:90,spd:120},
 e1:{name:"林の小型魔獣",hp:125,patk:65,matk:0,pdef:55,mdef:50,spd:80},
 e2:{name:"石橋の魔獣",hp:125,patk:75,matk:0,pdef:70,mdef:55,spd:82},
 e3:{name:"畑の硬い魔獣",hp:310,patk:105,matk:0,pdef:360,mdef:25,spd:75},
 big:{name:"大型魔獣",hp:465,patk:105,matk:0,pdef:120,mdef:90,spd:80},
 small:{name:"小型魔獣",hp:205,patk:65,matk:0,pdef:60,mdef:55,spd:70}
};
const SKILLS={
 basic:{label:"通常攻撃",type:"attack",power:100,kind:"physical",uses:Infinity},
 survive:{label:"生存優先",type:"dodge",uses:1},
 heavy:{label:"強打",type:"attack",power:120,kind:"physical",uses:1},
 fire:{label:"炎魔法",type:"attack",power:120,kind:"magic",uses:1,chargeTurns:0},
 mark:{label:"弱いの優先！",type:"mark",power:80,kind:"physical",uses:1,rounds:3},
 cheer:{label:"みんながんばろ！",type:"buff",pct:.30,rounds:2,scope:"allies",uses:1,chargeTurns:0},
 cover:{label:"庇う",type:"cover",uses:1,priority:1},
 taunt:{label:"挑発",type:"taunt",uses:1,priority:1},
 guardStrong:{label:"強撃",type:"attack",power:140,kind:"physical",uses:1},
 guardFive:{label:"5連撃",type:"attack",power:60,hits:5,kind:"physical",chargeTurns:1,uses:1},
 defUp:{label:"防御上昇",type:"buff",pct:.20,rounds:2,scope:"allies",uses:1},
 water:{label:"水魔法",type:"attack",power:200,kind:"magic",chargeTurns:1,uses:1},
 mageFire:{label:"炎魔法（団員）",type:"attack",power:250,kind:"magic",chargeTurns:1,uses:1},
 feint:{label:"牽制撃",type:"attack",power:100,kind:"physical",weakens:.20,uses:1},
 travelStrong:{label:"強打（旅人）",type:"attack",power:150,kind:"physical",uses:1},
 travelDouble:{label:"2連撃",type:"attack",power:80,hits:2,kind:"physical",uses:1}
};
const ENCOUNTERS={
 "BTL-0001":{name:"初めての実戦",party:["aria"],enemies:["e1"],unlocked:["basic","survive"],npc:{}},
 "BTL-0002":{name:"行商人と荷車を守る",party:["aria"],enemies:["e2"],unlocked:["basic","survive","heavy"],npc:{}},
 "BTL-0003":{name:"畑の防衛",party:["aria","captain","memberA"],enemies:["e3"],unlocked:["basic","survive","heavy","fire"],npc:{
 captain:["cover","taunt","guardStrong","guardFive","@release"],
 memberA:["defUp","water","@release","mageFire","@release"]}},
 "BTL-0004":{name:"北街道の防衛",party:["aria","captain","memberA","traveler"],enemies:["big","small"],unlocked:["basic","survive","heavy","fire","mark"],npc:{
 captain:["guardStrong","basic","cover","guardFive","@release"],
 memberA:["defUp","water","@release","mageFire","@release"],
 traveler:["basic","feint","travelStrong","basic","travelDouble"]}}
};
const living=u=>u.hp>0;
function normalizePlan(plan){
 if(!Array.isArray(plan)||plan.length!==5)throw Error("PLAN_MUST_HAVE_FIVE_ROUNDS");
 const mapping={"AR-BASIC":"basic","AR-SURVIVE":"survive","AR-HEAVY":"heavy","AR-FIRE":"fire","AR-MARK":"mark","AR-ULT":"cheer"};
 return plan.map(item=>{
   if(typeof item==="string")return mapping[item]||item;
   if(!item||typeof item!=="object"||Array.isArray(item))throw Error("BAD_PLAN");
   const actorKeys=Object.keys(item).filter(key=>key!=="skill");
   const wrapped=Object.hasOwn(item,"aria")||Object.hasOwn(item,"H");
   if(wrapped&&(actorKeys.length!==1||Object.hasOwn(item,"skill")))throw Error("ONLY_ARIA_CAN_BE_RESERVED");
   if(!wrapped&&actorKeys.length)throw Error("ONLY_ARIA_CAN_BE_RESERVED");
   const p=wrapped?(item.aria??item.H):item;
   if(typeof p!=="string"&&(!p||typeof p!=="object"||Array.isArray(p)||Object.keys(p).some(key=>key!=="skill")))throw Error("BAD_PLAN");
   const sid=typeof p==="string"?p:p.skill;
   if(typeof sid!=="string")throw Error("BAD_PLAN");
   return mapping[sid]||sid;
 });
}
function validate({encounterId,plan,gem=null,roster}){
 const encounter=ENCOUNTERS[encounterId];if(!encounter)throw Error("UNKNOWN_ENCOUNTER");
 if(gem!==null&&gem!==undefined)throw Error("GEM_NOT_AVAILABLE_IN_PROLOGUE");
 if(roster&&JSON.stringify(roster)!==JSON.stringify(encounter.party))throw Error("PARTY_MUST_MATCH_STORY");
 const steps=normalizePlan(plan);
 const used=new Set();
 for(const s of steps){
   if(!encounter.unlocked.includes(s))throw Error("LOCKED_SKILL:"+s);
   if(SKILLS[s].uses===1&&used.has(s))throw Error("SKILL_ONCE:"+s);
   if(SKILLS[s].uses===1)used.add(s);
 }
 return {encounter,steps};
}
function simulate(args){
 const {encounter,steps}=validate(args),idx=ENCOUNTERS[args.encounterId];
 const make=(id,side)=>({id,side,name:CHARACTER[id].name,maxhp:CHARACTER[id].hp,hp:CHARACTER[id].hp,base:copy(CHARACTER[id]),
   dodge:0,charge:null,charging:false,coverUntil:0,tauntUntil:0,buffs:[],weakUntil:0,damageTaken:0});
 const allies=encounter.party.map(x=>make(x,"ally")),enemies=encounter.enemies.map(x=>make(x,"enemy")),everyone=[...allies,...enemies];
 const get=id=>everyone.find(x=>x.id===id);
 const logs=[],states=[],npcUsed={},metrics={damage:0,avoided:0,redirected:0,chargeExtra:0,smallAttackRounds:0};
 // Presentation-only evidence. The original result fields, logs and damage rules remain unchanged.
 const turns=[];let currentTurn=null,currentAction=null,actionSequence=0;
 let round=0,marked=null,markUntil=0,won=false,finishReason="round_limit";
 const say=(actorId,type,detail={},s)=>logs.push({round,actorId,type,text:s||type,...detail});
 const buff=(u,key)=>u.buffs.filter(b=>b.until>=round&&b.keys.includes(key)).reduce((sum,b)=>sum+b.pct,0);
 const stat=(u,key)=>Math.max(0,(u.base[key]||0)*(1+buff(u,key))*(key==="patk"&&u.weakUntil>=round?.8:1));
 const target=()=>enemies.find(e=>living(e)&&e.id===marked&&markUntil>=round)||enemies.find(living);
 function snapshot(u){
   const statuses=[];
   const timed=(kind,label,until)=>{if(until>=round)statuses.push({kind,label,remainingRounds:until-round+1});};
   if(!living(u))statuses.push({kind:"knockout",label:"戦闘不能",remainingRounds:null});
   if(u.dodge>0)statuses.push({kind:"dodge",label:"回避",remainingRounds:null,charges:u.dodge});
   if(u.charging&&u.charge)statuses.push({kind:"charge",label:SKILLS[u.charge.skillId].label+"の溜め",remainingRounds:Math.max(0,u.charge.readyAt-round),skillName:SKILLS[u.charge.skillId].label,readyAt:u.charge.readyAt});
   timed("cover","アリアを庇う",u.coverUntil);
   timed("taunt","挑発",u.tauntUntil);
   timed("weaken","物理攻撃力低下",u.weakUntil);
   for(const b of u.buffs.filter(b=>b.until>=round))statuses.push({kind:"buff",label:b.keys.includes("patk")?"攻撃・防御上昇":"防御上昇",remainingRounds:b.until-round+1,pct:b.pct});
   if(u.id===marked&&living(u))timed("mark","標的",markUntil);
   return {id:u.id,name:u.name,side:u.side,hp:u.hp,maxhp:u.maxhp,alive:living(u),statuses,
     stats:Object.fromEntries(["patk","matk","pdef","mdef","spd"].map(key=>[key,stat(u,key)])),
     charge:u.charge?{skillId:u.charge.skillId,skillName:SKILLS[u.charge.skillId].label,readyAt:u.charge.readyAt}:null};
 }
 const snapshotAll=()=>({allies:allies.map(snapshot),enemies:enemies.map(snapshot)});
 const effect=(kind,detail,text)=>{if(currentAction)currentAction.effects.push({kind,...detail,text});};
 function beginAction(u){
   const reserved=u.side==="enemy"?(u.id==="small"?"enemyAoe":"enemyBasic"):u.id==="aria"?steps[round-1]:idx.npc[u.id]?.[round-1];
   const skillId=reserved==="@release"?u.charge?.skillId:reserved;
   const sk=SKILLS[skillId];
   currentAction={sequence:++actionSequence,actorId:u.id,actorName:u.name,skillId,
     skillName:sk?.label||(u.id==="small"?"全体攻撃":"通常攻撃"),
     phase:reserved==="@release"?"release":sk?.chargeTurns>0?"prepare":"action",effects:[]};
   currentTurn.actions.push(currentAction);
 }
 function applyDamage(actor,victim,sk,options={}){
   if(!victim||!living(victim))return 0;
   let recipient=victim,redirect=false;
   if(actor.side==="enemy"&&!options.aoe){
     const captain=get("captain");
     if(captain&&living(captain)&&((captain.tauntUntil>=round)||(victim.id==="aria"&&captain.coverUntil>=round))){
       recipient=captain;redirect=recipient.id!==victim.id;if(redirect){metrics.redirected++;
         effect("redirect",{targetId:recipient.id,targetName:recipient.name,originalTargetId:victim.id,originalTargetName:victim.name,reason:captain.tauntUntil>=round?"taunt":"cover"},captain.name+"が"+(captain.tauntUntil>=round?"挑発で攻撃を引き受けた":victim.name+"を庇った"));}
     }
   }
   if(actor.side==="enemy"&&!options.aoe&&recipient.dodge>0){
     recipient.dodge--;metrics.avoided++;say(actor.id,"dodge",{targetId:recipient.id},recipient.name+"は攻撃を回避した");
     effect("dodge",{targetId:recipient.id,targetName:recipient.name,hpAfter:recipient.hp,remainingCharges:recipient.dodge},recipient.name+"は攻撃を回避した（残り"+recipient.dodge+"回）");return 0;
   }
   const atk=stat(actor,sk.kind==="magic"?"matk":"patk"),def=stat(recipient,sk.kind==="magic"?"mdef":"pdef");
   let value=Math.max(1,Math.floor(atk*(sk.power||100)/100*100/(100+def)+1e-9));
   if(options.fixed!==undefined)value=options.fixed;
   const unchargedValue=value;
   if(recipient.charging){const extra=Math.floor(value*1.2)-value;metrics.chargeExtra+=extra;value+=extra;}
   const hpBefore=recipient.hp;
   const dealt=Math.min(recipient.hp,value);recipient.hp-=dealt;recipient.damageTaken+=dealt;
   if(actor.side==="ally")metrics.damage+=dealt;
   say(actor.id,"damage",{targetId:recipient.id,damage:dealt,source:sk.kind,redirected:redirect,charging:recipient.charging},actor.name+" → "+recipient.name+" "+dealt+"ダメージ"+(recipient.charging?"（溜め中×1.2）":""));
   // These comparisons hold the actual actor, recipient, hit and HP cap fixed.
   // Report each factor independently; their values must not be added as a causal battle total.
   const comparison=(comparisonAtk,comparisonDef)=>{
     let n=Math.max(1,Math.floor(comparisonAtk*(sk.power||100)/100*100/(100+comparisonDef)+1e-9));
     if(options.fixed!==undefined)n=options.fixed;
     if(recipient.charging)n=Math.floor(n*1.2);
     return Math.min(hpBefore,n);
   };
   const attackWithoutWeakening=(actor.base[sk.kind==="magic"?"matk":"patk"]||0)*(1+buff(actor,sk.kind==="magic"?"matk":"patk"));
   const defenseWithoutBuff=recipient.base[sk.kind==="magic"?"mdef":"pdef"]||0;
   const defensePrevented=Math.max(0,comparison(atk,defenseWithoutBuff)-dealt);
   const feintPrevented=Math.max(0,comparison(attackWithoutWeakening,def)-dealt);
   const chargeExtra=recipient.charging?Math.max(0,dealt-Math.min(hpBefore,unchargedValue)):0;
   effect("damage",{targetId:recipient.id,targetName:recipient.name,originalTargetId:victim.id,damage:dealt,hpBefore,hpAfter:recipient.hp,maxhp:recipient.maxhp,
     redirected:redirect,charging:recipient.charging,chargeExtra,defensePrevented,feintPrevented,comparisonBasis:"same-hit-with-one-effect-removed",followedMark:actor.side==="ally"&&victim.id===marked&&markUntil>=round,hit:currentAction?.hit||1,hits:currentAction?.hits||1},
     recipient.name+"に"+dealt+"ダメージ → HP "+recipient.hp+" / "+recipient.maxhp+(recipient.charging?"（溜め中の被ダメージ増加）":""));
   if(!living(recipient))effect("knockout",{targetId:recipient.id,targetName:recipient.name,hpAfter:0},recipient.name+"は戦闘不能になった");
   if(!living(recipient)&&recipient.charge){
     say(recipient.id,"charge_cancel",{skill:recipient.charge.skillId},recipient.name+"は戦闘不能になり、準備中の技能が中断された");
     effect("cancel",{targetId:recipient.id,targetName:recipient.name,skillId:recipient.charge.skillId,skillName:SKILLS[recipient.charge.skillId].label},recipient.name+"の"+SKILLS[recipient.charge.skillId].label+"は発動前に中断された");
     recipient.charge=null;recipient.charging=false;
   }
   return dealt;
 }
 function execute(u,skillId,release=false){
   const s=SKILLS[skillId];if(!s)throw Error("UNKNOWN_SKILL:"+skillId);
   if(!release&&s.chargeTurns>0){
     u.charge={skillId,readyAt:round+s.chargeTurns};u.charging=true;
     say(u.id,"charge",{skill:skillId,readyAt:u.charge.readyAt},u.name+"は"+s.label+"の準備を始めた");
     effect("prepare",{targetId:u.id,targetName:u.name,skillId,skillName:s.label,readyAt:u.charge.readyAt},s.label+"の溜めを開始。第"+u.charge.readyAt+"ターンに発動予定");return;
   }
   if(s.type==="dodge"){u.dodge=2;say(u.id,"dodge_ready",{charges:2},u.name+"は相手の動きを見た");effect("status",{targetId:u.id,targetName:u.name,status:"dodge",charges:2},u.name+"は次の単体攻撃を2回回避できる");return;}
   if(s.type==="cover"){u.coverUntil=round+2;say(u.id,"cover",{targetId:"aria"},u.name+"はアリアを庇う");effect("status",{targetId:"aria",targetName:get("aria").name,status:"cover",remainingRounds:3},u.name+"がアリアを庇う（このターンを含め3ターン）");return;}
   if(s.type==="taunt"){u.tauntUntil=round+1;say(u.id,"taunt",{},u.name+"は敵を挑発した");effect("status",{targetId:u.id,targetName:u.name,status:"taunt",remainingRounds:2},u.name+"が敵を挑発（このターンを含め2ターン）");return;}
   if(s.type==="buff"){
     const targets=s.scope==="allies"?allies.filter(living):[u];
     targets.forEach(x=>x.buffs.push({keys:s.scope==="allies"&&skillId==="cheer"?["patk","matk","pdef","mdef"]:["pdef","mdef"],pct:s.pct,until:round+s.rounds-1}));
     say(u.id,"buff",{skill:skillId,targets:targets.map(x=>x.id)},u.name+"は"+s.label+"を使った");
     for(const t of targets)effect("status",{targetId:t.id,targetName:t.name,status:"buff",remainingRounds:s.rounds,pct:s.pct},t.name+"の"+(skillId==="cheer"?"攻撃・防御":"防御")+"が"+Math.round(s.pct*100)+"%上昇（このターンを含め"+s.rounds+"ターン）");return;
   }
   const firstTarget=skillId==="mark"?enemies.filter(living).sort((a,b)=>a.maxhp-b.maxhp||enemies.indexOf(a)-enemies.indexOf(b))[0]:target();
   if(!firstTarget)return;
   const hits=s.hits||1;let dealt=0;
   if(currentAction)currentAction.hits=hits;
   for(let i=0;i<hits&&living(firstTarget);i++){if(currentAction)currentAction.hit=i+1;dealt+=applyDamage(u,firstTarget,s);}
   if(skillId==="mark"&&living(firstTarget)){marked=firstTarget.id;markUntil=round+s.rounds-1;say(u.id,"mark",{targetId:marked,until:markUntil},firstTarget.name+"に標的を付与");effect("mark",{targetId:marked,targetName:firstTarget.name,remainingRounds:s.rounds,until:markUntil},firstTarget.name+"を標的にした（このターンを含め"+s.rounds+"ターン）");}
   if(s.weakens&&living(firstTarget)){firstTarget.weakUntil=round+1;say(u.id,"weaken",{targetId:firstTarget.id},firstTarget.name+"の攻撃力が低下");effect("status",{targetId:firstTarget.id,targetName:firstTarget.name,status:"weaken",remainingRounds:2,pct:s.weakens},firstTarget.name+"の物理攻撃力が低下（このターンと次のターン）");}
   if(release){say(u.id,"release",{skill:skillId,damage:dealt},u.name+"の"+s.label+"が発動した");effect("release",{targetId:firstTarget.id,targetName:firstTarget.name,skillId,skillName:s.label,damage:dealt,hits:currentAction?.hit||1},s.label+"が発動し、合計"+dealt+"ダメージ");}
 }
 function enemyAction(u){
   if(u.id==="small"){
     metrics.smallAttackRounds++;
     say(u.id,"aoe",{},u.name+"が全体攻撃");
     for(const a of allies.filter(living))applyDamage(u,a,{kind:"physical",power:100},{aoe:true});
     return;
   }
   let victim=allies.find(x=>x.id==="aria"&&living(x))||allies.find(living);
   if(u.id==="big"&&round===4){const c=get("captain");if(c&&living(c)&&c.charging)victim=c;}
   if(victim)applyDamage(u,victim,{kind:"physical",power:100});
 }
 for(round=1;round<=5;round++){
   currentTurn={round,start:snapshotAll(),actions:[]};turns.push(currentTurn);
   const start=everyone.filter(living).sort((a,b)=>{
     const skill=x=>x.id==="aria"?steps[round-1]:idx.npc[x.id]?.[round-1];
     const priority=x=>x.side==="ally"?(SKILLS[skill(x)]?.priority||0):0;
     return priority(b)-priority(a)||b.base.spd-a.base.spd||everyone.indexOf(a)-everyone.indexOf(b);
   });
   for(const u of start){
     if(!living(u))continue;
     beginAction(u);
     if(u.side==="enemy")enemyAction(u);
     else if(u.id==="aria")execute(u,steps[round-1]);
     else {
       const id=idx.npc[u.id][round-1];if(!id)throw Error("NPC_SCRIPT_MISSING");
       if(id==="@release"){
         if(!u.charge||u.charge.readyAt!==round)throw Error("BAD_CHARGE_SEQUENCE");
         const charge=u.charge;u.charge=null;u.charging=false;
         execute(u,charge.skillId,true);
       } else {
         if(id!=="basic"){
           npcUsed[u.id]??=new Set();
           if(npcUsed[u.id].has(id))throw Error("NPC_SKILL_REUSED:"+id);
           npcUsed[u.id].add(id);
         }
         if(u.charge)throw Error("CHARGE_INTERRUPTED_WITHOUT_RESOLUTION");
         execute(u,id);
       }
     }
     if(!allies.some(living)){finishReason="annihilated";break;}
     if(!enemies.some(living)){finishReason="defeated";won=true;break;}
   }
   states.push({round,allies:allies.map(a=>({id:a.id,name:a.name,hp:a.hp,maxhp:a.maxhp,dodge:a.dodge,charging:a.charging})),
     enemies:enemies.map(e=>({id:e.id,name:e.name,hp:e.hp,maxhp:e.maxhp,marked:e.id===marked&&markUntil>=round&&living(e)}))});
   currentTurn.end=snapshotAll();currentAction=null;
   if(finishReason!=="round_limit")break;
 }
 const effects=turns.flatMap(t=>t.actions.flatMap(a=>a.effects));
 const summary={rounds:states.length,damageTaken:allies.reduce((sum,u)=>sum+u.damageTaken,0),avoided:metrics.avoided,redirected:metrics.redirected,
   chargeExtra:effects.filter(e=>e.kind==="damage").reduce((sum,e)=>sum+e.chargeExtra,0),
   markedTargets:turns.flatMap(t=>t.actions.flatMap(a=>a.effects.filter(e=>e.kind==="mark").map(e=>({id:e.targetId,name:e.targetName,round:t.round})))),
   markFollowupHits:effects.filter(e=>e.kind==="damage"&&e.followedMark).length,
   chargedReleases:turns.flatMap(t=>t.actions.filter(a=>a.phase==="release").map(a=>({actorId:a.actorId,actorName:a.actorName,skillId:a.skillId,skillName:a.skillName,round:t.round,
     damage:a.effects.filter(e=>e.kind==="damage").reduce((sum,e)=>sum+e.damage,0),hits:a.effects.filter(e=>e.kind==="damage").length}))),
   mitigationComparisons:turns.flatMap(t=>t.actions.flatMap(a=>a.effects.filter(e=>e.kind==="damage"&&(e.defensePrevented||e.feintPrevented)).map(e=>({round:t.round,actorName:a.actorName,targetName:e.targetName,defensePrevented:e.defensePrevented,feintPrevented:e.feintPrevented}))))};
 return {encounterId:args.encounterId,encounterName:encounter.name,won,finishReason,round:states.length,
   allies:states[states.length-1].allies,enemies:states[states.length-1].enemies,states,logs,metrics,
   remainingPartyHP:allies.reduce((a,x)=>a+x.hp,0),remainingEnemyHP:enemies.reduce((a,x)=>a+x.hp,0),
   engineVersion:"v0.4-prologue-integrated",gem:null,roster:encounter.party,telemetry:{version:1,turns,summary}};
}
// v0.5 history did not retain reservations. Recover only an exactly matching replay;
// never manufacture turn-start states from end-of-turn snapshots.
const telemetryCache=new Map();
function telemetryFor(result,plan){
 if(!result||!ENCOUNTERS[result.encounterId])return null;
 const signature=x=>JSON.stringify([x.encounterId,x.won,x.finishReason,x.round,x.states,x.logs,x.remainingPartyHP,x.remainingEnemyHP]);
 const key=signature(result);
 if(telemetryCache.has(key))return copy(telemetryCache.get(key));
 const match=steps=>{try{const replay=simulate({encounterId:result.encounterId,plan:steps,gem:null});return signature(replay)===key?replay.telemetry:null;}catch(e){return null;}};
 let found=plan?match(plan):null;
 const options=ENCOUNTERS[result.encounterId].unlocked;
 function visit(steps,used){
   if(found)return;
   if(steps.length===5){found=match(steps);return;}
   for(const skill of options)if(skill==="basic"||!used.has(skill))visit([...steps,skill],new Set([...used,skill]));
 }
 if(!found)visit([],new Set());
 if(telemetryCache.size>=32)telemetryCache.delete(telemetryCache.keys().next().value);
 telemetryCache.set(key,found);return copy(found);
}
const API={simulate,validate,SKILLS,ENCOUNTERS,CHARACTER,normalizePlan,telemetryFor,
 skillOptions:id=>{const e=ENCOUNTERS[id];if(!e)throw Error("UNKNOWN_ENCOUNTER");return e.unlocked.map(k=>({id:k,...SKILLS[k]}));}};
root.PrologueBattle=API;if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof window!=="undefined"?window:globalThis);

