/*
 * Offline, deterministic 5-round RPG battle runner.
 * Browser v0.2; actions contain SKILLS ONLY. Targets chosen at action resolution.
 * Browser port of the v11/v13 Python trial specifications, not a byte-exact port.
 * Data source: GAME_DATA (data.js). Approved: 4-party, S5/P1, buff stack,
 * defensive priority, 07 purification, poison after owner action, E03 S9/E04 C13.
 */
(function(global){
'use strict';
const D=()=>global.GAME_DATA;
const deep=x=>JSON.parse(JSON.stringify(x));
const live=xs=>xs.filter(x=>x.hp>0);
const cap=(n,mi,ma)=>Math.max(mi,Math.min(ma,n));
const statkeys=['hp','patk','matk','pdef','mdef','spd'];
const elemChart={fire:{wood:1.25,water:.8},water:{fire:1.25,wood:.8},wood:{water:1.25,fire:.8}};
const byId=(arr,id)=>arr.find(x=>x.id===id);
const nfmt=n=>Math.max(0,Math.round(n));
function isStat(u,kind){return u.statuses.some(s=>s.kind===kind)}
function stats(u,key){
 let x=u.base[key]||0, groups=new Map();
 for(const b of u.buffs){if(!b.stats.includes(key))continue;
  let group=[...b.stats].sort().join('|');let g=groups.get(group)||{plus:0,minus:0};
  // Enemy 10 reverses positive buff values while active.
  const pct=u.reversed&&b.pct>0?-b.pct:b.pct;
  if(pct>=0)g.plus=Math.max(g.plus,pct);else g.minus=Math.min(g.minus,pct);
  groups.set(group,g);
 }
 for(const g of groups.values())x*=((1+g.plus)*(1+g.minus));
 return Math.max(0,x);
}
function addBuff(u,attrs,pct,duration,source='',ctx){
 if(pct<0&&u.debuffImmune){
  // Adopted P1: E05 overlord accepts ONLY PATK/MATK reduction.
  const exception=ctx?.encounterId==='E05'&&u.id==='overlord'&&attrs.every(k=>['patk','matk'].includes(k));
  if(!exception){if(ctx)ctx.say(`${u.name}には弱体化が効かない。`,'status');return false;}
 }
 u.buffs.push({stats:[...attrs],pct,left:duration,source,skipExpireOnce:ctx?.currentActor===u.id});
 if(ctx)ctx.say(`${u.name} ${pct>0?'強化':'弱体化'} ${attrs.join('/')} ${pct>0?'+':''}${Math.round(pct*100)}%`,'status');
 return true;
}
function addStatus(u,kind,duration,ctx){
 if(u.statusImmune&&['poison','mark','vulnerable'].includes(kind)&&!(ctx?.encounterId==='E06'&&u.id==='guard'&&kind==='poison')){
  if(ctx)ctx.say(`${u.name}は${kind}を無効化。`,'status');return false;
 }
 u.statuses=u.statuses.filter(s=>s.kind!==kind);
 u.statuses.push({kind,left:duration,skipExpireOnce:ctx?.currentActor===u.id});
 if(ctx)ctx.say(`${u.name}に${{poison:'毒',mark:'刻印',vulnerable:'脆弱',control_immune:'阻害耐性'}[kind]||kind}。`,'status');
 return true;
}
function unit(id,side,gem='balanced',equipment={}){
 let row=side==='ally'?(id==='H'?D().heroGems[gem]:D().characters[id]):id;
 const base=side==='ally'?deep(row):Object.fromEntries(statkeys.map(k=>[k,row[k]]));
 const equip=side==='ally'?[equipment.W,equipment.A,equipment.X].filter(Boolean):[];
 for(const eid of equip){const it=D().equipment[eid];if(it)for(const [k,v] of Object.entries(it.stats))base[k]=(base[k]||0)+v}
 base.hp=Math.max(1,base.hp);
 const desc=side==='ally'?D().charactersDraft.find(x=>x.id===id):null;
 return {id:side==='ally'?id:row.id,side,name:side==='ally'?desc?.name||id:row.name,
  base,hp:base.hp,maxhp:base.hp,element:side==='ally'?'neutral':row.element||'neutral',
  buffs:[],statuses:[],shields:[],control:0,toxic_poison:0,cover:null,aoe_cover:null,taunt:0,
  used:[],reversed:false,immuneKinds:row.immuneKinds||[],
  statusImmune:!!row.statusImmune,debuffImmune:!!row.debuffImmune, equipment:equip};
}
function makeParty(ids,gem,equipment){return ids.map(id=>unit(id,'ally',gem,equipment[id]||{}))}
function skillOptions(uid,gem){return D().unlockedSkills[uid+':'+(uid==='H'?gem:'any')].map(sid=>D().skills[sid])}
function skill(sid){return D().skills[sid]}
function targetMode(s){
 if(['taunt'].includes(s.type)||['allies','enemies','self'].includes(s.scope))return 'none';
 if(['buff','barrier','heal','cleanse','immune_control'].includes(s.type)&&s.scope==='ally')return 'ally';
 if(['cover','cover_aoe'].includes(s.type))return 'ally';
 return 'enemy';
}
function validate({encounterId,roster,gem,gear,plan}){
 if(!D().encounters.some(e=>e.id===encounterId))throw new Error('遭遇IDが不正です');
 if(!Array.isArray(roster)||roster.length!==4||roster[0]!=='H'||new Set(roster).size!==4)throw new Error('主人公＋仲間3人を編成してください');
 if(!['balanced','flame','tide'].includes(gem))throw new Error('命珠が不正です');
 if(!Array.isArray(plan)||plan.length!==5)throw new Error('5ラウンドの予約が必要です');
 for(const id of roster){
  const used=new Set();
  for(const [index,row] of plan.entries()){
   const act=row?.[id],sid=typeof act==='string'?act:act?.skill;
   const sk=skill(sid);
   if(!sk||!skillOptions(id,gem).some(x=>x.id===sid))throw new Error(`第${index+1}R：${id}の技能が不正です`);
   if(sk.uses===1&&used.has(sid))throw new Error(`第${index+1}R：${sk.label}は1戦で1回のみ`);
   if(sk.uses===1)used.add(sid);
  }
 }
 return true;
}
// All targeting rules execute AFTER the battle has revealed the actual enemies.
// They do not read any enemy ID from the player's 5-round reservation.
function chooseTarget(ctx,actor,s){
 const aliveAllies=live(ctx.allies),aliveEnemies=live(ctx.enemies);
 const byHP=(a,b)=>a.hp/a.maxhp-b.hp/b.maxhp||a.hp-b.hp||a.id.localeCompare(b.id);
 const byDanger=(a,b)=>(stats(b,'patk')+stats(b,'matk'))-(stats(a,'patk')+stats(a,'matk'))||byHP(a,b);
 const type=s.type,scope=s.scope;
 if(scope==='allies')return aliveAllies;
 if(scope==='enemies')return aliveEnemies;
 if(scope==='self')return [actor];
 if(scope==='ally'||['cover','cover_aoe'].includes(type)){
  let options=[...aliveAllies];
  if(['cover','cover_aoe'].includes(type))options=options.filter(x=>x.id!==actor.id);
  if(!options.length)return [];
  if(type==='cleanse'){
   options.sort((a,b)=>Number(hasCleanseable(b))-Number(hasCleanseable(a))||byHP(a,b));
  } else if(type==='heal'||type==='barrier'||type==='immune_control'||['cover','cover_aoe'].includes(type)){
   options.sort(byHP);
  } else if(type==='buff'){
   const powerStat=s.stats?.includes('matk')&&!s.stats.includes('patk')?'matk':s.stats?.includes('patk')&&!s.stats.includes('matk')?'patk':'matk';
   options.sort((a,b)=>stats(b,powerStat)-stats(a,powerStat)||byHP(a,b));
  } else options.sort(byHP);
  return [options[0]];
 }
 if(!aliveEnemies.length)return [];
 let possible=[...aliveEnemies];
 if(type==='damage'){
  let kind=s.kind;
  if(actor.id==='H'&&s.id==='H.basic'&&ctx.gem==='tide')kind='magic';
  const attackable=possible.filter(x=>!x.immuneKinds.includes(kind));
  if(attackable.length)possible=attackable;
  possible.sort(byHP);
 } else if(type==='dispel'){
  possible.sort((a,b)=>(b.buffs.filter(x=>x.pct>0).length+b.shields.length)-(a.buffs.filter(x=>x.pct>0).length+a.shields.length)||byDanger(a,b));
 } else if(type==='debuff'||type==='interrupt'){
  const affected=possible.filter(x=>!x.debuffImmune||ctx.encounterId==='E05'&&x.id==='overlord'&&s.stats?.every(k=>['patk','matk'].includes(k)));
  if(affected.length)possible=affected;
  possible.sort(byDanger);
 } else if(type==='status'){
  const affected=possible.filter(x=>!x.statusImmune||ctx.encounterId==='E06'&&x.id==='guard'&&s.status==='poison');
  if(affected.length)possible=affected;
  possible.sort(byDanger);
 } else possible.sort(byHP);
 return [possible[0]];
}
function hasCleanseable(u){return u.toxic_poison>0||u.statuses.some(q=>['poison','mark','vulnerable'].includes(q.kind))||u.buffs.some(b=>b.pct<0)}
function guardRedirect(ctx,target,aoe){
 let recipient=target, guardian=null;
 if(!aoe){
  const taunts=live(ctx.sideOf(target)).filter(u=>u.taunt>0);
  if(taunts.length)recipient=taunts.sort((a,b)=>a.id.localeCompare(b.id))[0];
  const covers=live(ctx.sideOf(target)).filter(u=>u.cover&&u.cover.target===recipient.id&&u.id!==recipient.id);
  if(covers.length){guardian=covers.sort((a,b)=>a.id.localeCompare(b.id))[0];recipient=guardian;ctx.metrics.cover++;}
 }else{
  const guardians=live(ctx.sideOf(target)).filter(u=>u.aoe_cover&&u.aoe_cover.target===recipient.id&&u.id!==recipient.id);
  if(guardians.length){guardian=guardians[0];recipient=guardian;ctx.metrics.aoeCover++;}
 }
 return {recipient,guardian};
}
function damage(ctx,attacker,initialTarget,kind,power,{element='neutral',ignore=0,extra=0,aoe=false,pierce=false,reflect=true,redirect=true}={}){
 if(!initialTarget||initialTarget.hp<=0||attacker.hp<=0)return 0;
 // Guardian/decoy enemy-specific redirects are tested only for single-target hits.
 let target=initialTarget,intercepted=false;
 if(redirect&&attacker.side==='ally'&&!aoe){
  const enemies=live(ctx.enemies);
  const proxy=enemies.find(u=>(u.id==='guard'&&target.id==='toxic')||(u.id==='decoy'&&target.id==='purger'));
  if(proxy)target=proxy;
 }
 if(redirect&&attacker.side==='enemy'){
  const r=guardRedirect(ctx,target,aoe);target=r.recipient;
  intercepted=!!(r.guardian&&target.id!==initialTarget.id&&target.id==='02'&&kind==='physical');
 }
 if(target.immuneKinds.includes(kind)){ctx.say(`${target.name}は${kind==='physical'?'物理':'魔法'}を無効化！`,'immune');return 0;}
 let baseStat=stats(attacker,kind==='physical'?'patk':'matk');
 let defStat=stats(target,kind==='physical'?'pdef':'mdef')*(1-ignore);
 let elementMult=elemChart[element]?.[target.element]||1;
 let vuln=isStat(target,'vulnerable')?1.2:1;
 let raw=Math.max(1,Math.floor(baseStat*(power+extra)/100*100/(100+defStat)*elementMult*vuln+1e-9));
 let residual=raw,shieldTaken=0;
 if(!pierce){for(const sh of target.shields.sort((a,b)=>a.left-b.left)){let absorb=Math.min(residual,sh.value);sh.value-=absorb;residual-=absorb;shieldTaken+=absorb;if(!residual)break}}
 let dealt=Math.min(target.hp,residual);target.hp-=dealt;
 ctx.say(`${attacker.name} → ${target.name}　${nfmt(dealt)}ダメージ${shieldTaken?`（障壁${shieldTaken}吸収）`:''}`,'damage');
 ctx.metrics.damage+=dealt;
 if(intercepted&&target.hp>0&&!ctx.actionCounterTaken.has(target.id)){
  ctx.actionCounterTaken.add(target.id);const retaliate=Math.min(attacker.hp,Math.max(1,Math.floor(stats(attacker,'patk')*power/100*.25)));
  attacker.hp-=retaliate;ctx.metrics.counter++;ctx.say(`${target.name}の守護反撃！　${attacker.name}に${retaliate}`,'counter');
 }
 if(reflect&&attacker.side==='ally'&&target.id==='mirror'&&dealt>0){
  const loss=Math.min(attacker.hp,Math.floor(dealt*.35));attacker.hp-=loss;
  ctx.metrics.reflection+=loss;ctx.say(`鏡の反射が${attacker.name}へ${loss}ダメージ`,'status');
 }
 return dealt;
}
function directTargets(ctx,actor,s){return chooseTarget(ctx,actor,s)}
function playerAction(ctx,actor,action){
 let s=skill(action.skill);if(!s)return;
 if(actor.used.includes(s.id)){ctx.say(`${actor.name}の${s.label}は使用済み。`,'status');return;}
 let tg=directTargets(ctx,actor,s);
 if(!tg.length){ctx.say(`${actor.name}：${s.label}の対象不在`,'status');return;}
 if(s.uses===1)actor.used.push(s.id);
 ctx.say(`${actor.name}｜${s.label}${s.scope==='enemies'||s.scope==='allies'?'':tg[0]&&tg[0]!==actor?' → '+tg[0].name:''}`,'action');ctx.metrics.skills[s.id]=(ctx.metrics.skills[s.id]||0)+1;
 if(s.type==='damage'){
  if(s.selfcost)actor.hp=Math.max(1,actor.hp-Math.floor(actor.maxhp*s.selfcost));
  for(const tgt of tg){
   for(let h=0;h<(s.hits||1);h++){
    if(tgt.hp<=0)break;
    let bonus=(s.bonus_poison&&isStat(tgt,'poison')?s.bonus_poison:0)+(s.bonus_pdef_debuff&&tgt.buffs.some(x=>x.pct<0&&x.stats.includes('pdef'))?s.bonus_pdef_debuff:0);
    let kind=s.kind;if(actor.id==='H'&&s.id==='H.basic'&&ctx.gem==='tide')kind='magic';
    let dealt=damage(ctx,actor,tgt,kind,s.power,{element:s.elem,ignore:s.ignore||0,extra:bonus,aoe:s.scope==='enemies'});
    if(s.lifesteal){let healed=Math.floor(dealt*s.lifesteal);actor.hp=Math.min(actor.maxhp,actor.hp+healed)}
   }
  }
  if(s.self_buff_pdef)addBuff(actor,['pdef'],s.self_buff_pdef,3,s.id,ctx);
  if(s.debuff_stats)tg.forEach(t=>addBuff(t,s.debuff_stats,s.debuff_pct,s.debuff_duration,s.id,ctx));
 }else if(s.type==='buff'||s.type==='debuff'){
  tg.forEach(t=>addBuff(t,s.stats,s.pct,s.duration,s.id,ctx));
 }else if(s.type==='barrier'){
  tg.forEach(t=>{t.shields.push({value:s.value,left:s.duration});ctx.say(`${t.name}に障壁${s.value}`,'status')});
 }else if(s.type==='heal'){
  tg.forEach(t=>{const heal=Math.min(t.maxhp-t.hp,s.value);t.hp+=heal;ctx.say(`${t.name}のHPを${heal}回復`,'heal')});
 }else if(s.type==='status'){
  tg.forEach(t=>addStatus(t,s.status,s.duration,ctx));
 }else if(s.type==='interrupt'){
  tg.forEach(t=>{if(!t.statusImmune&&!isStat(t,'control_immune')){t.control=1;ctx.say(`${t.name}の次の行動を阻害`,'status')}});
 }else if(s.type==='taunt'){
  actor.taunt=s.duration;actor.justTaunted=true;ctx.say(`${actor.name}が攻撃を引き受ける`,'guard');
 }else if(s.type==='cover'||s.type==='cover_aoe'){
  if(s.type==='cover')actor.cover={target:tg[0]?.id,left:s.duration,skipExpireOnce:true};
  else actor.aoe_cover={target:tg[0]?.id,left:s.duration,skipExpireOnce:true};
  ctx.say(`${actor.name}が${tg[0]?.name}を${s.type==='cover'?'単体':'全体攻撃'}から守る`,'guard');
 }else if(s.type==='immune_control'){
  tg.forEach(t=>addStatus(t,'control_immune',s.duration,ctx));
 }else if(s.type==='dispel'){
  tg.forEach(t=>{if(t.shields.length)t.shields=[];else t.buffs=t.buffs.filter(b=>b.pct<0);ctx.say(`${t.name}の強化を解除`,'status')});
 }else if(s.type==='cleanse'){
  for(const t of tg){
   let hasAilment=t.toxic_poison>0||t.statuses.some(q=>['poison','mark','vulnerable'].includes(q.kind))||t.buffs.some(b=>b.pct<0);
   t.statuses=t.statuses.filter(q=>!['poison','mark','vulnerable'].includes(q.kind));
   t.toxic_poison=0;t.buffs=t.buffs.filter(q=>q.pct>=0);
   ctx.say(`${t.name}を浄化${hasAilment?'！':'（解除対象なし）'}`,'heal');
   if(actor.id==='07'&&hasAilment){addBuff(t,['patk','matk'],.20,2,'07_boon',ctx);ctx.metrics.purification++;}
  }
 }
}
function commandArray(row,round){let cmd=row.script[Math.min(round-1,row.script.length-1)];
 if(typeof cmd==='string')return [[cmd]];
 if(!Array.isArray(cmd))return [['CHARGE']];
 if(Array.isArray(cmd[0]))return cmd;
 return [cmd];
}
function opDescription(op){return {P:'物理単体攻撃',M:'魔法単体攻撃',PA:'物理全体攻撃',MA:'魔法全体攻撃',MULTI:'物理連撃',POISON_ALL:'全体毒',POISON12:'猛毒',DEBUFF_ALL:'全体弱体化',DISPEL_DEBUFF:'強化解除',FIXED_AOE:'固定全体攻撃',PIERCE:'防壁貫通',CHECK300:'障壁判定',REVERSE:'能力反転',GUARD:'護衛',SACRIFICE:'身代わり',CHARGE:'蓄力',DRAIN:'吸収',TAUNT:'挑発'}[op]||'未分類行動'}
function enemyAction(ctx,actor,row,round){
 ctx.actionCounterTaken.clear(); // one counter per independent enemy action
 for(const cmd of commandArray(row,round)){
  if(actor.hp<=0||!live(ctx.allies).length)break;
  const op=cmd[0];ctx.observed.push({enemyId:actor.id,enemyName:actor.name,round,opcode:op,detail:opDescription(op)});const choose=(who)=>{
    let arr=live(ctx.allies);if(!arr.length)return null;
    if(who==='lowest')return [...arr].sort((a,b)=>a.hp/a.maxhp-b.hp/b.maxhp||a.id.localeCompare(b.id))[0];
    return arr.find(x=>x.id==='H')||arr[0];
  };
  if(op==='TAUNT'){actor.taunt=3;ctx.say(`${actor.name}が挑発を発動`,'status')}
  else if(op==='GUARD'||op==='SACRIFICE'){ctx.say(`${actor.name}が護衛態勢`,'guard')}
  else if(op==='CHARGE'){ctx.say(`${actor.name}は力を溜めている…`,'warning')}
  else if(op==='POISON_ALL')live(ctx.allies).forEach(x=>addStatus(x,'poison',3,ctx));
  else if(op==='POISON12'){live(ctx.allies).forEach(x=>{x.toxic_poison=3;ctx.say(`${x.name}は猛毒を受けた`,'warning')})}
  else if(op==='DEBUFF_ALL')live(ctx.allies).forEach(x=>addBuff(x,[cmd[1]],cmd[2],3,actor.id,ctx));
  else if(op==='FIXED_AOE')live(ctx.allies).forEach(x=>{x.hp=Math.max(0,x.hp-cmd[1]);ctx.say(`${x.name}へ防御無視 ${cmd[1]}ダメージ`,'warning')});
  else if(op==='MULTI'){
    const t=choose('priority');if(t)for(let i=0;i<cmd[2];i++)damage(ctx,actor,t,'physical',cmd[1]);
  }else if(['P','M','PA','MA'].includes(op)){
    const kind=op.startsWith('P')?'physical':'magic';const aoe=op.endsWith('A');
    const targets=aoe?[...live(ctx.allies)]:[choose(cmd[2])];
    for(const target of targets)if(target)for(let i=0;i<(cmd[3]||1);i++)damage(ctx,actor,target,kind,cmd[1],{aoe,element:kind==='magic'?actor.element:'neutral'});
  }else if(op==='DISPEL_DEBUFF')live(ctx.allies).forEach(x=>{x.buffs=x.buffs.filter(b=>b.pct<0);addBuff(x,['patk','matk'],-.20,3,actor.id,ctx)});
  else if(op==='DRAIN'){
   const t=choose('priority');if(t){let hp=damage(ctx,actor,t,'physical',cmd[1]);let delta=Math.min(stats(t,'patk'),Math.floor(hp*.2));if(delta){addBuff(t,['patk'],-delta/Math.max(1,t.base.patk),3,actor.id,ctx);addBuff(actor,['patk'],delta/Math.max(1,actor.base.patk),3,actor.id,ctx)}}
  }else if(op==='CHECK300')live(ctx.allies).forEach(x=>{if(!x.shields.some(q=>q.value>0)){x.hp=Math.max(0,x.hp-300);ctx.say(`${x.name}は障壁未展開！ 300固定ダメージ`,'warning')}});
  else if(op==='PIERCE'){const t=choose('priority');if(t)damage(ctx,actor,t,'magic',cmd[1],{pierce:true})}
  else if(op==='REVERSE')live(ctx.allies).forEach(x=>{x.reversed=true;ctx.say(`${x.name}の強化効果が反転！`,'warning')});
 }
}
function expire(ctx,u){
 // Poison ALWAYS applies after the target character's action opportunity (even if interrupted).
 if(u.hp>0&&isStat(u,'poison')){
  const loss=Math.min(u.hp,Math.max(1,Math.floor(u.maxhp*.06)));u.hp-=loss;ctx.metrics.poison+=loss;ctx.say(`${u.name}は行動後、毒で${loss}ダメージ`,'poison');
 }
 if(u.hp>0&&u.toxic_poison>0){const loss=Math.min(u.hp,Math.max(1,Math.floor(u.maxhp*.12)));u.hp-=loss;u.toxic_poison--;ctx.metrics.poison+=loss;ctx.say(`${u.name}は行動後、猛毒で${loss}ダメージ`,'poison');}
 for(const name of ['buffs','statuses','shields']){
  u[name].forEach(x=>{if(x.skipExpireOnce){x.skipExpireOnce=false;}else x.left--;});
  u[name]=u[name].filter(x=>x.left>0&&(name!=='shields'||x.value>0));
 }
 if(u.taunt>0){if(u.justTaunted){u.justTaunted=false;}else u.taunt--;}
 for(const name of ['cover','aoe_cover'])if(u[name]){if(u[name].skipExpireOnce){u[name].skipExpireOnce=false;}else u[name].left--;if(u[name].left<=0)u[name]=null;}
}
function snapshot(allies,enemies,round){
 const out=u=>({id:u.id,name:u.name,hp:u.hp,maxhp:u.maxhp,shields:u.shields.reduce((a,x)=>a+x.value,0),poison:isStat(u,'poison')||u.toxic_poison>0,
  buffs:u.buffs.filter(b=>b.pct>0).length,debuffs:u.buffs.filter(b=>b.pct<0).length,control:u.control});
 return {round,allies:allies.map(out),enemies:enemies.map(out)};
}
function simulate({encounterId,roster,gem='balanced',gear={},plan}){
 validate({encounterId,roster,gem,gear,plan});
 const encounter=D().encounters.find(x=>x.id===encounterId);
 const allies=makeParty(roster,gem,gear),enemies=encounter.enemies.map(x=>unit(x,'enemy'));
 const ctx={allies,enemies,gem,encounterId,logs:[],observed:[],round:0,currentActor:null,metrics:{cover:0,aoeCover:0,counter:0,poison:0,damage:0,reflection:0,purification:0,skills:{}},actionCounterTaken:new Set(),
  sideOf:u=>u.side==='ally'?allies:enemies,
  say:(message,type='info')=>ctx.logs.push({round:ctx.round,text:message,type,actorId:ctx.currentActor})};
 const states=[snapshot(allies,enemies,0)];let won=false,finishReason='round_limit';
 for(let r=1;r<=5;r++){
  ctx.round=r;ctx.say(`―― 第${r}ラウンド ――`,'round');
  // Declared priority takes precedence over speed for exactly three defensive skills.
  const order=live([...allies,...enemies]).sort((a,b)=>{
    const high=u=>u.side==='ally'&&['02.01','02.02','02.12'].includes(plan[r-1][u.id]?.skill)?1:0;
    return high(b)-high(a)||stats(b,'spd')-stats(a,'spd')||a.id.localeCompare(b.id);
  });
  for(const actor of order){
   if(actor.hp<=0)continue;
   ctx.currentActor=actor.id;
   if(actor.control>0&&!isStat(actor,'control_immune')){
    actor.control--;ctx.say(`${actor.name}は行動を阻害された`,'warning');
   }else if(actor.side==='ally'){
    playerAction(ctx,actor,plan[r-1][actor.id]);
   }else{
    enemyAction(ctx,actor,encounter.enemies.find(e=>e.id===actor.id),r);
   }
   expire(ctx,actor);
   if(!live(enemies).length){won=true;finishReason='defeated';break;}
   if(!live(allies).length){finishReason='annihilated';break;}
  }
  states.push(snapshot(allies,enemies,r));
  if(won||!live(allies).length)break;
 }
 // No EP-B hybrid alternative (not adopted).
 const out={encounterId,encounterName:encounter.name,won,finishReason,round:states[states.length-1].round,
  allies:states[states.length-1].allies,enemies:states[states.length-1].enemies,states,logs:ctx.logs,observed:ctx.observed,metrics:ctx.metrics,
  remainingEnemyHP:enemies.reduce((a,u)=>a+u.hp,0),remainingPartyHP:allies.reduce((a,u)=>a+u.hp,0),
  engineVersion:'playable-browser-prototype-0.2',warning:'試作Pythonエンジンからの移植版。効果期限など完全な同値性は未検証'};
 return out;
}
function basicPlan(roster){return Array.from({length:5},()=>Object.fromEntries(roster.map(id=>[id,{skill:id+'.basic'}])))}
function autoPlan(roster,gem,encounter=null,style='mixed'){
 const sequences={
  H:gem==='flame'?['H.f03','H.f01','H.f04','H.fult','H.basic']:gem==='tide'?['H.t04','H.t01','H.t02','H.tult','H.basic']:['H.03','H.06','H.01','H.ult','H.basic'],
  '02':style==='attack'?['02.11','02.04','02.01','02.ult','02.basic']:['02.02','02.12','02.11','02.ult','02.basic'],
  '03':['03.ult','03.02','03.01','03.03','03.basic'],
  '04':['04.03','04.01','04.02','04.ult','04.basic'],
  '05':['05.02','05.ult','05.01','05.04','05.basic'],
  '06':['06.04','06.01','06.02','06.ult','06.basic'],
  '07':['07.01','07.ult','07.02','07.04','07.basic']};
 const used={};roster.forEach(id=>used[id]=new Set());
 return Array.from({length:5},(_,r)=>Object.fromEntries(roster.map(id=>{
  const pool=skillOptions(id,gem),preferred=style==='attack'?[...pool.filter(s=>s.type==='damage'&&s.id!==id+'.basic').map(s=>s.id),...(sequences[id]||[])]:sequences[id]||[];
  const sid=preferred.find(x=>pool.some(s=>s.id===x)&&(!skill(x).uses||skill(x).uses!==1||!used[id].has(x)))||id+'.basic';
  if(skill(sid).uses===1)used[id].add(sid);
  return [id,{skill:sid}];
 })));
}
const exported={validate,simulate,autoPlan,basicPlan,chooseTarget,skillOptions,targetMode,stats,makeParty,skill,addBuff,addStatus,unit,live};
global.BattleEngine=exported;
if(typeof module!=='undefined'&&module.exports)module.exports=exported;
})(typeof window!=='undefined'?window:globalThis);
