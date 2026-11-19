const { FOODS } = require('./foodData');
const { getCategoryTags } = require('./categoryTags');

const THRESHOLDS = {
  highProtein: food => food.protein >= 15,
  healthyFat: food => isHealthyFat(food),
  lowFat: food => food.fat <= 3,
  highCarb: food => food.carbs >= 20,
  highFiber: food => food.fiber >= 3,
  highVitaminC: food => food.vitaminC >= 20,
  calciumRich: food => food.calcium >= 100,
  highMagnesium: food => food.magnesium >= 50,
  ironRich: food => food.iron >= 3,
  lowCalorie: food => food.calories <= 100,
  highCalorie: food => food.calories >= 350
};

const TAG_NAMES = Object.keys(THRESHOLDS);

const NUTRIENT_TO_TAGS = {
  protein: ['highProtein'],
  carbs: ['highCarb'],
  fat: ['healthyFat'],
  fiber: ['highFiber'],
  vitaminC: ['highVitaminC'],
  calcium: ['calciumRich'],
  magnesium: ['highMagnesium'],
  iron: ['ironRich']
};

const FALLBACK_TAG = 'whole';

// categoryTags.js 中没有独立的 lunch 标签，dinner 表示「适合正餐」，午餐与晚餐共用该标签。
const MEAL_TO_TAG = {
  breakfast: 'breakfast',
  lunch: 'dinner',
  dinner: 'dinner',
  snack: 'snack'
};

function computeFoodTags(food) {
  const tags = new Set();
  for (const tag of TAG_NAMES) {
    if (THRESHOLDS[tag](food)) {
      tags.add(tag);
    }
  }

  const sub = extractSubcategory(food.category);
  const categoryTags = getCategoryTags(sub);
  if (categoryTags) {
    for (const key of ['breakfast', 'dinner', 'snack', 'satiety', 'digest', 'limit', 'whole', 'cook']) {
      if (categoryTags[key]) {
        tags.add(key);
      }
    }
  }

  if (isProcessedFood(food.name)) {
    tags.add('processed');
  }

  return tags;
}

function extractSubcategory(category) {
  if (!category) return '';
  const parts = category.split('-');
  return parts.length >= 2 ? parts[1] : category;
}

function isHealthyFat(food) {
  const sub = extractSubcategory(food.category);
  if (['树坚果', '种子'].includes(sub) && food.fat >= 15) return true;
  if (sub === '鱼' && food.fat >= 5 && !isProcessedFood(food.name)) return true;
  if (food.name.includes('鳄梨') || food.name.includes('牛油果')) return true;
  return false;
}

function isProcessedFood(name) {
  const markers = [
    '腊', '腌', '咸', '熏', '酱', '罐头', '肉松', '火腿',
    '香辣', '麻辣', '五香', '孜然', '糖醋', '泡椒', '卤',
    '烧烤', '炸', '酥', '脆', '丸子', '肉脯', '豆豉',
    '（香辣味）'
  ];
  return markers.some(marker => name.includes(marker));
}

function buildTaggedFoods() {
  const tagged = [];
  const byTag = {};
  const allTags = [...TAG_NAMES, 'breakfast', 'dinner', 'snack', 'satiety', 'digest', 'limit', 'whole', 'cook', 'processed'];
  for (const tag of allTags) {
    byTag[tag] = [];
  }

  for (const food of FOODS) {
    const tags = computeFoodTags(food);
    const item = { ...food, tags };
    tagged.push(item);
    for (const tag of tags) {
      if (byTag[tag]) {
        byTag[tag].push(item);
      }
    }
  }

  return { tagged, byTag };
}

const { tagged: TAGGED_FOODS, byTag: FOODS_BY_TAG } = buildTaggedFoods();

function hasTag(food, tag) {
  return food.tags && food.tags.has(tag);
}

function findFoodsByTag(tag) {
  return FOODS_BY_TAG[tag] || [];
}

function pickRandomItems(array, count) {
  if (array.length === 0) return [];
  if (count >= array.length) return shuffleArray([...array]);

  const picked = [];
  const used = new Set();
  while (picked.length < count) {
    const index = Math.floor(Math.random() * array.length);
    if (used.has(index)) continue;
    used.add(index);
    picked.push(array[index]);
  }
  return picked;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function pickRecommendationsByGaps(gaps, mealTime, options = {}) {
  const { maxCount = 4, excludeNames = [] } = options;
  const recommendations = [];
  const addedNames = new Set(excludeNames);
  const mealTag = MEAL_TO_TAG[mealTime] || null;

  for (const gap of gaps) {
    if (recommendations.length >= maxCount) break;

    const tags = NUTRIENT_TO_TAGS[gap.key];
    if (!tags || tags.length === 0) continue;

    const pool = buildTagPool(tags);
    const picked = tryPickFromPool(pool, mealTag, recommendations, addedNames);
    if (picked > 0) continue;

    const fallbackPool = findFoodsByTag(FALLBACK_TAG);
    tryPickFromPool(fallbackPool, mealTag, recommendations, addedNames);
  }

  if (recommendations.length === 0) {
    const fallbackTag = mealTag || FALLBACK_TAG;
    const pool = findFoodsByTag(fallbackTag);
    tryPickFromPool(pool, null, recommendations, addedNames, Math.min(2, maxCount));
  }

  return recommendations.slice(0, maxCount);
}

function buildTagPool(tags) {
  let pool = [];
  for (const tag of tags) {
    pool = pool.concat(findFoodsByTag(tag));
  }
  return uniqueById(pool);
}

function tryPickFromPool(pool, mealTag, recommendations, addedNames, count = 1) {
  const available = pool.filter(f => !addedNames.has(f.name) && !hasTag(f, 'limit') && !hasTag(f, 'processed'));
  const targetPool = mealTag ? available.filter(f => hasTag(f, mealTag)) : available;
  const source = targetPool.length > 0 ? targetPool : available;

  if (source.length === 0) return 0;

  const picked = pickRandomItems(source, Math.min(count, source.length));
  for (const food of picked) {
    recommendations.push(food);
    addedNames.add(food.name);
  }
  return picked.length;
}

function pickLowCalorieRecommendations(mealTime, maxCount = 3) {
  const mealTag = MEAL_TO_TAG[mealTime] || 'dinner';
  const fullPool = findFoodsByTag('lowCalorie').filter(f => !hasTag(f, 'limit') && !hasTag(f, 'processed'));
  const pool = fullPool.filter(f => hasTag(f, mealTag));
  return pickRandomItems(pool.length > 0 ? pool : fullPool, maxCount);
}

function uniqueById(array) {
  const seen = new Set();
  return array.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

module.exports = {
  TAGGED_FOODS,
  FOODS_BY_TAG,
  hasTag,
  findFoodsByTag,
  pickRandomItems,
  pickRecommendationsByGaps,
  pickLowCalorieRecommendations
};
