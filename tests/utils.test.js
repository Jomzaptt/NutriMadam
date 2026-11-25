const test = require('node:test');
const assert = require('node:assert/strict');

const { calcTargets, MIN_CALORIES } = require('../miniprogram/utils/tdee');
const { searchFoods, getFoodById, calcNutrients } = require('../miniprogram/utils/foodData');
const { hasTag, pickRecommendationsByGaps, pickLowCalorieRecommendations } = require('../miniprogram/utils/foodTags');
const { generateAdvice, computeNutrientGaps } = require('../miniprogram/utils/advice');
const { CALORIE_COPY, CALORIE_COPY_BY_MEAL, HABIT_COPY } = require('../miniprogram/utils/adviceCopy');
const records = require('../miniprogram/utils/records');

const EMPTY_TOTALS = {
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
};

test('calcTargets returns goal and DRIs by gender/age', () => {
  const lose = calcTargets({
    gender: 'female',
    age: 28,
    heightCm: 162,
    weightKg: 55,
    activity: 'light',
    goal: 'lose'
  });
  assert.equal(lose.goal, 'lose');
  assert.equal(lose.calories >= MIN_CALORIES, true);
  assert.equal(lose.vitaminA, 700);
  assert.equal(lose.calcium, 800);
  assert.equal(lose.iron, 20);

  const seniorMale = calcTargets({
    gender: 'male',
    age: 55,
    heightCm: 172,
    weightKg: 70,
    activity: 'moderate',
    goal: 'gain'
  });
  assert.equal(seniorMale.goal, 'gain');
  assert.equal(seniorMale.vitaminA, 800);
  assert.equal(seniorMale.calcium, 1000);
});

test('searchFoods handles whitespace, limits count, and ranks exact/prefix matches first', () => {
  assert.deepEqual(searchFoods(''), []);
  assert.deepEqual(searchFoods('   '), []);
  assert.deepEqual(searchFoods(null), []);

  const many = searchFoods('肉');
  assert.equal(many.length, 50);

  const exactSearch = searchFoods('鸡蛋');
  assert.ok(exactSearch.length > 0);
  assert.ok(exactSearch[0].name.startsWith('鸡蛋'));

  const nutrients = calcNutrients(exactSearch[0], 150);
  assert.equal(nutrients.calories, Math.round(exactSearch[0].calories * 1.5));
});

test('computeNutrientGaps ranks by ratio/macro priority instead of raw mg magnitude', () => {
  const targets = calcTargets({
    gender: 'male',
    age: 28,
    heightCm: 175,
    weightKg: 70,
    activity: 'moderate',
    goal: 'lose'
  });

  const gaps = computeNutrientGaps(EMPTY_TOTALS, targets);
  assert.equal(gaps[0].key, 'protein');
  assert.equal(gaps[1].key, 'carbs');

  const macrosMet = {
    ...EMPTY_TOTALS,
    calories: 1800,
    protein: targets.protein,
    carbs: targets.carbs,
    fat: targets.fat,
    fiber: targets.fiber,
    calcium: targets.calcium * 0.9,
    iron: 0
  };
  const microGaps = computeNutrientGaps(macrosMet, targets);
  assert.ok(microGaps.some(g => g.key === 'iron'));
  assert.ok(!microGaps.some(g => g.key === 'calcium'));
});

