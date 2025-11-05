# P0-03: Fast Mode Doesn't Work Properly

**Priority**: P0 - CRITICAL
**Impact**: Fast mode produces useless results (mostly "Bookmarks Bar" folders)
**Estimated Fix Time**: 2-3 hours
**Risk Level**: MEDIUM (changes fast mode logic)

---

## 🎯 Problem Description

"Fast Mode" is supposed to provide quick bookmark organization without AI, but it currently produces **meaningless results**. The current implementation uses existing bookmark folder paths, which are typically:

- "Bookmarks Bar" (90% of bookmarks)
- "Other Bookmarks"
- "Mobile Bookmarks"
- Occasionally actual folder names

**User Quote**: "i also added a faster option as i guess it orders them in some logic but not work ok!!"

### Current Implementation (`lib/ai_client.js:186-255`)

```javascript
async function simulateFastMode(flatList, { onProgress, signal }) {
  // ...
  chunk.forEach((bookmark) => {
    const pathParts = bookmark.path ? bookmark.path.split('/').filter(Boolean) : [];
    const primaryFolder = pathParts[0] || 'Miscellaneous';  // ⚠️ Problem!
    if (!foldersMap.has(primaryFolder)) {
      foldersMap.set(primaryFolder, new Set());
    }
    foldersMap.get(primaryFolder).add(String(bookmark.id));
  });
  // ...
}
```

**Problem**: `pathParts[0]` is almost always "Bookmarks Bar" or "Other Bookmarks"

---

## 🔍 Root Cause

1. **Relies on existing structure**: Most users have flat bookmark bars
2. **No content analysis**: Doesn't look at bookmark titles or URLs
3. **Misnamed feature**: Should be "Quick Mode" or "Smart Grouping", not "Fast Mode"

---

## ✅ Acceptance Criteria

1. **Smart URL categorization**: Group by domain patterns
2. **Title keyword extraction**: Use bookmark titles for categorization
3. **Common site detection**: Recognize popular sites (GitHub, YouTube, etc.)
4. **Reasonable folder names**: "Technology", "News", "Shopping", not "Bookmarks Bar"
5. **Fast execution**: Complete in < 3 seconds for 2,000 bookmarks
6. **No AI required**: Works offline, no API calls
7. **Better than nothing**: Produces useful organization without AI cost

---

## 🔧 Suggested Implementation

### Approach: Domain + Keyword-Based Categorization

**File**: `lib/ai_client.js`

### Step 1: Add Categorization Helpers

```javascript
/**
 * Domain-based category mapping
 */
const DOMAIN_CATEGORIES = {
  // Social Media
  'facebook.com': 'Social Media',
  'twitter.com': 'Social Media',
  'x.com': 'Social Media',
  'instagram.com': 'Social Media',
  'linkedin.com': 'Social Media',
  'reddit.com': 'Social Media',
  'tiktok.com': 'Social Media',

  // Development
  'github.com': 'Development',
  'gitlab.com': 'Development',
  'stackoverflow.com': 'Development',
  'stackexchange.com': 'Development',
  'npmjs.com': 'Development',
  'pypi.org': 'Development',
  'developer.mozilla.org': 'Development',
  'codepen.io': 'Development',

  // News
  'nytimes.com': 'News',
  'bbc.com': 'News',
  'cnn.com': 'News',
  'reuters.com': 'News',
  'theguardian.com': 'News',
  'apnews.com': 'News',

  // Shopping
  'amazon.com': 'Shopping',
  'ebay.com': 'Shopping',
  'etsy.com': 'Shopping',
  'walmart.com': 'Shopping',
  'target.com': 'Shopping',
  'aliexpress.com': 'Shopping',

  // Video
  'youtube.com': 'Video',
  'vimeo.com': 'Video',
  'twitch.tv': 'Video',
  'netflix.com': 'Entertainment',
  'hulu.com': 'Entertainment',

  // Productivity
  'notion.so': 'Productivity',
  'trello.com': 'Productivity',
  'asana.com': 'Productivity',
  'slack.com': 'Productivity',
  'zoom.us': 'Productivity',
  'google.com': 'Productivity', // Docs, Drive, etc.

  // Education
  'coursera.org': 'Education',
  'udemy.com': 'Education',
  'khanacademy.org': 'Education',
  'edx.org': 'Education',
  'wikipedia.org': 'Reference',
};

/**
 * Keyword-based category hints
 */
const KEYWORD_CATEGORIES = {
  // Technology keywords
  'technology': ['tech', 'software', 'hardware', 'computer', 'programming', 'code', 'api', 'developer'],
  'development': ['dev', 'coding', 'github', 'programming', 'tutorial', 'documentation', 'docs'],
  'news': ['news', 'article', 'breaking', 'today', 'headlines', 'report'],
  'shopping': ['shop', 'store', 'buy', 'cart', 'product', 'deal', 'sale'],
  'entertainment': ['movie', 'music', 'game', 'gaming', 'video', 'watch', 'stream'],
  'education': ['learn', 'course', 'tutorial', 'lesson', 'study', 'education', 'university'],
  'finance': ['bank', 'finance', 'money', 'invest', 'stock', 'crypto', 'trading'],
  'health': ['health', 'fitness', 'medical', 'doctor', 'workout', 'nutrition'],
  'travel': ['travel', 'flight', 'hotel', 'vacation', 'trip', 'destination'],
  'food': ['recipe', 'food', 'cooking', 'restaurant', 'meal', 'dish'],
};

/**
 * Extract domain from URL
 * @param {string} url
 * @returns {string|null}
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    // Remove www. prefix
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Categorize a bookmark using domain and keywords
 * @param {Object} bookmark - { title, url }
 * @returns {string} Category name
 */
function categorizeBookmark(bookmark) {
  const domain = extractDomain(bookmark.url);

  // 1. Check domain mapping (highest priority)
  if (domain && DOMAIN_CATEGORIES[domain]) {
    return DOMAIN_CATEGORIES[domain];
  }

  // 2. Check title keywords (medium priority)
  const title = (bookmark.title || '').toLowerCase();
  const url = (bookmark.url || '').toLowerCase();
  const combined = `${title} ${url}`;

  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        return category.charAt(0).toUpperCase() + category.slice(1);
      }
    }
  }

  // 3. Try to use domain TLD as hint
  if (domain) {
    if (domain.endsWith('.edu')) return 'Education';
    if (domain.endsWith('.gov')) return 'Government';
    if (domain.endsWith('.org')) return 'Organizations';
  }

  // 4. Fallback to domain-based folder
  if (domain) {
    // Extract meaningful part of domain
    const parts = domain.split('.');
    if (parts.length >= 2) {
      const mainPart = parts[parts.length - 2];
      // Capitalize first letter
      return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    }
  }

  return 'Miscellaneous';
}
```

