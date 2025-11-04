// Log when page loads
console.log('AI Bookmark Enhancer - Settings page loaded');

const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusDiv = document.getElementById('status');

// Load existing API key on page load
(async () => {
  try {
    const { OPENAI_KEY } = await chrome.storage.local.get('OPENAI_KEY');
    if (OPENAI_KEY) {
      apiKeyInput.value = OPENAI_KEY;
      console.log('[settings.js] Loaded existing API key');
    }
  } catch (error) {
    console.error('[settings.js] Error loading API key:', error);
  }
})();

// Save API key
saveBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    showStatus('Please enter an API key', 'error');
    return;
  }

  try {
    await chrome.storage.local.set({ OPENAI_KEY: key });
    showStatus('API key saved successfully', 'success');
    console.log('[settings.js] API key saved');
  } catch (error) {
    showStatus(`Error saving key: ${error.message}`, 'error');
    console.error('[settings.js] Error saving API key:', error);
  }
});

// Test connection
testBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    showStatus('Please enter an API key to test', 'error');
    return;
  }

  showStatus('Testing connection...', 'success');
  console.log('[settings.js] Testing API connection');

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      showStatus(`✓ Connection OK (${data.data?.length || 0} models available)`, 'success');
      console.log('[settings.js] Connection test successful:', data);
    } else {
      const errorText = await response.text();
      showStatus(`✗ Connection failed: ${response.status} ${response.statusText}`, 'error');
      console.error('[settings.js] Connection test failed:', response.status, errorText);
    }
  } catch (error) {
    showStatus(`✗ Network error: ${error.message}`, 'error');
    console.error('[settings.js] Connection test error:', error);
  }
});

// Helper to show status messages
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }
}
