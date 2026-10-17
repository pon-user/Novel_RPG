(function(){
'use strict';
const D=window.GAME_DATA, B=window.BattleEngine, $=s=>document.querySelector(s);
const MAIN=$('#main-view');
const CHAR=Object.fromEntries(D.charactersDraft.map(c=>[c.id,c]));
const ENC=Object.fromEntries(D.encounters.map(e=>[e.id,e]));
const escape=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const attr=s=>escape(s);
const FLAG='novel-rpg-port-proto-v01';
const slotNames={W:'武器',A:'防具',X:'装飾'};
const gemName={balanced:'均衡の命珠',flame:'焔撃の命珠',tide:'水律の命珠'};
const encounterLine={E01:'港へ続く倉庫街',E02:'夜を駆ける群れ',E03:'双壁の間',E04:'潮霧の呪詛',E05:'双極の覇王',E06:'毒術師と護衛',E07:'忘却の三人衆',E08:'目覚める適応体',E09:'防壁判定者',E10:'逆転の監視者',E11:'長距離射手',E12:'連撃の騎士',E13:'暴走する命珠',E14:'蓄力の処刑者',E15:'反射する守護者',EP_A:'追憶・絶境',EP_B:'追憶・鏡海'};
const allowedParty=['02','03','04','05','06','07'];
const scenes=[
 {id:'prologue',chapter:'序章 / THE HARBOR',speaker:'地の文',lines:'潮風が運んできたのは、海の匂いと、青白い光だった。\n\n灯港ルーメ。失われたはずの「命珠」が、今朝、港の倉庫で発見されたという。\nその知らせを聞いて、あなたは仲間とともに港へ向かう。',choices:[{label:'港の門をくぐる',next:1,flag:'quiet'},{label:'光の正体を確かめる',next:1,flag:'curious'}]},
 {id:'crew',chapter:'序章 / THE FOUR',speaker:'リノ（03）',lines:'「……あっ、来た！　この子も何か感じてるんだって」\n\n少女の隣で、小さな犬が一度だけ吠える。\n盾を担いだ大柄な熊獣人が、ゆっくりと頷いた。',choices:[{label:'仲間を編成する',page:'party'},{label:'先へ進む',next:2}]},
 {id:'warehouse',chapter:'第一幕 / WAREHOUSE',speaker:'ガルド（02）',lines:'「扉の向こう、足音がする。先に俺が行こう」\n\n封鎖された倉庫の前に、鎧の兵士が立っている。\n青い光は、どうやらその奥だ。',choices:[{label:'重装兵に挑む（E01）',battle:'E01'},{label:'別の編成を考える',page:'party'}]},
 {id:'after-warehouse',chapter:'第二幕 / SEA FOG',speaker:'セラ（04）',lines:'「これが、噂の命珠……？」\n\n指先に浮かんだ光が、突然、霧になって散った。\n港の外れで、呪文を唱える声が聞こえる。',choices:[{label:'霧を追う',next:4},{label:'仲間を整える',page:'party'}]},
 {id:'poison',chapter:'第二幕 / THE CURSE',speaker:'エイル（07）',lines:'「霧に触れた人が倒れている。毒だと思う」\n\n高速の呪術師と巨大な魔法破壊者が道を塞ぐ。\n毒を解除するタイミングと、魔法攻撃を防ぐ準備が試される。',choices:[{label:'呪いを断つ（E04・C13）',battle:'E04'},{label:'作戦を練り直す',page:'party'}]},
 {id:'after-poison',chapter:'第三幕 / TWO WALLS',speaker:'ルクス（05）',lines:'「……奥へ続く道は、二つの壁で封じられている」\n\n光の盾は物理を通さず、影の処刑者は魔法を受けつけない。\n斥候がこちらを見つけた。',choices:[{label:'双壁の間へ',next:6},{label:'装備を見直す',page:'party'}]},
 {id:'twowalls',chapter:'第三幕 / THE GATE',speaker:'カイ（06）',lines:'「一つずつ片付けりゃいい。……ただし順番を間違えるなよ」\n\n扉の中央に、命珠と同じ紋様が刻まれている。\nここを越えれば、海底の遺構へ続くはずだ。',choices:[{label:'双壁に挑む（E03・S9）',battle:'E03'},{label:'戦闘準備へ',page:'battle'}]},
 {id:'ending',chapter:'終幕 / TO BE CONTINUED',speaker:'地の文',lines:'最後の盾が砕け、海へ続く扉が開いた。\n\nそこにあったのは、もう一つの命珠。\n誰が、何のために、港へ置いたのか。\n\n――本編は、ここから始まる。',choices:[{label:'敵図鑑で別の戦闘を試す',page:'library'},{label:'最初から物語を読む',resetStory:true}]}
];
function defaults(){const gear={};const none={W:'',A:'',X:''};for(const id of ['H',...allowedParty]){
 const orient=id==='H'?'physical':['02','06'].includes(id)?'physical':'magic';const profile=D.gearsByFamily.mixed[orient];
 gear[id]={W:profile.find(x=>x[0]==='W')||'',A:profile.find(x=>x[0]==='A')||'',X:profile.find(x=>x[0]==='X')||''};
 }
 return {page:'story',scene:0,roster:['H','02','04','07'],gem:'balanced',equipment:gear,encounter:'E01',plan:null,planEncounter:null,round:0,result:null,completed:[],storyFlag:'',libraryFilter:'all',logFilter:'all'};
}
let state=defaults();try{const s=JSON.parse(localStorage.getItem(FLAG)||'null');if(s&&Array.isArray(s.roster)&&s.roster.length===4&&s.roster[0]==='H'&&Array.isArray(s.completed)){state={...defaults(),...s,page:'story',result:null}}}catch{}
function persist(){try{const {result,...safe}=state;localStorage.setItem(FLAG,JSON.stringify({...safe,page:'story'}))}catch{}}
function toast(str){const el=$('#toast');el.textContent=str;el.classList.add('show');clearTimeout(window._toastTimer);window._toastTimer=setTimeout(()=>el.classList.remove('show'),3000)}
function btn(label,action,kind='ghost',extra=''){return `<button class="btn ${kind}" data-action="${attr(action)}" ${extra}>${escape(label)}</button>`}
function portrait(id,mini=false){const c=CHAR[id],classes=['portrait',id==='H'?'hero-portrait':'',id==='02'?'bear':'',id==='04'?'long-hair':''].join(' ');
 const hair={'H':'#d6e3ee','02':'#8b6853','03':'#a47f71','04':'#ae9bd2','05':'#556e78','06':'#624f49','07':'#dfd5ad'}[id];
 return `<div class="${classes}" style="--character-haze:${attr(c.color)};--character-hair:${hair};--character-coat:${attr(c.color)}"><span class="sigil">${escape(c.symbol)}</span><span class="orb"></span><span class="coat"></span><span class="head"></span><span class="hair"></span><span class="portrait-placeholder">仮ビジュアル</span>${window.CHAR_ART?.[id]?`<img alt="${escape(c.name)}の立ち絵" src="${attr(window.CHAR_ART[id])}" onerror="this.hidden=true">`:''}</div>`;
}
function chip(text,cls=''){return `<span class="chip ${cls}">${escape(text)}</span>`}
function header(title,desc,right=''){return `<div class="section-head"><div><p class="eyebrow">SHIOZAKAI / PROTOTYPE</p><h1 class="section-title">${title}</h1><p class="section-intro">${desc}</p></div>${right}</div>`}
function updateNav(){document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.nav===state.page));let title={story:'物語',party:'編成と装備',battle:'戦闘準備',library:'敵図鑑・試験',about:'制作ノート',result:'戦闘結果'}[state.page]||'物語';$('#topbar-title').textContent=title;}
function goto(page){state.page=page;persist();render();window.scrollTo(0,0)}
function render(){updateNav();const view={story:renderStory,party:renderParty,battle:renderBattle,library:renderLibrary,about:renderAbout,result:renderResult}[state.page]||renderStory;MAIN.innerHTML=view();}
function nextStory(){if(state.scene<scenes.length-1)state.scene++;goto('story')}
function renderStory(){const scene=scenes[state.scene]||scenes[0];const intro=state.scene<=1;
 const quests=[['E01','封鎖された倉庫'],['E04','港に残る呪い'],['E03','鏡の双壁']];
 const steps=quests.map(([id,name],i)=>`<div class="quest-item ${state.completed.includes(id)?'done':i===0||state.completed.includes(quests[i-1]?.[0])?'active':''}"><span class="quest-index">${state.completed.includes(id)?'✓':String(i+1).padStart(2,'0')}</span><div><strong>${name}</strong><p>${escape(encounterLine[id])} · ${id==='E03'?'S9実装':id==='E04'?'C13実装':'基準敵'}</p></div></div>`).join('');
 const text=scene.lines+(state.storyFlag==='curious'&&state.scene===2?'\n\nあなたの命珠は、扉の奥に近づくほど淡く脈打った。':'');
 return `<div class="hero"><div class="hero-ornament">◈</div><div class="hero-content"><p class="eyebrow">A SMALL TALE BY THE SEA</p><h1>潮境の命珠</h1><p>失われた光を追う、港の小さな冒険。<br>仮ストーリー × 実際に動く5ラウンド戦闘。</p><div class="actions">${chip('STORY DEMO', 'goldchip')}${chip('4人パーティ')}${chip('Lv1')}</div></div></div>
 <div class="story-layout"><section class="card story-panel"><span class="story-voice">${escape(scene.chapter)} / ${escape(scene.speaker)}</span><div class="story-text">${escape(text)}</div><div class="story-choices">${scene.choices.map((c,i)=>`<button class="story-choice" data-story-choice="${i}"><span>${escape(c.label)}</span><span class="gold">→</span></button>`).join('')}</div></section>
 <aside class="card story-panel"><p class="eyebrow">JOURNEY LOG</p><h3 style="font-size:21px;margin:12px 0 14px">港の探索記録</h3>${steps}<p class="section-intro" style="margin-top:14px">戦闘に敗北しても編成と予約行動を変更して再挑戦できる。<br><br>現在の仲間：${state.roster.slice(1).map(id=>escape(CHAR[id].name)).join(' / ')}</p></aside></div>`;
}
function selectionCard(c){const picked=state.roster.includes(c.id);return `<div class="character-card ${picked?'selected':''}">${portrait(c.id)}<h3>${escape(c.name)}</h3><div class="ch-meta">${escape(c.role)} / ${escape(c.id)}</div><p>${escape(c.look)}</p><button data-pick="${c.id}" class="btn tiny ${picked?'primary':'ghost'} pick">${picked?'✓ 編成中':'＋ 編成する'}</button></div>`}
function selectOption(value,label,sel){return `<option value="${attr(value)}" ${String(value)===String(sel)?'selected':''}>${escape(label)}</option>`}
function renderParty(){const companions=D.charactersDraft.filter(x=>x.id!=='H');const h=CHAR.H;
 const gearSummary=(id)=>{const equipment=state.equipment[id]||{},stats=B.makeParty([id],state.gem,state.equipment)[0].base;
 const options=slot=>[selectOption('','装備なし',equipment[slot]),...Object.values(D.equipment).filter(x=>x.slot===slot).map(g=>selectOption(g.id,`${g.name} (${Object.entries(g.stats).map(([k,v])=>`${statLabel(k)}${v>=0?'+':''}${v}`).join('、')})`,equipment[slot]))].join('');
 return `<article class="member-slot"><div class="member-head"><div style="width:77px">${portrait(id,true)}</div><div><h3>${escape(CHAR[id].name)}</h3><p class="muted small" style="margin-top:5px">${escape(CHAR[id].role)}</p></div></div><div class="stat-line">${['hp','patk','matk','pdef','mdef','spd'].map(s=>`<div class="stat-pill">${statLabel(s)}<strong>${stats[s]}</strong></div>`).join('')}</div><div class="equipment-row">${['W','A','X'].map(slot=>`<div class="field"><label>${slotNames[slot]}</label><select class="select" data-equipment="${id}:${slot}">${options(slot)}</select></div>`).join('')}</div></article>`}
 return `${header('編成と装備','仲間6人から3人を選び、主人公と合わせて4人編成。装備は武器・防具・装飾の3枠。',chip('装備マスタ30種','goldchip'))}
 <div class="card panel" style="margin-bottom:18px"><div class="role-banner"><div><h3 class="section-title" style="font-size:20px">主人公と命珠</h3><p class="section-intro">命珠によって主人公の能力・使用技能が変化する。</p></div>${chip('固定枠')}</div><div class="actions" style="margin-top:13px">${['balanced','flame','tide'].map(k=>`<button data-gem="${k}" class="btn ${state.gem===k?'primary':'ghost'} tiny">${gemName[k]}</button>`).join('')}</div></div>
 <div class="section-head"><h2 class="section-title" style="font-size:20px">仲間を選ぶ</h2><span class="chip ${state.roster.length===4?'mintchip':''}">${state.roster.length-1} / 3 人を編成</span></div><div class="selection-grid">${companions.map(selectionCard).join('')}</div>
 <div class="section-head" style="margin-top:28px"><div><h2 class="section-title" style="font-size:21px">装備とステータス</h2><p class="section-intro">装備による変化を即時反映。6つの一括方針も利用できる。</p></div></div>
 <div class="actions" style="margin-bottom:14px">${Object.keys(D.gearsByFamily).map(k=>`<button class="btn tiny ghost" data-gear-preset="${k}">${{none:'装備なし',offense:'火力',defense:'守備',speed:'速度',mixed:'均衡',anti_magic:'対魔法'}[k]}</button>`).join('')}</div>
 <div class="selection-grid" id="equipped-party">${state.roster.map(gearSummary).join('')}</div><div class="actions" style="justify-content:flex-end;margin-top:22px">${btn('この編成で戦闘準備へ →','go-battle','primary')}</div>`;
}
function statLabel(v){return {hp:'HP',patk:'物攻',matk:'魔攻',pdef:'物防',mdef:'魔防',spd:'速度'}[v]||v}
function ensurePlan(){if(!state.plan||state.planEncounter!==state.encounter||state.plan.some(row=>state.roster.some(id=>!row[id]))){state.plan=B.autoPlan(state.roster,state.gem,ENC[state.encounter]);state.planEncounter=state.encounter;state.round=0}}
function renderBattle(){ensurePlan();const enc=ENC[state.encounter],r=state.round,plan=state.plan[r];
 const enemies=enc.enemies.map(e=>`<div class="enemy-mini"><div><strong>${escape(e.name)}</strong><br><small>HP ${e.hp} / 物攻 ${e.patk} / 魔攻 ${e.matk}</small></div><span class="chip">SPD ${e.spd}</span></div>`).join('');
 const rows=state.roster.map(id=>{
 const action=plan[id],pool=B.skillOptions(id,state.gem),chosen=B.skill(action.skill),mode=B.targetMode(chosen);
 const options=mode==='ally'?state.roster.filter(x=>!['cover','cover_aoe'].includes(chosen.type)||x!==id).map(x=>[x,CHAR[x].name]):mode==='enemy'?enc.enemies.map(x=>[x.id,x.name]):[];
 const targetSelect=mode==='none'?`<div class="field"><label>対象</label><div class="chip" style="padding:12px">${chosen.scope==='allies'?'味方全体':chosen.scope==='enemies'?'敵全体':chosen.scope==='self'?'自分':'指定なし'}</div></div>`:
 `<div class="field"><label>${mode==='ally'?'守る／強化する味方':'攻撃／妨害する敵'}</label><select class="select" data-target="${id}">${options.map(([v,l])=>selectOption(v,l,action.target)).join('')}</select></div>`;
 const description=describeSkill(chosen);
 return `<div class="plan-row"><div class="plan-character"><div class="token">${escape(CHAR[id].symbol)}</div><div><strong>${escape(CHAR[id].name)}</strong><span>${escape(CHAR[id].role)}</span></div></div><div class="field"><label>使用技能 <span class="gold">${chosen.uses===1?'1戦1回':''}</span></label><select class="select" data-skill="${id}">${pool.map(s=>selectOption(s.id,`${s.label}${s.type==='damage'?` · ${s.power}%`:''}${['02.01','02.02','02.12'].includes(s.id)?' ⚡優先+1':''}`,action.skill)).join('')}</select><div class="skill-description">${escape(description)}</div></div>${targetSelect}</div>`;
 }).join('');
 const missionExtra=enc.id==='E03'?'S9：物理無効・魔法無効の2壁＋斥候。攻撃種を意識して対象を指定しよう。':enc.id==='E04'?'C13：第2・4Rに毒を付与。浄化タイミングに意味がある。':'敵の行動は5R固定。技能は原則1戦1回。';
 return `${header('5ラウンド行動予約','4人全員の5ラウンド分を決めてから戦闘開始。各ラウンドは優先度 → 速度順で行動する。',chip(`${enc.id} · Lv1`,'goldchip'))}
 <div class="battle-header"><div class="card panel"><p class="eyebrow">SELECT ENCOUNTER</p><div class="field" style="margin:12px 0"><label>挑戦する敵</label><select class="select" data-select-encounter>${D.encounters.map(e=>selectOption(e.id,`${e.id} · ${encounterLine[e.id]||e.name}`,state.encounter)).join('')}</select></div><h3 class="section-title" style="font-size:19px;margin-top:11px">${escape(encounterLine[enc.id]||enc.name)}</h3><p class="section-intro">${escape(missionExtra)}</p><div class="actions" style="margin-top:16px">${chip('全5Rで敵撃破')}${chip('4体編成')}</div></div><div class="card enemy-preview"><span class="eyebrow">ENEMY UNITS</span>${enemies}</div></div>
 <div class="round-tabs">${[0,1,2,3,4].map(i=>`<button class="round-tab ${r===i?'active':''}" data-round="${i}">第${i+1}R</button>`).join('')}</div>
 <section class="plan-grid">${rows}</section><div class="battle-actions"><div class="actions">${btn('標準の予約を自動作成','auto-mixed','ghost')}${btn('攻撃優先で予約','auto-attack','ghost')}${window.GAME_SAMPLES?.[enc.id]?btn('攻略例を読み込む','load-sample','ghost'):''}</div><div class="actions">${btn('編成を変更','go-party','ghost')}${btn('5Rを実行する ⚔','run-battle','primary')}</div></div>
 <p class="section-intro" style="margin-top:18px">予約を変更すると自動保存。技能重複や対象不整合は開始時に検知する。戦闘中の乱数は使用しない。</p>`;
}
function describeSkill(s){const pct=n=>`${n>0?'+':''}${Math.round(n*100)}%`;
 if(s.type==='damage'){let str=`${s.kind==='physical'?'物理':'魔法'}${s.power||100}%`;if(s.scope==='enemies')str+=' / 敵全体';if(s.hits)str+=` / ${s.hits}ヒット`;if(s.debuff_stats)str+=`＋攻撃低下${pct(s.debuff_pct)}`;if(s.self_buff_pdef)str+=`＋自身物防${pct(s.self_buff_pdef)}`;return str}
 if(['buff','debuff'].includes(s.type))return `${s.stats.map(statLabel).join(' / ')} ${pct(s.pct)} ・ ${s.duration}行動`;
 return {barrier:`障壁${s.value}付与`,cleanse:'状態異常・弱体化を解除。07の成功時は攻撃+20%×2行動',cover:'単体攻撃を指定味方から肩代わり',cover_aoe:'全体攻撃の指定味方1人分を肩代わり',taunt:'敵単体攻撃を引き付ける / 優先度+1',status:'状態異常を付与',interrupt:'敵の行動を1回阻害',heal:`HP ${s.value}回復`,dispel:'敵強化の解除',immune_control:'行動阻害を防ぐ'}[s.type]||s.type;
}
function renderLibrary(){const records=D.encounters.filter(e=>state.libraryFilter==='all'||(state.libraryFilter==='story'&&['E01','E03','E04'].includes(e.id))||(state.libraryFilter==='challenge'&&['E05','E09','E12','E13','EP_A','EP_B'].includes(e.id)));
 return `${header('敵図鑑・戦闘試験','物語に登場する敵だけでなく、17遭遇すべてを自由に試せる。EP-Bは殲滅勝利のみで、防衛ルート案は未実装。',chip('17遭遇','goldchip'))}
 <div class="actions" style="margin-bottom:20px">${[['all','すべて'],['story','物語に登場'],['challenge','高難度候補']].map(([k,v])=>`<button data-filter="${k}" class="btn tiny ${state.libraryFilter===k?'primary':'ghost'}">${v}</button>`).join('')}</div>
 <div class="selection-grid">${records.map(e=>`<article class="card panel"><div class="role-banner"><span class="eyebrow">${e.id}</span>${chip(e.enemies.length+'体')}</div><h3 class="section-title" style="font-size:20px;margin:12px 0 8px">${escape(encounterLine[e.id]||e.name)}</h3><p class="section-intro" style="min-height:55px">${escape(e.enemies.map(x=>x.name).join('・'))}</p><div class="actions" style="margin:12px 0 14px">${e.id==='E03'?chip('S9採用','mintchip'):e.id==='E04'?chip('C13採用','mintchip'):e.id==='EP_B'?chip('敵撃破のみ'):chip('既存試験敵')}</div><button class="btn block ghost" data-encounter="${e.id}">この敵に挑む →</button></article>`).join('')}</div>`;
}
function renderResult(){const res=state.result;if(!res)return `<div class="card panel">戦闘結果はまだありません。${btn('戦闘準備へ','go-battle','primary')}</div>`;
 const round=Math.min(state.round,res.states.length-1),snapshot=res.states[round];
 const units=(arr,enemy=false)=>arr.map(x=>`<div class="hp-line"><div class="hp-top"><span>${escape(x.name)}</span><span>${x.hp}/${x.maxhp}${x.poison?' ☠':''}${x.shields?' 🛡'+x.shields:''}</span></div><div class="hp-meter ${enemy?'enemy':''}"><span style="width:${Math.max(0,Math.round(x.hp/x.maxhp*100))}%"></span></div></div>`).join('');
 const logs=res.logs.filter(l=>state.logFilter==='all'||l.round===round).map(l=>`<div class="log-line ${l.type}">${escape(l.text)}</div>`).join('');
 const isStoryGate=['E01','E04','E03'].includes(res.encounterId);
 return `${header('戦闘結果','敵の固定行動と5ラウンドの予約を再現。ラウンドを選んでHP推移と戦闘ログを確認できる。',chip(res.encounterId))}
 <div class="result-banner ${res.won?'':'lost'}"><p class="eyebrow">${res.won?'VICTORY':'DEFEAT'}</p><h2>${res.won?'勝 利':'敗 北'}</h2><p>${res.won?'5ラウンド以内に敵を全滅させた。':'敵を全滅させられなかった。編成・装備・行動順を変更できる。'}</p></div>
 <div class="battle-stats"><div class="metric"><strong>${res.round} / 5</strong><span>終了ラウンド</span></div><div class="metric"><strong>${res.remainingPartyHP}</strong><span>味方残りHP</span></div><div class="metric"><strong>${res.remainingEnemyHP}</strong><span>敵残りHP</span></div><div class="metric"><strong>${res.metrics.counter}</strong><span>守護反撃回数</span></div></div>
 <div class="actions" style="margin-bottom:17px">${btn('同じ予約で再戦','rerun','ghost')}${btn('行動を組み直す','go-battle','ghost')}${res.won&&isStoryGate?btn('物語の続きを読む →','continue-story','primary'):btn('敵図鑑へ','go-library','primary')}</div>
 <div class="round-tabs">${res.states.map((x,i)=>`<button class="round-tab ${round===i?'active':''}" data-result-round="${i}">${i===0?'開始時':`第${x.round}R後`}</button>`).join('')}</div><div class="state-panes"><div class="card state-panel"><h3>味方HP</h3>${units(snapshot.allies)}</div><div class="card state-panel"><h3>敵HP</h3>${units(snapshot.enemies,true)}</div></div>
 <div class="section-head" style="margin-top:27px;margin-bottom:10px"><h2 class="section-title" style="font-size:21px">戦闘ログ</h2><div class="actions"><button class="btn tiny ${state.logFilter==='all'?'primary':'ghost'}" data-log-filter="all">すべて</button><button class="btn tiny ${state.logFilter==='round'?'primary':'ghost'}" data-log-filter="round">選択Rのみ</button></div></div>
 <div class="logs" id="combat-log" aria-label="戦闘ログ">${logs}</div><div class="notice" style="margin-top:17px">戦闘は試作Pythonモデルを参考にしたブラウザ移植版。イベントの順序・状態異常期間など、検証エンジンとの完全一致は今後の監査対象です。</div>`;
}
function renderAbout(){return `${header('この試作について','ゲーム全体を歩いて試すための叩き台。物語、キャラ名、グラフィックは仮。',chip('0.1.0 / OFFLINE READY','goldchip'))}
 <div class="card panel"><h3 class="section-title" style="font-size:22px">実装されているもの</h3><div class="info-grid" style="margin-top:13px"><div>${[['物語','港を舞台にした仮の短編・3戦'],['パーティ','主人公＋仲間3人（20通り）'],['装備','武器・防具・装飾、30種'],['技能','Lv1初期技能＋奥義・1戦1回'],['戦闘','5R事前予約、速度・優先度で行動'],['敵','17遭遇／③S9・④C13のみ新規採用']].map(([l,v])=>`<div class="info-row"><span class="muted">${l}</span><strong>${v}</strong></div>`).join('')}</div><div>${[['攻撃役','04 MATK / 06 PATK = 130（v11試験基準）'],['バフ','対象能力群が異なれば乗算（例1.9575倍）'],['防御先制','庇護・全体庇護・挑発＝優先度＋1'],['毒','対象が行動した後にダメージ'],['浄化','07成功時、PATK/MATK＋20%'],['EP-B','従来の撃破条件のみ・二経路案なし']].map(([l,v])=>`<div class="info-row"><span class="muted">${l}</span><strong>${v}</strong></div>`).join('')}</div></div></div>
 <div class="card panel" style="margin-top:15px"><h3 class="section-title" style="font-size:22px;margin-bottom:12px">差し替えと動作環境</h3><p class="section-intro">GitHub PagesなどのHTTPS静的ホスティング、またはindex.htmlを直接開いて遊べる。定刻処理は未実装で、テスト版は戦闘を即時実行する。外部ライブラリ・通信・アカウント不要。編成・装備・物語進捗はブラウザのlocalStorageに保存される。別端末との同期は未実装。</p><p class="section-intro">キャラは過去の別案を元にした属性・容姿メモを反映しているが、表示はCSSによる仮ビジュアル。正式な画像素材は未挿入。art.js のCHAR_ARTへ画像パスを設定すると差し替えできる。固有名もすべて仮名。</p><p class="section-intro">ブラウザ戦闘エンジンはPythonの実験用戦闘シミュレータを仕様参照した独立移植であり、Python試験結果と1件ずつ一致する保証はない。正式ゲーム実装の基盤とする前に差分テストが必要。</p><div class="actions" style="margin-top:21px">${btn('進捗と編成をJSONで保存','export-data','ghost')}${btn('はじめからやり直す','clear-data','danger')}</div></div>`;
}
function launchBattle(id){state.encounter=id;state.plan=null;state.planEncounter=null;state.round=0;goto('battle')}
function runBattle(){try{ensurePlan();let result=B.simulate({encounterId:state.encounter,roster:state.roster,gem:state.gem,gear:state.equipment,plan:state.plan});state.result=result;state.round=result.states.length-1;state.logFilter='all';if(result.won&&!state.completed.includes(state.encounter))state.completed.push(state.encounter);goto('result');}catch(err){toast(`戦闘を開始できない：${err.message}`)}}
function chooseStory(index){const choice=scenes[state.scene].choices[index];if(!choice)return;if(choice.flag)state.storyFlag=choice.flag;
 if(choice.resetStory){state.scene=0;goto('story')}
 else if(choice.page)goto(choice.page);
 else if(choice.battle)launchBattle(choice.battle);
 else if(typeof choice.next==='number'){state.scene=choice.next;goto('story')}
}
function setSkill(id,sid){const r=state.round;const s=B.skill(sid);const poolEnemies=ENC[state.encounter].enemies;
 for(let i=0;i<5;i++){if(i!==r&&state.plan[i][id].skill===sid&&s.uses===1)state.plan[i][id]={skill:id+'.basic',target:poolEnemies[0].id};}
 const mode=B.targetMode(s);let target=null;
 if(mode==='enemy'){const physical=s.kind==='physical';target=poolEnemies.find(e=>!e.immuneKinds?.includes(physical?'physical':'magic'))?.id||poolEnemies[0].id}
 else if(mode==='ally'){target=state.roster.find(x=>(s.type!=='cover'&&s.type!=='cover_aoe')||x!==id)||'H'}
 state.plan[r][id]={skill:sid,target};persist();render();}
