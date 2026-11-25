'use strict';

const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MINIPROGRAM_DIR = path.join(ROOT, 'miniprogram');

const {
  FOODS,
  searchFoods,
  getFoodById,
  calcNutrients
} = require('../miniprogram/utils/foodData');
const {
  CATEGORY_TAGS,
  getCategoryTags
} = require('../miniprogram/utils/categoryTags');
const {
  TAGGED_FOODS,
  FOODS_BY_TAG,
  hasTag,
  findFoodsByTag,
  pickRandomItems,
  pickRecommendationsByGaps,
  pickLowCalorieRecommendations
} = require('../miniprogram/utils/foodTags');
const {
  CALORIE_COPY,
  NUTRIENT_COPY,
  HABIT_COPY,
  NUTRIENT_UNITS
} = require('../miniprogram/utils/adviceCopy');
const {
  generateAdvice,
  computeNutrientGaps,
  getCurrentMealTime
} = require('../miniprogram/utils/advice');
const records = require('../miniprogram/utils/records');
const {
  calcBMR,
  calcTargets,
  ACTIVITY_FACTORS,
  GOAL_ADJUSTMENTS,
  MIN_CALORIES
} = require('../miniprogram/utils/tdee');

// ============================================================================
// Shared Fixtures, Deterministic RNG, Compliance Validators & Mock Harness
// ============================================================================

const EMPTY_TOTALS = Object.freeze({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  vitaminA: 0,
  vitaminC: 0,
  calcium: 0,
  magnesium: 0,
  iron: 0,
  zinc: 0
});

const TEN_NUTRIENTS = Object.freeze([
  'protein', 'carbs', 'fat', 'fiber',
  'vitaminA', 'vitaminC', 'calcium', 'magnesium', 'iron', 'zinc'
]);

const EXPECTED_UNITS = Object.freeze({
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  fiber: 'g',
  vitaminA: 'μg',
  vitaminC: 'mg',
  calcium: 'mg',
  magnesium: 'mg',
  iron: 'mg',
  zinc: 'mg'
});

const NUTRIENT_MATCH_ALIASES = Object.freeze({
  protein: ['蛋白质', '蛋白'],
  carbs: ['碳水化合物', '碳水'],
  fat: ['脂肪'],
  fiber: ['膳食纤维', '纤维'],
  vitaminA: ['维生素A', '维生素 A', '维A', '维 A'],
  vitaminC: ['维生素C', '维生素 C', '维C', '维 C'],
  calcium: ['钙'],
  magnesium: ['镁'],
  iron: ['铁'],
  zinc: ['锌']
});

const EVENING_ONLY_RE = /晚餐|晚上|睡前|最后这一餐|收尾|晚餐后/;
const MEDICAL_CLAIM_RE = /治疗|疗效|降血糖|降血压|改善疾病|预防疾病|排毒|燃脂|刮油|修复/;
const ABSOLUTE_CLAIM_RE = /必须|一定要|绝对不能|彻底|根除/;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const UNSEARCHABLE_FOOD_DENYLIST = Object.freeze([
  '全麦面包', '全麦吐司', '吐司', '全麦饼干', '饼干',
  '杂粮饭', '杂粮粥', '紫薯', '包子', '饺子',
  '花生酱', '坚果酱', '芝麻酱', '黑巧克力', '西梅干',
  '鲜橙汁', '橙汁', '鲜榨果汁', '鸡胸肉丸', '牛排',
  '瘦肉粥', '猪肝粥', '猪血粥'
]);

const SPECIFIC_FOOD_TERMS = Object.freeze([
  '鸡蛋', '水煮蛋', '豆浆', '鸡胸肉', '鸡胸脯肉', '豆腐', '嫩豆腐',
  '牛肉', '牛奶', '酸奶', '香蕉', '玉米', '红薯', '甘薯', '糙米',
  '燕麦', '燕麦片', '苹果', '黄瓜', '番茄', '西红柿', '圣女果', '小番茄',
  '西兰花', '菠菜', '彩椒', '甜椒', '猕猴桃', '奇异果', '橙子', '西柚',
  '草莓', '木瓜', '菜心', '虾皮', '紫菜', '南瓜', '南瓜子', '腰果',
  '杏仁', '巴旦木', '核桃', '猪肝', '猪血', '木耳', '红枣', '葡萄干',
  '牛肉干', '牛油果', '鳄梨', '奶酪', '馒头', '面条', '三文鱼',
  '胡萝卜', '生菜', '小米', '小米粥'
]);

const BOUNDARY_PROFILES = Object.freeze({
  tdee1187: { gender: 'female', age: 50, heightCm: 152, weightKg: 45, activity: 'sedentary', goal: 'lose' },
  tdee1199: { gender: 'female', age: 50, heightCm: 152, weightKg: 46, activity: 'sedentary', goal: 'lose' },
  tdee1200: { gender: 'female', age: 50, heightCm: 153, weightKg: 45.5, activity: 'sedentary', goal: 'lose' },
  tdee1330: { gender: 'female', age: 30, heightCm: 155, weightKg: 45, activity: 'sedentary', goal: 'lose' },
  tdee1500: { gender: 'female', age: 30, heightCm: 165, weightKg: 53, activity: 'sedentary', goal: 'lose' },
  maleGain: { gender: 'male', age: 26, heightCm: 178, weightKg: 70, activity: 'moderate', goal: 'gain' }
});

const PLANT_OIL_IDS = Object.freeze([
  '192001', '192002', '192003', '192004', '192005', '192006',
  '192007', '192008', '192009', '192010', '192012', '192013',
  '192014', '192015', '192016', '192017', '192018', '192019'
]);

const WILD_VEG_CAT = '蔬菜类及其制品-野生蔬菜类';
const SEAFOOD_OTHER_CAT = '鱼虾蟹贝类-其他';

function createRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeCopyPool(slot) {
  if (Array.isArray(slot)) return slot;
  if (slot && typeof slot === 'object') {
    return Object.values(slot).flat();
  }
  return [];
}

function assertAiPromptCompliance(line, ctx = '') {
  assert.equal(typeof line, 'string', `${ctx}: line must be string`);
  assert.ok(line.trim().length > 0, `${ctx}: line must be non-empty`);
  assert.ok(!MEDICAL_CLAIM_RE.test(line), `${ctx}: medical claim forbidden in "${line}"`);
  assert.ok(!ABSOLUTE_CLAIM_RE.test(line), `${ctx}: absolute claim forbidden in "${line}"`);
  assert.ok(!line.includes('您'), `${ctx}: pronoun "您" forbidden in "${line}"`);
  assert.ok(!EMOJI_RE.test(line), `${ctx}: emoji forbidden in "${line}"`);
  const placeholders = line.match(/\{[^}]+\}/g) || [];
  for (const ph of placeholders) {
    assert.ok(
      ph === '{remaining}' || ph === '{gap}' || ph === '{pct}',
      `${ctx}: invalid placeholder ${ph} in "${line}"`
    );
  }
}

function buildRecordInput(foodId, grams, meal, dateKey) {
  const food = getFoodById(foodId);
  assert.ok(food, `Expected food ${foodId} to exist`);
  const nutrients = calcNutrients(food, grams);
  return {
    foodId: food.id,
    foodName: food.name,
    grams,
    meal,
    dateKey,
    ...nutrients
  };
}

function independentSumThenRound(items) {
  const raw = { ...EMPTY_TOTALS };
  for (const item of items || []) {
    for (const key of Object.keys(raw)) {
      raw[key] += (item && item[key]) || 0;
    }
  }
  const round1 = n => Math.round(n * 10) / 10;
  const round2 = n => Math.round(n * 100) / 100;
  return {
    calories: Math.round(raw.calories),
    protein: round1(raw.protein),
    carbs: round1(raw.carbs),
    fat: round1(raw.fat),
    fiber: round1(raw.fiber),
    vitaminA: round1(raw.vitaminA),
    vitaminC: round1(raw.vitaminC),
    calcium: round1(raw.calcium),
    magnesium: round1(raw.magnesium),
    iron: round2(raw.iron),
    zinc: round2(raw.zinc)
  };
}

// ============================================================================
// WXML AST Parser & Evaluator + WXSS Rule Inspector
// ============================================================================

function decodeWxmlEntities(str) {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseWxmlAttrs(attrStr) {
  const attrs = {};
  let i = 0;
  const len = attrStr.length;
  while (i < len) {
    while (i < len && /\s/.test(attrStr[i])) i++;
    if (i >= len) break;
    let nameStart = i;
    while (i < len && !/[\s=]/.test(attrStr[i])) i++;
    const name = attrStr.slice(nameStart, i);
    if (!name) break;
    while (i < len && /\s/.test(attrStr[i])) i++;
    if (attrStr[i] === '=') {
      i++;
      while (i < len && /\s/.test(attrStr[i])) i++;
      const quote = attrStr[i];
      if (quote === '"' || quote === "'") {
        i++;
        const valStart = i;
        while (i < len && attrStr[i] !== quote) i++;
        attrs[name] = decodeWxmlEntities(attrStr.slice(valStart, i));
        if (attrStr[i] === quote) i++;
      } else {
        const valStart = i;
        while (i < len && !/\s/.test(attrStr[i])) i++;
        attrs[name] = decodeWxmlEntities(attrStr.slice(valStart, i));
      }
    } else {
      attrs[name] = true;
    }
  }
  return attrs;
}

function parseWxml(wxml) {
  const cleaned = wxml.replace(/<!--[\s\S]*?-->/g, '');
  const root = { type: 'el', tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  const voidTags = new Set(['input', 'image', 'icon', 'br', 'hr']);
  let i = 0;
  const len = cleaned.length;

  while (i < len) {
    const lt = cleaned.indexOf('<', i);
    if (lt === -1) {
      const text = cleaned.slice(i);
      if (text) stack[stack.length - 1].children.push({ type: 'text', text });
      break;
    }
    if (lt > i) {
      stack[stack.length - 1].children.push({ type: 'text', text: cleaned.slice(i, lt) });
    }
    if (cleaned[lt + 1] === '/') {
      const gt = cleaned.indexOf('>', lt + 2);
      if (gt === -1) break;
      const closeTag = cleaned.slice(lt + 2, gt).trim();
      while (stack.length > 1 && stack[stack.length - 1].tag !== closeTag) {
        stack.pop();
      }
      if (stack.length > 1 && stack[stack.length - 1].tag === closeTag) {
        stack.pop();
      }
      i = gt + 1;
      continue;
    }

    // Scan opening tag respecting quotes and {{...}}
    let j = lt + 1;
    let inQuote = null;
    let inMustache = false;
    while (j < len) {
      const ch = cleaned[j];
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
      } else {
        if (ch === '"' || ch === "'") inQuote = ch;
        else if (ch === '{' && cleaned[j + 1] === '{') {
          inMustache = true;
          j++;
        } else if (inMustache && ch === '}' && cleaned[j + 1] === '}') {
          inMustache = false;
          j++;
        } else if (!inMustache && ch === '>') {
          break;
        }
      }
      j++;
    }
    let rawTag = cleaned.slice(lt + 1, j).trim();
    const selfClosing = rawTag.endsWith('/');
    if (selfClosing) rawTag = rawTag.slice(0, -1).trim();
    const spaceIdx = rawTag.search(/\s/);
    const tag = spaceIdx === -1 ? rawTag : rawTag.slice(0, spaceIdx);
    const attrStr = spaceIdx === -1 ? '' : rawTag.slice(spaceIdx + 1);
    const node = { type: 'el', tag, attrs: parseWxmlAttrs(attrStr), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing && !voidTags.has(tag)) {
      stack.push(node);
    }
    i = j + 1;
  }
  return root;
}

function evalWxmlExpr(expr, scope) {
  const cleaned = decodeWxmlEntities(String(expr)).trim();
  if (!cleaned) return undefined;
  const fn = new Function('__scope', `with (__scope) { return (${cleaned}); }`);
  return fn(scope);
}

function unwrapMustache(val) {
  if (typeof val !== 'string') return '';
  const m = val.match(/^\s*\{\{([\s\S]+)\}\}\s*$/);
  return m ? m[1].trim() : val.trim();
}

function interpolateWxml(str, scope) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{([\s\S]+?)\}\}/g, (_, expr) => {
    try {
      const v = evalWxmlExpr(expr, scope);
      return v === undefined || v === null ? '' : String(v);
    } catch {
      return '';
    }
  });
}

function renderWxmlNodes(children, scope) {
  const out = [];
  let ifActive = false;

  for (const child of children) {
    if (child.type === 'text') {
      if (child.text.trim().length > 0) {
        ifActive = false;
      }
      const renderedText = interpolateWxml(child.text, scope);
      if (renderedText) out.push({ type: 'text', text: renderedText });
      continue;
    }

    const attrs = child.attrs || {};
    if ('wx:if' in attrs) {
      let cond = false;
      try {
        cond = Boolean(evalWxmlExpr(unwrapMustache(attrs['wx:if']), scope));
      } catch {
        cond = false;
      }
      ifActive = cond;
      if (!cond) continue;
    } else if ('wx:elif' in attrs) {
      if (ifActive) continue;
      let cond = false;
      try {
        cond = Boolean(evalWxmlExpr(unwrapMustache(attrs['wx:elif']), scope));
      } catch {
        cond = false;
      }
      ifActive = cond;
      if (!cond) continue;
    } else if ('wx:else' in attrs) {
      const matched = ifActive;
      ifActive = false;
      if (matched) continue;
    } else {
      ifActive = false;
    }

    if ('wx:for' in attrs) {
      let list = [];
      try {
        const res = evalWxmlExpr(unwrapMustache(attrs['wx:for']), scope);
        if (Array.isArray(res)) list = res;
      } catch {
        list = [];
      }
      const itemVar = typeof attrs['wx:for-item'] === 'string' ? attrs['wx:for-item'] : 'item';
      const indexVar = typeof attrs['wx:for-index'] === 'string' ? attrs['wx:for-index'] : 'index';
      for (let idx = 0; idx < list.length; idx++) {
        const loopScope = { ...scope, [itemVar]: list[idx], [indexVar]: idx };
        const renderedAttrs = {};
        for (const [k, v] of Object.entries(attrs)) {
          if (k.startsWith('wx:')) continue;
          renderedAttrs[k] = typeof v === 'string' ? interpolateWxml(v, loopScope) : v;
        }
        out.push({
          type: 'el',
          tag: child.tag,
          attrs: renderedAttrs,
          children: renderWxmlNodes(child.children, loopScope)
        });
      }
      continue;
    }

    const renderedAttrs = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('wx:')) continue;
      renderedAttrs[k] = typeof v === 'string' ? interpolateWxml(v, scope) : v;
    }
    out.push({
      type: 'el',
      tag: child.tag,
      attrs: renderedAttrs,
      children: renderWxmlNodes(child.children, scope)
    });
  }
  return out;
}

function renderWxml(wxmlSource, data) {
  const ast = parseWxml(wxmlSource);
  return {
    type: 'el',
    tag: 'root',
    attrs: {},
    children: renderWxmlNodes(ast.children, data || {})
  };
}

function findVNodes(vnode, predicate, acc = []) {
  if (!vnode || vnode.type !== 'el') return acc;
  if (predicate(vnode)) acc.push(vnode);
  for (const ch of vnode.children || []) {
    if (ch.type === 'el') findVNodes(ch, predicate, acc);
  }
  return acc;
}

function getVNodeText(vnode) {
  if (!vnode) return '';
  if (vnode.type === 'text') return vnode.text;
  return (vnode.children || []).map(getVNodeText).join('');
}

function hasClass(vnode, cls) {
  const raw = String(vnode?.attrs?.class || '');
  return raw.split(/\s+/).includes(cls);
}

function parseWxssRules(wxssSource) {
  const noComments = wxssSource.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(noComments)) !== null) {
    rules.push({
      selector: m[1].trim(),
      body: m[2].trim()
    });
  }
  return rules;
}

// ============================================================================
// Global wx & Mini Program App/Page Mock Harness
// ============================================================================

const MODULE_PATHS = {
  app: path.join(MINIPROGRAM_DIR, 'app.js'),
  today: path.join(MINIPROGRAM_DIR, 'pages/today/today.js'),
  record: path.join(MINIPROGRAM_DIR, 'pages/record/record.js'),
  profile: path.join(MINIPROGRAM_DIR, 'pages/profile/profile.js'),
  records: path.join(MINIPROGRAM_DIR, 'utils/records.js'),
  advice: path.join(MINIPROGRAM_DIR, 'utils/advice.js'),
  adviceCopy: path.join(MINIPROGRAM_DIR, 'utils/adviceCopy.js'),
  tdee: path.join(MINIPROGRAM_DIR, 'utils/tdee.js')
};

function clearModuleCaches(extraPaths = []) {
  const targets = [
    MODULE_PATHS.app,
    MODULE_PATHS.today,
    MODULE_PATHS.record,
    MODULE_PATHS.profile,
    MODULE_PATHS.records,
    MODULE_PATHS.advice,
    MODULE_PATHS.tdee,
    ...extraPaths
  ];
  for (const p of targets) {
    try {
      delete require.cache[require.resolve(p)];
    } catch {
      // ignore unresolved
    }
  }
}

function applySetDataPatch(targetData, patch) {
  for (const [key, val] of Object.entries(patch || {})) {
    if (!key.includes('.')) {
      targetData[key] = val;
      continue;
    }
    const parts = key.split('.');
    let cursor = targetData;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!cursor[seg] || typeof cursor[seg] !== 'object') {
        cursor[seg] = {};
      }
      cursor = cursor[seg];
    }
    cursor[parts[parts.length - 1]] = val;
  }
}

function createWxMock(initialStore = {}) {
  const store = structuredClone(initialStore);
  const toasts = [];
  const modals = [];
  const tabSwitches = [];
  let throwOnSet = null;
  let throwOnGet = null;
  let modalResponse = { confirm: true, cancel: false };

  const wx = {
    getStorageSync(key) {
      if (throwOnGet) throw throwOnGet;
      return store[key];
    },
    setStorageSync(key, val) {
      if (throwOnSet) throw throwOnSet;
      store[key] = structuredClone(val);
    },
    removeStorageSync(key) {
      if (throwOnSet) throw throwOnSet;
      delete store[key];
    },
    showToast(opts) {
      toasts.push(opts);
    },
    showModal(opts) {
      modals.push(opts);
      if (opts && typeof opts.success === 'function') {
        opts.success({ ...modalResponse });
      }
    },
    switchTab(opts) {
      tabSwitches.push(opts);
    }
  };

  return {
    wx,
    store,
    toasts,
    modals,
    tabSwitches,
    setThrowOnSet(err) { throwOnSet = err; },
    setThrowOnGet(err) { throwOnGet = err; },
    setModalResponse(resp) { modalResponse = { ...resp }; }
  };
}

let activeCleanups = [];

afterEach(() => {
  while (activeCleanups.length > 0) {
    const fn = activeCleanups.pop();
    try {
      fn();
    } catch {
      // best-effort cleanup
    }
  }
});

function withWxMock(initialStore = {}) {
  const prevWx = global.wx;
  const mock = createWxMock(initialStore);
  global.wx = mock.wx;
  const restore = () => {
    if (prevWx === undefined) delete global.wx;
    else global.wx = prevWx;
  };
  activeCleanups.push(restore);
  return { ...mock, restore };
}

