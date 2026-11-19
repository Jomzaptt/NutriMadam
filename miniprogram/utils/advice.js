const { CALORIE_COPY, NUTRIENT_COPY, HABIT_COPY, NUTRIENT_UNITS } = require('./adviceCopy');
const { pickRecommendationsByGaps, pickLowCalorieRecommendations } = require('./foodTags');

const CALORIE_NEAR_RATIO = 0.15;
const GAP_RATIO_THRESHOLD = 0.2;

const NUTRIENT_KEYS = ['protein', 'carbs', 'fat', 'fiber', 'vitaminC', 'calcium', 'magnesium', 'iron'];

function generateAdvice(totals, targets) {
  const goal = targets.goal || 'maintain';
  const remainingCalories = Math.max(0, (targets.calories || 0) - (totals.calories || 0));
  const calorieState = classifyCalorieState(totals.calories, targets.calories);
  const mealTime = getCurrentMealTime();

  const gaps = computeNutrientGaps(totals, targets);
  const summary = buildSummary(totals, targets, goal, remainingCalories, calorieState, mealTime, gaps);
  const recommendations = buildRecommendations(calorieState, gaps, mealTime);
  const habits = pickRandomHabits(goal, 2);

  return {
    summary,
    recommendations,
    habits
  };
}

function classifyCalorieState(total, target) {
  if (target <= 0) return 'gap';
  if (total > target) return 'over';
  if ((target - total) <= target * CALORIE_NEAR_RATIO) return 'near';
  return 'gap';
}

function buildSummary(totals, targets, goal, remainingCalories, calorieState, mealTime, gaps) {
  const summary = [];

  const caloriePct = Math.round(((totals.calories || 0) / Math.max(targets.calories, 1)) * 100);
  const calorieLine = pickCalorieLine(calorieState, goal);
  summary.push(replacePlaceholders(calorieLine, { remaining: remainingCalories, pct: caloriePct }));

  const topGaps = gaps.slice(0, 2);
  for (const gap of topGaps) {
    if (gap.value <= 0) continue;
    const line = pickNutrientLine(goal, gap.key, mealTime);
    if (line) {
      const prefixed = ensureNutrientPrefix(line, gap.key);
      summary.push(replacePlaceholders(prefixed, { gap: `${Math.round(gap.value)}${NUTRIENT_UNITS[gap.key]}` }));
    }
  }

  return summary;
}

function pickCalorieLine(state, goal) {
  const pool = CALORIE_COPY[state]?.[goal] || CALORIE_COPY.gap.maintain;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickNutrientLine(goal, nutrientKey, mealTime) {
  const goalPool = NUTRIENT_COPY[goal] || NUTRIENT_COPY.maintain;
  const nutrientPool = goalPool[nutrientKey];
  if (!nutrientPool) return null;

  const mealPool = nutrientPool[mealTime];
  if (!mealPool || mealPool.length === 0) return null;

  return mealPool[Math.floor(Math.random() * mealPool.length)];
}

function computeNutrientGaps(totals, targets) {
  return NUTRIENT_KEYS
    .map(key => ({
      key,
      value: Math.max(0, (targets[key] || 0) - (totals[key] || 0))
    }))
    .filter(gap => gap.value > (targets[gap.key] || 0) * GAP_RATIO_THRESHOLD)
    .sort((a, b) => b.value - a.value);
}

function buildRecommendations(calorieState, gaps, mealTime) {
  if (calorieState === 'over') {
    const foods = pickLowCalorieRecommendations(mealTime, 3);
    return foods.map(f => f.name);
  }

  const foods = pickRecommendationsByGaps(gaps, mealTime, { maxCount: 4 });
  return foods.map(f => f.name);
}

function pickRandomHabits(goal, count) {
  const pool = HABIT_COPY[goal] || HABIT_COPY.maintain;
  const picked = [];
  const used = new Set();

  while (picked.length < count && used.size < pool.length) {
    const index = Math.floor(Math.random() * pool.length);
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
  return text
    .replace(/\{remaining\}/g, values.remaining ?? '')
    .replace(/\{gap\}/g, values.gap ?? '')
    .replace(/\{pct\}/g, values.pct ?? '');
}

const NUTRIENT_NAMES = {
  protein: '蛋白质',
  carbs: '碳水化合物',
  fat: '脂肪',
  fiber: '膳食纤维',
  vitaminC: '维生素C',
  calcium: '钙',
  magnesium: '镁',
  iron: '铁'
};

const NUTRIENT_ALIASES = {
  vitaminC: ['维C', '维 C', '维生素C'],
  calcium: ['钙'],
  magnesium: ['镁'],
  iron: ['铁'],
  protein: ['蛋白质'],
  carbs: ['碳水化合物', '碳水'],
  fat: ['脂肪'],
  fiber: ['膳食纤维', '纤维']
};

function ensureNutrientPrefix(line, nutrientKey) {
  const aliases = NUTRIENT_ALIASES[nutrientKey] || [];
  const hasKeyword = aliases.some(alias => line.includes(alias));
  if (hasKeyword) return line;

  const name = NUTRIENT_NAMES[nutrientKey];
  return line.replace('缺口 {gap}', `${name}还差 {gap}`);
}

module.exports = { generateAdvice };
