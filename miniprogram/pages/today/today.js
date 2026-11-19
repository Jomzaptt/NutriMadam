const { calcDayTotals, loadDayRecords, deleteRecord, getDateKey } = require('../../utils/records');
const { generateAdvice } = require('../../utils/advice');

Page({
  data: {
    targets: null,
    dateStr: '',
    dateKey: '',
    isToday: true,
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    records: [],
    advice: null
  },

  onShow() {
    const targets = getApp().globalData.targets;
    // 首次进入时定位到今天；之后保留用户已切换到的日期
    if (!this.data.dateKey) {
      this.setData({ dateKey: getDateKey(new Date()) });
    }
    this.refresh(targets);
  },

  refresh(targets) {
    const dateKey = this.data.dateKey;
    const todayKey = getDateKey(new Date());
    const isToday = dateKey === todayKey;
    const dayData = this.loadDayData(dateKey);

    this.setData({
      targets,
      dateStr: this.formatDateStr(dateKey),
      dateKey,
      isToday,
      ...dayData,
      // 只有今天才生成建议；历史日期只展示汇总与记录
      advice: targets && isToday ? generateAdvice(dayData.totals, targets) : null
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
    return {
      totals: calcDayTotals(dateKey),
      records: loadDayRecords(dateKey)
    };
  },

  onPrevDay() {
    const key = this.data.dateKey;
    const d = this.parseDateKey(key);
    d.setDate(d.getDate() - 1);
    this.setData({ dateKey: getDateKey(d) });
    this.refresh(getApp().globalData.targets);
  },

  onNextDay() {
    const key = this.data.dateKey;
    const d = this.parseDateKey(key);
    const nextKey = getDateKey(new Date(d.getTime() + 24 * 3600 * 1000));
    // 不允许切换到未来日期
    if (nextKey > getDateKey(new Date())) {
      wx.showToast({ title: '已经是今天啦', icon: 'none' });
      return;
    }
    this.setData({ dateKey: nextKey });
    this.refresh(getApp().globalData.targets);
  },

  onBackToday() {
    this.setData({ dateKey: getDateKey(new Date()) });
    this.refresh(getApp().globalData.targets);
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
          deleteRecord(this.data.dateKey, id);
          const dayData = this.loadDayData(this.data.dateKey);
          this.setData({
            ...dayData,
            advice: this.data.targets && this.data.isToday ? generateAdvice(dayData.totals, this.data.targets) : null
          });
        }
      }
    });
  },

  navToRecord() {
    wx.switchTab({ url: '/pages/record/record' });
  },

  onTapRecommend(e) {
    const name = e.currentTarget.dataset.name;
    if (!name) return;
    getApp().globalData.pendingSearch = name;
    wx.switchTab({ url: '/pages/record/record' });
  }
});
