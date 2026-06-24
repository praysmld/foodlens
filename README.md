# FoodLens

Upload a food photo → get an FDA-style Nutrition Facts label → chat naturally about what you're eating.

## Requirements

- Node.js v18+
- An [OpenAI API key](https://platform.openai.com/api-keys) (model: `gpt-5.4-mini`)
- A [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup) (free, instant)

## Setup

```bash
git clone <repo>
cd foodlens
npm install
```

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-...
USDA_API_KEY=DEMO_KEY        # or your real key from fdc.nal.usda.gov
```

> `DEMO_KEY` works for light testing but is rate-limited. Get a free key at https://fdc.nal.usda.gov/api-key-signup.

## Run

```bash
npm start
# → FoodLens http://localhost:3000
```

Open **http://localhost:3000** in your browser.

## Example walkthrough

### 1. Upload a food photo

Drop any food photo onto the upload zone or click to browse. The app will:

- Downscale it client-side (max 1024px) before sending
- Call the vision model to identify the food and estimate the portion

### 2. Read the Nutrition Facts label

A nutrition label appears on the left, sourced from **USDA FoodData Central** when possible, with an AI estimate as fallback.

```
Nutrition Facts
──────────────────────────────
1 serving per container
Serving size   1 cup cooked (158g)
══════════════════════════════════
Amount per serving
Calories                     238.6
══════════════════════════════════
                     % Daily Value*
Total Fat 0.4g                   1%
  Saturated Fat —
  Trans Fat —
Cholesterol —
Sodium 7.9mg                     0%
Total Carbohydrate 53.6g        19%
  Dietary Fiber 1.4g             5%
  Total Sugars —
    Includes — Added Sugars
Protein 5.1g                    10%
══════════════════════════════════
Vitamin D —     Calcium 7.9mg  1%
Iron 0.6mg  3%  Potassium 31.6mg 1%
──────────────────────────────
✓ USDA data
Estimated — not medical or clinical advice.
```

### 3. Chat about the food

The assistant opens with a natural observation. Ask anything:

```
You:       Is this healthy?
Assistant: It can be! The 53.6g carbs make it a solid energy source,
           though the low fiber (1.4g) means it digests quickly.
           Great as a base — pair it with protein and vegetables.

You:       Is that a lot of carbs?
Assistant: For one cup of white rice, 53.6g is a meaningful serving —
           about 19% of your daily carb budget. Not extreme, but
           worth pairing with protein if you want to stay fuller longer.

You:       How can I make it lighter?
Assistant: Swap half the rice for cauliflower rice — same volume,
           roughly half the carbs. Or try brown rice for more fiber
           (3.5g vs 1.4g) which slows digestion a bit.
```

The full conversation history is sent on every turn, so the assistant can answer follow-ups like "is *that* a lot?" without you restating the subject.

## Project structure

```
foodlens/
├── server.js          # Express app — /api/analyze and /api/chat
├── lib/
│   ├── vision.js      # OpenAI vision: image → food name + portion
│   ├── usda.js        # USDA FDC lookup + nutrient scaling
│   └── nutrition.js   # Build label shape + compute %DV
├── public/
│   ├── index.html
│   ├── app.js         # Upload, SSE chat, label render
│   └── style.css      # FDA label styling + chat UI
└── tests/
    ├── nutrition.test.js
    └── usda.test.js
```

## Tests

```bash
npm test
# 18 tests, 0 failures
```

## Configuration

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Used for vision analysis and chat |
| `USDA_API_KEY` | Yes | USDA FoodData Central — free at fdc.nal.usda.gov |
| `PORT` | No | Server port (default: 3000) |

The model is set in one place — `server.js` line 9 — change `MODEL` if you need a different OpenAI model.

## Limitations

- Nutrition values are **estimates** — not for clinical or medical use
- Works best with clear, well-lit photos of individual dishes
- Composite dishes (e.g. a full plate with multiple items) use AI estimates when USDA has no direct match
- Chat history lives in browser memory only; refreshing or re-uploading starts a fresh thread
