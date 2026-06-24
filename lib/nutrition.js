const DV = {
  totalFat: 78,
  saturatedFat: 20,
  cholesterol: 300,
  sodium: 2300,
  totalCarbohydrate: 275,
  dietaryFiber: 28,
  addedSugars: 50,
  protein: 50,
  vitaminD: 20,
  calcium: 1300,
  iron: 18,
  potassium: 4700,
};

function pct(val, daily) {
  if (val == null || !daily) return null;
  return Math.round((val / daily) * 100);
}

export function buildLabel(nutrients, portionGrams) {
  const n = nutrients || {};
  return {
    portionGrams,
    calories: n.calories ?? null,
    totalFat: n.totalFat ?? null,
    saturatedFat: n.saturatedFat ?? null,
    transFat: n.transFat ?? null,
    cholesterol: n.cholesterol ?? null,
    sodium: n.sodium ?? null,
    totalCarbohydrate: n.totalCarbohydrate ?? null,
    dietaryFiber: n.dietaryFiber ?? null,
    totalSugars: n.totalSugars ?? null,
    addedSugars: n.addedSugars ?? null,
    protein: n.protein ?? null,
    vitaminD: n.vitaminD ?? null,
    calcium: n.calcium ?? null,
    iron: n.iron ?? null,
    potassium: n.potassium ?? null,
    dv: {
      totalFat: pct(n.totalFat, DV.totalFat),
      saturatedFat: pct(n.saturatedFat, DV.saturatedFat),
      cholesterol: pct(n.cholesterol, DV.cholesterol),
      sodium: pct(n.sodium, DV.sodium),
      totalCarbohydrate: pct(n.totalCarbohydrate, DV.totalCarbohydrate),
      dietaryFiber: pct(n.dietaryFiber, DV.dietaryFiber),
      addedSugars: pct(n.addedSugars, DV.addedSugars),
      protein: pct(n.protein, DV.protein),
      vitaminD: pct(n.vitaminD, DV.vitaminD),
      calcium: pct(n.calcium, DV.calcium),
      iron: pct(n.iron, DV.iron),
      potassium: pct(n.potassium, DV.potassium),
    },
  };
}
