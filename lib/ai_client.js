const CHUNK_SIZE = 400;
const MODEL = 'gpt-4o-mini';

/**
 * Categorize bookmarks using OpenAI API
 * @param {Array} flatList - Array of bookmark objects
 * @param {Object} options
 * @param {Function} options.onProgress - Optional callback for progress updates
 * @param {AbortSignal} options.signal - Optional abort signal
 * @returns {Promise<{folders: Array}>} - Organized folder structure
 */
export async function categorizeBookmarks(flatList, { onProgress = null, signal = null } = {}) {
  // Get API key from storage
  const { OPENAI_KEY } = await chrome.storage.local.get('OPENAI_KEY');
  if (!OPENAI_KEY) {
    throw new Error('OPENAI_KEY not found in chrome.storage.local. Please set it in extension settings.');
  }

  const ensureActive = () => {
    if (signal?.aborted) {
      throw new Error('CANCELLED');
    }
  };


  // Chunk if needed
  const chunks = flatList.length > 500
    ? chunkArray(flatList, CHUNK_SIZE)
    : [flatList];

  const allFolders = [];

  for (let i = 0; i < chunks.length; i++) {
    ensureActive();

    const chunk = chunks[i];

    try {
      const result = await callOpenAI(OPENAI_KEY, chunk, false, signal);

      if (result.folders && Array.isArray(result.folders)) {
        allFolders.push(...result.folders);
      }

      // Emit progress tick (80% → 95% range)
      if (onProgress) {
        const progress = 80 + Math.floor((i + 1) / chunks.length * 15);
        onProgress(progress, `AI analyzing chunk ${i + 1}/${chunks.length}`);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'CANCELLED') {
        console.warn('[ai_client.js] Categorization loop aborted');
        throw new Error('CANCELLED');
      }
      console.error(`[ai_client.js] Error processing chunk ${i + 1}:`, error);
      // Continue with other chunks
    }
  }

  return { folders: allFolders };
}

export async function validateKey(rawKey, { signal = null } = {}) {
  const key = rawKey?.trim();
  if (!key) {
    const error = new Error('KEY_REQUIRED');
    error.code = 'KEY_REQUIRED';
    throw error;
  }

  const res = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    const error = new Error('VALIDATION_FAILED');
    error.code = 'VALIDATION_FAILED';
    error.status = res.status;
    error.statusText = res.statusText;
    error.body = body;
    throw error;
  }

  return res.json();
}

/**
 * Call OpenAI API with retry on JSON parse error
 */
async function callOpenAI(apiKey, chunk, retry = false, signal = null) {
  const systemPrompt = 'You are an assistant that organizes bookmarks.';
  const userPrompt = retry
    ? `Return ONLY valid JSON with no markdown formatting or code fences. Format: {"folders":[{"name":"Category Name","ids":["id1","id2"]}]}. Organize these bookmarks: ${JSON.stringify(chunk)}`
    : `Given this JSON list, return a JSON object: { "folders": [{ "name": "...", "ids": [...] }] }. Use only provided ids. No prose, ONLY JSON. Bookmarks: ${JSON.stringify(chunk)}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }),
    signal
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('INVALID_KEY');
    }
    const errorText = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  // Strip markdown code fences if present
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      folders: parsed.folders || [],
      usage: data.usage
    };
  } catch (parseError) {
    if (!retry) {
      console.warn('[ai_client.js] JSON parse failed, retrying with stricter prompt');
      return callOpenAI(apiKey, chunk, true, signal);
    }
    console.error('[ai_client.js] Failed to parse JSON after retry:', cleaned);
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Split array into chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
