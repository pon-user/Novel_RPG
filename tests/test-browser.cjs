'use strict';
// Browser acceptance for v0.6. Real file imports include untouched v0.5 saves
// generated with the runtime at 9ea01e7cb7ffa36589e48bf5343b100e698e88ce.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8765/Novel_RPG/';
const ARTIFACTS_DIR = path.resolve(process.env.ARTIFACTS_DIR || path.join(__dirname, '../artifacts'));
const base = new URL(BASE_URL);
const legacyFixture = name => path.join(__dirname, 'fixtures', `v05-${name}-save.json`);
const plans = [
  ['survive', 'basic', 'basic', 'basic', 'basic'],
  ['survive', 'heavy', 'basic', 'basic', 'basic'],
  ['survive', 'basic', 'fire', 'heavy', 'basic'],
  ['mark', 'heavy', 'fire', 'basic', 'basic']
];
(async () => {
  fs.mkdirSync(ARTIFACTS_DIR, {recursive:true});
  fs.rmSync(path.join(ARTIFACTS_DIR, 'browser-report.json'), {force:true});
  const errors=[], outside=[], httpErrors=[], failedRequests=[], completed=[], contrasts=[];
  let checks=0;
  const check=(condition,label)=>{ assert.ok(condition,label); checks++; };
  const same=(actual,expected,label)=>{ assert.deepEqual(actual,expected,label); checks++; };
  const state=page=>page.evaluate(()=>window.HillRoadApp.controller.snapshot());
  const click=(page,name)=>page.getByRole('button',{name,exact:true}).click();
  const shot=(page,name)=>page.screenshot({path:path.join(ARTIFACTS_DIR,name+'.png'),fullPage:true});
  const noOverflow=async(page,label)=>{
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label);
    if(await page.evaluate(()=>matchMedia('(max-width: 700px)').matches)) check(await page.evaluate(()=>document.querySelector('main.content').getBoundingClientRect().bottom <= document.querySelector('.main-nav').getBoundingClientRect().top + 1),label+': content viewport never extends under bottom navigation');
  };
  const nav=(page,route)=>page.locator(`[data-nav="${route}"]:visible`).first().click();
  const browser=await chromium.launch({...(fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  async function context(options={}) {
    const ctx=await browser.newContext({locale:'ja-JP',acceptDownloads:true,...options});
    ctx.on('page',page=>{
      page.on('pageerror',e=>errors.push(e.message));
      page.on('dialog',d=>d.accept());
    });
    ctx.on('request',r=>{
      const url=r.url();if(url.startsWith('blob:')||url.startsWith('data:'))return;
      const actual=new URL(url);
      if(actual.origin!==base.origin||!actual.pathname.startsWith(base.pathname))outside.push(url);
    });
    ctx.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
    ctx.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
    return ctx;
  }
  async function open(ctx) {
    const p=await ctx.newPage();const response=await p.goto(BASE_URL,{waitUntil:'networkidle'});
    check(response.status()===200,'HTTP entry succeeds');
    check(await p.title()==='丘の向こうの道｜序章','Japanese page title');
    return p;
  }
  async function readAll(page,lastButton) {
    let guard=0;
    while(await page.getByRole('button',{name:'次のページ →',exact:true}).count()){
      await click(page,'次のページ →');if(++guard>50)throw Error('reader failed to advance');
    }
    await click(page,lastButton);
  }
  async function worldOnly(page,label) {
    const text=await page.locator('body').innerText();
    check(!/試遊版|手動更新|5更新・4戦|宝玉なし|固定行動NPC|SKILL_ONCE|PLAN_MUST|BTL-000|@release|round_limit/.test(text),label+': no developer prose or internal event codes');
  }
  async function contrast(page,label) {
    const values=await page.locator('.novel .prose-paragraph').evaluateAll(nodes=>{
      const luminance=rgb=>{
        const a=rgb.slice(0,3).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
        return .2126*a[0]+.7152*a[1]+.0722*a[2];
      };
      return nodes.filter(n=>n.textContent.trim()).map(node=>{
        const foreground=getComputedStyle(node).color.match(/[\d.]+/g).map(Number);
        let p=node,background;
        while(p){const color=getComputedStyle(p).backgroundColor;const c=color.match(/[\d.]+/g)?.map(Number);if(c&&(c.length<4||c[3]>0)){background=c;break;}p=p.parentElement;}
        background=background||[255,255,255];
        const l=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
        return {foreground,background,ratio:(l[0]+.05)/(l[1]+.05)};
      });
    });
    check(values.length>0,label+': paragraphs render as separate elements');
    const minimum=Math.min(...values.map(v=>v.ratio));
    check(minimum>=4.5,label+': normal prose contrast >= 4.5:1 (actual '+minimum.toFixed(2)+')');
    contrasts.push({label,minimum});
  }
  async function unchangedNavigation(page,label) {
    const before=await state(page);const reading=await page.locator('.novel').innerText();
    await page.evaluate(()=>{const surface=matchMedia('(max-width: 700px)').matches?document.querySelector('main.content'):document.scrollingElement;surface.scrollTop=Math.min(320,surface.scrollHeight-surface.clientHeight);});
    const scroll=await page.evaluate(()=>matchMedia('(max-width: 700px)').matches?document.querySelector('main.content').scrollTop:scrollY);
    check(scroll>100,label+': long prose actually scrolls');
    await nav(page,'home');await noOverflow(page,label+': home layout');
    check((await page.locator('body').innerText()).includes('現在地'),label+': home exposes location on mobile and desktop');
    await nav(page,'history');await noOverflow(page,label+': independent history layout');
    same(await state(page),before,label+': home/history do not advance or mutate save');
    await nav(page,'story');
    same(await state(page),before,label+': return to story retains full save state');
    same(await page.locator('.novel').innerText(),reading,label+': return retains displayed prose page');
    if(scroll>100){await page.waitForTimeout(150);check(Math.abs((await page.evaluate(()=>matchMedia('(max-width: 700px)').matches?document.querySelector('main.content').scrollTop:scrollY))-scroll)<60,label+': navigation restores reading scroll position');}
  }
  async function chronologicalResult(page,s,label,{legacy=false}={}) {
    check(await page.locator('.result-banner').count()===0,label+': outcome banner hidden before explicit reveal');
    check(await page.getByRole('button',{name:'物語の続きを読む',exact:true}).count()===0,label+': post-story cannot precede battle viewing');
    check(!/勝利|敗北/.test(await page.locator('body').innerText()),label+': victory/defeat not disclosed before process');
    const rounds=page.locator('details.round-log');
    check(await rounds.count()===s.result.round,label+': one log group per actual turn');
    check(await page.locator('details.round-log[open]').count()===s.result.round,label+': all turns initially expanded');
    check(await page.locator('.turn-start').count()===s.result.round,label+': true start-state snapshot per turn');
    check(await page.locator('.battle-action').count()>0,label+': structured action cards rendered');
    const initial=await rounds.first().innerText();
    check(initial.includes('アリア')&&initial.includes('300'),label+': turn one includes initial Aria HP');
    const chronology=await rounds.first().evaluate(node=>{
      const snapshot=node.querySelector('.turn-start'),action=node.querySelector('.battle-action');
      return !!(snapshot&&action&&(snapshot.compareDocumentPosition(action)&Node.DOCUMENT_POSITION_FOLLOWING));
    });
    check(chronology,label+': start state is before first action in document order');
    await worldOnly(page,label);
    await click(page,'全ターンを折りたたむ');
    check(await page.locator('details.round-log[open]').count()===0,label+': collapse all');
    await rounds.first().locator('summary').first().click();
    check(await page.locator('details.round-log[open]').count()===1,label+': individual turn can reopen');
    await click(page,'全ターンを開く');
    check(await page.locator('details.round-log[open]').count()===s.result.round,label+': reopen all');
    await page.reload({waitUntil:'networkidle'});
    check((await state(page)).phase==='result',label+': result phase persists');
    check(await page.locator('.result-banner').count()===0,label+': reload never exposes a not-yet-revealed outcome');
    check(await page.locator('details.round-log[open]').count()===s.result.round,label+': reload starts all turns expanded');
    await click(page,'戦闘結果を確認する');
    check(await page.locator('.result-banner').isVisible(),label+': explicit outcome reveal works');
    check((await page.locator('.result-banner').innerText()).includes('勝利'),label+': correct outcome revealed');
    await noOverflow(page,label+': result layout');
    if(legacy)check(!(await state(page)).result.telemetry,label+': legacy result was displayed without mutating or rewriting its saved data');
  }
  async function completeStory(page,device) {
    check(await page.getByRole('button',{name:'更新　→',exact:true}).isDisabled(),device+': initial hold stops update');
    await noOverflow(page,device+': initial home layout');await worldOnly(page,device+': home');await shot(page,device+'-start');
    for(let section=0;section<5;section++){
      if(!(await page.getByLabel('次の物語を進める',{exact:true}).count()))await nav(page,'home');
      check((await state(page)).completedCount===section,device+': completion before update '+section);
      await page.getByLabel('次の物語を進める',{exact:true}).check();await click(page,'更新　→');
      let s=await state(page);check(s.current===section&&s.phase==='pre',device+': one update begins one section');
      await noOverflow(page,device+': reader '+section);await worldOnly(page,device+': story '+section);
      if(section===0){
        await click(page,'次のページ →');const reading=await state(page);await page.reload({waitUntil:'networkidle'});
        check((await state(page)).page===reading.page,device+': reading page survives reload');
        await contrast(page,device);await unchangedNavigation(page,device);await shot(page,device+'-reading');
      }
      if(section===4){await readAll(page,'序章を完了する');break;}
      await readAll(page,'戦闘準備へ');s=await state(page);
      check(s.phase==='battle',device+': reached battle '+section);
      same(s.plan,Array(5).fill('basic'),device+': no solution auto-filled');
      const options=await page.locator('#round-0 option').allTextContents();
      check(!options.some(x=>x.includes('みんながんばろ')),device+': ultimate locked');
      if(section<2)check(!options.includes('炎魔法'),device+': fire locked early');
      await noOverflow(page,device+': preparation '+section);await worldOnly(page,device+': preparation '+section);
      for(let turn=0;turn<5;turn++)await page.locator('#round-'+turn).selectOption(plans[section][turn]);
      if(section===1){
        await page.locator('#round-2').selectOption('heavy');check(await page.getByRole('button',{name:'予約を確定して戦闘を実行',exact:true}).isDisabled(),device+': duplicate skills block battle');
        await page.locator('#round-2').selectOption('basic');
      }
      const planned=await state(page);await nav(page,'home');await nav(page,'story');
      same((await state(page)).plan,planned.plan,device+': navigation retains all five reservations');
      // Story's context action returns to the current preparation screen if needed.
      if(!(await page.locator('#round-0').count())){
        const prep=page.getByRole('button',{name:'戦闘準備へ',exact:true});
        if(await prep.count())await prep.click();else await page.locator('[data-nav="battle"]:visible').first().click();
      }
      await page.reload({waitUntil:'networkidle'});same((await state(page)).plan,plans[section],device+': plan survives reload '+section);
      if(section===3){
        await page.getByText('NPCの固定行動を確認',{exact:true}).click();await noOverflow(page,device+': expanded NPC table');await shot(page,device+'-battle');
      }
      await click(page,'予約を確定して戦闘を実行');s=await state(page);
      check(s.phase==='result'&&s.result.won,device+': battle wins '+section);
      check(s.result.round===[3,3,3,4][section],device+': target victory turn '+section);
      if(section===3)await shot(page,device+'-timeline');
      await chronologicalResult(page,s,device+' battle '+section);
      if(section===3)await shot(page,device+'-result');
      await click(page,'物語の続きを読む');check((await state(page)).phase==='post',device+': victory connects to post text');
      await readAll(page,'この節を終える');check((await state(page)).completedCount===section+1,device+': commits one section');
      await page.reload({waitUntil:'networkidle'});check((await state(page)).phase==='ready',device+': ready survives reload');
    }
    const final=await state(page);
    check(final.phase==='done'&&final.completedCount===5,device+': complete prologue');
    check(final.history.length===5,device+': all history entries');check(final.cheerUnlocked,device+': cheer learned');
    check(final.items.gem==='未取得'&&final.items.sword==='未取得',device+': no early future items');check(final.items.map==='携行中',device+': map acquired');
    await noOverflow(page,device+': completion');await shot(page,device+'-complete');
    completed.push({device,sections:final.completedCount,battles:final.history.filter(x=>x.result?.won).length,victoryTurns:final.history.filter(x=>x.result).map(x=>x.result.round)});
  }
  async function importFile(page,file){
    await click(page,'設定とセーブ');
    const chooser=page.waitForEvent('filechooser');await click(page,'セーブを読み込む');await(await chooser).setFiles(file);
    await page.getByText('セーブを読み込みました。',{exact:true}).waitFor();await click(page,'閉じる');
  }
  async function legacyAcceptance(width){
    const ctx=await context({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page=await open(ctx);
    const reading=JSON.parse(fs.readFileSync(legacyFixture('reading'),'utf8'));
    await importFile(page,legacyFixture('reading'));const loaded=await state(page);
    check(loaded.schema===reading.schema&&loaded.phase==='pre'&&loaded.page===reading.page,width+': v0.5 reader imported without reset');
    same(loaded.items,reading.items,width+': v0.5 items preserved');await contrast(page,width+'px legacy reading');await noOverflow(page,width+': legacy reader');
    await page.reload({waitUntil:'networkidle'});check((await state(page)).page===reading.page,width+': legacy page survives reload');
    await shot(page,'mobile-'+width+'-reading');
    await importFile(page,legacyFixture('result'));const oldResult=await state(page);
    same(oldResult.result,JSON.parse(fs.readFileSync(legacyFixture('result'),'utf8')).result,width+': v0.5 result unchanged after import');
    check(await page.locator('.round-log').count()===3,width+': legacy result has authentic rehydrated turn records');
    await noOverflow(page,width+': legacy timeline');await chronologicalResult(page,oldResult,width+'px legacy',{legacy:true});
    await shot(page,'mobile-'+width+'-result');
    await click(page,'設定とセーブ');await noOverflow(page,width+': settings');check(await page.getByRole('dialog').isVisible(),width+': settings accessible');await shot(page,'mobile-'+width+'-settings');await click(page,'閉じる');
    await importFile(page,legacyFixture('complete'));const complete=await state(page);
    check(complete.phase==='done'&&complete.completedCount===5,width+': complete v0.5 save imports');
    await nav(page,'history');const before=await state(page);await noOverflow(page,width+': independent history');await shot(page,'mobile-'+width+'-history');
    // The independent history page exposes one entry per read section.
    check((await page.locator('body').innerText()).includes('はじめての街道'),width+': history exposes read chapters');
    same(await state(page),before,width+': history viewing leaves progress unchanged');
    await ctx.close();
  }
  try{
    const desktop=await context({viewport:{width:1440,height:1050}}),page=await open(desktop);
    await completeStory(page,'desktop');
    await nav(page,'history');await shot(page,'desktop-history');
    const beforeHistory=await state(page);
    // The completion shortcut remains a convenient entrance into reading history.
    await nav(page,'home');await click(page,'最初の節を読み返す');
    check(await page.getByText('旅の記録を読み返しています',{exact:true}).isVisible(),'history reading opens');
    await click(page,'戦闘後の物語');check(await page.locator('details.round-log[open]').count()===3,'history battle turns initially expanded');
    same(await state(page),beforeHistory,'reading history never mutates main progression');
    await click(page,'進行中の画面へ');
    await click(page,'設定とセーブ');check(await page.getByRole('dialog').isVisible(),'settings dialog');await shot(page,'desktop-settings');
    const exportedPath=path.join(ARTIFACTS_DIR,'browser-save.json');
    const downloadPromise=page.waitForEvent('download');await click(page,'セーブを書き出す');await(await downloadPromise).saveAs(exportedPath);
    const exported=JSON.parse(fs.readFileSync(exportedPath,'utf8'));check(exported.completedCount===5,'real UI exports completed save');
    await click(page,'大きめ');await click(page,'閉じる');await page.reload({waitUntil:'networkidle'});check((await state(page)).readingSize==='large','reading preference saved');
    const mobile=await context({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),m=await open(mobile);
    await completeStory(m,'mobile');
    await m.evaluate(()=>localStorage.setItem('hill-road-prologue-v1','{broken'));await m.reload({waitUntil:'networkidle'});
    check(await m.getByText(/既存のセーブを読み込めないため/).isVisible(),'corrupt save warning');check(await m.evaluate(()=>localStorage.getItem('hill-road-prologue-v1'))==='{broken','corrupt raw save protected');
    const importCtx=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),imported=await open(importCtx);
    check((await state(imported)).completedCount===0,'new context starts fresh');await importFile(imported,exportedPath);
    same((await state(imported)).history,exported.history,'UI import preserves battle/history data');same((await state(imported)).items,exported.items,'UI import preserves inventory');
    await imported.reload({waitUntil:'networkidle'});check((await state(imported)).phase==='done','imported save persists after reload');
    await click(imported,'設定とセーブ');const beforeInvalid=await state(imported);
    await imported.locator('input[type=file]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});
    await imported.getByText(/読み込めませんでした：/).waitFor();same(await state(imported),beforeInvalid,'failed UI import preserves save');
    await click(imported,'閉じる');await imported.reload({waitUntil:'networkidle'});same(await state(imported),beforeInvalid,'failed import preserves persisted save');
    await click(imported,'設定とセーブ');const roundtripPromise=imported.waitForEvent('download');await click(imported,'セーブを書き出す');
    const roundtripPath=path.join(ARTIFACTS_DIR,'browser-save-roundtrip.json');await(await roundtripPromise).saveAs(roundtripPath);
    same(JSON.parse(fs.readFileSync(roundtripPath,'utf8')).history,exported.history,'UI export/import/export roundtrip');await click(imported,'閉じる');
    // Optional telemetry is untrusted JSON. A valid old result must still render
    // if an imported file has damaged or invented additive display fields.
    const forged=JSON.parse(fs.readFileSync(legacyFixture('result'),'utf8'));
    forged.result.telemetry={turns:null,summary:{damageTaken:999999}};
    await importFile(imported,{name:'optional-display-data.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});
    check(await imported.locator('.round-log').count()===forged.result.round,'malformed optional telemetry reconstructs authentic turns');
    check(await imported.locator('.result-banner').count()===0,'optional telemetry cannot reveal result early');
    await imported.reload({waitUntil:'networkidle'});
    check(await imported.locator('.turn-start').count()===forged.result.round,'malformed optional telemetry survives reload without a broken game');
    same((await state(imported)).result,forged.result,'display reconstruction leaves imported result untouched');
    await click(imported,'戦闘結果を確認する');
    check(!(await imported.locator('.tactic-summary').innerText()).includes('999999'),'invented optional telemetry cannot falsify tactic feedback');
    for(const width of [360,320])await legacyAcceptance(width);
    check(errors.length===0,'no browser exceptions: '+errors.join(';'));
    check(outside.length===0,'all application requests stay in project path: '+outside.join(';'));
    check(httpErrors.length===0,'no HTTP errors: '+JSON.stringify(httpErrors));check(failedRequests.length===0,'no failed requests: '+JSON.stringify(failedRequests));
    const report={status:'PASS',version:'0.6',executedAt:new Date().toISOString(),checks,engine:'Chromium',browserVersion:browser.version(),baseURL:BASE_URL,desktop:{width:1440,height:1050},mobile:{width:390,height:844,touch:true,additionalWidths:[360,320]},completionRuns:completed,sections:5,battles:4,initialAllTurnsExpanded:true,outcomeExplicitlyRevealed:true,uiSaveRoundtrip:true,legacySaveFixtures:{sourceCommit:'9ea01e7cb7ffa36589e48bf5343b100e698e88ce',phases:['pre','result','done'],widths:[360,320]},contrast:contrasts,invalidImportProtected:true,untrustedTelemetryReconstructed:true,errors,externalRequests:outside,httpErrors,failedRequests};
    fs.writeFileSync(path.join(ARTIFACTS_DIR,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`PASS browser v0.6: ${checks} checks; PC/mobile complete 5 sections/4 battles; expanded chronology before outcome, legacy v0.5 saves, UI import/export, navigation, AA prose contrast, narrow/mobile layouts.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
