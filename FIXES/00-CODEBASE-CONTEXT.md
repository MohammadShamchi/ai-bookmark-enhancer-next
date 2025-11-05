# AI Bookmark Enhancer - Codebase Context

## 🎯 Overview
This is a Chrome extension that uses OpenAI's API to intelligently organize browser bookmarks into categorized folders. The extension reads all user bookmarks, sends them to GPT for categorization, and can apply the organized structure back to Chrome bookmarks.

## 📁 Project Structure

```
ai-bookmark-enhancer-next/
├── manifest.json                 # Chrome extension manifest
├── background.js                 # Service worker (main orchestrator)
├── lib/
│   ├── ai_client.js             # OpenAI API integration
│   ├── organizer.js             # Merge AI results with bookmark data
│   ├── bookmarks.js             # Chrome bookmarks API wrapper
│   ├── apply.js                 # Apply organized structure to Chrome
│   ├── backup.js                # Export bookmarks (JSON/HTML)
│   ├── storage.js               # Chrome storage wrapper
│   ├── progress_steps.js        # Progress stage definitions
│   ├── messages.js              # Message type constants
│   ├── runtime_bus.js           # Extension messaging utilities
│   └── ui.js                    # UI utilities (transitions, etc.)
└── ui/
    ├── page1.html/js            # Home page (start organization)
    ├── page2.html/js            # Processing page (progress display)
    ├── page3.html/js            # Results page (view/apply results)
    ├── settings.html/js         # Settings (API key, fast mode)
    └── onboarding.html/js       # First-time setup
```

## 🔄 Process Flow

### 1. Organization Process (background.js → startOrganize)
```
User clicks "Organize"
  → background.js::startOrganize()
  → readBookmarks() - collect all bookmarks
  → exportJson() - backup to downloads
  → exportHtml() - backup to downloads
  → categorizeBookmarks() - send to AI
  → mergeSuggestions() - validate results
  → setOrganized() - save to storage
```

### 2. AI Categorization (lib/ai_client.js)
```
categorizeBookmarks(flatList)
  → Check for FAST_MODE toggle
  → If normal mode:
      - Split bookmarks into chunks (400 per chunk)
      - For each chunk sequentially:
          → callOpenAI() with chunk
          → Parse JSON response
          → Collect folders
      - Return all folders
  → If fast mode:
      - simulateFastMode() - use existing paths
```

### 3. Apply Structure (lib/apply.js)
```
applyStructure()
  → Create root folder "AI Organized (timestamp)"
  → Create all category folders
  → For each bookmark:
      → Duplicate into appropriate folder
      → (Original bookmarks untouched)
```

## 🗂️ Key Data Structures

### Bookmark Object (flatList)
```javascript
{
  id: "123",              // Chrome bookmark ID
  title: "Example Site",  // Bookmark title
  url: "https://...",     // Full URL
  path: "Bookmarks Bar/Tech/News",  // Current folder path
  dateAdded: 1234567890   // Timestamp
}
```

### AI Response Format
```javascript
{
  folders: [
    {
      name: "Technology",
      ids: ["123", "456", "789"]  // Bookmark IDs in this category
    },
    {
      name: "News",
      ids: ["111", "222"]
    }
  ]
}
```

### Organized Structure (storage)
```javascript
{
  folders: [
    { name: "Technology", ids: ["123", "456"] },
    { name: "News", ids: ["789"] },
    { name: "Unsorted", ids: ["999"] }  // Unassigned bookmarks
  ]
}
```

## 🔌 Key APIs Used

### Chrome APIs
- `chrome.bookmarks.getTree()` - Read all bookmarks
- `chrome.bookmarks.create()` - Create folder/bookmark
- `chrome.bookmarks.removeTree()` - Delete folder tree
- `chrome.storage.local` - Persist data
- `chrome.runtime.sendMessage()` - Page ↔ background communication
- `chrome.downloads.download()` - Export backups

### OpenAI API
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Model: `gpt-4o-mini` (hardcoded)
- Temperature: `0.2`
- Response: JSON with folder structure

## 📊 State Management

### Background Script State (background.js)
```javascript
isRunning: boolean           // Is organization in progress
aborter: AbortController     // For cancellation
cancelRequested: boolean     // Cancel flag
lastProgress: object         // Current progress state
aiStatus: object            // AI processing status
applying: boolean           // Is apply in progress
applyProgress: object       // Apply progress state
```

### Storage Keys (chrome.storage.local)
- `OPENAI_KEY` - User's API key
- `FAST_MODE` - Boolean toggle for fast mode
- `organized` - Latest AI categorization results
- `runMeta` - Current run metadata (status, progress, stats)
- `lastApplyMeta` - Info about last applied structure

## 🎨 Progress Stages (lib/progress_steps.js)
```javascript
[
  { id: 'read', label: 'Collecting bookmarks', percent: 20 },
  { id: 'bkp_json', label: 'Backup JSON', percent: 40 },
  { id: 'bkp_html', label: 'Backup HTML', percent: 60 },
  { id: 'ai', label: 'Analyzing with AI', percent: 80 },
  { id: 'done', label: 'Completed', percent: 100 }
]
```

## 🔐 Current Limitations

1. **Sequential Processing**: API calls happen one at a time
2. **No Streaming**: All bookmarks loaded into memory
3. **Hardcoded Model**: Only gpt-4o-mini supported
4. **No Retry Logic**: Failed API calls abort entire process
5. **Flat Structure**: Creates single-level folders only
6. **Fast Mode**: Uses existing paths (often meaningless)

## 🧪 Testing Notes

- Extension uses Manifest V3 (service worker, not background page)
- Service worker can restart anytime (state must be restored)
- Chrome bookmarks API is callback-based (wrapped in Promises)
- Storage has size limits (~10MB for chrome.storage.local)

## 💡 Common Patterns

### Sending Progress Updates
```javascript
function tick(stageId, override = {}) {
  lastProgress = { stageId, percent, label };
  emitRuntimeMessage({ type: MSG.PROGRESS_TICK, ...lastProgress });
  await writeRunMeta({ progress: lastProgress });
}
```

### Handling Cancellation
```javascript
const ensureActive = () => {
  if (signal?.aborted) throw new Error('CANCELLED');
};
// Check before each async operation
```

### UI Page Communication
```javascript
// From UI page:
const response = await sendRuntimeMessage({ type: MSG.START_ORGANIZE });

// In background.js:
addRuntimeMessageListener((message) => {
  if (message.type === MSG.START_ORGANIZE) {
    return startOrganize(); // Return value sent back to UI
  }
});
```

## 🎯 User's Main Issues

1. **Slow processing** for 2,066 bookmarks (~20-40 minutes)
2. **Poor UI feedback** during processing (no ETA)
3. **Fast mode doesn't work** (uses meaningless paths)
4. **Inconsistent AI results** (same bookmarks → different categories)

## 📝 Important Notes for Fixes

- **Backwards Compatibility**: Don't break existing stored data
- **Error Handling**: Extension must gracefully handle failures
- **Memory Usage**: Be mindful of large bookmark collections
- **User Privacy**: Minimize data sent to OpenAI if possible
- **Chrome API Limits**: Respect rate limits for bookmark operations
- **Service Worker Lifecycle**: State can be lost on restart

---

**Always read this context file first before working on any specific issue!**
