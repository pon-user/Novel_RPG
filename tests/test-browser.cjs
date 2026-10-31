'use strict';
// Exercise the deployed tree under a GitHub Pages project prefix, with fresh saves.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8765/Novel_RPG/';
const ARTIFACTS_DIR = path.resolve(process.env.ARTIFACTS_DIR || path.join(__dirname, '../artifacts'));
const base = new URL(BASE_URL);
const plans = [
  ['survive', 'basic', 'basic', 'basic', 'basic'],
  ['survive', 'heavy', 'basic', 'basic', 'basic'],
  ['survive', 'basic', 'fire', 'heavy', 'basic'],
  ['mark', 'heavy', 'fire', 'basic', 'basic']
];
(async () => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  fs.rmSync(path.join(ARTIFACTS_DIR, 'browser-report.json'), { force: true });
  const errors = [], outside = [], httpErrors = [], failedRequests = [], completed = [];
  let checks = 0;
  const check = (condition, label) => { assert.ok(condition, label); checks++; };
  const state = page => page.evaluate(() => window.HillRoadApp.controller.snapshot());
  const click = (page, name) => page.getByRole('button', { name, exact: true }).click();
  const shot = (page, name) => page.screenshot({ path: path.join(ARTIFACTS_DIR, name + '.png'), fullPage: true });
  const noOverflow = async (page, label) => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
  const browser = await chromium.launch({ ...(fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  async function context(options) {
    const ctx = await browser.newContext({ locale: 'ja-JP', acceptDownloads: true, ...options });
    ctx.on('page', page => {
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => dialog.accept());
    });
    ctx.on('request', request => {
      const url = request.url();
      if (url.startsWith('blob:') || url.startsWith('data:')) return;
      const actual = new URL(url);
      if (actual.origin !== base.origin || !actual.pathname.startsWith(base.pathname)) outside.push(url);
    });
    ctx.on('response', response => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });
    ctx.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    return ctx;
  }
  async function open(ctx) {
    const page = await ctx.newPage();
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    check(response.status() === 200, 'HTTP entry succeeds at ' + BASE_URL);
    check(await page.title() === '丘の向こうの道｜序章', 'page title');
    return page;
  }
  async function readAll(page, lastButton) {
    let guard = 0;
    while (await page.getByRole('button', { name: '次のページ →', exact: true }).count()) {
      await click(page, '次のページ →');
      if (++guard > 50) throw Error('reader failed to advance');
    }
    await click(page, lastButton);
  }
  async function completeStory(page, device) {
    check(await page.getByRole('button', { name: '更新　→', exact: true }).isDisabled(), device + ': initial hold stops update');
    await noOverflow(page, device + ': initial layout');
    await shot(page, device + '-start');
    for (let section = 0; section < 5; section++) {
      const before = await state(page);
      check(before.completedCount === section, device + ': completed count before update ' + section);
      await page.getByLabel('次の物語を進める', { exact: true }).check();
      await click(page, '更新　→');
      let s = await state(page);
      check(s.current === section && s.phase === 'pre', device + ': one update begins one section');
      await noOverflow(page, device + ': reader layout section ' + section);
      if (section === 0) {
        await click(page, '次のページ →');
        const reading = await state(page);
        await page.reload({ waitUntil: 'networkidle' });
        check((await state(page)).page === reading.page, device + ': reading page survives reload');
        await shot(page, device + '-reading');
      }
      if (section === 4) { await readAll(page, '序章を完了する'); break; }
      await readAll(page, '戦闘準備へ');
      s = await state(page);
      check(s.phase === 'battle', device + ': reached battle ' + section);
      check(JSON.stringify(s.plan) === JSON.stringify(Array(5).fill('basic')), device + ': no solution auto-filled');
      const options = await page.locator('#round-0 option').allTextContents();
      check(!options.some(x => x.includes('みんながんばろ')), device + ': ultimate locked in prologue');
      if (section < 2) check(!options.includes('炎魔法'), device + ': fire locked in first two battles');
      await noOverflow(page, device + ': battle layout ' + section);
      for (let turn = 0; turn < 5; turn++) await page.locator('#round-' + turn).selectOption(plans[section][turn]);
      if (section === 1) {
        await page.locator('#round-2').selectOption('heavy');
        check(await page.getByRole('button', { name: '予約を確定して戦闘を実行', exact: true }).isDisabled(), device + ': duplicate skills block battle');
        await page.locator('#round-2').selectOption('basic');
      }
      await page.reload({ waitUntil: 'networkidle' });
      check(JSON.stringify((await state(page)).plan) === JSON.stringify(plans[section]), device + ': plan survives reload ' + section);
      if (section === 3) {
        await page.getByText('NPCの固定行動を確認', { exact: true }).click();
        await noOverflow(page, device + ': expanded NPC table layout');
        await shot(page, device + '-battle');
      }
      await click(page, '予約を確定して戦闘を実行');
      s = await state(page);
      check(s.phase === 'result' && s.result.won, device + ': battle won ' + section);
      check(s.result.round === [3, 3, 3, 4][section], device + ': target victory turn ' + section);
      await noOverflow(page, device + ': result layout ' + section);
      await page.reload({ waitUntil: 'networkidle' });
      check((await state(page)).phase === 'result', device + ': result survives reload ' + section);
      if (section === 3) await shot(page, device + '-result');
      await click(page, '物語の続きを読む');
      check((await state(page)).phase === 'post', device + ': post text available after victory');
      await readAll(page, 'この節を終える');
      check((await state(page)).completedCount === section + 1, device + ': one section committed ' + section);
      await page.reload({ waitUntil: 'networkidle' });
      check((await state(page)).phase === 'ready', device + ': ready survives reload');
    }
    const final = await state(page);
    check(final.phase === 'done' && final.completedCount === 5, device + ': five updates complete prologue');
    check(final.history.length === 5, device + ': five history entries');
    check(final.cheerUnlocked, device + ': cheer unlocked');
    check(final.items.gem === '未取得' && final.items.sword === '未取得', device + ': no early gem or sword');
    check(final.items.map === '携行中', device + ': map acquired');
    await noOverflow(page, device + ': completion layout');
    await shot(page, device + '-complete');
    completed.push({ device, sections: final.completedCount, battles: final.history.filter(x => x.result?.won).length, victoryTurns: final.history.filter(x => x.result).map(x => x.result.round) });
  }
  try {
    const desktop = await context({ viewport: { width: 1440, height: 1050 } });
    const page = await open(desktop);
    await completeStory(page, 'desktop');
    await click(page, '最初の節を読み返す');
    check(await page.getByText('旅の記録を読み返しています', { exact: true }).isVisible(), 'replay opens');
    check((await state(page)).completedCount === 5, 'replay does not mutate progress');
    await click(page, '戦闘後の物語');
    check(await page.getByText('戦闘の記録 · 全3ターン', { exact: true }).count() === 1, 'historic battle result available');
    await click(page, '進行中の画面へ');
    await click(page, '設定とセーブ');
    check(await page.getByRole('dialog').isVisible(), 'settings dialog');
    const downloadPromise = page.waitForEvent('download');
    await click(page, 'セーブを書き出す');
    const download = await downloadPromise;
    const exportedPath = path.join(ARTIFACTS_DIR, 'browser-save.json');
    await download.saveAs(exportedPath);
    const exported = JSON.parse(fs.readFileSync(exportedPath, 'utf8'));
    check(exported.completedCount === 5, 'UI export contains completed progress');
    await click(page, '大きめ');
    await click(page, '閉じる');
    await page.reload({ waitUntil: 'networkidle' });
    check((await state(page)).readingSize === 'large', 'font preference saved');

    const mobile = await context({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const m = await open(mobile);
    await completeStory(m, 'mobile');
    await m.evaluate(() => localStorage.setItem('hill-road-prologue-v1', '{broken'));
    await m.reload({ waitUntil: 'networkidle' });
    check(await m.getByText(/既存のセーブを読み込めないため/).isVisible(), 'corrupt save warning');
    check(await m.evaluate(() => localStorage.getItem('hill-road-prologue-v1')) === '{broken', 'corrupt raw save protected');

    // Real file chooser import on another fresh device/context, not controller calls.
    const importedContext = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const imported = await open(importedContext);
    check((await state(imported)).completedCount === 0, 'import target starts with a fresh save');
    await click(imported, '設定とセーブ');
    const chooser = imported.waitForEvent('filechooser');
    await click(imported, 'セーブを読み込む');
    await (await chooser).setFiles(exportedPath);
    await imported.getByText('セーブを読み込みました。', { exact: true }).waitFor();
    const restored = await state(imported);
    check(restored.phase === 'done' && restored.completedCount === 5, 'UI import restores prologue completion');
    check(JSON.stringify(restored.history) === JSON.stringify(exported.history), 'UI import preserves all four battles and five history entries');
    check(JSON.stringify(restored.items) === JSON.stringify(exported.items), 'UI import preserves inventory');
    await click(imported, '閉じる');
    await imported.reload({ waitUntil: 'networkidle' });
    check((await state(imported)).phase === 'done', 'imported save persists after reload');
    await click(imported, '設定とセーブ');
    const beforeInvalid = JSON.stringify(await state(imported));
    await imported.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
    await imported.getByText(/読み込めませんでした：/).waitFor();
    check(JSON.stringify(await state(imported)) === beforeInvalid, 'failed UI import preserves current progress');
    await click(imported, '閉じる');
    await imported.reload({ waitUntil: 'networkidle' });
    check(JSON.stringify(await state(imported)) === beforeInvalid, 'failed import leaves persistent save intact');
    await click(imported, '設定とセーブ');
    const roundtripPromise = imported.waitForEvent('download');
    await click(imported, 'セーブを書き出す');
    const roundtrip = await roundtripPromise;
    const roundtripPath = path.join(ARTIFACTS_DIR, 'browser-save-roundtrip.json');
    await roundtrip.saveAs(roundtripPath);
    const reexported = JSON.parse(fs.readFileSync(roundtripPath, 'utf8'));
    check(JSON.stringify(reexported.history) === JSON.stringify(exported.history), 'cross-context UI export/import/export roundtrip retains battle records');
    await click(imported, '閉じる');
    for (const width of [360, 320]) {
      await imported.setViewportSize({ width, height: 844 });
      await noOverflow(imported, width + 'px completion layout');
      await click(imported, '最初の節を読み返す');
      await noOverflow(imported, width + 'px reader layout');
      await click(imported, '進行中の画面へ');
      await shot(imported, 'mobile-' + width + '-complete');
    }
    check(errors.length === 0, 'no browser exceptions: ' + errors.join(';'));
    check(outside.length === 0, 'all application requests remain inside project prefix: ' + outside.join(';'));
    check(httpErrors.length === 0, 'no HTTP errors: ' + JSON.stringify(httpErrors));
    check(failedRequests.length === 0, 'no failed requests: ' + JSON.stringify(failedRequests));
    const report = { status: 'PASS', executedAt: new Date().toISOString(), checks, engine: 'Chromium', browserVersion: browser.version(), baseURL: BASE_URL, desktop: { width: 1440, height: 1050 }, mobile: { width: 390, height: 844, touch: true, additionalWidths: [360, 320] }, completionRuns: completed, sections: 5, battles: 4, uiSaveRoundtrip: true, invalidImportProtected: true, errors, externalRequests: outside, httpErrors, failedRequests };
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`PASS browser: ${checks} checks; desktop AND mobile each completed 5 updates/4 battles; autosave/reload, replay, UI export/import roundtrip, invalid import/corrupt-save protection; no external requests or HTTP errors.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
