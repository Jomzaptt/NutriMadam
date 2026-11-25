# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

「知食 / NutriMadam」是一个营养追踪微信小程序，纯原生实现（WXML/WXSS/JS），无框架、无 npm 依赖、无构建步骤。核心闭环：填写身体档案 → 用 Mifflin-St Jeor 公式计算每日营养目标 → 搜索食物并记录 → 在「今日」页查看进度与建议。

## 开发与运行

- 运行小程序：用微信开发者工具导入仓库根目录。`project.config.json` 指定 `miniprogramRoot: miniprogram/`，AppID 已配置。没有 `npm install`、lint 或构建命令。
- 运行测试：在仓库根目录执行 `node --test tests/utils.test.js`（工具函数单测）和 `node --test tests/e2e.test.js`（端到端回归套件），也可以 `node --test tests/utils.test.js tests/e2e.test.js` 一次跑完。测试直接 `require` `miniprogram/utils/*.js` 并用假的 `wx` 对象，不需要微信开发者工具。
- 新增页面：在 `miniprogram/pages/<name>/` 创建四件套（.js/.json/.wxml/.wxss），并在 `miniprogram/app.json` 的 `pages` 中注册；tab 页还需加入 `tabBar.list`。
- `project.private.config.json` 是开发者本地配置，不要往里面写业务逻辑。
- 清除调试数据：开发者工具 → 清缓存 → 清除数据缓存（会清空 storage 中的 `profile` 和 `records`）。

## 架构

三个 tab 页：

| 页面 | 职责 |
|---|---|
| `pages/today` | 当日营养汇总、热量/宏量超标视觉提示、规则化建议（10 项营养素）、记录列表与删除、历史日期浏览 |
| `pages/record` | 食物搜索、选择克数/餐次（实时预览该克数的热量与宏量）并写入 storage；支持补记历史日期 |
| `pages/profile` | 身体档案表单，保存后计算并固化每日目标 |

`app.js` 的 `globalData` 保存 `profile`、`targets`，以及跨页面传递的一次性参数：`pendingFoodId`、`pendingSearch`（从「今日建议」跳到记录页并定位食物）、`pendingDateKey`（补记日期）、`pendingTodayDateKey`（记录页点「查看今日 ›」时让今日页切到该日期）、`resumedRoute`（`App.onHide`/`App.onShow` 记录的前后台切回标志，记录页据此在切后台回来时保留补记日期和已打开的弹窗，而不是重置到今天）。`profile`/`targets` 在 `onLaunch` 时从 storage 读取一次；保存档案时同步更新 storage 和 `globalData`。`today` 页在 `onShow` 中重新读取 `getApp().globalData.targets`，不缓存目标；`profile` 页在 `onShow` 中重新从 storage 同步表单，确认框点「取消」时不改动已保存的数据。

Storage 数据模型（全部本地存储，无云端）：

- `profile`: `{ gender: 'male'|'female', age, heightCm, weightKg, activity, goal }`
- `records`: `{ 'YYYY-MM-DD': [ { id, dateKey, foodId, foodName, grams, meal, calories, protein, carbs, fat, fiber, vitaminA, vitaminC, calcium, magnesium, iron, zinc } ] }`

关键点：记录里存的是**按克数换算后的绝对值**，不是每 100g 含量；`foodData.js` 里的才是每 100g 值（`calcNutrients(food, grams)` 负责换算）。

utils 职责：

