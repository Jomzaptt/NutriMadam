App({
  globalData: {
    profile: null,
    targets: null,
    // 从「今日建议」跳转到记录页时，携带待搜索的食物名
    pendingSearch: null
  },

  onLaunch() {
    this.loadProfile();
  },

  loadProfile() {
    const profile = wx.getStorageSync('profile');
    if (profile) {
      const { calcTargets } = require('./utils/tdee');
      this.globalData.profile = profile;
      this.globalData.targets = calcTargets(profile);
    }
  }
});
