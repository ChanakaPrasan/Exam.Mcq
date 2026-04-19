// ============================================================
//  nav.js  —  Shared navigation, auth UI, modal helpers
//  Include AFTER db.js on every page.
//  Requires: db.js loaded first (provides auth, db, state helpers)
// ============================================================

// ── Auth state → update header ──────────────────────────────
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
                    uid: user.uid, email: user.email,
                    name:   data.name   || user.email.split('@')[0],
                    grade:  data.grade  || '',
                    school: data.school || ''
                };
            } catch (e) {
                currentStudent = { uid: user.uid, email: user.email,
                    name: user.email.split('@')[0], grade: '', school: '' };
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
});

// ── Mobile hamburger ────────────────────────────────────────
// Moved inside shared-html.js directly after injection to fix timing bug.

// ── Modal helpers ────────────────────────────────────────────
function openModal(mode) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    switchModalMode(mode || 'login');
}
function closeModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}
function switchModalMode(mode) {
    ['form-login','form-register','form-admin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const icon     = document.getElementById('modal-icon');
    const title    = document.getElementById('modal-title');
    const subtitle = document.getElementById('modal-subtitle');
    if (mode === 'login') {
        const f = document.getElementById('form-login');
        if (f) f.classList.remove('hidden');
        if (icon)  { icon.className = 'w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold mx-auto mb-4'; icon.textContent = 'S'; }
        if (title) title.textContent = 'Student Portal';
        if (subtitle) subtitle.textContent = '256-bit Encrypted Connection';
    } else if (mode === 'register') {
        const f = document.getElementById('form-register');
        if (f) f.classList.remove('hidden');
        if (icon)  { icon.className = 'w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold mx-auto mb-4'; icon.textContent = '+'; }
        if (title) title.textContent = 'Create Account';
        if (subtitle) subtitle.textContent = 'Join Sahasra Education Portal';
    } else if (mode === 'admin') {
        const f = document.getElementById('form-admin');
        if (f) f.classList.remove('hidden');
        if (icon)  { icon.className = 'w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-white mx-auto mb-4'; icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'; }
        if (title) title.textContent = 'Admin Secure Access';
        if (subtitle) subtitle.textContent = 'Authorised personnel only';
    }
}

// ── Auth actions ─────────────────────────────────────────────
async function studentLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    const btn   = document.getElementById('login-btn');
    const err   = document.getElementById('login-error');
    err.classList.add('hidden');
    btn.textContent = 'Logging in...'; btn.disabled = true;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        closeModal();
    } catch (e) {
        err.textContent = e.code === 'auth/user-not-found' ? 'No account found with this email.' :
                          e.code === 'auth/wrong-password'  ? 'Wrong password. Please try again.' :
                          'Login failed: ' + e.message;
        err.classList.remove('hidden');
    }
    btn.textContent = 'Secure Login'; btn.disabled = false;
}

async function studentRegister() {
    const name   = document.getElementById('reg-name').value.trim();
    const grade  = document.getElementById('reg-grade').value;
    const school = document.getElementById('reg-school').value.trim();
    const email  = document.getElementById('reg-email').value.trim();
    const pass   = document.getElementById('reg-pass').value;
    const btn    = document.getElementById('reg-btn');
    const err    = document.getElementById('reg-error');
    if (!name || !grade || !email || !pass) { err.textContent = 'Please fill all required fields.'; err.classList.remove('hidden'); return; }
    err.classList.add('hidden');
    btn.textContent = 'Creating account...'; btn.disabled = true;
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('students').doc(cred.user.uid).set({ name, grade, school, email, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        closeModal();
    } catch (e) {
        err.textContent = e.code === 'auth/email-already-in-use' ? 'Email already registered.' :
                          e.code === 'auth/weak-password' ? 'Password must be at least 6 characters.' :
                          'Registration failed: ' + e.message;
        err.classList.remove('hidden');
    }
    btn.textContent = 'Create My Account'; btn.disabled = false;
}

function studentLogout() {
    if (confirm('Log out from Sahasra?')) auth.signOut();
}

async function loginAdmin() {
    const email = document.getElementById('admin-email').value.trim();
    const pass  = document.getElementById('admin-pass').value;
    const btn   = document.getElementById('admin-btn');
    const err   = document.getElementById('admin-error');
    err.classList.add('hidden');
    btn.textContent = 'Signing in…'; btn.disabled = true;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        closeModal();
        window.location.href = 'AdminDashboard.html';
    } catch (e) {
        err.textContent = 'Admin login failed: ' + e.message;
        err.classList.remove('hidden');
    }
    btn.textContent = 'Access Admin Dashboard'; btn.disabled = false;
}
