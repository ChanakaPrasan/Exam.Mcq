# Sahasra — Multi-Page SEO System
## Complete File Structure & URL Guide

---

## 📁 New Files (place alongside your existing files)

```
grades.html          ← Entry point — grade selection
stream.html          ← A/L stream selection (Grade 12 & 13 only)
subjects.html        ← Subject selection
category.html        ← Paper type selection (Past / School / Provincial)
years.html           ← Year selection
terms.html           ← Term selection (School / Provincial only)
papers.html          ← Paper list (links to Paper.html?id=...)
Paper.html           ← Quiz page (already built — uses ?id=FIRESTORE_ID)
router.js            ← URL param helpers + SEO meta + breadcrumb builder
shared-html.js       ← Injects header, footer, auth modal into every page
nav.js               ← Auth state listener + modal helpers
db.js                ← Firebase config + shared data (unchanged)
sitemap.xml          ← Submit to Google Search Console
```

---

## 🔗 Full URL Flows

### Flow 1 — National Past Papers
```
grades.html
  → stream.html?grade=13
    → subjects.html?grade=13&stream=Technology
      → category.html?grade=13&stream=Technology&subject=Science+for+Tech
        → years.html?grade=13&stream=Technology&subject=Science+for+Tech&type=National+Past+Papers
          → papers.html?...&year=2016
            → Paper.html?id=FIRESTORE_DOC_ID   ← individual paper, shareable URL
```

### Flow 2 — School Term Papers
```
grades.html
  → subjects.html?grade=11
    → category.html?grade=11&subject=Mathematics
      → years.html?grade=11&subject=Mathematics&type=School+Term+Papers
        → terms.html?grade=11&subject=Mathematics&type=School+Term+Papers&year=2024
          → papers.html?...&term=First+Term
            → Paper.html?id=FIRESTORE_DOC_ID
```

### Flow 3 — Junior Grades (6-10, no stream)
```
grades.html
  → subjects.html?grade=9
    → category.html?grade=9&subject=Science
      (Past Papers card is hidden for grades 6-10)
      → years.html?grade=9&subject=Science&type=School+Term+Papers
        → terms.html → papers.html → Paper.html?id=...
```

---

## 🔍 SEO Features Per Page

| Page | `<title>` | Meta Description | Canonical | JSON-LD |
|------|-----------|-----------------|-----------|---------|
| grades.html | Select Your Grade | ✅ | ✅ | BreadcrumbList |
| stream.html | Grade 13 A/L Streams | ✅ dynamic | ✅ | BreadcrumbList |
| subjects.html | Grade 13 Technology Subjects | ✅ dynamic | ✅ | BreadcrumbList |
| category.html | Science for Tech — Grade 13 Papers | ✅ dynamic | ✅ | BreadcrumbList |
| years.html | Science for Tech Past Papers Years | ✅ dynamic | ✅ | BreadcrumbList |
| terms.html | Grade 11 Maths 2024 Term Selection | ✅ dynamic | ✅ | BreadcrumbList |
| papers.html | Science for Tech 2016 Papers | ✅ dynamic | ✅ | BreadcrumbList + ItemList |
| Paper.html | 2016-A/L-SFT-MCQ-I | ✅ from Firebase | ✅ | — |

---

## 🔧 How to Add This to Your Existing Site

1. **Copy all new files** into your site root (same folder as `index.html`).

2. **Update your existing `Subject.html`** — change the grade card links to point to `grades.html`:
   ```html
   <!-- old: onclick="selectGrade(6)" -->
   <!-- new: -->
   <a href="grades.html">Browse All Grades</a>
   ```
   Or add a "SEO Browse" link alongside the existing JS flow.

3. **Add to `Subject.html` nav**:
   ```html
   <a href="grades.html" class="hover:text-blue-600 transition">Subjects</a>
   ```
   (replace the current `Subject.html` link in nav)

4. **Submit `sitemap.xml`** to Google Search Console.

5. **Add to `robots.txt`**:
   ```
   Sitemap: https://sahasra.lk/sitemap.xml
   ```

---

## ⚙️ How Each Page Works

Every page follows this pattern:

```html
<div id="shared-header"></div>   ← header injected by shared-html.js
<main>...</main>
<div id="shared-footer"></div>   ← footer injected
<div id="shared-modals"></div>   ← auth modal injected

<script src="db.js"></script>         <!-- Firebase + global state -->
<script src="router.js"></script>     <!-- URL params + SEO helpers -->
<script src="shared-html.js"></script><!-- injectSharedHTML() -->
<script src="nav.js"></script>        <!-- auth state listener -->
<script>
  document.addEventListener('DOMContentLoaded', function() {
    injectSharedHTML('subjects');   // pass active nav item
    const p = getParams();          // read URL params
    setSEOMeta({...});              // set title + description
    renderBreadcrumb([...]);        // build breadcrumb
    // ...page-specific logic...
  });
</script>
```

---

## 📊 URL Parameter Reference

| Param | Example | Used On |
|-------|---------|---------|
| `grade` | `13` | all pages |
| `stream` | `Technology` | stream/subjects/category/years/terms/papers |
| `subject` | `Science+for+Tech` | category/years/terms/papers |
| `type` | `National+Past+Papers` | years/terms/papers |
| `year` | `2016` | terms/papers |
| `term` | `First+Term` | papers |
| `id` | `abc123firestore` | Paper.html only |

---

## 🚀 Firebase Compatibility

- **Zero changes to Firestore** — all collections (`papers`, `questions`, `submissions`) remain identical.
- `db.js` is unchanged and shared across all pages.
- `Paper.html` fetches directly from Firestore by `?id=`.
- All other pages filter `publishedPapers` (loaded via `loadFromFirebase()` from `db.js`) using URL params.