function createMiniProgramHarness(options = {}) {
  const saved = {
    wx: global.wx,
    App: global.App,
    Page: global.Page,
    getApp: global.getApp,
    getCurrentPages: global.getCurrentPages
  };

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (typeof options.afterCleanup === 'function') {
      options.afterCleanup();
    }
    clearModuleCaches();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete global[k];
      else global[k] = v;
    }
  };
  activeCleanups.push(cleanup);

  const wxMock = createWxMock(options.initialStore || {});
  global.wx = wxMock.wx;

  clearModuleCaches();

  if (typeof options.beforeLoad === 'function') {
    options.beforeLoad();
  }

  let capturedAppDef = null;
  global.App = (def) => { capturedAppDef = def; };
  require(MODULE_PATHS.app);
  assert.ok(capturedAppDef, 'app.js must call App(...)');

  const app = {
    ...capturedAppDef,
    globalData: structuredClone(capturedAppDef.globalData || {})
  };
  global.getApp = () => app;

  let currentPagesStack = [];
  global.getCurrentPages = () => currentPagesStack;

  function mountPage(route, modulePath) {
    let capturedPageDef = null;
    global.Page = (def) => { capturedPageDef = def; };
    require(modulePath);
    assert.ok(capturedPageDef, `${route} must call Page(...)`);
    const page = {
      ...capturedPageDef,
      route,
      data: structuredClone(capturedPageDef.data || {}),
      setData(patch, cb) {
        applySetDataPatch(this.data, patch);
        if (typeof cb === 'function') cb();
      }
    };
    return page;
  }

  const pages = {
    today: mountPage('pages/today/today', MODULE_PATHS.today),
    record: mountPage('pages/record/record', MODULE_PATHS.record),
    profile: mountPage('pages/profile/profile', MODULE_PATHS.profile)
  };

  app.onLaunch?.({});
  pages.profile.onLoad?.({});
  pages.record.onLoad?.({});
  pages.today.onLoad?.({});

  currentPagesStack = [pages.today];
  pages.today.onShow?.({});

  function getActivePage() {
    return currentPagesStack[currentPagesStack.length - 1] || null;
  }

  function switchTab(targetName) {
    const prev = getActivePage();
    if (prev && prev !== pages[targetName]) {
      prev.onHide?.();
    }
    const next = pages[targetName];
    assert.ok(next, `Unknown page ${targetName}`);
    currentPagesStack = [next];
    next.onShow?.({});
    return next;
  }

  function simulateBackgroundResume(activeName) {
    const page = activeName ? pages[activeName] : getActivePage();
    if (page) {
      currentPagesStack = [page];
      page.onHide?.();
    }
    app.onHide?.();
    app.onShow?.({ path: page ? page.route : 'pages/today/today' });
    if (page) {
      page.onShow?.();
    }
    return page;
  }

  return {
    app,
    pages,
    wxMock,
    switchTab,
    simulateBackgroundResume,
    getActivePage,
    cleanup
  };
}

function loadWxml(relPath) {
  return fs.readFileSync(path.join(MINIPROGRAM_DIR, relPath), 'utf8');
}

function loadWxss(relPath) {
  return fs.readFileSync(path.join(MINIPROGRAM_DIR, relPath), 'utf8');
}

function discoverWxmlTapHandler(wxmlSource, data, labelRegex) {
  const tree = renderWxml(wxmlSource, data);
  const getTapHandler = attrs =>
    attrs?.bindtap || attrs?.catchtap || attrs?.['bind:tap'] || attrs?.['catch:tap'] || null;
  const matches = findVNodes(tree, n => {
    const handler = getTapHandler(n.attrs);
    if (typeof handler !== 'string' || handler.length === 0) return false;
    return labelRegex.test(getVNodeText(n));
  });
  return matches.length > 0 ? getTapHandler(matches[0].attrs) : null;
}

// ============================================================================
// TIER 1: Core Requirement Verification (>= 5 cases per feature F1-F14, F16)
// ============================================================================

