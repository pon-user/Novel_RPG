from pathlib import Path
from playwright.sync_api import sync_playwright
html=Path(__file__).with_name('shiozakai_play_v02_single.html').read_text()
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda x:errors.append(str(x)))
 # In-page storage stub for about:blank, since test harness blocks localStorage access.
 page.add_init_script("""Object.defineProperty(window,'localStorage',{configurable:true,value:{_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}}});""")
 page.set_content(html)
 page.locator('[data-action="resolve-now"]').click()
 assert page.evaluate('GameAppDebug.getState().history.length')==0
 assert page.evaluate('GameAppDebug.getState().pending') is None
 page.locator('[data-choice="main"]').click()
 assert page.evaluate('GameAppDebug.getState().pending')=='main'
 page.locator('[data-choice="hold"]').click()
 assert page.evaluate('GameAppDebug.getState().pending') is None
 page.locator('[data-choice="main"]').click();page.locator('[data-action="resolve-now"]').click()
 assert page.evaluate('GameAppDebug.getState().history.length')==1
 assert page.evaluate('GameAppDebug.getState().stage')==1
 assert page.locator('.battle-log-event').count()>0
 page.locator('[data-action="toggle-log"]').click();assert page.locator('.battle-log-event').count()==0
 page.locator('[data-action="toggle-log"]').click()
 # E04 defeat with no gear and all basic, stage retained, dream ending and same choice
 page.evaluate("""(()=>{const s=GameAppDebug.getState();for(const id of s.roster){s.equipment[id]={W:'',A:'',X:''}};s.plan=BattleEngine.basicPlan(s.roster);GameAppDebug.save();GameAppDebug.render()})()""")
 page.locator('[data-choice="main"]').click();page.locator('[data-action="resolve-now"]').click()
 print('E04 default',page.locator('.result-banner h2').inner_text(), 'stage',page.evaluate('GameAppDebug.getState().stage'))
 if page.locator('.result-banner h2').inner_text()=='敗北':
  assert page.evaluate('GameAppDebug.getState().stage')==1
  assert 'よし、シミュレーション完了' in page.locator('#main-view').inner_text()
  assert page.locator('[data-choice="main"]').count()==1
 page.locator('[data-nav="library"]').click();page.locator('[data-lib="stories"]').click();assert page.locator('.history-entry').count()==2
 page.locator('.history-entry').first.click();assert page.locator('.battle-log-event').count()>0
 assert '敵編成' in page.locator('.modal-content').inner_text()
 page.locator('[data-action="close-modal"]').click()
 page.locator('[data-nav="party"]').click();page.locator('[data-action="target-policy"]').click();assert 'ターゲット規則' in page.locator('.modal-content').inner_text()
 print('full flow PASS; pageerrors=',errors)
 assert not errors
 browser.close()
