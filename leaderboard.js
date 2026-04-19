// ============================================================
//  SAHASRA — LEADERBOARD STANDALONE SCRIPT
// ============================================================

const ADMIN_EMAIL = "Chanakaprasan848@gmail.com";
let currentStudent = null;

// ── Leaderboard engine state ──
let lbAllData     = [];
let lbFiltered    = [];
let lbPageSize    = 15;
let lbCurrentPage = 0;
let lbScope       = 'national';

// ============================================================
//  AUTH STATE — update nav header
// ============================================================
auth.onAuthStateChanged(async (user) => {
    const loginBtn = document.getElementById('nav-login-btn');
    const userInfo = document.getElementById('nav-user-info');
    const avatar   = document.getElementById('nav-avatar');
    const nameEl   = document.getElementById('nav-username');

    if (user) {
        const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        if (isAdmin) {
            currentStudent = null;
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (userInfo) { userInfo.classList.add('hidden'); userInfo.classList.remove('flex'); }
        } else {
            try {
                const doc  = await db.collection('students').doc(user.uid).get();
                const data = doc.exists ? doc.data() : {};
                currentStudent = {
                    uid:    user.uid,
                    email:  user.email,
                    name:   data.name   || user.email.split('@')[0],
                    grade:  data.grade  || '',
                    school: data.school || ''
                };
            } catch(e) {
                currentStudent = { uid: user.uid, email: user.email, name: user.email.split('@')[0], grade: '', school: '' };
            }
            if (loginBtn) loginBtn.classList.add('hidden');
            if (userInfo) { userInfo.classList.remove('hidden'); userInfo.classList.add('flex'); }
            if (avatar)   avatar.textContent = currentStudent.name.charAt(0).toUpperCase();
            if (nameEl)   nameEl.textContent  = currentStudent.name;
        }
    } else {
        currentStudent = null;
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userInfo) { userInfo.classList.add('hidden'); userInfo.classList.remove('flex'); }
    }

    // Load leaderboard data after auth resolves
    loadLeaderboardPage();
});

// ============================================================
//  STUDENT LOGOUT
// ============================================================
function studentLogout() {
    if (confirm('Log out from Sahasra?')) auth.signOut();
}

// ============================================================
//  LOAD LEADERBOARD DATA FROM FIRESTORE
// ============================================================
async function loadLeaderboardPage() {
    document.getElementById('lb-loading').classList.remove('hidden');
    document.getElementById('lb-table-wrap').classList.add('hidden');
    document.getElementById('lb-empty').classList.add('hidden');
    document.getElementById('lb-podium').classList.add('hidden');

    lbAllData = [];
    try {
        const snap = await db.collection('submissions').get();
        const map  = {};

        snap.forEach(doc => {
            const d = doc.data();
            if (!d.studentId || !d.studentName) return;

            if (!map[d.studentId]) {
                map[d.studentId] = {
                    id:           d.studentId,
                    name:         d.studentName,
                    grade:        d.studentGrade  || '—',
                    school:       d.studentSchool || '',
                    province:     d.province      || '',
                    points:       0,
                    attempts:     0,
                    totalScore:   0,
                    totalCorrect: 0,
                    totalQs:      0,
                    subjects:     new Set(),
                    lastAt:       null,
                    dates:        []
                };
            }
            const r = map[d.studentId];
            r.points       += (d.correct || 0) * 10;
            r.attempts     += 1;
            r.totalScore   += (d.score   || 0);
            r.totalCorrect += (d.correct || 0);
            r.totalQs      += (d.total   || 0);
            if (d.subject) r.subjects.add(d.subject);

            const dt = d.submittedAt
                ? (d.submittedAt.toDate ? d.submittedAt.toDate() : new Date(d.submittedAt))
                : null;
            if (dt) {
                r.dates.push(dt);
                if (!r.lastAt || dt > r.lastAt) r.lastAt = dt;
            }
        });

        lbAllData = Object.values(map).map(r => ({
            ...r,
            subjects: Array.from(r.subjects),
            avgScore: r.attempts ? Math.round(r.totalScore / r.attempts) : 0,
            accuracy: r.totalQs  ? Math.round((r.totalCorrect / r.totalQs) * 100) : 0,
            streak:   calcStreak(r.dates)
        }));

    } catch(e) {
        console.warn('Leaderboard load error:', e.message);
    }

    // Update hero stats
    const totalAttempts = lbAllData.reduce((a, r) => a + r.attempts, 0);
    const globalAvg     = lbAllData.length
        ? Math.round(lbAllData.reduce((a, r) => a + r.avgScore, 0) / lbAllData.length)
        : 0;

    const heroStudents = document.getElementById('lb-hero-students');
    const heroAttempts = document.getElementById('lb-hero-attempts');
    const heroAvg      = document.getElementById('lb-hero-avg');
    if (heroStudents) heroStudents.textContent = lbAllData.length.toLocaleString();
    if (heroAttempts) heroAttempts.textContent = totalAttempts.toLocaleString();
    if (heroAvg)      heroAvg.textContent      = globalAvg + '%';

    lbUpdateMyCard();
    lbApplyFilters();
}

