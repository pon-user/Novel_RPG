const assert=require('node:assert/strict');
const slots={}, nav=[];const store=new Map();
function element(){return {innerHTML:'',textContent:'',dataset:{},handlers:{},classList:{toggle(){},add(){},remove(){}},addEventListener(t,f){this.handlers[t]=f}}}
for(const x of ['#main-view','#topbar-title','#toast','#reset-btn'])slots[x]=element();
for(const k of ['story','party','battle','library','about']){const n=element();n.dataset.nav=k;nav.push(n)}
global.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
global.document={querySelector:k=>slots[k],querySelectorAll:k=>k==='[data-nav]'?nav:[]};
global.window=global;window.scrollTo=()=>{};window.setTimeout=setTimeout;window.clearTimeout=clearTimeout;
require('./data.js');require('./samples.js');require('./battle.js');require('./app.js');
const state=()=>window.GameAppDebug.getState();
assert.ok(slots['#main-view'].innerHTML.includes('潮境の命珠'));
const eventAction=x=>({target:{closest(sel){if(sel==='[data-action]')return {dataset:{action:x}};return null}}});
function click(x){slots['#main-view'].handlers.click(eventAction(x))}
// Triples roster, equipment, detail lists render.
state().page='party';window.GameAppDebug.render();
assert.equal((slots['#main-view'].innerHTML.match(/data-equipment=/g)||[]).length,12);
// Bonus story E04: provided witness must be playable and win.
window.GameAppDebug.launchBattle('E04');assert.ok(slots['#main-view'].innerHTML.includes('C13'));
click('load-sample');assert.deepEqual(state().roster,['H','02','03','07']);
click('run-battle');assert.equal(state().result?.won,true);assert.ok(slots['#main-view'].innerHTML.includes('勝 利'));
// E03 sample battle similarly.
window.GameAppDebug.launchBattle('E03');click('load-sample');click('run-battle');assert.equal(state().result?.won,true);
state().page='library';window.GameAppDebug.render();assert.equal((slots['#main-view'].innerHTML.match(/data-encounter=/g)||[]).length,17);
console.log('APP DOM & STORY SAMPLE INTEGRATION PASS');
