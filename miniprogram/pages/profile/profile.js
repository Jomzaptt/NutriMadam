const { calcTargets, MIN_CALORIES } = require('../../utils/tdee');

const ACTIVITY_OPTIONS = ['久坐（几乎不运动）', '轻度（每周1-3次）', '中度（每周3-5次）', '高度（每周6-7次）', '极高（体力劳动）'];
const ACTIVITY_KEYS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOAL_OPTIONS = ['减脂', '维持', '增肌'];
const GOAL_KEYS = ['lose', 'maintain', 'gain'];
const GOAL_ADJUST_LABELS = { lose: -500, maintain: 0, gain: 300 };

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
    goalAdjust: 0,
    minCalories: MIN_CALORIES
  },

  onLoad() {
    const profile = wx.getStorageSync('profile');
    if (profile) {
      this.setData({
        genderIndex: profile.gender === 'male' ? 0 : 1,
        age: String(profile.age),
        heightCm: String(profile.heightCm),
        weightKg: String(profile.weightKg),
        activityIndex: Math.max(0, ACTIVITY_KEYS.indexOf(profile.activity)),
        goalIndex: Math.max(0, GOAL_KEYS.indexOf(profile.goal)),
        targets: calcTargets(profile),
        goalLabel: GOAL_OPTIONS[Math.max(0, GOAL_KEYS.indexOf(profile.goal))],
        goalAdjust: GOAL_ADJUST_LABELS[profile.goal] != null ? GOAL_ADJUST_LABELS[profile.goal] : 0
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

    const existing = wx.getStorageSync('profile');
    if (existing) {
      wx.showModal({
        title: '重新保存档案',
        content: '保存后会用新的身体数据重新计算每日营养目标，是否继续？',
        confirmText: '继续保存',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.doSave(profile);
          }
        }
      });
      return;
    }

    this.doSave(profile);
  },

  doSave(profile) {
    const targets = calcTargets(profile);
    wx.setStorageSync('profile', profile);

    const app = getApp();
    app.globalData.profile = profile;
    app.globalData.targets = targets;

    this.setData({
      targets,
      goalLabel: GOAL_OPTIONS[this.data.goalIndex],
      goalAdjust: GOAL_ADJUST_LABELS[profile.goal] != null ? GOAL_ADJUST_LABELS[profile.goal] : 0
    });
    wx.showToast({ title: '已保存', icon: 'success' });
  }
});
