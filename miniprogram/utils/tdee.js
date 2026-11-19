// Mifflin-St Jeor 公式计算基础代谢率 (BMR)
function calcBMR({ gender, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

const ACTIVITY_FACTORS = {
  sedentary: 1.2,      // 久坐
  light: 1.375,        // 轻度活动（每周 1-3 次运动）
  moderate: 1.55,      // 中度活动（每周 3-5 次）
  active: 1.725,       // 高度活动（每周 6-7 次）
  very_active: 1.9     // 极高活动（体力劳动/运动员）
};

const GOAL_ADJUSTMENTS = {
  lose: -500,     // 减脂：每日 -500 kcal
  maintain: 0,    // 维持
  gain: 300       // 增肌：每日 +300 kcal
};

// 宏量营养素分配（按目标调整比例）
const MACRO_RATIOS = {
  lose:     { protein: 0.30, fat: 0.30, carbs: 0.40 },
  maintain: { protein: 0.20, fat: 0.30, carbs: 0.50 },
  gain:     { protein: 0.25, fat: 0.25, carbs: 0.50 }
};

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

// 每日最低安全热量（kcal），减脂目标兜底下限
const MIN_CALORIES = 1200;

// 微量营养素分段参考值（依据《中国居民膳食营养素参考摄入量（DRIs）》，RNI 口径）。
// 结构：按性别 → 年龄段（含上界）→ { key: 目标值 }。未命中的年龄段回退到性别默认值。
const MICRO_SEGMENTS = {
  male: {
    calcium: [
      { maxAge: 10, value: 1000 }, { maxAge: 13, value: 1200 }, { maxAge: 17, value: 1000 },
      { maxAge: 49, value: 800 }, { maxAge: 64, value: 800 }, { maxAge: Infinity, value: 1000 }
    ],
    iron: [
      { maxAge: 10, value: 12 }, { maxAge: 13, value: 15 }, { maxAge: 17, value: 16 },
      { maxAge: 49, value: 12 }, { maxAge: Infinity, value: 12 }
    ],
    zinc: [
      { maxAge: 10, value: 7 }, { maxAge: 13, value: 10 }, { maxAge: 17, value: 11.5 },
      { maxAge: Infinity, value: 12.5 }
    ],
    magnesium: [
      { maxAge: 10, value: 160 }, { maxAge: 13, value: 280 }, { maxAge: 17, value: 320 },
      { maxAge: Infinity, value: 330 }
    ]
  },
  female: {
    calcium: [
      { maxAge: 10, value: 1000 }, { maxAge: 13, value: 1200 }, { maxAge: 17, value: 1000 },
      { maxAge: 49, value: 800 }, { maxAge: 64, value: 800 }, { maxAge: Infinity, value: 1000 }
    ],
    iron: [
      { maxAge: 10, value: 12 }, { maxAge: 13, value: 15 }, { maxAge: 17, value: 18 },
      { maxAge: 49, value: 20 }, { maxAge: Infinity, value: 12 }
    ],
    zinc: [
      { maxAge: 10, value: 7 }, { maxAge: 13, value: 9 }, { maxAge: 17, value: 8.5 },
      { maxAge: Infinity, value: 7.5 }
    ],
    magnesium: [
      { maxAge: 10, value: 160 }, { maxAge: 13, value: 280 }, { maxAge: 17, value: 320 },
      { maxAge: Infinity, value: 320 }
    ]
  }
};

function pickMicroTarget(segments, age, fallback) {
  if (!Array.isArray(segments)) return fallback;
  const hit = segments.find(s => age <= s.maxAge);
  return hit ? hit.value : fallback;
}

function calcTargets(profile) {
  const bmr = calcBMR(profile);
  const tdee = Math.round(bmr * (ACTIVITY_FACTORS[profile.activity] || 1.2));
  const rawCalories = tdee + (GOAL_ADJUSTMENTS[profile.goal] || 0);
  const calories = Math.max(MIN_CALORIES, rawCalories);
  const clamped = rawCalories < MIN_CALORIES;

  const ratio = MACRO_RATIOS[profile.goal] || MACRO_RATIOS.maintain;
  const seg = MICRO_SEGMENTS[profile.gender] || {};

  return {
    bmr,
    tdee,
    calories,
    clamped,
    protein: Math.round(calories * ratio.protein / KCAL_PER_GRAM.protein),
    carbs: Math.round(calories * ratio.carbs / KCAL_PER_GRAM.carbs),
    fat: Math.round(calories * ratio.fat / KCAL_PER_GRAM.fat),
    fiber: 25,
    vitaminA: 800,
    vitaminC: 100,
    calcium: pickMicroTarget(seg.calcium, profile.age, 800),
    magnesium: pickMicroTarget(seg.magnesium, profile.age, profile.gender === 'female' ? 310 : 400),
    iron: pickMicroTarget(seg.iron, profile.age, profile.gender === 'female' ? 18 : 12),
    zinc: pickMicroTarget(seg.zinc, profile.age, profile.gender === 'female' ? 8 : 12)
  };
}

module.exports = { calcBMR, calcTargets, ACTIVITY_FACTORS, GOAL_ADJUSTMENTS, MIN_CALORIES };