- `tdee.js` — Mifflin-St Jeor 计算 BMR → 乘活动系数得 TDEE → 按目标加减（lose −500 / maintain 0 / gain +300）。热量下限：增肌目标固定 1200 kcal；减脂/维持目标取 `min(1200, TDEE)`，因此小基数人群（TDEE < 1200）选「减脂」时目标不会高于每日消耗。`calcBMR`/`calcTargets` 用 `Number.isFinite` 校验 `age`/`heightCm`/`weightKg`，输入无效时返回 `null`，调用方要处理。宏量按目标比例分配；微量营养素（维生素 A、钙、铁、锌、镁）按《中国居民膳食营养素参考摄入量（DRIs）》RNI 口径，按性别和年龄段（`MICRO_SEGMENTS`）取值，未命中年龄段回退到性别默认值；维生素 C 和膳食纤维为固定值。
- `records.js` — storage CRUD、日期键 `YYYY-MM-DD`、日汇总 `calcTotalsFromRecords`。所有记录按日期键分组。`saveRecord`/`deleteRecord` 在 storage 写入失败时返回 `false`（成功时返回当天记录数组），页面必须检查返回值，失败时不能提示「已记录」。`calcTotalsFromRecords` 先对所有记录求和，最后统一舍入（热量取整，宏量/纤维/维生素 A、C/钙/镁保留 1 位小数，铁/锌保留 2 位），不在累加过程中逐步舍入。
- `foodData.js` — 1676 条《中国食物成分表（第 6 版）》数据，导出 `FOODS`、`searchFoods(keyword, limit)`、`getFoodById(id)`、`calcNutrients(food, grams)`。`searchFoods` 会归一化全/半角括号，支持空格分词（多词 AND 匹配）和同义词（`SEARCH_SYNONYMS`，如 `鸡胸肉`→`鸡胸脯肉`、`牛油果`→`鳄梨`、`水煮蛋`→`鸡蛋（煮）`），排序为：完全匹配 > 前缀 > 子串 > 分词 > 同义词。
- `categoryTags.js` — 55 个二级分类的语义标签表（早餐/晚餐/加餐/饱腹/易消化/不建议常吃/天然/需烹饪），开发期固化的静态资源。
- `foodTags.js` — 给 `FOODS` 打标签（数值阈值标签 + 分类标签 + `processed`/`excluded`），并提供 `pickRecommendationsByGaps`、`pickLowCalorieRecommendations`、`hasTag`、`findFoodsByTag`。**惰性初始化**：`require` 时不遍历 1676 条食物，第一次访问 `TAGGED_FOODS`/`FOODS_BY_TAG` 或调用查找/推荐函数时才构建，避免拖慢首页冷启动。推荐池按 `food.name` 去重（库里有同名条目）。`isRecommendable` = 非 `limit`、非 `processed`、非 `excluded`。
- `adviceCopy.js` — 开发期固化的静态文案库：热量总评（`CALORIE_COPY`，按状态×目标；`CALORIE_COPY_BY_MEAL` 按状态×目标×时段）、营养素缺口文案（`NUTRIENT_COPY`，按目标×营养素×时段，覆盖 10 项营养素，含维生素 A 和锌）、健康小习惯（`HABIT_COPY`）、各营养素单位（`NUTRIENT_UNITS`）。
- `advice.js` — 规则版建议：`generateAdvice` 返回 `{ summary, recommendations, habits, calorieState }`。`NUTRIENT_KEYS` 为 10 项营养素（蛋白质、碳水、脂肪、膳食纤维、维生素 A、维生素 C、钙、镁、铁、锌）。`pickCalorieLine` 带 `mealTime` 维度，早餐/午餐不会取到含「晚餐、晚上、睡前、最后这一餐、收尾、晚餐后、加一餐」的句子。`ensureNutrientPrefix` 只检查句首是否已有营养素名，没有才把「缺口 {gap}」补成「某营养素还差 {gap}」。热量超标（`over`）时只输出热量总评，不输出营养素缺口句，今日页也不显示「推荐补充」。

## 领域约定与坑

- 枚举键固定：目标 `lose|maintain|gain`；活动量 `sedentary|light|moderate|active|very_active`；餐次固定 `早餐|午餐|晚餐|加餐`（建议引擎内部的时段键是 `breakfast|lunch|dinner|snack`）。改动时需同步 `tdee.js`、`profile.js`、`record.js`。
- `foodData.js` 名称带全角括号和别名（如 `鸡蛋（代表值）`、`鲫鱼［喜头鱼、海附鱼］`）。任何按名称引用的食物名必须能被 `searchFoods` 命中，否则用户点推荐后搜不到；新增文案前先用 `searchFoods`/`getFoodById` 验证。
- `foodData.js` 是 2.6 万行的生成数据文件，不要整文件读取或重新格式化；用 Grep 按名称定位。数据里热量为 0 的条目是坏数据，不要补进推荐池（`foodTags.js` 里 `calories <= 0` 的条目标为 `excluded`）。
- `category` 格式为「一级分类-二级分类」，共 15 个一级、55 个二级分类。
- 推荐安全过滤在 `foodTags.js`：排除野生蔬菜类、`鱼虾蟹贝类-其他` 等分类，按 ID 排除个别条目，姜/未脱壳生粮/调味葱椒不作为正餐或早餐推荐，高脂肉和动物内脏标为 `limit`，`isProcessedFood` 拦截香肠、午餐肉、肉干、鱼丸、红烧、油浸等加工食品（`针扒`、`不加盐` 是已知误判，已特殊放行）。新增过滤规则后要补测试。
- 文案规则（见 `ai-advice-prompt.md`）：禁止医疗宣称（治疗、降血糖、排毒、燃脂等）和绝对化用语；人称统一用「你」；数值只能用 `{remaining}`、`{gap}`、`{pct}` 三个占位符。运行时不做任何 LLM 调用——文案在开发期固化为静态 JS。
- 推荐食物必须由程序从 `FOODS` 按标签/阈值筛选，不能由文案或模型编造，以保证食物一定存在于食物库。
- 页面层写 storage 前后要检查 `records.js` 的返回值；`calcTargets` 可能返回 `null`（档案数据异常），页面要兜底。
