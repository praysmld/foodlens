export async function analyzeImage(openai, model, file) {
  const base64 = file.buffer.toString('base64');
  const mimeType = file.mimetype || 'image/jpeg';

  const resp = await openai.chat.completions.create({
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        {
          type: 'text',
          text: `Analyze this image. Return ONLY valid JSON with this exact schema — no markdown, no extra text:
{
  "food": "name of the food or null if no food detected",
  "portionGrams": <estimated grams as a number, or null>,
  "confidence": <0.0 to 1.0>,
  "portionDescription": "e.g. '1 medium banana (120g)'",
  "aiNutrition": {
    "calories": <kcal>, "totalFat": <g>, "saturatedFat": <g>, "transFat": <g>,
    "cholesterol": <mg>, "sodium": <mg>, "totalCarbohydrate": <g>,
    "dietaryFiber": <g>, "totalSugars": <g>, "addedSugars": <g>,
    "protein": <g>, "vitaminD": <mcg>, "calcium": <mg>, "iron": <mg>, "potassium": <mg>
  }
}
If no food is visible, set food and portionGrams to null and aiNutrition values to 0.`
        }
      ]
    }],
    response_format: { type: 'json_object' },
    max_completion_tokens: 600,
  });

  let raw = {};
  try { raw = JSON.parse(resp.choices[0].message.content); } catch (_) {}

  return {
    food: raw.food || null,
    portionGrams: raw.portionGrams ?? 100,
    confidence: raw.confidence ?? 0.5,
    portionDescription: raw.portionDescription || `${raw.portionGrams || 100}g`,
    aiNutrition: raw.aiNutrition || null,
  };
}