describe('Tier 1 — Core Requirements', () => {
  // --------------------------------------------------------------------------
  // F1: 植物油与 0 卡条目修正
  // --------------------------------------------------------------------------
  describe('F1 — 植物油与 0 卡条目修正', () => {
    test('E2E-F1-T1-01: all 18 real plant oil entries have calories in 895..900 kcal', () => {
      for (const id of PLANT_OIL_IDS) {
        const oil = getFoodById(id);
        assert.ok(oil, `Plant oil ${id} must exist`);
        assert.equal(oil.category, '植物油-植物油');
        assert.ok(
          oil.calories >= 895 && oil.calories <= 900,
          `Expected ${id} ${oil.name} calories in 895..900, got ${oil.calories}`
        );
      }
    });

    test('E2E-F1-T1-02: 052005 海冻菜（干）has repaired non-zero calories (~314)', () => {
      const food = getFoodById('052005');
      assert.ok(food);
      assert.ok(food.calories >= 250 && food.calories <= 380, `got ${food.calories}`);
    });

    test('E2E-F1-T1-03: 048001 艾蒿 has repaired non-zero calories (~55)', () => {
      const food = getFoodById('048001');
      assert.ok(food);
      assert.ok(food.calories >= 15 && food.calories <= 100, `got ${food.calories}`);
    });

    test('E2E-F1-T1-04: 219041 蜂王浆 has repaired non-zero calories', () => {
      const food = getFoodById('219041');
      assert.ok(food);
      assert.ok(food.calories >= 50 && food.calories <= 250, `got ${food.calories}`);
    });

    test('E2E-F1-T1-05: no recommendable item in TAGGED_FOODS has 0 calories with macros > 1g', () => {
      const anomalies = TAGGED_FOODS.filter(
        f => !hasTag(f, 'excluded') &&
          !hasTag(f, 'limit') &&
          !hasTag(f, 'processed') &&
          f.calories === 0 &&
          (f.protein > 1 || f.carbs > 1 || f.fat > 1)
      );
      assert.deepEqual(anomalies.map(f => `${f.id}:${f.name}`), []);
    });

    test('E2E-F1-T1-06: calcNutrients on 10g olive oil (192019) yields ~90 kcal and 10g fat', () => {
      const oliveOil = getFoodById('192019');
      assert.ok(oliveOil);
      const n = calcNutrients(oliveOil, 10);
      assert.ok(n.calories >= 89 && n.calories <= 90, `got ${n.calories}`);
      assert.equal(n.fat, 10);
    });
  });

  // --------------------------------------------------------------------------
  // F2: 高风险分类与单品排除
  // --------------------------------------------------------------------------
  describe('F2 — 高风险分类与单品排除', () => {
    test('E2E-F2-T1-01: all remaining 野生蔬菜类 items carry excluded tag', () => {
      const wildVegs = TAGGED_FOODS.filter(f => f.category === WILD_VEG_CAT);
      for (const item of wildVegs) {
        assert.equal(hasTag(item, 'excluded'), true, `${item.id} ${item.name} must be excluded`);
      }
      const penGua = getFoodById('048037');
      if (penGua) {
        const tagged = TAGGED_FOODS.find(f => f.id === '048037');
        assert.equal(hasTag(tagged, 'excluded'), true);
      }
    });

    test('E2E-F2-T1-02: all remaining 鱼虾蟹贝类-其他 items carry excluded tag', () => {
      const items = TAGGED_FOODS.filter(f => f.category === SEAFOOD_OTHER_CAT);
      for (const item of items) {
        assert.equal(hasTag(item, 'excluded'), true, `${item.id} ${item.name} must be excluded`);
      }
    });

    test('E2E-F2-T1-03: 121245 双髻鲨 and 045329 白凤菜 are removed or excluded', () => {
      for (const id of ['121245', '045329']) {
        const raw = getFoodById(id);
        if (raw) {
          const tagged = TAGGED_FOODS.find(f => f.id === id);
          assert.equal(hasTag(tagged, 'excluded'), true, `${id} ${raw.name} must be excluded`);
        }
      }
    });

    test('E2E-F2-T1-04: 044501 薤［皎头］ (all-zero macros) is removed or excluded', () => {
      const raw = getFoodById('044501');
      if (raw) {
        const tagged = TAGGED_FOODS.find(f => f.id === '044501');
        assert.equal(hasTag(tagged, 'excluded'), true);
      }
    });

    test('E2E-F2-T1-05: high-risk categories and items never appear in recommendations across 50 seeds', () => {
      const allGaps = TEN_NUTRIENTS.map((key, index) => ({
        key,
        value: 500,
        ratio: 0.9,
        score: 1.0 - index * 0.01,
        index
      }));
      const blockedIds = new Set(['121245', '045329', '048037', '044501']);
      const rng = createRng(101);
      for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
        for (const goal of ['lose', 'maintain', 'gain']) {
          for (let i = 0; i < 50; i++) {
            const recs = pickRecommendationsByGaps(allGaps, mealTime, { maxCount: 6, goal, rng });
            for (const f of recs) {
              assert.notEqual(f.category, WILD_VEG_CAT, `Wild veg leaked: ${f.name}`);
              assert.notEqual(f.category, SEAFOOD_OTHER_CAT, `Seafood-other leaked: ${f.name}`);
              assert.equal(blockedIds.has(f.id), false, `Blocked item leaked: ${f.id} ${f.name}`);
            }
          }
        }
        const lowCal = pickLowCalorieRecommendations(mealTime, 10, { rng });
        for (const f of lowCal) {
          assert.notEqual(f.category, WILD_VEG_CAT);
          assert.notEqual(f.category, SEAFOOD_OTHER_CAT);
          assert.equal(blockedIds.has(f.id), false);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // F3: 场景化单品与高脂内脏过滤
  // --------------------------------------------------------------------------
  describe('F3 — 场景化单品与高脂内脏过滤', () => {
    test('E2E-F3-T1-01: breakfast never recommends 姜（干）, unhulled raw grains, or 鸡心', () => {
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      const gaps = computeNutrientGaps(EMPTY_TOTALS, targets);
      const blockedIds = new Set(['047302', '012211', '013103', '091203']);
      const blockedRe = /^姜（|生姜|籼稻（红）|玉米（黄，干）|鸡心/;
      const rng = createRng(202);
      for (const goal of ['lose', 'maintain', 'gain']) {
        for (let i = 0; i < 50; i++) {
          const recs = pickRecommendationsByGaps(gaps, 'breakfast', { maxCount: 6, goal, rng });
          for (const f of recs) {
            assert.equal(blockedIds.has(f.id) || blockedRe.test(f.name), false, `Breakfast blocker leaked: ${f.id} ${f.name}`);
          }
        }
      }
      for (let i = 0; i < 20; i++) {
        const low = pickLowCalorieRecommendations('breakfast', 15, { rng });
        for (const f of low) {
          assert.equal(blockedIds.has(f.id) || blockedRe.test(f.name), false, `Breakfast low-cal blocker leaked: ${f.id} ${f.name}`);
        }
      }
    });

    test('E2E-F3-T1-02: lunch/dinner & low-cal recommendations exclude 大葱/小葱/hot 辣椒', () => {
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      const gaps = computeNutrientGaps(EMPTY_TOTALS, targets);
      const blockedIds = new Set(['044206', '044202', '044205', '043108', '043109', '043121', '043122']);
      const rng = createRng(303);
      for (const mealTime of ['lunch', 'dinner']) {
        for (let i = 0; i < 50; i++) {
          const recs = pickRecommendationsByGaps(gaps, mealTime, { maxCount: 6, goal: 'maintain', rng });
          for (const f of recs) {
            assert.equal(blockedIds.has(f.id), false, `Scallion/chili leaked in ${mealTime}: ${f.id} ${f.name}`);
          }
        }
        for (let i = 0; i < 20; i++) {
          const low = pickLowCalorieRecommendations(mealTime, 20, { rng });
          for (const f of low) {
            assert.equal(blockedIds.has(f.id), false, `Scallion/chili leaked in low-cal: ${f.id} ${f.name}`);
          }
        }
      }
    });

    test('E2E-F3-T1-03: high-fat meats are filtered across lose, maintain, and gain', () => {
      const highFatIds = ['081102', '081105', '081118', '091104'];
      for (const id of highFatIds) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        if (f) {
          assert.ok(hasTag(f, 'excluded') || hasTag(f, 'limit'), `${id} ${f.name} must be excluded or limit`);
        }
      }
      const fatGaps = [{ key: 'fat', value: 50, ratio: 0.9, score: 1.05, index: 0 }];
      const rng = createRng(404);
      for (const goal of ['lose', 'maintain', 'gain']) {
        for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
          for (let i = 0; i < 30; i++) {
            const recs = pickRecommendationsByGaps(fatGaps, mealTime, { maxCount: 6, goal, rng });
            for (const f of recs) {
              assert.equal(highFatIds.includes(f.id), false, `High-fat meat leaked (${goal}): ${f.name}`);
            }
          }
        }
      }
    });

    test('E2E-F3-T1-04: animal offal is filtered even when vitaminA or iron gap dominates', () => {
      const offalIds = ['082201', '082206', '082204', '081113', '081214', '083204', '091201', '091203'];
      for (const id of offalIds) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        if (f) {
          assert.ok(hasTag(f, 'excluded') || hasTag(f, 'limit'), `Offal ${id} ${f.name} must be blocked`);
        }
      }
      const gaps = [
        { key: 'vitaminA', value: 700, ratio: 0.95, score: 0.95, index: 0 },
        { key: 'iron', value: 18, ratio: 0.9, score: 0.9, index: 1 }
      ];
      const rng = createRng(505);
      for (const goal of ['lose', 'maintain', 'gain']) {
        for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
          for (let i = 0; i < 30; i++) {
            const recs = pickRecommendationsByGaps(gaps, mealTime, { maxCount: 6, goal, rng });
            for (const f of recs) {
              assert.equal(offalIds.includes(f.id), false, `Offal leaked (${goal}/${mealTime}): ${f.name}`);
            }
          }
        }
      }
    });

    test('E2E-F3-T1-05: all 55 CATEGORY_TAGS subcategories resolve cleanly via getCategoryTags', () => {
      assert.equal(CATEGORY_TAGS.length, 55);
      for (const entry of CATEGORY_TAGS) {
        const resolved = getCategoryTags(entry.sub);
        assert.deepEqual(resolved, entry);
      }
      assert.ok(getCategoryTags('野生蔬菜类'));
      assert.ok(getCategoryTags('葱蒜类'));
    });

    test('E2E-F3-T1-06: pickLowCalorieRecommendations returns only safe items with calories <= 100', () => {
      const rng = createRng(606);
      for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
        const recs = pickLowCalorieRecommendations(mealTime, 15, { rng });
        assert.ok(recs.length > 0);
        for (const f of recs) {
          assert.ok(f.calories <= 100, `Expected <= 100 kcal, got ${f.calories} for ${f.name}`);
          assert.equal(hasTag(f, 'excluded'), false);
          assert.equal(hasTag(f, 'limit'), false);
          assert.equal(hasTag(f, 'processed'), false);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // F4: isProcessedFood 加工词表补全
  // --------------------------------------------------------------------------
  describe('F4 — isProcessedFood 加工词表补全', () => {
    test('E2E-F4-T1-01: sausage, luncheon meat, jerky, and air-dried meats carry processed tag', () => {
      for (const id of ['081413', '081407', '081403', '081307', '082303', '081331']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f, `Expected ${id} in TAGGED_FOODS`);
        assert.equal(hasTag(f, 'processed'), true, `${id} ${f.name} should be processed`);
      }
    });

    test('E2E-F4-T1-02: fish/shrimp/clam/cuttlefish meatballs carry processed tag', () => {
      for (const id of ['121305', '122301', '124601', '129302']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        if (f) {
          assert.equal(hasTag(f, 'processed'), true, `${id} ${f.name} should be processed`);
        }
      }
    });

    test('E2E-F4-T1-03: braised/roasted/grilled items (扒/烤/红烧) carry processed tag', () => {
      for (const id of ['091301', '081328', '091309', '121421', '121408', '092303']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f, `Expected ${id} in TAGGED_FOODS`);
        assert.equal(hasTag(f, 'processed'), true, `${id} ${f.name} should be processed`);
      }
    });

    test('E2E-F4-T1-04: oil-packed, brined, salted, and canned items carry processed tag', () => {
      for (const id of ['121406', '121405', '121418', '121419', '071021', '104022', '051005']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f, `Expected ${id} in TAGGED_FOODS`);
        assert.equal(hasTag(f, 'processed'), true, `${id} ${f.name} should be processed`);
      }
    });

    test('E2E-F4-T1-05: processed items never appear in recommendations across 50 seeds', () => {
      const processedIds = new Set(findFoodsByTag('processed').map(f => f.id));
      assert.ok(processedIds.size > 0);
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      const gaps = computeNutrientGaps(EMPTY_TOTALS, targets);
      const rng = createRng(707);
      for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
        for (const goal of ['lose', 'maintain', 'gain']) {
          for (let i = 0; i < 50; i++) {
            const recs = pickRecommendationsByGaps(gaps, mealTime, { maxCount: 5, goal, rng });
            for (const f of recs) {
              assert.equal(processedIds.has(f.id), false, `Processed food leaked: ${f.name}`);
            }
          }
        }
        const low = pickLowCalorieRecommendations(mealTime, 10, { rng });
        for (const f of low) {
          assert.equal(processedIds.has(f.id), false, `Processed low-cal food leaked: ${f.name}`);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // F5: foodTags.js 惰性初始化、去重与 VitA/Zinc 标签
  // --------------------------------------------------------------------------
  describe('F5 — foodTags.js 惰性初始化、去重与 VitA/Zinc 标签', () => {
    test('E2E-F5-T1-01: cold require of foodTags.js exposes lazy getters without eager tagging', () => {
      const script = [
        "const ct = require('./miniprogram/utils/categoryTags');",
        "const origGet = ct.getCategoryTags;",
        "let callCount = 0;",
        "ct.getCategoryTags = function(...args) { callCount++; return origGet.apply(this, args); };",
        "const mod = require('./miniprogram/utils/foodTags');",
        "const callsAfterRequire = callCount;",
        "const d1 = Object.getOwnPropertyDescriptor(mod, 'TAGGED_FOODS');",
        "const d2 = Object.getOwnPropertyDescriptor(mod, 'FOODS_BY_TAG');",
        "const callsAfterDescriptors = callCount;",
        "const found = mod.findFoodsByTag('highProtein');",
        "const callsAfterAccess = callCount;",
        "console.log(JSON.stringify({",
        "  hasTaggedGetter: Boolean(d1 && typeof d1.get === 'function'),",
        "  hasByTagGetter: Boolean(d2 && typeof d2.get === 'function'),",
        "  callsAfterRequire,",
        "  callsAfterDescriptors,",
        "  callsAfterAccess,",
        "  foundLen: found.length",
        "}));"
      ].join(' ');
      const stdout = execFileSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8' });
      const info = JSON.parse(stdout.trim());
      assert.equal(info.hasTaggedGetter, true, 'TAGGED_FOODS should be a lazy getter');
      assert.equal(info.hasByTagGetter, true, 'FOODS_BY_TAG should be a lazy getter');
      assert.equal(info.callsAfterRequire, 0, 'require(foodTags) must not call getCategoryTags eagerly');
      assert.equal(info.callsAfterDescriptors, 0, 'inspecting getters must not trigger eager tagging');
      assert.ok(info.callsAfterAccess > 0, 'first access to findFoodsByTag/TAGGED_FOODS must trigger tagging');
      assert.ok(info.foundLen > 0);
    });

    test('E2E-F5-T1-02: after first recommendation call, TAGGED_FOODS and FOODS_BY_TAG remain fully populated', () => {
      const script = [
        "const { FOODS } = require('./miniprogram/utils/foodData');",
        "const ft = require('./miniprogram/utils/foodTags');",
        "const recs = ft.pickLowCalorieRecommendations('lunch', 3);",
        "console.log(JSON.stringify({",
        "  recsLen: recs.length,",
        "  taggedLen: ft.TAGGED_FOODS.length,",
        "  foodsLen: FOODS.length,",
        "  highProteinLen: (ft.FOODS_BY_TAG.highProtein || []).length",
        "}));"
      ].join(' ');
      const stdout = execFileSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8' });
      const info = JSON.parse(stdout.trim());
      assert.equal(info.recsLen, 3);
      assert.equal(info.taggedLen, info.foodsLen);
      assert.ok(info.highProteinLen > 0);
    });

    test('E2E-F5-T1-03: pickLowCalorieRecommendations deduplicates by food.name across 20 seeds', () => {
      const rng = createRng(808);
      for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
        for (let i = 0; i < 20; i++) {
          const recs = pickLowCalorieRecommendations(mealTime, 20, { rng });
          const names = recs.map(f => f.name);
          assert.equal(
            new Set(names).size,
            names.length,
            `Duplicate names in pickLowCalorieRecommendations(${mealTime}): ${names.join(', ')}`
          );
        }
      }
    });

    test('E2E-F5-T1-04: pickRecommendationsByGaps deduplicates by food.name', () => {
      const gaps = TEN_NUTRIENTS.map((key, index) => ({
        key,
        value: 500,
        ratio: 0.9,
        score: 1.0 - index * 0.01,
        index
      }));
      const rng = createRng(909);
      for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
        for (let i = 0; i < 20; i++) {
          const recs = pickRecommendationsByGaps(gaps, mealTime, { maxCount: 10, goal: 'maintain', rng });
          const names = recs.map(f => f.name);
          assert.equal(
            new Set(names).size,
            names.length,
            `Duplicate names in pickRecommendationsByGaps(${mealTime}): ${names.join(', ')}`
          );
        }
      }
    });

    test('E2E-F5-T1-05: highVitaminA tag identifies clear positives and recommends safe VitA foods', () => {
      const vitAPool = findFoodsByTag('highVitaminA');
      assert.ok(vitAPool.length > 0, 'findFoodsByTag("highVitaminA") must be non-empty');
      for (const id of ['041201', '045301']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f, `Expected ${id} in TAGGED_FOODS`);
        assert.equal(hasTag(f, 'highVitaminA'), true, `${id} ${f.name} should have highVitaminA`);
      }
      const recs = pickRecommendationsByGaps(
        [{ key: 'vitaminA', value: 500, ratio: 0.8, score: 0.8, index: 0 }],
        'lunch',
        { maxCount: 3, rng: createRng(111) }
      );
      assert.ok(recs.length > 0);
      assert.ok(recs.some(f => hasTag(f, 'highVitaminA')));
    });

    test('E2E-F5-T1-06: zincRich tag identifies clear positives and recommends safe Zinc foods', () => {
      const zincPool = findFoodsByTag('zincRich');
      assert.ok(zincPool.length > 0, 'findFoodsByTag("zincRich") must be non-empty');
      for (const id of ['124109', '124108', '011204']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f, `Expected ${id} in TAGGED_FOODS`);
        assert.equal(hasTag(f, 'zincRich'), true, `${id} ${f.name} should have zincRich`);
      }
      const recs = pickRecommendationsByGaps(
        [{ key: 'zinc', value: 8, ratio: 0.8, score: 0.8, index: 0 }],
        'dinner',
        { maxCount: 3, rng: createRng(222) }
      );
      assert.ok(recs.length > 0);
      assert.ok(recs.some(f => hasTag(f, 'zincRich')));
    });
  });

  // --------------------------------------------------------------------------
  // F6: searchFoods 同义词与分词检索
  // --------------------------------------------------------------------------
  describe('F6 — searchFoods 同义词与分词检索', () => {
    test('E2E-F6-T1-01: core protein/egg/fat synonyms hit real FOODS entries', () => {
      assert.ok(searchFoods('鸡胸肉').some(f => f.name.includes('鸡胸脯肉')));
      assert.ok(searchFoods('牛油果').some(f => f.name.includes('鳄梨')));
      assert.ok(searchFoods('水煮蛋').some(f => f.name.includes('鸡蛋（煮）')));
    });

    test('E2E-F6-T1-02: nut, oat, and tofu synonyms hit real FOODS entries', () => {
      assert.ok(searchFoods('巴旦木').some(f => f.name.includes('杏仁')));
      assert.ok(searchFoods('燕麦片').some(f => f.name.includes('燕麦')));
      assert.ok(searchFoods('嫩豆腐').some(f => f.name.includes('豆腐')));
    });

    test('E2E-F6-T1-03: produce synonyms (圣女果/小番茄/奇异果/橙子/红枣) hit real FOODS entries', () => {
      assert.ok(searchFoods('圣女果').some(f => f.name.includes('樱桃番茄')));
      assert.ok(searchFoods('小番茄').some(f => f.name.includes('樱桃番茄')));
      assert.ok(searchFoods('奇异果').some(f => f.name.includes('猕猴桃')));
      assert.ok(searchFoods('橙子').some(f => f.name.startsWith('橙')));
      assert.ok(searchFoods('红枣').some(f => f.name.includes('枣')));
    });

    test('E2E-F6-T1-04: multi-token space-separated AND search matches expected entries', () => {
      const boiledEgg = searchFoods('鸡蛋 煮');
      assert.ok(boiledEgg.some(f => f.id === '111204'));
      for (const f of boiledEgg) {
        assert.ok(f.name.includes('鸡蛋') && f.name.includes('煮'), `AND mismatch: ${f.name}`);
      }
      assert.ok(searchFoods('鸡 胸').some(f => f.id === '091112'));
      assert.ok(searchFoods('杏仁 烤').some(f => f.name.includes('杏仁') && f.name.includes('烤')));
    });

    test('E2E-F6-T1-05: ranking prioritizes exact > prefix > substring/synonym', () => {
      const tofu = searchFoods('豆腐');
      assert.ok(tofu.length > 1);
      assert.ok(tofu[0].name.startsWith('豆腐'));
      const nonPrefixIdx = tofu.findIndex(f => !f.name.startsWith('豆腐'));
      if (nonPrefixIdx !== -1) {
        assert.ok(tofu.slice(0, nonPrefixIdx).every(f => f.name.includes('豆腐')));
      }

      const egg = searchFoods('鸡蛋');
      assert.ok(egg.length > 1);
      assert.ok(egg[0].name.startsWith('鸡蛋'));
    });

    test('E2E-F6-T1-06: case-insensitive ASCII search and default/explicit limit enforcement', () => {
      const upper = searchFoods('FAT89G');
      const lower = searchFoods('fat89g');
      assert.deepEqual(upper.map(f => f.id), lower.map(f => f.id));
      assert.equal(searchFoods('肉', 10).length, 10);
      assert.equal(searchFoods('肉').length, 50);
    });
  });

  // --------------------------------------------------------------------------
  // F7: adviceCopy.js 食物名清理、10 营养素与文案规范
  // --------------------------------------------------------------------------
  describe('F7 — adviceCopy.js 食物名清理与 10 营养素文案', () => {
    test('E2E-F7-T1-01: NUTRIENT_UNITS and NUTRIENT_COPY cover all 10 nutrients across goals and meals', () => {
      assert.deepEqual(Object.keys(NUTRIENT_UNITS).sort(), [...TEN_NUTRIENTS].sort());
      for (const key of TEN_NUTRIENTS) {
        if (key === 'vitaminA') {
          assert.match(String(NUTRIENT_UNITS[key]), /^μg(\s*RAE)?$/i, `Unit mismatch for ${key}`);
        } else {
          assert.equal(NUTRIENT_UNITS[key], EXPECTED_UNITS[key], `Unit mismatch for ${key}`);
        }
      }
      for (const goal of ['lose', 'maintain', 'gain']) {
        for (const key of TEN_NUTRIENTS) {
          assert.ok(NUTRIENT_COPY[goal]?.[key], `Missing NUTRIENT_COPY.${goal}.${key}`);
          for (const meal of ['breakfast', 'lunch', 'dinner', 'snack']) {
            const lines = NUTRIENT_COPY[goal][key][meal];
            assert.ok(Array.isArray(lines) && lines.length >= 2, `${goal}.${key}.${meal} needs >= 2 lines`);
            for (const line of lines) {
              assert.ok(line.includes('{gap}'), `${goal}.${key}.${meal} missing {gap}: ${line}`);
            }
          }
        }
      }
    });

    test('E2E-F7-T1-02: adviceCopy.js has zero unsearchable food denylist hits and all specific foods exist via searchFoods', () => {
      const allStrings = [];
      for (const state of ['over', 'near', 'gap']) {
        for (const goal of ['lose', 'maintain', 'gain']) {
          allStrings.push(...normalizeCopyPool(CALORIE_COPY[state]?.[goal]));
        }
      }
      for (const goal of ['lose', 'maintain', 'gain']) {
        for (const key of Object.keys(NUTRIENT_COPY[goal] || {})) {
          for (const meal of Object.keys(NUTRIENT_COPY[goal][key] || {})) {
            allStrings.push(...(NUTRIENT_COPY[goal][key][meal] || []));
          }
        }
        allStrings.push(...(HABIT_COPY[goal] || []));
      }

      for (const line of allStrings) {
        let matchedSearchableBread = false;
        for (const banned of UNSEARCHABLE_FOOD_DENYLIST) {
          if (line.includes(banned)) {
            assert.ok(
              searchFoods(banned).length > 0,
              `Unsearchable food "${banned}" found in: "${line}"`
            );
            if (banned.includes('面包')) {
              matchedSearchableBread = true;
            }
          }
        }
        if (/面包(?!鱼)/.test(line) && !matchedSearchableBread) {
          assert.ok(
            searchFoods('面包').some(f => !f.name.includes('面包鱼')),
            `Unsearchable "面包" found in: "${line}"`
          );
        }
        for (const term of SPECIFIC_FOOD_TERMS) {
          if (line.includes(term)) {
            assert.ok(
              searchFoods(term).length > 0,
              `Food term "${term}" mentioned in adviceCopy ("${line}") does not resolve via searchFoods()`
            );
          }
        }
      }
    });

    test('E2E-F7-T1-03: 100% of adviceCopy.js strings pass ai-advice-prompt.md compliance rules', () => {
      for (const state of ['over', 'near', 'gap']) {
        for (const goal of ['lose', 'maintain', 'gain']) {
          for (const line of normalizeCopyPool(CALORIE_COPY[state]?.[goal])) {
            assertAiPromptCompliance(line, `CALORIE_COPY.${state}.${goal}`);
          }
        }
      }
      for (const goal of ['lose', 'maintain', 'gain']) {
        for (const [key, meals] of Object.entries(NUTRIENT_COPY[goal] || {})) {
          for (const [meal, lines] of Object.entries(meals || {})) {
            for (const line of lines || []) {
              assertAiPromptCompliance(line, `NUTRIENT_COPY.${goal}.${key}.${meal}`);
            }
          }
        }
        for (const line of HABIT_COPY[goal] || []) {
          assertAiPromptCompliance(line, `HABIT_COPY.${goal}`);
        }
      }
    });

    test('E2E-F7-T1-04: every CALORIE_COPY[state][goal] has >= 2 non-evening lines for morning/lunch', () => {
      for (const state of ['over', 'near', 'gap']) {
        for (const goal of ['lose', 'maintain', 'gain']) {
          const lines = normalizeCopyPool(CALORIE_COPY[state]?.[goal]);
          const nonEvening = lines.filter(l => !EVENING_ONLY_RE.test(l));
          assert.ok(
            nonEvening.length >= 2,
            `CALORIE_COPY.${state}.${goal} only has ${nonEvening.length} non-evening lines`
          );
        }
      }
    });

    test('E2E-F7-T1-05: HABIT_COPY has >= 15 distinct concise lines per goal with zero placeholders', () => {
      for (const goal of ['lose', 'maintain', 'gain']) {
        const habits = HABIT_COPY[goal] || [];
        assert.ok(habits.length >= 15, `HABIT_COPY.${goal} length=${habits.length}`);
        assert.equal(new Set(habits).size, habits.length);
        for (const h of habits) {
          assert.ok(h.length <= 25, `Habit too long (${h.length}): ${h}`);
          assert.equal(/\{[^}]+\}/.test(h), false, `Habit must not have placeholders: ${h}`);
        }
      }
    });

    test('E2E-F7-T1-06: placeholder domain isolation across CALORIE_COPY and NUTRIENT_COPY', () => {
      for (const state of ['over', 'near', 'gap']) {
        for (const goal of ['lose', 'maintain', 'gain']) {
          for (const line of normalizeCopyPool(CALORIE_COPY[state]?.[goal])) {
            assert.equal(line.includes('{gap}'), false, `CALORIE_COPY must not use {gap}: ${line}`);
          }
        }
      }
      for (const goal of ['lose', 'maintain', 'gain']) {
        for (const meals of Object.values(NUTRIENT_COPY[goal] || {})) {
          for (const lines of Object.values(meals || {})) {
            for (const line of lines || []) {
              assert.equal(line.includes('{remaining}'), false, `NUTRIENT_COPY must not use {remaining}: ${line}`);
              assert.equal(line.includes('{pct}'), false, `NUTRIENT_COPY must not use {pct}: ${line}`);
            }
          }
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // F8: advice.js 建议引擎修复
  // --------------------------------------------------------------------------
  describe('F8 — advice.js 建议引擎修复', () => {
    test('E2E-F8-T1-01: computeNutrientGaps covers all 10 nutrients including vitaminA and zinc', () => {
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      const allGaps = computeNutrientGaps(EMPTY_TOTALS, targets);
      const keys = allGaps.map(g => g.key);
      for (const k of TEN_NUTRIENTS) {
        assert.ok(keys.includes(k), `Missing nutrient ${k} in computeNutrientGaps`);
      }

      const vitAOnly = computeNutrientGaps({ ...targets, vitaminA: 0 }, targets);
      assert.deepEqual(vitAOnly.map(g => g.key), ['vitaminA']);

      const zincOnly = computeNutrientGaps({ ...targets, zinc: 0 }, targets);
      assert.deepEqual(zincOnly.map(g => g.key), ['zinc']);
    });

    test('E2E-F8-T1-02: breakfast and lunch never output evening-only calorie summary lines', () => {
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      const totalsByState = {
        gap: { ...EMPTY_TOTALS, calories: Math.round(targets.calories * 0.4) },
        near: { ...EMPTY_TOTALS, calories: Math.round(targets.calories * 0.92) },
        over: { ...EMPTY_TOTALS, calories: targets.calories + 250 }
      };
      for (const goal of ['lose', 'maintain', 'gain']) {
        const t = { ...targets, goal };
        for (const [state, tot] of Object.entries(totalsByState)) {
          for (const mealTime of ['breakfast', 'lunch']) {
            for (let i = 0; i < 40; i++) {
              const adv = generateAdvice(tot, t, { mealTime, seed: `${state}-${goal}-${mealTime}-${i}` });
              assert.equal(
                EVENING_ONLY_RE.test(adv.summary[0]),
                false,
                `Evening copy in ${mealTime}/${state}/${goal}: "${adv.summary[0]}"`
              );
            }
          }
        }
      }
    });

    test('E2E-F8-T1-03: ensureNutrientPrefix keeps nutrient subject in leading clause for all 10 nutrients', () => {
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      for (const key of TEN_NUTRIENTS) {
        const totals = { ...targets, calories: Math.round(targets.calories * 0.5), [key]: 0 };
        const aliases = NUTRIENT_MATCH_ALIASES[key];
        for (const goal of ['lose', 'maintain', 'gain']) {
          const t = { ...targets, goal };
          for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
            for (let i = 0; i < 20; i++) {
              const adv = generateAdvice(totals, t, { mealTime, seed: `prefix-${key}-${goal}-${mealTime}-${i}` });
              assert.ok(adv.summary.length >= 2, `Expected nutrient gap line for ${key}`);
              const line = adv.summary[1];
              assert.equal(/^缺口/.test(line), false, `Missing nutrient subject prefix (${key}): "${line}"`);
              const leadingClause = line.split(/[，,]/)[0];
              assert.ok(
                aliases.some(a => leadingClause.includes(a)),
                `Leading clause "${leadingClause}" missing ${key} subject (${aliases.join('/')})`
              );
            }
          }
        }
      }
    });

    test('E2E-F8-T1-04: generateAdvice returns { summary, recommendations, habits, calorieState } deterministically', () => {
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      const a1 = generateAdvice(EMPTY_TOTALS, targets, { mealTime: 'lunch', seed: 'det-1' });
      const a2 = generateAdvice(EMPTY_TOTALS, targets, { mealTime: 'lunch', seed: 'det-1' });
      assert.deepEqual(a1, a2);
      assert.equal(a1.calorieState, 'gap');
      assert.equal(a1.habits.length, 2);
      assert.ok(a1.habits.every(h => HABIT_COPY.lose.includes(h)));

      const nearAdv = generateAdvice({ ...EMPTY_TOTALS, calories: targets.calories - 50 }, targets, { mealTime: 'dinner', seed: 'det-2' });
      assert.equal(nearAdv.calorieState, 'near');

      const overAdv = generateAdvice({ ...EMPTY_TOTALS, calories: targets.calories + 100 }, targets, { mealTime: 'dinner', seed: 'det-3' });
      assert.equal(overAdv.calorieState, 'over');
    });

    test('E2E-F8-T1-05: over calorieState suppresses gap lines and returns deduplicated <=100kcal recommendations', () => {
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      const overTotals = { ...EMPTY_TOTALS, calories: targets.calories + 250 };
      for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
        for (let i = 0; i < 10; i++) {
          const adv = generateAdvice(overTotals, targets, { mealTime, seed: `over-${mealTime}-${i}` });
          assert.equal(adv.calorieState, 'over');
          assert.equal(adv.summary.length, 1);
          assert.ok(adv.recommendations.length > 0);
          const names = adv.recommendations.map(r => r.name);
          assert.equal(new Set(names).size, names.length);
          for (const rec of adv.recommendations) {
            const found = getFoodById(rec.id);
            assert.ok(found);
            assert.equal(found.name, rec.name);
            assert.ok(found.calories <= 100, `Over recommendation > 100 kcal: ${found.name} (${found.calories})`);
          }
        }
      }
    });

    test('E2E-F8-T1-06: placeholders resolve cleanly with % and μg/mg units', () => {
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      for (const goal of ['lose', 'maintain', 'gain']) {
        const t = { ...targets, goal };
        for (let i = 0; i < 30; i++) {
          const adv = generateAdvice(
            { ...EMPTY_TOTALS, calories: Math.round(t.calories * 0.9), vitaminA: 0, zinc: 0 },
            t,
            { mealTime: 'lunch', seed: `ph-${goal}-${i}` }
          );
          for (const line of adv.summary) {
            assert.equal(/\{[a-zA-Z]+\}/.test(line), false, `Unresolved placeholder: ${line}`);
            if (line.includes('完成度')) assert.match(line, /\d+%/);
          }
        }
      }
      const vitAOnly = generateAdvice({ ...targets, calories: targets.calories * 0.5, vitaminA: 0 }, targets, { mealTime: 'lunch', seed: 'unit-va' });
      assert.match(vitAOnly.summary[1], /\d+\s*μg/);
      const zincOnly = generateAdvice({ ...targets, calories: targets.calories * 0.5, zinc: 0 }, targets, { mealTime: 'lunch', seed: 'unit-zn' });
      assert.match(zincOnly.summary[1], /\d+\s*mg/);
    });
  });

  // --------------------------------------------------------------------------
  // F9: records.js 存储失败传递与精确累加
  // --------------------------------------------------------------------------
  describe('F9 — records.js 存储失败传递与精确累加', () => {
    test('E2E-F9-T1-01: saveRecord returns updated Record[] on normal write', () => {
      withWxMock();
      const day = '2026-11-24';
      const r1 = records.saveRecord(buildRecordInput('111204', 100, '早餐', day));
      assert.ok(Array.isArray(r1) && r1.length === 1);
      assert.equal(typeof r1[0].id, 'string');
      assert.ok(r1[0].id.length > 0);
      assert.equal(r1[0].dateKey, day);

      const r2 = records.saveRecord(buildRecordInput('091112', 120, '午餐', day));
      assert.ok(Array.isArray(r2) && r2.length === 2);
      assert.equal(records.loadDayRecords(day).length, 2);
    });

    test('E2E-F9-T1-02: deleteRecord returns updated Record[] on normal write', () => {
      withWxMock();
      const day = '2026-11-24';
      records.saveRecord(buildRecordInput('111204', 100, '早餐', day));
      const two = records.saveRecord(buildRecordInput('091112', 120, '午餐', day));
      const afterDel = records.deleteRecord(day, two[0].id);
      assert.ok(Array.isArray(afterDel) && afterDel.length === 1);
      assert.equal(afterDel[0].id, two[1].id);
    });

    test('E2E-F9-T1-03: saveRecord returns strictly false when wx.setStorageSync throws', () => {
      const wxMock = withWxMock();
      const day = '2026-11-24';
      records.saveRecord(buildRecordInput('111204', 100, '早餐', day));
      wxMock.setThrowOnSet(new Error('write fail'));
      const res = records.saveRecord(buildRecordInput('091112', 120, '午餐', day));
      assert.strictEqual(res, false);
      assert.equal(records.loadDayRecords(day).length, 1);
    });

    test('E2E-F9-T1-04: deleteRecord returns strictly false when wx.setStorageSync throws', () => {
      const wxMock = withWxMock();
      const day = '2026-11-24';
      const saved = records.saveRecord(buildRecordInput('111204', 100, '早餐', day));
      wxMock.setThrowOnSet(new Error('write fail'));
      const res = records.deleteRecord(day, saved[0].id);
      assert.strictEqual(res, false);
      assert.equal(records.loadDayRecords(day).length, 1);
    });

    test('E2E-F9-T1-05: calcTotalsFromRecords sums raw values before rounding once', () => {
      const items = [1, 2, 3].map(() => ({
        calories: 100.4,
        protein: 1.04,
        carbs: 1.04,
        fat: 1.04,
        fiber: 1.04,
        vitaminA: 1.04,
        vitaminC: 1.04,
        calcium: 1.04,
        magnesium: 1.04,
        iron: 1.004,
        zinc: 1.004
      }));
      const totals = records.calcTotalsFromRecords(items);
      assert.deepEqual(totals, {
        calories: 301,
        protein: 3.1,
        carbs: 3.1,
        fat: 3.1,
        fiber: 3.1,
        vitaminA: 3.1,
        vitaminC: 3.1,
        calcium: 3.1,
        magnesium: 3.1,
        iron: 3.01,
        zinc: 3.01
      });
    });
  });

  // --------------------------------------------------------------------------
  // F10: tdee.js 边界与输入保护
  // --------------------------------------------------------------------------
  describe('F10 — tdee.js 边界与输入保护', () => {
    test('E2E-F10-T1-01: calcBMR computes Mifflin-St Jeor accurately for male and female', () => {
      assert.equal(calcBMR({ gender: 'male', age: 30, heightCm: 175, weightKg: 70 }), 1649);
      assert.equal(calcBMR({ gender: 'female', age: 28, heightCm: 162, weightKg: 55 }), 1262);
    });

    test('E2E-F10-T1-02: calcTargets computes TDEE, goal calories, macro ratios, and DRIs', () => {
      const gain = calcTargets(BOUNDARY_PROFILES.maleGain);
      assert.equal(gain.goal, 'gain');
      assert.equal(gain.tdee, Math.round(gain.bmr * ACTIVITY_FACTORS.moderate));
      assert.equal(gain.calories, gain.tdee + GOAL_ADJUSTMENTS.gain);
      assert.equal(gain.clamped, false);
      assert.equal(gain.zinc, 12.5);
    });

    test('E2E-F10-T1-03: calcBMR and calcTargets return null for non-finite / non-positive / null inputs', () => {
      const badProfiles = [
        null,
        undefined,
        {},
        { gender: 'female', age: NaN, heightCm: 160, weightKg: 50 },
        { gender: 'female', age: 25, heightCm: Infinity, weightKg: 50 },
        { gender: 'female', age: 25, heightCm: 160, weightKg: -Infinity },
        { gender: 'female', age: 0, heightCm: 160, weightKg: 50 },
        { gender: 'female', age: 25, heightCm: -160, weightKg: 50 },
        { gender: 'female', age: 25, heightCm: 160, weightKg: 0 }
      ];
      for (const p of badProfiles) {
        assert.strictEqual(calcBMR(p), null, `calcBMR should return null for ${JSON.stringify(p)}`);
        assert.strictEqual(calcTargets(p), null, `calcTargets should return null for ${JSON.stringify(p)}`);
      }
    });

    test('E2E-F10-T1-04: TDEE < 1200 with lose goal yields calories <= tdee (never 1200)', () => {
      const t = calcTargets(BOUNDARY_PROFILES.tdee1187);
      assert.ok(t);
      assert.equal(t.tdee, 1187);
      assert.ok(t.calories > 0 && t.calories <= t.tdee, `Expected calories <= 1187, got ${t.calories}`);
    });

    test('E2E-F10-T1-05: TDEE >= 1200 with lose goal whose raw < 1200 clamps to MIN_CALORIES (1200)', () => {
      const t = calcTargets(BOUNDARY_PROFILES.tdee1330);
      assert.ok(t);
      assert.equal(t.tdee, 1330);
      assert.equal(t.calories, MIN_CALORIES);
      assert.equal(t.clamped, true);
    });

    test('E2E-F10-T1-06: macro targets derive consistently from final targets.calories', () => {
      const t = calcTargets(BOUNDARY_PROFILES.tdee1187);
      assert.equal(t.protein, Math.round(t.calories * 0.30 / 4));
      assert.equal(t.carbs, Math.round(t.calories * 0.40 / 4));
      assert.equal(t.fat, Math.round(t.calories * 0.30 / 9));
    });
  });

  // --------------------------------------------------------------------------
  // F11: app.js & record.js 跨页状态同步与前后台恢复
  // --------------------------------------------------------------------------
  describe('F11 — app.js & record.js 跨页与前后台状态同步', () => {
    test('E2E-F11-T1-01: app.onLaunch initializes globalData contract keys and exposes onHide/onShow', () => {
      const h = createMiniProgramHarness();
      for (const key of [
        'profile', 'targets', 'pendingFoodId', 'pendingSearch',
        'pendingDateKey', 'pendingTodayDateKey', 'resumedRoute'
      ]) {
        assert.ok(key in h.app.globalData, `app.globalData missing contract key "${key}"`);
      }
      assert.equal(typeof h.app.onHide, 'function');
      assert.equal(typeof h.app.onShow, 'function');
    });

    test('E2E-F11-T1-02: record.wxml backfill banner exposes a bindtap exit-backfill action', () => {
      const wxml = loadWxml('pages/record/record.wxml');
      const handler = discoverWxmlTapHandler(
        wxml,
        { isBackfill: true, recordDateKey: '2026-11-23', hasKeyword: false, results: [], selectedFood: null, showToast: false },
        /切回今天|退出补记|回到今天|返回今天/
      );
      assert.ok(handler, 'record.wxml backfill banner must expose a bindtap handler to exit backfill');
    });

    test('E2E-F11-T1-03: today.navToRecord passes dateKey and activates backfill on yesterday', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T09:00:00') });
      const h = createMiniProgramHarness();
      h.pages.today.onPrevDay();
      assert.equal(h.pages.today.data.dateKey, '2026-11-23');
      h.pages.today.navToRecord();
      assert.equal(h.app.globalData.pendingDateKey, '2026-11-23');
      h.switchTab('record');
      assert.equal(h.pages.record.data.recordDateKey, '2026-11-23');
      assert.equal(h.pages.record.data.isBackfill, true);
    });

    test('E2E-F11-T1-04: record.navToToday sets pendingTodayDateKey and today.onShow consumes it', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T09:00:00') });
      const h = createMiniProgramHarness();
      h.pages.today.onPrevDay();
      assert.equal(h.pages.today.data.dateKey, '2026-11-23');
      h.switchTab('record');
      assert.equal(h.pages.record.data.recordDateKey, '2026-11-24');
      h.pages.record.navToToday();
      assert.equal(h.app.globalData.pendingTodayDateKey, '2026-11-24');
      h.switchTab('today');
      assert.equal(h.pages.today.data.dateKey, '2026-11-24');
      assert.equal(h.pages.today.data.isToday, true);
      assert.equal(h.app.globalData.pendingTodayDateKey, null);
    });

    test('E2E-F11-T1-05: today.onTapRecommend preloads food modal on record and clears pending flags', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T09:00:00') });
      const h = createMiniProgramHarness();
      h.pages.today.onTapRecommend({
        currentTarget: { dataset: { id: '111204', name: '鸡蛋（煮）' } }
      });
      h.switchTab('record');
      assert.ok(h.pages.record.data.selectedFood);
      assert.equal(h.pages.record.data.selectedFood.id, '111204');
      assert.equal(h.app.globalData.pendingFoodId, null);
      assert.equal(h.app.globalData.pendingSearch, null);
      assert.equal(h.app.globalData.pendingDateKey, null);
    });
  });

  // --------------------------------------------------------------------------
  // F12: record.js 搜索防抖、中断恢复、实时预览与写失败处理
  // --------------------------------------------------------------------------
  describe('F12 — record.js 搜索防抖与弹窗实时预览', () => {
    test('E2E-F12-T1-01: debounced search returns results after 150ms tick', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T09:00:00') });
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');
      rec.onInput({ detail: { value: '鸡蛋' } });
      assert.equal(rec.data.results.length, 0);
      t.mock.timers.tick(150);
      assert.ok(rec.data.results.length > 0);
      assert.ok(rec.data.results[0].name.startsWith('鸡蛋'));
    });

    test('E2E-F12-T1-02: record.wxml modal binds live scaled preview values beyond /100g', () => {
      const wxml = loadWxml('pages/record/record.wxml');
      const ast = parseWxml(wxml);
      const modalNodes = findVNodes(ast, n => hasClass(n, 'modal'));
      assert.ok(modalNodes.length > 0, 'record.wxml must contain a .modal node');

      const bindings = [];
      const collectBindings = node => {
        if (!node) return;
        if (node.type === 'text') {
          const matches = String(node.text || '').match(/\{\{[^}]*\}\}/g);
          if (matches) bindings.push(...matches);
          return;
        }
        for (const val of Object.values(node.attrs || {})) {
          if (typeof val === 'string') {
            const matches = val.match(/\{\{[^}]*\}\}/g);
            if (matches) bindings.push(...matches);
          }
        }
        for (const ch of node.children || []) {
          collectBindings(ch);
        }
      };
      collectBindings(modalNodes[0]);

      const dynamicBindings = bindings.filter(expr => {
        const inner = expr.slice(2, -2).trim();
        if (!inner) return false;
        if (inner === 'selectedFood') return false;
        if (/^selectedFood\.[a-zA-Z0-9_]+$/.test(inner)) return false;
        if (
          inner === 'MEAL_OPTIONS' ||
          inner === 'mealIndex' ||
          inner === 'MEAL_OPTIONS[mealIndex]' ||
          inner === 'grams' ||
          inner === 'gramsInput' ||
          inner === 'DEFAULT_PORTIONS' ||
          inner === 'item' ||
          /^grams\s*===\s*item\b/.test(inner)
        ) {
          return false;
        }
        return true;
      });
      assert.ok(
        dynamicBindings.length > 0,
        'record.wxml modal lacks dynamic preview nutrient bindings beyond static selectedFood.* / 100g'
      );
    });

    test('E2E-F12-T1-03: onGramsInput and onPortionTap update rendered modal live preview nutrients', () => {
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');
      const egg = getFoodById('111204');
      const wxml = loadWxml('pages/record/record.wxml');
      rec.onSelectFood({ currentTarget: { dataset: { id: egg.id } } });

      rec.onGramsInput({ detail: { value: '200' } });
      const n200 = calcNutrients(egg, 200);
      const tree200 = renderWxml(wxml, rec.data);
      const modal200 = findVNodes(tree200, n => hasClass(n, 'modal'))[0];
      const text200 = getVNodeText(modal200);
      assert.ok(
        text200.includes(String(n200.calories)) && text200.includes(String(n200.protein)),
        `Rendered modal should show 200g preview (${n200.calories} kcal, ${n200.protein}g protein), got: ${text200}`
      );

      rec.onPortionTap({ currentTarget: { dataset: { value: 50 } } });
      const n50 = calcNutrients(egg, 50);
      const tree50 = renderWxml(wxml, rec.data);
      const modal50 = findVNodes(tree50, n => hasClass(n, 'modal'))[0];
      const text50 = getVNodeText(modal50);
      assert.ok(
        text50.includes(String(n50.calories)) && text50.includes(String(n50.protein)),
        `Rendered modal should show 50g preview (${n50.calories} kcal, ${n50.protein}g protein), got: ${text50}`
      );
    });

    test('E2E-F12-T1-04: onSave persists scaled record, closes modal, and shows 已记录 toast', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T08:30:00') });
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');
      rec.onSelectFood({ currentTarget: { dataset: { id: '111204' } } });
      rec.onGramsInput({ detail: { value: '150' } });
      rec.onSave();

      const dayRecs = h.wxMock.store.records['2026-11-24'];
      assert.equal(dayRecs.length, 1);
      assert.equal(dayRecs[0].grams, 150);
      assert.equal(dayRecs[0].calories, calcNutrients(getFoodById('111204'), 150).calories);
      assert.equal(rec.data.selectedFood, null);
      assert.equal(rec.data.showToast, true);
      assert.match(rec.data.toastMessage, /已记录/);
    });

    test('E2E-F12-T1-05: onSave does not report 已记录 when storage write fails', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T08:30:00') });
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');
      rec.onSelectFood({ currentTarget: { dataset: { id: '111204' } } });
      h.wxMock.setThrowOnSet(new Error('QuotaExceededError'));
      rec.onSave();

      assert.equal(rec.data.showToast && rec.data.toastMessage.includes('已记录'), false);
      assert.ok(
        h.wxMock.toasts.some(x => /失败|重试|空间/.test(x.title || '')) ||
        (rec.data.showToast && /失败|重试|空间/.test(rec.data.toastMessage || '')),
        'Expected failure toast via wx.showToast or page toast when saveRecord returns false'
      );
    });
  });

  // --------------------------------------------------------------------------
  // F13: today 同步、超标视觉、种子与推荐副标题
  // --------------------------------------------------------------------------
  describe('F13 — today 同步、超标视觉、种子与推荐副标题', () => {
    test('E2E-F13-T1-01: today.onShow builds 4 macroList and 6 microList items (with vitaminA & zinc)', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T12:00:00') });
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      const h = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
      });
      const today = h.pages.today;
      assert.equal(today.data.targets.calories, targets.calories);
      assert.equal(today.data.macroList.length, 4);
      assert.equal(today.data.microList.length, 6);
      assert.equal(today.data.microList.find(m => m.key === 'vitaminA').unit, 'μg');
      assert.equal(today.data.microList.find(m => m.key === 'zinc').unit, 'mg');
    });

    test('E2E-F13-T1-02: today.wxml suppresses 推荐补充 when calorieState === over', () => {
      const wxml = loadWxml('pages/today/today.wxml');
      const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
      const baseData = {
        targets,
        isToday: true,
        dateStr: '11月24日 · 今天',
        totals: { ...EMPTY_TOTALS, calories: targets.calories + 300 },
        macroList: [],
        microList: [],
        records: [],
        advice: {
          calorieState: 'over',
          summary: ['热量已超出目标。'],
          recommendations: [{ id: '045301', name: '菠菜（鲜）' }],
          habits: ['多喝水']
        }
      };
      const overTree = renderWxml(wxml, baseData);
      const overCard = findVNodes(overTree, n => hasClass(n, 'advice-card'))[0];
      assert.equal(getVNodeText(overCard).includes('推荐补充'), false, 'over state must not display 推荐补充');

      const gapTree = renderWxml(wxml, {
        ...baseData,
        totals: { ...EMPTY_TOTALS, calories: 400 },
        advice: { ...baseData.advice, calorieState: 'gap' }
      });
      const gapCard = findVNodes(gapTree, n => hasClass(n, 'advice-card'))[0];
      assert.equal(getVNodeText(gapCard).includes('推荐补充'), true, 'gap state with recs should display 推荐补充');
    });

    test('E2E-F13-T1-03: today.refresh passes seed containing targets.calories and gap signature', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T12:00:00') });
      const seenCalls = [];
      let origGenerate = null;
      const h = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1500 },
        beforeLoad() {
          const adviceMod = require(MODULE_PATHS.advice);
          origGenerate = adviceMod.generateAdvice;
          require.cache[require.resolve(MODULE_PATHS.advice)].exports.generateAdvice = (...args) => {
            seenCalls.push(args);
            return origGenerate(...args);
          };
        },
        afterCleanup() {
          if (origGenerate && require.cache[require.resolve(MODULE_PATHS.advice)]) {
            require.cache[require.resolve(MODULE_PATHS.advice)].exports.generateAdvice = origGenerate;
          }
        }
      });
      assert.ok(seenCalls.length > 0);
      const lastOpts = seenCalls[seenCalls.length - 1][2];
      assert.ok(
        String(lastOpts.seed).includes(String(h.pages.today.data.targets.calories)),
        `Expected seed "${lastOpts.seed}" to include targets.calories`
      );
    });

    test('E2E-F13-T1-04: today.wxml + today.wxss apply non-green over-target warning visuals', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T12:00:00') });
      const wxml = loadWxml('pages/today/today.wxml');
      const wxss = loadWxss('pages/today/today.wxss');
      const rules = parseWxssRules(wxss);
      const profile = BOUNDARY_PROFILES.tdee1500;
      const targets = calcTargets(profile);
      const dateKey = '2026-11-24';

      const normalRec1 = buildRecordInput('091112', 200, '午餐', dateKey);
      const normalRec2 = buildRecordInput('111204', 150, '早餐', dateKey);
      const h = createMiniProgramHarness({
        initialStore: {
          profile,
          records: { [dateKey]: [normalRec1, normalRec2] }
        }
      });
      h.pages.today.onShow();
      const normalData = structuredClone(h.pages.today.data);
      assert.ok(normalData.totals.calories < targets.calories, 'normal fixture must be under calorie target');
      assert.ok(normalData.macroList.every(m => m.value <= m.target), 'normal fixture must be under all macro targets');
      const normalTree = renderWxml(wxml, normalData);

      const overRec = buildRecordInput('091112', 1200, '午餐', dateKey);
      h.wxMock.store.records[dateKey] = [overRec];
      h.pages.today.refresh(targets, dateKey);
      const overData = structuredClone(h.pages.today.data);
      assert.ok(overData.totals.calories > targets.calories, 'over fixture must exceed calorie target');
      assert.ok(overData.totals.protein > targets.protein, 'over fixture must exceed protein target');
      const overTree = renderWxml(wxml, overData);

      const collectClasses = (tree, rootCls) => {
        const roots = findVNodes(tree, n => hasClass(n, rootCls));
        const classes = new Set();
        for (const root of roots) {
          findVNodes(root, n => {
            for (const c of String(n.attrs?.class || '').split(/\s+/).filter(Boolean)) classes.add(c);
            return false;
          });
        }
        return classes;
      };

      const calDiff = [...collectClasses(overTree, 'calorie-card')].filter(
        c => !collectClasses(normalTree, 'calorie-card').has(c)
      );
      const macroDiff = [...collectClasses(overTree, 'macro-row')].filter(
        c => !collectClasses(normalTree, 'macro-row').has(c)
      );
      assert.ok(calDiff.length > 0, 'Over-calorie render must add a distinct class inside .calorie-card');
      assert.ok(macroDiff.length > 0, 'Over-macro render must add a distinct class inside .macro-row');

      const NEUTRAL_OR_GREEN_VALUES = new Set([
        '#2f855a', '#f0fff4', '#4a5568', '#718096', '#a0aec0',
        '#cbd5e0', '#edf2f7', '#ffffff', '#fff', 'transparent',
        'none', 'inherit', 'initial', 'unset'
      ]);
      const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const isWarningColorDecl = body => {
        const decls = body.split(';').map(s => s.trim()).filter(Boolean);
        for (const decl of decls) {
          const colonIdx = decl.indexOf(':');
          if (colonIdx === -1) continue;
          const prop = decl.slice(0, colonIdx).trim().toLowerCase();
          if (!['color', 'background', 'background-color', 'border-color'].includes(prop)) {
            continue;
          }
          const rawVal = decl.slice(colonIdx + 1).replace(/!important/gi, '').trim().toLowerCase();
          if (!rawVal || NEUTRAL_OR_GREEN_VALUES.has(rawVal)) continue;
          const tokens = rawVal.split(/\s+/);
          if (tokens.every(tok => NEUTRAL_OR_GREEN_VALUES.has(tok))) continue;
          return true;
        }
        return false;
      };
      const hasWarningColorRule = diffClasses => rules.some(
        r => diffClasses.some(c => new RegExp(`\\.${escapeRe(c)}(?![a-zA-Z0-9_-])`).test(r.selector)) &&
          isWarningColorDecl(r.body)
      );
      assert.ok(hasWarningColorRule(calDiff), `today.wxss missing non-green warning rule for ${calDiff.join(',')}`);
      assert.ok(hasWarningColorRule(macroDiff), `today.wxss missing non-green warning rule for ${macroDiff.join(',')}`);
    });

    test('E2E-F13-T1-05: today.wxss .macro-value removes narrow 140rpx wrap constraint', () => {
      const wxss = loadWxss('pages/today/today.wxss');
      const rules = parseWxssRules(wxss).filter(r => r.selector.includes('.macro-value'));
      assert.ok(rules.length > 0);
      const combinedBody = rules.map(r => r.body).join('\n');
      assert.equal(/\bwidth:\s*140rpx\b/.test(combinedBody), false, '.macro-value still has fixed 140rpx width');
      assert.ok(
        /white-space:\s*nowrap/.test(combinedBody) ||
        /flex-shrink:\s*0/.test(combinedBody) ||
        /min-width:/.test(combinedBody) ||
        /width:\s*(?:1[7-9]\d|[2-9]\d\d)rpx/.test(combinedBody),
        `.macro-value needs wrap protection, got: ${combinedBody}`
      );
    });
  });

  // --------------------------------------------------------------------------
  // F14: profile 状态同步、取消回滚与低 TDEE 提示
  // --------------------------------------------------------------------------
  describe('F14 — profile 状态同步与低 TDEE 提示', () => {
    test('E2E-F14-T1-01: first-time profile save writes storage, updates globalData, and renders targets', () => {
      const h = createMiniProgramHarness();
      const p = h.switchTab('profile');
      p.onGenderChange({ detail: { value: 1 } });
      p.onInput({ currentTarget: { dataset: { field: 'age' } }, detail: { value: '30' } });
      p.onInput({ currentTarget: { dataset: { field: 'heightCm' } }, detail: { value: '165' } });
      p.onInput({ currentTarget: { dataset: { field: 'weightKg' } }, detail: { value: '53' } });
      p.onActivityChange({ detail: { value: 0 } });
      p.onGoalChange({ detail: { value: 0 } });
      p.onSave();

      assert.equal(h.wxMock.store.profile.weightKg, 53);
      assert.equal(h.app.globalData.targets.calories, p.data.targets.calories);
      assert.ok(h.wxMock.toasts.some(t => t.title === '已保存'));
    });

    test('E2E-F14-T1-02: profile.onShow exists and re-syncs form fields from storage', () => {
      const h = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
      });
      const p = h.switchTab('profile');
      assert.equal(typeof p.onShow, 'function', 'profile.js must implement onShow()');
      p.onInput({ currentTarget: { dataset: { field: 'weightKg' } }, detail: { value: '99' } });
      p.onGoalChange({ detail: { value: 2 } });
      p.onHide?.();
      p.onShow();
      assert.equal(p.data.weightKg, '53');
      assert.equal(p.data.goalIndex, 0);
    });

    test('E2E-F14-T1-03: confirming overwrite modal updates storage, targets, and globalData', () => {
      const h = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
      });
      const p = h.switchTab('profile');
      h.wxMock.setModalResponse({ confirm: true, cancel: false });
      p.onInput({ currentTarget: { dataset: { field: 'weightKg' } }, detail: { value: '60' } });
      p.onSave();

      assert.equal(h.wxMock.modals.length, 1);
      assert.equal(h.wxMock.store.profile.weightKg, 60);
      assert.equal(h.app.globalData.profile.weightKg, 60);
      assert.equal(p.data.targets.calories, calcTargets({ ...BOUNDARY_PROFILES.tdee1500, weightKg: 60 }).calories);
    });

    test('E2E-F14-T1-04: canceling overwrite modal rolls back modified form fields to saved profile', () => {
      const h = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
      });
      const p = h.switchTab('profile');
      h.wxMock.setModalResponse({ confirm: false, cancel: true });
      p.onInput({ currentTarget: { dataset: { field: 'weightKg' } }, detail: { value: '88' } });
      p.onGoalChange({ detail: { value: 2 } });
      p.onSave();

      assert.equal(h.wxMock.store.profile.weightKg, 53);
      assert.equal(p.data.weightKg, '53');
      assert.equal(p.data.goalIndex, 0);
    });

    test('E2E-F14-T1-05: profile.wxml does not display misleading 1200 kcal floor when TDEE < 1200', () => {
      const wxml = loadWxml('pages/profile/profile.wxml');
      const h = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1187 }
      });
      const p = h.switchTab('profile');
      const tree = renderWxml(wxml, p.data);
      const hintNodes = findVNodes(tree, n => hasClass(n, 'clamp-hint'));
      if (hintNodes.length > 0) {
        const text = getVNodeText(hintNodes[0]);
        assert.equal(
          /最低[^0-9]*1200\s*kcal|1200\s*kcal\s*兜底/.test(text),
          false,
          `TDEE=1187 notice must not claim 1200 kcal floor: "${text}"`
        );
      }
    });
  });

  // --------------------------------------------------------------------------
  // F16: CLAUDE.md 文档与架构一致性
  // --------------------------------------------------------------------------
  describe('F16 — CLAUDE.md 文档与架构一致性', () => {
    const claudeMd = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');

    test('E2E-F16-T1-01: CLAUDE.md documents node --test and tests/utils.test.js', () => {
      assert.equal(/没有[^。\n]*测试[^。\n]*命令/.test(claudeMd), false);
      assert.match(claudeMd, /node\s+--test/);
      assert.match(claudeMd, /tests\/utils\.test\.js/);
    });

    test('E2E-F16-T1-02: CLAUDE.md updates app.js globalData description beyond profile & targets', () => {
      assert.equal(claudeMd.includes('只保存 `profile` 和 `targets`'), false);
      assert.match(claudeMd, /pendingDateKey|pendingTodayDateKey|pendingFoodId/);
    });

    test('E2E-F16-T1-03: CLAUDE.md documents TDEE < 1200 behavior and DRI segments accurately', () => {
      assert.equal(claudeMd.includes('微量固定默认值'), false);
      assert.match(claudeMd, /1200/);
      assert.match(claudeMd, /TDEE|tdee/);
      assert.match(claudeMd, /DRI|分段|年龄段/);
    });

    test('E2E-F16-T1-04: CLAUDE.md documents categoryTags.js, foodTags.js lazy init, and searchFoods synonyms', () => {
      assert.match(claudeMd, /categoryTags\.js/);
      assert.match(claudeMd, /foodTags\.js/);
      assert.match(claudeMd, /惰性|按需|lazy/i);
      assert.match(claudeMd, /同义词|分词/);
      const countMatches = [...claudeMd.matchAll(/(\d{4})\s*条/g)];
      if (countMatches.length > 0) {
        assert.ok(
          countMatches.some(m => Number(m[1]) === FOODS.length),
          `Documented food count in CLAUDE.md must include ${FOODS.length}`
        );
      }
    });

    test('E2E-F16-T1-05: CLAUDE.md documents 10-nutrient adviceCopy/advice and removes obsolete plan section', () => {
      assert.match(claudeMd, /adviceCopy\.js/);
      assert.equal(claudeMd.includes('RECOMMENDATION_POOLS'), false);
      assert.equal(claudeMd.includes('enrichWithFoodInfo'), false);
      assert.equal(claudeMd.includes('合并后 `advice.js` 的 `generateAdvice()` 预期改为'), false);
      assert.match(claudeMd, /维生素\s*A|vitaminA/);
      assert.match(claudeMd, /锌|zinc/);
    });
  });
});

