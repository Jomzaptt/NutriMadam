const { FOODS } = require('./foodData');
const { getCategoryTags } = require('./categoryTags');

const THRESHOLDS = {
  highProtein: food => food.protein >= 15,
  healthyFat: food => isHealthyFat(food),
  lowFat: food => food.fat <= 3,
  highCarb: food => food.carbs >= 20,
  highFiber: food => food.fiber >= 3,
  highVitaminA: food => food.vitaminA >= 150,
  highVitaminC: food => food.vitaminC >= 20,
  calciumRich: food => food.calcium >= 100,
  highMagnesium: food => food.magnesium >= 50,
  ironRich: food => food.iron >= 3,
  zincRich: food => food.zinc >= 3,
  lowCalorie: food => food.calories <= 100,
  highCalorie: food => food.calories >= 350
};

const TAG_NAMES = Object.keys(THRESHOLDS);

const NUTRIENT_TO_TAGS = {
  protein: ['highProtein'],
  carbs: ['highCarb'],
  fat: ['healthyFat'],
  fiber: ['highFiber'],
  vitaminA: ['highVitaminA'],
  vitaminC: ['highVitaminC'],
  calcium: ['calciumRich'],
  magnesium: ['highMagnesium'],
  iron: ['ironRich'],
  zinc: ['zincRich']
};

const FALLBACK_TAG = 'whole';

// categoryTags.js 中没有独立的 lunch 标签，dinner 表示「适合正餐」，午餐与晚餐共用该标签。
const MEAL_TO_TAG = {
  breakfast: 'breakfast',
  lunch: 'dinner',
  dinner: 'dinner',
  snack: 'snack'
};

const EXCLUDED_CATEGORIES = new Set([
  '其他类-其他',
  '乳类及其制品-其他',
  '乳类及其制品-奶粉',
  '畜肉类及其制品-其他',
  '薯类淀粉及其制品-淀粉类',
  '蔬菜类及其制品-野生蔬菜类',
  '鱼虾蟹贝类-其他'
]);

// 白凤菜（在嫩茎叶花菜类）、双髻鲨/鲨鱼（在鱼类）、薤［皎头］（cal:1 全零宏量）、麻子籽（纵深防御）、鱼奇油［鱼露、虾油］（调味料）
const EXCLUDED_FOOD_IDS = new Set([
  '045329',
  '121245',
  '121232',
  '044501',
  '192011',
  '121302'
]);

const NON_EVERYDAY_NAME_RE = /配方|婴儿|幼儿|儿童|孕产妇|中老年|蛋白粉|炼乳|奶片|奶皮子|奶渣|脱水|人乳/;

// 姜（保留 047304 洋姜）
const GINGER_FOOD_IDS = new Set(['047301', '047302', '047303']);

// 未脱壳生粮（精确 ID，不误杀 玉米（鲜）/小米/燕麦/稻米（代表值）/小站稻米）
const UNHULLED_GRAIN_IDS = new Set([
  '012211', // 籼稻（红）
  '012303', // 早糯谷
  '013102', // 玉米（白，干）
  '013103', // 玉米（黄，干）
  '013108', // 玉米粒（黄、干）
  '019002', // 糜子（带皮）
  '019006'  // 荞麦（带皮）
]);

// 正餐/低卡排除的辛辣调味葱椒（保留 043124 甜椒、043125 彩椒、洋葱、韭菜、韭黄、韭薹、蒜薹、044106 蒜苗）
const SEASONING_FOOD_IDS = new Set([
  '044202', '044206', '044205', '044203', '044207', '044104',
  '043108', '043109', '043121', '043122', '043123'
]);

const MEAT_SUBCATEGORIES = new Set(['牛', '猪', '羊', '马', '驴', '火鸡', '鸡', '鸭', '鹅']);
const OFFAL_NAME_RE = /肝|肺|肾|心|脑|肠|肚|胃|脾|鞭|血|胰|舌|蹄|爪|尾|头皮|耳|肫|胗|百叶|掌/;
const FATTY_MEAT_NAME_RE = /肥肉|肋条肉|硬肋|头皮|猪脖|奶脯|奶面|猪皮|鸭皮|肉鸡（肥）|母麻鸭|北京填鸭/;

