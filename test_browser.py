from playwright.sync_api import sync_playwright
from pathlib import Path
p=Path(__file__).resolve().parent
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':900},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e: errors.append('PAGE ERROR: '+str(e)))
 page.set_content((p/'shiozakai_play_single.html').read_text(),wait_until='load')
 page.screenshot(path=str(p/'preview_desktop.png'),full_page=True)
 assert page.get_by_text('港の探索記録').count()
 page.locator('[data-story-choice="0"]').click()
 page.locator('[data-story-choice="1"]').click()
 assert page.get_by_text('封鎖された倉庫の前に',exact=False).count()
 page.locator('[data-story-choice="0"]').click()
 assert page.get_by_text('5ラウンド行動予約').count()
 page.screenshot(path=str(p/'preview_planner.png'),full_page=True)
 page.locator('[data-action="run-battle"]').click()
 assert page.locator('.result-banner').count()
 x=page.locator('.result-banner h2').inner_text();print('E01 battle:',x);assert x=='勝 利'
 page.locator('[data-action="continue-story"]').click()
 assert page.get_by_text('これが、噂の命珠',exact=False).count()
 page.locator('[data-story-choice="0"]').click()
 page.locator('[data-story-choice="0"]').click()
 page.locator('[data-action="load-sample"]').click()
 page.locator('[data-action="run-battle"]').click()
 x=page.locator('.result-banner h2').inner_text();print('E04 battle:',x);assert x=='勝 利'
 page.locator('[data-action="continue-story"]').click()
 page.locator('[data-story-choice="0"]').click()
 page.locator('[data-story-choice="0"]').click()
 page.locator('[data-action="load-sample"]').click()
 page.locator('[data-action="run-battle"]').click()
 x=page.locator('.result-banner h2').inner_text();print('E03 battle:',x);assert x=='勝 利'
 page.locator('[data-action="continue-story"]').click()
 assert page.get_by_text('本編は、ここから始まる',exact=False).count()
 page.locator('[data-nav="party"]').click()
 page.screenshot(path=str(p/'preview_party.png'),full_page=True)
 assert page.locator('[data-equipment]').count()==12
 page.locator('[data-nav="library"]').click()
 assert page.locator('[data-encounter]').count()==17
 page.locator('[data-encounter="EP_B"]').click()
 mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 mobile.on('pageerror',lambda e: errors.append('MOBILE ERROR: '+str(e)))
 mobile.set_content((p/'shiozakai_play_single.html').read_text(),wait_until='load')
 mobile.screenshot(path=str(p/'preview_mobile.png'),full_page=True)
 mobile.locator('[data-nav="battle"]').click()
 mobile.locator('[data-action="run-battle"]').click()
 assert mobile.locator('.result-banner').count()
 mobile.screenshot(path=str(p/'preview_mobile_result.png'),full_page=True)
 print('PAGE ERRORS',errors)
 assert not errors
 browser.close()
 print('BROWSER FLOW PASS')