// ============================================================================
// TIER 2: Boundary, Negative & Corner Cases (>= 5 cases per feature)
// ============================================================================

describe('Tier 2 — Boundary & Negative Cases', () => {
  describe('F1 Boundary & Negative', () => {
    test('E2E-F1-T2-01: corrupted entry 192011 麻子籽 is absent or excluded and never recommended', () => {
      const raw = getFoodById('192011');
      if (raw) {
        const tagged = TAGGED_FOODS.find(f => f.id === '192011');
        assert.equal(hasTag(tagged, 'excluded'), true);
      }
      const rng = createRng(1201);
      const gaps = TEN_NUTRIENTS.map((k, i) => ({ key: k, value: 500, ratio: 0.9, score: 1 - i * 0.01, index: i }));
      for (const meal of ['breakfast', 'lunch', 'dinner', 'snack']) {
        assert.equal(pickRecommendationsByGaps(gaps, meal, { maxCount: 10, rng }).some(f => f.id === '192011'), false);
        assert.equal(pickLowCalorieRecommendations(meal, 20, { rng }).some(f => f.id === '192011'), false);
      }
    });

    test('E2E-F1-T2-02: getFoodById returns undefined for nonexistent/empty/null/undefined IDs', () => {
      for (const id of ['nonexistent-999999', '', null, undefined]) {
        assert.strictEqual(getFoodById(id), undefined);
      }
    });

    test('E2E-F1-T2-03: calcNutrients with 0 grams returns all 0 nutrients', () => {
      const oil = getFoodById('192019');
      const res = calcNutrients(oil, 0);
      assert.deepEqual(res, EMPTY_TOTALS);
    });

    test('E2E-F1-T2-04: calcNutrients scales 50g and 100g proportionally on repaired 052005', () => {
      const seaVeg = getFoodById('052005');
      assert.equal(calcNutrients(seaVeg, 100).calories, seaVeg.calories);
      assert.equal(calcNutrients(seaVeg, 50).calories, Math.round(seaVeg.calories * 0.5));
    });

    test('E2E-F1-T2-05: pure plant oils stay limit-tagged and are not recommended directly for fat gap', () => {
      for (const id of PLANT_OIL_IDS) {
        const tagged = TAGGED_FOODS.find(f => f.id === id);
        assert.equal(hasTag(tagged, 'limit'), true, `${id} should retain limit tag`);
      }
      const fatGaps = [{ key: 'fat', value: 40, ratio: 0.9, score: 1.05, index: 0 }];
      const recs = pickRecommendationsByGaps(fatGaps, 'lunch', { maxCount: 8, rng: createRng(1205) });
      assert.equal(recs.some(f => f.category === '植物油-植物油'), false);
    });
  });

  describe('F2 Boundary & Negative', () => {
    test('E2E-F2-T2-01: common non-wild leafy greens (菠菜/西兰花) are not excluded', () => {
      for (const id of ['045301', '045217']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f);
        assert.equal(hasTag(f, 'excluded'), false);
      }
    });

    test('E2E-F2-T2-02: unprocessed regular fish remain non-excluded', () => {
      const safeFish = TAGGED_FOODS.filter(
        f => f.category === '鱼虾蟹贝类-鱼' && f.id !== '121245' && !hasTag(f, 'processed') && !hasTag(f, 'excluded')
      );
      assert.ok(safeFish.length >= 20, 'Regular unprocessed fish should remain eligible');
    });

    test('E2E-F2-T2-03: unprocessed shellfish (生蚝/牡蛎) remain non-excluded', () => {
      for (const id of ['124109', '124108']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f);
        assert.equal(hasTag(f, 'excluded'), false);
      }
    });

    test('E2E-F2-T2-04: getCategoryTags returns null for unknown, empty, and null subcategories', () => {
      for (const s of ['不存在的分类', '', null, undefined]) {
        assert.strictEqual(getCategoryTags(s), null);
      }
    });

    test('E2E-F2-T2-05: hasTag safely returns false on missing or null tags', () => {
      assert.strictEqual(hasTag({}, 'excluded'), false);
      assert.strictEqual(hasTag({ tags: null }, 'excluded'), false);
    });
  });

  describe('F3 Boundary & Negative', () => {
    test('E2E-F3-T2-01: sweet/bell peppers (甜椒/彩椒) are NOT blocked as hot chili', () => {
      for (const id of ['043124', '043125']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f, `Expected ${id} in TAGGED_FOODS`);
        assert.equal(hasTag(f, 'excluded'), false);
        assert.equal(hasTag(f, 'limit'), false);
        assert.equal(hasTag(f, 'lowCalorie'), true);
      }
    });

    test('E2E-F3-T2-02: lean unprocessed meats (鸡胸脯肉/牛股内肉) are NOT blocked by fat/offal filter', () => {
      for (const id of ['091112', '082118']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f);
        assert.equal(hasTag(f, 'excluded'), false);
        assert.equal(hasTag(f, 'limit'), false);
      }
    });

    test('E2E-F3-T2-03: pickRecommendationsByGaps with empty gaps falls back to safe items only', () => {
      const recs = pickRecommendationsByGaps([], 'breakfast', { maxCount: 4, rng: createRng(1303) });
      assert.ok(recs.length <= 4);
      for (const f of recs) {
        assert.equal(hasTag(f, 'excluded'), false);
        assert.equal(hasTag(f, 'limit'), false);
        assert.equal(hasTag(f, 'processed'), false);
      }
    });

    test('E2E-F3-T2-04: pickRecommendationsByGaps handles unknown mealTime without throwing or leaking unsafe items', () => {
      const gaps = [{ key: 'protein', value: 40, ratio: 0.8, score: 0.95, index: 0 }];
      const recs = pickRecommendationsByGaps(gaps, 'unknown_meal', { maxCount: 4, rng: createRng(1304) });
      assert.ok(Array.isArray(recs) && recs.length <= 4);
      for (const f of recs) {
        assert.equal(hasTag(f, 'excluded'), false);
        assert.equal(hasTag(f, 'limit'), false);
        assert.equal(hasTag(f, 'processed'), false);
      }
    });

    test('E2E-F3-T2-05: pickLowCalorieRecommendations handles unknown mealTime safely', () => {
      const recs = pickLowCalorieRecommendations('unknown_meal', 3, { rng: createRng(1305) });
      assert.ok(Array.isArray(recs) && recs.length <= 3);
      for (const f of recs) {
        assert.ok(f.calories <= 100);
        assert.equal(hasTag(f, 'excluded'), false);
        assert.equal(hasTag(f, 'limit'), false);
        assert.equal(hasTag(f, 'processed'), false);
      }
    });
  });

  describe('F4 Boundary & Negative', () => {
    test('E2E-F4-T2-01: 针扒 false-positive guard keeps raw beef cut 082118 unprocessed', () => {
      const f = TAGGED_FOODS.find(item => item.id === '082118');
      assert.ok(f && f.name.includes('针扒'));
      assert.equal(hasTag(f, 'processed'), false);
    });

    test('E2E-F4-T2-02: raw unsalted almond 071014 is unprocessed while salted 071021 is processed', () => {
      const unsalted = TAGGED_FOODS.find(item => item.id === '071014');
      const salted = TAGGED_FOODS.find(item => item.id === '071021');
      assert.ok(unsalted && salted);
      assert.equal(hasTag(unsalted, 'processed'), false);
      assert.equal(hasTag(salted, 'processed'), true);
    });

    test('E2E-F4-T2-03: fresh/steamed/boiled staples remain unprocessed', () => {
      for (const id of ['111204', '091112', '045301', '031304']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f);
        assert.equal(hasTag(f, 'processed'), false, `${id} ${f.name} should not be processed`);
      }
    });

    test('E2E-F4-T2-04: legacy processed keywords (腊/咸/酱/罐头/肉松/火腿) show no regression', () => {
      const sampleMarkers = ['腊', '咸', '火腿', '肉松', '罐头'];
      for (const marker of sampleMarkers) {
        const matches = TAGGED_FOODS.filter(f => f.name.includes(marker));
        assert.ok(matches.length > 0, `Expected sample for marker ${marker}`);
        assert.ok(matches.every(f => hasTag(f, 'processed')), `All ${marker} entries must be processed`);
      }
    });

    test('E2E-F4-T2-05: processed fatty fish (121419/121408) do not carry healthyFat or leak into recommendations', () => {
      for (const id of ['121419', '121408']) {
        const f = TAGGED_FOODS.find(item => item.id === id);
        assert.ok(f);
        assert.equal(hasTag(f, 'processed'), true);
        assert.equal(hasTag(f, 'healthyFat'), false);
      }
    });
  });

  describe('F5 Boundary & Negative', () => {
    test('E2E-F5-T2-01: maxCount <= 0 returns empty array for both pickers', () => {
      const gaps = [{ key: 'protein', value: 40, ratio: 0.8, score: 0.95, index: 0 }];
      assert.deepEqual(pickRecommendationsByGaps(gaps, 'lunch', { maxCount: 0, rng: createRng(1) }), []);
      assert.deepEqual(pickLowCalorieRecommendations('lunch', 0, { rng: createRng(1) }), []);
    });

    test('E2E-F5-T2-02: excludeNames omits already-eaten foods from recommendations', () => {
      const gaps = [{ key: 'protein', value: 50, ratio: 0.9, score: 1.05, index: 0 }];
      const first = pickRecommendationsByGaps(gaps, 'lunch', { maxCount: 4, rng: createRng(55) });
      const excluded = first.map(f => f.name);
      const second = pickRecommendationsByGaps(gaps, 'lunch', { maxCount: 4, excludeNames: excluded, rng: createRng(55) });
      for (const f of second) {
        assert.equal(excluded.includes(f.name), false);
      }
    });

    test('E2E-F5-T2-03: deterministic rng produces identical picks across repeated calls', () => {
      const gaps = [{ key: 'fiber', value: 20, ratio: 0.8, score: 0.95, index: 0 }];
      const a1 = pickRecommendationsByGaps(gaps, 'dinner', { maxCount: 4, goal: 'lose', rng: createRng(42) });
      const a2 = pickRecommendationsByGaps(gaps, 'dinner', { maxCount: 4, goal: 'lose', rng: createRng(42) });
      assert.deepEqual(a1.map(x => x.id), a2.map(x => x.id));

      const l1 = pickLowCalorieRecommendations('dinner', 3, { rng: createRng(42) });
      const l2 = pickLowCalorieRecommendations('dinner', 3, { rng: createRng(42) });
      assert.deepEqual(l1.map(x => x.id), l2.map(x => x.id));
    });

    test('E2E-F5-T2-04: findFoodsByTag unknown tag and pickRandomItems bounds', () => {
      assert.deepEqual(findFoodsByTag('nonExistentTag'), []);
      assert.deepEqual(pickRandomItems([], 3, createRng(1)), []);
      const arr = [1, 2, 3];
      const picked = pickRandomItems(arr, 100, createRng(1));
      assert.equal(picked.length, 3);
      assert.equal(new Set(picked).size, 3);
    });

    test('E2E-F5-T2-05: foods with 0 vitaminA / 0 zinc do not get highVitaminA / zincRich', () => {
      const zeroVA = TAGGED_FOODS.filter(f => f.vitaminA === 0).slice(0, 50);
      const zeroZn = TAGGED_FOODS.filter(f => f.zinc === 0).slice(0, 50);
      for (const f of zeroVA) assert.equal(hasTag(f, 'highVitaminA'), false);
      for (const f of zeroZn) assert.equal(hasTag(f, 'zincRich'), false);
    });
  });

  describe('F6 Boundary & Negative', () => {
    test('E2E-F6-T2-01: empty, whitespace, null, undefined, and non-string queries return []', () => {
      for (const q of ['', '   ', null, undefined, 123]) {
        assert.deepEqual(searchFoods(q), []);
      }
    });

    test('E2E-F6-T2-02: unknown gibberish query returns []', () => {
      assert.deepEqual(searchFoods('zzzz_不存在的食物_999'), []);
    });

    test('E2E-F6-T2-03: multi-token AND search with one unmatched token returns []', () => {
      assert.deepEqual(searchFoods('鸡蛋 不存在的词'), []);
    });

    test('E2E-F6-T2-04: limit boundary enforcement (1, 5, 0)', () => {
      assert.equal(searchFoods('肉', 1).length, 1);
      assert.equal(searchFoods('肉', 5).length, 5);
      assert.ok(Array.isArray(searchFoods('肉', 0)));
    });

    test('E2E-F6-T2-05: extra whitespace in multi-token query matches identically', () => {
      const a = searchFoods('鸡蛋 煮').map(f => f.id);
      const b = searchFoods('  鸡蛋   煮  ').map(f => f.id);
      assert.deepEqual(b, a);
    });
  });

  describe('F7 Boundary & Negative', () => {
    test('E2E-F7-T2-01: exhaustive scan rejects any unsearchable food phrases in adviceCopy', () => {
      const corpus = [];
      for (const s of ['over', 'near', 'gap']) {
        for (const g of ['lose', 'maintain', 'gain']) corpus.push(...normalizeCopyPool(CALORIE_COPY[s]?.[g]));
      }
      for (const g of ['lose', 'maintain', 'gain']) {
        for (const m of Object.values(NUTRIENT_COPY[g] || {})) {
          for (const lines of Object.values(m || {})) corpus.push(...(lines || []));
        }
        corpus.push(...(HABIT_COPY[g] || []));
      }
      for (const line of corpus) {
        for (const banned of UNSEARCHABLE_FOOD_DENYLIST) {
          if (line.includes(banned)) {
            assert.ok(
              searchFoods(banned).length > 0,
              `Denylist hit "${banned}" unsearchable in "${line}"`
            );
          }
        }
      }
    });

    test('E2E-F7-T2-02: punctuation and length boundaries on CALORIE_COPY and NUTRIENT_COPY', () => {
      for (const s of ['over', 'near', 'gap']) {
        for (const g of ['lose', 'maintain', 'gain']) {
          for (const line of normalizeCopyPool(CALORIE_COPY[s]?.[g])) {
            assert.ok(line.length >= 10 && line.length <= 75, `Unexpected CALORIE_COPY length (${line.length}): ${line}`);
            assert.equal(/[!?]/.test(line), false, `Half-width !/? in "${line}"`);
          }
        }
      }
      for (const g of ['lose', 'maintain', 'gain']) {
        for (const m of Object.values(NUTRIENT_COPY[g] || {})) {
          for (const lines of Object.values(m || {})) {
            for (const line of lines || []) {
              assert.ok(line.length >= 10 && line.length <= 80, `Unexpected NUTRIENT_COPY length (${line.length}): ${line}`);
              assert.equal(/[!?]/.test(line), false, `Half-width !/? in "${line}"`);
            }
          }
        }
      }
    });

    test('E2E-F7-T2-03: NUTRIENT_COPY lines start with matching nutrient or 缺口 {gap}', () => {
      for (const g of ['lose', 'maintain', 'gain']) {
        for (const key of TEN_NUTRIENTS) {
          const aliases = NUTRIENT_MATCH_ALIASES[key];
          for (const lines of Object.values(NUTRIENT_COPY[g]?.[key] || {})) {
            for (const line of lines || []) {
              const firstClause = line.split(/[，,]/)[0];
              assert.ok(
                /^缺口\s*\{gap\}/.test(line) || aliases.some(a => firstClause.includes(a)),
                `NUTRIENT_COPY.${g}.${key} opening clause unclear: "${line}"`
              );
            }
          }
        }
      }
    });

    test('E2E-F7-T2-04: colloquial synonym queries resolve to non-empty searchFoods results', () => {
      for (const q of ['鸡胸肉', '牛油果', '水煮蛋', '巴旦木', '燕麦片', '圣女果', '小番茄', '奇异果', '橙子', '红枣', '嫩豆腐']) {
        assert.ok(searchFoods(q).length > 0, `searchFoods("${q}") must return >= 1 result`);
      }
    });

    test('E2E-F7-T2-05: non-evening CALORIE_COPY subset is >= 2 lines per (state, goal)', () => {
      for (const s of ['over', 'near', 'gap']) {
        for (const g of ['lose', 'maintain', 'gain']) {
          const filtered = normalizeCopyPool(CALORIE_COPY[s]?.[g]).filter(l => !EVENING_ONLY_RE.test(l));
          assert.ok(filtered.length >= 2, `Filtered morning pool empty/small for ${s}.${g}`);
        }
      }
    });
  });

  describe('F8 Boundary & Negative', () => {
    test('E2E-F8-T2-01: calorieState exact threshold boundaries (0, 1699, 1700, 2000, 2001)', () => {
      const t = { ...calcTargets(BOUNDARY_PROFILES.tdee1500), calories: 2000 };
      assert.equal(generateAdvice({ ...EMPTY_TOTALS, calories: 2001 }, t, { mealTime: 'dinner', seed: 'b1' }).calorieState, 'over');
      assert.equal(generateAdvice({ ...EMPTY_TOTALS, calories: 2000 }, t, { mealTime: 'dinner', seed: 'b2' }).calorieState, 'near');
      assert.equal(generateAdvice({ ...EMPTY_TOTALS, calories: 1700 }, t, { mealTime: 'dinner', seed: 'b3' }).calorieState, 'near');
      assert.equal(generateAdvice({ ...EMPTY_TOTALS, calories: 1699 }, t, { mealTime: 'dinner', seed: 'b4' }).calorieState, 'gap');
      assert.equal(generateAdvice({ ...EMPTY_TOTALS, calories: 0 }, t, { mealTime: 'dinner', seed: 'b5' }).calorieState, 'gap');
    });

    test('E2E-F8-T2-02: degenerate targets (calories <= 0, missing goal, 0 micro targets) do not NaN', () => {
      const badTargets = { ...EMPTY_TOTALS, calories: 0 };
      const adv = generateAdvice(EMPTY_TOTALS, badTargets, { mealTime: 'lunch', seed: 'deg' });
      assert.equal(adv.calorieState, 'gap');
      for (const s of adv.summary) assert.equal(s.includes('NaN'), false);
      assert.deepEqual(computeNutrientGaps(EMPTY_TOTALS, badTargets), []);
    });

    test('E2E-F8-T2-03: computeNutrientGaps 0.20 ratio boundary and +0.15 macro priority', () => {
      const t = { ...calcTargets(BOUNDARY_PROFILES.tdee1500), calcium: 1000, iron: 100, protein: 100, zinc: 10 };
      const tot = {
        ...t,
        calcium: 800, // ratio === 0.20 (excluded)
        iron: 79.9,   // ratio === 0.201 (included)
        protein: 50,  // ratio === 0.50 (+0.15 = 0.65)
        zinc: 4       // ratio === 0.60
      };
      const gaps = computeNutrientGaps(tot, t);
      const keys = gaps.map(g => g.key);
      assert.equal(keys.includes('calcium'), false);
      assert.equal(keys.includes('iron'), true);
      assert.ok(keys.indexOf('protein') < keys.indexOf('zinc'));
    });

    test('E2E-F8-T2-04: recommendations have unique names and IDs in both over and gap states', () => {
      const t = calcTargets(BOUNDARY_PROFILES.tdee1500);
      for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
        for (let i = 0; i < 30; i++) {
          const gAdv = generateAdvice(EMPTY_TOTALS, t, { mealTime, seed: `dup-g-${mealTime}-${i}` });
          assert.equal(new Set(gAdv.recommendations.map(r => r.name)).size, gAdv.recommendations.length);
          assert.equal(new Set(gAdv.recommendations.map(r => r.id)).size, gAdv.recommendations.length);

          const oAdv = generateAdvice({ ...EMPTY_TOTALS, calories: t.calories + 300 }, t, { mealTime, seed: `dup-o-${mealTime}-${i}` });
          assert.equal(new Set(oAdv.recommendations.map(r => r.name)).size, oAdv.recommendations.length);
        }
      }
    });

    test('E2E-F8-T2-05: seed variations incorporating targets.calories and gapSig produce varied advice', () => {
      const t1 = { ...calcTargets(BOUNDARY_PROFILES.tdee1500), calories: 1600 };
      const t2 = { ...calcTargets(BOUNDARY_PROFILES.tdee1500), calories: 2100 };
      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(generateAdvice(EMPTY_TOTALS, t1, { mealTime: 'lunch', seed: `2026-11-24|lunch|lose|${t1.calories}|0|0|protein-${i}` }).summary[0]);
        results.add(generateAdvice(EMPTY_TOTALS, t2, { mealTime: 'lunch', seed: `2026-11-24|lunch|lose|${t2.calories}|0|0|fiber-${i}` }).summary[0]);
      }
      assert.ok(results.size > 1, 'Distinct seeds should produce varied copy selections');
    });
  });

  describe('F9 Boundary & Negative', () => {
    test('E2E-F9-T2-01: QuotaExceededError on setStorageSync returns strictly false on save & delete', () => {
      const wxMock = withWxMock();
      const day = '2026-11-24';
      const init = records.saveRecord(buildRecordInput('111204', 100, '早餐', day));
      const quotaErr = Object.assign(new Error('storage quota exceeded'), { name: 'QuotaExceededError' });
      wxMock.setThrowOnSet(quotaErr);
      assert.strictEqual(records.saveRecord(buildRecordInput('091112', 100, '午餐', day)), false);
      assert.strictEqual(records.deleteRecord(day, init[0].id), false);
    });

    test('E2E-F9-T2-02: corrupted getStorageSync and missing dateKey/id handled safely', () => {
      const wxMock = withWxMock();
      assert.deepEqual(records.deleteRecord('1999-01-01', 'missing'), []);
      wxMock.setThrowOnGet(new Error('corrupted'));
      assert.deepEqual(records.loadAllRecords(), {});
      assert.deepEqual(records.loadDayRecords('2026-11-24'), []);
    });

    test('E2E-F9-T2-03: 20 small-fraction records accumulate without per-step rounding drift', () => {
      const batch1 = Array.from({ length: 20 }, () => ({ calories: 0.4, protein: 0.04, iron: 0.004 }));
      const t1 = records.calcTotalsFromRecords(batch1);
      assert.equal(t1.calories, 8);
      assert.equal(t1.protein, 0.8);
      assert.equal(t1.iron, 0.08);

      const batch2 = Array.from({ length: 5 }, () => ({ protein: 0.14, zinc: 0.014 }));
      const t2 = records.calcTotalsFromRecords(batch2);
      assert.equal(t2.protein, 0.7);
      assert.equal(t2.zinc, 0.07);
    });

    test('E2E-F9-T2-04: IEEE-754 0.1 + 0.2 binary float artifact is eliminated', () => {
      const t = records.calcTotalsFromRecords([
        { protein: 0.1, iron: 0.01 },
        { protein: 0.2, iron: 0.02 }
      ]);
      assert.strictEqual(t.protein, 0.3);
      assert.strictEqual(t.iron, 0.03);
    });

    test('E2E-F9-T2-05: calcTotalsFromRecords handles empty, null, undefined, and sparse records', () => {
      assert.deepEqual(records.calcTotalsFromRecords([]), EMPTY_TOTALS);
      assert.deepEqual(records.calcTotalsFromRecords(null), EMPTY_TOTALS);
      assert.deepEqual(records.calcTotalsFromRecords(undefined), EMPTY_TOTALS);
      assert.deepEqual(records.calcTotalsFromRecords([{ calories: 100 }]), { ...EMPTY_TOTALS, calories: 100 });
    });
  });

  describe('F10 Boundary & Negative', () => {
    test('E2E-F10-T2-01: exhaustive invalid input matrix returns null on calcBMR & calcTargets', () => {
      for (const bad of [NaN, Infinity, -Infinity, 0, -1, 'abc', null, undefined]) {
        assert.strictEqual(calcBMR({ gender: 'female', age: bad, heightCm: 160, weightKg: 50 }), null);
        assert.strictEqual(calcBMR({ gender: 'female', age: 25, heightCm: bad, weightKg: 50 }), null);
        assert.strictEqual(calcBMR({ gender: 'female', age: 25, heightCm: 160, weightKg: bad }), null);
        assert.strictEqual(calcTargets({ gender: 'female', age: bad, heightCm: 160, weightKg: 50, activity: 'light', goal: 'lose' }), null);
      }
    });

    test('E2E-F10-T2-02: TDEE boundary matrix (1199 vs 1200 vs 1500) x (lose|maintain|gain)', () => {
      const p1199 = BOUNDARY_PROFILES.tdee1199;
      assert.ok(calcTargets({ ...p1199, goal: 'lose' }).calories <= 1199);
      assert.equal(calcTargets({ ...p1199, goal: 'maintain' }).calories, 1199);
      assert.equal(calcTargets({ ...p1199, goal: 'gain' }).calories, 1499);

      const p1200 = BOUNDARY_PROFILES.tdee1200;
      assert.equal(calcTargets({ ...p1200, goal: 'lose' }).calories, 1200);
      assert.equal(calcTargets({ ...p1200, goal: 'maintain' }).calories, 1200);
      assert.equal(calcTargets({ ...p1200, goal: 'gain' }).calories, 1500);

      const p1500 = BOUNDARY_PROFILES.tdee1500;
      assert.equal(calcTargets({ ...p1500, goal: 'lose' }).calories, 1200);
      assert.equal(calcTargets({ ...p1500, goal: 'maintain' }).calories, 1500);
      assert.equal(calcTargets({ ...p1500, goal: 'gain' }).calories, 1800);
    });

    test('E2E-F10-T2-03: ultra-low TDEE (< 1000) never forces lose calories > TDEE', () => {
      const elderly = { gender: 'female', age: 75, heightCm: 145, weightKg: 35, activity: 'sedentary', goal: 'lose' };
      const tLose = calcTargets(elderly);
      assert.ok(tLose.tdee < 1000);
      assert.ok(tLose.calories > 0 && tLose.calories <= tLose.tdee);
      const tMaint = calcTargets({ ...elderly, goal: 'maintain' });
      assert.equal(tMaint.calories, tMaint.tdee);
    });

    test('E2E-F10-T2-04: DRI age segment cutoffs (10, 11, 13, 14, 17, 18, 49, 50)', () => {
      const f = age => calcTargets({ gender: 'female', age, heightCm: 160, weightKg: 50, activity: 'light', goal: 'maintain' });
      const m = age => calcTargets({ gender: 'male', age, heightCm: 170, weightKg: 65, activity: 'light', goal: 'maintain' });
      assert.deepEqual([10, 11, 14, 18, 49, 50].map(a => f(a).iron), [12, 15, 18, 20, 20, 12]);
      assert.deepEqual([10, 11, 14, 18].map(a => m(a).zinc), [7, 10, 11.5, 12.5]);
      assert.deepEqual([10, 11, 14, 18, 49, 50].map(a => f(a).calcium), [1000, 1200, 1000, 800, 800, 1000]);
    });

    test('E2E-F10-T2-05: unknown goal & activity safely fall back to maintain & sedentary (1.2)', () => {
      const t = calcTargets({ gender: 'male', age: 30, heightCm: 175, weightKg: 70, activity: 'unknown', goal: 'unknown' });
      assert.equal(t.goal, 'maintain');
      assert.equal(t.tdee, Math.round(t.bmr * 1.2));
      assert.ok(Number.isFinite(t.calories) && t.calories > 0);
    });
  });

  describe('F11 Boundary & Negative', () => {
    test('E2E-F11-T2-01: backfill date and open modal survive background-to-foreground resume', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T10:00:00') });
      const h = createMiniProgramHarness();
      h.pages.today.onPrevDay();
      h.pages.today.navToRecord();
      const rec = h.switchTab('record');
      rec.onSelectFood({ currentTarget: { dataset: { id: '111204' } } });

      h.simulateBackgroundResume('record');
      assert.equal(rec.data.recordDateKey, '2026-11-23');
      assert.equal(rec.data.isBackfill, true);
      assert.ok(rec.data.selectedFood && rec.data.selectedFood.id === '111204');
    });

    test('E2E-F11-T2-02: fresh TabBar switch to record resets stale selectedFood', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T10:00:00') });
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');
      rec.onSelectFood({ currentTarget: { dataset: { id: '111204' } } });
      assert.ok(rec.data.selectedFood);

      h.switchTab('today');
      h.switchTab('record');
      assert.equal(rec.data.selectedFood, null);
      assert.equal(rec.data.recordDateKey, '2026-11-24');
      assert.equal(rec.data.isBackfill, false);
    });

    test('E2E-F11-T2-03: clicking + 记一笔 without pendingFoodId resets stale selectedFood', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T10:00:00') });
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');
      rec.onSelectFood({ currentTarget: { dataset: { id: '111204' } } });
      h.switchTab('today');
      h.pages.today.navToRecord();
      h.switchTab('record');
      assert.equal(rec.data.selectedFood, null);
    });

    test('E2E-F11-T2-04: WXML-discovered backfill exit action returns recordDateKey to today', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T10:00:00') });
      const h = createMiniProgramHarness();
      h.pages.today.onPrevDay();
      h.pages.today.navToRecord();
      const rec = h.switchTab('record');
      assert.equal(rec.data.isBackfill, true);

      const handler = discoverWxmlTapHandler(loadWxml('pages/record/record.wxml'), rec.data, /切回今天|退出补记|回到今天|返回今天/);
      assert.ok(handler && typeof rec[handler] === 'function');
      rec[handler]({});
      assert.equal(rec.data.isBackfill, false);
      assert.equal(rec.data.recordDateKey, '2026-11-24');
    });

    test('E2E-F11-T2-05: midnight rollover on today.onShow advances dateKey automatically', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T23:59:00') });
      const h = createMiniProgramHarness();
      assert.equal(h.pages.today.data.dateKey, '2026-11-24');
      t.mock.timers.setTime(new Date('2026-11-25T00:05:00').getTime());
      h.pages.today.onShow();
      assert.equal(h.pages.today.data.dateKey, '2026-11-25');
      assert.equal(h.pages.today.data.isToday, true);
    });
  });

  describe('F12 Boundary & Negative', () => {
    test('E2E-F12-T2-01: first-character input does not flash false empty state before 150ms debounce', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T10:00:00') });
      const wxml = loadWxml('pages/record/record.wxml');
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');

      rec.onInput({ detail: { value: '鸡' } });
      const beforeText = getVNodeText(findVNodes(renderWxml(wxml, rec.data), n => hasClass(n, 'food-list'))[0]);
      assert.equal(beforeText.includes('没有找到'), false, 'Should not flash 没有找到 during debounce');

      t.mock.timers.tick(150);
      assert.ok(rec.data.results.length > 0);

      rec.onInput({ detail: { value: 'zzzz_不存在_999' } });
      const missBefore = getVNodeText(findVNodes(renderWxml(wxml, rec.data), n => hasClass(n, 'food-list'))[0]);
      assert.equal(missBefore.includes('没有找到'), false);
      t.mock.timers.tick(150);
      const missAfter = getVNodeText(findVNodes(renderWxml(wxml, rec.data), n => hasClass(n, 'food-list'))[0]);
      assert.equal(missAfter.includes('没有找到'), true);
    });

    test('E2E-F12-T2-02: interrupted search across onHide/onShow never leaves page stuck in false empty state', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T10:00:00') });
      const wxml = loadWxml('pages/record/record.wxml');
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');

      rec.onInput({ detail: { value: '鸡' } });
      t.mock.timers.tick(50);
      rec.onHide();
      rec.onShow();
      t.mock.timers.tick(200);

      const listText = getVNodeText(findVNodes(renderWxml(wxml, rec.data), n => hasClass(n, 'food-list'))[0]);
      assert.equal(listText.includes('没有找到'), false, `Interrupted search got stuck in false empty state: ${listText}`);
    });

    test('E2E-F12-T2-03: clearing search input cancels pending debounce and restores empty prompt', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T10:00:00') });
      const wxml = loadWxml('pages/record/record.wxml');
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');

      rec.onInput({ detail: { value: '鸡' } });
      rec.onInput({ detail: { value: '   ' } });
      t.mock.timers.tick(200);
      assert.equal(rec.data.results.length, 0);
      const listText = getVNodeText(findVNodes(renderWxml(wxml, rec.data), n => hasClass(n, 'food-list'))[0]);
      assert.ok(listText.includes('输入食物名称开始搜索'));
    });

    test('E2E-F12-T2-04: invalid grams inputs (0, -5, abc, 5001, empty) produce no NaN and block saving', () => {
      const wxml = loadWxml('pages/record/record.wxml');
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');
      rec.onSelectFood({ currentTarget: { dataset: { id: '111204' } } });

      for (const bad of ['0', '-5', 'abc', '5001', '']) {
        rec.onGramsInput({ detail: { value: bad } });
        const modalText = getVNodeText(findVNodes(renderWxml(wxml, rec.data), n => hasClass(n, 'modal'))[0]);
        assert.equal(modalText.includes('NaN'), false, `Modal preview produced NaN for "${bad}"`);
        rec.onSave();
        assert.equal(h.wxMock.store.records, undefined);
      }
    });

    test('E2E-F12-T2-05: failed onSave preserves ability to retry successfully once storage recovers', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T10:00:00') });
      const h = createMiniProgramHarness();
      const rec = h.switchTab('record');
      rec.onSelectFood({ currentTarget: { dataset: { id: '111204' } } });
      h.wxMock.setThrowOnSet(new Error('disk full'));
      rec.onSave();
      assert.equal(h.wxMock.store.records, undefined);

      h.wxMock.setThrowOnSet(null);
      if (!rec.data.selectedFood) {
        rec.onSelectFood({ currentTarget: { dataset: { id: '111204' } } });
      }
      rec.onSave();
      assert.equal(h.wxMock.store.records['2026-11-24'].length, 1);
    });
  });

  describe('F13 Boundary & Negative', () => {
    test('E2E-F13-T2-01: today.refresh seed changes when targets.calories changes', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T12:00:00') });
      const seeds = [];
      let origGenerate = null;
      const h = createMiniProgramHarness({
        beforeLoad() {
          const adviceMod = require(MODULE_PATHS.advice);
          origGenerate = adviceMod.generateAdvice;
          require.cache[require.resolve(MODULE_PATHS.advice)].exports.generateAdvice = (...args) => {
            seeds.push(args[2]?.seed);
            return origGenerate(...args);
          };
        },
        afterCleanup() {
          if (origGenerate && require.cache[require.resolve(MODULE_PATHS.advice)]) {
            require.cache[require.resolve(MODULE_PATHS.advice)].exports.generateAdvice = origGenerate;
          }
        }
      });
      const baseT = calcTargets(BOUNDARY_PROFILES.tdee1500);
      h.pages.today.refresh({ ...baseT, calories: 1800 }, '2026-11-24');
      h.pages.today.refresh({ ...baseT, calories: 2200 }, '2026-11-24');
      assert.notEqual(seeds[seeds.length - 1], seeds[seeds.length - 2]);
    });

    test('E2E-F13-T2-02: today.refresh seed changes when top nutrient gap changes at same calorie count', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T12:00:00') });
      const seeds = [];
      let origGenerate = null;
      const baseT = calcTargets(BOUNDARY_PROFILES.tdee1500);
      const h = createMiniProgramHarness({
        initialStore: {
          records: {
            '2026-11-24': [{ id: '1', dateKey: '2026-11-24', calories: 500, protein: 90, fiber: 0 }]
          }
        },
        beforeLoad() {
          const adviceMod = require(MODULE_PATHS.advice);
          origGenerate = adviceMod.generateAdvice;
          require.cache[require.resolve(MODULE_PATHS.advice)].exports.generateAdvice = (...args) => {
            seeds.push(args[2]?.seed);
            return origGenerate(...args);
          };
        },
        afterCleanup() {
          if (origGenerate && require.cache[require.resolve(MODULE_PATHS.advice)]) {
            require.cache[require.resolve(MODULE_PATHS.advice)].exports.generateAdvice = origGenerate;
          }
        }
      });
      h.pages.today.refresh(baseT, '2026-11-24');
      h.wxMock.store.records['2026-11-24'] = [{ id: '1', dateKey: '2026-11-24', calories: 500, protein: 0, fiber: 25 }];
      h.pages.today.refresh(baseT, '2026-11-24');
      assert.notEqual(seeds[seeds.length - 1], seeds[seeds.length - 2]);
    });

    test('E2E-F13-T2-03: today.onDelete handles storage write failure without dropping persisted record', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T12:00:00') });
      const h = createMiniProgramHarness({
        initialStore: {
          profile: BOUNDARY_PROFILES.tdee1500,
          records: { '2026-11-24': [{ id: 'rec-1', dateKey: '2026-11-24', foodName: '鸡蛋', grams: 100, calories: 144 }] }
        }
      });
      h.wxMock.setThrowOnSet(new Error('write fail'));
      h.wxMock.setModalResponse({ confirm: true, cancel: false });
      h.pages.today.onDelete({ currentTarget: { dataset: { id: 'rec-1' } } });

      assert.equal(h.wxMock.store.records['2026-11-24'].length, 1);
      assert.equal(h.pages.today.data.records.length, 1);
      assert.ok(h.wxMock.toasts.some(x => /失败|重试/.test(x.title || '')));
    });

    test('E2E-F13-T2-04: today.onDelete cancellation keeps record untouched', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T12:00:00') });
      const h = createMiniProgramHarness({
        initialStore: {
          records: { '2026-11-24': [{ id: 'rec-1', dateKey: '2026-11-24', foodName: '鸡蛋', grams: 100, calories: 144 }] }
        }
      });
      h.wxMock.setModalResponse({ confirm: false, cancel: true });
      h.pages.today.onDelete({ currentTarget: { dataset: { id: 'rec-1' } } });
      assert.equal(h.pages.today.data.records.length, 1);
      assert.equal(h.wxMock.store.records['2026-11-24'].length, 1);
    });

    test('E2E-F13-T2-05: onNextDay refuses future dates and onBackToday restores today + advice', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T12:00:00') });
      const h = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
      });
      const today = h.pages.today;
      today.onNextDay();
      assert.equal(today.data.dateKey, '2026-11-24');
      assert.ok(h.wxMock.toasts.some(x => x.title === '已经是今天啦'));

      today.onPrevDay();
      assert.equal(today.data.isToday, false);
      assert.equal(today.data.advice, null);

      today.onBackToday();
      assert.equal(today.data.isToday, true);
      assert.ok(today.data.advice);
    });
  });

  describe('F14 Boundary & Negative', () => {
    test('E2E-F14-T2-01: profile.onSave rejects out-of-range age/height/weight without writing storage', () => {
      const h = createMiniProgramHarness();
      const p = h.switchTab('profile');
      const cases = [
        { age: '9', heightCm: '165', weightKg: '55' },
        { age: '101', heightCm: '165', weightKg: '55' },
        { age: '25', heightCm: '99', weightKg: '55' },
        { age: '25', heightCm: '251', weightKg: '55' },
        { age: '25', heightCm: '165', weightKg: '29' },
        { age: '25', heightCm: '165', weightKg: '301' }
      ];
      for (const c of cases) {
        p.setData(c);
        p.onSave();
        assert.equal(h.wxMock.store.profile, undefined);
      }
      assert.equal(h.wxMock.toasts.length, cases.length);
    });

    test('E2E-F14-T2-02: profile.onShow clears displayed targets when storage profile was removed', () => {
      const h = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
      });
      const p = h.switchTab('profile');
      assert.equal(typeof p.onShow, 'function', 'profile.js must implement onShow()');
      assert.ok(p.data.targets);
      delete h.wxMock.store.profile;
      p.onShow();
      assert.equal(p.data.targets, null);
    });

    test('E2E-F14-T2-03: unsaved picker changes (gender/activity/goal) revert on profile.onShow', () => {
      const h = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
      });
      const p = h.switchTab('profile');
      assert.equal(typeof p.onShow, 'function', 'profile.js must implement onShow()');
      p.onGenderChange({ detail: { value: 0 } });
      p.onActivityChange({ detail: { value: 4 } });
      p.onGoalChange({ detail: { value: 2 } });
      p.onShow();
      assert.equal(p.data.genderIndex, 1);
      assert.equal(p.data.activityIndex, 0);
      assert.equal(p.data.goalIndex, 0);
    });

    test('E2E-F14-T2-04: storage write error during profile.onSave preserves previous targets', () => {
      const h = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
      });
      const p = h.switchTab('profile');
      const prevCal = p.data.targets.calories;
      h.wxMock.setThrowOnSet(new Error('write failed'));
      p.onInput({ currentTarget: { dataset: { field: 'weightKg' } }, detail: { value: '75' } });
      p.onSave();
      assert.equal(h.app.globalData.targets.calories, prevCal);
      assert.equal(p.data.targets.calories, prevCal);
      assert.ok(h.wxMock.toasts.some(t => /失败/.test(t.title || '')));
    });

    test('E2E-F14-T2-05: profile.wxml renders 1200 kcal floor notice when TDEE>=1200 clamped and hides when unclamped', () => {
      const wxml = loadWxml('pages/profile/profile.wxml');
      const h1 = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.tdee1330 }
      });
      const clampedTree = renderWxml(wxml, h1.switchTab('profile').data);
      const hint = findVNodes(clampedTree, n => hasClass(n, 'clamp-hint'));
      assert.equal(hint.length, 1);
      assert.ok(getVNodeText(hint[0]).includes('1200'));
      h1.cleanup();

      const h2 = createMiniProgramHarness({
        initialStore: { profile: BOUNDARY_PROFILES.maleGain }
      });
      const unclampedTree = renderWxml(wxml, h2.switchTab('profile').data);
      assert.equal(findVNodes(unclampedTree, n => hasClass(n, 'clamp-hint')).length, 0);
    });
  });

  describe('F16 Boundary & Negative', () => {
    const claudeMd = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');

    test('E2E-F16-T2-01: all miniprogram/ and tests/ file paths mentioned in CLAUDE.md exist on disk', () => {
      const refs = claudeMd.match(/(?:miniprogram|tests)\/[a-zA-Z0-9_/-]+\.(?:js|json|wxml|wxss)/g) || [];
      for (const rel of refs) {
        if (rel.includes('<')) continue;
        assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `Referenced file missing: ${rel}`);
      }
    });

    test('E2E-F16-T2-02: CLAUDE.md records contract matches records.js storage/rounding semantics', () => {
      assert.match(claudeMd, /records\.js/);
      assert.match(claudeMd, /false|写入失败|先求和|舍入/);
    });

    test('E2E-F16-T2-03: CLAUDE.md enum keys match tdee.js and record.js contracts', () => {
      assert.ok(claudeMd.includes('lose|maintain|gain'));
      assert.ok(claudeMd.includes('sedentary|light|moderate|active|very_active'));
      assert.ok(claudeMd.includes('早餐|午餐|晚餐|加餐'));
      for (const k of ['lose', 'maintain', 'gain']) assert.ok(k in GOAL_ADJUSTMENTS);
      for (const a of ['sedentary', 'light', 'moderate', 'active', 'very_active']) assert.ok(a in ACTIVITY_FACTORS);
    });

    test('E2E-F16-T2-04: CLAUDE.md placeholder documentation matches {remaining}/{gap}/{pct}', () => {
      assert.ok(claudeMd.includes('{remaining}'));
      assert.ok(claudeMd.includes('{gap}'));
      assert.ok(claudeMd.includes('{pct}'));
    });

    test('E2E-F16-T2-05: CLAUDE.md contains zero stale rule-engine claims', () => {
      assert.equal(claudeMd.includes('当前为规则版建议'), false);
    });
  });
});

