# File Dependencies & Conflict Matrix

This document helps you avoid conflicts when multiple agents work in parallel.

**Important**: This document references P1 and P2 issues that have not been created yet. Focus on P0 issues (P0-01 through P0-07) first. The P1/P2 references are for future planning.

## 🚦 Conflict Groups

### Group A: AI Processing Core
**These issues touch the same files - work on ONE at a time:**
- P0-01: Sequential Processing → `lib/ai_client.js`
- P0-04: Hardcoded Model → `lib/ai_client.js`, `ui/settings.html/js`
- P0-05: AI Consistency → `lib/ai_client.js`
- P1-01: Chunk Context → `lib/ai_client.js` (not yet created)
- P1-02: Rate Limits → `lib/ai_client.js` (not yet created)

**Recommendation**: Fix in order P0-01 → P0-05 → P0-04 (then P1-01 → P1-02 when created)

---

### Group B: UI Feedback
**Low conflict - can work in parallel:**
- P0-02: Time Estimation → `background.js`, `ui/page2.js`, `ui/page2.html`
- P0-06: Processing Feedback → `ui/page2.js`, `ui/page2.html`
- P1-03: Preview Before Run → `ui/page1.js`, `ui/page1.html` (not yet created)

**Recommendation**: P0-02 and P0-06 can work simultaneously if different people

---

### Group C: Fast Mode
**Same file - work sequentially:**
- P0-03: Fast Mode Fix → `lib/ai_client.js` (simulateFastMode function)

**Recommendation**: Fix after Group A is done

---

### Group D: Apply Process
**Low conflict - can work in parallel:**
- P0-07: Apply Performance → `lib/apply.js`
- P1-04: Empty Folder Handling → `lib/organizer.js` (not yet created)
- P1-05: Duplicate Detection → `lib/organizer.js`, `lib/apply.js` (not yet created)

**Recommendation**: Do P0-07 first (then P1-04 and P1-05 together when created)

---

### Group E: Error Handling (Not Yet Created)
**Different files - full parallel:**
- P1-06: Network Retry → `lib/ai_client.js` (not yet created)
- P1-07: Invalid Bookmark IDs → `lib/organizer.js`, `lib/apply.js` (not yet created)
- P1-08: Storage Quota → `lib/storage.js` (not yet created)

**Recommendation**: Fully parallel (when created)

---

### Group F: User Experience (Not Yet Created)
**Different areas - full parallel:**
- P1-09: Quality Metrics → `ui/page3.js`, `ui/page3.html` (not yet created)
- P1-10: Privacy Warning → `ui/settings.js`, `ui/settings.html` (not yet created)
- P2-01: Incremental Apply → `lib/apply.js`, `ui/page3.js` (not yet created)

**Recommendation**: Fully parallel (when created)

---

## 📋 Suggested Execution Order

### Phase 1: Critical Performance (Sequential)
1. P0-01: Sequential Processing ⚠️ Big change
2. P0-05: AI Consistency ⚠️ Builds on P0-01

### Phase 2: UI & Fast Mode (Parallel)
- Agent 1: P0-02 + P0-06 (Time estimation + feedback)
- Agent 2: P0-03 (Fast mode)
- Agent 3: P0-07 (Apply performance)

### Phase 3: Model Configuration (After Phase 1)
- P0-04: Hardcoded model (needs stable ai_client.js)

### Phase 4: Polish (Parallel - Future)
**Note: These P1 issues have not been created yet**
- Agent 1: P1-01, P1-02 (Chunk context, rate limits)
- Agent 2: P1-04, P1-05 (Folder handling, duplicates)
- Agent 3: P1-06, P1-07, P1-08 (Error handling)
- Agent 4: P1-09, P1-10 (UX improvements)

---

## 🔒 Lock Status

Before starting a fix, check this section:

| Issue | File(s) | Status | Agent |
|-------|---------|--------|-------|
| P0-01 | lib/ai_client.js | 🟢 Available | - |
| P0-02 | background.js, ui/page2.* | 🟢 Available | - |
| P0-03 | lib/ai_client.js | 🔴 Blocked by P0-01 | - |
| P0-04 | lib/ai_client.js, ui/settings.* | 🔴 Blocked by P0-01 | - |
| P0-05 | lib/ai_client.js | 🔴 Blocked by P0-01 | - |
| P0-06 | ui/page2.* | 🟢 Available | - |
| P0-07 | lib/apply.js | 🟢 Available | - |

**Legend:**
- 🟢 Available - Start anytime
- 🟡 In Progress - Being worked on
- 🔴 Blocked - Wait for dependency
- ✅ Complete - Done

---

## ⚠️ Special Notes

### ai_client.js is High Traffic
Many issues touch this file. Consider:
1. Doing all ai_client.js changes in one session
2. Or fixing P0-01 first, commit, then others work on the new version

### Service Worker Restart
Changes to background.js require extension reload. Test thoroughly.

### Storage Schema Changes
If changing storage structure, add migration logic in background.js::restoreRunState()

---

**Update this file as you complete issues to track progress!**
