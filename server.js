import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { analyzeImage } from './lib/vision.js';
import { lookupNutrition } from './lib/usda.js';
import { buildLabel } from './lib/nutrition.js';

const MODEL = 'gpt-5.4-mini';
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const openai = new OpenAI();

app.use(express.json());
app.use(express.static('public'));

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided.' });
  try {
    const vision = await analyzeImage(openai, MODEL, req.file);

    if (!vision.food) {
      return res.json({ food: null, message: "I couldn't spot a food item in that photo. Try a clearer shot of your meal!" });
    }

    const usdaRaw = await lookupNutrition(vision.food, vision.portionGrams);
    const source = usdaRaw ? 'usda' : 'ai-estimate';
    const nutrition = buildLabel(usdaRaw || vision.aiNutrition, vision.portionGrams);

    res.json({
      food: vision.food,
      portionGrams: vision.portionGrams,
      portionDescription: vision.portionDescription,
      confidence: vision.confidence,
      nutrition,
      source,
    });
  } catch (err) {
    console.error('analyze:', err.message);
    res.status(500).json({ error: 'Analysis failed — please try again.' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { messages = [], foodContext } = req.body;

  const n = foodContext?.nutrition || {};
  const systemPrompt = `You are a warm, knowledgeable, and non-judgmental nutrition companion. The user just uploaded a photo of their food.

Identified food: ${foodContext?.food || 'unknown'}
Estimated portion: ${foodContext?.portionDescription || `${foodContext?.portionGrams || '?'}g`}
Nutrition (estimated${foodContext?.source === 'usda' ? ', USDA data' : ', AI estimate'}):
  Calories: ${n.calories ?? '?'} kcal
  Protein: ${n.protein ?? '?'}g
  Total Fat: ${n.totalFat ?? '?'}g  |  Saturated: ${n.saturatedFat ?? '?'}g
  Carbohydrates: ${n.totalCarbohydrate ?? '?'}g  |  Fiber: ${n.dietaryFiber ?? '?'}g  |  Sugars: ${n.totalSugars ?? '?'}g
  Sodium: ${n.sodium ?? '?'}mg
  Potassium: ${n.potassium ?? '?'}mg

Speak casually and naturally. Reference these exact numbers when relevant. Keep answers concise (2-4 sentences). If the history shows earlier questions, use that context to answer follow-ups without making the user repeat themselves. Never give medical or clinical advice.${messages.length === 0 ? ' This is the start of the conversation — open with a friendly, specific observation about this food that sparks curiosity.' : ''}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const cappedMessages = messages.slice(-20);
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...(cappedMessages.length === 0
      ? [{ role: 'user', content: 'Tell me about this food.' }]
      : cappedMessages),
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: chatMessages,
      stream: true,
      max_completion_tokens: 400,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('chat:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'Chat failed — please try again.' })}\n\n`);
    res.end();
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Image too large. Please use a photo under 15 MB.' });
  }
  console.error('unhandled:', err.message);
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FoodLens → http://localhost:${PORT}`));