function isAnimalOffal(food, sub) {
  if (!MEAT_SUBCATEGORIES.has(sub)) return false;
  // 排除正常鲜肉部位名「上脑」（082111 牛上脑、083113 羊上脑）
  const normalizedName = food.name.replace(/上脑/g, '');
  return OFFAL_NAME_RE.test(normalizedName);
}

function isHighFatMeat(food, sub) {
  const isMeatCategory = Boolean(
    food.category &&
    (food.category.startsWith('畜肉类及其制品-') || food.category.startsWith('禽肉类及其制品-'))
  );
  if (!MEAT_SUBCATEGORIES.has(sub) && !isMeatCategory) return false;
  return food.fat >= 20 || FATTY_MEAT_NAME_RE.test(food.name);
}

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

  if (GINGER_FOOD_IDS.has(food.id) || SEASONING_FOOD_IDS.has(food.id)) {
    tags.delete('breakfast');
    tags.delete('dinner');
    tags.delete('snack');
    tags.add('limit');
  }

  if (UNHULLED_GRAIN_IDS.has(food.id)) {
    tags.delete('breakfast');
    tags.delete('dinner');
    tags.delete('snack');
    tags.add('limit');
  }

  if (isAnimalOffal(food, sub)) {
    tags.delete('breakfast');
    tags.delete('snack');
    tags.add('limit');
  }

  if (isHighFatMeat(food, sub)) {
    tags.add('limit');
  }

  if (isProcessedFood(food.name)) {
    tags.add('processed');
  }

  if (isNonEverydayFood(food, sub)) {
    tags.add('excluded');
  }

  return tags;
}

