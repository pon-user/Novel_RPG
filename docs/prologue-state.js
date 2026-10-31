/* Five deliberate updates. All successful state changes are saved immediately. */
(function (root) {
  'use strict';
  const KEY = 'hill-road-prologue-v1';
  const SCHEMA = 'hill-road-v1';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const text = value => typeof value === 'string' && value.length <= 2000;
  const timestamp = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));
  const ITEM_START = { staff: '携行中', order: '携行中', money: '携行中', medicine: '未取得', vial: '未取得', map: '未取得', sword: '未取得', gem: '未取得' };
  const ITEM_FALLBACK = [{}, {order: '使用済み', money: '支払い済み', medicine: '携行中', vial: '携行中'}, {medicine: '配達済み', vial: '自宅の窓辺'}, {}, {map: '携行中', vial: '携行中'}];
  function failure(code, message) { const error = new Error(message); error.code = code; throw error; }

  function create(options) {
    const { story, engine, battle, onChange } = options || {};
    if (!story || !Array.isArray(story.sections) || story.sections.length !== 5 || !engine || !battle) throw Error('序章の実装データを読み込めませんでした。');
    let storage;
    try { storage = options.storage === undefined ? root.localStorage : options.storage; } catch (error) { storage = null; }
    let status = { ok: true, mode: 'memory', error: null, savedAt: null };
    let blocked = false;
    const now = () => new Date().toISOString();
    const itemStart = {...ITEM_START, ...(story.sections[0].progress?.start?.items || {})};
    const initial = () => ({schema: SCHEMA, completedCount: 0, current: null, phase: 'ready', action: 'hold', plan: null, result: null, page: 0, history: [], items: clone(itemStart), cheerUnlocked: false, readingSize: 'normal', updatedAt: now()});
    const sectionBattle = index => story.sections[index].battleId;
    function itemChanges(index) { return story.sections[index].progress?.end?.items || ITEM_FALLBACK[index]; }
    function expectedItems(count) {
      const items = clone(itemStart);
      for (let i = 0; i < count; i++) Object.assign(items, itemChanges(i));
      return items;
    }
    function unitsValid(units, expectedIds) {
      return Array.isArray(units) && units.length === expectedIds.length && units.every((unit, i) => object(unit) && unit.id === expectedIds[i] && text(unit.name) && finite(unit.hp) && finite(unit.maxhp) && unit.maxhp > 0 && unit.hp <= unit.maxhp);
    }
    function resultValid(result, index) {
      if (!object(result) || !sectionBattle(index) || result.encounterId !== sectionBattle(index) || typeof result.won !== 'boolean' || !integer(result.round, 1, 5) || !text(result.encounterName) || !text(result.finishReason) || !finite(result.remainingPartyHP) || !finite(result.remainingEnemyHP)) return false;
      const encounter = battle.ENCOUNTERS[sectionBattle(index)];
      if (!encounter || !unitsValid(result.allies, encounter.party) || !unitsValid(result.enemies, encounter.enemies) || !Array.isArray(result.states) || result.states.length !== result.round || !Array.isArray(result.logs) || result.logs.length > 2000) return false;
      if (!text(result.engineVersion) || result.gem !== null || JSON.stringify(result.roster) !== JSON.stringify(encounter.party) || !object(result.metrics) || !['damage', 'avoided', 'redirected', 'chargeExtra', 'smallAttackRounds'].every(key => finite(result.metrics[key]))) return false;
      if (!result.states.every((turn, i) => object(turn) && turn.round === i + 1 && unitsValid(turn.allies, encounter.party) && unitsValid(turn.enemies, encounter.enemies))) return false;
      if (!result.logs.every(log => object(log) && integer(log.round, 1, 5) && text(log.text) && text(log.type))) return false;
      const end = result.states[result.states.length - 1];
      if (JSON.stringify(result.allies) !== JSON.stringify(end.allies) || JSON.stringify(result.enemies) !== JSON.stringify(end.enemies)) return false;
      if (result.remainingPartyHP !== result.allies.reduce((sum, unit) => sum + unit.hp, 0) || result.remainingEnemyHP !== result.enemies.reduce((sum, unit) => sum + unit.hp, 0)) return false;
      if (result.won !== (result.remainingEnemyHP === 0 && result.remainingPartyHP > 0)) return false;
      return true;
    }
    function validateState(candidate) {
      if (!object(candidate) || candidate.schema !== SCHEMA || !integer(candidate.completedCount, 0, 5) || !integer(candidate.page, 0, 10000) || !timestamp(candidate.updatedAt) || !['hold', 'main'].includes(candidate.action) || !['normal', 'large'].includes(candidate.readingSize) || typeof candidate.cheerUnlocked !== 'boolean') return false;
      const active = ['pre', 'battle', 'result', 'post'].includes(candidate.phase);
      if (!active && !['ready', 'done'].includes(candidate.phase)) return false;
      if (active ? !integer(candidate.current, 0, 4) || candidate.current !== candidate.completedCount : candidate.current !== null) return false;
      if (candidate.phase === 'done' ? candidate.completedCount !== 5 : candidate.completedCount === 5) return false;
      if (!Array.isArray(candidate.history) || candidate.history.length !== candidate.completedCount) return false;
      if (!candidate.history.every((entry, i) => object(entry) && entry.section === i && timestamp(entry.completedAt) && (sectionBattle(i) ? resultValid(entry.result, i) && entry.result.won : entry.result === null))) return false;
      if (!object(candidate.items) || Object.keys(candidate.items).length !== Object.keys(ITEM_START).length) return false;
      const expected = expectedItems(candidate.completedCount);
      if (!Object.entries(expected).every(([key, value]) => candidate.items[key] === value)) return false;
      if (!active) {
        if (candidate.plan !== null || candidate.result !== null || candidate.page !== 0) return false;
      } else if (sectionBattle(candidate.current)) {
        const unlocked = battle.ENCOUNTERS[sectionBattle(candidate.current)].unlocked;
        if (!Array.isArray(candidate.plan) || candidate.plan.length !== 5 || !candidate.plan.every(skill => typeof skill === 'string' && unlocked.includes(skill))) return false;
        if (['result', 'post'].includes(candidate.phase)) {
          if (!resultValid(candidate.result, candidate.current) || (candidate.phase === 'post' && !candidate.result.won)) return false;
        } else if (candidate.result !== null) return false;
      } else if (candidate.phase !== 'pre' || candidate.plan !== null || candidate.result !== null) return false;
      const cheer = candidate.completedCount >= 4 || (candidate.current === 3 && candidate.result?.won === true);
      if (candidate.cheerUnlocked !== cheer) return false;
      return true;
    }
    let state = initial();
    let raw = null;
    try {
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw Error('保存領域を利用できません。');
      raw = storage.getItem(KEY);
    } catch (error) {
      status = {ok: false, mode: 'memory', error: 'ブラウザの保存領域を読み込めません。セーブの書き出しを利用してください。', savedAt: null};
    }
    if (raw !== null && raw !== undefined) {
      try {
        const saved = JSON.parse(raw);
        if (!validateState(saved)) throw Error('セーブの形式または進行内容を確認できません。');
        state = clone(saved);
        status = {ok: true, mode: 'saved', error: null, savedAt: state.updatedAt};
      } catch (error) {
        blocked = true;
        status = {ok: false, mode: 'blocked', error: '既存のセーブを読み込めないため、元データを保護しています。バックアップを読み込むか、最初から始めてください。', savedAt: null};
      }
    }
    function persist() {
      if (blocked) return;
      try {
        if (!storage || typeof storage.setItem !== 'function') throw Error('保存領域を利用できません。');
        storage.setItem(KEY, JSON.stringify(state));
        status = {ok: true, mode: 'saved', error: null, savedAt: state.updatedAt};
      } catch (error) {
        status = {ok: false, mode: 'memory', error: '自動保存できませんでした。画面を閉じる前にセーブを書き出してください。', savedAt: status.savedAt};
      }
    }
    function change(mutator) {
      const next = clone(state);
      mutator(next);
      next.updatedAt = now();
      state = next;
      persist();
      if (typeof onChange === 'function') onChange(clone(state), clone(status));
      return clone(state);
    }
    function requirePhase(phases) {
      if (!phases.includes(state.phase)) failure('PHASE', 'この操作は現在の進行では実行できません。');
    }
    function battleArgs(plan) {
      const encounterId = sectionBattle(state.current);
      return {encounterId, plan, gem: null, roster: [...battle.ENCOUNTERS[encounterId].party]};
    }
    return {
      saveKey: KEY,
      snapshot: () => clone(state),
      storageStatus: () => clone(status),
      startUpdate() {
        requirePhase(['ready']);
        if (state.action !== 'main') failure('HOLD', '次の物語を選択してから更新してください。');
        return change(next => { next.current = next.completedCount; next.phase = 'pre'; next.page = 0; next.plan = sectionBattle(next.current) ? Array(5).fill('basic') : null; next.result = null; });
      },
      setPlan(index, skill) {
        requirePhase(['battle', 'result']);
        if (state.phase === 'result' && state.result.won) failure('RESOLVED', '確定した戦闘結果は変更できません。');
        if (!integer(index, 0, 4) || !battle.ENCOUNTERS[sectionBattle(state.current)].unlocked.includes(skill)) failure('SKILL', 'この戦闘では使用できない技能です。');
        return change(next => { next.plan[index] = skill; next.phase = 'battle'; next.result = null; });
      },
      goBattle() {
        requirePhase(['pre']);
        if (!sectionBattle(state.current)) failure('NO_BATTLE', 'この節には戦闘がありません。');
        return change(next => { next.phase = 'battle'; next.page = 0; });
      },
      runBattle() {
        requirePhase(['battle']);
        const args = battleArgs(clone(state.plan));
        engine.validate(args);
        const result = clone(engine.simulate(args));
        if (!resultValid(result, state.current)) failure('BATTLE_RESULT', '戦闘結果を保存できる形式で取得できませんでした。');
        return change(next => { next.result = result; next.phase = 'result'; next.page = 0; if (next.current === 3 && result.won) next.cheerUnlocked = true; });
      },
      readPost() {
        requirePhase(['result']);
        if (!state.result.won) failure('DEFEAT', '勝利するまで戦闘後の物語には進めません。');
        return change(next => { next.phase = 'post'; next.page = 0; });
      },
      completeSection() {
        if (!(state.phase === 'post' && state.result?.won) && !(state.phase === 'pre' && state.current === 4 && !sectionBattle(4))) failure('UNFINISHED', 'この節の戦闘と物語を完了してから進めてください。');
        return change(next => {
          next.history.push({section: next.current, result: next.result, completedAt: now()});
          Object.assign(next.items, itemChanges(next.current));
          next.completedCount++;
          next.current = null; next.phase = next.completedCount === 5 ? 'done' : 'ready'; next.action = 'hold'; next.plan = null; next.result = null; next.page = 0;
        });
      },
      setPage(page) {
        requirePhase(['pre', 'post']);
        if (!integer(page, 0, 10000)) failure('PAGE', 'ページ番号が正しくありません。');
        return change(next => { next.page = page; });
      },
      setAction(action) {
        requirePhase(['ready']);
        if (!['hold', 'main'].includes(action)) failure('ACTION', '行動を選択してください。');
        return change(next => { next.action = action; });
      },
      setReadingSize(size) {
        if (!['normal', 'large'].includes(size)) failure('READING_SIZE', '文字サイズが正しくありません。');
        return change(next => { next.readingSize = size; });
      },
      reset() { blocked = false; return change(next => { Object.keys(next).forEach(key => delete next[key]); Object.assign(next, initial()); }); },
      exportSave: () => JSON.stringify(state, null, 2),
      importSave(json) {
        let candidate;
        try { if (typeof json !== 'string' || json.length > 3000000) throw Error(); candidate = JSON.parse(json); } catch (error) { failure('IMPORT', 'セーブファイルのJSONを読み込めませんでした。'); }
        if (!validateState(candidate)) failure('IMPORT', 'この序章の正しいセーブファイルではありません。');
        blocked = false;
        return change(next => { Object.keys(next).forEach(key => delete next[key]); Object.assign(next, clone(candidate)); });
      },
      historyResult(index) {
        if (!integer(index, 0, state.history.length - 1)) return null;
        return clone(state.history[index].result);
      }
    };
  }
  const API = { create, KEY, SCHEMA };
  root.PrologueState = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