// ============================================================
//  STREAK CALCULATOR
// ============================================================
function calcStreak(dates) {
    if (!dates.length) return 0;
    const days = [...new Set(dates.map(d => {
        const dt = d instanceof Date ? d : new Date(d);
        return dt.toDateString();
    }))].sort().reverse();
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < days.length; i++) {
        const diff = Math.floor((today - new Date(days[i])) / 86400000);
        if (diff === i || diff === i + 1) streak++;
        else break;
    }
    return streak;
}

// ============================================================
//  SCOPE TABS (National / Province)
// ============================================================
function lbSetScope(scope) {
    lbScope = scope;
    document.querySelectorAll('.lb-scope-tab').forEach(t => {
        t.classList.remove('bg-white', 'text-blue-700', 'shadow-sm');
        t.classList.add('text-slate-500');
    });
    const active = document.getElementById(`lb-tab-${scope}`);
    if (active) {
        active.classList.add('bg-white', 'text-blue-700', 'shadow-sm');
        active.classList.remove('text-slate-500');
    }
    const provSel = document.getElementById('lb-province-sel');
    if (provSel) provSel.classList.toggle('hidden', scope !== 'province');
    lbApplyFilters();
}

// ============================================================
//  FILTERS
// ============================================================
function lbApplyFilters() {
    const grade    = document.getElementById('lb-grade-sel')?.value    || '';
    const subject  = document.getElementById('lb-subject-sel')?.value  || '';
    const sort     = document.getElementById('lb-sort-sel')?.value     || 'points';
    const province = document.getElementById('lb-province-sel')?.value || '';

    let list = [...lbAllData];

    if (lbScope === 'province' && province) list = list.filter(r => r.province === province);
    if (grade)   list = list.filter(r => r.grade === grade);
    if (subject) list = list.filter(r => r.subjects.includes(subject));

    if (sort === 'points')   list.sort((a, b) => b.points   - a.points);
    if (sort === 'accuracy') list.sort((a, b) => b.accuracy - a.accuracy);
    if (sort === 'attempts') list.sort((a, b) => b.attempts - a.attempts);

    lbFiltered    = list;
    lbCurrentPage = 0;
    lbRenderTable();
    lbUpdateMyCard();
}

// ============================================================
//  RENDER TABLE
// ============================================================
function lbRenderTable() {
    const loading   = document.getElementById('lb-loading');
    const empty     = document.getElementById('lb-empty');
    const tableWrap = document.getElementById('lb-table-wrap');
    const tbody     = document.getElementById('lb-tbody');
    const podium    = document.getElementById('lb-podium');
    const loadMore  = document.getElementById('lb-load-more-btn');
    const countLbl  = document.getElementById('lb-count-label');

    if (loading) loading.classList.add('hidden');

    if (!lbFiltered.length) {
        if (empty)     empty.classList.remove('hidden');
        if (tableWrap) tableWrap.classList.add('hidden');
        if (podium)    podium.classList.add('hidden');
        return;
    }

    if (empty)     empty.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');

    lbRenderPodium(lbFiltered.slice(0, 3));

    const end = (lbCurrentPage + 1) * lbPageSize;
    if (tbody) {
        tbody.innerHTML = '';
        lbFiltered.slice(0, end).forEach((s, i) => lbAppendRow(s, i + 1, tbody));
    }

    const shown = Math.min(end, lbFiltered.length);
    if (loadMore) loadMore.classList.toggle('hidden', shown >= lbFiltered.length);
    if (countLbl) countLbl.textContent = `Showing ${shown} of ${lbFiltered.length} students`;
}

// ============================================================
//  LOAD MORE
// ============================================================
function lbLoadMore() {
    lbCurrentPage++;
    const end      = (lbCurrentPage + 1) * lbPageSize;
    const tbody    = document.getElementById('lb-tbody');
    const from     = lbCurrentPage * lbPageSize;
    const loadMore = document.getElementById('lb-load-more-btn');
    const countLbl = document.getElementById('lb-count-label');

    lbFiltered.slice(from, end).forEach((s, i) => lbAppendRow(s, from + i + 1, tbody));

    const shown = Math.min(end, lbFiltered.length);
    if (loadMore) loadMore.classList.toggle('hidden', shown >= lbFiltered.length);
    if (countLbl) countLbl.textContent = `Showing ${shown} of ${lbFiltered.length} students`;
}

