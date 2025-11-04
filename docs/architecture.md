# AI Bookmark Enhancer v2 — Architecture

This document outlines the technical architecture and implementation phases for the AI Bookmark Enhancer v2 rebuild.

## Design Philosophy

The v2 rebuild focuses on:
- **Manifest V3 compliance** with service workers instead of background pages
- **Full-screen UI** for better user experience and workspace
- **Modular architecture** with clear separation between data, logic, and presentation
- **CSP-safe implementation** avoiding inline scripts and eval()
- **Progressive enhancement** building features in phases

## Technical Stack

- **Runtime**: Chrome Extension APIs (Manifest V3)
- **Language**: Vanilla JavaScript (ES6+)
- **UI**: HTML5 + CSS3 (no framework dependencies)
- **Storage**: Chrome Storage API + IndexedDB for large datasets
- **AI Integration**: External API calls from service worker

## Phase 1: Skeleton Setup

**Goal**: Establish MV3 foundation with full-screen UI

**Components:**
- `manifest.json`: MV3 manifest with proper permissions (bookmarks, storage, scripting, activeTab)
- `background.js`: Service worker handling extension icon clicks
- `ui/index.html`: Full-screen interface entry point
- `ui/styles.css`: Base styles for full-screen layout

**Deliverable**: Loadable extension that opens a full-screen tab when clicked

## Phase 2: Real Bookmark Backups

**Goal**: Enable users to export and restore complete bookmark trees

**Components:**
- `lib/bookmark-api.js`: Wrapper around chrome.bookmarks API
- `lib/export.js`: JSON serialization of bookmark tree
- `lib/import.js`: Restoration with conflict resolution
- `ui/backup-panel.js`: UI for export/import operations

**Features:**
- Export entire bookmark tree to JSON file
- Import with options (merge, replace, selective restore)
- Backup versioning and metadata (timestamp, Chrome version, bookmark count)
- Validation and error handling for corrupted imports

**Data Model:**
```javascript
{
  version: "2.0.0",
  timestamp: 1234567890,
  chromeVersion: "120.0.0",
  bookmarks: [ /* tree structure */ ]
}
```

## Phase 3: AI Categorization

**Goal**: Analyze and organize bookmarks using AI

**Architecture:**
- **Chunking strategy**: Process bookmarks in batches of 50-100 to avoid API limits
- **Analysis endpoint**: External AI service (OpenAI/Anthropic) via service worker
- **Category detection**: Extract themes, topics, and suggested folder structure
- **User control**: Review and approve AI suggestions before applying

**Components:**
- `lib/ai-client.js`: API wrapper with rate limiting and retry logic
- `lib/chunker.js`: Split bookmark tree into processable chunks
- `lib/categorizer.js`: Apply AI suggestions to bookmark structure
- `ui/categorization-panel.js`: Review interface for AI suggestions

**Workflow:**
1. User triggers categorization
2. System chunks bookmarks by folder or count
3. Service worker sends chunks to AI with context
4. AI returns category suggestions per chunk
5. UI displays suggestions with preview
6. User approves/edits categories
7. System applies changes to bookmark tree

**AI Prompt Strategy:**
```
Analyze these bookmarks and suggest categories based on:
- URL domains and paths
- Bookmark titles
- Existing folder structure
- Common themes across the chunk
Return: [{ bookmarkId, suggestedCategory, confidence }]
```

## Phase 4: Onboarding + Progress Polish

**Goal**: Improve first-time user experience and provide progress feedback

**Features:**
- **Onboarding flow**: Explain features on first launch
- **Progress indicators**: Show processing status during backups and AI operations
- **Empty states**: Guide users when no bookmarks exist
- **Error recovery**: Clear messaging and retry options for failures
- **Settings panel**: Configure AI service, backup preferences, UI options

**Components:**
- `ui/onboarding.js`: Multi-step welcome flow
- `ui/progress.js`: Reusable progress UI component
- `ui/settings.js`: Configuration interface
- `lib/state-manager.js`: Track user progress and preferences

**UX Improvements:**
- Loading skeletons during data fetch
- Toast notifications for success/error states
- Keyboard shortcuts for common actions
- Responsive layout for different screen sizes
- Dark mode support

## Data Flow

```
User Action (UI)
    ↓
Event Handler (ui/*.js)
    ↓
Business Logic (lib/*.js)
    ↓
Chrome API / External Service
    ↓
Service Worker (background.js)
    ↓
Storage / Bookmarks Update
    ↓
UI Update (reactive)
```

## Security Considerations

- **Permissions**: Request only necessary permissions (bookmarks, storage, scripting, activeTab)
- **CSP compliance**: No inline scripts, all code in external files
- **API keys**: Store securely in chrome.storage.local (encrypted)
- **User data**: All processing local except AI calls (user consent required)
- **Network requests**: Only to approved AI endpoints, no third-party tracking

## Performance Targets

- Extension load time: < 500ms
- Full-screen UI render: < 200ms
- Bookmark tree export: < 2s for 10,000 bookmarks
- AI categorization: < 30s for 1,000 bookmarks (chunked)
- Memory footprint: < 50MB during active use

## Testing Strategy

- **Unit tests**: Business logic in `lib/` using Jest
- **Integration tests**: Chrome API mocks for bookmark operations
- **Manual testing**: Load extension in Chrome, test all flows
- **Performance profiling**: Chrome DevTools for memory and timing
- **Edge cases**: Empty bookmarks, large trees (10k+ items), network failures

## Future Enhancements

- Duplicate bookmark detection and merging
- Scheduled automatic backups
- Sync across devices via cloud storage
- Advanced search and filtering
- Bookmark preview with screenshots
- Tag-based organization alongside folders

## Migration Notes

Users migrating from v1:
- No automatic migration (v1 and v2 are independent)
- Export bookmarks from v1 if needed before uninstall
- v2 starts fresh with current Chrome bookmarks
- v1 popup data not compatible with v2 structure

