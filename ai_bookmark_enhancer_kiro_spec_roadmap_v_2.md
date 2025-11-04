# AI Bookmark Enhancer — **Kiro Spec** (Design & Development)

**Owner:** Mohammad • **Mode:** PRO (Quick Answer → Steps → Risks/Checks → Next Action)  
**Style:** Calm, premium (Linear/Cursor vibes), context‑first, small increments, zero fluff  
**Scope:** Chrome MV3 full‑screen extension that **reads** bookmarks → **backs up** (JSON/HTML/ZIP) → **organizes with AI** → **shows results clearly** → optional **apply structure** non‑destructively.

---

## 1) North Star / Intent
**Build a fast, privacy‑respecting bookmark organizer** that feels premium and trustworthy. First‑run succeeds without surprises; users always understand what’s happening; data is safe by default; large libraries complete quickly.

### Success Criteria
- Fresh install → clear onboarding → first run completes without confusion.  
- Progress & step labels always match actual work.  
- Results show real numbers; actions (Open Bookmarks / Download Backup / Re‑run) work.  
- For large sets (2k–5k bookmarks) **≤ 2–3 min** in v2.2 with fast‑pass + parallelism.  
- Non‑destructive apply; easy rollback.

---

## 2) Big Picture / Experience Flow
1. **Launch extension** (full‑screen tab).  
2. **Page 1 (Home)**: Live bookmark count, "Connect OpenAI key" CTA, Organize button (gated).  
3. **Page 2 (Progress)**: Task list + progress bar; error/cancel states; chunk updates.  
4. **Page 3 (Results)**: Real stats (total → grouped), folders list, actions (Open/Download/Re‑run).  
5. **Settings**: Save/test key; return to results.

---

## 3) Principles (Design & Dev)
- **Clarity over cleverness**: Always say what’s happening and why.  
- **Safety by default**: Backups first; apply is non‑destructive.  
- **Speed via architecture**: Local rules + summaries; LLM only for hard parts.  
- **Determinism**: Schema‑enforced JSON; retries/backoff; idempotent steps.  
- **Small steps**: Ship in phases (v2.1 → v2.2 → v2.3 → v2.4).  
- **Kiro Spec framing**: *Why* (intent & benefits) • *How* (step‑by‑step) • *Transcrib* (decisions & best practices).

---

## 4) System Overview (Text Diagram)
MV3 Service Worker (**background.js**) ⟷ UI pages (**page1/page2/page3/settings**)  
Shared libs: **bookmarks, backup, ai_client, storage, messages, progress_steps**  
Storage: `chrome.storage.local` (**runMeta, organized, cache**)

Data flow (v2.1):
```
page1 → (START_ORGANIZE) → background
  background: read → backup JSON → backup HTML → AI (or error/cancel)
  background → (PROGRESS_TICK / DONE / ERROR / CANCELLED) → page2
  background → save organized + runMeta
page3 reads organized + runMeta → renders
```

---

## 5) Scope & Non‑Goals
**In scope:** MV3 full‑tab, real bookmark read, JSON/HTML backup, progress with sync, error/cancel flows, dynamic stats, ZIP export, optional apply (non‑destructive), fast‑pass rules & delta runs (v2.2).  
**Non‑goals (now):** Multi‑profile sync, cloud accounts, server backends, destructive auto‑moves.

---

## 6) Architecture Details
**Modules & Responsibilities**
- `lib/bookmarks.js` — read tree; flatten `{id,title,url,path,dateAdded}` and **aggregate totals**.  
- `lib/backup.js` — export JSON/HTML; `downloadLatest()` on demand; events for success/error.  
- `lib/ai_client.js` — validate key, chunking, strict JSON schema calls (v2.2), parallel/backoff; abort support.  
- `lib/storage.js` — `runMeta` (status/stats/timestamps/error), `organized`, `cache` (delta runs).  
- `lib/messages.js` — message constants.  
- `lib/progress_steps.js` — canonical step ids/labels/percentages.  
- `background.js` — orchestration, guards, progress sync, cancel/error, persist stats.  
- `ui/*.js` — page‑level logic; no inline scripts.

**Storage schema**
```js
runMeta = {
  status: 'idle'|'running'|'success'|'error'|'cancelled',
  startedAt: number,
  endedAt?: number,
  errorReason?: 'MISSING_KEY'|'BACKUP_FAILED'|'AI_FAILED'|'CANCELLED'|string,
  stats: { total: number, grouped: number }
}
organized = { folders: Array<{ slug:string, name:string, ids:string[] }> }
cache = { [bookmarkId]: { h: string /*hash of title+url*/ , slug?: string } }
```

