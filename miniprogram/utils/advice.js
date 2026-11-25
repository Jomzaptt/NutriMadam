const { CALORIE_COPY, CALORIE_COPY_BY_MEAL, NUTRIENT_COPY, HABIT_COPY, NUTRIENT_UNITS } = require('./adviceCopy');
const { pickRecommendationsByGaps, pickLowCalorieRecommendations } = require('./foodTags');

const CALORIE_NEAR_RATIO = 0.15;
const GAP_RATIO_THRESHOLD = 0.2;
const EVENING_ONLY_LINE_RE = /晚餐|晚上|睡前|最后这一餐|收尾|晚餐后|加一餐/;

const NUTRIENT_KEYS = [
  'protein', 'carbs', 'fat', 'fiber',
  'vitaminA', 'vitaminC', 'calcium', 'magnesium', 'iron', 'zinc'
];
const MACRO_PRIORITY_KEYS = new Set(['protein', 'carbs', 'fat', 'fiber']);

function hasOwn(obj, key) {
  return Boolean(obj) && typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);
}

function generateAdvice(totals, targets, options = {}) {
  const safeTotals = totals && typeof totals === 'object' ? totals : {};
  const safeTargets = targets && typeof targets === 'object' ? targets : {};
  const safeOptions = options && typeof options === 'object' ? options : {};
  const goal = hasOwn(NUTRIENT_COPY, safeTargets.goal) ? safeTargets.goal : 'maintain';
  const remainingCalories = Math.max(0, Math.round((safeTargets.calories || 0) - (safeTotals.calories || 0)));
  const calorieState = classifyCalorieState(safeTotals.calories || 0, safeTargets.calories || 0);
  const mealTime = safeOptions.mealTime || getCurrentMealTime();

  const gaps = computeNutrientGaps(safeTotals, safeTargets);
  const seed = safeOptions.seed || buildDefaultSeed(goal, mealTime, calorieState, safeTotals, gaps);
  const rng = createSeededRng(seed);

  const summary = buildSummary(safeTotals, safeTargets, goal, remainingCalories, calorieState, mealTime, gaps, rng);
  const recommendations = buildRecommendations(calorieState, gaps, mealTime, goal, rng);
  const habits = pickRandomHabits(goal, 2, rng);

  return {
    summary,
    recommendations,
    habits,
    calorieState
  };
}

function buildDefaultSeed(goal, mealTime, calorieState, totals, gaps) {
  const gapSig = gaps.slice(0, 3).map(g => g.key).join(',');
  return `${goal}|${mealTime}|${calorieState}|${Math.round(totals.calories || 0)}|${gapSig}`;
}

function createSeededRng(seedStr) {
  let h = 2166136261;
  const str = String(seedStr || 'default');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = (h >>> 0) || 1;
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function classifyCalorieState(total, target) {
  if (target <= 0) return 'gap';
  if (total > target) return 'over';
  if ((target - total) <= target * CALORIE_NEAR_RATIO) return 'near';
  return 'gap';
}

function formatGap(key, value) {
  const unit = hasOwn(NUTRIENT_UNITS, key) ? NUTRIENT_UNITS[key] : '';
  const safeValue = Number.isFinite(value) ? value : 0;
  const num = (key === 'iron' || key === 'zinc')
    ? Math.round(safeValue * 10) / 10
    : Math.round(safeValue);
  return `${num}${unit}`;
}

function buildSummary(totals, targets, goal, remainingCalories, calorieState, mealTime, gaps, rng) {
  const summary = [];

  const caloriePct = Math.round(((totals.calories || 0) / Math.max(targets.calories || 0, 1)) * 100);
  const calorieLine = pickCalorieLine(calorieState, goal, mealTime, rng);
  summary.push(replacePlaceholders(calorieLine, {
    remaining: remainingCalories,
    pct: `${caloriePct}%`
  }));

  // 热量已超标时不再输出加餐/加量类营养素缺口建议，避免文案自相矛盾
  if (calorieState === 'over') {
    return summary;
  }

  const topGaps = gaps.slice(0, 2);
  for (const gap of topGaps) {
    if (gap.value <= 0) continue;
    const line = pickNutrientLine(goal, gap.key, mealTime, rng);
    if (line) {
      const gapText = formatGap(gap.key, gap.value);
      const prefixed = ensureNutrientPrefix(line, gap.key, gapText);
      summary.push(replacePlaceholders(prefixed, { gap: gapText }));
    }
  }

  return summary;
}

function pickCalorieLine(state, goal, mealTime, rng) {
  if (typeof mealTime === 'function') {
    rng = mealTime;
    mealTime = undefined;
  }
  const rand = typeof rng === 'function' ? rng : Math.random;

  const byMealState = hasOwn(CALORIE_COPY_BY_MEAL, state) ? CALORIE_COPY_BY_MEAL[state] : null;
  const byMealGoal = hasOwn(byMealState, goal) ? byMealState[goal] : null;
  const mealPool = mealTime && hasOwn(byMealGoal, mealTime) ? byMealGoal[mealTime] : null;
  if (Array.isArray(mealPool) && mealPool.length > 0) {
    return mealPool[Math.floor(rand() * mealPool.length)];
  }

  const statePool = hasOwn(CALORIE_COPY, state) ? CALORIE_COPY[state] : null;
  const pool = (hasOwn(statePool, goal) ? statePool[goal] : null) || CALORIE_COPY.gap.maintain;
  let filtered = pool;
  if (mealTime === 'breakfast' || mealTime === 'lunch') {
    const safe = pool.filter(line => !EVENING_ONLY_LINE_RE.test(line));
    if (safe.length > 0) filtered = safe;
  }
  return filtered[Math.floor(rand() * filtered.length)];
}

function pickNutrientLine(goal, nutrientKey, mealTime, rng) {
  const rand = typeof rng === 'function' ? rng : Math.random;
  const goalPool = hasOwn(NUTRIENT_COPY, goal) ? NUTRIENT_COPY[goal] : NUTRIENT_COPY.maintain;
  const nutrientPool = hasOwn(goalPool, nutrientKey) ? goalPool[nutrientKey] : null;
  if (!nutrientPool) return null;

  const mealPool = hasOwn(nutrientPool, mealTime) ? nutrientPool[mealTime] : null;
  if (!Array.isArray(mealPool) || mealPool.length === 0) return null;

  return mealPool[Math.floor(rand() * mealPool.length)];
}

function computeNutrientGaps(totals, targets) {
  const safeTotals = totals || {};
  const safeTargets = targets || {};
  return NUTRIENT_KEYS
    .map((key, index) => {
      const target = Number.isFinite(safeTargets[key]) ? safeTargets[key] : 0;
      const current = Number.isFinite(safeTotals[key]) ? safeTotals[key] : 0;
      const rawValue = Math.max(0, target - current);
      const ratio = target > 0 ? rawValue / target : 0;
      const value = Math.round(rawValue * 100) / 100;
      const score = ratio + (MACRO_PRIORITY_KEYS.has(key) ? 0.15 : 0);
      return { key, value, ratio, score, index };
    })
    .filter(gap => gap.ratio > GAP_RATIO_THRESHOLD)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index));
}

