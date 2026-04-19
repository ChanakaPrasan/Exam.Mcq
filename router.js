// ============================================================
//  router.js  —  URL parameter helpers + SEO meta updater
//  Include after db.js on every page.
//
//  URL scheme (all params are URL-encoded):
//
//  Flow 1 – School / Provincial Papers
//    grades.html
//    subjects.html?grade=13&stream=Technology
//    category.html?grade=13&stream=Technology&subject=Science+for+Tech
//    terms.html?grade=13&stream=Technology&subject=Science+for+Tech&type=School+Term+Papers&year=2024
//    papers.html?grade=13&...&type=School+Term+Papers&year=2024&term=First+Term
//    Paper.html?id=FIRESTORE_ID
//
//  Flow 2 – Past Papers
//    grades.html
//    subjects.html?grade=13&stream=Technology
//    category.html?grade=13&stream=Technology&subject=Science+for+Tech
//    years.html?grade=13&stream=Technology&subject=Science+for+Tech&type=National+Past+Papers
//    papers.html?grade=13&...&type=National+Past+Papers&year=2016
//    Paper.html?id=FIRESTORE_ID
// ============================================================

// ── Read all URL params into a plain object ──────────────────
function getParams() {
    const p = {};
    new URLSearchParams(window.location.search).forEach((v, k) => p[k] = v);
    return p;
}

// ── Single param shortcut ────────────────────────────────────
function getParam(key, fallback) {
    return new URLSearchParams(window.location.search).get(key) || fallback || null;
}

// ── Build a URL from a base page + params object ─────────────
function buildUrl(page, params) {
    const qs = new URLSearchParams(params).toString();
    return qs ? `${page}?${qs}` : page;
}

// ── Carry existing params forward and add/overwrite new ones ─
function extendUrl(page, extraParams) {
    const merged = { ...getParams(), ...extraParams };
    return buildUrl(page, merged);
}

// ── Set <title>, meta description, canonical link ───────────
function setSEOMeta({ title, description, canonical }) {
    if (title) {
        document.title = title + ' | Sahasra Education';
        let og = document.querySelector('meta[property="og:title"]');
        if (og) og.setAttribute('content', title + ' | Sahasra Education');
    }
    if (description) {
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
        meta.setAttribute('content', description);
        let og = document.querySelector('meta[property="og:description"]');
        if (og) og.setAttribute('content', description);
    }
    if (canonical) {
        let link = document.querySelector('link[rel="canonical"]');
        if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
        link.href = window.location.origin + '/' + canonical;
    }
}

// ── Build breadcrumb HTML from params ───────────────────────
function buildBreadcrumb(steps) {
    // steps = [{label, href}]  — last step has no href
    const content = steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const chevron = i > 0
            ? `<svg class="text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`
            : '';
        const item = isLast
            ? `<span class="font-extrabold text-blue-700 truncate">${s.label}</span>`
            : `<a href="${s.href}" class="hover:text-blue-600 transition font-semibold truncate">${s.label}</a>`;
        return chevron + item;
    }).join('');
    return `<div class="flex items-center gap-2 overflow-hidden w-full">${content}</div>`;
}

// ── Render breadcrumb into #breadcrumb-inner ─────────────────
function renderBreadcrumb(steps) {
    const el = document.getElementById('breadcrumb-inner');
    if (el) el.innerHTML = buildBreadcrumb(steps);
}

// ── Structured Data (JSON-LD) for SEO ───────────────────────
function injectBreadcrumbSchema(steps) {
    const items = steps.map((s, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": s.label,
        "item": s.href ? window.location.origin + '/' + s.href : window.location.href
    }));
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items
    });
    document.head.appendChild(script);
}

// ── Grade label helper ───────────────────────────────────────
function gradeLabel(g) {
    const n = parseInt(g);
    if (n === 11) return 'O/L Exam (Grade 11)';
    if (n === 12) return 'A/L Year 1 (Grade 12)';
    if (n === 13) return 'A/L Year 2 (Grade 13)';
    return `Grade ${n}`;
}

// ── Paper type slug map ──────────────────────────────────────
const PAPER_TYPE_LABELS = {
    'National Past Papers': 'Past Papers',
    'School Term Papers':   'School Papers',
    'Provincial Papers':    'Provincial Papers'
};
