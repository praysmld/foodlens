# FoodLens — Task List

Status: `[ ]` todo · `[~]` in progress · `[x]` done

---

## T0 — Scaffold + boot  (depends: none)

- [ ] `npm init -y`; install `express`, `multer`, `openai`, `dotenv`
- [ ] `server.js`: load `.env`, Express app, `express.static('public')`, listen on PORT
- [ ] `public/index.html` placeholder ("FoodLens" heading) + `public/app.js`, `public/style.css`

**Acceptance:** server boots clean; page loads with heading and no console errors.
**Verify:** `npm start` → open `http://localhost:3000` → see heading; terminal shows "listening".

### ▣ CHECKPOINT CP-A — server boots & serves page

---

## T1 — Upload → Nutrition label  (depends: T0)

- [ ] Client: file input + preview; downscale image (canvas, longest edge ~1024px); POST to `/api/analyze`
- [ ] Server `/api/analyze`: receive image (multer), call `gpt-4o` vision with strict
      JSON schema prompt, `response_format: json_object`; return `{food, portion, nutrition}`
- [ ] Defensive parse with field fallbacks (missing → `null`/`0`, never crash)
- [ ] Client: render FDA-style Nutrition Facts label from JSON (servings, calories,
      macros, %DV, vitamins) with "Estimated" disclaimer
- [ ] *(optional branch)* USDA FoodData Central lookup on `food` to refine macros; merge

**Acceptance:** uploading a real food photo shows a populated, FDA-formatted label
with plausible numbers and the food name; bad/no-food image shows a friendly message.
**Verify:** upload 2 different food photos → labels differ and look reasonable;
upload a non-food image → graceful "couldn't identify food" message.

### ▣ CHECKPOINT CP-B — real photo → populated label

---

## T2 — Chat about the food  (depends: T1)

- [ ] Server `/api/chat`: accept `{messages, foodContext}`; stream `gpt-4o` via SSE;
      system prompt = friendly nutrition companion grounded in the analyzed food
- [ ] Client: chat UI (message list + input); send history + food context; render
      streamed tokens incrementally
- [ ] Seed conversation: after T1 analysis, assistant opens with a natural line about the food
- [ ] Fallback: if SSE fails, non-streamed full-text response

**Acceptance:** ≥3 back-and-forth turns that correctly reference the identified food
and its nutrition; responses stream in (or appear smoothly via fallback).
**Verify:** ask "is this healthy?", "how do I make it lighter?", "how much protein?" →
answers are on-topic, reference the actual food, and read naturally.

### ▣ CHECKPOINT CP-C — 3+ grounded conversational turns

---

## T3 — Smoothness polish  (depends: T2)

- [ ] Typing indicator while assistant responds
- [ ] 3 suggested starter-prompt chips (e.g. "Is this healthy?", "Lighter swaps?", "Macros?")
- [ ] Auto-scroll to latest message; disable input while streaming
- [ ] Loading state during analysis; clear error states for upload/network failures
- [ ] Quick visual pass (spacing, mobile width)

**Acceptance:** full demo — upload → label → chat — feels smooth with no dead air,
jank, or unhandled errors.
**Verify:** run the whole flow once start-to-finish as a user would; note any rough edge.

### ▣ CHECKPOINT CP-D — smooth end-to-end demo

---

## Cut-lines if over 60 min
1. Drop USDA enrichment (T1 optional branch).
2. Drop suggested-prompt chips (T3).
3. Drop SSE streaming → use non-streamed chat + typing indicator.
