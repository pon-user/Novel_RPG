/* Manual five-update reader. Approved prose is only paginated, never rewritten. */
(function(root){
'use strict';
const D=root.document,S=root.PROLOGUE_STORY_V04,B=root.PrologueBattle,E=root.BattleEngine;
const C=root.PrologueState.create({story:S,battle:B,engine:E});
const NUM=['一','二','三','四','五'];
const ITEMS={staff:'旅の杖',order:'注文控え',money:'薬の代金',medicine:'塗り薬',vial:'青い小瓶',map:'写し地図',sword:'剣',gem:'宝玉'};
let replay=null,settings=false,uiError='',message='';
function el(tag,cls,text){const x=D.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;}
function add(p,tag,cls,text){const x=el(tag,cls,text);p.append(x);return x;}
function btn(p,label,fn,cls='primary'){const b=add(p,'button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
function act(fn,scroll=true){try{uiError='';fn();render();if(scroll)root.scrollTo({top:0,behavior:'instant'});}catch(e){uiError=e.message;render();}}
function projected(s){
 if(s.current===null)return s.completedCount?S.sections[s.completedCount-1].progress?.end:S.sections[0].progress?.start;
 const p=S.sections[s.current].progress;
 return p?.[s.phase==='post'?'end':['battle','result'].includes(s.phase)?'battle':'start'];
}
function landscape(p){const x=D.createElementNS('http://www.w3.org/2000/svg','svg');x.setAttribute('viewBox','0 0 900 220');x.setAttribute('aria-hidden','true');x.classList.add('landscape');x.innerHTML='<rect width="900" height="220" fill="#e9eddf"/><circle cx="700" cy="52" r="24" fill="#ddd4b0"/><path d="M0 158Q150 50 300 129T600 115T900 130V220H0Z" fill="#d5dfc9"/><path d="M0 200Q140 117 305 167T570 150T900 174V220H0Z" fill="#bdcdb0"/><path d="M0 218Q175 168 330 207T670 193T900 210V220H0Z" fill="#a4ba94"/><path d="M473 220Q406 196 459 178T503 143Q500 133 483 130" fill="none" stroke="#f7f3df" stroke-width="13"/><path d="M124 140V100M111 118L124 97L137 118M111 127L124 106L137 127M765 150V108M750 128L765 103L780 128M748 140L765 115L782 140" fill="none" stroke="#809879" stroke-width="4" stroke-linecap="round"/><path d="M207 148v-17h25v17M202 131l17-13 18 13" stroke="#7a8c6b" fill="#e6e6cd" stroke-width="2"/>';p.append(x);}
function render(){
 const s=C.snapshot(),status=C.storageStatus(),app=D.getElementById('app');app.replaceChildren();
 const top=add(app,'header','topbar');const brand=btn(top,'',()=>{replay=null;render()},'brand serif');const icon=add(brand,'img');icon.src='icon.svg';icon.alt='';add(brand,'span','','丘の向こうの道');
 const meta=add(top,'div','top-meta');add(meta,'span','subtle','序章 '+s.completedCount+' / 5');add(meta,'span','save-status',status.ok?(status.savedAt?'保存済み':'自動保存'):'保存を確認');btn(meta,'設定とセーブ',()=>openSettings(),'text-button');
 const layout=add(app,'div','layout');renderSidebar(layout,s);const main=add(layout,'main','content');main.id='reading';
 const crumb=add(main,'div','content-top');add(crumb,'span','','旅の記録 / 序章');add(crumb,'span','pill',replay?'読み返し':s.phase==='done'?'序章完了':'試遊版 · 手動更新');
 if(!status.ok)add(main,'div','notice error',status.error+' 「設定とセーブ」から書き出せます。');
 if(uiError){const n=add(main,'div','notice error',uiError);n.setAttribute('role','alert');}
 if(replay)renderReplay(main,s);
 else if(s.phase==='ready')renderReady(main,s);
 else if(s.phase==='done')renderDone(main,s);
 else{
  const section=S.sections[s.current];sectionHeading(main,s.current);
  const stage=projected(s);if(stage)add(main,'p','subtle','現在地：'+stage.location);
  if(s.phase==='pre'||s.phase==='post')renderReader(main,s,section[s.phase],s.phase==='post'?'戦闘後の物語':'物語',()=>s.phase==='pre'&&section.battleId?act(()=>C.goBattle()):act(()=>C.completeSection()),s.phase==='pre'&&section.battleId?'戦闘準備へ':s.current===4?'序章を完了する':'この節を終える');
  else if(s.phase==='battle')renderBattle(main,s);
  else if(s.phase==='result')renderResult(main,s);
 }
 add(main,'p','version','丘の向こうの道 — 序章試遊版 v0.5 / 5更新・4戦');
 if(settings)renderSettings(app,s);
}
function renderSidebar(layout,s){
 const side=add(layout,'aside','sidebar');add(side,'div','eyebrow','Prologue');add(side,'h2','','丘の向こうの道');add(side,'p','subtle','小さな旅の、五つの物語。');
 const track=add(side,'div','progress-track');const fill=add(track,'div','progress-fill');fill.style.width=(s.completedCount*20)+'%';
 const nav=add(side,'nav','chapter-list');nav.setAttribute('aria-label','序章の各節');
 S.sections.forEach((sec,i)=>{const done=i<s.completedCount,active=(replay?replay.section:s.current)===i;const b=btn(nav,'',()=>{if(done){replay={section:i,part:'pre',page:0};act(()=>{},true);}else{replay=null;render();}},'chapter'+(done?' done':'')+(active?' active':''));b.disabled=!done&&s.current!==i;b.setAttribute('aria-label','第'+NUM[i]+'節 '+sec.title+(done?' 読み返す':active?' 進行中':' 未読'));if(active)b.setAttribute('aria-current','step');add(b,'span','chapter-no',done?'✓':String(i+1).padStart(2,'0'));const text=add(b,'span','chapter-text',sec.title);add(text,'small','',done?'読了':s.current===i?'進行中':'未読');});
 const stage=projected(s);add(side,'div','side-label',replay?'現在の旅の状態':'現在地');add(side,'p','place-name',stage?.location||'リネル村');add(side,'p','route',stage?.companions?.map(id=>B.CHARACTER[id]?.name||id).join('・')||'アリア');
 const inv=add(side,'details','inventory');add(inv,'summary','','持ちもの・所在');const list=add(inv,'ul');for(const [k,name]of Object.entries(ITEMS)){const li=add(list,'li');add(li,'span','',name);add(li,'span','',(stage?.items||s.items)[k]);}
 add(side,'p','side-note','物語は「更新」を押すと進みます。\n読書位置や行動予約は、このブラウザに自動保存されます。');
}
function sectionHeading(p,i){const h=add(p,'div','section-head');add(h,'span','eyebrow','Episode '+String(i+1).padStart(2,'0'));add(h,'h1','','第'+NUM[i]+'節　'+S.sections[i].title);}
function renderReady(p,s){
 const hero=add(p,'section','hero');landscape(hero);const body=add(hero,'div','hero-body');add(body,'div','eyebrow',s.completedCount?'Your journey continues':'A small journey begins');add(body,'h1','','いつもの村から、\nまだ知らない道へ。');add(body,'p','intro','リネル村で暮らすアリア。いつもの暮らしから一歩外へ踏み出す、序章の物語。行動を選び、戦いに備えながら、自分のペースで読み進めてください。');
 const facts=add(body,'div','facts');for(const[n,l]of [['5','更新の物語'],['4','回の戦闘'],['1','節ずつ進行']]){const f=add(facts,'span');add(f,'b','',n);f.append(D.createTextNode(l));}
 const next=add(p,'section','next-card');add(next,'div','eyebrow','Next episode');add(next,'h2','','第'+NUM[s.completedCount]+'節　'+S.sections[s.completedCount].title);add(next,'p','subtle',s.completedCount===4?'最後の更新です。戦いを終えたアリアの、旅立ち前夜を描きます。':'「更新」を押すと、この節の物語が始まります。戦闘ではアリアの5ターンの行動を予約します。');
 const row=add(next,'div','action-row'),choice=add(row,'div','action-choice');
 for(const[value,label]of [['hold','更新しない'],['main','次の物語を進める']]){const l=add(choice,'label');const input=add(l,'input');input.type='radio';input.name='next-action';input.value=value;input.checked=s.action===value;input.addEventListener('change',()=>act(()=>C.setAction(value),false));l.append(D.createTextNode(label));}
 btn(row,'更新　→',()=>act(()=>C.startUpdate())).disabled=s.action!=='main';
 add(p,'p','footer-note','時刻による待ち時間はありません。1回の更新で1節が進み、途中で閉じても続きから再開できます。');
}
function pagesOf(body){
 const text=body.replace(/^# [^\n]*\n\n?/,'').replace(/^## [^\n]*\n\n?/,'').trim();
 const parts=text.split(/(\n\n)/),pages=[];let page='';for(let i=0;i<parts.length;i+=2){const para=parts[i]+(parts[i+1]||'');if(page.length&&page.length+para.length>1400){pages.push(page);page='';}page+=para;}if(page)pages.push(page);return pages.length?pages:[''];
}
function renderReader(p,s,body,label,finish,finishLabel,history=false){
 const pages=pagesOf(body),n=Math.min(history?replay.page:s.page,pages.length-1);
 const toolbar=add(p,'div','reading-toolbar');add(toolbar,'span','',label+' · '+(n+1)+' / '+pages.length+' ページ');btn(toolbar,s.readingSize==='large'?'文字を標準に':'文字を大きく',()=>act(()=>C.setReadingSize(s.readingSize==='large'?'normal':'large'),false),'text-button');
 const box=add(p,'article','reader');add(box,'p','novel'+(s.readingSize==='large'?' large':''),pages[n]);
 const nav=add(p,'div','reader-nav');btn(nav,'← 前のページ',()=>{if(history){replay.page=n-1;act(()=>{});}else act(()=>C.setPage(n-1));},'secondary').disabled=n===0;
 const move=()=>{if(history){replay.page=n+1;act(()=>{});}else act(()=>C.setPage(n+1));};btn(nav,n<pages.length-1?'次のページ →':finishLabel,n<pages.length-1?move:finish);
}
const DESC={basic:'物理100%。何度でも使えます。',survive:'次の単体攻撃を2回回避。全体攻撃は対象外。',heavy:'物理120%。この戦闘で1回。',fire:'魔法120%。溜めなし。この戦闘で1回。',mark:'最大HPが最小の敵に物理80%。3ターンの標的を付け、味方の単体攻撃を誘導。'};
function renderUnits(p,ids,side,states){const units=add(p,'div','units');for(const id of ids){const c=B.CHARACTER[id],u=states?.find(x=>x.id===id);const card=add(units,'div','unit'+(side==='enemy'?' enemy':''));add(card,'h3','',c.name);add(card,'small','',side==='enemy'?'敵':id==='aria'?'あなたが予約':'固定行動NPC');const hp=u?u.hp:c.hp;const bar=add(card,'div','hp');const fill=add(bar,'span');fill.style.width=Math.max(0,hp/c.hp*100)+'%';add(card,'div','hp-num','HP '+hp+' / '+c.hp);}}
function renderBattle(p,s){
 const id=S.sections[s.current].battleId,enc=B.ENCOUNTERS[id];add(p,'div','eyebrow','Battle '+String(s.current+1).padStart(2,'0'));add(p,'h2','',enc.name);add(p,'p','battle-intro','アリアの行動を5ターン分予約してください。通常攻撃以外は1戦闘につき1回。NPCの行動は自動で進みます。');
 add(p,'h3','battle-title','敵の編成');renderUnits(p,enc.enemies,'enemy');add(p,'h3','battle-title','一時同行メンバー · 宝玉なし');renderUnits(p,enc.party,'ally');
 const skills=B.skillOptions(id),cards=add(p,'div','skill-cards');for(const skill of skills){const c=add(cards,'div','skill-card');add(c,'b','',skill.label);add(c,'span','',DESC[skill.id]);}
 add(p,'h3','battle-title','アリアの行動予約');const grid=add(p,'div','plan-grid');for(let i=0;i<5;i++){const cell=add(grid,'div','plan-field');const l=add(cell,'label','','第'+(i+1)+'ターン');l.htmlFor='round-'+i;const sel=add(cell,'select');sel.id='round-'+i;for(const skill of skills){const o=add(sel,'option','',skill.label);o.value=skill.id;}sel.value=s.plan[i];sel.addEventListener('change',()=>{const y=root.scrollY;act(()=>C.setPlan(i,sel.value),false);D.getElementById('round-'+i)?.focus({preventScroll:true});root.scrollTo(0,y);});}
 if(Object.keys(enc.npc).length){const details=add(p,'details','npc');add(details,'summary','','NPCの固定行動を確認');const wrap=add(details,'div','table-wrap'),table=add(wrap,'table'),head=add(table,'thead'),tr=add(head,'tr');for(const t of ['メンバー','1T','2T','3T','4T','5T'])add(tr,'th','',t);const tb=add(table,'tbody');for(const[member,schedule]of Object.entries(enc.npc)){const row=add(tb,'tr');add(row,'td','',B.CHARACTER[member].name);let charged;for(const sid of schedule){const sk=B.SKILLS[sid];let text;if(sid==='@release')text=charged+' 発動';else{if(sk.chargeTurns)charged=sk.label;text=sk.label+(sk.chargeTurns?' 準備':'');}add(row,'td','',text);}}}
 let invalid='';try{E.validate({encounterId:id,plan:s.plan,gem:null,roster:enc.party});}catch(e){invalid=e.message.startsWith('SKILL_ONCE')?'通常攻撃以外の技能は1戦闘に1回です。重複した予約を変更してください。':e.message;}
 if(invalid)add(p,'div','notice error',invalid);btn(p,'予約を確定して戦闘を実行',()=>act(()=>C.runBattle()),'primary wide').disabled=!!invalid;
 add(p,'p','footer-note','予約の変更は自動保存されます。戦闘結果を確定してから、物語の続きを読めます。');
}
function renderLogs(p,r){const logs=add(p,'details','logs');add(logs,'summary','','戦闘の記録 · 全'+r.round+'ターン');for(let t=1;t<=r.round;t++){const round=add(logs,'details','round-log');add(round,'summary','','第'+t+'ターン');for(const l of r.logs.filter(l=>l.round===t))add(round,'p','',l.text);}}
function renderResult(p,s){const r=s.result,enc=B.ENCOUNTERS[r.encounterId];const banner=add(p,'section','result-banner'+(r.won?'':' lost'));add(banner,'div','eyebrow',r.won?'Victory':'Try again');add(banner,'h2','',r.won?'勝利 — '+r.round+'ターンで決着':'戦いを振り返る');add(banner,'p','',r.won?'戦いを終えました。物語の続きを読みましょう。':'この戦いは突破できませんでした。技能の順序を見直して再挑戦できます。進行と取得物は確定していません。');
 add(p,'h3','battle-title','戦闘終了時の状態');renderUnits(p,enc.party,'ally',r.allies);renderUnits(p,enc.enemies,'enemy',r.enemies);renderLogs(p,r);
 if(r.won)btn(p,'物語の続きを読む',()=>act(()=>C.readPost()),'primary wide');else btn(p,'予約を見直す',()=>act(()=>C.setPlan(0,s.plan[0])),'primary wide');
 if(r.encounterId==='BTL-0004'&&r.won)add(p,'p','notice','固有技能「みんながんばろ！」を習得しました。第1章から使用できます。');
}
function renderDone(p,s){const hero=add(p,'section','hero');landscape(hero);const d=add(hero,'div','completion');add(d,'div','eyebrow','Prologue complete');add(d,'h1','','序章　読了');add(d,'p','','五つの物語と、四つの戦いを終えました。\nアリアの旅は、ここから始まります。');add(d,'p','','「みんながんばろ！」習得済み\n宝玉・餞別の剣は、まだ手にしていません。');btn(d,'最初の節を読み返す',()=>{replay={section:0,part:'pre',page:0};act(()=>{});});add(p,'p','footer-note','序章の試遊はここまでです。読了した節と戦闘の記録は、いつでも読み返せます。');const info=add(p,'details','inventory');add(info,'summary','','旅の持ちものを確認');for(const[k,n]of Object.entries(ITEMS))add(info,'p','subtle',n+'：'+s.items[k]);}
function renderReplay(p,s){const sec=S.sections[replay.section];const strip=add(p,'div','replay-strip');add(strip,'span','','旅の記録を読み返しています');btn(strip,'進行中の画面へ',()=>{replay=null;act(()=>{});},'text-button');sectionHeading(p,replay.section);const tabs=add(p,'div','replay-tabs');for(const[part,label]of [['pre','戦闘前の物語'],['post','戦闘後の物語']]){if(!sec[part])continue;btn(tabs,sec.battleId?label:'物語',()=>{replay.part=part;replay.page=0;act(()=>{});},replay.part===part?'selected':'');}if(sec.battleId&&replay.part==='post'){const r=C.historyResult(replay.section);if(r)renderLogs(p,r);}renderReader(p,s,sec[replay.part],'読み返し',()=>{replay=null;act(()=>{});},'記録を閉じる',true);}
let previouslyFocused=null;
function openSettings(){previouslyFocused=D.activeElement;settings=true;render();D.querySelector('.settings-panel button')?.focus();}
function closeSettings(){settings=false;render();D.querySelector('.top-meta .text-button')?.focus();}
function download(){try{const blob=new Blob([C.exportSave()],{type:'application/json'}),url=URL.createObjectURL(blob),a=D.createElement('a');a.href=url;a.download='hill-road-save-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){uiError='書き出せませんでした：'+e.message;render();}}
function renderSettings(app,s){const overlay=add(app,'div','settings');overlay.addEventListener('click',e=>{if(e.target===overlay)closeSettings();});const panel=add(overlay,'section','settings-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','settings-title');const top=add(panel,'div','settings-top');const h=add(top,'h2','','設定とセーブ');h.id='settings-title';btn(top,'閉じる',closeSettings,'text-button');add(panel,'p','','進行・読書ページ・行動予約は自動保存されます。同じ端末の同じブラウザで、続きから再開できます。');add(panel,'p','','別のブラウザや端末への移動には、セーブの書き出しと読み込みを使ってください。');const status=C.storageStatus();add(panel,'p',status.ok?'toast':'notice error',status.ok?'自動保存は有効です。':status.error);const buttons=add(panel,'div','buttons');btn(buttons,'セーブを書き出す',download,'secondary');const input=add(panel,'input');input.type='file';input.accept='.json,application/json';input.hidden=true;input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('セーブファイルが大きすぎます。');const text=await file.text();if(root.confirm('現在の進行を、このセーブの内容に置き換えますか？')){C.importSave(text);replay=null;message='セーブを読み込みました。';uiError='';render();}}catch(e){message='読み込めませんでした：'+e.message;render();}});btn(buttons,'セーブを読み込む',()=>input.click(),'secondary');if(message)add(panel,'p','toast',message);add(panel,'hr');add(panel,'p','','文字の大きさ');const sizes=add(panel,'div','buttons');for(const[size,label]of [['normal','標準'],['large','大きめ']])btn(sizes,label+(s.readingSize===size?' ✓':''),()=>act(()=>C.setReadingSize(size),false),'secondary');add(panel,'hr');add(panel,'p','','最初から遊び直すと、この試遊版の進行を初期化します。必要なら先にセーブを書き出してください。');btn(panel,'最初から始める',()=>{if(root.confirm('この試遊版の進行を初期化しますか？')){settings=false;replay=null;act(()=>C.reset());}},'text-button danger');panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeSettings();}if(e.key==='Tab'){const fs=[...panel.querySelectorAll('button,input:not([hidden])')].filter(x=>!x.disabled);if(e.shiftKey&&D.activeElement===fs[0]){e.preventDefault();fs.at(-1).focus();}else if(!e.shiftKey&&D.activeElement===fs.at(-1)){e.preventDefault();fs[0].focus();}}});}
root.HillRoadApp={controller:C,pagesOf};
render();
})(window);
