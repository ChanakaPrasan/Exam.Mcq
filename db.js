// ============================================================
//  db.js  —  Shared data loading from Firebase
// ============================================================

// Global variables
let currentStudent = null;

// ── IMPORTANT: Set this to the email you added in Firebase Auth as admin ──
const ADMIN_EMAIL = "Chanakaprasan848@gmail.com";

// Data stores
let publishedPapers      = [];
let studentSubmissions   = [];
let QUIZ_DATA            = [];

async function loadFromFirebase() {
    try {
        // Load published papers
        const papersSnap = await db.collection('papers').get();
        publishedPapers = [];
        papersSnap.forEach(doc => {
            const d = doc.data();
            publishedPapers.push({ ...d, id: doc.id, publishedAt: d.publishedAt ? d.publishedAt.toDate() : new Date() });
        });
        
        // Load questions (Removed for mobile performance - fetched dynamically per paper)
        // Load submissions (Removed for mobile performance)
        
        if (typeof renderPublishedPapers === 'function') renderPublishedPapers();
        
        // If we are on grades.html, trigger global search update if there is input
        const inp = document.getElementById('global-search-input');
        if (inp && inp.value && typeof window.globalSearchFilter === 'function') {
            window.globalSearchFilter(inp.value);
        }
    } catch(e) {
        console.warn('Firebase load error:', e.message);
    }
}

function startPapersListener() {
    db.collection('papers').onSnapshot(snap => {
        publishedPapers = [];
        snap.forEach(doc => {
            const d = doc.data();
            publishedPapers.push({ ...d, id: doc.id, publishedAt: d.publishedAt ? d.publishedAt.toDate() : new Date() });
        });
        
        if (typeof renderPublishedPapers === 'function') renderPublishedPapers();
        
        const inp = document.getElementById('global-search-input');
        if (inp && inp.value && typeof window.globalSearchFilter === 'function') {
            window.globalSearchFilter(inp.value);
        }
    }, e => {
        console.warn('Papers listener error:', e.message);
    });
}
