// 开发期生成的二级分类语义标签表，供食物标签计算与推荐策略使用。
// 字段含义：breakfast 常见早餐、dinner 适合晚餐、snack 适合加餐、satiety 饱腹感强、
// digest 易消化、limit 不建议常吃、whole 天然未加工、cook 通常需烹饪。

const CATEGORY_TAGS = [
  { sub: '其他', breakfast: false, dinner: false, snack: false, satiety: false, digest: false, limit: false, whole: false, cook: false },
  { sub: '奶油', breakfast: false, dinner: false, snack: false, satiety: false, digest: true, limit: true, whole: true, cook: false },
  { sub: '奶粉', breakfast: true, dinner: false, snack: false, satiety: false, digest: true, limit: false, whole: false, cook: false },
  { sub: '奶酪', breakfast: true, dinner: false, snack: true, satiety: true, digest: true, limit: false, whole: true, cook: false },
  { sub: '液态乳', breakfast: true, dinner: false, snack: true, satiety: false, digest: true, limit: false, whole: true, cook: false },
  { sub: '酸奶', breakfast: true, dinner: false, snack: true, satiety: false, digest: true, limit: false, whole: true, cook: false },
  { sub: '动物油脂', breakfast: false, dinner: false, snack: false, satiety: false, digest: false, limit: true, whole: true, cook: false },
  { sub: '树坚果', breakfast: true, dinner: false, snack: true, satiety: true, digest: true, limit: false, whole: true, cook: false },
  { sub: '种子', breakfast: true, dinner: false, snack: true, satiety: true, digest: true, limit: false, whole: true, cook: false },
  { sub: '大豆', breakfast: true, dinner: true, snack: true, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '绿豆', breakfast: true, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '芸豆', breakfast: false, dinner: true, snack: false, satiety: true, digest: false, limit: false, whole: true, cook: true },
  { sub: '蚕豆', breakfast: false, dinner: true, snack: false, satiety: true, digest: false, limit: false, whole: true, cook: true },
  { sub: '赤豆', breakfast: true, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '植物油', breakfast: false, dinner: false, snack: false, satiety: false, digest: true, limit: true, whole: true, cook: false },
  { sub: '仁果类', breakfast: true, dinner: true, snack: true, satiety: false, digest: true, limit: false, whole: true, cook: false },
  { sub: '柑橘类', breakfast: true, dinner: false, snack: true, satiety: false, digest: true, limit: false, whole: true, cook: false },
  { sub: '核果类', breakfast: true, dinner: false, snack: true, satiety: false, digest: true, limit: false, whole: true, cook: false },
  { sub: '浆果类', breakfast: true, dinner: false, snack: true, satiety: false, digest: true, limit: false, whole: true, cook: false },
  { sub: '热带亚热带水果', breakfast: true, dinner: false, snack: true, satiety: false, digest: true, limit: false, whole: true, cook: false },
  { sub: '瓜果类', breakfast: true, dinner: true, snack: true, satiety: false, digest: true, limit: false, whole: true, cook: false },
  { sub: '牛', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '猪', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '羊', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '马', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '驴', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '火鸡', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '鸡', breakfast: true, dinner: true, snack: true, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '鸭', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '鹅', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '菌类', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '藻类', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: false },
  { sub: '嫩茎叶花菜类', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '根菜类', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '水生蔬菜类', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '茄果瓜菜类', breakfast: false, dinner: true, snack: true, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '葱蒜类', breakfast: false, dinner: true, snack: false, satiety: false, digest: true, limit: false, whole: true, cook: true },
  { sub: '薯芋类', breakfast: true, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '野生蔬菜类', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '鲜豆类', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '淀粉类', breakfast: false, dinner: false, snack: false, satiety: true, digest: true, limit: false, whole: false, cook: true },
  { sub: '薯类', breakfast: true, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '鸡蛋', breakfast: true, dinner: true, snack: true, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '鸭蛋', breakfast: true, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '鹅蛋', breakfast: false, dinner: false, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '鹌鹑蛋', breakfast: true, dinner: true, snack: true, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '大麦', breakfast: true, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '小米黄米', breakfast: true, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '小麦', breakfast: true, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '玉米', breakfast: true, dinner: true, snack: true, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '稻米', breakfast: true, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '虾', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '蟹', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '贝', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true },
  { sub: '鱼', breakfast: false, dinner: true, snack: false, satiety: true, digest: true, limit: false, whole: true, cook: true }
];

const SUBCATEGORY_TAG_MAP = new Map(CATEGORY_TAGS.map(tag => [tag.sub, tag]));

function getCategoryTags(subcategory) {
  return SUBCATEGORY_TAG_MAP.get(subcategory) || null;
}

module.exports = { CATEGORY_TAGS, getCategoryTags };