**Progress model**
```js
// lib/progress_steps.js
export const PROGRESS_STEPS = [
  { id: 'read',     label: 'Collecting bookmarks', percent: 20 },
  { id: 'bkp_json', label: 'Backup JSON',          percent: 40 },
  { id: 'bkp_html', label: 'Backup HTML',          percent: 60 },
  { id: 'ai',       label: 'Analyzing with AI',    percent: 80 },
  { id: 'done',     label: 'Completed',            percent: 100 },
];
export const stepById = (id) => PROGRESS_STEPS.find(s => s.id===id) ?? PROGRESS_STEPS.at(-1);
```

---

## 7) Phased Roadmap
### **v2.1 — UX & Reliability (SHIP FIRST)**
**Goal:** First‑run success; accurate progress; cancel/error states; real numbers; working buttons; clean console.

**Tasks**
- Onboarding: Page1 CTA to settings; gate Organize until key exists; live bookmark count.  
- Messaging: Add `PROGRESS_SYNC`, `ORGANIZE_ERROR`, `ORGANIZE_CANCELLED`.  
- Background: `isRunning` guard; `lastProgress` cache & sync; key check before work; no fake success; cancel via `AbortController`; persist `{total, grouped}`.  
- Page2: render tasks from `PROGRESS_STEPS`; show error/cancel panels; no redirect on failure/cancel; sync on load.  
- Page3: use real stats; status pill (success/error/cancelled); wire **Open Bookmarks**, **Download Backup**, **Re‑run (confirm)**.  
- Settings: back button; password show/hide; inline test feedback; auto‑return on success.  
- README: first‑run, cancel/error, troubleshooting.

**Acceptance**
1) Fresh install, no key → page1 shows **Connect key**, Organize disabled.  
2) Start without key → stays on page1 with guidance (no page2).  
3) Run with key → refresh page2 → progress restores via sync.  
4) Cancel → stops and shows **Cancelled**; can restart.  
5) Bad key → page2 shows **Error**; no success pill/redirect.  
6) Results show **real `total → grouped`**, buttons work.  
7) Console clean.

---

### **v2.2 — Speed & Cost**
**Goal:** ≤ 2–3 min for 2k–5k bookmarks; lower tokens.

**Tasks**
- Fast‑pass rules: domain map + path keywords; normalize/strip/dedupe.  
- Clustering leftovers; send **summaries** not raw lists.  
- Responses API with `response_format: json_schema`; parallel 3–4 with backoff; AbortController.  
- Delta runs via `cache` (analyze only new/changed).  
- Telemetry: coverage %, tokens, time.

**Acceptance**
- Logs show fast‑pass coverage & delta counts; re‑run with no changes analyzes 0 items.  
- 2k+ completes ≤ 3 minutes (typical desktop).

---

### **v2.3 — Apply & Export**
**Goal:** Non‑destructive apply + ZIP export.

**Tasks**
- Apply: create `AI Organized (YYYY‑MM‑DD)` folder tree; duplicates or links (no deletes).  
- Rollback: delete that root.  
- ZIP export: JSON + HTML via JSZip.

---

### **v2.4 — Polish**
- First‑run setup modal, ETA/time remaining, better empty states, taxonomy synonyms, subtle motion/microcopy polish.

---

## 8) Step‑by‑Step Checklist (by file)
**background.js**
- [ ] Guard duplicate runs; set `isRunning` immediately.  
- [ ] Shared steps + `tick(stageId)`; cache `lastProgress`.  
- [ ] On missing/invalid key → `ORGANIZE_ERROR`; **do not** send DONE.  
- [ ] Persist `runMeta` with `{status, stats, timestamps}`.  
- [ ] Cancel path with `AbortController`; finalize/reset flags.

**lib/ai_client.js**
- [ ] `validateKey()` for settings/test; surface error codes.  
- [ ] Structured progress callbacks (chunk X/Y).  
- [ ] Reset aborter after run.

**lib/backup.js**
- [ ] `downloadLatest()` helper for page3.  
- [ ] Emit success/error signals for progress.

**lib/storage.js**
- [ ] `setRunMeta/getRunMeta/clearRunMeta` helpers.  
- [ ] Reset metadata on new run/cancel/error.

**lib/messages.js**
- [ ] Add `PROGRESS_SYNC`, `ORGANIZE_ERROR`, `ORGANIZE_CANCELLED`, `DOWNLOAD_LATEST`.

**lib/bookmarks.js**
- [ ] Return aggregate totals for UI use; avoid recompute in pages.

**ui/page1.{html,js}**
- [ ] Live count; gate Organize; CTA to settings; react to storage changes.

**ui/page2.{html,js}**
- [ ] Drive task list from `PROGRESS_STEPS`; sync on load; cancel wired; error/cancel panels.

**ui/page3.{html,js}**
- [ ] Real stats (hero metric); status pill; actions wired; confirm re‑run; empty/error states.

**ui/settings.{html,js}**
- [ ] Back to results; show/hide password; inline test; auto‑return.

