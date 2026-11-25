const { loadDayRecords, calcTotalsFromRecords, deleteRecord, getDateKey } = require('../../utils/records');
const { generateAdvice, computeNutrientGaps, getCurrentMealTime } = require('../../utils/advice');

const MACRO_FIELDS = [
  { name: '蛋白质', key: 'protein' },
  { name: '碳水化合物', key: 'carbs' },
  { name: '脂肪', key: 'fat' },
  { name: '膳食纤维', key: 'fiber' }
];

const MICRO_FIELDS = [
  { name: '维生素A', key: 'vitaminA', unit: 'μg' },
  { name: '维生素C', key: 'vitaminC', unit: 'mg' },
  { name: '钙', key: 'calcium', unit: 'mg' },
  { name: '镁', key: 'magnesium', unit: 'mg' },
  { name: '铁', key: 'iron', unit: 'mg' },
  { name: '锌', key: 'zinc', unit: 'mg' }
];

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

Page({
  data: {
    targets: null,
    dateStr: '',
    dateKey: '',
    isToday: true,
    totals: EMPTY_TOTALS,
    isCalorieOver: false,
    calorieOverAmount: 0,
    macroList: [],
    microList: [],
    records: [],
    advice: null
  },

  onShow() {
    const app = getApp();
    const targets = app.globalData.targets;
    const pendingTodayDateKey = app.globalData.pendingTodayDateKey;
    app.globalData.pendingTodayDateKey = null;
    if (app.globalData.resumedRoute) {
      app.globalData.resumedRoute = null;
    }

    const todayKey = getDateKey(new Date());
    let nextDateKey = pendingTodayDateKey || this.data.dateKey;
    // 首次进入或之前停留在“今天”且已跨零点（非外部指定日期跳转），自动切到新的一天
    if (!nextDateKey || (!pendingTodayDateKey && this._lastTodayKey && nextDateKey === this._lastTodayKey && todayKey !== this._lastTodayKey)) {
      nextDateKey = todayKey;
    }
    this._lastTodayKey = todayKey;
    this.refresh(targets, nextDateKey);
  },

  refresh(targets, targetDateKey) {
    const dateKey = targetDateKey || this.data.dateKey || getDateKey(new Date());
    const todayKey = getDateKey(new Date());
    const isToday = dateKey === todayKey;
    const dayData = this.loadDayData(dateKey);

    const isCalorieOver = Boolean(targets && targets.calories > 0 && dayData.totals.calories > targets.calories);
    const calorieOverAmount = isCalorieOver
      ? Math.round(dayData.totals.calories - targets.calories)
      : 0;

    const macroList = targets
      ? MACRO_FIELDS.map(item => {
          const val = dayData.totals[item.key] || 0;
          const tgt = targets[item.key] || 0;
          const pct = tgt > 0 ? Math.min(Math.round((val / tgt) * 100), 100) : 0;
          return {
            name: item.name,
            key: item.key,
            value: val,
            target: tgt,
            pct,
            isOver: tgt > 0 && val > tgt
          };
        })
      : [];

    const microList = targets
      ? MICRO_FIELDS.map(item => ({
          name: item.name,
          key: item.key,
          unit: item.unit,
          value: dayData.totals[item.key] || 0,
          target: targets[item.key] || 0
        }))
      : [];

    let advice = null;
    if (targets && isToday) {
      const mealTime = getCurrentMealTime();
      const gaps = computeNutrientGaps(dayData.totals, targets);
      const gapSig = gaps.slice(0, 3).map(g => `${g.key}:${g.value}`).join(',');
      advice = generateAdvice(dayData.totals, targets, {
        mealTime,
        seed: `${dateKey}|${mealTime}|${targets.goal || 'maintain'}|${targets.calories || 0}|${dayData.totals.calories}|${dayData.records.length}|${gapSig}`
      });
    }

    this.setData({
      targets,
      dateStr: this.formatDateStr(dateKey),
      dateKey,
      isToday,
      totals: dayData.totals,
      isCalorieOver,
      calorieOverAmount,
      macroList,
      microList,
      records: dayData.records,
      advice
    });
  },

  formatDateStr(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const todayKey = getDateKey(new Date());
    if (dateKey === todayKey) return `${m}月${d}日 · 今天`;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateKey === getDateKey(yesterday)) return `${m}月${d}日 · 昨天`;
    return `${y}年${m}月${d}日`;
  },

  loadDayData(dateKey) {
    const records = loadDayRecords(dateKey);
    return {
      totals: calcTotalsFromRecords(records),
      records
    };
  },

  onPrevDay() {
    const d = this.parseDateKey(this.data.dateKey);
    d.setDate(d.getDate() - 1);
    this.refresh(getApp().globalData.targets, getDateKey(d));
  },

  onNextDay() {
    const d = this.parseDateKey(this.data.dateKey);
    d.setDate(d.getDate() + 1);
    const nextKey = getDateKey(d);
    // 不允许切换到未来日期
    if (nextKey > getDateKey(new Date())) {
      wx.showToast({ title: '已经是今天啦', icon: 'none' });
      return;
    }
    this.refresh(getApp().globalData.targets, nextKey);
  },

  onBackToday() {
    this.refresh(getApp().globalData.targets, getDateKey(new Date()));
  },

  parseDateKey(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  onDelete(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          const deleted = deleteRecord(this.data.dateKey, id);
          if (deleted === false) {
            wx.showToast({ title: '删除失败，请重试', icon: 'none' });
            return;
          }
          this.refresh(this.data.targets, this.data.dateKey);
        }
      }
    });
  },

  navToRecord() {
    const app = getApp();
    app.globalData.pendingFoodId = null;
    app.globalData.pendingSearch = null;
    app.globalData.pendingDateKey = this.data.dateKey;
    wx.switchTab({ url: '/pages/record/record' });
  },

  onTapRecommend(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id && !name) return;
    const app = getApp();
    app.globalData.pendingFoodId = id || null;
    app.globalData.pendingSearch = name || null;
    app.globalData.pendingDateKey = this.data.dateKey;
    wx.switchTab({ url: '/pages/record/record' });
  }
});