test('generateAdvice respects goal, formats {pct} with %, avoids over-calorie contradictions, and stays deterministic', () => {
  const loseTargets = calcTargets({
    gender: 'female',
    age: 26,
    heightCm: 165,
    weightKg: 58,
    activity: 'light',
    goal: 'lose'
  });
  const gainTargets = calcTargets({
    gender: 'male',
    age: 26,
    heightCm: 178,
    weightKg: 70,
    activity: 'moderate',
    goal: 'gain'
  });

  const loseAdvice1 = generateAdvice(EMPTY_TOTALS, loseTargets, { mealTime: 'lunch', seed: 'test-seed-1' });
  const loseAdvice2 = generateAdvice(EMPTY_TOTALS, loseTargets, { mealTime: 'lunch', seed: 'test-seed-1' });
  assert.deepEqual(loseAdvice1, loseAdvice2);
  assert.ok(loseAdvice1.habits.every(h => HABIT_COPY.lose.includes(h)));

  const gainAdvice = generateAdvice(EMPTY_TOTALS, gainTargets, { mealTime: 'dinner', seed: 'test-seed-2' });
  assert.ok(gainAdvice.habits.every(h => HABIT_COPY.gain.includes(h)));

  for (const rec of loseAdvice1.recommendations) {
    assert.ok(rec.id && rec.name);
    const found = getFoodById(rec.id);
    assert.ok(found);
    assert.equal(found.name, rec.name);
  }

  // Over-calorie state should not append nutrient gap lines
  const overTotals = { ...EMPTY_TOTALS, calories: loseTargets.calories + 300 };
  const overAdvice = generateAdvice(overTotals, loseTargets, { mealTime: 'dinner', seed: 'over-seed' });
  assert.equal(overAdvice.summary.length, 1);
  assert.ok(CALORIE_COPY.over.lose.includes(overAdvice.summary[0]));

  // Verify no unresolved placeholders or missing % on {pct} across many seeds
  for (let i = 0; i < 40; i++) {
    const a = generateAdvice(
      { ...EMPTY_TOTALS, calories: Math.round(gainTargets.calories * 0.9) },
      gainTargets,
      { mealTime: 'dinner', seed: `pct-check-${i}` }
    );
    for (const line of a.summary) {
      assert.ok(!/\{(remaining|gap|pct)\}/.test(line), `Unresolved placeholder in: ${line}`);
      if (line.includes('完成度')) {
        assert.match(line, /\d+%/, `Missing % sign in: ${line}`);
      }
    }
  }
});

test('foodTags filters out non-everyday foods and respects lose goal', () => {
  const targets = calcTargets({
    gender: 'female',
    age: 30,
    heightCm: 160,
    weightKg: 55,
    activity: 'light',
    goal: 'lose'
  });
  const gaps = computeNutrientGaps(EMPTY_TOTALS, targets);
  const badPattern = /配方|婴儿|幼儿|儿童|孕产妇|炼乳|奶片|奶皮子|奶渣|团螵蛸|刺猬皮|蜂蛹|乌梢蛇/;

  for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
    for (let i = 0; i < 15; i++) {
      const recs = pickRecommendationsByGaps(gaps, mealTime, { maxCount: 4, goal: 'lose' });
      assert.ok(recs.length > 0);
      for (const food of recs) {
        assert.equal(hasTag(food, 'excluded'), false, `Excluded food leaked: ${food.name}`);
        assert.equal(hasTag(food, 'limit'), false, `Limit food leaked: ${food.name}`);
        assert.equal(hasTag(food, 'processed'), false, `Processed food leaked: ${food.name}`);
        assert.ok(!badPattern.test(food.name), `Non-everyday food leaked: ${food.name}`);
        assert.equal(hasTag(food, 'highCalorie'), false, `High-calorie food leaked for lose: ${food.name}`);
      }
    }

    const lowCal = pickLowCalorieRecommendations(mealTime, 3);
    assert.ok(lowCal.length > 0);
    for (const food of lowCal) {
      assert.equal(hasTag(food, 'excluded'), false);
      assert.ok(food.calories <= 100);
    }
  }
});

