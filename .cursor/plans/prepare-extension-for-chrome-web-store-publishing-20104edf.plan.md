<!-- 20104edf-a45b-47a8-abcd-7129d378229c 37a12d32-6973-42ac-a97b-ad7c4065c9aa -->
# Prepare Extension for Chrome Web Store Publishing

## Overview

Package the AI Bookmark Enhancer extension into a clean, publish-ready ZIP file for Chrome Web Store submission. This includes cleaning unnecessary files, updating manifest.json, verifying structure, and creating the distribution package.

## Tasks

### 1. Clean Extension Folder

- Remove development artifacts:
- Delete `node_modules` directory if it exists
- Remove `.DS_Store` files (macOS system files)
- Remove any `*.log` files
- Remove `.git` directory (if present, since we're packaging, not versioning)
- Verify core files exist:
- `manifest.json`
- `background.js`
- `/lib` directory with all required modules
- `/ui` directory with all HTML/JS files
- `LICENSE`
- `README.md`

### 2. Update manifest.json

- Update version to `2.2.0` (or confirm with user)
- Update description to match current features
- Verify permissions:
- Keep: `bookmarks`, `storage`, `downloads` (used by backup.js)
- Review: `scripting`, `activeTab` (verify if still needed)
- Add: `notifications` (if needed for user feedback)
- Update `action` configuration:
- Add `default_popup` pointing to `ui/page1.html` OR keep `chrome.action.onClicked` listener (current implementation uses onClicked, not popup)
- Keep `default_title` for accessibility
- Verify `background.service_worker` points to `background.js`
- Verify `host_permissions` includes `https://api.openai.com/*`
- Add `icons` section (if icons directory exists, otherwise note as required)

### 3. Verify Icons (Critical for Chrome Web Store)

- Check if `/icons` directory exists with:
- `16.png` (16x16px)
- `48.png` (48x48px)
- `128.png` (128x128px)
- If missing, note this as a blocking requirement for Chrome Web Store submission
- Update manifest.json `icons` section only if icons exist

### 4. Review File Structure

- Ensure all required files are present:
- Core: `manifest.json`, `background.js`
- Libraries: All files in `/lib` directory
- UI: All HTML/JS files in `/ui` directory
- Documentation: `LICENSE`, `README.md`
- Optional files to keep:
- `CHANGELOG.md` (useful for users)
- `docs/` directory (if not too large)

### 5. Create Publishing ZIP

- Create a clean ZIP file excluding:
- `node_modules/`
- `.DS_Store`
- `.git/`
- `*.log`
- `.cursor/` directory (development files)
- Any other development-only files
- Name the ZIP: `AI-Bookmark-Enhancer-v2.2.0.zip`
- Verify ZIP structure matches Chrome Web Store requirements

### 6. Pre-Publish Checklist

- Document verification steps:
- Load unpacked extension in Chrome
- Verify popup/tab loads without errors
- Check background service worker registers
- Verify no console errors
- Test onboarding flow
- Test AI key configuration

## Files to Modify

- `manifest.json` - Update version, permissions, and action configuration

## Files to Create

- `AI-Bookmark-Enhancer-v2.2.0.zip` - Final distribution package

## Notes

- Icons are required for Chrome Web Store but currently missing - this must be addressed before submission
- Current manifest uses `chrome.action.onClicked` listener (opens full-screen tab), not a popup
- Verify `downloads` permission is needed (used by backup functionality)