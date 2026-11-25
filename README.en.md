# NutriMadam (知食)

[中文](./README.md) | [English](./README.en.md)

A pure native WeChat Mini Program for daily nutrition tracking (WXML / WXSS / JavaScript) with **zero frameworks, zero npm dependencies, and zero build steps**. All user profiles and meal records are stored locally in `wx.storage`.

## Key Features

- **Body Profile & Daily Targets (`profile`)**
  - Calculates BMR and TDEE using the Mifflin-St Jeor equation and allocates calories and macronutrients by goal (`lose` / `maintain` / `gain`).
  - Applies a safe calorie floor for smaller body frames (`TDEE < 1200 kcal`) so fat-loss targets never exceed TDEE.
  - Computes gender- and age-segmented micronutrient targets (Vitamin A, Calcium, Magnesium, Iron, Zinc) based on Chinese Dietary Reference Intakes (DRIs).
- **Food Search & Logging (`record`)**
  - Ships with 1,676 food entries from the *China Food Composition Tables (6th Edition)*.
  - Supports colloquial Chinese synonyms (e.g., `鸡胸肉`, `牛油果`, `水煮蛋`, `白米饭`, `圣女果`, `奇异果`), full/half-width punctuation normalization, and space-separated multi-token matching.
  - Provides quick portion tags, **live calorie & macro previews** as grams change, and historical date backfilling preserved across background/foreground transitions.
- **Daily Dashboard & Time-Aware Advice (`today`)**
  - Tracks daily calories, 4 macronutrients (protein, carbs, fat, fiber), and 6 micronutrients (Vitamin A, Vitamin C, calcium, magnesium, iron, zinc) with visual indicators when targets are exceeded.
  - Supports browsing past dates, backfilling, and deleting records.
  - **Zero runtime LLM calls**: uses a static, time-of-day aware advice library covering all 10 nutrients alongside a lazy-initialized food-tagging engine that filters out toxic/wild, non-everyday, high-fat offal, and heavily processed items, offering clickable food suggestions and daily habits.

## Project Structure

```text
.
├── miniprogram/
│   ├── app.js / app.json / app.wxss / sitemap.json
│   ├── images/                     # 81×81 PNG tabBar icons
│   ├── pages/
│   │   ├── today/                  # Daily summary, advice, and record list
│   │   ├── record/                 # Food search, live portion preview, backfill
│   │   └── profile/                # Body profile form and calculated targets
│   └── utils/
│       ├── tdee.js                 # BMR / TDEE & DRI target calculation
│       ├── foodData.js             # 1,676 food entries, synonym & token search
│       ├── categoryTags.js         # Semantic tags for 55 food subcategories
│       ├── foodTags.js             # Lazy tagging, safety filters & recommenders
│       ├── adviceCopy.js           # Static time-aware advice & habit templates
│       ├── advice.js               # 10-nutrient gap analysis & advice engine
│       └── records.js              # Local storage CRUD & daily aggregation
├── tests/
│   ├── utils.test.js               # Utility unit & regression tests
│   └── e2e.test.js                 # End-to-end regression test suite
├── project.config.json             # WeChat Mini Program project config
├── ai-advice-prompt.md             # Dev-time copywriting prompt & guidelines
├── CLAUDE.md                       # Architecture notes & engineering conventions
└── README.md                       # Chinese documentation
```

## Quick Start

### 1. Run in WeChat DevTools
1. Open **WeChat DevTools** and click **Import Project**.
2. Select the repository root directory (`project.config.json` already sets `miniprogramRoot: "miniprogram/"`).
3. Click **Compile** to preview in the simulator. To reset local test data, use **Clear Cache → Clear Data Cache**.

### 2. Run Automated Tests (Node.js)
Tests run directly with Node.js (18+) without WeChat DevTools:

```bash
# Run all 188 tests (unit + E2E regression)
node --test tests/utils.test.js tests/e2e.test.js

# Run utility & regression tests only
node --test tests/utils.test.js

# Run E2E regression suite only
node --test tests/e2e.test.js
```

## Data Source & Disclaimer

- Food nutrition data is adapted from the *China Food Composition Tables, Standard Edition (6th Ed.)* (via [china-food-composition-data](https://github.com/Sanotsu/china-food-composition-data)), with missing calorie fields repaired.
- This mini program is intended solely for personal diet logging and general nutritional reference; it does not constitute medical advice or clinical nutrition treatment.

## License

This project is licensed under the [MIT License](./LICENSE). The open-source license applies only to the source code of this repository; food composition data belongs to its original data source and publisher.
