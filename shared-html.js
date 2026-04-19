// ============================================================
//  shared-html.js  —  Injects header, mobile menu, footer,
//  auth modal into every page. Call injectSharedHTML() once
//  in DOMContentLoaded before any page-specific logic.
//
//  Pages must have:
//    <div id="shared-header"></div>   ← inside <body> before <main>
//    <div id="shared-footer"></div>   ← after </main>
//    <div id="shared-modals"></div>   ← anywhere in <body>
// ============================================================

function injectSharedHTML(activeNav) {
    // ── activeNav: 'home' | 'subjects' | 'leaderboard' | 'about'
    const nav = (page, label, id) => {
        const active = id === activeNav ? 'text-blue-600' : 'hover:text-blue-600';
        return `<a href="${page}" class="${active} transition font-semibold">${label}</a>`;
    };

    // ── HEADER ──────────────────────────────────────────────
    const headerEl = document.getElementById('shared-header');
    if (headerEl) headerEl.innerHTML = `
<header class="glass-header fixed w-full top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-20">
            <a href="index.html" class="flex items-center gap-3 no-underline">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-800 to-blue-600 flex items-center justify-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="text-white" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </div>
                <div>
                    <h1 class="text-2xl font-extrabold text-blue-900 tracking-tight">SAHASRA</h1>
                    <p class="text-[10px] uppercase tracking-widest text-emerald-700 font-bold -mt-1">Education Portal</p>
                </div>
            </a>
            <nav class="hidden md:flex space-x-8">
                ${nav('index.html',       'Home',        'home')}
                ${nav('grades.html',      'Subjects',    'subjects')}
                ${nav('Leaderboard.html', 'Leaderboard', 'leaderboard')}
                ${nav('AboutUs.html',     'About Us',    'about')}
            </nav>
            <div class="flex items-center gap-4">
                <button id="nav-login-btn" onclick="openModal('login')"
                        class="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-blue-600 text-blue-600 font-bold hover:bg-blue-50 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Student Portal
                </button>
                <div id="nav-user-info" class="hidden items-center gap-3">
                    <a href="StudentDashboard.html" class="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-sm hover:bg-blue-100 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                        My Dashboard
                    </a>
                    <div class="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200">
                        <div id="nav-avatar" class="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">?</div>
                        <span id="nav-username" class="text-sm font-bold text-emerald-800">Student</span>
                    </div>
                    <button onclick="studentLogout()" class="text-xs font-bold text-slate-400 hover:text-red-500 transition px-2 py-1">Logout</button>
                </div>
                <button id="hamburger-btn" class="md:hidden text-slate-800 p-1 rounded-lg hover:bg-slate-100 transition shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
            </div>
        </div>
    </div>
</header>

<!-- Mobile menu -->
<div id="mobile-menu" class="fixed inset-0 bg-white z-40 hidden flex-col items-center justify-center gap-8 text-2xl font-bold text-slate-800">
    <button onclick="document.getElementById('mobile-menu').classList.add('hidden')" class="absolute top-6 right-6 text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <a href="index.html"       class="hover:text-blue-600">Home</a>
    <a href="grades.html"      class="hover:text-blue-600">Subjects</a>
    <a href="Leaderboard.html" class="hover:text-blue-600">Leaderboard</a>
    <a href="AboutUs.html"     class="hover:text-blue-600">About Us</a>
    <div id="mob-guest" class="flex flex-col items-center gap-3">
        <button onclick="openModal('login'); document.getElementById('mobile-menu').classList.add('hidden')"
                class="px-8 py-3 bg-blue-600 text-white rounded-full font-bold text-lg">Student Portal</button>
        <a href="AdminLogin.html" class="px-8 py-3 bg-slate-900 text-amber-400 rounded-full font-bold text-lg">Admin Login</a>
    </div>
    <div id="mob-user" class="hidden flex-col items-center gap-3">
        <a href="StudentDashboard.html" class="px-8 py-3 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-full font-bold text-base">My Dashboard</a>
        <button onclick="studentLogout(); document.getElementById('mobile-menu').classList.add('hidden')" class="text-sm font-bold text-slate-400 hover:text-red-500">Logout</button>
    </div>
</div>`;

    // ── FOOTER ──────────────────────────────────────────────
    const footerEl = document.getElementById('shared-footer');
    if (footerEl) footerEl.innerHTML = `
<footer class="bg-slate-900 text-slate-400 py-12 mt-auto border-t-4 border-blue-600">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div class="col-span-1 md:col-span-2">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold">S</div>
                <h2 class="text-xl font-extrabold text-white tracking-widest">SAHASRA</h2>
            </div>
            <p class="text-sm mb-6 max-w-sm">Sri Lanka's most comprehensive online examination platform. Designed for students to excel in O/L and A/L examinations with real-time analytics and secure progress tracking.</p>
            <p class="text-xs">© 2026 Sahasra Education. All rights reserved.</p>
        </div>
        <div>
            <h4 class="text-white font-bold mb-4 uppercase tracking-wider text-sm">Quick Links</h4>
            <ul class="space-y-2 text-sm">
                <li><a href="index.html"       class="hover:text-blue-400 transition">Home</a></li>
                <li><a href="grades.html"      class="hover:text-blue-400 transition">All Grades</a></li>
                <li><a href="Leaderboard.html" class="hover:text-blue-400 transition">Student Leaderboard</a></li>
                <li><a href="AboutUs.html"     class="hover:text-blue-400 transition">About Us</a></li>
            </ul>
        </div>
        <div>
            <h4 class="text-white font-bold mb-4 uppercase tracking-wider text-sm">Administration</h4>
            <ul class="space-y-2 text-sm">
                <li><a href="AdminLogin.html"     class="hover:text-amber-400 transition">Admin Secure Login</a></li>
                <li><a href="AdminDashboard.html" class="hover:text-amber-400 transition">Paper Management</a></li>
                <li><a href="StudentDashboard.html" class="hover:text-amber-400 transition">Student Dashboard</a></li>
            </ul>
        </div>
    </div>
</footer>`;

    // ── AUTH MODAL ───────────────────────────────────────────
    const modalsEl = document.getElementById('shared-modals');
    if (modalsEl) modalsEl.innerHTML = `
<div id="auth-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] hidden items-center justify-center p-4 overflow-y-auto">
    <div class="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative fade-in-up my-8">
        <button onclick="closeModal()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="text-center mb-6">
            <div id="modal-icon" class="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold mx-auto mb-4">S</div>
            <h3 id="modal-title" class="text-2xl font-extrabold text-slate-900">Student Portal</h3>
            <p id="modal-subtitle" class="text-sm text-slate-500 mt-1">256-bit Encrypted Connection</p>
        </div>
        <form id="form-login" onsubmit="event.preventDefault();studentLogin();" class="space-y-4">
            <div><label class="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                <input type="email" id="login-email" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none transition" placeholder="your@email.com" required></div>
            <div><label class="block text-sm font-bold text-slate-700 mb-1">Password</label>
                <input type="password" id="login-pass" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none transition" placeholder="••••••••" required></div>
            <p id="login-error" class="text-red-500 text-sm hidden"></p>
            <button type="submit" id="login-btn" class="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition mt-4">Secure Login</button>
            <div class="mt-6 text-center text-sm text-slate-500">Don't have an account? <button type="button" onclick="switchModalMode('register')" class="text-blue-600 font-bold hover:underline">Register Here</button></div>
        </form>
        <form id="form-register" onsubmit="event.preventDefault();studentRegister();" class="space-y-4 hidden">
            <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-sm font-bold text-slate-700 mb-1">Full Name <span class="text-red-500">*</span></label>
                    <input type="text" id="reg-name" class="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none transition" placeholder="Your full name" required></div>
                <div><label class="block text-sm font-bold text-slate-700 mb-1">Grade <span class="text-red-500">*</span></label>
                    <select id="reg-grade" class="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-semibold" required>
                        <option value="">— Grade —</option>
                        <option>Grade 6</option><option>Grade 7</option><option>Grade 8</option>
                        <option>Grade 9</option><option>Grade 10</option><option>Grade 11</option>
                        <option>Grade 12</option><option>Grade 13</option>
                    </select></div>
            </div>
            <div><label class="block text-sm font-bold text-slate-700 mb-1">School Name</label>
                <input type="text" id="reg-school" class="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none transition" placeholder="e.g. Royal College"></div>
            <div><label class="block text-sm font-bold text-slate-700 mb-1">Email <span class="text-red-500">*</span></label>
                <input type="email" id="reg-email" class="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none transition" placeholder="your@email.com" required></div>
            <div><label class="block text-sm font-bold text-slate-700 mb-1">Password <span class="text-red-500">*</span></label>
                <input type="password" id="reg-pass" class="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none transition" placeholder="Min 6 characters" required minlength="6"></div>
            <p id="reg-error" class="text-red-500 text-sm hidden"></p>
            <button type="submit" id="reg-btn" class="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg transition mt-2">Create My Account</button>
            <div class="mt-4 text-center text-sm text-slate-500">Already have an account? <button type="button" onclick="switchModalMode('login')" class="text-blue-600 font-bold hover:underline">Login Here</button></div>
        </form>
        <form id="form-admin" onsubmit="event.preventDefault();loginAdmin();" class="space-y-4 hidden">
            <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 font-semibold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Sign in with your Firebase admin email account
            </div>
            <div><label class="block text-sm font-bold text-slate-700 mb-1">Admin Email</label>
                <input type="email" id="admin-email" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none transition" placeholder="admin@youremail.com" required></div>
            <div><label class="block text-sm font-bold text-slate-700 mb-1">Password</label>
                <input type="password" id="admin-pass" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none transition" placeholder="••••••••" required></div>
            <p id="admin-error" class="text-red-500 text-sm hidden"></p>
            <button type="submit" id="admin-btn" class="w-full py-4 bg-slate-900 text-amber-400 font-bold rounded-xl hover:bg-slate-800 shadow-lg transition mt-4">Access Admin Dashboard</button>
            <div class="mt-6 text-center text-sm text-slate-500">Student? <button type="button" onclick="switchModalMode('login')" class="text-blue-600 font-bold hover:underline">Return to Student Portal</button></div>
        </form>
    </div>
</div>`;

    // ── ATTACH HAMBURGER EVENT AFTER DOM INJECTION ───────────────────────────
    const hamburgerBtn = document.getElementById('hamburger-btn');
    if (hamburgerBtn) {
        hamburgerBtn.onclick = function () {
            const isIn = document.getElementById('nav-user-info') &&
                         !document.getElementById('nav-user-info').classList.contains('hidden');
            const mobGuest = document.getElementById('mob-guest');
            const mobUser  = document.getElementById('mob-user');
            if (mobGuest) mobGuest.classList.toggle('hidden', isIn);
            if (mobUser)  {
                mobUser.classList.toggle('hidden', !isIn);
                if (isIn) mobUser.classList.add('flex');
            }
            const m = document.getElementById('mobile-menu');
            if (!m) return;
            m.classList.toggle('hidden');
            if (!m.classList.contains('hidden')) m.classList.add('flex');
        };
    }
}
