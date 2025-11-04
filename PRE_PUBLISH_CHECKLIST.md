# Pre-Publish Checklist for Chrome Web Store Submission

## Icons Status

✅ **Icons Added**: Icons directory exists with required files:
- `icons/icon16.png` (16x16px) ✅
- `icons/icon48.png` (48x48px) ✅
- `icons/icon128.png` (128x128px) ✅

✅ **Manifest Updated**: Icons section added to `manifest.json`

## Pre-Publish Verification Steps

### 1. Load Unpacked Extension
1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the extension root directory (`ai-bookmark-enhancer-next/`)
5. Verify extension appears in the list without errors

### 2. Verify Background Service Worker
- Check extensions page - should show "Service worker" status
- Click "Inspect views: service worker" link
- Verify console shows: "Service worker registered" or similar
- No red errors in console

### 3. Test Extension Launch
- Click the extension icon in Chrome toolbar
- Verify full-screen tab opens with `ui/page1.html`
- Page should load without errors
- Check browser console (F12) - no red errors

### 4. Test Onboarding Flow
- If no API key is set, verify onboarding flow appears
- Test API key input in Settings page
- Verify "Test Connection" button works
- Confirm return to previous page after key setup

### 5. Test Core Functionality
- Verify bookmark count displays correctly on page1
- Test "Organize" button (should be enabled with valid API key)
- Start an organization run
- Verify progress screen shows stages and progress
- Test cancellation (if applicable)
- Verify results page displays correctly

### 6. Test Backup Functionality
- Verify "Download Backup" button works
- Check that both JSON and HTML files download
- Verify downloaded files are valid

### 7. Test Apply & Rollback
- Generate apply preview
- Verify folder/bookmark counts are correct
- Apply structure to bookmarks
- Verify new "AI Organized (...)" folder appears in Bookmark Manager
- Test "Rollback last apply" functionality
- Verify only the applied folder is removed

### 8. Verify Permissions
- Extension should request: bookmarks, storage, downloads, tabs
- Verify host permission for OpenAI API is present
- No unnecessary permissions requested

### 9. Manifest Validation
- Version is set to `2.2.0`
- Manifest version is 3
- All required fields are present
- Service worker path is correct (`background.js`)
- Options page path is correct (`ui/settings.html`)

## Files Included in ZIP

✅ **Core Files:**
- `manifest.json` (v2.2.0)
- `background.js`
- `LICENSE`
- `README.md`
- `CHANGELOG.md`

✅ **Library Files (lib/):**
- `ai_client.js`
- `apply.js`
- `backup.js`
- `bookmarks.js`
- `messages.js`
- `organizer.js`
- `progress_steps.js`
- `runtime_bus.js`
- `storage.js`
- `ui.js`

✅ **UI Files (ui/):**
- `onboarding.html` + `onboarding.js`
- `page1.html` + `page1.js`
- `page2.html` + `page2.js`
- `page3.html` + `page3.js`
- `settings.html` + `settings.js`

✅ **Documentation:**
- `docs/architecture.md`

## Files Excluded from ZIP

- `.git/` (version control)
- `.cursor/` (development files)
- `node_modules/` (not present)
- `*.log` files (not present)
- `.DS_Store` files (macOS system files)
- `*.plan.md` files (development plans)
- `*spec*.md` files (specification documents)

## Chrome Web Store Submission Steps

1. ✅ **Complete Icons**: Icons directory created with required sizes
2. ✅ **Update Manifest**: Icons section added to manifest.json
3. ✅ **Recreate ZIP**: ZIP regenerated with icons included (36 files, 63KB)
4. **Final Testing**: Complete all verification steps above
5. **Upload**: Go to https://chrome.google.com/webstore/devconsole
6. **Click**: "Add new item"
7. **Upload**: `AI-Bookmark-Enhancer-v2.2.0.zip`
8. **Fill Details**: Complete store listing information
9. **Submit**: Submit for review

## Notes

- Extension uses `chrome.action.onClicked` listener (not popup) - opens full-screen tab
- All permissions are justified and used in code
- Extension is Manifest V3 compliant
- No inline scripts or CSP violations
- Background service worker uses ES modules (`type: "module"`)
