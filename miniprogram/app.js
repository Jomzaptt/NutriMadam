App({
  globalData: {
    profile: null,
    targets: null,
    // 从「今日建议」跳转到记录页时，携带待定位的食物 ID / 名称及记录日期
    pendingFoodId: null,
    pendingSearch: null,
    pendingDateKey: null,
    pendingTodayDateKey: null,
    resumedRoute: null
  },

  onLaunch() {
    this.loadProfile();
  },

  onShow() {
    if (this._inBackground) {
      this._inBackground = false;
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
      const top = Array.isArray(pages) && pages.length > 0 ? pages[pages.length - 1] : null;
      this.globalData.resumedRoute = top && top.route ? top.route : null;
    } else {
      this.globalData.resumedRoute = null;
    }
  },

  onHide() {
    this._inBackground = true;
  },

  loadProfile() {
    try {
      const profile = wx.getStorageSync('profile');
      if (profile) {
        const { calcTargets } = require('./utils/tdee');
        this.globalData.profile = profile;
        this.globalData.targets = calcTargets(profile);
      }
    } catch (err) {
      console.error('loadProfile failed:', err);
    }
  }
});
