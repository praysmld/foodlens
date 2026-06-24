const BASE = 'https://api.nal.usda.gov/fdc/v1';

// nutrientNumber (USDA traditional number as string) → label field
const NUTRIENT_MAP = {
  '208': 'calories',
  '204': 'totalFat',
  '606': 'saturatedFat',
  '605': 'transFat',
  '601': 'cholesterol',
  '307': 'sodium',
  '205': 'totalCarbohydrate',
  '291': 'dietaryFiber',
  '269': 'totalSugars',
  '539': 'addedSugars',
  '203': 'protein',
  '328': 'vitaminD',
  '301': 'calcium',
  '303': 'iron',
  '306': 'potassium',
};

export async function lookupNutrition(foodName, portionGrams) {
  const key = process.env.USDA_API_KEY;
  if (!key) return null;

  try {
    const url = `${BASE}/foods/search?query=${encodeURIComponent(foodName)}&dataType=Foundation,SR%20Legacy&pageSize=3&api_key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;

    const data = await res.json();
    const foods = data.foods || [];
    const food = foods.find(f => f.foodNutrients?.length > 5) || foods[0];
    if (!food?.foodNutrients?.length) return null;

    const per100g = {};
    for (const n of food.foodNutrients) {
      const num = String(n.nutrientNumber ?? n.nutrientId ?? '');
      const field = NUTRIENT_MAP[num];
      if (field && n.value != null) per100g[field] = n.value;
    }

    if (!per100g.calories && !per100g.protein) return null;

    const scale = portionGrams / 100;
    const scaled = {};
    for (const [field, val] of Object.entries(per100g)) {
      scaled[field] = Math.round(val * scale * 10) / 10;
    }
    return scaled;
  } catch (_) {
    return null;
  }
}