// ============================================================================
// TIER 3: Cross-Feature Pairwise Interactions (10 cases)
// ============================================================================

describe('Tier 3 — Cross-Feature Pairwise Interactions', () => {
  test('E2E-T3-01 (F1 x F6): search olive oil -> calcNutrients(15g) yields ~135 kcal & limit tag prevents direct recommendation', () => {
    const hits = searchFoods('橄榄油');
    assert.ok(hits.length > 0);
    const oil = getFoodById(hits[0].id);
    const scaled = calcNutrients(oil, 15);
    assert.ok(scaled.calories >= 134 && scaled.calories <= 135, `Expected ~135 kcal, got ${scaled.calories}`);
    const tagged = TAGGED_FOODS.find(f => f.id === oil.id);
    assert.equal(hasTag(tagged, 'limit'), true);
  });

  test('E2E-T3-02 (F2 x F3 x F4 x F5): Vitamin A & Zinc gap recommendations respect safety, processing, and goal constraints', () => {
    const gaps = [
      { key: 'vitaminA', value: 600, ratio: 0.85, score: 0.85, index: 0 },
      { key: 'zinc', value: 10, ratio: 0.80, score: 0.80, index: 1 }
    ];
    const rng = createRng(3002);
    for (const goal of ['lose', 'gain']) {
      for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
        const recs = pickRecommendationsByGaps(gaps, mealTime, { maxCount: 4, goal, rng });
        const names = recs.map(f => f.name);
        assert.equal(new Set(names).size, names.length);
        for (const f of recs) {
          assert.equal(hasTag(f, 'excluded'), false);
          assert.equal(hasTag(f, 'limit'), false);
          assert.equal(hasTag(f, 'processed'), false);
          assert.notEqual(f.category, WILD_VEG_CAT);
          assert.notEqual(f.category, SEAFOOD_OTHER_CAT);
          assert.equal(/猪肝|羊肝|鸡肝|牛脑|牛肺|牛鞭|猪大肠|鸡心/.test(f.name), false, `Offal leaked: ${f.name}`);
          if (goal === 'lose') assert.equal(hasTag(f, 'highCalorie'), false);
        }
      }
    }
  });

  test('E2E-T3-03 (F5 x F6): colloquial search hits resolve to non-excluded, non-processed foods with consistent 100g nutrients', () => {
    for (const q of ['鸡胸肉', '牛油果', '水煮蛋', '圣女果', '奇异果']) {
      const hits = searchFoods(q);
      assert.ok(hits.length > 0, `Missing hit for ${q}`);
      const top = hits[0];
      const tagged = TAGGED_FOODS.find(f => f.id === top.id);
      assert.equal(hasTag(tagged, 'excluded'), false);
      assert.equal(hasTag(tagged, 'processed'), false);
      assert.equal(calcNutrients(top, 100).calories, Math.round(top.calories));
    }
  });

  test('E2E-T3-04 (F1 x F3 x F5): low-calorie pool excludes 0-cal anomalies, wild vegs, scallions, chilies, and processed items', () => {
    const rng = createRng(3004);
    for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
      const recs = pickLowCalorieRecommendations(mealTime, 12, { rng });
      const names = recs.map(f => f.name);
      assert.equal(new Set(names).size, names.length);
      for (const f of recs) {
        assert.ok(f.calories > 0 && f.calories <= 100, `Unexpected calories ${f.calories} for ${f.name}`);
        assert.equal(/大葱|小葱|辣椒|白凤菜|喷瓜|鱼丸/.test(f.name), false);
      }
    }
  });

  test('E2E-T3-05 (F10 x F9 x F8 x F7): full parameterized pipeline tdee -> saveRecord -> calcDayTotals -> generateAdvice', () => {
    withWxMock();
    const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
    const scenarios = [
      { state: 'gap', grams: 100, mealTime: 'breakfast' },
      { state: 'near', grams: 800, mealTime: 'lunch' },
      { state: 'over', grams: 1400, mealTime: 'dinner' }
    ];
    for (const goal of ['lose', 'maintain', 'gain']) {
      const t = { ...targets, goal };
      for (const sc of scenarios) {
        const day = `2026-11-${goal}-${sc.state}`;
        const food = getFoodById('091112');
        const entry = buildRecordInput(food.id, sc.grams, '午餐', day);
        // Scale calories cleanly to test each calorieState bucket
        if (sc.state === 'gap') entry.calories = Math.round(t.calories * 0.4);
        if (sc.state === 'near') entry.calories = Math.round(t.calories * 0.92);
        if (sc.state === 'over') entry.calories = t.calories + 250;

        const saved = records.saveRecord(entry);
        assert.ok(Array.isArray(saved));
        const totals = records.calcDayTotals(day);
        const adv = generateAdvice(totals, t, { mealTime: sc.mealTime, seed: `${goal}-${sc.state}` });
        assert.equal(adv.calorieState, sc.state);
        if (sc.mealTime === 'breakfast' || sc.mealTime === 'lunch') {
          assert.equal(EVENING_ONLY_RE.test(adv.summary[0]), false);
        }
        assert.ok(adv.habits.every(h => HABIT_COPY[goal].includes(h)));
        for (const line of [...adv.summary, ...adv.habits]) {
          assertAiPromptCompliance(line);
        }
      }
    }
  });

  test('E2E-T3-06 (F7 x F6): all recommendations emitted across 30 generateAdvice runs resolve in searchFoods & getFoodById', () => {
    const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
    for (let i = 0; i < 30; i++) {
      const adv = generateAdvice(EMPTY_TOTALS, targets, { mealTime: 'lunch', seed: `t306-${i}` });
      for (const rec of adv.recommendations) {
        assert.ok(getFoodById(rec.id), `Missing getFoodById(${rec.id})`);
        assert.ok(searchFoods(rec.name).length > 0, `Recommendation "${rec.name}" not searchable`);
      }
    }
  });

  test('E2E-T3-07 (F5 x F8 x F7): cold-start requiring advice.js keeps foodTags lazy until generateAdvice runs with VitA/Zinc gaps', () => {
    const script = [
      "const ft = require('./miniprogram/utils/foodTags');",
      "const { generateAdvice } = require('./miniprogram/utils/advice');",
      "const { calcTargets } = require('./miniprogram/utils/tdee');",
      "const descBefore = Object.getOwnPropertyDescriptor(ft, 'TAGGED_FOODS');",
      "const t = calcTargets({ gender: 'female', age: 30, heightCm: 165, weightKg: 53, activity: 'sedentary', goal: 'lose' });",
      "const advA = generateAdvice({ ...t, calories: 600, vitaminA: 0 }, t, { mealTime: 'lunch', seed: 'cold-va' });",
      "const advZ = generateAdvice({ ...t, calories: 600, zinc: 0 }, t, { mealTime: 'dinner', seed: 'cold-zn' });",
      "console.log(JSON.stringify({ lazy: typeof descBefore.get === 'function', advA, advZ }));"
    ].join(' ');
    const out = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8' }));
    assert.equal(out.lazy, true);
    assert.match(out.advA.summary[1], /维生素\s*A|维\s*A/);
    assert.match(out.advA.summary[1], /μg/);
    assert.match(out.advZ.summary[1], /锌/);
    assert.match(out.advZ.summary[1], /mg/);
    assert.ok(out.advA.recommendations.every(r => Boolean(getFoodById(r.id))));
    assert.ok(out.advZ.recommendations.every(r => Boolean(getFoodById(r.id))));
  });

  test('E2E-T3-08 (F9 x F10 x F8): storage write failure isolates totals & advice until storage recovers', () => {
    const wxMock = withWxMock();
    const day = '2026-11-24';
    const targets = calcTargets(BOUNDARY_PROFILES.tdee1500);
    const rec1 = records.saveRecord(buildRecordInput('111204', 100, '早餐', day));
    assert.equal(rec1.length, 1);

    wxMock.setThrowOnSet(Object.assign(new Error('quota'), { name: 'QuotaExceededError' }));
    assert.strictEqual(records.saveRecord(buildRecordInput('091112', 400, '午餐', day)), false);
    assert.strictEqual(records.deleteRecord(day, rec1[0].id), false);

    const totalsDuringFail = records.calcDayTotals(day);
    assert.equal(totalsDuringFail.calories, calcNutrients(getFoodById('111204'), 100).calories);
    assert.equal(generateAdvice(totalsDuringFail, targets, { mealTime: 'lunch', seed: 'f' }).calorieState, 'gap');

    wxMock.setThrowOnSet(null);
    const rec2 = records.saveRecord(buildRecordInput('019012', 350, '晚餐', day));
    assert.equal(rec2.length, 2);
    assert.equal(generateAdvice(records.calcDayTotals(day), targets, { mealTime: 'dinner', seed: 'f' }).calorieState, 'over');
  });

  test('E2E-T3-09 (F10 x F9 x F8): TDEE < 1200 cut target flows into advice calorieState accurately', () => {
    withWxMock();
    const targets = calcTargets(BOUNDARY_PROFILES.tdee1187);
    assert.ok(targets.calories <= 1187);
    const nearAdv = generateAdvice({ ...EMPTY_TOTALS, calories: targets.calories - 30 }, targets, { mealTime: 'dinner', seed: 'low-tdee' });
    assert.equal(nearAdv.calorieState, 'near');
    const overAdv = generateAdvice({ ...EMPTY_TOTALS, calories: targets.calories + 8 }, targets, { mealTime: 'dinner', seed: 'low-tdee' });
    assert.equal(overAdv.calorieState, 'over');
    assert.equal(overAdv.summary.length, 1);
  });

  test('E2E-T3-10 (F11 x F12 x F13): profile update -> today targets refresh -> record log -> today advice refresh', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T12:30:00') });
    const h = createMiniProgramHarness();
    const p = h.switchTab('profile');
    p.onGenderChange({ detail: { value: 0 } });
    p.onInput({ currentTarget: { dataset: { field: 'age' } }, detail: { value: '26' } });
    p.onInput({ currentTarget: { dataset: { field: 'heightCm' } }, detail: { value: '178' } });
    p.onInput({ currentTarget: { dataset: { field: 'weightKg' } }, detail: { value: '70' } });
    p.onActivityChange({ detail: { value: 2 } });
    p.onGoalChange({ detail: { value: 2 } });
    p.onSave();

    const today = h.switchTab('today');
    assert.equal(today.data.targets.goal, 'gain');

    const rec = h.switchTab('record');
    rec.onInput({ detail: { value: '鸡胸肉' } });
    t.mock.timers.tick(150);
    assert.ok(rec.data.results.length > 0);
    rec.onSelectFood({ currentTarget: { dataset: { id: rec.data.results[0].id } } });
    rec.onGramsInput({ detail: { value: '200' } });
    rec.onSave();
    rec.navToToday();

    h.switchTab('today');
    assert.equal(today.data.records.length, 1);
    assert.ok(today.data.totals.protein > 35);
    assert.ok(today.data.advice);
  });
});

