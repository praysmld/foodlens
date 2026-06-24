# FoodLens — Build Plan (1-hour target)

A webapp where you upload a photo of food and it (1) renders an FDA-style
Nutrition Facts label and (2) holds a smooth, natural back-and-forth chat about
that food.

## Assumptions (confirm if wrong)

1. **Stack is OpenAI, not Claude.** `.env` provides `OPENAI_API_KEY` + `USDA_API_KEY`,
   so vision + chat run on `gpt-4o` and nutrition can be enriched via USDA
   FoodData Central. (Project CLAUDE context prefers Claude for AI apps, but the
   keyed provider wins.)
2. **Nutrition is an AI estimate** from the photo (food + portion guess), optionally
   cross-checked against USDA. It is labeled "estimated" — not a clinical value.
3. **Single user, no auth, no DB.** State lives in the browser for the session.
4. **Minimal stack:** Node + Express server, vanilla HTML/CSS/JS frontend, SSE for
   streaming chat. No build step — fastest path to a working app in 1 hour.

## Architecture

```
Browser (index.html + app.js)
  │  POST /api/analyze   (multipart image)
  ▼
Express server
  ├─ /api/analyze  → gpt-4o vision → {food, portion, nutrition JSON}
  │                   └─(optional) USDA lookup to refine macros
  └─ /api/chat     → gpt-4o stream (SSE), grounded in the analyzed food
```

Nutrition JSON shape (drives the FDA label — fields per FDA Nutrition Facts spec):
`servingSize, calories, totalFat, saturatedFat, transFat, cholesterol, sodium,
totalCarbohydrate, dietaryFiber, totalSugars, addedSugars, protein,
vitaminD, calcium, iron, potassium` + `%DV` where applicable.

## Dependency graph

```
T0 scaffold ──► T1 analyze+label ──► T2 chat ──► T3 smoothness polish
                      │                  ▲
                      └── food context ──┘   (T2 needs T1's analyzed food)
```

- T1 depends on T0 (server + static serving).
- T2 depends on T1 (chat must reference the identified food + nutrition).
- T3 depends on T2 (polish the working chat/upload flow).
- USDA enrichment is an **optional branch inside T1**; skip if time-constrained.

## Vertical slices

Each task is one complete user-visible path (upload→label, send→reply), not a layer.

### T0 — Scaffold + boot (≈8 min)
Project runs and serves a page.

### T1 — Upload → Nutrition label (≈20 min)
Pick a photo, get a rendered FDA-style label. The whole vision→render path.

### T2 — Chat about the food (≈18 min)
Streaming back-and-forth grounded in the identified food + its nutrition.

### T3 — Smoothness polish (≈10 min)
Typing indicator, suggested starter prompts, graceful errors, auto-scroll,
first assistant message after analysis.

## Checkpoints

- **CP-A (after T0):** `npm start` boots, `GET /` returns the page. → proceed.
- **CP-B (after T1):** real photo returns a populated label with sane numbers. → proceed.
- **CP-C (after T2):** at least 3 conversational turns that correctly reference
  the food. → proceed.
- **CP-D (after T3):** full demo flow feels smooth end-to-end. → done.

## Risks / cut-lines (1-hour discipline)

- **Over budget?** Cut USDA enrichment (T1 branch) and suggested-prompt chips (T3);
  AI-only nutrition + plain chat still satisfies the brief.
- **Vision JSON drift:** force `response_format: json_object` + a strict schema in
  the prompt; parse defensively with fallbacks so the label never crashes.
- **Streaming flakiness:** SSE first; if it fights us, fall back to a non-streamed
  `/api/chat` returning full text. Smoothness is then carried by the typing indicator.
- **Cost/latency:** downscale image client-side before upload (longest edge ~1024px).

## Out of scope

Auth, persistence, multi-image, barcode scanning, mobile-native, i18n, tests beyond
manual verification.
