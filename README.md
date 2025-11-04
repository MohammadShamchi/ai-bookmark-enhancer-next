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