**README / docs**
- [ ] v2.1 write‑up; manual verification; troubleshooting.

---

## 9) AI Prompts (Copy‑Paste)
### A) **Audit first** (no changes yet)
```
Goal: Generate a full audit checklist for v2.1 UX & Reliability. Review all files. Group issues by file. Include missing features, broken flows, and hard-coded values. Output only the checklist with [🟡 pending]/[✅ fixed] markers. Do not modify code yet.
```

### B) **Implement v2.1** (end‑to‑end)
```
Implement Phase v2.1 – UX & Reliability for AI Bookmark Enhancer.
Add/modify: lib/progress_steps.js, lib/messages.js, lib/storage.js, background.js, lib/backup.js, lib/ai_client.js (validateKey), ui/page1.{html,js}, ui/page2.{html,js}, ui/page3.{html,js}, ui/settings.{html,js}, README.md.
Requirements: first-run key gating; progress sync; cancel/error flows; dynamic stats; results buttons; clean console. Follow the Acceptance list and provide a changes checklist.
```

### C) **Speed & Cost (v2.2)**
```
Implement Phase v2.2 – Speed & Cost: fast-pass rules, delta runs via cache, strict JSON-schema responses, 3–4 concurrent chunks with backoff, AbortController. Keep v2.1 UX intact. Add telemetry (coverage %, tokens, duration). Report before/after timings on a 2k+ library.
```

### D) **Bugfix/Regression**
```
Given failing acceptance step <X>, identify the smallest code change that fixes it without breaking v2.1 guarantees. Show unified diff by file and a brief explanation. Re-run the relevant test steps.
```

---

## 10) Test Cases
### Manual Acceptance (v2.1)
1. **No key onboarding**: Page1 shows CTA; Organize disabled. Clicking Organize without key does not leave page1.  
2. **Progress sync**: Start run; refresh/navigate back to page2; progress restores; labels match steps.  
3. **Cancel**: Press Cancel → progress stops; Cancelled panel; can restart.  
4. **Error**: Bad key → Error panel; no success pill; stays on page2.  
5. **Results**: Shows `total → grouped`; buttons work; Re‑run asks confirmation.  
6. **Console**: No CSP or messaging errors.

### Integration (background/UI)
- Tick events update task renderer.  
- `PROGRESS_SYNC` returns last snapshot + runMeta.  
- Error and Cancel paths never emit DONE.

### Unit-ish
- `validateKey()` handles 401/429/net errors.  
- `storage.runMeta` transitions: idle→running→success/error/cancelled with timestamps.  
- `backup.downloadLatest()` triggers downloads.

---

## 11) Risks & Mitigations
- **Rate limits**: backoff with jitter; lower concurrency.  
- **Non‑JSON LLM output**: Responses API `json_schema`; retry exact same input.  
- **Slow large sets**: v2.2 fast‑pass + summaries + parallel + delta.  
- **User trust**: explicit confirmations; empty/error states; never fake success.

---

## 12) Release & Repo Plan
- Archive v1 repo (`ai-bookmark-enhancer-legacy`, tag `v1.0.0`).  
- New clean repo `ai-bookmark-enhancer` for v2.  
- Branches per phase; tag releases (`v2.1.0`, `v2.2.0`, …).  
- Add `ROADMAP.md`, `CHANGELOG.md`.

---

## 13) Definition of Done
- **v2.1**: All acceptance tests pass; README updated; console clean.  
- **v2.2**: Performance targets met on 2k+ set; telemetry in logs; delta runs working.  
- **v2.3**: Apply/rollback safe; ZIP export works.  
- **v2.4**: Polish items closed; UX/text final.

---

## 14) Next Action (Now)
Run the **Implement v2.1** prompt in Cursor. When done, walk through the acceptance list above and check off tasks in this spec.

---

## 15) Appendices
### A) LLM JSON Schema (v2.2)
```json
{
  "name": "cluster_categorization",
  "schema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "category": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "name": { "type": "string", "minLength": 2, "maxLength": 60 }
        },
        "required": ["slug", "name"]
      },
      "ids": { "type": "array", "items": { "type": "string" }, "minItems": 1 }
    },
    "required": ["category", "ids"]
  }
}
```

### B) Sample Taxonomy (starter)
```
ai_tools, dev_tools, code_repos, design_tools, docs_learning, cloud_hosting,
news_media, productivity, social_pro, video_platforms, payments, shopping,
travel, licenses, health, finance, gaming, photography, writing, misc
```

### C) Domain Rule Examples (fast‑pass)
```
github.com → code_repos
figma.com → design_tools
notion.so → productivity
youtube.com/vimeo.com → video_platforms
medium.com/dev.to → docs_learning
vercel.com/netlify.app → cloud_hosting
stripe.com/paypal.com → payments
```

