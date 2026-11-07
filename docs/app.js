/* v0.6 UI. Game state and approved prose remain owned by their existing modules. */
(function (root) {
'use strict';
const D = root.document, S = root.PROLOGUE_STORY_V04, B = root.PrologueBattle;
const P = root.HillRoadPresentation;
const C = root.PrologueState.create({story:S, battle:B, engine:root.BattleEngine});
const NUM = ['一','二','三','四','五'];
const ITEMS = {staff:'旅の杖',order:'注文控え',money:'薬の代金',medicine:'塗り薬',vial:'青い小瓶',map:'写し地図',sword:'剣',gem:'宝玉'};
const ROLES = {aria:'行動を予約',captain:'仲間を守る',memberA:'魔法で支援',traveler:'攻撃をつなぐ'};
const SHORT = {basic:'物理100%',survive:'単体攻撃を2回回避',heavy:'物理120%',fire:'魔法120%・溜めなし',mark:'物理80%・標的3ターン'};
const DESC = {basic:'通常攻撃は何度でも使えます。上から順に生存する敵を攻撃し、標的があればそちらを優先します。',survive:'アリアに届く次の単体攻撃を2回回避します。全体攻撃には使えません。庇われた攻撃では回数を消費しません。',heavy:'物理攻撃力の120%で攻撃します。1戦闘につき1回です。',fire:'魔法攻撃力の120%で攻撃します。溜めずにそのターンに発動し、1戦闘につき1回です。',mark:'最大HPが最も低い生存敵へ物理80%の攻撃。生き残った対象に、使用したターンを含め3ターンの標的を付けます。味方の単体攻撃がその敵を優先します。'};
const UI_KEY = 'hill-road-view-v06';
let ui = {screen:null,scrolls:{},replay:null,revealed:[],folded:{}};
try { const saved = JSON.parse(root.sessionStorage.getItem(UI_KEY)); if (saved && typeof saved === 'object') ui = {...ui,...saved}; } catch (_) {}
let settings = false, uiError = '', message = '', pendingRestore = null;
const telemetryCache = new Map();
function persistUI() { try {root.sessionStorage.setItem(UI_KEY,JSON.stringify(ui));} catch (_) {} }
function el(tag,cls,text) {const x=D.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;}
function add(p,tag,cls,text) {const x=el(tag,cls,text);p.append(x);return x;}
function btn(p,label,fn,cls='primary') {const b=add(p,'button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
function defaultScreen(s) {return ['pre','post'].includes(s.phase)?'story':['battle','result'].includes(s.phase)?'battle':'home';}
function activeScreen(s) {if(!['home','story','battle','history'].includes(ui.screen))ui.screen=defaultScreen(s);if(ui.screen==='battle'&&!['battle','result'].includes(s.phase))ui.screen=defaultScreen(s);return ui.screen;}
function viewKey() {return ui.screen+(ui.replay?':'+ui.replay.section+':'+ui.replay.part+':'+ui.replay.page:'');}
function scrollSurface() {return root.matchMedia('(max-width: 700px)').matches?D.querySelector('main.content'):null;}
function scrollPosition() {return scrollSurface()?.scrollTop??root.scrollY;}
function rememberScroll() {ui.scrolls[viewKey()]=scrollPosition();persistUI();}
function restoreScroll(value) {if(pendingRestore!==null)root.cancelAnimationFrame(pendingRestore);pendingRestore=root.requestAnimationFrame(()=>{const surface=scrollSurface();surface?surface.scrollTo(0,value||0):root.scrollTo(0,value||0);pendingRestore=null;});}
function navigate(screen) {rememberScroll();ui.screen=screen;if(screen!=='history')ui.replay=null;persistUI();render();restoreScroll(ui.scrolls[viewKey()]||0);}
function act(fn,{follow=true,scroll=true}={}) {
 try {uiError='';fn();if(follow){ui.screen=defaultScreen(C.snapshot());ui.replay=null;}persistUI();render();if(scroll)restoreScroll(0);}
 catch(e){uiError=humanError(e);render();}
}
function humanError(error) {const code=String(error?.message||'');if(code.startsWith('SKILL_ONCE'))return '同じ技能が重複しています。通常攻撃以外は1戦闘に1回です。';return /[A-Z_]{4,}/.test(code)?'この操作を完了できませんでした。予約と現在の進行を確認してください。':code;}
function projected(s) {if(s.current===null)return s.completedCount?S.sections[s.completedCount-1].progress?.end:S.sections[0].progress?.start;const p=S.sections[s.current].progress;return p?.[s.phase==='post'?'end':['battle','result'].includes(s.phase)?'battle':'start'];}
function avatar(p,id,name) {const x=add(p,'span','avatar',id==='aria'?'ア':name.slice(0,2));x.setAttribute('aria-hidden','true');return x;}
function landscape(p) {const x=D.createElementNS('http://www.w3.org/2000/svg','svg');x.setAttribute('viewBox','0 0 900 220');x.setAttribute('aria-hidden','true');x.classList.add('landscape');x.innerHTML='<rect width="900" height="220" fill="#e9eddf"/><circle cx="700" cy="52" r="24" fill="#ddd4b0"/><path d="M0 158Q150 50 300 129T600 115T900 130V220H0Z" fill="#d5dfc9"/><path d="M0 200Q140 117 305 167T570 150T900 174V220H0Z" fill="#bdcdb0"/><path d="M0 218Q175 168 330 207T670 193T900 210V220H0Z" fill="#a4ba94"/><path d="M473 220Q406 196 459 178T503 143Q500 133 483 130" fill="none" stroke="#f7f3df" stroke-width="13"/>';p.append(x);}
function render() {
 const previousScroll=scrollPosition();
 const s=C.snapshot(),status=C.storageStatus(),screen=activeScreen(s),app=D.getElementById('app');app.replaceChildren();
 app.dataset.screen=screen;
 const top=add(app,'header','topbar');const brand=btn(top,'',()=>navigate('home'),'brand serif');const icon=add(brand,'img');icon.src='icon.svg';icon.alt='';add(brand,'span','','丘の向こうの道');
 const meta=add(top,'div','top-meta');add(meta,'span','save-status',status.ok?(status.savedAt?'保存済み':'自動保存'):'保存を確認');
 const layout=add(app,'div','layout'),side=add(layout,'aside','sidebar');renderNav(side,s);renderJourney(side,s);
 const main=add(layout,'main','content');main.id='reading';
 if(!status.ok)add(main,'div','notice error',status.error+' 「設定とセーブ」から書き出せます。');
 if(uiError){const n=add(main,'div','notice error',uiError);n.setAttribute('role','alert');}
 if(screen==='home')renderHome(main,s);
 else if(screen==='story')renderStory(main,s);
 else if(screen==='battle')s.phase==='result'?renderResult(main,s):renderBattle(main,s);
 else renderHistory(main,s);
 if(settings)renderSettings(app,s);
 persistUI();restoreScroll(previousScroll);
}
function renderNav(side,s) {
 const nav=add(side,'nav','main-nav');nav.setAttribute('aria-label','メインナビゲーション');
 const entries=[['home','ホーム'],['story','物語']];if(['battle','result'].includes(s.phase))entries.push(['battle','戦闘']);entries.push(['history','履歴']);
 for(const[key,label]of entries){const b=btn(nav,label,()=>navigate(key),'nav-button');b.dataset.nav=key;if(ui.screen===key)b.setAttribute('aria-current','page');}
 const b=btn(nav,'設定とセーブ',openSettings,'nav-button');b.dataset.nav='settings';
}
function renderJourney(p,s) {
 const stage=projected(s),box=add(p,'section','journey-meta');add(box,'h2','','旅の現在地');add(box,'p','place-name',stage?.location||'リネル村');
 add(box,'p','route',stage?.companions?.map(id=>B.CHARACTER[id]?.name||id).join('・')||'アリア');
 const details=add(box,'details','inventory');add(details,'summary','','持ちもの・所在');const list=add(details,'ul');
 for(const[k,value]of Object.entries(stage?.items||s.items))if(value&&value!=='未取得'){const li=add(list,'li');add(li,'span','',ITEMS[k]);add(li,'span','',value);}
}
function sectionHeading(p,i) {const h=add(p,'div','section-head');add(h,'span','eyebrow','序章');add(h,'h1','','第'+NUM[i]+'節　'+S.sections[i].title);}
function renderHome(p,s) {
 add(p,'div','eyebrow','旅のしおり');
 if(s.phase==='ready')renderReady(p,s);
 else if(s.phase==='done')renderDone(p,s);
 else {const hero=add(p,'section','hero');landscape(hero);const box=add(hero,'div','hero-body');add(box,'h1','','旅の続きを、ここから。');
  add(box,'p','intro','第'+NUM[s.current]+'節　'+S.sections[s.current].title);
  const label=s.phase==='battle'?'戦闘準備を開く':s.phase==='result'?'戦闘経過を開く':'読書を再開';btn(box,label,()=>navigate(defaultScreen(s)));
 }
 const progress=add(p,'section','home-card');add(progress,'h2','','旅の足あと');add(progress,'p','','読了 '+s.completedCount+' / '+S.sections.length+'節');
 const track=add(progress,'div','progress-track');track.setAttribute('aria-hidden','true');add(track,'div','progress-fill').style.width=(s.completedCount*20)+'%';
 renderJourney(p,s);
}
function renderReady(p,s) {
 const hero=add(p,'section','hero');landscape(hero);const body=add(hero,'div','hero-body');add(body,'h1','',s.completedCount?'一歩ずつ、道の先へ。':'いつもの村から、\nまだ知らない道へ。');
 add(body,'p','intro',s.completedCount?'読み終えた物語は、履歴からいつでも振り返れます。':'リネル村で暮らすアリア。いつもの暮らしから一歩外へ踏み出す、小さな旅の物語。');
 const next=add(p,'section','next-card');add(next,'h2','','第'+NUM[s.completedCount]+'節　'+S.sections[s.completedCount].title);
 const row=add(next,'div','action-row'),choice=add(row,'div','action-choice');
 for(const[value,label]of [['hold','更新しない'],['main','次の物語を進める']]){const l=add(choice,'label');const input=add(l,'input');input.type='radio';input.name='next-action';input.value=value;input.checked=s.action===value;input.addEventListener('change',()=>act(()=>C.setAction(value),{follow:false,scroll:false}));l.append(D.createTextNode(label));}
 const b=btn(row,'更新　→',()=>act(()=>C.startUpdate()));b.disabled=s.action!=='main';
 add(next,'p','subtle',s.action==='main'?'更新すると、次の節の物語が始まります。':'物語を進めるときは「次の物語を進める」を選んでください。');
}
function renderStory(p,s) {
 if(!['pre','post'].includes(s.phase)){add(p,'h1','','物語の続き');const text=s.phase==='ready'?'ホームで次の行動を選ぶと、物語が始まります。':s.phase==='done'?'序章を読み終えました。履歴から物語を読み返せます。':'いまは戦いの途中です。';add(p,'p','intro',text);btn(p,s.phase==='ready'?'ホームへ':s.phase==='done'?'履歴を開く':'戦闘へ',()=>navigate(defaultScreen(s)==='home'&&s.phase==='done'?'history':defaultScreen(s)));return;}
 const section=S.sections[s.current];sectionHeading(p,s.current);add(p,'p','subtle','現在地：'+(projected(s)?.location||''));
 renderReader(p,s,section[s.phase],s.phase==='post'?'戦闘後の物語':'物語',()=>s.phase==='pre'&&section.battleId?act(()=>C.goBattle()):act(()=>C.completeSection()),s.phase==='pre'&&section.battleId?'戦闘準備へ':s.current===4?'序章を完了する':'この節を終える');
}
// Preserve v0.5 page boundaries so existing saved page indices remain meaningful.
function pagesOf(body) {
 const text=body.replace(/^# [^\n]*\n\n?/,'').replace(/^## [^\n]*\n\n?/,'').trim();
 const parts=text.split(/(\n\n)/),pages=[];let page='';for(let i=0;i<parts.length;i+=2){const para=parts[i]+(parts[i+1]||'');if(page.length&&page.length+para.length>1400){pages.push(page);page='';}page+=para;}if(page)pages.push(page);return pages.length?pages:[''];
}
function renderReader(p,s,body,label,finish,finishLabel,history=false) {
 const pages=pagesOf(body),n=Math.min(history?ui.replay.page:s.page,pages.length-1);
 const toolbar=add(p,'div','reading-toolbar');add(toolbar,'span','',label+' · '+(n+1)+' / '+pages.length+' ページ');btn(toolbar,s.readingSize==='large'?'文字を標準に':'文字を大きく',()=>act(()=>C.setReadingSize(s.readingSize==='large'?'normal':'large'),{follow:false,scroll:false}),'text-button');
 const article=add(p,'article','reader'),box=add(article,'div','novel'+(s.readingSize==='large'?' large':''));
 for(const block of P.readerBlocks(pages[n])){const node=add(box,'p',block.type==='scene'?'scene-break':'prose-paragraph'+(block.type==='dialogue'?' prose-dialogue':''),block.text);if(block.type==='scene')node.setAttribute('aria-label','場面転換');if(block.indent)node.classList.add('indent');}
 const changePage=page=>{if(history){ui.replay.page=page;persistUI();render();restoreScroll(0);}else act(()=>C.setPage(page),{follow:false});};
 const nav=add(p,'div','reader-nav');btn(nav,'← 前のページ',()=>changePage(n-1),'secondary').disabled=n===0;btn(nav,n<pages.length-1?'次のページ →':finishLabel,n<pages.length-1?()=>changePage(n+1):finish);
}
function renderUnits(p,units,{stats=false}={}) {
 const list=add(p,'div','units');for(const u of units){const c=B.CHARACTER[u.id]||u,card=add(list,'section','unit'+(u.side==='enemy'?' enemy':'')+(u.hp===0?' knocked-out':''));
  const head=add(card,'div','unit-head');avatar(head,u.id,u.name||c.name);const title=add(head,'div');add(title,'h3','',u.name||c.name);add(title,'small','unit-role',u.hp===0?'戦闘不能':ROLES[u.id]||'敵');
  const hp=u.hp??c.hp,max=u.maxhp??c.hp;add(card,'div','hp-num','HP '+hp+' / '+max);const bar=add(card,'div','hp');bar.setAttribute('aria-hidden','true');add(bar,'span').style.width=Math.max(0,hp/max*100)+'%';
  if(Array.isArray(u.statuses)){const effects=add(card,'ul','status-list');if(!u.statuses.length)add(effects,'li','subtle',hp===0?'戦闘不能':'状態変化なし');for(const st of u.statuses){let text=st.label;if(st.pct!==undefined)text+=' '+(st.pct>0?'+':'')+Math.round(st.pct*100)+'%';if(st.charges!==undefined)text+='・残り'+st.charges+'回';if(st.remainingRounds!==null&&st.remainingRounds!==undefined)text+='・残り'+st.remainingRounds+'ターン';add(effects,'li','status-chip',text);}}
  if(stats){const details=add(card,'details','unit-stats');add(details,'summary','','能力を見る');const dl=add(details,'dl','stat-list');for(const[k,name]of [['patk','物理攻撃'],['matk','魔法攻撃'],['pdef','物理防御'],['mdef','魔法防御'],['spd','速度']]){add(dl,'dt','',name);add(dl,'dd','',c[k]);}}
 }
}
function baseUnits(ids,side) {return ids.map(id=>({id,side,name:B.CHARACTER[id].name,hp:B.CHARACTER[id].hp,maxhp:B.CHARACTER[id].hp}));}
function renderBattle(p,s) {
 const id=S.sections[s.current].battleId,enc=B.ENCOUNTERS[id];add(p,'div','eyebrow','戦闘準備');add(p,'h1','',enc.name);
 add(p,'h2','battle-title','参戦する仲間');renderUnits(p,baseUnits(enc.party,'ally'),{stats:true});add(p,'h2','battle-title','対峙する敵');renderUnits(p,baseUnits(enc.enemies,'enemy'));
 const help=add(p,'details','battle-help');add(help,'summary','','ルール・ヘルプ');add(help,'p','','アリアの5ターン分の行動を予約します。通常攻撃は何度でも、ほかの技能はそれぞれ1戦闘に1回使えます。仲間は決まった行動で戦います。');add(help,'p','','溜めが必要な技能は準備と発動が別のターンです。準備中の被ダメージは1.2倍になります。アリアの炎魔法は溜めずに発動します。');add(help,'p','','敵を全滅させ、味方が1人以上生き残れば勝利です。5ターンで決着しなければ、予約を見直して再挑戦できます。');
 add(p,'h2','battle-title','使える技能');const skills=B.skillOptions(id),cards=add(p,'div','skill-cards');
 for(const sk of skills){const card=add(cards,'details','skill-card'),sum=add(card,'summary');add(sum,'b','',sk.label);add(sum,'span','',SHORT[sk.id]);add(sum,'small','',sk.id==='basic'?'何度でも':'1戦闘に1回');add(card,'p','',DESC[sk.id]);}
 add(p,'h2','battle-title','アリアの行動予約');const grid=add(p,'div','plan-grid');
 for(let i=0;i<5;i++){const cell=add(grid,'div','plan-field'),l=add(cell,'label','','第'+(i+1)+'ターン');l.htmlFor='round-'+i;const select=add(cell,'select');select.id='round-'+i;for(const sk of skills){const o=add(select,'option','',sk.label);o.value=sk.id;}select.value=s.plan[i];select.addEventListener('change',()=>{const y=scrollPosition();act(()=>C.setPlan(i,select.value),{follow:false,scroll:false});D.getElementById('round-'+i)?.focus({preventScroll:true});restoreScroll(y);});}
 const overview=add(p,'ol','plan-overview');overview.setAttribute('aria-label','5ターンの予約一覧');s.plan.forEach((id,i)=>add(overview,'li','plan-chip',(i+1)+'T　'+B.SKILLS[id].label));
 if(Object.keys(enc.npc).length){const details=add(p,'details','npc');add(details,'summary','','NPCの固定行動を確認');const wrap=add(details,'div','table-wrap'),table=add(wrap,'table'),head=add(table,'thead'),tr=add(head,'tr');for(const t of ['メンバー','1T','2T','3T','4T','5T'])add(tr,'th','',t);const tb=add(table,'tbody');for(const[member,schedule]of Object.entries(enc.npc)){const row=add(tb,'tr');add(row,'th','',B.CHARACTER[member].name);let charged='';for(const sid of schedule){const sk=B.SKILLS[sid];let text;if(sid==='@release')text=charged+' 発動';else{if(sk.chargeTurns)charged=sk.label;text=sk.label+(sk.chargeTurns?' 準備':'');}add(row,'td','',text);}}}
 let invalid='';try{B.validate({encounterId:id,plan:s.plan,roster:enc.party});}catch(e){invalid=humanError(e);}if(invalid){const n=add(p,'div','notice error',invalid);n.setAttribute('role','alert');}
 btn(p,'予約を確定して戦闘を実行',()=>act(()=>{ui.revealed=[];ui.folded={};C.runBattle();}),'primary wide').disabled=!!invalid;
}
function resultKey(r) {let n=2166136261;for(const ch of JSON.stringify([r.encounterId,r.logs,r.states]))n=Math.imul(n^ch.charCodeAt(0),16777619);return r.encounterId+':'+(n>>>0);}
// Imported optional display data is never authoritative; replay authentic stored facts.
function telemetry(r,plan) {const key=resultKey(r);if(!telemetryCache.has(key))telemetryCache.set(key,B.telemetryFor(r,plan));return telemetryCache.get(key);}
function renderEffect(p,e) {
 const line=add(p,'li','effect-line');if(e.targetName)add(line,'strong','',e.targetName+' → ');
 if(e.type==='damage'||e.kind==='damage'){line.append(D.createTextNode(e.damage+'ダメージ'));if(e.redirected)add(line,'span','status-chip','庇う・挑発で引き受け');if(e.charging)add(line,'span','status-chip','溜め中の被ダメージ増加');if(e.hits>1)add(line,'span','subtle',' '+e.hit+' / '+e.hits+'撃目');}
 else line.append(D.createTextNode(e.text||e.label||'状態が変化した'));
 if(e.hpAfter!==undefined&&e.maxhp!==undefined)add(line,'div','hp-after','処理後HP '+e.hpAfter+' / '+e.maxhp);
}
function renderLogs(p,r,plan) {
 const data=telemetry(r,plan),key=resultKey(r),timeline=add(p,'section','battle-timeline');add(timeline,'h2','','戦闘の記録 · 全'+r.round+'ターン');
 const tools=add(timeline,'div','timeline-tools');btn(tools,'全ターンを折りたたむ',()=>{ui.folded[key]=Array.from({length:r.round},(_,i)=>i+1);persistUI();render();},'secondary');btn(tools,'全ターンを開く',()=>{ui.folded[key]=[];persistUI();render();},'secondary');
 if(!data){add(timeline,'p','notice','開始状態を正確に再現できない記録です。保存済みの行動記録を表示します。');for(let t=1;t<=r.round;t++){const round=add(timeline,'details','round-log');round.open=true;add(round,'summary','','第'+t+'ターン');for(const l of r.logs.filter(x=>x.round===t))add(round,'p','',l.text);}return;}
 for(const turn of data.turns){const round=add(timeline,'details','round-log');round.open=!(ui.folded[key]||[]).includes(turn.round);add(round,'summary','','第'+turn.round+'ターン');round.addEventListener('toggle',()=>{const folded=new Set(ui.folded[key]||[]);round.open?folded.delete(turn.round):folded.add(turn.round);ui.folded[key]=[...folded];persistUI();});
  const start=add(round,'section','turn-start turn-state');add(start,'h3','','第'+turn.round+'ターン開始前');const friends=add(start,'div','state-group');add(friends,'h4','','味方');renderUnits(friends,turn.start.allies);const enemies=add(start,'div','state-group');add(enemies,'h4','','敵');renderUnits(enemies,turn.start.enemies);
  const actions=add(round,'ol','action-list');for(const action of turn.actions){const row=add(actions,'li','battle-action action-event'),heading=add(row,'div','action-heading');avatar(heading,action.actorId,action.actorName);add(heading,'strong','',action.actorName+' → '+action.skillName+(action.phase==='prepare'?'（準備）':action.phase==='release'?'（発動）':''));const effects=add(row,'ul','action-effects');for(const effect of action.effects)renderEffect(effects,effect);}
 }
}
function renderFeedback(p,r,data) {
 const section=add(p,'section','tactic-summary');add(section,'h2','','この戦いを振り返る');
 const sum=data?.summary;const grid=add(section,'div','tactic-grid');const card=(label,value)=>{const c=add(grid,'div','tactic-card');add(c,'h3','',label);add(c,'p','',value);};
 card('決着',r.round+'ターン');card('味方が受けたダメージ',sum?.damageTaken??r.allies.reduce((n,u)=>n+u.maxhp-u.hp,0));card('回避した攻撃',(sum?.avoided??r.metrics.avoided)+'回');card('仲間が引き受けた攻撃',(sum?.redirected??r.metrics.redirected)+'回');
 if(sum?.markedTargets?.length){const names=[...new Set(sum.markedTargets.map(x=>typeof x==='string'?(B.CHARACTER[x]?.name||'標的の敵'):x.name||x.targetName||B.CHARACTER[x.id||x.targetId]?.name||'標的の敵'))];card('標的で狙った相手',names.join('・'));}
 if(sum?.chargedReleases?.length)card('溜めた技能の発動',sum.chargedReleases.map(x=>(x.actorName||B.CHARACTER[x.actorId]?.name||'仲間')+'の'+(x.skillName||B.SKILLS[x.skillId]?.label||'技能')).join('、'));
 if((sum?.chargeExtra??r.metrics.chargeExtra)>0)card('溜め中に増えた被害',(sum?.chargeExtra??r.metrics.chargeExtra)+'ダメージ');
 // Avoid attributing a whole-battle counterfactual to one skill. Detailed mitigation
 // observations, when available, remain labeled as same-hit calculations.
 if(sum?.mitigationComparisons?.length){const note=add(section,'details','mitigation-note');add(note,'summary','','防御や牽制の働き');add(note,'p','','同じ一撃で、その効果だけがなかった場合との被害の差です。別の予約で戦い直した結果ではありません。');for(const hit of sum.mitigationComparisons){let text='第'+hit.round+'ターン・'+hit.actorName+' → '+hit.targetName+'：';const factors=[];if(hit.defensePrevented>0)factors.push('防御上昇で'+hit.defensePrevented+'軽減');if(hit.feintPrevented>0)factors.push('牽制で'+hit.feintPrevented+'軽減');add(note,'p','',text+factors.join('／'));}}
}
function renderResult(p,s,r=s.result,history=false) {
 const key=resultKey(r),revealed=ui.revealed.includes(key);add(p,'div','eyebrow',history?'戦闘の記録':'戦闘経過');add(p,'h1','',B.ENCOUNTERS[r.encounterId].name);renderLogs(p,r,history?undefined:s.plan);
 if(!revealed){const gate=add(p,'div','result-gate');add(gate,'p','','行動の記録を振り返ってから、戦いの結末を確認できます。');btn(gate,'戦闘結果を確認する',()=>{ui.revealed.push(key);persistUI();render();root.requestAnimationFrame(()=>D.querySelector('.result-banner')?.scrollIntoView({block:'start'}));});return;}
 const banner=add(p,'section','result-banner'+(r.won?'':' lost'));add(banner,'h2','',r.won?'勝利 — '+r.round+'ターンで決着':'戦いを振り返る');add(banner,'p','',r.won?'仲間とともに、この戦いを乗り越えました。':'予約を見直し、同じ戦いに再挑戦できます。');
 const enc=B.ENCOUNTERS[r.encounterId];add(p,'h2','battle-title','戦闘終了時の状態');renderUnits(p,r.allies.map(u=>({...u,side:'ally'})));renderUnits(p,r.enemies.map(u=>({...u,side:'enemy'})));renderFeedback(p,r,telemetry(r,history?undefined:s.plan));
 if(!history){if(r.won)btn(p,'物語の続きを読む',()=>act(()=>C.readPost()),'primary wide');else btn(p,'予約を見直す',()=>act(()=>C.setPlan(0,s.plan[0])),'primary wide');if(r.encounterId==='BTL-0004'&&r.won)add(p,'p','notice','固有技能「みんながんばろ！」を習得しました。');}
}
function renderDone(p,s) {const hero=add(p,'section','hero');landscape(hero);const box=add(hero,'div','completion');add(box,'h1','','序章　読了');add(box,'p','','アリアの旅は、ここから始まります。');if(s.cheerUnlocked)add(box,'p','','固有技能「みんながんばろ！」習得済み');btn(box,'最初の節を読み返す',()=>openReplay(0));}
function openReplay(index) {rememberScroll();ui.screen='history';ui.replay={section:index,part:'pre',page:0};persistUI();render();restoreScroll(0);}
function renderHistory(p,s) {
 if(ui.replay&&ui.replay.section<s.completedCount){renderReplay(p,s);return;}
 ui.replay=null;add(p,'div','eyebrow','旅の足あと');add(p,'h1','','履歴');if(!s.history.length){add(p,'p','intro','読了した物語と戦闘の記録が、ここに残ります。');return;}
 const list=add(p,'div','history-list');for(const entry of s.history){const box=add(list,'section','history-entry');add(box,'h2','','第'+NUM[entry.section]+'節　'+S.sections[entry.section].title);btn(box,'第'+NUM[entry.section]+'節を読み返す',()=>openReplay(entry.section),'secondary');if(entry.result)add(box,'p','subtle','物語と戦闘の記録');}
}
function renderReplay(p,s) {
 const replay=ui.replay,sec=S.sections[replay.section],strip=add(p,'div','replay-strip');add(strip,'span','','旅の記録を読み返しています');btn(strip,'進行中の画面へ',()=>{ui.replay=null;navigate(defaultScreen(s));},'text-button');btn(strip,'履歴一覧へ',()=>{ui.replay=null;render();restoreScroll(0);},'text-button');sectionHeading(p,replay.section);
 const tabs=add(p,'div','replay-tabs');for(const[part,label]of [['pre','戦闘前の物語'],['post','戦闘後の物語']])if(sec[part])btn(tabs,sec.battleId?label:'物語',()=>{ui.replay.part=part;ui.replay.page=0;persistUI();render();restoreScroll(0);},replay.part===part?'selected':'secondary');
 if(sec.battleId&&replay.part==='post'){const r=C.historyResult(replay.section);if(r)renderResult(p,s,r,true);}
 renderReader(p,s,sec[replay.part],'読み返し',()=>{ui.replay=null;render();restoreScroll(0);},'記録を閉じる',true);
}
function openSettings() {rememberScroll();settings=true;render();D.querySelector('.settings-panel button')?.focus();}
function closeSettings() {settings=false;render();D.querySelector('[data-nav=settings]')?.focus({preventScroll:true});restoreScroll(ui.scrolls[viewKey()]||0);}
function download() {try{const blob=new Blob([C.exportSave()],{type:'application/json'}),url=URL.createObjectURL(blob),a=D.createElement('a');a.href=url;a.download='hill-road-save-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){uiError='書き出せませんでした。ブラウザの保存設定を確認してください。';render();}}
function renderSettings(app,s) {
 const overlay=add(app,'div','settings');overlay.addEventListener('click',e=>{if(e.target===overlay)closeSettings();});const panel=add(overlay,'section','settings-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','settings-title');
 const top=add(panel,'div','settings-top'),h=add(top,'h2','','設定とセーブ');h.id='settings-title';btn(top,'閉じる',closeSettings,'text-button');
 add(panel,'p','','進行・読書ページ・行動予約は、このブラウザに自動保存されます。別端末への移動やバックアップにはJSONの書き出しと読み込みを使ってください。');const status=C.storageStatus();add(panel,'p',status.ok?'toast':'notice error',status.ok?'自動保存は有効です。':status.error);
 const buttons=add(panel,'div','buttons');btn(buttons,'セーブを書き出す',download,'secondary');const input=add(panel,'input');input.type='file';input.accept='.json,application/json';input.hidden=true;
 input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('セーブファイルが大きすぎます。');const text=await file.text();if(root.confirm('現在の進行を、このセーブの内容に置き換えますか？')){C.importSave(text);ui={screen:defaultScreen(C.snapshot()),scrolls:{},replay:null,revealed:[],folded:{}};message='セーブを読み込みました。';uiError='';persistUI();render();}}catch(e){message='読み込めませんでした：'+humanError(e);render();}});
 btn(buttons,'セーブを読み込む',()=>input.click(),'secondary');if(message)add(panel,'p','toast',message);add(panel,'hr');add(panel,'h3','','文字の大きさ');const sizes=add(panel,'div','buttons');for(const[size,label]of [['normal','標準'],['large','大きめ']])btn(sizes,label+(s.readingSize===size?' ✓':''),()=>act(()=>C.setReadingSize(size),{follow:false,scroll:false}),'secondary');
 const help=add(panel,'details','general-help');add(help,'summary','','操作と保存のヘルプ');add(help,'p','','ホームから次の行動を選び、更新で物語を進めます。物語の途中でホームや履歴へ移動しても、読書位置と予約は保たれます。戦闘のルールは戦闘準備で確認できます。');add(help,'p','','同じURL・同じブラウザで続きを再開できます。プライベートブラウズでは保存が消える場合があります。端末間の自動同期はありません。');
 add(panel,'hr');btn(panel,'最初から始める',()=>{if(root.confirm('進行を初期化しますか？必要なセーブは先に書き出してください。')){settings=false;ui={screen:'home',scrolls:{},replay:null,revealed:[],folded:{}};act(()=>C.reset());}},'text-button danger');
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeSettings();}if(e.key==='Tab'){const fs=[...panel.querySelectorAll('button,input:not([hidden]),summary')].filter(x=>!x.disabled);if(e.shiftKey&&D.activeElement===fs[0]){e.preventDefault();fs.at(-1).focus();}else if(!e.shiftKey&&D.activeElement===fs.at(-1)){e.preventDefault();fs[0].focus();}}});
}
root.addEventListener('pagehide',rememberScroll);
root.HillRoadApp={controller:C,pagesOf,navigate};
render();restoreScroll(ui.scrolls[viewKey()]||0);
})(window);
