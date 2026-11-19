const { searchFoods, getFoodById, calcNutrients } = require('../../utils/foodData');
const { saveRecord, getDateKey } = require('../../utils/records');

const MEAL_OPTIONS = ['早餐', '午餐', '晚餐', '加餐'];
const DEFAULT_PORTIONS = [20, 30, 50, 100, 150, 200, 300, 500];

Page({
  data: {
    keyword: '',
    results: [],
    selectedFood: null,
    mealIndex: 0,
    grams: 100,
    MEAL_OPTIONS,
    DEFAULT_PORTIONS,
    showToast: false,
    toastMessage: ''
  },

  onLoad() {
    this.setData({ results: searchFoods('') });
  },

  onShow() {
    const pending = getApp().globalData.pendingSearch;
    if (!pending) return;
    getApp().globalData.pendingSearch = null;

    // 推荐食物名是精确完整名，尝试直接定位；命中唯一同名项则打开记录弹窗
    const matches = searchFoods(pending);
    const exact = matches.find(f => f.name === pending);
    if (exact) {
      this.setData({ keyword: pending, results: matches, selectedFood: exact, grams: 100 });
    } else {
      this.setData({ keyword: pending, results: matches });
    }
  },

  onInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword, results: searchFoods(keyword) });
  },

  onSelectFood(e) {
    const food = getFoodById(e.currentTarget.dataset.id);
    if (food) {
      this.setData({ selectedFood: food, grams: 100 });
    }
  },

  onCloseModal() {
    this.setData({ selectedFood: null });
  },

  onMealChange(e) {
    this.setData({ mealIndex: Number(e.detail.value) });
  },

  onGramsInput(e) {
    const grams = parseFloat(e.detail.value);
    this.setData({ grams: Number.isFinite(grams) && grams > 0 ? grams : 0 });
  },

  onPortionTap(e) {
    this.setData({ grams: e.currentTarget.dataset.value });
  },

  onSave() {
    const { selectedFood, grams, mealIndex } = this.data;
    if (!selectedFood || grams <= 0) return;

    const nutrients = calcNutrients(selectedFood, grams);
    saveRecord({
      foodId: selectedFood.id,
      foodName: selectedFood.name,
      grams,
      meal: MEAL_OPTIONS[mealIndex],
      dateKey: getDateKey(),
      ...nutrients
    });

    this.showToast(`已记录 ${selectedFood.name} ${grams}g`);
    this.setData({ selectedFood: null, grams: 100, mealIndex: 0 });
  },

  showToast(message) {
    this.setData({ showToast: true, toastMessage: message });
    setTimeout(() => this.setData({ showToast: false }), 2000);
  },

  navToToday() {
    this.setData({ showToast: false });
    wx.switchTab({ url: '/pages/today/today' });
  }
});
