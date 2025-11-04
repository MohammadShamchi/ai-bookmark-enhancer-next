# AI Bookmark Enhancer — v2 (Manifest V3 Rebuild)

AI Bookmark Enhancer v2 is a complete rebuild of the bookmark management extension, designed for Chrome with Manifest V3 compliance. This version introduces a full-screen UI, real bookmark backups, AI-powered chunk categorization, and eliminates Content Security Policy issues that plagued v1.

## Evolution from v1 to v2

**v1 (Legacy)** was a prototype with a popup interface that had limitations:
- Popup UI constraints
- CSP violations with inline scripts
- Limited backup functionality
- Basic categorization

**v2 (Current)** represents a ground-up rebuild:
- **Full-screen UI**: Work with bookmarks in a dedicated tab with ample space
- **Real backups**: Export and restore bookmark trees with full fidelity
- **AI categorization**: Intelligent bookmark organization using chunk-based analysis
- **MV3 CSP-safe**: Clean architecture with no inline scripts or eval()
- **Modern UX**: Onboarding flows, progress tracking, and polished interactions

## Key Improvements

- 🎨 **Full-screen interface** for comfortable bookmark management
- 💾 **Complete backup system** with export/import capabilities
- 🤖 **AI-powered categorization** that understands bookmark content
- ✅ **Manifest V3 compliant** with proper service worker architecture
- 🔒 **CSP-safe implementation** using external scripts only
- 📊 **Progress tracking** and onboarding for new users
- 🗂 **Non-destructive apply & rollback** for AI-organized folders

## Installation & Testing

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the root directory of this repository
5. Click the extension icon in your toolbar to launch the full-screen interface

## Development

This extension uses vanilla JavaScript and Chrome Extension APIs. No build step required for development.

**Project structure:**
```
ai-bookmark-enhancer-next/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker
├── lib/                   # Shared utilities
│   ├── ai_client.js       # AI categorization logic
│   ├── apply.js           # Non-destructive apply & rollback helpers
│   ├── backup.js          # Export/import functionality
│   ├── bookmarks.js       # Bookmark reading utilities
│   ├── messages.js        # Message constants
│   ├── organizer.js       # Organization logic
│   ├── storage.js         # Storage utilities
│   └── ui.js              # UI helpers
├── ui/                    # Full-screen interface
│   ├── onboarding.html/js # Onboarding flow
│   ├── page1.html/js      # Main organization page
│   ├── page2.html/js      # Review page
│   ├── page3.html/js      # Results page
│   └── settings.html/js   # Settings page
└── docs/                  # Documentation
    └── architecture.md
```

## Manual Test Script

1. Fresh install with no saved key: open the extension and confirm the hero metric reflects your bookmark count, the Organize button is disabled, and the Connect Key CTA routes to Settings.
2. In Settings, paste an OpenAI API key, use Test Connection, wait for the toast, and confirm you are returned to the previous page with the Organize button enabled.
3. Start a run and land on the progress screen; reload the page mid-run to confirm the bar, tasks, and percent sync from the background worker.
4. Click Cancel during a run; verify the UI shows the cancelled state without redirecting and page3 displays the cancelled pill and disabled backup download.
5. Start a fresh run, allow it to finish, and ensure page3 shows the dynamic `total → grouped` metric, success pill, and folder list sourced from the latest run meta.
6. From Results, generate an apply preview; confirm folder/bookmark counts and that a sample of bookmarks is shown.
7. Apply the structure and verify a new `AI Organized (...)` root appears in Bookmark Manager with duplicate copies (original folders untouched). Run Apply again to confirm a new timestamped root is created.
8. Use “Open in Bookmarks” to deep-link into the latest applied root, then use “Rollback last apply” and confirm only that new root is removed.
9. Exercise the remaining actions: trigger Download Backup (two files saved) and use Re-run Analysis to return to the progress screen.
10. Reset the key in Settings and try to start a run; confirm the error state appears inline on page2 and page1 remains gated without a key.

## Versions

### v1 → Legacy popup prototype (archived)
The original version is archived at [ai-bookmark-enhancer](https://github.com/MohammadShamchi/ai-bookmark-enhancer). It served as a proof of concept but has been superseded by this rebuild.

### v2 → Full-screen rebuild (current active)
Complete rewrite with Manifest V3, full-screen UI, real backups, and AI categorization. This is the actively maintained version.

## Roadmap

- **Phase 1**: ✅ Skeleton setup and MV3 foundation
- **Phase 2**: 🚧 Real bookmark backups with export/import
- **Phase 3**: 🔜 AI chunk-based categorization
- **Phase 4**: 🔜 Onboarding flows and progress polish

## License

MIT License - see LICENSE file for details.

## Contributing

This is a personal project rebuild. If you find issues or have suggestions, feel free to open an issue.
