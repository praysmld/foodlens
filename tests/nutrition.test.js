import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLabel } from '../lib/nutrition.js';

// ── Happy-path ─────────────────────────────────────────────────────────────

test('buildLabel: passes through all nutrient values', () => {
  const n = { calories: 89, protein: 1.1, totalFat: 3, saturatedFat: 0.5,
               transFat: 0, cholesterol: 10, sodium: 5, totalCarbohydrate: 22,
               dietaryFiber: 2, totalSugars: 14, addedSugars: 0,
               vitaminD: 0, calcium: 6, iron: 0.3, potassium: 358 };
  const label = buildLabel(n, 100);
  for (const [k, v] of Object.entries(n)) {
    assert.equal(label[k], v, `field ${k}`);
  }
});

test('buildLabel: stores portionGrams', () => {
  const label = buildLabel({ calories: 100 }, 150);
  assert.equal(label.portionGrams, 150);
});

test('buildLabel: computes %DV for totalFat (DV=78g)', () => {
  // 39g fat / 78g DV = 50%
  const label = buildLabel({ totalFat: 39 }, 100);
  assert.equal(label.dv.totalFat, 50);
});

test('buildLabel: computes %DV for sodium (DV=2300mg)', () => {
  // 460mg / 2300mg = 20%
  const label = buildLabel({ sodium: 460 }, 100);
  assert.equal(label.dv.sodium, 20);
});

test('buildLabel: rounds %DV to nearest integer', () => {
  // 10mg cholesterol / 300mg DV = 3.33% → rounds to 3
  const label = buildLabel({ cholesterol: 10 }, 100);
  assert.equal(label.dv.cholesterol, 3);
});

// ── Zero-value bug ─────────────────────────────────────────────────────────
// FDA labels show "0%" when a nutrient is present but zero (e.g. 0g fat → 0%DV).
// The original pct() returned null for val===0, which incorrectly shows "—"
// instead of "0%" on the label.

test('buildLabel: zero fat value → 0% DV (not null)', () => {
  const label = buildLabel({ totalFat: 0 }, 100);
  assert.equal(label.dv.totalFat, 0,
    'zero nutrient should render as 0% DV, not hidden');
});

test('buildLabel: zero sodium → 0% DV', () => {
  const label = buildLabel({ sodium: 0 }, 100);
  assert.equal(label.dv.sodium, 0);
});

// ── Null / missing input ──────────────────────────────────────────────────

test('buildLabel: missing nutrients produce null (not crash)', () => {
  const label = buildLabel({}, 100);
  assert.equal(label.calories, null);
  assert.equal(label.dv.sodium, null);
  assert.equal(label.dv.totalFat, null);
});

test('buildLabel: null nutrients arg does not throw', () => {
  assert.doesNotThrow(() => buildLabel(null, 100));
  const label = buildLabel(null, 100);
  assert.equal(label.calories, null);
});

test('buildLabel: null %DV for nutrients with null value', () => {
  const label = buildLabel({ totalFat: null }, 100);
  assert.equal(label.dv.totalFat, null);
});