function isNonEverydayFood(food, sub) {
  if (!food || food.calories <= 0) return true;
  if (EXCLUDED_FOOD_IDS.has(food.id)) return true;
  if (EXCLUDED_CATEGORIES.has(food.category)) return true;
  if (NON_EVERYDAY_NAME_RE.test(food.name)) return true;
  // 干菌类、干藻类（紫菜（干）是日常食材，保留）不作为日常推荐
  if ((sub === '菌类' || sub === '藻类') && food.name.includes('干') && !food.name.startsWith('紫菜')) return true;
  return false;
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

const PROCESSED_MARKERS = [
  '腊', '腌', '咸', '熏', '酱', '罐头', '肉松', '火腿',
  '香辣', '麻辣', '五香', '孜然', '糖醋', '泡椒', '卤',
  '烧烤', '炸', '酥', '脆', '丸子', '肉脯', '豆豉',
  '（香辣味）',
  '香肠', '午餐肉', '肉干', '风干', '丸', '红烧', '油浸', '盐水浸', '罐装',
  '茶肠', '大肉肠', '蛋清肠', '松江肠', '蒜肠', '红果肠', '午餐肠', '午餐肚', '热狗肠',
  '叉烧', '方腿',
  '油条', '油饼', '油豆腐', '油煎', '带浆', '加糖', '蜜枣', '蜜饯', '葡萄干'
];

function isProcessedFood(name) {
  if (PROCESSED_MARKERS.some(marker => name.includes(marker))) return true;
  if (!name.includes('针扒') && name.includes('扒')) return true;
  if (!name.includes('不加盐') && name.includes('加盐')) return true;
  if (name.includes('烤') && !name.includes('烤麸') && !name.includes('不加盐')) return true;
  return false;
}

function buildTaggedFoods() {
  const tagged = [];
  const byTag = {};
  const allTags = [...TAG_NAMES, 'breakfast', 'dinner', 'snack', 'satiety', 'digest', 'limit', 'whole', 'cook', 'processed', 'excluded'];
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

let taggedFoodsCache = null;

function ensureTaggedFoods() {
  if (!taggedFoodsCache) {
    taggedFoodsCache = buildTaggedFoods();
  }
  return taggedFoodsCache;
}

function isTaggedFoodsInitialized() {
  return taggedFoodsCache !== null;
}

function hasTag(food, tag) {
  return !!(food.tags && food.tags.has(tag));
}

function isRecommendable(food) {
  return !hasTag(food, 'limit') && !hasTag(food, 'processed') && !hasTag(food, 'excluded');
}

function findFoodsByTag(tag) {
  return ensureTaggedFoods().byTag[tag] || [];
}

function pickRandomItems(array, count, rng = Math.random) {
  if (!array || array.length === 0 || count <= 0) return [];
  const pool = array.slice();
  if (count >= pool.length) return shuffleArray(pool, rng);

  for (let i = 0; i < count; i++) {
    const j = Math.min(pool.length - 1, i + Math.floor(rng() * (pool.length - i)));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function shuffleArray(array, rng = Math.random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function pickRecommendationsByGaps(gaps, mealTime, options = {}) {
  const { maxCount = 4, excludeNames = [], goal = 'maintain', rng = Math.random } = options;
  const recommendations = [];
  const addedNames = new Set(excludeNames);
  const mealTag = MEAL_TO_TAG[mealTime] || null;
  const avoidHighCalorie = goal === 'lose';

  for (const gap of gaps) {
    if (recommendations.length >= maxCount) break;

    const tags = NUTRIENT_TO_TAGS[gap.key];
    if (!tags || tags.length === 0) continue;

    const pool = buildTagPool(tags);
    const picked = tryPickFromPool(pool, mealTag, recommendations, addedNames, 1, avoidHighCalorie, rng);
    if (picked > 0) continue;

    const fallbackPool = findFoodsByTag(FALLBACK_TAG);
    tryPickFromPool(fallbackPool, mealTag, recommendations, addedNames, 1, avoidHighCalorie, rng);
  }

  if (recommendations.length === 0) {
    const fallbackTag = mealTag || FALLBACK_TAG;
    const pool = findFoodsByTag(fallbackTag);
    tryPickFromPool(pool, null, recommendations, addedNames, Math.min(2, maxCount), avoidHighCalorie, rng);
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

function tryPickFromPool(pool, mealTag, recommendations, addedNames, count = 1, avoidHighCalorie = false, rng = Math.random) {
  const available = pool.filter(f => !addedNames.has(f.name) && isRecommendable(f));
  if (available.length === 0) return 0;

  const calFiltered = avoidHighCalorie ? available.filter(f => !hasTag(f, 'highCalorie')) : available;
  const basePool = calFiltered.length > 0 ? calFiltered : available;
  const targetPool = mealTag ? basePool.filter(f => hasTag(f, mealTag)) : basePool;
  const source = uniqueByName(targetPool.length > 0 ? targetPool : basePool);

  const picked = pickRandomItems(source, Math.min(count, source.length), rng);
  for (const food of picked) {
    recommendations.push(food);
    addedNames.add(food.name);
  }
  return picked.length;
}

function pickLowCalorieRecommendations(mealTime, maxCount = 3, optionsOrRng = {}) {
  const options = typeof optionsOrRng === 'function' ? { rng: optionsOrRng } : (optionsOrRng || {});
  const { rng = Math.random, excludeNames = [] } = options;
  const excluded = new Set(excludeNames);
  const mealTag = MEAL_TO_TAG[mealTime] || 'dinner';
  const fullPool = findFoodsByTag('lowCalorie').filter(
    f => !excluded.has(f.name) && isRecommendable(f)
  );
  const pool = fullPool.filter(f => hasTag(f, mealTag));
  const source = uniqueByName(pool.length > 0 ? pool : fullPool);
  return pickRandomItems(source, maxCount, rng);
}

function uniqueById(array) {
  const seen = new Set();
  return array.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniqueByName(array) {
  const seen = new Set();
  return array.filter(item => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
}

const exportsObj = {
  hasTag,
  findFoodsByTag,
  pickRandomItems,
  pickRecommendationsByGaps,
  pickLowCalorieRecommendations,
  isTaggedFoodsInitialized
};

Object.defineProperty(exportsObj, 'TAGGED_FOODS', {
  enumerable: true,
  configurable: true,
  get() {
    return ensureTaggedFoods().tagged;
  }
});

Object.defineProperty(exportsObj, 'FOODS_BY_TAG', {
  enumerable: true,
  configurable: true,
  get() {
    return ensureTaggedFoods().byTag;
  }
});

module.exports = exportsObj;
