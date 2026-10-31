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
 let round=0,marked=null,markUntil=0,won=false,finishReason="round_limit";
 const say=(actorId,type,detail={},s)=>logs.push({round,actorId,type,text:s||type,...detail});
 const buff=(u,key)=>u.buffs.filter(b=>b.until>=round&&b.keys.includes(key)).reduce((sum,b)=>sum+b.pct,0);
 const stat=(u,key)=>Math.max(0,(u.base[key]||0)*(1+buff(u,key))*(key==="patk"&&u.weakUntil>=round?.8:1));
 const target=()=>enemies.find(e=>living(e)&&e.id===marked&&markUntil>=round)||enemies.find(living);
 function applyDamage(actor,victim,sk,options={}){
   if(!victim||!living(victim))return 0;
   let recipient=victim,redirect=false;
   if(actor.side==="enemy"&&!options.aoe){
     const captain=get("captain");
     if(captain&&living(captain)&&((captain.tauntUntil>=round)||(victim.id==="aria"&&captain.coverUntil>=round))){
       recipient=captain;redirect=recipient.id!==victim.id;if(redirect)metrics.redirected++;
     }
   }
   if(actor.side==="enemy"&&!options.aoe&&recipient.dodge>0){
     recipient.dodge--;metrics.avoided++;say(actor.id,"dodge",{targetId:recipient.id},recipient.name+"は攻撃を回避した");return 0;
   }
   const atk=stat(actor,sk.kind==="magic"?"matk":"patk"),def=stat(recipient,sk.kind==="magic"?"mdef":"pdef");
   let value=Math.max(1,Math.floor(atk*(sk.power||100)/100*100/(100+def)+1e-9));
   if(options.fixed!==undefined)value=options.fixed;
   if(recipient.charging){const extra=Math.floor(value*1.2)-value;metrics.chargeExtra+=extra;value+=extra;}
   const dealt=Math.min(recipient.hp,value);recipient.hp-=dealt;recipient.damageTaken+=dealt;
   if(actor.side==="ally")metrics.damage+=dealt;
   say(actor.id,"damage",{targetId:recipient.id,damage:dealt,source:sk.kind,redirected:redirect,charging:recipient.charging},actor.name+" → "+recipient.name+" "+dealt+"ダメージ"+(recipient.charging?"（溜め中×1.2）":""));
   if(!living(recipient)&&recipient.charge){
     say(recipient.id,"charge_cancel",{skill:recipient.charge.skillId},recipient.name+"は戦闘不能になり、準備中の技能が中断された");
     recipient.charge=null;recipient.charging=false;
   }
   return dealt;
 }
 function execute(u,skillId,release=false){
   const s=SKILLS[skillId];if(!s)throw Error("UNKNOWN_SKILL:"+skillId);
   if(!release&&s.chargeTurns>0){
     u.charge={skillId,readyAt:round+s.chargeTurns};u.charging=true;
     say(u.id,"charge",{skill:skillId,readyAt:u.charge.readyAt},u.name+"は"+s.label+"の準備を始めた");return;
   }
   if(s.type==="dodge"){u.dodge=2;say(u.id,"dodge_ready",{charges:2},u.name+"は相手の動きを見た");return;}
   if(s.type==="cover"){u.coverUntil=round+2;say(u.id,"cover",{targetId:"aria"},u.name+"はアリアを庇う");return;}
   if(s.type==="taunt"){u.tauntUntil=round+1;say(u.id,"taunt",{},u.name+"は敵を挑発した");return;}
   if(s.type==="buff"){
     const targets=s.scope==="allies"?allies.filter(living):[u];
     targets.forEach(x=>x.buffs.push({keys:s.scope==="allies"&&skillId==="cheer"?["patk","matk","pdef","mdef"]:["pdef","mdef"],pct:s.pct,until:round+s.rounds-1}));
     say(u.id,"buff",{skill:skillId,targets:targets.map(x=>x.id)},u.name+"は"+s.label+"を使った");return;
   }
   const firstTarget=skillId==="mark"?enemies.filter(living).sort((a,b)=>a.maxhp-b.maxhp||enemies.indexOf(a)-enemies.indexOf(b))[0]:target();
   if(!firstTarget)return;
   const hits=s.hits||1;let dealt=0;
   for(let i=0;i<hits&&living(firstTarget);i++)dealt+=applyDamage(u,firstTarget,s);
   if(skillId==="mark"&&living(firstTarget)){marked=firstTarget.id;markUntil=round+s.rounds-1;say(u.id,"mark",{targetId:marked,until:markUntil},firstTarget.name+"に標的を付与");}
   if(s.weakens&&living(firstTarget)){firstTarget.weakUntil=round+1;say(u.id,"weaken",{targetId:firstTarget.id},firstTarget.name+"の攻撃力が低下");}
   if(release)say(u.id,"release",{skill:skillId,damage:dealt},u.name+"の"+s.label+"が発動した");
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
   const start=everyone.filter(living).sort((a,b)=>{
     const skill=x=>x.id==="aria"?steps[round-1]:idx.npc[x.id]?.[round-1];
     const priority=x=>x.side==="ally"?(SKILLS[skill(x)]?.priority||0):0;
     return priority(b)-priority(a)||b.base.spd-a.base.spd||everyone.indexOf(a)-everyone.indexOf(b);
   });
   for(const u of start){
     if(!living(u))continue;
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
   if(finishReason!=="round_limit")break;
 }
 return {encounterId:args.encounterId,encounterName:encounter.name,won,finishReason,round:states.length,
   allies:states[states.length-1].allies,enemies:states[states.length-1].enemies,states,logs,metrics,
   remainingPartyHP:allies.reduce((a,x)=>a+x.hp,0),remainingEnemyHP:enemies.reduce((a,x)=>a+x.hp,0),
   engineVersion:"v0.4-prologue-integrated",gem:null,roster:encounter.party};
}
const API={simulate,validate,SKILLS,ENCOUNTERS,CHARACTER,normalizePlan,
 skillOptions:id=>{const e=ENCOUNTERS[id];if(!e)throw Error("UNKNOWN_ENCOUNTER");return e.unlocked.map(k=>({id:k,...SKILLS[k]}));}};
root.PrologueBattle=API;if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof window!=="undefined"?window:globalThis);

