// ── State ──────────────────────────────────────────────────────────────────
let foodContext = null;
let chatHistory = [];   // [{role, content}] — full thread, sent every turn
let streaming = false;

// ── DOM refs ───────────────────────────────────────────────────────────────
const uploadSection  = document.getElementById('upload-section');
const resultsSection = document.getElementById('results-section');
const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const preview        = document.getElementById('preview');
const dropText       = document.getElementById('drop-text');
const uploadStatus   = document.getElementById('upload-status');
const labelEl        = document.getElementById('nutrition-label');
const foodBanner     = document.getElementById('food-name-banner');
const messagesEl     = document.getElementById('messages');
const chipsEl        = document.getElementById('chips');
const chatInput      = document.getElementById('chat-input');
const sendBtn        = document.getElementById('send-btn');

// ── Image downscaling ──────────────────────────────────────────────────────
function downscaleImage(file, maxDim = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.85);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

// ── Upload & analyze ───────────────────────────────────────────────────────
async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  // Show preview
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  dropText.textContent = 'Analyzing…';
  showStatus('Analyzing your food… this may take a few seconds.', '');

  const blob = await downscaleImage(file);
  const form = new FormData();
  form.append('image', blob, 'food.jpg');

  try {
    const res  = await fetch('/api/analyze', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok || data.error) {
      showStatus(data.error || 'Something went wrong. Please try again.', 'error');
      dropText.textContent = 'Drop a food photo here, or click to browse';
      return;
    }

    if (!data.food) {
      showStatus(data.message, 'info');
      dropText.textContent = 'Drop a food photo here, or click to browse';
      return;
    }

    uploadStatus.hidden = true;
    foodContext  = data;
    chatHistory  = [];

    renderLabel(data);
    showResults();
    seedOpeningMessage();
  } catch (_) {
    showStatus('Network error — please check your connection and try again.', 'error');
    dropText.textContent = 'Drop a food photo here, or click to browse';
  }
}

function showStatus(msg, type) {
  uploadStatus.textContent = msg;
  uploadStatus.className   = type;
  uploadStatus.hidden      = false;
}

// ── FDA Nutrition Facts label renderer ────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function renderMarkdown(text) {
  return esc(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
}
function fmt(val, unit = '') {
  if (val == null) return '—';
  return `${val}${unit}`;
}
function dv(val) {
  if (val == null) return '';
  return `${val}%`;
}

function renderLabel(data) {
  const { food, portionDescription, nutrition: n, source } = data;

  foodBanner.textContent = food;

  labelEl.innerHTML = `
<div class="nutrition-label">
  <div class="nf-title">Nutrition Facts</div>
  <div class="nf-servings">1 serving per container</div>
  <div class="nf-serving-size">Serving size <strong>${esc(portionDescription || `${data.portionGrams}g`)}</strong></div>
  <hr class="nf-rule-thick">

  <div class="nf-calories-label">Amount per serving</div>
  <div class="nf-calories-row">
    <span class="nf-calories-word">Calories</span>
    <span class="nf-calories-num">${fmt(n.calories)}</span>
  </div>
  <hr class="nf-rule-medium">

  <div class="nf-dv-header">% Daily Value*</div>

  <div class="nf-row bold"><span class="nf-name">Total Fat ${fmt(n.totalFat, 'g')}</span><span class="nf-dv">${dv(n.dv.totalFat)}</span></div>
  <hr class="nf-rule-thin">
  <div class="nf-row indent"><span class="nf-name">Saturated Fat ${fmt(n.saturatedFat, 'g')}</span><span class="nf-dv">${dv(n.dv.saturatedFat)}</span></div>
  <hr class="nf-rule-thin">
  <div class="nf-row indent"><span class="nf-name"><em>Trans</em> Fat ${fmt(n.transFat, 'g')}</span><span class="nf-dv"></span></div>
  <hr class="nf-rule-thin">
  <div class="nf-row bold"><span class="nf-name">Cholesterol ${fmt(n.cholesterol, 'mg')}</span><span class="nf-dv">${dv(n.dv.cholesterol)}</span></div>
  <hr class="nf-rule-thin">
  <div class="nf-row bold"><span class="nf-name">Sodium ${fmt(n.sodium, 'mg')}</span><span class="nf-dv">${dv(n.dv.sodium)}</span></div>
  <hr class="nf-rule-thin">
  <div class="nf-row bold"><span class="nf-name">Total Carbohydrate ${fmt(n.totalCarbohydrate, 'g')}</span><span class="nf-dv">${dv(n.dv.totalCarbohydrate)}</span></div>
  <hr class="nf-rule-thin">
  <div class="nf-row indent"><span class="nf-name">Dietary Fiber ${fmt(n.dietaryFiber, 'g')}</span><span class="nf-dv">${dv(n.dv.dietaryFiber)}</span></div>
  <hr class="nf-rule-thin">
  <div class="nf-row indent"><span class="nf-name">Total Sugars ${fmt(n.totalSugars, 'g')}</span><span class="nf-dv"></span></div>
  <hr class="nf-rule-thin">
  <div class="nf-row sub-indent"><span class="nf-name">Includes ${fmt(n.addedSugars, 'g')} Added Sugars</span><span class="nf-dv">${dv(n.dv.addedSugars)}</span></div>
  <hr class="nf-rule-thin">
  <div class="nf-row bold"><span class="nf-name">Protein ${fmt(n.protein, 'g')}</span><span class="nf-dv">${dv(n.dv.protein)}</span></div>

  <hr class="nf-rule-thick">
  <div class="nf-vitamins">
    <div class="nf-vitamin-row"><span>Vitamin D ${fmt(n.vitaminD, 'mcg')}</span><span>${dv(n.dv.vitaminD)}</span></div>
    <hr class="nf-rule-thin">
    <div class="nf-vitamin-row"><span>Calcium ${fmt(n.calcium, 'mg')}</span><span>${dv(n.dv.calcium)}</span></div>
    <hr class="nf-rule-thin">
    <div class="nf-vitamin-row"><span>Iron ${fmt(n.iron, 'mg')}</span><span>${dv(n.dv.iron)}</span></div>
    <hr class="nf-rule-thin">
    <div class="nf-vitamin-row"><span>Potassium ${fmt(n.potassium, 'mg')}</span><span>${dv(n.dv.potassium)}</span></div>
  </div>

  <hr class="nf-rule-thick">
  <div class="nf-footnote">* The % Daily Value tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.</div>

  <div class="nf-source-badge ${source === 'ai-estimate' ? 'ai' : ''}">
    ${source === 'usda' ? '✓ USDA data' : '⚠ AI estimate'}
  </div>
  <div class="nf-disclaimer">Estimated — not medical or clinical advice.</div>
</div>`;
}