function applyPreset(kind){for(const id of ['H',...allowedParty]){const ori=id==='H'?state.gem==='tide'?'magic':'physical':['02','06'].includes(id)?'physical':'magic';const ids=D.gearsByFamily[kind][ori];state.equipment[id]={W:ids.find(x=>x[0]==='W')||'',A:ids.find(x=>x[0]==='A')||'',X:ids.find(x=>x[0]==='X')||''}}persist();render();toast('装備方針を変更したよ')}
function saveFile(filename,contents){const b=new Blob([contents],{type:'application/json;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)}
MAIN.addEventListener('click',e=>{
 const storyButton=e.target.closest('[data-story-choice]');if(storyButton){chooseStory(+storyButton.dataset.storyChoice);return}
 const pick=e.target.closest('[data-pick]');if(pick){let id=pick.dataset.pick;if(state.roster.includes(id)){state.roster=state.roster.filter(x=>x!==id)}else if(state.roster.length<4){state.roster.push(id);state.roster=['H',...state.roster.filter(x=>x!=='H').sort()]}else{toast('仲間は3人までだよ');return}state.plan=null;persist();render();return}
 const gem=e.target.closest('[data-gem]');if(gem){state.gem=gem.dataset.gem;state.plan=null;persist();render();return}
 const gp=e.target.closest('[data-gear-preset]');if(gp){applyPreset(gp.dataset.gearPreset);return}
 const filter=e.target.closest('[data-filter]');if(filter){state.libraryFilter=filter.dataset.filter;render();return}
 const book=e.target.closest('[data-encounter]');if(book){launchBattle(book.dataset.encounter);return}
 const rt=e.target.closest('[data-round]');if(rt){state.round=+rt.dataset.round;render();return}
 const rr=e.target.closest('[data-result-round]');if(rr){state.round=+rr.dataset.resultRound;render();return}
 const lf=e.target.closest('[data-log-filter]');if(lf){state.logFilter=lf.dataset.logFilter;render();return}
 const act=e.target.closest('[data-action]')?.dataset.action;if(!act)return;
 if(act==='go-battle')goto('battle');else if(act==='go-party')goto('party');else if(act==='go-library')goto('library');else if(act==='run-battle'||act==='rerun')runBattle();
 else if(act==='auto-mixed'||act==='auto-attack'){state.plan=B.autoPlan(state.roster,state.gem,ENC[state.encounter],act==='auto-attack'?'attack':'mixed');state.planEncounter=state.encounter;state.round=0;persist();render();toast('5ラウンドの予約を作ったよ')}
 else if(act==='load-sample'){const sample=window.GAME_SAMPLES?.[state.encounter];if(sample){state.roster=[...sample.roster];state.gem=sample.gem;state.equipment={...state.equipment,...JSON.parse(JSON.stringify(sample.equipment))};state.plan=JSON.parse(JSON.stringify(sample.plan));state.planEncounter=state.encounter;state.round=0;persist();render();toast('勝利を確認した攻略例を読み込んだよ。自由に変更できる。')}}
 else if(act==='continue-story'){if(state.result?.encounterId==='E01'&&state.scene<3)state.scene=3;else if(state.result?.encounterId==='E04'&&state.scene<5)state.scene=5;else if(state.result?.encounterId==='E03')state.scene=7;goto('story')}
 else if(act==='export-data')saveFile('shiozakai-save.json',JSON.stringify({version:'0.1',saved:new Date().toISOString(),roster:state.roster,gem:state.gem,equipment:state.equipment,completed:state.completed,storyScene:state.scene},null,2));
 else if(act==='clear-data'){if(confirm('編成・装備・物語進捗を初期化する？')){localStorage.removeItem(FLAG);state=defaults();render()}}
});
MAIN.addEventListener('change',e=>{
 let v=e.target.value;if(e.target.matches('[data-select-encounter]')){launchBattle(v);return}
 if(e.target.matches('[data-equipment]')){const [id,slot]=e.target.dataset.equipment.split(':');state.equipment[id][slot]=v;persist();render();return}
 if(e.target.matches('[data-skill]')){setSkill(e.target.dataset.skill,v);return}
 if(e.target.matches('[data-target]')){state.plan[state.round][e.target.dataset.target].target=v;persist();return}
});
document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>goto(b.dataset.nav)));
$('#reset-btn').addEventListener('click',()=>{if(confirm('進捗・編成・装備を初期化する？')){localStorage.removeItem(FLAG);state=defaults();render()}});
render();
window.GameAppDebug={getState:()=>state,story:scenes,render,launchBattle,runBattle};
})();
