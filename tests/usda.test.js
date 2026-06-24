import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupNutrition } from '../lib/usda.js';

// Minimal USDA /foods/search response with representative nutrients
const MOCK_BANANA = {
  foods: [{
    fdcId: 173944,
    description: 'Bananas, raw',
    foodNutrients: [
      { nutrientNumber: '208', value: 89   },  // calories
      { nutrientNumber: '203', value: 1.09 },  // protein
      { nutrientNumber: '204', value: 0.33 },  // totalFat
      { nutrientNumber: '205', value: 22.84 }, // totalCarbohydrate
      { nutrientNumber: '291', value: 2.6  },  // dietaryFiber
      { nutrientNumber: '307', value: 1    },  // sodium
      { nutrientNumber: '306', value: 358  },  // potassium
    ],
  }],
};

function mockFetch(body, ok = true) {
  return async () => ({ ok, json: async () => body });
}

// ── Guard: no API key ─────────────────────────────────────────────────────

test('lookupNutrition: returns null when USDA_API_KEY is absent', async () => {
  const saved = process.env.USDA_API_KEY;
  delete process.env.USDA_API_KEY;
  const result = await lookupNutrition('banana', 100);
  assert.equal(result, null);
  if (saved !== undefined) process.env.USDA_API_KEY = saved;
});

// ── Mapping & scaling ──────────────────────────────────────────────────────

test('lookupNutrition: maps nutrientNumber to label fields', async (t) => {
  process.env.USDA_API_KEY = 'testkey';
  t.mock.method(globalThis, 'fetch', mockFetch(MOCK_BANANA));

  const result = await lookupNutrition('banana', 100);
  assert.ok(result, 'should return data');
  assert.equal(result.calories,           89);
  assert.equal(result.protein,            1.1);   // 1.09 rounded 1 dp
  assert.equal(result.totalFat,           0.3);   // 0.33 rounded 1 dp
  assert.equal(result.totalCarbohydrate,  22.8);  // 22.84 rounded 1 dp
  assert.equal(result.dietaryFiber,       2.6);
  assert.equal(result.sodium,             1);
  assert.equal(result.potassium,          358);
});

test('lookupNutrition: scales nutrients to portion size', async (t) => {
  process.env.USDA_API_KEY = 'testkey';
  t.mock.method(globalThis, 'fetch', mockFetch(MOCK_BANANA));

  // 120g portion → ×1.2 scale
  const result = await lookupNutrition('banana', 120);
  assert.ok(result);
  // 89 × 1.2 = 106.8
  assert.equal(result.calories, 106.8);
  // 1.09 × 1.2 = 1.308 → 1.3
  assert.equal(result.protein, 1.3);
  // 358 × 1.2 = 429.6
  assert.equal(result.potassium, 429.6);
});

test('lookupNutrition: 50g half-portion scales correctly', async (t) => {
  process.env.USDA_API_KEY = 'testkey';
  t.mock.method(globalThis, 'fetch', mockFetch(MOCK_BANANA));

  const result = await lookupNutrition('banana', 50);
  assert.ok(result);
  // 89 × 0.5 = 44.5
  assert.equal(result.calories, 44.5);
});

// ── Error / edge cases ────────────────────────────────────────────────────

test('lookupNutrition: returns null when foods array is empty', async (t) => {
  process.env.USDA_API_KEY = 'testkey';
  t.mock.method(globalThis, 'fetch', mockFetch({ foods: [] }));

  const result = await lookupNutrition('unknownthing123', 100);
  assert.equal(result, null);
});

test('lookupNutrition: returns null when USDA responds non-ok', async (t) => {
  process.env.USDA_API_KEY = 'testkey';
  t.mock.method(globalThis, 'fetch', mockFetch({}, false));

  const result = await lookupNutrition('banana', 100);
  assert.equal(result, null);
});

test('lookupNutrition: returns null when fetch throws (network error)', async (t) => {
  process.env.USDA_API_KEY = 'testkey';
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('timeout'); });

  const result = await lookupNutrition('banana', 100);
  assert.equal(result, null);
});

test('lookupNutrition: returns null when food has no useful nutrients', async (t) => {
  process.env.USDA_API_KEY = 'testkey';
  t.mock.method(globalThis, 'fetch', mockFetch({
    foods: [{ fdcId: 1, foodNutrients: [
      { nutrientNumber: '999', value: 5 }, // unknown nutrient number
    ]}],
  }));

  const result = await lookupNutrition('weirdthing', 100);
  assert.equal(result, null);
});