// ============================================================
//  RENDER A SINGLE ROW CARD
// ============================================================
function lbAppendRow(s, rank, container) {
    const isMe      = s.id === currentStudent?.uid;
    const medals    = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const rankDisp  = medals[rank] || `#${rank}`;
    const rankColor = rank === 1 ? 'text-amber-500'
                    : rank === 2 ? 'text-slate-500'
                    : rank === 3 ? 'text-amber-700'
                    : rank <= 10 ? 'text-blue-700'
                    : 'text-slate-400';

    const streakHtml = s.streak >= 7
        ? `<span class="inline-flex items-center gap-0.5 text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">🔥 ${s.streak}d</span>`
        : s.streak >= 3
        ? `<span class="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">⚡ ${s.streak}d</span>`
        : '';

    const accColor = s.accuracy >= 75 ? 'bg-emerald-500' : s.accuracy >= 50 ? 'bg-amber-400' : 'bg-red-400';
    const accText  = s.accuracy >= 75 ? 'text-emerald-600' : s.accuracy >= 50 ? 'text-amber-600' : 'text-red-500';

    const div = document.createElement('div');
    div.className = `flex items-center gap-3 px-4 py-3.5 ${isMe ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-slate-50'} transition-colors`;
    div.innerHTML = `
        <div class="w-8 sm:w-10 text-center shrink-0">
            <span class="text-base sm:text-lg font-black ${rankColor}">${rankDisp}</span>
        </div>
        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm">
            ${s.name.charAt(0).toUpperCase()}
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
                <p class="font-bold text-slate-800 text-sm leading-tight truncate">${s.name}</p>
                ${isMe ? '<span class="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase shrink-0">You</span>' : ''}
                ${streakHtml}
            </div>
            <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                <span class="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">${s.grade}</span>
                <span class="text-[10px] text-slate-400 truncate">${s.school || s.province || ''}</span>
            </div>
            <div class="flex items-center gap-1.5 mt-1.5">
                <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                    <div class="h-full rounded-full ${accColor}" style="width:${s.accuracy}%"></div>
                </div>
                <span class="text-[11px] font-bold ${accText}">${s.accuracy}%</span>
                <span class="text-[10px] text-slate-300 hidden sm:inline">• ${s.attempts} paper${s.attempts !== 1 ? 's' : ''}</span>
            </div>
        </div>
        <div class="text-right shrink-0">
            <p class="font-black text-blue-600 text-sm sm:text-base">${s.points.toLocaleString()}</p>
            <p class="text-[9px] text-slate-400 uppercase tracking-wide">pts</p>
            <p class="text-[10px] text-slate-400 sm:hidden">${s.attempts} papers</p>
        </div>
    `;
    container.appendChild(div);
}

// ============================================================
//  PODIUM TOP 3
// ============================================================
function lbRenderPodium(top3) {
    const el = document.getElementById('lb-podium');
    if (!el) return;
    if (!top3.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');

    const order  = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
    const medals = ['🥈', '🥇', '🥉'];
    const labels = ['2nd Place', '1st Place', '3rd Place'];
    const barH   = ['pb-4 pt-6', 'pb-6 pt-8', 'pb-3 pt-5'];
    const barBg  = ['bg-slate-100 border-slate-200', 'bg-amber-100 border-amber-200', 'bg-slate-50 border-slate-100'];
    const avatarRing = ['ring-slate-300', 'ring-amber-400', 'ring-slate-200'];

    el.className = 'bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-0';
    el.innerHTML = `
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 text-center">🏆 Top 3 This Round</p>
        <div class="grid grid-cols-3 gap-2 sm:gap-4 items-end">
            ${order.map((s, i) => s ? `
            <div class="flex flex-col items-center gap-1.5">
                <div class="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl ring-2 ${avatarRing[i]} bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center text-white font-extrabold text-base sm:text-xl shadow-md">
                    ${s.name.charAt(0).toUpperCase()}
                </div>
                <p class="text-[11px] sm:text-xs font-extrabold text-slate-800 text-center truncate w-full px-1">${s.name.split(' ')[0]}</p>
                <p class="text-[10px] text-slate-400 text-center">${s.points.toLocaleString()}<span class="hidden sm:inline"> pts</span></p>
                <div class="w-full ${barBg[i]} border rounded-t-xl ${barH[i]} flex flex-col items-center justify-end gap-0.5">
                    <span class="text-base sm:text-lg">${medals[i]}</span>
                    <span class="text-[9px] sm:text-[10px] font-black text-slate-500">${labels[i]}</span>
                </div>
            </div>` : '<div></div>'
            ).join('')}
        </div>`;
}

// ============================================================
//  MY POSITION CARD
// ============================================================
function lbUpdateMyCard() {
    const card = document.getElementById('lb-my-card');
    if (!currentStudent || !lbFiltered.length) {
        if (card) card.classList.add('hidden');
        return;
    }
    const myIdx = lbFiltered.findIndex(x => x.id === currentStudent.uid);
    if (myIdx < 0) { if (card) card.classList.add('hidden'); return; }

    const me = lbFiltered[myIdx];
    card.classList.remove('hidden');
    document.getElementById('lb-my-avatar').textContent    = me.name.charAt(0).toUpperCase();
    document.getElementById('lb-my-name').textContent      = me.name;
    document.getElementById('lb-my-meta').textContent      = `${me.grade}${me.school ? ' • ' + me.school : ''}${me.province ? ' • ' + me.province : ''}`;
    document.getElementById('lb-my-nat-rank').textContent  = `#${myIdx + 1}`;
    document.getElementById('lb-my-points').textContent    = me.points.toLocaleString();
    document.getElementById('lb-my-avg').textContent       = me.avgScore + '%';
}