test('records storage CRUD and calcTotalsFromRecords work and handle storage errors', () => {
  const store = {};
  global.wx = {
    getStorageSync(key) {
      return store[key];
    },
    setStorageSync(key, val) {
      store[key] = val;
    }
  };

  const day = '2026-11-20';
  records.saveRecord({
    dateKey: day,
    foodId: '1',
    foodName: '鸡蛋',
    grams: 100,
    meal: '早餐',
    calories: 144,
    protein: 13.3,
    carbs: 2.8,
    fat: 8.8,
    fiber: 0,
    vitaminA: 234,
    vitaminC: 0,
    calcium: 56,
    magnesium: 10,
    iron: 2,
    zinc: 1.1
  });
  records.saveRecord({
    dateKey: day,
    foodId: '2',
    foodName: '米饭',
    grams: 100,
    meal: '午餐',
    calories: 116,
    protein: 2.6,
    carbs: 25.9,
    fat: 0.3,
    fiber: 0.3,
    vitaminA: 0,
    vitaminC: 0,
    calcium: 7,
    magnesium: 15,
    iron: 1.3,
    zinc: 0.92
  });

  const dayRecords = records.loadDayRecords(day);
  assert.equal(dayRecords.length, 2);

  const totals = records.calcTotalsFromRecords(dayRecords);
  assert.equal(totals.calories, 260);
  assert.equal(totals.protein, 15.9);
  assert.equal(totals.iron, 3.3);
  assert.equal(totals.zinc, 2.02);

  records.deleteRecord(day, dayRecords[0].id);
  assert.equal(records.loadDayRecords(day).length, 1);
  assert.equal(records.calcDayTotals(day).calories, 116);

  // Storage read failure resilience
  global.wx.getStorageSync = () => {
    throw new Error('storage corrupted');
  };
  assert.deepEqual(records.loadAllRecords(), {});
});

// ============================================================================
// 回归测试：覆盖本轮 12 项修复（数据、推荐安全、搜索、建议引擎、存储、TDEE）
// ============================================================================

const { TAGGED_FOODS } = require('../miniprogram/utils/foodTags');
const { calcBMR } = require('../miniprogram/utils/tdee');
const { pickCalorieLine, ensureNutrientPrefix } = require('../miniprogram/utils/advice');

const EVENING_RE = /晚餐|晚上|睡前|最后这一餐|收尾|晚餐后|加一餐/;

function seqRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function taggedByName(name) {
  return TAGGED_FOODS.find(f => f.name === name);
}

test('regression: plant oils have realistic calories and no recommendable food has 0 kcal', () => {
  const oils = require('../miniprogram/utils/foodData').FOODS.filter(f => f.category === '植物油-植物油' && f.fat >= 90);
  assert.ok(oils.length >= 15);
  for (const oil of oils) {
    assert.ok(oil.calories >= 895 && oil.calories <= 900, `${oil.name} calories=${oil.calories}`);
  }
  for (const food of TAGGED_FOODS) {
    if (food.calories <= 0) {
      assert.equal(hasTag(food, 'excluded'), true, `0 kcal food not excluded: ${food.name}`);
    }
  }
});

