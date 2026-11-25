const { searchFoods, getFoodById, calcNutrients } = require('../../utils/foodData');
const { saveRecord, getDateKey } = require('../../utils/records');

const MEAL_OPTIONS = ['早餐', '午餐', '晚餐', '加餐'];
const DEFAULT_PORTIONS = [20, 30, 50, 100, 150, 200, 300, 500];
const MAX_GRAMS = 5000;

function getDefaultMealIndex() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return 0;
  if (hour >= 10 && hour < 15) return 1;
  if (hour >= 15 && hour < 21) return 2;
  return 3;
}

Page({
  data: {
    keyword: '',
    hasKeyword: false,
    searching: false,
    results: [],
    selectedFood: null,
    mealIndex: 0,
    grams: 100,
    gramsInput: '100',
    previewNutrients: null,
    recordDateKey: '',
    isBackfill: false,
    MEAL_OPTIONS,
    DEFAULT_PORTIONS,
    showToast: false,
    toastMessage: ''
  },

  onLoad() {
    const todayKey = getDateKey();
    this._lastTodayKey = todayKey;
    this.setData({
      mealIndex: getDefaultMealIndex(),
      recordDateKey: todayKey
    });
  },

  onShow() {
    const app = getApp();
    const todayKey = getDateKey();
    const currentRoute = this.route || 'pages/record/record';
    const isResume = app.globalData.resumedRoute === currentRoute;
    app.globalData.resumedRoute = null;

    const pendingDateKey = app.globalData.pendingDateKey;
    const pendingFoodId = app.globalData.pendingFoodId;
    const pendingSearch = app.globalData.pendingSearch;

    app.globalData.pendingDateKey = null;
    app.globalData.pendingFoodId = null;
    app.globalData.pendingSearch = null;

    const hasPendingNav = Boolean(pendingDateKey || pendingFoodId || pendingSearch);

    if (isResume && !hasPendingNav) {
      const resumeData = {};
      if (!this.data.isBackfill && (
        !this.data.recordDateKey ||
        (this._lastTodayKey && todayKey !== this._lastTodayKey) ||
        this.data.recordDateKey !== todayKey
      )) {
        resumeData.recordDateKey = todayKey;
        resumeData.isBackfill = false;
      }
      if (this.data.searching) {
        if (this._searchTimer) {
          clearTimeout(this._searchTimer);
          this._searchTimer = null;
        }
        resumeData.searching = false;
        if (this.data.hasKeyword) {
          resumeData.results = searchFoods(this.data.keyword, 50);
        }
      }
      if (this.data.showToast) {
        if (this._toastTimer) {
          clearTimeout(this._toastTimer);
          this._toastTimer = null;
        }
        resumeData.showToast = false;
      }
      this._lastTodayKey = todayKey;
      if (Object.keys(resumeData).length > 0) {
        this.setData(resumeData);
      }
      return;
    }

    if (this._toastTimer) {
      clearTimeout(this._toastTimer);
      this._toastTimer = null;
    }

    const recordDateKey = pendingDateKey || todayKey;
    const nextData = {
      recordDateKey,
      isBackfill: recordDateKey !== todayKey,
      selectedFood: null,
      grams: 100,
      gramsInput: '100',
      previewNutrients: null,
      showToast: false
    };

    if (pendingFoodId || pendingSearch) {
      if (this._searchTimer) {
        clearTimeout(this._searchTimer);
        this._searchTimer = null;
      }
      const foodById = pendingFoodId ? getFoodById(pendingFoodId) : null;
      const searchText = (foodById && foodById.name) || pendingSearch || '';
      const matches = searchFoods(searchText);
      const targetFood = foodById || matches.find(f => f.name === searchText) || null;

      nextData.keyword = searchText;
      nextData.hasKeyword = searchText.trim().length > 0;
      nextData.searching = false;
      nextData.results = matches;
      nextData.mealIndex = getDefaultMealIndex();
      if (targetFood) {
        nextData.selectedFood = targetFood;
        nextData.grams = 100;
        nextData.gramsInput = '100';
        nextData.previewNutrients = calcNutrients(targetFood, 100);
      }
    } else if (this.data.searching) {
      if (this._searchTimer) {
        clearTimeout(this._searchTimer);
        this._searchTimer = null;
      }
      nextData.searching = false;
      if (this.data.hasKeyword) {
        nextData.results = searchFoods(this.data.keyword, 50);
      }
    }

    this._lastTodayKey = todayKey;
    this.setData(nextData);
  },

  onExitBackfill() {
    const todayKey = getDateKey();
    this._lastTodayKey = todayKey;
    this.setData({
      recordDateKey: todayKey,
      isBackfill: false
    });
  },

  onHide() {
    this.clearTimers();
    if (this.data.showToast) {
      this.setData({ showToast: false });
    }
  },

  onUnload() {
    this.clearTimers();
  },

  clearTimers() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    if (this._toastTimer) {
      clearTimeout(this._toastTimer);
      this._toastTimer = null;
    }
  },

  noop() {},

  onInput(e) {
    const keyword = e.detail.value;
    const hasKeyword = keyword.trim().length > 0;

    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }

    if (!hasKeyword) {
      this.setData({ keyword, hasKeyword: false, results: [], searching: false });
      return;
    }

    this.setData({ keyword, hasKeyword: true, searching: true });
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      this.setData({ results: searchFoods(keyword, 50), searching: false });
    }, 150);
  },

  onSelectFood(e) {
    const food = getFoodById(e.currentTarget.dataset.id);
    if (food) {
      this.setData({
        selectedFood: food,
        grams: 100,
        gramsInput: '100',
        previewNutrients: calcNutrients(food, 100)
      });
    }
  },

  onCloseModal() {
    this.setData({ selectedFood: null, previewNutrients: null });
  },

  onMealChange(e) {
    this.setData({ mealIndex: Number(e.detail.value) });
  },

  onGramsInput(e) {
    const raw = e.detail.value;
    const trimmed = typeof raw === 'string' ? raw.trim() : String(raw || '').trim();
    const parsed = trimmed.length > 0 ? Number(trimmed) : NaN;
    const nextGrams = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    this.setData({
      gramsInput: raw,
      grams: nextGrams,
      previewNutrients: this.data.selectedFood ? calcNutrients(this.data.selectedFood, nextGrams) : null
    });
  },

  onPortionTap(e) {
    const value = Number(e.currentTarget.dataset.value);
    if (!Number.isFinite(value) || value <= 0) return;
    this.setData({
      grams: value,
      gramsInput: String(value),
      previewNutrients: this.data.selectedFood ? calcNutrients(this.data.selectedFood, value) : null
    });
  },

  onSave() {
    const { selectedFood, grams, mealIndex, recordDateKey } = this.data;
    if (!selectedFood) return;
    if (!Number.isFinite(grams) || grams <= 0 || grams > MAX_GRAMS) {
      wx.showToast({ title: `请输入有效克数（1~${MAX_GRAMS}g）`, icon: 'none' });
      return;
    }

    const nutrients = calcNutrients(selectedFood, grams);
    const saved = saveRecord({
      foodId: selectedFood.id,
      foodName: selectedFood.name,
      grams,
      meal: MEAL_OPTIONS[mealIndex],
      dateKey: recordDateKey || getDateKey(),
      ...nutrients
    });
    if (saved === false) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      return;
    }

    this.showToast(`已记录 ${selectedFood.name} ${grams}g`);
    this.setData({
      selectedFood: null,
      grams: 100,
      gramsInput: '100',
      previewNutrients: null
    });
  },

  showToast(message) {
    if (this._toastTimer) {
      clearTimeout(this._toastTimer);
    }
    this.setData({ showToast: true, toastMessage: message });
    this._toastTimer = setTimeout(() => {
      this._toastTimer = null;
      this.setData({ showToast: false });
    }, 2000);
  },

  navToToday() {
    if (this._toastTimer) {
      clearTimeout(this._toastTimer);
      this._toastTimer = null;
    }
    getApp().globalData.pendingTodayDateKey = this.data.recordDateKey || getDateKey();
    this.setData({ showToast: false });
    wx.switchTab({ url: '/pages/today/today' });
  }
});
