const STORAGE_KEY = 'records';

function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadAllRecords() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch (err) {
    console.error('loadAllRecords failed:', err);
    return {};
  }
}

function saveAllRecords(all) {
  try {
    wx.setStorageSync(STORAGE_KEY, all);
    return true;
  } catch (err) {
    console.error('saveAllRecords failed:', err);
    return false;
  }
}

function loadDayRecords(dateKey) {
  const all = loadAllRecords();
  return Array.isArray(all[dateKey]) ? all[dateKey] : [];
}

function saveRecord(entry) {
  const all = loadAllRecords();
  const dateKey = (entry && entry.dateKey) || getDateKey();
  const prevDay = Array.isArray(all[dateKey]) ? all[dateKey] : [];
  const nextDay = [
    ...prevDay,
    { ...(entry || {}), id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, dateKey }
  ];
  const nextAll = { ...all, [dateKey]: nextDay };
  if (!saveAllRecords(nextAll)) return false;
  return nextDay;
}

function deleteRecord(dateKey, id) {
  const all = loadAllRecords();
  if (!Array.isArray(all[dateKey])) return [];
  const nextDay = all[dateKey].filter(item => item && item.id !== id);
  const nextAll = { ...all, [dateKey]: nextDay };
  if (!saveAllRecords(nextAll)) return false;
  return nextDay;
}

const NUTRIENT_SUM_KEYS = [
  'calories', 'protein', 'carbs', 'fat', 'fiber',
  'vitaminA', 'vitaminC', 'calcium', 'magnesium', 'iron', 'zinc'
];

function round1(value) {
  return Math.round(value * 10) / 10;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function calcTotalsFromRecords(records) {
  const raw = {
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

  if (Array.isArray(records)) {
    for (const item of records) {
      if (!item || typeof item !== 'object') continue;
      for (const key of NUTRIENT_SUM_KEYS) {
        if (Number.isFinite(item[key])) {
          raw[key] += item[key];
        }
      }
    }
  }

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

function calcDayTotals(dateKey) {
  return calcTotalsFromRecords(loadDayRecords(dateKey));
}

module.exports = {
  getDateKey,
  loadAllRecords,
  loadDayRecords,
  saveRecord,
  deleteRecord,
  calcTotalsFromRecords,
  calcDayTotals
};
