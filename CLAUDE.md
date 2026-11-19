# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

「知食 / NutriMadam」是一个营养追踪微信小程序，纯原生实现（WXML/WXSS/JS），无框架、无 npm 依赖、无构建步骤。核心闭环：填写身体档案 → 用 Mifflin-St Jeor 公式计算每日营养目标 → 搜索食物并记录 → 在「今日」页查看进度与建议。

## 开发与运行

- 唯一运行方式：用微信开发者工具导入仓库根目录。`project.config.json` 指定 `miniprogramRoot: miniprogram/`，AppID 已配置。没有 `npm install`、lint、测试或构建命令。
- 新增页面：在 `miniprogram/pages/<name>/` 创建四件套（.js/.json/.wxml/.wxss），并在 `miniprogram/app.json` 的 `pages` 中注册；tab 页还需加入 `tabBar.list`。
- `project.private.config.json` 是开发者本地配置，不要往里面写业务逻辑。
- 清除调试数据：开发者工具 → 清缓存 → 清除数据缓存（会清空 storage 中的 `profile` 和 `records`）。

## 架构

三个 tab 页：

| 页面 | 职责 |
|---|---|
| `pages/today` | 当日营养汇总、超标/缺口提示、规则化建议、记录列表与删除 |
| `pages/record` | 食物搜索、选择克数/餐次并写入 storage |
| `pages/profile` | 身体档案表单，保存后计算并固化每日目标 |

`app.js` 的 `globalData` 只保存 `profile` 和 `targets`，在 `onLaunch` 时从 storage 读取一次；profile 保存时同步更新 storage 和 `globalData`。`today` 页在 `onShow` 中重新读取 `getApp().globalData.targets`，不缓存目标。

Storage 数据模型（全部本地存储，无云端）：

- `profile`: `{ gender: 'male'|'female', age, heightCm, weightKg, activity, goal }`
- `records`: `{ 'YYYY-MM-DD': [ { id, dateKey, foodId, foodName, grams, meal, calories, protein, carbs, fat, fiber, vitaminA, vitaminC, calcium, magnesium, iron, zinc } ] }`

关键点：记录里存的是**按克数换算后的绝对值**，不是每 100g 含量；`foodData.js` 里的才是每 100g 值（`calcNutrients(food, grams)` 负责换算）。

utils 职责：

- `tdee.js` — Mifflin-St Jeor 计算 BMR → 乘活动系数得 TDEE → 按目标加减（lose −500 / maintain 0 / gain +300），热量下限 clamp 到 1200 kcal；宏量按目标比例分配，微量固定默认值（镁/铁/锌按性别区分）。
- `records.js` — storage CRUD、日期键 `YYYY-MM-DD`、日汇总 `calcDayTotals`。所有记录按日期键分组。
- `foodData.js` — 1677 条《中国食物成分表（第 6 版）》数据，导出 `FOODS`、`searchFoods(keyword)`、`getFoodById(id)`、`calcNutrients(food, grams)`。
- `advice.js` — 当前为规则版建议：按剩余热量/蛋白质/纤维拼 summary 句子，`RECOMMENDATION_POOLS` 按营养素随机抽食物名，`enrichWithFoodInfo` 回查 FOODS。

## 领域约定与坑

- 枚举键固定：目标 `lose|maintain|gain`；活动量 `sedentary|light|moderate|active|very_active`；餐次固定 `早餐|午餐|晚餐|加餐`。改动时需同步 `tdee.js`、`profile.js`、`record.js`。
- `foodData.js` 名称带全角括号和别名（如 `鸡蛋（代表值）`、`鲫鱼［喜头鱼、海附鱼］`）。任何按名称引用的推荐池必须与 `FOODS` 的 `name` 完全一致，否则会静默匹配失败；新增推荐前先用 `searchFoods`/`getFoodById` 验证。
- `foodData.js` 是 26k 行的生成数据文件，不要整文件读取或重新格式化；用 Grep 按名称定位。
- `category` 格式为「一级分类-二级分类」，共 15 个一级、55 个二级分类。
- 文案规则（见 `ai-advice-prompt.md`）：禁止医疗宣称（治疗、降血糖、排毒、燃脂等）和绝对化用语；人称统一用「你」；数值只能用 `{remaining}`、`{gap}`、`{pct}` 三个占位符。运行时不做任何 LLM 调用——文案在开发期固化为静态 JS。
- 推荐食物必须由程序从 `FOODS` 按标签/阈值筛选，不能由文案或模型编造，以保证食物一定存在于食物库。

## 计划中的方向（ai-advice-prompt.md）

`ai-advice-prompt.md` 定义了一次性开发期提示词，用于生成四份静态资源：热量总评文案库（热量状态 × 目标）、营养素缺口文案库（营养素 × 目标 × 时段）、健康小习惯、55 个二级分类语义标签表。合并后 `advice.js` 的 `generateAdvice()` 预期改为「按状态从文案矩阵选句 + 按标签阈值从 FOODS 筛选推荐」，替换当前手写字符串和 `RECOMMENDATION_POOLS` 的随机抽取逻辑。数值标签阈值（每 100g）在该文件中有明确定义，例如高蛋白 `protein ≥ 15`、低脂 `fat ≤ 3`、补钙 `calcium ≥ 100`。
