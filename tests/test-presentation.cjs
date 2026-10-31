'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const P = require('../docs/presentation.js');
const story = require('../docs/prologue-story-v04.js');
let checks = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const ok = (condition, label) => { assert.ok(condition, label); checks++; };

const source = '　朝の道を歩いた。\n\n\n「おはよう」\n\n「いってきます」\n\n\n◇\n\n\n　翌朝。\n続く行。\n';
const displayed = P.readerBlocks(source);
eq(displayed.map(block => block.type), ['paragraph', 'dialogue', 'dialogue', 'scene', 'paragraph', 'paragraph'], 'dialogue and scene boundaries stay independent');
eq(displayed.map(block => block.text), ['　朝の道を歩いた。', '「おはよう」', '「いってきます」', '◇', '　翌朝。', '続く行。'], 'only empty source lines become CSS spacing');
eq(displayed.map(block => block.indent), [false, false, false, false, false, true], 'existing full-width indentation is not doubled');
eq(P.readerBlocks('「一人目」\n「二人目」').map(block => block.text), ['「一人目」', '「二人目」'], 'single line-break between speakers is not collapsed');
eq(P.readerBlocks('　「台詞」')[0].type, 'dialogue', 'indented dialogue remains dialogue');
eq(P.readerBlocks('　◇　')[0].type, 'scene', 'scene marker is retained with source spacing');
eq(P.readerBlocks('改行\r\n\r\n「返事」').map(block => block.text), ['改行', '「返事」'], 'Windows newline interpretation preserves characters');
eq(P.readerBlocks(' \t\n　\n'), [], 'empty screen rows are not generated from source blank lines');
assert.throws(() => P.readerBlocks(null), TypeError); checks++;

// Retain v0.5 pagination for these checks. Presentation is applied only after
// pagination; it must never shift an existing save's page number or battle seam.
function pagesOf(body) {
  const text = body.replace(/^# [^\n]*\n\n?/, '').replace(/^## [^\n]*\n\n?/, '').trim();
  const parts = text.split(/(\n\n)/), pages = []; let page = '';
  for (let i = 0; i < parts.length; i += 2) {
    const para = parts[i] + (parts[i + 1] || '');
    if (page.length && page.length + para.length > 1400) { pages.push(page); page = ''; }
    page += para;
  }
  if (page) pages.push(page);
  return pages.length ? pages : [''];
}
const unchangedStory = JSON.stringify(story);
let pages = 0, paragraphCount = 0, scenes = 0, dialogues = 0;
for (const [index, section] of story.sections.entries()) {
  for (const part of ['pre', 'post']) {
    for (const page of pagesOf(section[part])) {
      const blocks = P.readerBlocks(page);
      const originalLines = page.replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim());
      eq(blocks.map(block => block.text), originalLines, `section ${index + 1} ${part}: exact nonempty source lines and order`);
      eq(blocks.filter(block => block.type === 'scene').length, originalLines.filter(line => line.trim() === '◇').length, 'every scene marker is visible');
      eq(blocks.filter(block => block.type === 'dialogue').length, originalLines.filter(line => /^[ \t　]*[「『]/u.test(line)).length, 'every dialogue start stays distinct');
      ok(blocks.every(block => block.type === 'scene' || !block.text.includes('\n')), 'no source lines or speakers are joined');
      paragraphCount += blocks.length;
      scenes += blocks.filter(block => block.type === 'scene').length;
      dialogues += blocks.filter(block => block.type === 'dialogue').length;
      pages++;
    }
  }
}
eq(JSON.stringify(story), unchangedStory, 'render preparation never mutates original prose, order, or battle boundaries');
ok(scenes > 0 && dialogues > 0, 'the full approved prose exercised scene and dialogue display');

eq(P.contrastRatio('#000000', '#ffffff'), 21, 'WCAG black/white reference ratio');
eq(P.contrastRatio('#fff', '#fff'), 1, 'identical color reference ratio');
eq(P.contrastRatio('#242a25', '#fffdf7'), P.contrastRatio('rgb(36, 42, 37)', 'rgb(255, 253, 247)'), 'browser computed RGB and palette hex agree');
for (const palette of P.palettes) {
  ok(P.contrastRatio(palette.text, palette.background) >= 4.5, palette.id + ': normal text meets WCAG AA');
}
eq(P.palettes.length, 3, 'three concrete palettes are compared');
ok(P.palettes.some(palette => palette.id === P.selectedPalette), 'the selected palette is a measured option');
assert.throws(() => P.contrastRatio('transparent', '#fff'), TypeError); checks++;
assert.throws(() => P.contrastRatio('rgb(999, 0, 0)', '#fff'), TypeError); checks++;
const browser = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs/presentation.js'), 'utf8'), browser);
eq(browser.HillRoadPresentation.readerBlocks('「会話」')[0].type, 'dialogue', 'same helper works as a static browser script');
console.log(`PASS presentation: ${checks} checks; ${pages} unchanged pages, ${paragraphCount} source blocks, ${dialogues} dialogue starts, ${scenes} scene markers; all 3 palettes meet AA`);