// ── Results / upload section toggle ───────────────────────────────────────
function showResults() {
  uploadSection.hidden  = true;
  resultsSection.hidden = false;
  chatInput.disabled    = false;
  sendBtn.disabled      = false;
  chipsEl.hidden        = false;
}

function resetToUpload() {
  uploadSection.hidden  = false;
  resultsSection.hidden = true;
  uploadStatus.hidden   = true;
  preview.hidden        = true;
  dropText.textContent  = 'Drop a food photo here, or click to browse';
  messagesEl.innerHTML  = '';
  labelEl.innerHTML     = '';
  foodContext           = null;
  chatHistory           = [];
  fileInput.value       = '';
}

// ── Chat ──────────────────────────────────────────────────────────────────
function appendUserMessage(text) {
  const el = document.createElement('div');
  el.className = 'message user';
  el.textContent = text;
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function appendAssistantMessage(text) {
  const el = document.createElement('div');
  el.className = 'message assistant';
  el.textContent = text;
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function showTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  messagesEl.appendChild(el);
  scrollToBottom();
}

function removeTypingIndicator() {
  document.getElementById('typing')?.remove();
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setInputEnabled(enabled) {
  chatInput.disabled = !enabled;
  sendBtn.disabled   = !enabled;
}

// Opening message: call /api/chat with empty history
async function seedOpeningMessage() {
  showTypingIndicator();
  setInputEnabled(false);
  chipsEl.hidden = true;
  streaming = true;

  let fullText = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [], foodContext }),
    });

    removeTypingIndicator();
    const el = document.createElement('div');
    el.className = 'message assistant';
    messagesEl.appendChild(el);

    fullText = await consumeSSE(res, (token) => {
      el.textContent += token;
      scrollToBottom();
    });
    el.innerHTML = renderMarkdown(fullText);

    // Store the opening as first history entry so later turns can reference it
    chatHistory.push({ role: 'assistant', content: fullText });
  } catch (_) {
    removeTypingIndicator();
    const fallback = `Here's your ${foodContext.food}! Ask me anything about it.`;
    appendAssistantMessage(fallback);
    chatHistory.push({ role: 'assistant', content: fallback });
  }

  streaming = false;
  setInputEnabled(true);
  chipsEl.hidden = false;
  scrollToBottom();
}

async function sendMessage(text) {
  if (!text.trim() || streaming) return;

  appendUserMessage(text);
  chatHistory.push({ role: 'user', content: text });
  chatInput.value = '';

  showTypingIndicator();
  setInputEnabled(false);
  chipsEl.hidden = true;
  streaming = true;

  let fullText = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory, foodContext }),
    });

    removeTypingIndicator();

    if (!res.ok) throw new Error('bad response');

    const el = document.createElement('div');
    el.className = 'message assistant';
    messagesEl.appendChild(el);

    fullText = await consumeSSE(res, (token) => {
      el.textContent += token;
      scrollToBottom();
    });
    el.innerHTML = renderMarkdown(fullText);

    chatHistory.push({ role: 'assistant', content: fullText });
  } catch (_) {
    removeTypingIndicator();
    const errMsg = 'Sorry, something went wrong. Try again?';
    appendAssistantMessage(errMsg);
    // Don't push error into history — it would confuse the model
    chatHistory.pop(); // remove the user message that failed
  }

  streaming = false;
  setInputEnabled(true);
  chipsEl.hidden = false;
  scrollToBottom();
}

// Parse SSE stream from a fetch Response, call onToken for each token,
// return the full accumulated text.
async function consumeSSE(res, onToken) {
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';
  let full      = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop(); // incomplete line stays in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return full;
      try {
        const obj = JSON.parse(payload);
        if (obj.token) { onToken(obj.token); full += obj.token; }
        if (obj.error) throw new Error(obj.error);
      } catch (e) {
        if (e.message !== payload) throw e; // re-throw real parse errors
      }
    }
  }
  return full;
}

// ── Event wiring ──────────────────────────────────────────────────────────
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

sendBtn.addEventListener('click', () => sendMessage(chatInput.value));

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput.value); }
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => sendMessage(chip.dataset.text));
});

document.getElementById('new-photo-btn').addEventListener('click', resetToUpload);
