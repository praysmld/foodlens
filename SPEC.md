# FoodLens — Specification

Spec-driven definition for a webapp that chats with you about the food you're
eating. Upload a photo → get an FDA-style Nutrition Facts label → have a smooth,
natural conversation about that food. Built to be assembled in ~1 hour.

Companion docs: `tasks/plan.md` (build phases), `tasks/todo.md` (task list).

---

## 1. Objective

**What:** A single-page webapp where a user uploads a food photo and receives
(a) an FDA Nutrition Facts label and (b) an ongoing, natural chat grounded in that
specific food.

**Who:** A curious eater who wants to understand what's on their plate — not a
clinician. Casual, conversational, judgment-free tone.

**Success:** Upload → accurate-looking label in one step; then a back-and-forth
that correctly references the identified food and its numbers, and feels smooth
(streaming, no dead air, no jank).

**Non-goals:** auth, accounts, persistence/DB, multi-image, barcode scanning,
mobile-native, i18n, automated test suites.

---

## 2. Core features & acceptance criteria

### F1 — Image upload & analysis
- File picker + preview; image downscaled client-side (longest edge ~1024px) before upload.
- `POST /api/analyze` returns `{ food, portion, confidence, nutrition, source }`.
- **AC:** two different food photos yield different, plausible results; a non-food
  image returns a friendly "couldn't identify a food" message (HTTP 200, `food: null`).

### F2 — Nutrition source: USDA-primary, AI fallback  ← decided
- Vision (`gpt-5.4-mini`) identifies the **food name + estimated portion (grams)**.
- Server queries **USDA FDC** `/foods/search` for that food, takes the best match,
  fetches its nutrients (per 100 g), and **scales to the estimated portion**.
- If USDA has no usable match, fall back to the vision model's own estimate.
- Response carries `source: "usda" | "ai-estimate"` so the UI can disclose it.
- **AC:** for a common food (e.g. "banana"), label values come from USDA and scale
  with portion; `source` is reported; obscure/composite dishes still produce a label
  via fallback. Every label shows an "Estimated" disclaimer.

### F3 — FDA-style Nutrition Facts label
- Renders the FDA fields: serving size, calories, total fat, saturated fat, trans fat,
  cholesterol, sodium, total carbohydrate, dietary fiber, total sugars, added sugars,
  protein, vitamin D, calcium, iron, potassium — with **% Daily Value** where applicable.
- **AC:** label visually matches the FDA format (bold rules, calories prominent,
  %DV column); missing nutrients render blank/`—`, never crash.

### F4 — Grounded conversational chat with full history
- `POST /api/chat` streams `gpt-5.4-mini` over SSE; system prompt grounds the
  assistant in the analyzed food + its nutrition.
- **Conversation history is first-class.** The client keeps the running
  `messages` array (`{role, content}` for every user + assistant turn) and sends
  the **complete history** with each request, prepended by the system prompt and
  the food context. The model therefore sees the whole thread every turn — it can
  resolve pronouns ("what about *it*?"), follow-ups ("and the *other* one?"), and
  references to earlier answers without the user repeating themselves.
- The seeded opening assistant line is itself stored as the first history entry,
  so later turns can refer back to it.
- History lives in browser session memory only (no DB); a new upload starts a
  fresh thread.
- **AC (history):** in a ≥4-turn exchange, a follow-up that relies on an earlier
  turn (e.g. "is *that* a lot?" after asking about sugar) is answered correctly
  without re-stating the subject; clearing/re-uploading resets the thread.
- **AC (chat):** tokens stream in; if SSE fails, a non-streamed full-text reply
  still renders, and history is still appended correctly.

### F5 — Smoothness
- Typing indicator, suggested starter-prompt chips, auto-scroll, input disabled
  while streaming, clear loading/error states.
- **AC:** full upload→label→chat demo runs start-to-finish with no dead air or
  unhandled errors.

---

## 3. Tech stack & external APIs

- **Runtime:** Node v25, Express. No build step. Vanilla HTML/CSS/JS frontend.
- **Deps:** `express`, `multer` (multipart upload), `openai`, `dotenv`. USDA via `fetch` (built-in).
- **AI:** OpenAI, model `gpt-5.4-mini` (vision + chat) — held in one config constant `MODEL`.
- **Env:** `OPENAI_API_KEY`, `USDA_API_KEY` (both in `.env`), optional `PORT` (default 3000).

