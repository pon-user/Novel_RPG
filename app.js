/* Tidebound Jewel: UI v0.2 - no hidden enemy data enters preparation state. */
(function(){
'use strict';
const D=window.GAME_DATA,B=window.BattleEngine,$=s=>document.querySelector(s),MAIN=$('#main-view'),OVER=$('#overlay');
const C=Object.fromEntries(D.charactersDraft.map(c=>[c.id,c]));
const E=Object.fromEntries(D.encounters.map(e=>[e.id,e]));
const ROSTER_IDS=['02','03','04','05','06','07'];
const SAVE='shiozakai-v02-game',OLD='novel-rpg-port-proto-v01';
const GEMS={balanced:'均衡の命珠',flame:'焔撃の命珠',tide:'水律の命珠'};
const STATS={hp:'HP',patk:'物攻',matk:'魔攻',pdef:'物防',mdef:'魔防',spd:'速度'};
const SLOTS={W:'武器',A:'防具',X:'装飾'};
const LOCATION={E01:'封鎖された倉庫',E02:'夜を駆ける群れ',E03:'双壁の間',E04:'潮霧の呪詛',E05:'双極の覇王',E06:'毒術師と護衛',E07:'忘却の三人衆',E08:'目覚める適応体',E09:'防壁判定者',E10:'逆転の監視者',E11:'長距離射手',E12:'連撃の騎士',E13:'暴走する命珠',E14:'蓄力の処刑者',E15:'反射する守護者',EP_A:'追憶・絶境',EP_B:'追憶・鏡海'};
const MISSIONS=[
 {id:'E01',head:'港の倉庫へ',hint:'倉庫へ向かうと、門の前で不穏な足音が聞こえる。',intro:'仲間たちは倉庫街へ向かった。封鎖された扉の向こうから、金属が擦れる音が聞こえる。',win:'門を守る気配が消え、青い命珠の光が霧の向こうへ伸びていった。'},
 {id:'E04',head:'霧の向こうを探る',hint:'霧に呪いが潜むと噂されている。',intro:'濃い霧が港を包む。エイルは毒の気配を感じ、仲間に注意を促した。',win:'霧が晴れていく。残された魔力の跡は、港の地下へ続いていた。'},
 {id:'E03',head:'双壁の門へ進む',hint:'古い遺構の入口には、正体不明の門番がいるという。',intro:'地下通路の終端。二つの影が動き、遺構の扉が重く閉じられた。',win:'最後の門番が倒れ、海底へと続く扉が開いた。命珠の光が再び脈打つ――つづく。'}
];
const SIDE={id:'E02',head:'港の噂を調べる',hint:'寄り道の探索。メインの進捗を変えない。',intro:'路地裏で不審な遠吠えが響いた。仲間たちは音の正体を探しに行く。',win:'騒ぎが収まった。港の人々は礼を告げ、知らない古い地図の話をしてくれた。'};
const cp=v=>JSON.parse(JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const attr=esc;
const defaultEquip=()=>Object.fromEntries(['H',...ROSTER_IDS].map(id=>[id,{W:'',A:'',X:''}]));
const basic=roster=>B.basicPlan(roster);
function initial(){const roster=['H','02','04','07'];return {version:'0.2',page:'story',stage:0,sideDone:0,pending:null,roster,gem:'balanced',equipment:defaultEquip(),plan:basic(roster),presets:[null,null,null],history:[],seen:{},lib:'characters',libFocus:null,logExpanded:true,selectedRound:1};}
function migrate(){let s=initial();try{const old=JSON.parse(localStorage.getItem(OLD)||'null');if(old&&old.roster?.length===4){s.roster=old.roster;s.gem=old.gem||'balanced';s.equipment={...defaultEquip(),...old.equipment};s.plan=basic(s.roster);s.stage=old.scene>=7?3:old.scene>=5?2:old.scene>=3?1:0;}}catch{}return s}
let state=migrate();try{const saved=JSON.parse(localStorage.getItem(SAVE)||'null');if(saved&&saved.version==='0.2'&&saved.roster?.length===4){state={...initial(),...saved,page:'story',plan:(saved.plan?.length===5?saved.plan:basic(saved.roster)),presets:(saved.presets||[null,null,null]).slice(0,3)};}}catch{}
let modal=null,blockClick=false,holdTimer=null,holdStart=null,storageWarned=false;
function save(){try{localStorage.setItem(SAVE,JSON.stringify({...state,page:'story'}));return true}catch(err){if(!storageWarned){storageWarned=true;notify('この表示環境ではブラウザ保存が使えません。通常のブラウザで開いてください。')}return false}}
function notify(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),3300)}
function badge(v){return `<span class="chip">${esc(v)}</span>`}
function act(v,action,klass='ghost'){return `<button class="btn ${klass}" data-action="${attr(action)}">${esc(v)}</button>`}
function portrait(id){const ch=C[id],hair={H:'#d7e7e9','02':'#8b6853','03':'#a47f71','04':'#ae9bd2','05':'#556e78','06':'#624f49','07':'#dfd5ad'}[id];return `<span class="token-art" style="--ink:${attr(ch.color)};--hair:${hair}">${window.CHAR_ART?.[id]?`<img src="${attr(window.CHAR_ART[id])}" alt="" onerror="this.style.display='none'">`:''}<span class="avatar-mark">${esc(ch.symbol)}</span><small>${id==='H'?'主':id}</small></span>`}
function cName(id){return C[id]?.name||id}
function gearName(id){return id?D.equipment[id]?.name||'不明':'なし'}
function getUnit(id){return B.makeParty([id],state.gem,state.equipment)[0].base}
function skillName(sid){return D.skills[sid]?.label||'通常攻撃'}
function skillDetail(s){let info=[];if(s.power)info.push(`${s.kind==='physical'?'物理':'魔法'} ${s.power}%`);if(s.pct)info.push(`${(s.stats||[]).map(k=>STATS[k]||k).join('・')} ${s.pct>0?'+':''}${Math.round(s.pct*100)}%`);if(s.duration)info.push(`${s.duration}行動`);if(s.value)info.push(`効果値 ${s.value}`);if(s.uses===1)info.push('1戦1回');if(['02.01','02.02','02.12'].includes(s.id))info.push('行動優先度+1');return info.join(' / ')||{cleanse:'異常・弱体を浄化。07は成功時に攻撃+20%・2行動',cover:'危険な味方の単体攻撃を肩代わり',cover_aoe:'危険な味方の全体攻撃被弾分を肩代わり',heal:'HP回復',interrupt:'敵の行動を阻害',dispel:'敵の強化を解除',taunt:'敵単体攻撃を引き付ける'}[s.type]||s.type}
function title(text,subtitle){return `<div class="view-head"><div><p class="eyebrow">THE TIDAL JEWEL / PROTOTYPE 0.2</p><h1 class="section-title">${esc(text)}</h1><p class="section-intro">${esc(subtitle)}</p></div></div>`}
function goto(page){state.page=page;save();render();window.scrollTo(0,0)}
function navUpdate(){document.querySelectorAll('[data-nav]').forEach(e=>e.classList.toggle('active',e.dataset.nav===state.page));$('#topbar-title').textContent={story:'物語',party:'編成と戦闘準備',library:'図鑑',recall:'追憶',about:'制作ノート'}[state.page]||'物語'}
function render(){navUpdate();const fn={story:renderStory,party:renderParty,library:renderLibrary,recall:renderRecall,about:renderAbout}[state.page]||renderStory;MAIN.innerHTML=fn();if(modal)renderModal();}
function journalView(entry){return `<div class="chronicle">
  <div class="timeline-part"><div class="chapter-step">01 <span>前回選択の結果</span></div><div class="story-quote">${esc(entry.intro)}</div></div>
  <div class="timeline-part"><div class="chapter-step">02 <span>戦闘の記録</span> <button class="text-switch" data-action="toggle-log">${state.logExpanded?'折りたたむ ▲':'すべて表示 ▼'}</button></div>${state.logExpanded?renderLogs(entry.result):`<div class="folded-log">戦闘記録は折りたたまれています。表示するとラウンドごとの展開を確認できます。</div>`}</div>
  <div class="timeline-part"><div class="chapter-step">03 <span>戦闘結果</span></div><div class="result-banner ${entry.result.won?'':'lost'}"><p class="eyebrow">${entry.result.won?'VICTORY':'DEFEAT'}</p><h2>${entry.result.won?'勝利':'敗北'}</h2><p>${entry.result.round}ラウンド · 味方残HP ${entry.result.remainingPartyHP} · 敵残HP ${entry.result.remainingEnemyHP}</p></div></div>
  <div class="timeline-part"><div class="chapter-step">04 <span>戦闘後の物語</span></div><div class="story-quote">${esc(entry.after)}</div></div>
 </div>`}
function renderLogs(res){return `<div class="battle-log-full">${res.logs.map(l=>{
 const from=String(l.actorId||'');const ally=C[from],isEnemy=from&&!ally;const round=l.round||0;
 const avatar=ally?portrait(from):`<span class="enemy-avatar">${isEnemy?'♜':'•'}</span>`;
 return `<div class="battle-log-event ${attr(l.type)}"><span class="turn-label">${round?`R${round}`:'開始'}</span>${avatar}<div>${esc(l.text)}</div></div>`;
 }).join('')}</div>`}
function renderStory(){const next=MISSIONS[Math.min(state.stage,2)],entry=state.history.filter(h=>h.kind!=='practice').at(-1);
 const done=state.stage>=3;
 return `<div class="compact-hero"><div><p class="eyebrow">AN OFFLINE NOVEL RPG</p><h1>潮境の命珠</h1><p>港の向こうで目覚める、ひとつの物語。</p></div><span class="hero-glyph">◈</span></div>
 <section class="card panel flow-stack"><div class="chapter-step">現在の物語 <span>${done?'終幕':`第${state.stage+1}幕`} · ${done?'海底の扉':next.head}</span></div>${entry?journalView(entry):`<div class="timeline-part"><div class="chapter-step">01 <span>物語のはじまり</span></div><div class="story-quote">潮風が運んできたのは、海の匂いと青白い光だった。港町ルーメ。失われた命珠が倉庫で見つかったという。あなたは仲間とともに港へ向かう。</div></div>`}
 <div class="timeline-part" id="next-choice"><div class="chapter-step">05 <span>${done?'エピローグ':'次の更新：行動選択'}</span></div>
 ${done?`<div class="story-quote">扉の先に、もう一つの命珠が浮かんでいた。――本編はここから始まる。</div><div class="actions">${act('最初から遊ぶ','restart-story')}</div>`:''}
 <p class="section-intro">${done?'試作ではサブ探索と追憶も試せる。':'行動は「未選択」が初期値。試作版のみボタンで即時更新。正式版では19:00を過ぎて次に起動した時点で処理する。'}</p>
 ${[{v:'main',title:done?'メイン完了':next.head,desc:done?'本編はここまで':next.hint,disabled:done},{v:'side',title:SIDE.head,desc:SIDE.hint},{v:'hold',title:'更新しない',desc:'行動を予約しない'}].map(opt=>`<button class="choice-tile ${state.pending===opt.v?'chosen':''}" data-choice="${opt.v}" ${opt.disabled?'disabled':''}><span class="choice-dot">${state.pending===opt.v?'◉':'○'}</span><span><strong>${esc(opt.title)}</strong><small>${esc(opt.desc)}</small></span></button>`).join('')}
 <div class="actions inline-bottom">${act('選択を取り消す','clear-choice')}${act('戦闘準備を見る','go-party')}${act('選択した行動を今すぐ更新（試作）','resolve-now','primary')}</div>
 <p class="quiet-note">${state.pending==='main'||state.pending==='side'?'予約中：編成・装備・技能予約は更新直前まで変更可能':state.pending==='hold'?'更新しない設定：戦闘は実行されない':'未選択：更新時刻になっても何も進まない'}</p>
 </div></section>`;
}
function renderParty(){const ready=state.roster.length===4;
 return `${title('編成と戦闘準備','上から4人の現在設定を確認。アイコンを押して入れ替え、装備やR1〜R5を押して編集。長押しで図鑑を開ける。')}
 <div class="card panel prep-summary"><div class="prep-head"><div><strong>次の戦闘に使う現在の設定</strong><p class="muted small">各キャラの3装備・5行動。対象は戦闘時に自動決定。</p></div>${badge('4体編成 / Lv1')}</div>
 <div class="prep-grid">${state.roster.map((id,slot)=>renderMember(id,slot)).join('')}</div>
 <p class="quiet-note">敵の人数・編成・行動は準備中に表示しない。装備は空欄でも問題なく、未指定のラウンドは通常攻撃になる。</p><div class="actions">${act('技能の自動対象ルールを見る','target-policy')}</div>
 <div class="prep-actions">${act('すべて通常攻撃に戻す','reset-skills')}${act('支援重視の予約を作る','auto-mixed')}${act('攻撃重視の予約を作る','auto-attack')}</div>
 </div>
 <section class="card panel preset-card"><div class="prep-head"><div><h2 class="section-title">編成プリセット</h2><p class="muted small">キャラ・命珠・装備・5行動をまとめて3組まで保存</p></div>${badge('最大3件')}</div><div class="preset-grid">${state.presets.map((p,i)=>`<div class="preset-slot"><strong>${p?.name||`編成${i+1}`}</strong><small>${p?p.roster.slice(1).join(' / '):'未保存'}</small><div class="preset-buttons"><button class="btn tiny ghost" data-preset-load="${i}" ${!p?'disabled':''}>使用</button><button class="btn tiny ghost" data-preset-save="${i}">保存</button></div></div>`).join('')}</div></section>`;
}
function renderMember(id,slot){const eq=state.equipment[id]||{W:'',A:'',X:''};return `<article class="prep-member"><button class="character-tap" data-edit-member="${slot}" data-info-kind="character" data-info-id="${id}" title="タップ：編成変更／長押し：図鑑">${portrait(id)}<strong>${esc(cName(id))}</strong><small>${id==='H'?esc(GEMS[state.gem]):esc(C[id].role)}</small></button>
 <div class="equipment-stack">${['W','A','X'].map(k=>`<button class="equip-chip" data-edit-equipment="${id}:${k}" data-info-kind="equipment" data-info-id="${eq[k]||''}" data-info-slot="${k}" title="タップで装備変更／長押しで図鑑">${k==='W'?'⚔':k==='A'?'◇':'✦'} <span>${esc(gearName(eq[k]))}</span></button>`).join('')}</div>
 <div class="skill-stack">${[0,1,2,3,4].map(r=>`<button class="round-chip" data-edit-skill="${id}:${r}"><b>R${r+1}</b><span>${esc(skillName(state.plan?.[r]?.[id]?.skill))}</span></button>`).join('')}</div>
 </article>`}
function renderLibrary(){const tabs=[['characters','キャラ'],['gems','命珠'],['equipment','装備'],['enemies','敵'],['stories','ストーリー']];let content='';
 if(state.lib==='characters')content=`<div class="catalog-grid">${D.charactersDraft.map(c=>`<button class="catalog-item" data-detail="character:${c.id}">${portrait(c.id)}<strong>${esc(c.name)}</strong><small>${esc(c.role)}</small></button>`).join('')}</div>`;
 if(state.lib==='gems')content=`<div class="catalog-grid">${Object.keys(GEMS).map(k=>`<button class="catalog-item" data-detail="gem:${k}"><span class="catalog-symbol">◇</span><strong>${esc(GEMS[k])}</strong></button>`).join('')}</div>`;
 if(state.lib==='equipment')content=`${['W','A','X'].map(k=>`<h3 class="catalog-heading">${SLOTS[k]}</h3><div class="catalog-grid">${Object.values(D.equipment).filter(x=>x.slot===k).map(x=>`<button class="catalog-item" data-detail="equipment:${x.id}"><span class="catalog-symbol">${k==='W'?'⚔':k==='A'?'⬡':'✦'}</span><strong>${esc(x.name)}</strong><small>${esc(x.id)}</small></button>`).join('')}</div>`).join('')}`;
 if(state.lib==='enemies')content=`<div class="catalog-grid">${D.encounters.map(e=>{const seen=state.seen[e.id];return `<button class="catalog-item" data-detail="enemy:${e.id}"><span class="catalog-symbol">${seen?'♜':'?'}</span><strong>${seen?esc(LOCATION[e.id]||e.name):'？？？'}</strong><small>${seen?`${seen.units.length}体 · 観測済み`:'未遭遇'}</small></button>`}).join('')}</div>`;
 if(state.lib==='stories')content=state.history.length?`<div class="history-list">${state.history.slice().reverse().map((h,i)=>`<button class="history-entry" data-detail="story:${state.history.length-i-1}"><b>${esc(h.label)}</b><small>${h.result.won?'勝利':'敗北'} · ${new Date(h.time).toLocaleString('ja-JP')} · 敵 ${h.enemies.map(x=>x.name).join(' / ')}</small></button>`).join('')}</div>`:`<div class="card panel">まだ物語の履歴はない。ストーリーを進めると過去の内容と戦闘記録が保存される。</div>`;
 return `${title('図鑑','知ったことだけが記録されていく。敵の未観測行動は「???」。')}<div class="catalog-tabs">${tabs.map(([k,v])=>`<button class="btn tiny ${state.lib===k?'primary':'ghost'}" data-lib="${k}">${v}</button>`).join('')}</div>${content}`
}
function renderRecall(){const past=Object.entries(state.seen);
 return `${title('追憶','以前見た敵への再挑戦。新しい物語の進行には影響しない。')}<div class="card panel"><h2 class="section-title">追憶の戦場</h2><p class="section-intro">遭遇した敵だけ選択可能。戦闘予約は編成画面で編集する。</p><div class="history-list">${past.map(([id,rec])=>`<div class="history-entry"><strong>${esc(LOCATION[id])}</strong><small>${rec.units.map(x=>x.name).join('・')}</small><button class="btn tiny ghost" data-practice="${id}">今すぐ模擬戦</button></div>`).join('')||'<p class="section-intro">まだ追憶に残る敵はいない。</p>'}</div></div><div class="card panel" style="margin-top:14px"><h2 class="section-title">COMING SOON</h2><p class="section-intro">周回要素・追加の試練は後日。</p></div>${location.search.includes('debug=1')?`<div class="card panel" style="margin-top:14px"><h3>開発者用：全17遭遇テスト</h3>${D.encounters.map(e=>`<button class="btn tiny ghost" data-practice="${e.id}">${e.id}</button>`).join(' ')}</div>`:''}`;
}
function renderAbout(){return `${title('制作ノート','これはプロトタイプv0.2。19時の自動判定はまだ実装していない。')}<div class="card panel"><h2 class="section-title">今回の変更</h2><p class="section-intro">戦闘ログは初期状態で全件表示。編成・装備・5ラウンド予約の統合、長押し図鑑、キャラ変更の確認、編成プリセット3件、敵編成の事前非表示、技能別自動ターゲット選択、未選択更新の保留、通常攻撃の初期設定、敗北時のシミュレーション演出に対応。</p><div class="divider"></div><p class="section-intro">試作版は「今すぐ更新」を押した時だけ戦闘する。定刻19時を過ぎ、次に起動したタイミングで処理する仕組みは正式版で導入。端末内保存であり、別端末の自動同期はなし。戦闘エンジンはPython試作版と完全な数値一致を保証しない。</p><div class="actions" style="margin-top:20px">${act('セーブデータをJSON保存','export')}${act('プレイデータを初期化','wipe','danger')}</div></div>`}
function openModal(item){modal=item;renderModal()}
function closeModal(){modal=null;OVER.hidden=true;OVER.innerHTML='';}
function info(kind,id,slot=''){if(kind==='equipment'&&!id) return `<h2>装備図鑑</h2><p>この枠は未装備です。図鑑の${SLOTS[slot]}一覧から選べます。</p>${Object.values(D.equipment).filter(e=>e.slot===slot).map(e=>`<p>${esc(e.name)}　${Object.entries(e.stats).map(([k,v])=>`${STATS[k]} ${v>0?'+':''}${v}`).join(' / ')}</p>`).join('')}`;
 if(kind==='character'){const c=C[id],stat=id==='H'?D.heroGems[state.gem]:D.characters[id];return `<h2>${esc(c.name)}</h2><p>${esc(c.alias)} · ${esc(c.role)}</p><div class="detail-profile">${portrait(id)}<p>${esc(c.look)}</p></div><h3>基礎能力値（Lv1）</h3><div class="stat-line">${Object.keys(STATS).map(k=>`<div class="stat-pill">${STATS[k]} <b>${stat[k]}</b></div>`).join('')}</div><p class="quiet-note">成長率：初期マスタに数値未定義（未確定）。速度はレベルで成長しない。</p><h3>所持技能</h3>${Object.keys(D.skills).filter(k=>k.startsWith(id+'.')||(id==='H'&&k.startsWith('H.'))).map(k=>{const s=D.skills[k],unlocked=B.skillOptions(id,state.gem).some(x=>x.id===k);return `<div class="detail-row"><strong>${esc(s.label)} ${unlocked?'':'🔒'}</strong><small>${esc(skillDetail(s))}</small></div>`}).join('')}`}
 if(kind==='equipment'){const e=D.equipment[id];return `<h2>${esc(e.name)}</h2><p>${SLOTS[e.slot]}　${esc(e.id)} · Lv${e.levelMin}〜</p><div class="stat-line">${Object.entries(e.stats).map(([k,v])=>`<div class="stat-pill">${STATS[k]} <b>${v>0?'+':''}${v}</b></div>`).join('')}</div><p class="quiet-note">特殊効果：${e.specialEffect?esc(e.specialEffect):'なし'}</p>`}
 if(kind==='gem'){const gem=D.heroGems[id];return `<h2>${esc(GEMS[id])}</h2><p>主人公の命珠。編成画面から変更できる。</p><div class="stat-line">${Object.entries(STATS).map(([k,v])=>`<div class="stat-pill">${v} <b>${gem[k]}</b></div>`).join('')}</div><h3>使用技能</h3>${B.skillOptions('H',id).map(s=>`<div class="detail-row"><b>${esc(s.label)}</b><small>${esc(skillDetail(s))}</small></div>`).join('')}`}
 if(kind==='enemy'){const observed=state.seen[id];if(!observed)return `<h2>？？？</h2><p>まだ遭遇していない相手です。</p>`;return `<h2>${esc(LOCATION[id])}</h2><p>${observed.units.map(u=>u.name).join(' / ')}</p><h3>観測済みの行動</h3>${observed.units.map(u=>`<h4>${esc(u.name)}</h4>${[1,2,3,4,5].map(r=>{const acts=observed.actions.filter(a=>a.enemyId===u.id&&a.round===r);return `<div class="detail-row"><b>第${r}R</b><small>${acts.length?esc([...new Set(acts.map(a=>a.detail))].join(' / ')):'???'}</small></div>`}).join('')}`).join('')}`}
 if(kind==='story'){const h=state.history[+id];return `<h2>${esc(h.label)}</h2><p>${new Date(h.time).toLocaleString('ja-JP')} / ${h.result.won?'勝利':'敗北'}</p><div class="story-quote">${esc(h.intro)}</div><h3>当時の編成</h3><p>${h.roster.map(cName).join(' / ')}</p><h3>敵編成</h3><p>${h.enemies.map(u=>u.name).join(' / ')}</p><h3>戦闘記録</h3>${renderLogs(h.result)}<h3>戦闘後</h3><div class="story-quote">${esc(h.after)}</div>`}
 return '<p>詳細がありません。</p>'}
function renderModal(){if(!modal)return;OVER.hidden=false;let inner='';
 if(modal.kind==='info'){inner=`<p class="eyebrow">図鑑 / 閲覧モード</p>${info(modal.type,modal.id,modal.slot)}`}
 if(modal.kind==='swap'){const from=state.roster[modal.index];inner=`<h2>${modal.index===0?'命珠を選ぶ':'仲間を入れ替える'}</h2><p class="section-intro">${modal.index===0?'命珠を変えると主人公の技能予約を通常攻撃へ初期化する。':'入れ替え時は装備3枠と技能予約5ラウンドを初期化する。'}</p><div class="modal-grid">${modal.index===0?Object.entries(GEMS).map(([k,name])=>`<button class="catalog-item" data-swap-gem="${k}"><span class="catalog-symbol">◇</span>${esc(name)}</button>`).join(''):ROSTER_IDS.map(id=>`<button class="catalog-item" data-swap-char="${id}" ${state.roster.includes(id)&&id!==from?'disabled':''}>${portrait(id)}<strong>${esc(cName(id))}</strong><small>${state.roster.includes(id)&&id!==from?'編成中':'入れ替える'}</small></button>`).join('')}</div>`}
 if(modal.kind==='equip'){const [id,slot]=[modal.id,modal.slot],items=Object.values(D.equipment).filter(x=>x.slot===slot);inner=`<h2>${esc(cName(id))} / ${SLOTS[slot]}</h2><p class="section-intro">装備を選択。装備を長押しすると図鑑で詳細を確認できます。</p><div class="modal-list"><button class="item-option" data-set-equip="${id}:${slot}:none">装備なし</button>${items.map(x=>`<button class="item-option" data-set-equip="${id}:${slot}:${x.id}" data-info-kind="equipment" data-info-id="${x.id}"><strong>${esc(x.name)}</strong><small>${Object.entries(x.stats).map(([k,v])=>`${STATS[k]}${v>=0?'+':''}${v}`).join(' / ')}</small></button>`).join('')}</div>`}
 if(modal.kind==='skill'){const [id,r]=[modal.id,modal.round],pool=B.skillOptions(id,state.gem);inner=`<h2>${esc(cName(id))} · 第${r+1}ラウンド</h2><p class="section-intro">技能だけを予約する。標的は戦闘時に自動決定。各固有技能は1戦1回。</p><div class="modal-list">${pool.map(s=>{const reserved=s.uses===1&&state.plan.some((row,i)=>i!==r&&row[id]?.skill===s.id);return `<button class="item-option" data-set-skill="${id}:${r}:${s.id}" ${reserved?'disabled':''}><strong>${esc(s.label)} ${reserved?'（別Rで使用済み）':''}</strong><small>${esc(skillDetail(s))}</small></button>`}).join('')}</div>`}
 if(modal.kind==='target-policy'){inner=`<h2>技能の自動ターゲット規則</h2><p>戦闘予約に敵・味方のターゲットIDは保存しません。各行動の実行時に、実際の生存者と状態から判定します。</p><div class="modal-list">${[['攻撃','攻撃が通る敵の中で、HP割合が最も低い相手。残HP→IDで同率決着。物理／魔法の完全無効は避ける。'],['全体攻撃・全体強化','生存する対象全員。'],['敵への弱体・妨害','有効な相手を優先したうえで物攻＋魔攻が最大の敵。'],['強化バフ','該当する攻撃能力が最も高い味方。'],['回復・防壁・庇護・全体庇護','HP割合が低い味方。庇護の対象は自分を除く。'],['浄化','解除できる異常・弱体のある味方を最優先。'],['強化解除','強化・障壁の多い敵を優先。']].map(([k,v])=>`<div class="detail-row"><strong>${k}</strong><small>${v}</small></div>`).join('')}</div><p class="quiet-note">HPや状態が変われば、そのラウンド内でも毎行動ごとに選び直します。敵が不明でも事前予約が可能です。今後の正式版では、技能ごとの優先規則をさらに細分化できます。</p>`}
 if(modal.kind==='confirm'){inner=`<h2>キャラクターを入れ替える？</h2><p class="section-intro">${esc(cName(state.roster[modal.index]))} → ${esc(cName(modal.newId))}</p><p>入れ替え先の装備3種と、5ラウンドの技能予約はすべて初期化されます。元のキャラの設定も装備なし・通常攻撃に戻します。</p><div class="actions" style="margin-top:20px"><button class="btn ghost" data-action="cancel-confirm">キャンセル</button><button class="btn primary" data-action="confirm-swap">入れ替える</button></div>`}
 OVER.innerHTML=`<div class="modal-screen"><section class="modal-panel" role="dialog" aria-modal="true"><div class="modal-top"><span class="eyebrow">SHIOZAKAI / ${modal.kind==='info'?'CODEX':'PREPARATION'}</span><button class="btn tiny ghost" data-action="close-modal">✕ 閉じる・編成に戻る</button></div><div class="modal-content">${inner}</div></section></div>`;
 const target=OVER.querySelector('.modal-panel');target?.focus();
}
function resetCharacter(id){state.equipment[id]={W:'',A:'',X:''};for(const r of state.plan)delete r[id]}
function setSkill(id,r,sid){const skill=B.skill(sid);if(!skill||!B.skillOptions(id,state.gem).some(s=>s.id===sid))return;if(skill.uses===1&&state.plan.some((row,i)=>i!==r&&row[id]?.skill===sid)){notify('同じ固有技能は1戦1回だよ');return}state.plan[r][id]={skill:sid};save();closeModal();render()}
function prepFromPreset(p){const roster=p.roster?.length===4?p.roster:state.roster;state.roster=cp(roster);state.gem=p.gem||'balanced';state.equipment={...defaultEquip(),...cp(p.equipment)};state.plan=(p.plan?.length===5?p.plan:basic(roster)).map(row=>Object.fromEntries(roster.map(id=>[id,{skill:row[id]?.skill||id+'.basic'}])));save();render();notify('編成プリセットを読み込んだよ')}
function choose(v){state.pending=v==='hold'?null:v;save();render()}
function sceneInfo(choice){return choice==='side'?SIDE:MISSIONS[Math.min(state.stage,2)]}
function resolve(choice=state.pending,kind='story',testId=null){if(!choice&&kind==='story'){notify('次の行動が未選択です');return}if(choice==='hold'){notify('更新を保留したよ');return}if(kind==='story'&&choice==='main'&&state.stage>=3){notify('本編は終了しているよ');return}
 const mission=kind==='practice'?{...SIDE,id:testId,head:LOCATION[testId],intro:'追憶の戦闘が再現された。',win:'シミュレーションは成功した。'}:sceneInfo(choice);
 const snapshot={roster:cp(state.roster),gem:state.gem,equipment:cp(state.equipment),plan:cp(state.plan)};
 try{const result=B.simulate({encounterId:mission.id,roster:state.roster,gem:state.gem,gear:state.equipment,plan:state.plan});
 const after=result.won?mission.win:'「よし、シミュレーション完了！」――目を開くと、あなたは出発前の部屋にいた。危険を予測する命珠の幻視だったのだ。同じ選択肢からもう一度挑める。';
 const record={kind,label:mission.head,encounterId:mission.id,time:new Date().toISOString(),intro:mission.intro,after,result,enemies:E[mission.id].enemies.map(u=>({id:u.id,name:u.name})),...snapshot};
 state.history.push(record);
 const seen=state.seen[mission.id]||{units:record.enemies,actions:[]};seen.units=record.enemies;
 for(const a of result.observed||[]){if(!seen.actions.some(x=>x.enemyId===a.enemyId&&x.round===a.round&&x.opcode===a.opcode))seen.actions.push(a)}
 state.seen[mission.id]=seen;
 if(kind==='story'&&result.won&&choice==='main')state.stage++;
 if(kind==='story'&&result.won&&choice==='side')state.sideDone++;
 state.pending=null;state.logExpanded=true;save();closeModal();goto(kind==='practice'?'recall':'story');
 if(kind==='story')setTimeout(()=>document.querySelector('.chronicle')?.scrollIntoView({behavior:'smooth',block:'start'}),100);
 }catch(e){notify(`戦闘を開始できない：${e.message}`);console.error(e)}
}
function exportSave(){const text=JSON.stringify(state,null,2),blob=new Blob([text],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='shiozakai-save-v02.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function perform(action){switch(action){case'target-policy':openModal({kind:'target-policy'});break;case'go-party':goto('party');break;case'close-modal':case'cancel-confirm':closeModal();break;case'confirm-swap':{if(!modal||modal.kind!=='confirm')return;const from=state.roster[modal.index],to=modal.newId;resetCharacter(from);resetCharacter(to);state.roster[modal.index]=to;for(const r of state.plan)r[to]={skill:to+'.basic'};save();closeModal();render();notify('編成を変更し、装備と技能を初期化したよ');break}
 case'toggle-log':state.logExpanded=!state.logExpanded;save();render();break;case'clear-choice':state.pending=null;save();render();break;case'resolve-now':resolve();break;case'auto-mixed':case'auto-attack':state.plan=B.autoPlan(state.roster,state.gem,null,action==='auto-attack'?'attack':'mixed');save();render();notify('5ラウンドの予約を作ったよ');break;case'reset-skills':state.plan=basic(state.roster);save();render();break;case'restart-story':if(confirm('物語の進行を最初に戻す？（図鑑と過去の記録は残します）')){state.stage=0;state.pending=null;save();render()}break;case'export':exportSave();break;case'wipe':if(confirm('全セーブデータ（編成・物語・図鑑・履歴）を初期化しますか？')){localStorage.removeItem(SAVE);state=initial();closeModal();render()}break;
 }}
function handleClick(e){if(blockClick){e.preventDefault();e.stopPropagation();blockClick=false;return}
 const t=e.target.closest('button');if(!t)return;
 const d=t.dataset;
 if(d.action){perform(d.action);return}
 if(d.nav){closeModal();goto(d.nav);return}
 if(d.choice){choose(d.choice);return}
 if(d.editMember!==undefined){openModal({kind:'swap',index:+d.editMember});return}
 if(d.editEquipment){const [id,slot]=d.editEquipment.split(':');openModal({kind:'equip',id,slot});return}
 if(d.editSkill){const [id,round]=d.editSkill.split(':');openModal({kind:'skill',id,round:+round});return}
 if(d.setEquip){const [id,slot,item]=d.setEquip.split(':');state.equipment[id][slot]=item==='none'?'':item;save();closeModal();render();return}
 if(d.setSkill){const [id,round,sid]=d.setSkill.split(':');setSkill(id,+round,sid);return}
 if(d.swapChar){const id=d.swapChar;if(state.roster.includes(id))return;openModal({kind:'confirm',index:modal.index,newId:id});return}
 if(d.swapGem){if(d.swapGem!==state.gem){state.gem=d.swapGem;for(const r of state.plan)r.H={skill:'H.basic'};save();notify('命珠を変更して主人公の技能予約を初期化したよ')}closeModal();render();return}
 if(d.presetSave!==undefined){const i=+d.presetSave;state.presets[i]={name:`編成 ${i+1}`,roster:cp(state.roster),gem:state.gem,equipment:cp(state.equipment),plan:cp(state.plan)};save();render();notify(`編成${i+1}を保存したよ`);return}
 if(d.presetLoad!==undefined){const p=state.presets[+d.presetLoad];if(p)prepFromPreset(p);return}
 if(d.lib){state.lib=d.lib;save();render();return}
 if(d.detail){const [type,id]=d.detail.split(':');openModal({kind:'info',type,id});return}
 if(d.practice){resolve(null,'practice',d.practice);return}
}
function longPressEvent(e){const t=e.target.closest('[data-info-kind]');if(!t)return;
 if(e.type==='pointerdown'){
  if(e.button!==0&&e.pointerType==='mouse')return;
  holdStart={x:e.clientX,y:e.clientY,target:t};clearTimeout(holdTimer);
  holdTimer=setTimeout(()=>{blockClick=true;openModal({kind:'info',type:t.dataset.infoKind,id:t.dataset.infoId,slot:t.dataset.infoSlot||''})},550);
 }else if(e.type==='pointermove'){
  if(holdStart&&(Math.abs(e.clientX-holdStart.x)>12||Math.abs(e.clientY-holdStart.y)>12)){clearTimeout(holdTimer);holdStart=null}
 }else{clearTimeout(holdTimer);holdStart=null}
}
document.body.addEventListener('click',handleClick);
for(const evt of ['pointerdown','pointerup','pointercancel','pointermove','pointerleave'])document.body.addEventListener(evt,longPressEvent);
document.body.addEventListener('contextmenu',e=>{const el=e.target.closest('[data-info-kind]');if(el){e.preventDefault();clearTimeout(holdTimer);openModal({kind:'info',type:el.dataset.infoKind,id:el.dataset.infoId,slot:el.dataset.infoSlot||''})}});
OVER.addEventListener('click',e=>{if(e.target===OVER||e.target.classList.contains('modal-screen'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
$('#reset-btn').addEventListener('click',()=>perform('wipe'));
render();window.GameAppDebug={getState:()=>state,render,resolve,openModal,closeModal,save};
})();