### Step 2: Replace simulateFastMode Function

```javascript
async function simulateFastMode(flatList, { onProgress, signal }) {
  const ensureActive = () => {
    if (signal?.aborted) {
      throw new Error('CANCELLED');
    }
  };

  const chunks = chunkArray(flatList, Math.max(100, Math.floor(CHUNK_SIZE / 2)));
  const totalChunks = Math.max(chunks.length, 1);

  if (onProgress) {
    onProgress({
      percent: 80,
      label: `Fast mode — analyzing (0/${totalChunks})`,
      chunk: 0,
      totalChunks,
      fastMode: true,
    });
  }

  const foldersMap = new Map();

  for (let i = 0; i < chunks.length; i++) {
    ensureActive();
    const chunk = chunks[i];

    chunk.forEach((bookmark) => {
      // Use smart categorization instead of path
      const category = categorizeBookmark(bookmark);

      if (!foldersMap.has(category)) {
        foldersMap.set(category, new Set());
      }
      foldersMap.get(category).add(String(bookmark.id));
    });

    // Reduced delay since we're doing actual work now
    await sleep(150);
    if (onProgress) {
      const progress = 80 + Math.floor(((i + 1) / totalChunks) * 15);
      onProgress({
        percent: progress,
        label: `Fast mode — grouping chunk ${i + 1}/${totalChunks}`,
        chunk: i + 1,
        totalChunks,
        fastMode: true,
      });
    }
  }

  const folders = Array.from(foldersMap.entries())
    .map(([name, ids]) => ({
      name,
      ids: Array.from(ids),
    }))
    .filter((folder) => folder.ids.length > 0);

  // Fallback if categorization completely failed
  if (folders.length === 0) {
    folders.push({
      name: 'Uncategorized',
      ids: flatList.map((bookmark) => String(bookmark.id)),
    });
  }

  // Sort by folder size (largest first) then alphabetically
  folders.sort((a, b) => {
    if (a.ids.length !== b.ids.length) {
      return b.ids.length - a.ids.length;
    }
    return a.name.localeCompare(b.name);
  });

  return {
    folders,
    meta: {
      totalChunks,
      fastMode: true,
    },
  };
}
```

---

## 🧪 Testing Checklist

- [ ] GitHub bookmark → "Development"
- [ ] YouTube bookmark → "Video"
- [ ] Amazon bookmark → "Shopping"
- [ ] News site → "News"
- [ ] Unknown domain with "tutorial" in title → "Development"
- [ ] .edu domain → "Education"
- [ ] Generic domain (example.com) → "Example"
- [ ] 2,000 bookmarks complete in < 3 seconds
- [ ] Cancellation works mid-process
- [ ] No AI API calls made
- [ ] Better results than current implementation

---

## 📊 Expected Results Comparison

### Current Fast Mode (2,066 bookmarks):
```
Folders created:
- Bookmarks Bar (1,842 bookmarks)
- Other Bookmarks (198 bookmarks)
- Tech (15 bookmarks)
- News (11 bookmarks)
```
❌ **Useless** - No meaningful organization

### New Fast Mode (same bookmarks):
```
Folders created:
- Development (234 bookmarks)
- News (156 bookmarks)
- Shopping (98 bookmarks)
- Video (87 bookmarks)
- Social Media (76 bookmarks)
- Productivity (65 bookmarks)
- Education (54 bookmarks)
- Entertainment (43 bookmarks)
- Miscellaneous (1,253 bookmarks)
```
✅ **Useful** - Meaningful categories, better than nothing

---

## ⚠️ Important Notes

1. **Not as good as AI**: This is a fallback, not a replacement
2. **Domain database**: Add more domains as needed
3. **Keyword collisions**: "mobile banking" might match "mobile" → wrong category
4. **Localization**: Keywords are English-only
5. **Performance**: O(n) complexity, very fast even for large collections

---

## 💡 Future Enhancements (Not in this issue)

- Let users add custom domain mappings
- Machine learning on user's existing folder structure
- Multi-language keyword support
- Sub-categories (Development → Frontend, Backend, etc.)

---

## 📦 Files to Modify

1. ✏️ `lib/ai_client.js` - Replace simulateFastMode and add helpers

---

## 🔗 Related Issues

- **Depends on**: P0-01 (Sequential Processing) - should fix that first to avoid conflicts
- **Blocks**: None
- **Related**: P0-04 (Model selection) - Fast mode vs AI mode choice

---

**Wait for P0-01 to be merged, then implement this!**