### USDA FoodData Central API
- **Base URL:** `https://api.nal.usda.gov/fdc/v1`
- **Auth:** `api_key` query param on every request (`USDA_API_KEY`).
- **Rate limit:** 1,000 requests/hour per key. One search (+ optional detail) per analysis.
- **Search:** `GET /foods/search?query={food}&dataType=Foundation,SR%20Legacy&pageSize=1&api_key=…`
  - dataTypes: `Foundation`, `SR Legacy`, `Branded`, `Survey (FNDDS)`. Prefer
    Foundation / SR Legacy for generic whole foods; values are **per 100 g**.
- **Detail (if needed):** `GET /food/{fdcId}?api_key=…`
- **Nutrient shape:** `food.foodNutrients[]` each `{ nutrientName, nutrientNumber,
  unitName, value }`. Map by `nutrientNumber`:

  | Field | nutrientNumber | unit |
  |-------|----------------|------|
  | Calories | 208 | kcal |
  | Total Fat | 204 | g |
  | Saturated Fat | 606 | g |
  | Trans Fat | 605 | g |
  | Cholesterol | 601 | mg |
  | Sodium | 307 | mg |
  | Total Carbohydrate | 205 | g |
  | Dietary Fiber | 291 | g |
  | Total Sugars | 269 | g |
  | Added Sugars | 539 | g |
  | Protein | 203 | g |
  | Vitamin D | 328 | µg |
  | Calcium | 301 | mg |
  | Iron | 303 | mg |
  | Potassium | 306 | mg |

  Scale: `value_per_portion = value_per_100g × (portionGrams / 100)`.
- **%DV reference (FDA 2,000-kcal):** fat 78g, satfat 20g, cholesterol 300mg,
  sodium 2300mg, carb 275g, fiber 28g, added sugars 50g, protein 50g, vitD 20µg,
  calcium 1300mg, iron 18mg, potassium 4700mg.

---

## 4. Project structure

```
foodlens/
├─ .env                 # OPENAI_API_KEY, USDA_API_KEY (not committed)
├─ server.js            # Express app + /api/analyze + /api/chat
├─ lib/
│  ├─ vision.js         # gpt-5.4-mini: image → {food, portionGrams, ...}
│  ├─ usda.js           # search + nutrient mapping + portion scaling
│  └─ nutrition.js      # normalize to label shape, compute %DV
├─ public/
│  ├─ index.html        # upload + label + chat layout
│  ├─ app.js            # client logic: downscale, fetch, SSE, render
│  └─ style.css         # FDA label + chat styling
├─ SPEC.md
└─ tasks/{plan,todo}.md
```

---

## 5. Code style

- ES modules (`"type": "module"`), `async/await`, no TypeScript, no bundler.
- Small focused modules; `lib/` is pure logic, `server.js` is wiring only.
- The model id lives in **one** `MODEL` constant; USDA base URL + nutrient map in `lib/usda.js`.
- Defensive parsing everywhere external data enters: vision JSON and USDA responses
  must never throw into the response path — fall back, don't crash.
- Match existing minimalism (CLAUDE.md): least code that satisfies the AC, nothing speculative.

---

## 6. Testing strategy

Manual, criteria-driven (no automated suite in the 1-hour scope):

- **CP-A:** `npm start` boots; `GET /` serves the page; no console errors.
- **CP-B:** upload banana + a composite dish → labels populate; banana shows
  `source: "usda"` and scales with portion; non-food image → friendly message.
- **CP-C:** ask "is this healthy?", "lighter swaps?", "how much protein?" → on-topic,
  references the actual food, streams smoothly. **History check:** then ask a
  context-dependent follow-up ("is that a lot?") → answered correctly using the
  prior turn, no subject restatement needed.
- **CP-D:** full upload→label→chat flow runs with no dead air or unhandled errors.
- **Smoke checks:** malformed vision JSON handled; USDA timeout/no-match falls back;
  SSE failure falls back to non-streamed reply.

---

## 7. Boundaries

**Always**
- Label every result "Estimated — not medical/clinical advice."
- Report nutrition `source` (`usda` vs `ai-estimate`) to the UI.
- Keep API keys server-side only; never expose them to the client.
- Downscale images before upload; degrade gracefully on every external failure.

**Ask first**
- Adding persistence, accounts, or any DB.
- Switching AI provider/model away from `gpt-5.4-mini`, or changing the USDA dataType strategy.
- Adding dependencies beyond the four listed, or introducing a build step.

**Never**
- Present estimates as precise medical/clinical values or give diagnostic advice.
- Commit `.env` or log secrets.
- Block the user-facing path on a single external call (always have a fallback).
- Add speculative features beyond the acceptance criteria.
```