// ============================================================================
// TIER 4: Real-World Application Workloads (7 realistic end-to-end scenarios)
// ============================================================================

describe('Tier 4 — Real-World Application Workloads', () => {
  test('E2E-T4-01: Colloquial breakfast logging with olive oil calorie accuracy', () => {
    withWxMock();
    const day = '2026-11-24';
    const egg = searchFoods('水煮蛋').find(f => f.name.includes('鸡蛋（煮）'));
    const oat = searchFoods('燕麦片').find(f => f.name.includes('燕麦'));
    const tomato = searchFoods('圣女果').find(f => f.name.includes('樱桃番茄'));
    const oil = searchFoods('橄榄油')[0];
    assert.ok(egg && oat && tomato && oil);

    records.saveRecord({ foodId: egg.id, foodName: egg.name, grams: 100, meal: '早餐', dateKey: day, ...calcNutrients(egg, 100) });
    records.saveRecord({ foodId: oat.id, foodName: oat.name, grams: 50, meal: '早餐', dateKey: day, ...calcNutrients(oat, 50) });
    records.saveRecord({ foodId: tomato.id, foodName: tomato.name, grams: 150, meal: '早餐', dateKey: day, ...calcNutrients(tomato, 150) });
    const oilNutrients = calcNutrients(oil, 5);
    assert.ok(oilNutrients.calories >= 44 && oilNutrients.calories <= 45, `5g olive oil should be ~45 kcal, got ${oilNutrients.calories}`);
    records.saveRecord({ foodId: oil.id, foodName: oil.name, grams: 5, meal: '早餐', dateKey: day, ...oilNutrients });

    const totals = records.calcDayTotals(day);
    const expected = independentSumThenRound(records.loadDayRecords(day));
    assert.deepEqual(totals, expected);
    assert.ok(totals.calories > 350);
  });

  test('E2E-T4-02: Small-frame sedentary woman cut-diet full day (gap -> near -> over + delete failure recovery)', () => {
    const wxMock = withWxMock();
    const day = '2026-11-24';
    const targets = calcTargets(BOUNDARY_PROFILES.tdee1330);
    assert.equal(targets.tdee, 1330);
    assert.equal(targets.calories, 1200);
    assert.equal(targets.clamped, true);

    // Breakfast
    records.saveRecord(buildRecordInput('111204', 100, '早餐', day));
    records.saveRecord(buildRecordInput('031405', 250, '早餐', day));
    records.saveRecord(buildRecordInput('019012', 40, '早餐', day));
    const bAdv = generateAdvice(records.calcDayTotals(day), targets, { mealTime: 'breakfast', seed: 't402-b' });
    assert.equal(bAdv.calorieState, 'gap');
    assert.equal(EVENING_ONLY_RE.test(bAdv.summary[0]), false);

    // Lunch
    records.saveRecord(buildRecordInput('012401x', 150, '午餐', day));
    records.saveRecord(buildRecordInput('091112', 120, '午餐', day));
    records.saveRecord(buildRecordInput('045217', 150, '午餐', day));
    const lAdv = generateAdvice(records.calcDayTotals(day), targets, { mealTime: 'lunch', seed: 't402-l' });
    assert.equal(lAdv.calorieState, 'gap');
    assert.equal(EVENING_ONLY_RE.test(lAdv.summary[0]), false);

    // Dinner + snack -> near
    records.saveRecord(buildRecordInput('021205', 150, '晚餐', day));
    records.saveRecord(buildRecordInput('031304', 150, '晚餐', day));
    records.saveRecord(buildRecordInput('045301', 150, '晚餐', day));
    records.saveRecord(buildRecordInput('061101x', 200, '加餐', day));
    const nearTotals = records.calcDayTotals(day);
    assert.deepEqual(nearTotals, independentSumThenRound(records.loadDayRecords(day)));
    const dAdv = generateAdvice(nearTotals, targets, { mealTime: 'dinner', seed: 't402-d' });
    assert.equal(dAdv.calorieState, 'near');

    // Late snack -> over + failed delete -> succeeded delete
    const snackRecs = records.saveRecord(buildRecordInput('019012', 100, '加餐', day));
    const extraId = snackRecs[snackRecs.length - 1].id;
    const overAdv = generateAdvice(records.calcDayTotals(day), targets, { mealTime: 'snack', seed: 't402-o' });
    assert.equal(overAdv.calorieState, 'over');
    assert.equal(overAdv.summary.length, 1);

    wxMock.setThrowOnSet(new Error('storage busy'));
    assert.strictEqual(records.deleteRecord(day, extraId), false);
    assert.equal(generateAdvice(records.calcDayTotals(day), targets, { mealTime: 'snack', seed: 't402-o' }).calorieState, 'over');

    wxMock.setThrowOnSet(null);
    assert.ok(Array.isArray(records.deleteRecord(day, extraId)));
    assert.equal(generateAdvice(records.calcDayTotals(day), targets, { mealTime: 'dinner', seed: 't402-d' }).calorieState, 'near');
  });

  test('E2E-T4-03: Ultra-small sedentary woman (TDEE < 1200) full-app page & WXML workflow', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T18:30:00') });
    const h = createMiniProgramHarness();
    const prof = h.switchTab('profile');
    prof.onGenderChange({ detail: { value: 1 } });
    prof.onInput({ currentTarget: { dataset: { field: 'age' } }, detail: { value: '50' } });
    prof.onInput({ currentTarget: { dataset: { field: 'heightCm' } }, detail: { value: '152' } });
    prof.onInput({ currentTarget: { dataset: { field: 'weightKg' } }, detail: { value: '45' } });
    prof.onActivityChange({ detail: { value: 0 } });
    prof.onGoalChange({ detail: { value: 0 } });
    prof.onSave();

    assert.equal(prof.data.targets.tdee, 1187);
    assert.ok(prof.data.targets.calories <= 1187);

    const profTree = renderWxml(loadWxml('pages/profile/profile.wxml'), prof.data);
    for (const hint of findVNodes(profTree, n => hasClass(n, 'clamp-hint'))) {
      assert.equal(/最低[^0-9]*1200\s*kcal|1200\s*kcal\s*兜底/.test(getVNodeText(hint)), false);
    }

    // Log ~1195 kcal via record page (below 1200, yet above 1187!)
    const rec = h.switchTab('record');
    const oats = getFoodById('019012');
    const gramsFor1195 = Math.round((1195 / oats.calories) * 100);
    rec.onSelectFood({ currentTarget: { dataset: { id: oats.id } } });
    rec.onGramsInput({ detail: { value: String(gramsFor1195) } });
    rec.onSave();
    rec.navToToday();

    const today = h.switchTab('today');
    assert.equal(today.data.advice.calorieState, 'over');
    const todayTree = renderWxml(loadWxml('pages/today/today.wxml'), today.data);
    const advCard = findVNodes(todayTree, n => hasClass(n, 'advice-card'))[0];
    assert.equal(getVNodeText(advCard).includes('推荐补充'), false);
  });

  test('E2E-T4-04: Male muscle-gain full day with fractional weights and 10-item precision', () => {
    withWxMock();
    const day = '2026-11-24';
    const targets = calcTargets(BOUNDARY_PROFILES.maleGain);
    assert.equal(targets.goal, 'gain');
    assert.equal(targets.calories, targets.tdee + 300);

    const basket = [
      ['111204', 137, '早餐'],
      ['019012', 63, '早餐'],
      ['031405', 275, '早餐'],
      ['091112', 165, '午餐'],
      ['012401x', 215, '午餐'],
      ['045217', 115, '午餐'],
      ['082118', 133, '晚餐'],
      ['021205', 185, '晚餐'],
      ['045301', 145, '晚餐'],
      ['071014', 27, '加餐']
    ];
    for (const [id, g, meal] of basket) {
      records.saveRecord(buildRecordInput(id, g, meal, day));
    }
    const dayRecords = records.loadDayRecords(day);
    assert.equal(dayRecords.length, 10);
    assert.deepEqual(records.calcTotalsFromRecords(dayRecords), independentSumThenRound(dayRecords));

    const adv = generateAdvice(records.calcDayTotals(day), targets, { mealTime: 'dinner', seed: 't404' });
    assert.ok(adv.habits.every(h => HABIT_COPY.gain.includes(h)));
    for (const r of adv.recommendations) {
      const f = TAGGED_FOODS.find(x => x.id === r.id);
      assert.equal(hasTag(f, 'excluded'), false);
      assert.equal(hasTag(f, 'processed'), false);
    }
  });

  test('E2E-T4-05: Backfill yesterday preserved across background resume, saved to yesterday, then exited to today', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T11:00:00') });
    const h = createMiniProgramHarness({
      initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
    });
    h.pages.today.onPrevDay();
    assert.equal(h.pages.today.data.dateKey, '2026-11-23');
    h.pages.today.navToRecord();

    const rec = h.switchTab('record');
    assert.equal(rec.data.recordDateKey, '2026-11-23');
    assert.equal(rec.data.isBackfill, true);

    rec.onInput({ detail: { value: '水煮蛋' } });
    t.mock.timers.tick(150);
    const eggHit = rec.data.results.find(f => f.id === '111204') || rec.data.results[0];
    rec.onSelectFood({ currentTarget: { dataset: { id: eggHit.id } } });

    // Background -> foreground resume must keep backfill date & modal
    h.simulateBackgroundResume('record');
    assert.equal(rec.data.recordDateKey, '2026-11-23');
    assert.equal(rec.data.isBackfill, true);
    assert.ok(rec.data.selectedFood);

    rec.onSave();
    assert.equal(h.wxMock.store.records['2026-11-23'].length, 1);
    assert.equal(h.wxMock.store.records['2026-11-24'], undefined);

    const exitHandler = discoverWxmlTapHandler(loadWxml('pages/record/record.wxml'), rec.data, /切回今天|退出补记|回到今天|返回今天/);
    assert.ok(exitHandler);
    rec[exitHandler]({});
    assert.equal(rec.data.isBackfill, false);
    assert.equal(rec.data.recordDateKey, '2026-11-24');
  });

  test('E2E-T4-06: Browsing yesterday on today -> tab to record -> save today -> 查看今日 › syncs today + resets stale modal', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-24T14:00:00') });
    const h = createMiniProgramHarness({
      initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
    });
    const today = h.pages.today;
    today.onPrevDay();
    assert.equal(today.data.dateKey, '2026-11-23');

    // User taps bottom TabBar to switch to record (logs for today)
    const rec = h.switchTab('record');
    assert.equal(rec.data.recordDateKey, '2026-11-24');
    assert.equal(rec.data.isBackfill, false);

    rec.onSelectFood({ currentTarget: { dataset: { id: '091112' } } });
    rec.onGramsInput({ detail: { value: '150' } });
    rec.onSave();
    rec.navToToday();

    h.switchTab('today');
    assert.equal(today.data.dateKey, '2026-11-24');
    assert.equal(today.data.isToday, true);
    assert.equal(today.data.records.length, 1);

    // Re-open modal then leave via today + 记一笔 without saving -> stale modal must reset
    h.switchTab('record');
    rec.onSelectFood({ currentTarget: { dataset: { id: '111204' } } });
    h.switchTab('today');
    today.navToRecord();
    h.switchTab('record');
    assert.equal(rec.data.selectedFood, null);
  });

  test('E2E-T4-07: Profile edit sync/cancel rollback + cold-start lazy foodTags low-calorie recovery', () => {
    const h = createMiniProgramHarness({
      initialStore: { profile: BOUNDARY_PROFILES.tdee1500 }
    });
    const p = h.switchTab('profile');
    p.onInput({ currentTarget: { dataset: { field: 'weightKg' } }, detail: { value: '72' } });
    h.switchTab('today');
    h.switchTab('profile');
    // Unsaved edit discarded by onShow()
    assert.equal(p.data.weightKg, '53');

    p.onInput({ currentTarget: { dataset: { field: 'weightKg' } }, detail: { value: '68' } });
    h.wxMock.setModalResponse({ confirm: false, cancel: true });
    p.onSave();
    assert.equal(p.data.weightKg, '53');

    h.wxMock.setModalResponse({ confirm: true, cancel: false });
    p.onInput({ currentTarget: { dataset: { field: 'weightKg' } }, detail: { value: '62' } });
    p.onSave();
    const today = h.switchTab('today');
    assert.equal(today.data.targets.calories, calcTargets({ ...BOUNDARY_PROFILES.tdee1500, weightKg: 62 }).calories);

    // Subprocess cold-start lazy init + low-cal dinner recovery
    const script = [
      "const ft = require('./miniprogram/utils/foodTags');",
      "const lazyBefore = typeof Object.getOwnPropertyDescriptor(ft, 'TAGGED_FOODS').get === 'function';",
      "const picks = ft.pickLowCalorieRecommendations('dinner', 3);",
      "console.log(JSON.stringify({ lazyBefore, picks }));"
    ].join(' ');
    const res = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8' }));
    assert.equal(res.lazyBefore, true);
    assert.equal(res.picks.length, 3);
    assert.equal(new Set(res.picks.map(x => x.name)).size, 3);
    for (const item of res.picks) {
      assert.ok(item.calories > 0 && item.calories <= 100);
      assert.equal(/大葱|小葱|辣椒|鱼丸/.test(item.name), false);
    }
  });
});