test('regression: risky, processed, fatty and offal foods are never recommended', () => {
  for (const name of ['喷瓜', '乌龟（龟板）', '猪肥肉（肥，fat89g）', '香肠', '鱼丸']) {
    const food = taggedByName(name);
    assert.ok(food, `missing food ${name}`);
    assert.ok(
      hasTag(food, 'excluded') || hasTag(food, 'limit') || hasTag(food, 'processed'),
      `${name} should not be recommendable`
    );
  }

  const ginger = taggedByName('姜（鲜）［黄姜］');
  for (const meal of ['breakfast', 'dinner', 'snack']) {
    assert.equal(hasTag(ginger, meal), false, `ginger must not be tagged ${meal}`);
  }

  // 确定性断言：这些条目必须被排除/限制，不依赖随机抽样是否抽到
  const mustBlockIds = ['121245', '045329', '013102', '013103', '012211', '044501', '192011'];
  for (const id of mustBlockIds) {
    const food = TAGGED_FOODS.find(f => f.id === id);
    if (!food) continue;
    assert.ok(hasTag(food, 'excluded') || hasTag(food, 'limit'), `${id} ${food.name} should be blocked`);
  }
  for (const re of [/^牛脑$/, /^牛肺$/, /^猪大肠$/, /^大葱/, /^葱（小葱/, /^辣椒（红，小）/]) {
    const hits = TAGGED_FOODS.filter(f => re.test(f.name));
    assert.ok(hits.length > 0, `no food matches ${re}`);
    for (const f of hits) assert.ok(hasTag(f, 'excluded') || hasTag(f, 'limit'), `${f.name} should be blocked`);
  }

  const gaps = computeNutrientGaps(EMPTY_TOTALS, calcTargets({
    gender: 'male', age: 30, heightCm: 175, weightKg: 70, activity: 'moderate', goal: 'maintain'
  }));
  const bad = /喷瓜|龟板|鱼翅|肥肉|香肠|鱼丸|牛脑|牛肺|猪大肠|大葱|辣椒/;
  for (const mealTime of ['breakfast', 'lunch', 'dinner', 'snack']) {
    for (let i = 0; i < 20; i++) {
      const recs = pickRecommendationsByGaps(gaps, mealTime, { maxCount: 6, rng: seqRng(i + 1) });
      const names = recs.map(f => f.name);
      assert.equal(new Set(names).size, names.length, 'recommendations must be unique by name');
      for (const food of recs) assert.ok(!bad.test(food.name), `bad food recommended: ${food.name}`);
    }
    const low = pickLowCalorieRecommendations(mealTime, 8, { rng: seqRng(99) });
    const lowNames = low.map(f => f.name);
    assert.equal(new Set(lowNames).size, lowNames.length);
    for (const food of low) assert.ok(food.calories > 0 && food.calories <= 100);

    // 请求数量大于候选池：旧实现会把重名条目都返回，去重后每个名字只能出现一次
    const whole = pickLowCalorieRecommendations(mealTime, 100000, { rng: seqRng(5) });
    const wholeNames = whole.map(f => f.name);
    assert.equal(new Set(wholeNames).size, wholeNames.length, 'low-calorie pool must be deduped by name');
  }
});

test('regression: fried/sugary foods are not recommendable but laver stays', () => {
  for (const name of ['油条', '油饼', '油豆腐', '荷包蛋（油煎）', '烧饼（加糖）', '蜜枣［椰枣］', '葡萄干']) {
    const food = taggedByName(name);
    assert.ok(food, `missing ${name}`);
    assert.ok(hasTag(food, 'processed') || hasTag(food, 'limit') || hasTag(food, 'excluded'), `${name} should be blocked`);
  }
  const laver = taggedByName('紫菜（干）');
  assert.ok(laver);
  assert.equal(hasTag(laver, 'excluded'), false);
  assert.equal(searchFoods('白米饭').length > 0, true);
});

test('regression: foodTags builds its tag index lazily', () => {
  const modulePath = require.resolve('../miniprogram/utils/foodTags');
  const saved = require.cache[modulePath];
  delete require.cache[modulePath];
  try {
    const fresh = require('../miniprogram/utils/foodTags');
    assert.equal(fresh.isTaggedFoodsInitialized(), false);
    assert.ok(fresh.findFoodsByTag('lowCalorie').length > 0);
    assert.equal(fresh.isTaggedFoodsInitialized(), true);
  } finally {
    require.cache[modulePath] = saved;
  }
});

test('regression: searchFoods resolves colloquial names and full/half-width brackets', () => {
  assert.equal(searchFoods('鸡胸肉')[0].name, '鸡胸脯肉');
  assert.equal(searchFoods('牛油果')[0].name, '鳄梨');
  assert.equal(searchFoods('水煮蛋')[0].name, '鸡蛋（煮）');
  assert.ok(searchFoods('圣女果').length > 0);
  assert.ok(searchFoods('鸡蛋(煮)').some(f => f.name === '鸡蛋（煮）'));
  assert.deepEqual(searchFoods('鸡蛋', 0), []);
});