function buildRecommendations(calorieState, gaps, mealTime, goal, rng) {
  if (calorieState === 'over') {
    const foods = pickLowCalorieRecommendations(mealTime, 3, { rng });
    return foods.map(f => ({ id: f.id, name: f.name }));
  }

  const foods = pickRecommendationsByGaps(gaps, mealTime, { maxCount: 4, goal, rng });
  return foods.map(f => ({ id: f.id, name: f.name }));
}

function pickRandomHabits(goal, count, rng) {
  const rand = typeof rng === 'function' ? rng : Math.random;
  const pool = hasOwn(HABIT_COPY, goal) ? HABIT_COPY[goal] : HABIT_COPY.maintain;
  const picked = [];
  const used = new Set();

  while (picked.length < count && used.size < pool.length) {
    const index = Math.floor(rand() * pool.length);
    if (used.has(index)) continue;
    used.add(index);
    picked.push(pool[index]);
  }

  return picked;
}

function getCurrentMealTime() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 21) return 'dinner';
  return 'snack';
}

function replacePlaceholders(text, values) {
  const remaining = values.remaining != null ? values.remaining : '';
  const gap = values.gap != null ? values.gap : '';
  const pct = values.pct != null ? values.pct : '';
  return text
    .replace(/\{remaining\}/g, remaining)
    .replace(/\{gap\}/g, gap)
    .replace(/\{pct\}/g, pct);
}

const NUTRIENT_NAMES = {
  protein: '蛋白质',
  carbs: '碳水化合物',
  fat: '脂肪',
  fiber: '膳食纤维',
  vitaminA: '维生素A',
  vitaminC: '维生素C',
  calcium: '钙',
  magnesium: '镁',
  iron: '铁',
  zinc: '锌'
};

const NUTRIENT_ALIASES = {
  vitaminA: ['维生素A', '维生素 A', '维A', '维 A'],
  vitaminC: ['维C', '维 C', '维生素C', '维生素 C'],
  calcium: ['钙'],
  magnesium: ['镁'],
  iron: ['铁'],
  zinc: ['锌'],
  protein: ['蛋白质', '蛋白'],
  carbs: ['碳水化合物', '碳水'],
  fat: ['脂肪'],
  fiber: ['膳食纤维', '纤维']
};

function ensureNutrientPrefix(line, nutrientKey, gapText) {
  const text = String(line || '');
  const leadingClause = text.split(/[，,]/)[0];
  const aliases = hasOwn(NUTRIENT_ALIASES, nutrientKey) ? NUTRIENT_ALIASES[nutrientKey] : [];
  if (aliases.some(alias => leadingClause.indexOf(alias) !== -1)) {
    return text;
  }

  const name = hasOwn(NUTRIENT_NAMES, nutrientKey) ? NUTRIENT_NAMES[nutrientKey] : '';
  if (!name) return text;

  const gapDisplay = gapText != null ? String(gapText) : '{gap}';
  if (/^缺口\s*\{gap\}/.test(text)) {
    return text.replace(/^缺口\s*\{gap\}/, `${name}还差 ${gapDisplay}`);
  }
  if (gapText != null && text.indexOf(`缺口 ${gapDisplay}`) === 0) {
    return text.replace(`缺口 ${gapDisplay}`, `${name}还差 ${gapDisplay}`);
  }
  if (/^缺口\s*/.test(text)) {
    return text.replace(/^缺口\s*/, `${name}还差 `);
  }
  return `${name}还差 ${gapDisplay}，${text}`;
}

module.exports = {
  generateAdvice,
  computeNutrientGaps,
  getCurrentMealTime,
  pickCalorieLine,
  ensureNutrientPrefix
};
