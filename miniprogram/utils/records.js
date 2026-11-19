const STORAGE_KEY = 'records';

function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadAllRecords() {
  return wx.getStorageSync(STORAGE_KEY) || {};
}

function loadDayRecords(dateKey) {
  const all = loadAllRecords();
  return all[dateKey] || [];
}

function saveRecord(entry) {
  const all = loadAllRecords();
  const dateKey = entry.dateKey || getDateKey();
  const dayRecords = all[dateKey] || [];
  dayRecords.push({ ...entry, id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, dateKey });
  all[dateKey] = dayRecords;
  wx.setStorageSync(STORAGE_KEY, all);
  return dayRecords;
}

function deleteRecord(dateKey, id) {
  const all = loadAllRecords();
  if (!all[dateKey]) return [];
  all[dateKey] = all[dateKey].filter(item => item.id !== id);
  wx.setStorageSync(STORAGE_KEY, all);
  return all[dateKey];
}

function calcDayTotals(dateKey) {
  const records = loadDayRecords(dateKey);
  return records.reduce((totals, item) => {
    const add = (key, decimals = 1) => {
      const sum = totals[key] + (item[key] || 0);
      return decimals === 2 ? Math.round(sum * 100) / 100 : Math.round(sum * 10) / 10;
    };
    return {
      calories: totals.calories + (item.calories || 0),
      protein: add('protein', 1),
      carbs: add('carbs', 1),
      fat: add('fat', 1),
      fiber: add('fiber', 1),
      vitaminA: add('vitaminA', 1),
      vitaminC: add('vitaminC', 1),
      calcium: add('calcium', 1),
      magnesium: add('magnesium', 1),
      iron: add('iron', 2),
      zinc: add('zinc', 2)
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, vitaminA: 0, vitaminC: 0, calcium: 0, magnesium: 0, iron: 0, zinc: 0 });
}

module.exports = {
  getDateKey,
  loadAllRecords,
  loadDayRecords,
  saveRecord,
  deleteRecord,
  calcDayTotals
};