test('regression: records report storage write failures and sum before rounding', () => {
  const store = {};
  global.wx = {
    getStorageSync: key => store[key],
    setStorageSync: (key, val) => { store[key] = val; }
  };
  const day = '2026-11-21';
  const saved = records.saveRecord({ dateKey: day, foodName: 'a', calories: 1 });
  assert.ok(Array.isArray(saved) && saved.length === 1);

  global.wx.setStorageSync = () => { throw new Error('quota exceeded'); };
  assert.equal(records.saveRecord({ dateKey: day, foodName: 'b', calories: 1 }), false);
  assert.equal(records.deleteRecord(day, saved[0].id), false);
  global.wx.setStorageSync = (key, val) => { store[key] = val; };
  assert.equal(records.loadDayRecords(day).length, 1, 'failed writes must not change stored data');

  // 每条 0.04 g：逐步舍入会得到 0，先求和再舍入应为 0.4
  const many = Array.from({ length: 10 }, () => ({ calories: 0.4, protein: 0.04, iron: 0.004 }));
  const totals = records.calcTotalsFromRecords(many);
  assert.equal(totals.protein, 0.4);
  assert.equal(totals.calories, 4);
  assert.equal(totals.iron, 0.04);
});

test('regression: calcTargets never exceeds TDEE for small bodies and rejects invalid input', () => {
  const small = calcTargets({ gender: 'female', age: 55, heightCm: 150, weightKg: 42, activity: 'sedentary', goal: 'lose' });
  assert.ok(small.tdee < MIN_CALORIES);
  assert.ok(small.calories <= small.tdee);

  const normal = calcTargets({ gender: 'male', age: 30, heightCm: 178, weightKg: 75, activity: 'moderate', goal: 'lose' });
  assert.ok(normal.calories >= MIN_CALORIES);

  assert.equal(calcTargets(null), null);
  assert.equal(calcTargets({ gender: 'male', age: 'abc', heightCm: 170, weightKg: 60, goal: 'lose' }), null);
  assert.equal(calcBMR({ gender: 'male', age: 30, heightCm: NaN, weightKg: 60 }), null);
});

test('regression: advice covers 10 nutrients, respects meal time, and keeps nutrient subjects', () => {
  const targets = calcTargets({ gender: 'female', age: 28, heightCm: 162, weightKg: 55, activity: 'light', goal: 'maintain' });
  const gapKeys = computeNutrientGaps(EMPTY_TOTALS, targets).map(g => g.key);
  assert.ok(gapKeys.includes('vitaminA'));
  assert.ok(gapKeys.includes('zinc'));

  for (const state of ['over', 'near', 'gap']) {
    for (const goal of ['lose', 'maintain', 'gain']) {
      // 确定性：时段文案库的早餐/午餐池里不能有晚间句子，且回退池经过滤后也不会取到
      for (const mealTime of ['breakfast', 'lunch']) {
        const pool = CALORIE_COPY_BY_MEAL[state][goal][mealTime];
        assert.ok(Array.isArray(pool) && pool.length > 0);
        for (const line of pool) assert.ok(!EVENING_RE.test(line), `evening line in ${state}.${goal}.${mealTime}: ${line}`);
        for (let i = 0; i < 25; i++) {
          const line = pickCalorieLine(state, goal, mealTime, seqRng(i + 7));
          assert.ok(!EVENING_RE.test(line), `evening line for ${mealTime}: ${line}`);
        }
      }
    }
  }

  const fixed = ensureNutrientPrefix('缺口 {gap}，训练后加餐吃香蕉配花生酱，碳水蛋白都够。', 'protein', '30g');
  assert.ok(fixed.startsWith('蛋白质还差'), fixed);
  const untouched = ensureNutrientPrefix('蛋白质还差 {gap}，早餐加一个鸡蛋。', 'protein', '30g');
  assert.ok(untouched.startsWith('蛋白质还差 {gap}'));

  const over = generateAdvice(
    { ...EMPTY_TOTALS, calories: targets.calories + 200 },
    targets,
    { mealTime: 'breakfast', seed: 'over-state' }
  );
  assert.equal(over.calorieState, 'over');
  assert.equal(over.summary.length, 1);
});
