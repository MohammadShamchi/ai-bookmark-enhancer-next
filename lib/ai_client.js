/**
 * OpenAI client for bookmark categorization
 */

import { MSG } from './messages.js';

const CHUNK_SIZE = 400;
const MODEL = 'gpt-4o-mini';

// Global abort controller for cancellation
let abortController = null;

/**
 * Categorize bookmarks using OpenAI API
 * @param {Array} flatList - Array of bookmark objects
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<{folders: Array}>} - Organized folder structure
 */
export async function categorizeBookmarks(flatList, progressCallback = null) {
  console.log('[ai_client.js] Starting categorization');

  // Get API key from storage
  const { OPENAI_KEY } = await chrome.storage.local.get('OPENAI_KEY');
  if (!OPENAI_KEY) {
    throw new Error('OPENAI_KEY not found in chrome.storage.local. Please set it in extension settings.');
  }

  // Initialize abort controller
  abortController = new AbortController();

  const startTime = Date.now();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  // Chunk if needed
  const chunks = flatList.length > 500
    ? chunkArray(flatList, CHUNK_SIZE)
    : [flatList];

  console.log(`[ai_client.js] Processing ${flatList.length} bookmarks in ${chunks.length} chunk(s)`);

  const allFolders = [];

  for (let i = 0; i < chunks.length; i++) {
    // Check if cancelled
    if (abortController.signal.aborted) {
      console.log('[ai_client.js] Categorization cancelled');
      throw new Error('CANCELLED');
    }

    const chunk = chunks[i];
    console.log(`[ai_client.js] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} items)`);

    const chunkStart = Date.now();

    try {
      const result = await callOpenAI(OPENAI_KEY, chunk, false, abortController.signal);

      if (result.folders && Array.isArray(result.folders)) {
        allFolders.push(...result.folders);
      }

      if (result.usage) {
        totalPromptTokens += result.usage.prompt_tokens || 0;
        totalCompletionTokens += result.usage.completion_tokens || 0;
      }

      const chunkTime = Date.now() - chunkStart;
      console.log(`[ai_client.js] Chunk ${i + 1} completed in ${chunkTime}ms`);

      // Emit progress tick (80% → 95% range)
      if (progressCallback) {
        const progress = 80 + Math.floor((i + 1) / chunks.length * 15);
        progressCallback(progress, `AI analyzing chunk ${i + 1}/${chunks.length}`);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'CANCELLED') {
        throw new Error('CANCELLED');
      }
      console.error(`[ai_client.js] Error processing chunk ${i + 1}:`, error);
      // Continue with other chunks
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`[ai_client.js] Categorization complete in ${totalTime}ms`);
  console.log(`[ai_client.js] Token usage: ${totalPromptTokens} prompt + ${totalCompletionTokens} completion = ${totalPromptTokens + totalCompletionTokens} total`);

  return { folders: allFolders };
}

/**
 * Cancel ongoing categorization
 */
export function cancelCategorization() {
  if (abortController) {
    console.log('[ai_client.js] Aborting categorization');
    abortController.abort();
  }
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
