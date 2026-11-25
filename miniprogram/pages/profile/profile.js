const { calcTargets, GOAL_ADJUSTMENTS, MIN_CALORIES } = require('../../utils/tdee');

const ACTIVITY_OPTIONS = ['久坐（几乎不运动）', '轻度（每周1-3次）', '中度（每周3-5次）', '高度（每周6-7次）', '极高（体力劳动）'];
const ACTIVITY_KEYS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOAL_OPTIONS = ['减脂', '维持', '增肌'];
const GOAL_KEYS = ['lose', 'maintain', 'gain'];

function formatGoalAdjust(goal) {
  const val = GOAL_ADJUSTMENTS[goal] != null ? GOAL_ADJUSTMENTS[goal] : 0;
  return val > 0 ? `+${val}` : String(val);
}

Page({
  data: {
    genderIndex: 0,
    age: '',
    heightCm: '',
    weightKg: '',
    activityIndex: 1,
    goalIndex: 1,
    ACTIVITY_OPTIONS,
    GOAL_OPTIONS,
    targets: null,
    goalLabel: '',
    goalAdjustText: '0',
    minCalories: MIN_CALORIES
  },

  onLoad() {
    this.syncProfileFromStorage();
  },

  onShow() {
    const app = getApp();
    if (app && app.globalData && app.globalData.resumedRoute) {
      app.globalData.resumedRoute = null;
    }
    this.syncProfileFromStorage();
  },

  syncProfileFromStorage() {
    let profile = null;
    try {
      profile = wx.getStorageSync('profile');
    } catch (err) {
      console.error('load profile storage failed:', err);
    }
    const targets = profile ? calcTargets(profile) : null;
    if (profile && targets) {
      const goalKey = targets.goal || profile.goal;
      const goalIdx = Math.max(0, GOAL_KEYS.indexOf(goalKey));
      this.setData({
        genderIndex: profile.gender === 'male' ? 0 : 1,
        age: String(profile.age),
        heightCm: String(profile.heightCm),
        weightKg: String(profile.weightKg),
        activityIndex: Math.max(0, ACTIVITY_KEYS.indexOf(profile.activity)),
        goalIndex: goalIdx,
        targets,
        goalLabel: GOAL_OPTIONS[goalIdx],
        goalAdjustText: formatGoalAdjust(goalKey)
      });
    } else {
      // 没有已保存的档案时只清空目标展示，保留用户正在填写的内容（首次填写时切 tab 再回来不会丢输入）
      this.setData({
        targets: null,
        goalLabel: '',
        goalAdjustText: '0'
      });
    }
  },

  onGenderChange(e) { this.setData({ genderIndex: Number(e.detail.value) }); },
  onActivityChange(e) { this.setData({ activityIndex: Number(e.detail.value) }); },
  onGoalChange(e) { this.setData({ goalIndex: Number(e.detail.value) }); },
  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  onSave() {
    const age = parseInt(this.data.age, 10);
    const heightCm = parseFloat(this.data.heightCm);
    const weightKg = parseFloat(this.data.weightKg);

    if (!age || age < 10 || age > 100) {
      return wx.showToast({ title: '请输入有效年龄', icon: 'none' });
    }
    if (!heightCm || heightCm < 100 || heightCm > 250) {
      return wx.showToast({ title: '请输入有效身高', icon: 'none' });
    }
    if (!weightKg || weightKg < 30 || weightKg > 300) {
      return wx.showToast({ title: '请输入有效体重', icon: 'none' });
    }

    const profile = {
      gender: this.data.genderIndex === 0 ? 'male' : 'female',
      age,
      heightCm,
      weightKg,
      activity: ACTIVITY_KEYS[this.data.activityIndex],
      goal: GOAL_KEYS[this.data.goalIndex]
    };

    let existing = null;
    try {
      existing = wx.getStorageSync('profile');
    } catch (err) {
      console.error('read existing profile failed:', err);
    }
    if (existing) {
      wx.showModal({
        title: '重新保存档案',
        content: '保存后会用新的身体数据重新计算每日营养目标，是否继续？',
        confirmText: '继续保存',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.doSave(profile);
          } else {
            this.syncProfileFromStorage();
          }
        }
      });
      return;
    }

    this.doSave(profile);
  },

  doSave(profile) {
    const targets = calcTargets(profile);
    if (!targets) {
      wx.showToast({ title: '身体数据无效，请检查后重试', icon: 'none' });
      return;
    }
    try {
      wx.setStorageSync('profile', profile);
    } catch (err) {
      console.error('save profile failed:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      return;
    }

    const app = getApp();
    app.globalData.profile = profile;
    app.globalData.targets = targets;

    const goalIdx = Math.max(0, GOAL_KEYS.indexOf(profile.goal));
    this.setData({
      age: String(profile.age),
      heightCm: String(profile.heightCm),
      weightKg: String(profile.weightKg),
      targets,
      goalLabel: GOAL_OPTIONS[goalIdx],
      goalAdjustText: formatGoalAdjust(profile.goal)
    });
    wx.showToast({ title: '已保存', icon: 'success' });
  }
});
