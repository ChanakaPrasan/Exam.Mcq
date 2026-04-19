document.addEventListener('DOMContentLoaded', function() {
                        const gradeGrid = document.getElementById('grade-cards-grid');
                        if (!gradeGrid) return; // Not on a page with grade cards, skip
                        const grades = [
                            {val: 6, label: "Grade 06", color: "blue"}, {val: 7, label: "Grade 07", color: "emerald"}, 
                            {val: 8, label: "Grade 08", color: "amber"}, {val: 9, label: "Grade 09", color: "purple"},
                            {val: 10, label: "Grade 10", color: "rose"}, {val: 11, label: "O/L Exam", color: "blue"},
                            {val: 12, label: "A/L Year 1", color: "emerald"}, {val: 13, label: "A/L Year 2", color: "amber"}
                        ];
                        const container = gradeGrid.parentElement;
                        grades.forEach(g => {
                            const div = document.createElement('div');
                            div.setAttribute('onclick', `selectGrade(${g.val})`);
                            div.className = 'hover-card p-8 rounded-3xl text-center cursor-pointer group';
                            div.innerHTML = `
                                <div class="w-16 h-16 mx-auto rounded-2xl bg-${g.color}-100 text-${g.color}-600 flex items-center justify-center text-2xl font-black mb-4 group-hover:scale-110 transition-transform">${g.val}</div>
                                <h3 class="text-lg font-bold text-slate-800">${g.label}</h3>
                                ${g.val >= 12 ? '<span class="inline-block mt-2 text-[10px] uppercase font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded">Stream Selection</span>' : ''}
                            `;
                            container.insertBefore(div, document.getElementById('grade-cards-grid'));
                        });
                        document.getElementById('grade-cards-grid').remove();
                    });

// ============================================================
        
        // ============================================================
        //  SAHASRA – FIREBASE INTEGRATED
        // ============================================================

        // ============================================================
        //  ALL GLOBAL VARIABLES — declared first to avoid TDZ errors
        // ============================================================

        let currentStudent = null;

        // ── IMPORTANT: Set this to the email you added in Firebase Auth as admin ──
        const ADMIN_EMAIL = "Chanakaprasan848@gmail.com";

        // App navigation + quiz state
        let state = {
            grade: null, stream: null, subject: null,
            paperType: null, selectedYear: null, selectedTerm: null,
            activePaperId: null, activePaperName: null,
            subView: 'subjects',
            currentIndex: 0, userAnswers: [], timer: 0, timerInterval: null
        };

        // Admin wizard state
        let wizState = { step: 1, questions: [], paperMeta: {} };

        // Data stores
        let publishedPapers      = [];
        let studentSubmissions   = [];

        // Subject map
        const SUBJECTS_BY_LEVEL = {
            "6":  ["Science","Mathematics","English","History","Geography","Sinhala","ICT","Civics"],
            "7":  ["Science","Mathematics","English","History","Geography","Sinhala","ICT","Civics"],
            "8":  ["Science","Mathematics","English","History","Geography","Sinhala","ICT","Civics"],
            "9":  ["Science","Mathematics","English","History","Geography","Sinhala","ICT","Civics"],
            "10": ["Science","Mathematics","English","History","Geography","Sinhala","ICT","Commerce","Citizenship"],
            "11": ["Science","Mathematics","English","History","Geography","Sinhala","ICT","Commerce","Citizenship"],
            "Physical Science":  ["Combined Mathematics","Physics","Chemistry","ICT"],
            "Biological Science":["Biology","Physics","Chemistry","Agricultural Science"],
            "Commerce":  ["Accounting","Business Studies","Economics","ICT"],
            "Arts":      ["Sinhala","Logic","Political Science","Geography","History"],
            "Technology":["Engineering Tech","Bio Systems Tech","Science for Tech","ICT"]
        };


        // ── Firebase Auth state listener ──
        auth.onAuthStateChanged(async (user) => {
            const loginBtn = document.getElementById('nav-login-btn');
            const userInfo = document.getElementById('nav-user-info');
            const avatar   = document.getElementById('nav-avatar');
            const nameEl   = document.getElementById('nav-username');

            if (user) {
                const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

                if (isAdmin) {
                    // Admin signed in — keep header clean (no student pill)
                    currentStudent = null;
                    if (loginBtn) loginBtn.classList.remove('hidden');
                    if (userInfo) { userInfo.classList.add('hidden'); userInfo.classList.remove('flex'); }
                    // If we're on AdminDashboard.html, show the dashboard and load data
                    const adminView = document.getElementById('view-admin');
                    if (adminView) {
                        adminView.classList.remove('hidden');
                        loadFromFirebase();
                        loadAdminYears();
                        if (typeof wizGoStep === 'function') wizGoStep(1);
                    }
                } else {
                    // Regular student signed in
                    try {
                        const doc  = await db.collection('students').doc(user.uid).get();
                        const data = doc.exists ? doc.data() : {};
                        currentStudent = { uid: user.uid, email: user.email, name: data.name || user.email.split('@')[0], grade: data.grade || '', school: data.school || '' };
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
        });

        // ── Student Login via Firebase Auth ──
        async function studentLogin() {
            const email = document.getElementById('login-email').value.trim();
            const pass  = document.getElementById('login-pass').value;
            const btn   = document.getElementById('login-btn');
            const err   = document.getElementById('login-error');
            err.classList.add('hidden');
            btn.textContent = 'Logging in...';
            btn.disabled = true;
            try {
                await auth.signInWithEmailAndPassword(email, pass);
                closeModal();
            } catch(e) {
                err.textContent = e.code === 'auth/user-not-found' ? 'No account found with this email.' :
                                  e.code === 'auth/wrong-password' ? 'Wrong password. Please try again.' :
                                  'Login failed: ' + e.message;
                err.classList.remove('hidden');
            }
            btn.textContent = 'Secure Login';
            btn.disabled = false;
        }

        // ── Student Register via Firebase Auth + save profile to Firestore ──
        async function studentRegister() {
            const name   = document.getElementById('reg-name').value.trim();
            const grade  = document.getElementById('reg-grade').value;
            const school = document.getElementById('reg-school').value.trim();
            const email  = document.getElementById('reg-email').value.trim();
            const pass   = document.getElementById('reg-pass').value;
            const btn    = document.getElementById('reg-btn');
            const err    = document.getElementById('reg-error');
            if (!name || !grade || !email || !pass) { err.textContent = 'Please fill in all required fields.'; err.classList.remove('hidden'); return; }
            err.classList.add('hidden');
            btn.textContent = 'Creating account...';
            btn.disabled = true;
            try {
                const cred = await auth.createUserWithEmailAndPassword(email, pass);
                await db.collection('students').doc(cred.user.uid).set({ name, grade, school, email, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                closeModal();
            } catch(e) {
                err.textContent = e.code === 'auth/email-already-in-use' ? 'This email is already registered. Please login.' :
                                  e.code === 'auth/weak-password' ? 'Password must be at least 6 characters.' :
                                  'Registration failed: ' + e.message;
                err.classList.remove('hidden');
            }
            btn.textContent = 'Create My Account';
            btn.disabled = false;
        }

        // ── Student Logout ──
        function studentLogout() {
            if (confirm('Log out from Sahasra?')) auth.signOut();
        }

        // ── Load papers + questions from Firestore on startup ──
        // ============================================================
        //  ADMIN — MANAGE EXTRA EXAM YEARS
        // ─────────────────────────────────────────────────────────────
        //  DEFAULT years 2015–2025 are always in the Upload Wizard.
        //  Admin can add EXTRA years (e.g. 2026) — stored as individual
        //  Firestore docs in  examYears/{year}  AND cached in localStorage.
        //
        //  STUDENTS only see a year on the browsing screen if at least
        //  one published paper already exists for that year/grade/subject.
        //  Extra years admin added DO NOT appear to students until a paper
        //  is published for them.
        // ─────────────────────────────────────────────────────────────
        const DEFAULT_YEARS  = [2025,2024,2023,2022,2021,2020,2019,2018,2017,2016,2015];
        const EXTRA_YEARS_LS = 'sahasra_extra_years';   // localStorage key
        let   _extraYears    = [];     // admin-added extras beyond DEFAULT_YEARS
        let   _yearsAdding   = new Set();
        let   _yearsRemoving = new Set();

        /* ── localStorage helpers ── */
        function _saveExtraLocal() {
            try { localStorage.setItem(EXTRA_YEARS_LS, JSON.stringify(_extraYears)); } catch(e) {}
        }
        function _loadExtraLocal() {
            try {
                const v = JSON.parse(localStorage.getItem(EXTRA_YEARS_LS) || '[]');
                return Array.isArray(v) ? v.map(Number) : [];
            } catch(e) { return []; }
        }

        /* ── Full wizard year list = defaults + admin extras ── */
        function _allWizardYears() {
            const extras = _extraYears.filter(y => !DEFAULT_YEARS.includes(y));
            return [...extras, ...DEFAULT_YEARS].sort((a,b) => b - a);
        }

        /* ── Load extra years from Firestore (background, no UI block) ── */
        async function loadAdminYears() {
            const loadingEl = document.getElementById('admin-years-loading');
            if (!loadingEl) return;

            // Instant render from cache
            _extraYears = _loadExtraLocal();
            loadingEl.classList.add('hidden');
            renderAdminYears();
            populateWizYear();

            // Sync from Firestore silently
            try {
                const snap = await db.collection('examYears').get();
                const remote = [];
                snap.forEach(doc => {
                    const yr = Number(doc.id);
                    if (!DEFAULT_YEARS.includes(yr)) remote.push(yr);
                });
                _extraYears = remote;
                _saveExtraLocal();
                renderAdminYears();
                populateWizYear();
            } catch(e) {
                console.warn('examYears read:', e.message);
            }
        }

        /* ── Render the admin panel chips ── */
        function renderAdminYears() {
            const chips = document.getElementById('admin-years-chips');
            const empty = document.getElementById('admin-years-empty');
            if (!chips) return;

            // Always show default years (locked, no delete) + extra years (deletable)
            const sorted = [..._extraYears].filter(y => !DEFAULT_YEARS.includes(y)).sort((a,b) => b - a);

            // Build HTML: defaults section + extras section
            let html = '';

            // Default years row — shown as locked badges
            html += `<div class="w-full mb-1">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Default years (always available)</p>
                <div class="flex flex-wrap gap-1.5">`;
            DEFAULT_YEARS.forEach(yr => {
                html += `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    ${yr}</span>`;
            });
            html += `</div></div>`;

            // Extra years section
            if (sorted.length > 0) {
                html += `<div class="w-full mt-2">
                    <p class="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1.5">Admin-added extra years</p>
                    <div class="flex flex-wrap gap-1.5">`;
                sorted.forEach(yr => {
                    const isSaving   = _yearsAdding.has(yr);
                    const isRemoving = _yearsRemoving.has(yr);
                    const action = isSaving
                        ? `<span class="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"></span>`
                        : isRemoving
                        ? `<span class="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin"></span>`
                        : `<button onclick="adminRemoveYear(${yr})" title="Remove ${yr}"
                              class="w-4 h-4 rounded-full bg-violet-200 hover:bg-red-500 hover:text-white text-violet-600
                                     flex items-center justify-center transition-all text-[11px] font-black">×</button>`;
                    html += `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all
                                          ${isRemoving ? 'bg-red-50 border-red-200 text-red-400' : 'bg-violet-50 border-violet-200 text-violet-700'}">
                        ✦ ${yr} ${action}</span>`;
                });
                html += `</div></div>`;
            }

            chips.classList.remove('hidden');
            chips.innerHTML = html;
            if (empty) empty.classList.add('hidden');
        }

        /* ── Populate Upload Wizard year dropdown ── */
        function populateWizYear() {
            const sel = document.getElementById('wiz-year');
            if (!sel) return;
            const prev   = sel.value;
            const years  = _allWizardYears();
            const extras = years.filter(y => !DEFAULT_YEARS.includes(y));
            const defs   = years.filter(y => DEFAULT_YEARS.includes(y));

            let html = '<option value="">— Select Year —</option>';
            if (extras.length > 0) {
                html += '<optgroup label="── Extra Years (Admin Added) ──">'
                      + extras.map(y => `<option value="${y}">★ ${y}</option>`).join('')
                      + '</optgroup>';
            }
            html += '<optgroup label="── Default Years ──">'
                  + defs.map(y => `<option value="${y}">${y}</option>`).join('')
                  + '</optgroup>';
            sel.innerHTML = html;
            if (prev && years.includes(Number(prev))) sel.value = prev;
        }

        /* ── Add an extra year (admin only) ── */
        async function adminAddYear() {
            const input  = document.getElementById('admin-new-year');
            const addBtn = document.querySelector('button[onclick="adminAddYear()"]');
            const yr     = parseInt(input.value, 10);

            if (!yr || yr < 1990 || yr > 2099) {
                input.classList.add('border-red-400');
                input.focus();
                setTimeout(() => input.classList.remove('border-red-400'), 1500);
                return;
            }
            if (DEFAULT_YEARS.includes(yr)) {
                input.value = '';
                showAdminYearToast(`${yr} is already a default year`, 'warn');
                return;
            }
            if (_extraYears.includes(yr)) {
                input.value = '';
                showAdminYearToast(`${yr} is already added`, 'warn');
                return;
            }

            // Instant optimistic update
            _extraYears.push(yr);
            _yearsAdding.add(yr);
            input.value = '';
            if (addBtn) { addBtn.disabled = true; addBtn.classList.add('opacity-60'); }
            _saveExtraLocal();
            renderAdminYears();
            populateWizYear();

            // Save to Firestore as its own doc
            try {
                await db.collection('examYears').doc(String(yr)).set({
                    year:    yr,
                    addedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    addedBy: auth.currentUser ? auth.currentUser.email : 'admin'
                });
                _yearsAdding.delete(yr);
                showAdminYearToast(`${yr} added to wizard ✓`, 'ok');
            } catch(e) {
                _yearsAdding.delete(yr);
                console.warn('examYears write:', e.message);
                showAdminYearToast(`${yr} saved locally (update Firestore rules to sync)`, 'warn');
            }

            if (addBtn) { addBtn.disabled = false; addBtn.classList.remove('opacity-60'); }
            renderAdminYears();
        }

        /* ── Remove an extra year ── */
        async function adminRemoveYear(yr) {
            yr = Number(yr);
            if (DEFAULT_YEARS.includes(yr)) return; // never delete defaults
            _yearsRemoving.add(yr);
            renderAdminYears();
            try {
                await db.collection('examYears').doc(String(yr)).delete();
            } catch(e) { console.warn('examYears delete:', e.message); }
            _yearsRemoving.delete(yr);
            _extraYears = _extraYears.filter(y => y !== yr);
            _saveExtraLocal();
            renderAdminYears();
            populateWizYear();
            showAdminYearToast(`${yr} removed from wizard`);
        }

        /* ── Toast ── */
        function showAdminYearToast(msg, type='ok') {
            let t = document.getElementById('admin-year-toast');
            if (!t) { t = document.createElement('div'); t.id = 'admin-year-toast'; document.body.appendChild(t); }
            const bg = type === 'ok' ? 'bg-emerald-600 text-white' : type === 'warn' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white';
            t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-bold shadow-xl z-[999] transition-all duration-300 ${bg}`;
            t.textContent = msg; t.style.opacity = '1';
            clearTimeout(t._t); t._t = setTimeout(() => { t.style.opacity = '0'; }, 2800);
        }

        // Enter key support
        document.addEventListener('DOMContentLoaded', () => {
            const inp = document.getElementById('admin-new-year');
            if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') adminAddYear(); });
            // Pre-populate wizard year dropdown from cache
            _extraYears = _loadExtraLocal();
            populateWizYear();
        });

        async function loadFromFirebase() {
            try {
                // Load published papers
                const papersSnap = await db.collection('papers').get();
                publishedPapers = [];
                papersSnap.forEach(doc => {
                    const d = doc.data();
                    publishedPapers.push({ ...d, id: doc.id, publishedAt: d.publishedAt ? d.publishedAt.toDate() : new Date() });
                });
                // Determine if user is admin
                const user = auth.currentUser;
                const isAdmin = user && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

                // Load questions ONLY if admin (to prevent massive mobile downloads)
                if (isAdmin) {
                    const qSnap = await db.collection('questions').get();
                    QUIZ_DATA = QUIZ_DATA.filter(q => !q._fromFirebase);
                    qSnap.forEach(doc => {
                        QUIZ_DATA.push({ ...doc.data(), _fromFirebase: true });
                    });
                }
                
                // Critical data loaded successfully
                window.firebaseLoaded = true;

                // Load submissions ONLY if admin (non-admins will fail anyway)
                if (isAdmin) {
                    try {
                        const subSnap = await db.collection('submissions').get();
                        studentSubmissions = [];
                        subSnap.forEach(doc => {
                            const d = doc.data();
                            studentSubmissions.push({ ...d, submittedAt: d.submittedAt ? d.submittedAt.toDate() : new Date() });
                        });
                    } catch(subErr) {
                        console.warn('Could not load student submissions:', subErr.message);
                    }
                }

                // Update admin stats (will cleanly ignore if not on admin page)
                const tq = document.getElementById('admin-total-q');
                const tp = document.getElementById('admin-total-papers');
                const ta = document.getElementById('admin-total-attempts');
                const pc = document.getElementById('published-count');
                if (tq) tq.textContent = QUIZ_DATA.length;
                if (tp) tp.textContent = publishedPapers.length;
                if (ta) ta.textContent = studentSubmissions.length;
                if (pc) pc.textContent = publishedPapers.length;
                
                renderPublishedPapers();
            } catch(e) {
                console.warn('Firebase load error:', e.message);
                // Even on error, trigger the loaded flag so it doesn't spin forever without explanation
                window.firebaseLoaded = true; 
            }
        }

        // ── Real-time listener: updates publishedPapers live whenever
        //    admin publishes or deletes a paper, without a page reload ──
        function startPapersListener() {
            db.collection('papers').onSnapshot(snap => {
                publishedPapers = [];
                snap.forEach(doc => {
                    const d = doc.data();
                    publishedPapers.push({ ...d, id: doc.id, publishedAt: d.publishedAt ? d.publishedAt.toDate() : new Date() });
                });
                // Keep admin sidebar in sync
                const tp = document.getElementById('admin-total-papers');
                const pc = document.getElementById('published-count');
                if (tp) tp.textContent = publishedPapers.length;
                if (pc) pc.textContent = publishedPapers.length;
                renderPublishedPapers();
                // If student is currently on the year/paper selection screen, refresh it
                const subjView = document.getElementById('view-subjects');
                if (subjView && !subjView.classList.contains('hidden')) {
                    if (state.subView === 'years') showYearSelection();
                    if (state.subView === 'papers') showPaperList();
                }
            }, e => {
                console.warn('Papers listener error:', e.message);
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            loadFromFirebase();
            startPapersListener();
        });


        // --- QUIZ DATABASE (tagged with grade & subject) ---
        let QUIZ_DATA = [
            { grade: "Grade 6",  subject: "Mathematics", stream: null, q: "What is the value of 3² + 4²?", a: ["14","25","7","49"], c: 1, e: "3²=9, 4²=16, 9+16=25." },
            { grade: "Grade 6",  subject: "Science",     stream: null, q: "Which planet is closest to the Sun?", a: ["Venus","Earth","Mercury","Mars"], c: 2, e: "Mercury is the closest planet to the Sun." },
            { grade: "Grade 7",  subject: "Mathematics", stream: null, q: "What is 15% of 200?", a: ["20","25","30","35"], c: 2, e: "15/100 × 200 = 30." },
            { grade: "Grade 7",  subject: "Science",     stream: null, q: "Which gas do plants absorb during photosynthesis?", a: ["Oxygen","Nitrogen","Carbon Dioxide","Hydrogen"], c: 2, e: "Plants absorb CO₂ and release O₂ during photosynthesis." },
            { grade: "Grade 8",  subject: "Mathematics", stream: null, q: "Solve: 2x + 5 = 13. What is x?", a: ["3","4","5","6"], c: 1, e: "2x=8, x=4." },
            { grade: "Grade 8",  subject: "Science",     stream: null, q: "What is the chemical symbol for water?", a: ["HO","H₂O","O₂H","H₃O"], c: 1, e: "Water is H₂O — two hydrogen atoms bonded to one oxygen." },
            { grade: "Grade 9",  subject: "Mathematics", stream: null, q: "What is the area of a circle with radius 7 cm? (π ≈ 3.14)", a: ["43.96 cm²","153.86 cm²","49 cm²","21.98 cm²"], c: 1, e: "Area = πr² = 3.14 × 49 = 153.86 cm²." },
            { grade: "Grade 9",  subject: "Science",     stream: null, q: "Newton's First Law is also known as:", a: ["Law of Gravity","Law of Inertia","Law of Acceleration","Law of Action-Reaction"], c: 1, e: "Newton's First Law describes inertia — a body at rest stays at rest unless acted upon." },
            { grade: "Grade 10", subject: "Mathematics", stream: null, q: "What is sin 30°?", a: ["0","0.5","1","√3/2"], c: 1, e: "sin 30° = 1/2 = 0.5." },
            { grade: "Grade 10", subject: "Science",     stream: null, q: "Which element has atomic number 6?", a: ["Oxygen","Nitrogen","Carbon","Helium"], c: 2, e: "Carbon has atomic number 6." },
            { grade: "Grade 11", subject: "Mathematics", stream: null, q: "If f(x) = x² − 4, what is f(3)?", a: ["1","5","9","13"], c: 1, e: "f(3) = 9 − 4 = 5." },
            { grade: "Grade 11", subject: "Science",     stream: null, q: "What is the speed of light in a vacuum?", a: ["3×10⁸ m/s","3×10⁶ m/s","3×10¹⁰ m/s","3×10⁴ m/s"], c: 0, e: "Speed of light c ≈ 3×10⁸ m/s." },
            { grade: "Grade 11", subject: "ICT",         stream: null, q: "Which of the following is a primary memory?", a: ["HDD","RAM","SSD","Flash Drive"], c: 1, e: "RAM is volatile primary memory used by the CPU." },
            { grade: "Grade 11", subject: "ICT",         stream: null, q: "What does HTML stand for?", a: ["Hyper Text Markup Language","High Tech Modern Language","Hyper Transfer Main Line","Home Tool Markup Language"], c: 0, e: "HTML = Hyper Text Markup Language, the standard for web pages." },
            { grade: "Grade 11", subject: "ICT",         stream: null, q: "Which protocol is used for secure web pages?", a: ["HTTP","FTP","SMTP","HTTPS"], c: 3, e: "HTTPS encrypts communication between browser and server." },
            { grade: "Grade 11", subject: "ICT",         stream: null, q: "In binary, what is the decimal value of '1010'?", a: ["8","10","12","14"], c: 1, e: "(1×8)+(0×4)+(1×2)+(0×1) = 10." },
            { grade: "Grade 11", subject: "ICT",         stream: null, q: "Which SQL command retrieves data from a table?", a: ["GET","EXTRACT","SELECT","PULL"], c: 2, e: "SELECT is the standard SQL retrieval command." },
            { grade: "Grade 12", subject: "Combined Mathematics", stream: "Physical Science (Maths)", q: "Differentiate y = 3x³ with respect to x.", a: ["3x²","9x²","6x","9x³"], c: 1, e: "d/dx(3x³) = 9x²." },
            { grade: "Grade 12", subject: "Physics",     stream: "Physical Science (Maths)", q: "What is the SI unit of electric current?", a: ["Volt","Watt","Ampere","Ohm"], c: 2, e: "Ampere (A) is the SI unit of electric current." },
            { grade: "Grade 12", subject: "Chemistry",   stream: "Physical Science (Maths)", q: "What is the molar mass of NaCl?", a: ["48 g/mol","58.5 g/mol","74 g/mol","35.5 g/mol"], c: 1, e: "Na=23 + Cl=35.5 → 58.5 g/mol." },
            { grade: "Grade 12", subject: "Biology",     stream: "Biological Science", q: "What is the powerhouse of the cell?", a: ["Nucleus","Ribosome","Mitochondria","Chloroplast"], c: 2, e: "Mitochondria produce ATP — the cell's energy currency." },
            { grade: "Grade 12", subject: "Accounting",  stream: "Commerce", q: "The accounting equation is:", a: ["Assets = Liabilities − Equity","Assets = Liabilities + Equity","Liabilities = Assets + Equity","Equity = Assets + Liabilities"], c: 1, e: "Assets = Liabilities + Owner's Equity is the fundamental accounting equation." },
            { grade: "Grade 12", subject: "Economics",   stream: "Commerce", q: "What does GDP stand for?", a: ["Gross Domestic Product","General Domestic Production","Gross Development Plan","General Development Product"], c: 0, e: "GDP = Gross Domestic Product, total value of goods and services produced." },
            { grade: "Grade 13", subject: "Combined Mathematics", stream: "Physical Science (Maths)", q: "Integrate ∫2x dx.", a: ["x","2x²","x² + C","2 + C"], c: 2, e: "∫2x dx = x² + C." },
            { grade: "Grade 13", subject: "Physics",     stream: "Physical Science (Maths)", q: "Which law states F = ma?", a: ["Newton's 1st Law","Newton's 2nd Law","Newton's 3rd Law","Ohm's Law"], c: 1, e: "Newton's Second Law: Force = mass × acceleration." },
        ];

        // Current filtered questions for the active quiz session
        // ============================================================
        //  NAVIGATION
        // ============================================================
        function navTo(viewId) {
            const views = ['home','stream','subjects','papers','quiz','results','leaderboard','about','admin','dashboard'];
            views.forEach(v => {
                const el = document.getElementById(`view-${v}`);
                if (el) el.classList.add('hidden');
            });
            const target = document.getElementById(`view-${viewId}`);
            if (target) {
                target.classList.remove('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            // Refresh data whenever the admin panel is opened
            if (viewId === 'admin') {
                loadFromFirebase();
                loadAdminYears();
            }
        }

        // ============================================================
        //  GRADE → STREAM → SUBJECT → PAPER FLOW
        // ============================================================
        function selectGrade(grade) {
            state.grade = grade;
            state.stream = null;
            state.subject = null;
            state.selectedTerm = null;
            state.activePaperId = null;
            state.activePaperName = null;
            state.subView = 'subjects';
            if (grade === 12 || grade === 13) {
                document.getElementById('stream-grade-display').textContent = grade;
                navTo('stream');
            } else {
                setupSubjectView();
            }
        }

        function selectStream(streamName) {
            state.stream = streamName;
            setupSubjectView();
        }

        function setGridCols(mode) {
            const grid = document.getElementById('subjects-grid');
            if (!grid) return;
            const cls = {
                subjects: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6',
                years:    'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6',
                terms:    'grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto w-full',
                papers:   'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
            };
            grid.className = cls[mode] || cls.subjects;
        }

        function setupSubjectView() {
            const metaStr = state.stream
                ? `Grade ${state.grade} • ${state.stream} Stream`
                : `Grade ${state.grade} General Education`;
            document.getElementById('subject-meta-subtitle').textContent = metaStr;
            document.querySelector('#view-subjects h2').textContent = 'Select Subject';
            state.subView = 'subjects';
            setGridCols('subjects');
            updateSubViewBackLabel();
            renderSubjects();
            navTo('subjects');
        }

        function renderSubjects() {
            const grid = document.getElementById('subjects-grid');
            grid.innerHTML = '';
            let subjects = [];

            if (state.grade <= 9) {
                subjects = [
                    {name:"Mathematics",icon:"📐",color:"blue"},
                    {name:"Science",icon:"🔬",color:"emerald"},
                    {name:"English",icon:"📚",color:"amber"},
                    {name:"Sinhala",icon:"📝",color:"purple"},
                    {name:"History",icon:"🏛️",color:"rose"},
                    {name:"Geography",icon:"🌍",color:"blue"}
                ];
            } else if (state.grade <= 11) {
                subjects = [
                    {name:"Mathematics",icon:"📐",color:"blue"},
                    {name:"Science",icon:"🔬",color:"emerald"},
                    {name:"English",icon:"📚",color:"amber"},
                    {name:"Sinhala",icon:"📝",color:"purple"},
                    {name:"History",icon:"🏛️",color:"rose"},
                    {name:"ICT",icon:"💻",color:"emerald"},
                    {name:"Commerce",icon:"📊",color:"amber"},
                    {name:"Geography",icon:"🌍",color:"blue"}
                ];
            } else if (state.stream && state.stream.includes('Maths')) {
                subjects = [{name:"Combined Mathematics",icon:"📐",color:"blue"},{name:"Physics",icon:"⚡",color:"emerald"},{name:"Chemistry",icon:"🧪",color:"rose"},{name:"ICT",icon:"💻",color:"amber"}];
            } else if (state.stream && state.stream.includes('Bio')) {
                subjects = [{name:"Biology",icon:"🧬",color:"emerald"},{name:"Physics",icon:"⚡",color:"blue"},{name:"Chemistry",icon:"🧪",color:"rose"},{name:"Agricultural Science",icon:"🌱",color:"amber"}];
            } else if (state.stream && state.stream.includes('Commerce')) {
                subjects = [{name:"Accounting",icon:"📒",color:"blue"},{name:"Business Studies",icon:"🏢",color:"emerald"},{name:"Economics",icon:"📈",color:"amber"},{name:"ICT",icon:"💻",color:"purple"}];
            } else if (state.stream && state.stream.includes('Arts')) {
                subjects = [{name:"Sinhala",icon:"📝",color:"purple"},{name:"History",icon:"🏛️",color:"rose"},{name:"Logic",icon:"🧠",color:"blue"},{name:"Geography",icon:"🌍",color:"emerald"}];
            } else {
                subjects = [{name:"Science for Tech",icon:"⚙️",color:"blue"},{name:"Engineering Tech",icon:"🔧",color:"emerald"},{name:"Bio Systems Tech",icon:"🔬",color:"rose"},{name:"ICT",icon:"💻",color:"amber"}];
            }

            subjects.forEach(s => {
                grid.innerHTML += `
                    <div onclick="selectSubject('${s.name}')" class="hover-card p-8 rounded-3xl text-center cursor-pointer group">
                        <div class="w-16 h-16 mx-auto rounded-2xl bg-${s.color}-50 text-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">${s.icon}</div>
                        <h3 class="text-lg font-bold text-slate-800">${s.name}</h3>
                    </div>`;
            });
        }

        function selectSubject(subjectName) {
            state.subject = subjectName;
            setupPaperView();
        }

        function goBackFromSubjects() {
            // Smart back navigation based on which sub-screen is active
            switch (state.subView) {
                case 'subjects':
                    if (state.grade === 12 || state.grade === 13) navTo('stream');
                    else navTo('home');
                    break;
                case 'years':
                    // Go back to subject list
                    state.subView = 'subjects';
                    setupSubjectView();
                    break;
                case 'terms':
                    // Go back to year selection
                    state.subView = 'years';
                    showYearSelection();
                    break;
                case 'papers':
                    // Go back to term selection (if School Term Papers or Provincial Papers) or year selection
                    if (state.paperType === 'School Term Papers' || state.paperType === 'Provincial Papers') {
                        state.subView = 'terms';
                        showTermSelection();
                    } else {
                        state.subView = 'years';
                        showYearSelection();
                    }
                    break;
                default:
                    navTo('home');
            }
        }

        // Update the back-button label based on sub-view
        function updateSubViewBackLabel() {
            const btn = document.getElementById('subjects-back-btn');
            if (!btn) return;
            const labels = {
                subjects: state.grade === 12 || state.grade === 13 ? 'Back to Streams' : 'Back to Grades',
                years:    'Back to Subjects',
                terms:    'Back to Years',
                papers:   (state.paperType === 'School Term Papers' || state.paperType === 'Provincial Papers') ? 'Back to Terms' : 'Back to Years',
            };
            // Only update the text node, preserve the SVG icon
            const textNode = [...btn.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
            if (textNode) {
                textNode.textContent = ' ' + (labels[state.subView] || 'Back');
            } else {
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg> ${labels[state.subView] || 'Back'}`;
            }
        }

        function setupPaperView() {
            const metaStr = state.stream
                ? `Grade ${state.grade} • ${state.stream} • ${state.subject}`
                : `Grade ${state.grade} • ${state.subject}`;
            document.getElementById('paper-meta-subtitle').textContent = metaStr;

            // Hide "Past Papers" card for grades 6-10
            const paperGrid = document.querySelector('#view-papers .grid');
            if (paperGrid) {
                const pastPaperCard = paperGrid.firstElementChild;
                if (pastPaperCard) {
                    pastPaperCard.style.display = (state.grade >= 6 && state.grade <= 10) ? 'none' : '';
                }
            }
            navTo('papers');
        }

        function goBackFromPapers() { 
            state.subView = 'subjects';
            setupSubjectView();
        }

        function selectPaper(type) {
            state.paperType = type;
            if (state.grade >= 6 && state.grade <= 10 && type === 'National Past Papers') {
                alert("National Past Papers are only available for O/L and A/L grades.");
                return;
            }
            showYearSelection();
        }

        function showYearSelection() {
            const grid     = document.getElementById('subjects-grid');
            const titleEl  = document.querySelector('#view-subjects h2');
            const subtitle = document.getElementById('subject-meta-subtitle');
            titleEl.textContent  = "Select Examination Year";
            subtitle.textContent = `${state.subject} — ${state.paperType}`;
            grid.innerHTML = '';
            state.subView = 'years';
            setGridCols('years');
            updateSubViewBackLabel();
            navTo('subjects');

            // Show spinner while waiting for Firestore papers to load
            const gradeStr = `Grade ${state.grade}`;

            function renderYears() {
                const yearsWithPapers = [...new Set(
                    publishedPapers
                        .filter(p =>
                            p.grade     === gradeStr       &&
                            p.subject   === state.subject  &&
                            p.paperType === state.paperType &&
                            p.year
                        )
                        .map(p => Number(p.year))
                )].sort((a,b) => b - a);

                grid.innerHTML = '';

                if (yearsWithPapers.length === 0) {
                    // If Firestore hasn't finished loading yet, show a spinner briefly
                    grid.innerHTML = `
                        <div class="col-span-full text-center py-16" id="year-loading-msg">
                            <div class="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p class="text-slate-400 font-semibold text-sm">Loading available papers…</p>
                        </div>`;
                    // After 3s, if still empty, show the real empty state
                    setTimeout(() => {
                        if (document.getElementById('year-loading-msg') && publishedPapers.filter(p =>
                            p.grade === gradeStr && p.subject === state.subject &&
                            p.paperType === state.paperType && p.year
                        ).length === 0) {
                            grid.innerHTML = `
                                <div class="col-span-full text-center py-16">
                                    <div class="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4 text-4xl">📭</div>
                                    <h3 class="text-xl font-extrabold text-slate-700 mb-2">No Papers Available Yet</h3>
                                    <p class="text-slate-400 text-sm">No papers have been published for <strong>${state.subject}</strong> — ${state.paperType}.<br>Check back soon!</p>
                                </div>`;
                        } else {
                            renderYears(); // papers loaded in the meantime — re-render
                        }
                    }, 3000);
                    return;
                }

                yearsWithPapers.forEach(year => {
                    const count = publishedPapers.filter(p =>
                        p.grade === gradeStr && p.subject === state.subject &&
                        p.paperType === state.paperType && Number(p.year) === year
                    ).length;
                    grid.innerHTML += `
                        <div onclick="confirmYear(${year})"
                             class="hover-card p-8 rounded-3xl text-center cursor-pointer group border-2 border-transparent hover:border-blue-500">
                            <div class="text-3xl font-black text-blue-600 mb-2">${year}</div>
                            <h3 class="text-sm font-bold text-slate-500 uppercase mb-2">${state.paperType === 'School Term Papers' ? 'Term Tests' : 'Past Paper'}</h3>
                            <span class="text-[11px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-full">${count} paper${count !== 1 ? 's' : ''}</span>
                        </div>`;
                });
            }

            renderYears();
        }

        function confirmYear(year) {
            state.selectedYear = year;
            // School Term Papers & Provincial Papers → ask which term first
            if (state.paperType === 'School Term Papers' || state.paperType === 'Provincial Papers') {
                showTermSelection();
            } else {
                // For other paper types, go straight to the paper list
                showPaperList();
            }
        }

        // ── STEP: Term Selection (School Term Papers & Provincial Papers) ──
        function showTermSelection() {
            const grid    = document.getElementById('subjects-grid');
            const titleEl = document.querySelector('#view-subjects h2');
            const subtitle = document.getElementById('subject-meta-subtitle');
            titleEl.textContent  = "Select Term";
            subtitle.textContent = `${state.subject} — ${state.paperType} — ${state.selectedYear}`;
            grid.innerHTML = '';
            state.subView = 'terms';
            updateSubViewBackLabel();

            const terms = [
                { key: 'First Term',  label: 'First Term Test',  icon: '📝', color: 'blue',    num: '01' },
                { key: 'Second Term', label: 'Second Term Test', icon: '📋', color: 'emerald',  num: '02' },
                { key: 'Third Term',  label: 'Third Term Test',  icon: '📄', color: 'amber',    num: '03' },
            ];

            terms.forEach(t => {
                grid.innerHTML += `
                    <div onclick="selectTerm('${t.key}')"
                         class="hover-card p-8 rounded-3xl text-center cursor-pointer group border-2 border-transparent hover:border-${t.color}-500">
                        <div class="w-16 h-16 mx-auto rounded-2xl bg-${t.color}-50 text-${t.color}-600 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">${t.icon}</div>
                        <h3 class="text-lg font-bold text-slate-800">${t.label}</h3>
                        <p class="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-wide">${state.selectedYear} • Term ${t.num}</p>
                    </div>`;
            });
            navTo('subjects');
        }

        function selectTerm(termKey) {
            state.selectedTerm = termKey;
            showPaperList();
        }

        // ── STEP: Individual Paper List ──
        function showPaperList() {
            // Guard: need grade and subject at minimum
            if (!state.grade || !state.subject) { navTo('home'); return; }

            // Collect matching published papers
            const gradeStr = `Grade ${state.grade}`;
            const papers = publishedPapers.filter(p =>
                p.grade    === gradeStr          &&
                p.subject  === state.subject     &&
                p.paperType === state.paperType  &&
                String(p.year) === String(state.selectedYear) &&
                (state.selectedTerm ? p.term === state.selectedTerm : true)
            );

            const grid    = document.getElementById('subjects-grid');
            const titleEl = document.querySelector('#view-subjects h2');
            const subtitle = document.getElementById('subject-meta-subtitle');

            const termLabel = state.selectedTerm ? ` — ${state.selectedTerm} Test` : '';
            titleEl.textContent  = `Available Papers`;
            subtitle.textContent = `${state.subject} — ${state.paperType} — ${state.selectedYear}${termLabel}`;
            grid.innerHTML = '';
            state.subView = 'papers';
            updateSubViewBackLabel();

            if (papers.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-16">
                        <div class="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4 text-4xl">📭</div>
                        <h3 class="text-xl font-extrabold text-slate-700 mb-2">No Papers Available Yet</h3>
                        <p class="text-slate-400 text-sm">The admin hasn't published any papers for this selection.<br>Check back soon or try a different term/year.</p>
                    </div>`;
                navTo('subjects');
                return;
            }

            papers.forEach((p, idx) => {
                const subs = studentSubmissions.filter(s => s.paperId === p.id);
                const termColors = { 'First Term':'blue', 'Second Term':'emerald', 'Third Term':'amber' };
                const tc = termColors[p.term] || 'slate';
                grid.innerHTML += `
                    <div onclick="startPaperById('${p.id}')"
                         class="hover-card p-7 rounded-3xl cursor-pointer group border-2 border-transparent hover:border-blue-500 flex flex-col gap-3">
                        <div class="flex items-start justify-between gap-2">
                            <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-black group-hover:scale-110 transition-transform shrink-0">${idx + 1}</div>
                            ${p.term ? `<span class="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-${tc}-100 text-${tc}-700 tracking-wide">${p.term}</span>` : ''}
                        </div>
                        <div>
                            <h3 class="text-base font-extrabold text-slate-900 leading-snug">${p.paperName}</h3>
                            <p class="text-xs text-slate-400 font-semibold mt-1">${p.grade} • ${p.subject} • ${p.year || ''}</p>
                        </div>
                        <div class="flex items-center gap-3 mt-auto pt-2 border-t border-slate-100 flex-wrap">
                            <span class="text-xs font-bold text-slate-500">📝 ${p.questionCount} Questions</span>
                            <span class="text-xs font-bold text-purple-600">👥 ${subs.length} Attempts</span>
                        </div>
                        <div class="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl text-center group-hover:bg-blue-700 transition mt-1">
                            Start Paper →
                        </div>
                    </div>`;
            });
            navTo('subjects');
        }

        // ── Start a specific published paper by its ID ──
        async function startPaperById(paperId) {
            const paper = publishedPapers.find(p => p.id === paperId);
            if (!paper) { alert('Paper not found.'); return; }
            state.activePaperId = paperId;
            state.activePaperName = paper.paperName;
            
            // Mobile Optimization: Dynamically load precise questions for this paper instantly
            const hasQuestionsCached = QUIZ_DATA.some(q => q.paperId === paperId);
            if (!hasQuestionsCached) {
                try {
                    const titleEl = document.getElementById('quiz-title');
                    if (titleEl) titleEl.textContent = "Loading paper content...";
                    
                    const qSnap = await db.collection('questions').where('paperId', '==', paperId).get();
                    qSnap.forEach(doc => {
                        QUIZ_DATA.push({ ...doc.data(), _fromFirebase: true });
                    });
                } catch (e) {
                    console.warn('Failed to dynamically fetch paper questions', e);
                }
            }

            state.selectedTerm = paper.term || null;
            // Restore context for startQuiz navigation & question loading fallback
            state.grade = paper.grade ? paper.grade.replace('Grade ', '') : null;
            state.subject = paper.subject || null;
            state.paperType = paper.paperType || null;
            state.selectedYear = paper.year || null;
            state.stream = paper.stream || null;
            startQuiz();
        }

        function goBackFromQuiz() {
            clearInterval(state.timerInterval);
            if (confirm('Leave this paper? Your current progress will be lost.')) {
                showPaperList();
            }
        }

        function retryCurrentPaper() {
            if (state.activePaperId) {
                startPaperById(state.activePaperId);
            } else {
                startQuiz();
            }
        }

        // ============================================================
        //  QUIZ ENGINE
        // ============================================================
        function startQuiz() {
            const gradeStr = `Grade ${state.grade}`;

            if (state.activePaperId) {
                // Filter questions that belong to this specific paper (tagged with paperId)
                currentSessionQuestions = QUIZ_DATA.filter(q => q.paperId === state.activePaperId);
                // Fallback: match by grade+subject if paperId tags aren't set (pre-loaded sample data)
                if (currentSessionQuestions.length === 0) {
                    currentSessionQuestions = QUIZ_DATA.filter(q =>
                        q.grade === gradeStr && q.subject === state.subject
                    );
                }
            } else {
                currentSessionQuestions = QUIZ_DATA.filter(q =>
                    q.grade === gradeStr && q.subject === state.subject
                );
            }

            if (currentSessionQuestions.length === 0) {
                alert(`No questions available for Grade ${state.grade} — ${state.subject} yet.\nPlease try another subject, or add questions via Admin.`);
                navTo('home');
                return;
            }

            // Shuffle questions if the paper has shuffleQuestions enabled
            const _activePaperForShuffle = publishedPapers.find(p => p.id === state.activePaperId);
            if (_activePaperForShuffle && _activePaperForShuffle.shuffleQuestions) {
                currentSessionQuestions = [...currentSessionQuestions];
                for (let i = currentSessionQuestions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [currentSessionQuestions[i], currentSessionQuestions[j]] = [currentSessionQuestions[j], currentSessionQuestions[i]];
                }
            }

            state.currentIndex = 0;
            state.userAnswers  = new Array(currentSessionQuestions.length).fill(undefined);
            state.timer        = 0;
            clearInterval(state.timerInterval);

            // Reset search bar for new quiz session
            if (typeof resetQuizSearchBar === 'function') resetQuizSearchBar();

            // Update quiz header meta
            const termLabel = state.selectedTerm ? ` • ${state.selectedTerm} Test` : '';
            const metaStr = state.stream
                ? `Grade ${state.grade} • ${state.stream} • ${state.subject} • ${state.paperType} • ${state.selectedYear}${termLabel}`
                : `Grade ${state.grade} • ${state.subject} • ${state.paperType} • ${state.selectedYear}${termLabel}`;
            const quizTitle = document.getElementById('quiz-title');
            const quizMeta  = document.getElementById('quiz-meta');
            if (quizTitle) quizTitle.textContent = state.activePaperName || (state.subject + ' Paper');
            if (quizMeta)  quizMeta.textContent  = metaStr;

            // Detect time limit from active paper
            const activePaper = publishedPapers.find(p => p.id === state.activePaperId);
            const timeLimitMins = activePaper && activePaper.timeLimit ? parseInt(activePaper.timeLimit) : null;
            state.timeLimit = timeLimitMins ? timeLimitMins * 60 : null;
            state.countdownRemaining = state.timeLimit || null;

            // Update timer display style
            const timerWrap = document.querySelector('#view-quiz .bg-slate-50.px-6');
            if (timerWrap) {
                timerWrap.classList.toggle('border-red-300', !!timeLimitMins);
                timerWrap.classList.toggle('bg-red-50', !!timeLimitMins);
            }
            // Show time limit badge if applicable
            let timeBadgeEl = document.getElementById('quiz-time-badge');
            if (!timeBadgeEl) {
                timeBadgeEl = document.createElement('span');
                timeBadgeEl.id = 'quiz-time-badge';
                timeBadgeEl.className = 'text-[10px] font-black uppercase px-2 py-1 rounded-full bg-orange-100 text-orange-700 ml-2';
                const quizMetaEl = document.getElementById('quiz-meta');
                if (quizMetaEl && quizMetaEl.parentNode) quizMetaEl.parentNode.appendChild(timeBadgeEl);
            }
            timeBadgeEl.textContent = timeLimitMins ? `⏱ ${timeLimitMins}min limit` : '';
            timeBadgeEl.classList.toggle('hidden', !timeLimitMins);

            state.timerInterval = setInterval(() => {
                state.timer++;
                let displaySecs, isCountdown = false;
                if (state.countdownRemaining !== null) {
                    state.countdownRemaining--;
                    displaySecs = state.countdownRemaining;
                    isCountdown = true;
                } else {
                    displaySecs = state.timer;
                }
                const m = Math.floor(displaySecs / 60);
                const s = displaySecs % 60;
                const timerEl = document.getElementById('timer');
                if (timerEl) {
                    timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                    // Pulse red when under 60 seconds remaining
                    if (isCountdown && displaySecs <= 60) {
                        timerEl.classList.add('text-red-600');
                    } else if (!isCountdown) {
                        timerEl.classList.remove('text-red-600');
                    }
                }
                // Auto-submit when countdown hits 0
                if (isCountdown && state.countdownRemaining <= 0) {
                    clearInterval(state.timerInterval);
                    alert('⏱ Time is up! Your answers have been submitted automatically.');
                    finishQuiz();
                }
            }, 1000);

            navTo('quiz');
            renderQuestion();
        }

        // ── Clean up raw RTE / copy-pasted HTML for safe display ──
        function sanitizeQuestionHTML(raw) {
            if (!raw) return '';
            // Parse into a temporary container
            const tmp = document.createElement('div');
            tmp.innerHTML = raw;

            // Remove Angular / data-path attributes, citation spans, superscript footnotes, bis_skin_checked
            tmp.querySelectorAll('[data-path-to-node], [bis_skin_checked], source-footnote, sup.superscript').forEach(el => {
                // Keep sup text if it has visible content, otherwise remove
                if (el.tagName === 'SUP' && !el.textContent.trim()) el.remove();
                else el.replaceWith(...el.childNodes);
            });

            // Remove empty citation spans (citation-NNN)
            tmp.querySelectorAll('span[class*="citation"]').forEach(el => {
                el.replaceWith(...el.childNodes);
            });

            // Collapse redundant nested bold/spans produced by the RTE
            // Flatten <span><b><span>text</span></b></span> → <b>text</b>
            tmp.querySelectorAll('span > b, b > span').forEach(el => {
                el.replaceWith(...el.childNodes);
            });

            // Strip inline styles that fight our question-text styling
            tmp.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));

            // Remove &nbsp; sequences used just for indentation at the start
            let html = tmp.innerHTML;
            html = html.replace(/^(\s*&nbsp;\s*)+/, '');

            return html;
        }

        function renderQuestion() {
            const q       = currentSessionQuestions[state.currentIndex];
            const total   = currentSessionQuestions.length;
            const nextBtn = document.getElementById('next-btn');
            const prevBtn = document.getElementById('prev-btn');

            document.getElementById('q-counter').textContent   = `Question ${state.currentIndex + 1} of ${total}`;
            document.getElementById('question-text').innerHTML = sanitizeQuestionHTML(q.q);
            document.getElementById('progress-fill').style.width = `${((state.currentIndex + 1) / total) * 100}%`;

            // Show/hide question image
            const imgWrap = document.getElementById('question-image-wrap');
            const imgEl   = document.getElementById('question-image');
            if (q.img) {
                imgEl.src = q.img;
                imgWrap.classList.remove('hidden');
            } else {
                imgWrap.classList.add('hidden');
                imgEl.src = '';
            }

            prevBtn.classList.toggle('hidden', state.currentIndex === 0);
            nextBtn.textContent = (state.currentIndex === total - 1) ? "Submit Final Paper" : "Next Question";
            nextBtn.disabled    = (state.userAnswers[state.currentIndex] === undefined);

            const container = document.getElementById('options-container');
            container.innerHTML = '';

            q.a.forEach((opt, i) => {
                const btn = document.createElement('button');
                const isSelected = state.userAnswers[state.currentIndex] === i;
                btn.className = `option-btn w-full p-5 rounded-2xl text-left font-bold text-slate-700 bg-white flex items-center gap-4 hover:bg-slate-50 cursor-pointer ${isSelected ? 'selected' : ''}`;
                btn.innerHTML = `
                    <div class="w-10 h-10 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center text-sm text-slate-400 font-black">${String.fromCharCode(65+i)}</div>
                    <span class="leading-snug">${opt}</span>`;
                btn.onclick = () => {
                    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    state.userAnswers[state.currentIndex] = i;
                    nextBtn.disabled = false;
                };
                container.appendChild(btn);
            });

            // Render any math formulas in the question + options
            const quizBox = document.querySelector('#view-quiz .bg-white.p-8');
            if (quizBox) renderMathIn(quizBox);
        }

        function nextQuestion() {
            if (state.currentIndex < currentSessionQuestions.length - 1) {
                state.currentIndex++;
                renderQuestion();
            } else {
                finishQuiz();
            }
        }

        function prevQuestion() {
            if (state.currentIndex > 0) {
                state.currentIndex--;
                renderQuestion();
            }
        }

        function finishQuiz() {
            clearInterval(state.timerInterval);
            navTo('results');

            let correctCount = 0;
            const list = document.getElementById('mistake-list');
            list.innerHTML = '';

            currentSessionQuestions.forEach((q, i) => {
                const isCorrect = state.userAnswers[i] === q.c;
                if (isCorrect) correctCount++;
                const item = document.createElement('div');
                item.className = `bg-white p-6 rounded-2xl border border-slate-100 border-l-8 ${isCorrect ? 'border-l-emerald-500' : 'border-l-red-500'} shadow-sm`;
                item.innerHTML = `
                    <div class="flex justify-between items-start mb-4">
                        <p class="font-bold text-slate-800 text-lg">${i+1}. ${sanitizeQuestionHTML(q.q)}</p>
                        <span class="text-[10px] font-black uppercase px-3 py-1 rounded-full ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${isCorrect ? 'Correct' : 'Incorrect'}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div class="text-sm p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <span class="font-black text-slate-400 text-[10px] uppercase block mb-1">Your Answer</span>
                            ${q.a[state.userAnswers[i]] !== undefined ? q.a[state.userAnswers[i]] : '<span class="text-slate-400 italic">No answer selected</span>'}
                        </div>
                        <div class="text-sm p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
                            <span class="font-black text-emerald-400 text-[10px] uppercase block mb-1">Correct Answer</span>
                            ${q.a[q.c]}
                        </div>
                    </div>
                    <div class="mt-4 p-4 bg-blue-50 rounded-xl text-sm text-blue-900 border border-blue-100 flex gap-3 items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" class="shrink-0 mt-0.5 text-blue-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        <p><span class="font-bold">Explanation:</span> ${q.e}</p>
                    </div>`;
                list.appendChild(item);
            });

            // Render math in the results section
            renderMathIn(document.getElementById('view-results'));

            const percentage = Math.round((correctCount / currentSessionQuestions.length) * 100);
            document.getElementById('res-score').textContent   = `${percentage}%`;
            document.getElementById('res-correct').textContent = `${correctCount}/${currentSessionQuestions.length}`;

            const termLabel = state.selectedTerm ? ` • ${state.selectedTerm}` : '';
            const yearLabel = state.selectedYear ? ` • ${state.selectedYear}` : '';
            const metaStr = state.stream
                ? `Grade ${state.grade} • ${state.stream} • ${state.subject} • ${state.paperType}${termLabel}${yearLabel}`
                : `Grade ${state.grade} • ${state.subject} • ${state.paperType}${termLabel}${yearLabel}`;
            document.getElementById('res-paper-info').textContent = (state.activePaperName ? state.activePaperName + '  —  ' : '') + metaStr;

            const m = Math.floor(state.timer / 60);
            const s = state.timer % 60;
            document.getElementById('res-time').textContent = `${m}:${String(s).padStart(2,'0')}`;

            let rank = "F", rankColor = "text-red-500";
            if (percentage >= 75)      { rank = "A"; rankColor = "text-emerald-500"; }
            else if (percentage >= 65) { rank = "B"; rankColor = "text-blue-500"; }
            else if (percentage >= 50) { rank = "C"; rankColor = "text-amber-500"; }
            else if (percentage >= 35) { rank = "S"; rankColor = "text-orange-500"; }
            const rankEl = document.getElementById('res-rank');
            rankEl.textContent = rank;
            rankEl.className   = `text-4xl font-black ${rankColor}`;

            // Record this submission locally
            const paperKey = state.activePaperId || `${state.grade}|${state.subject}|${state.paperType}|${state.selectedYear}`;
            const submission = {
                paperId:    paperKey,
                paperName:  state.activePaperName || state.subject + ' Paper',
                grade:      state.grade,
                subject:    state.subject,
                paperType:  state.paperType,
                term:       state.selectedTerm,
                year:       state.selectedYear,
                score:      percentage,
                correct:    correctCount,
                total:      currentSessionQuestions.length,
                timeSecs:   state.timer,
                rank:       rank,
                submittedAt: new Date()
            };
            if (currentStudent) {
                submission.studentId    = currentStudent.uid;
                submission.studentName  = currentStudent.name;
                submission.studentEmail = currentStudent.email;
                submission.studentGrade = currentStudent.grade;
                submission.studentSchool= currentStudent.school;
            }
            studentSubmissions.push(submission);

            // Save to Firebase Firestore (non-blocking)
            if (currentStudent) {
                db.collection('submissions').add({
                    ...submission,
                    submittedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(e => console.warn('Submission save failed:', e.message));
            }

            // Refresh paper list attempt counts if visible
            if (!document.getElementById('view-subjects').classList.contains('hidden')) {
                showPaperList();
            }
            // Keep admin stats live if admin panel is open
            const attemptsEl = document.getElementById('admin-total-attempts');
            if (attemptsEl) attemptsEl.textContent = studentSubmissions.length;
        }

        // ============================================================
        //  MODAL
        // ============================================================
        function openModal(mode = 'login') {
            switchModalMode(mode);
            document.getElementById('auth-modal').classList.remove('hidden');
        }
        function closeModal() {
            document.getElementById('auth-modal').classList.add('hidden');
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
                document.getElementById('form-login').classList.remove('hidden');
                icon.className = "w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold mx-auto mb-4";
                icon.innerHTML = "S";
                title.textContent = "Student Login";
                if (subtitle) subtitle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> 256-bit Encrypted Connection';
            } else if (mode === 'register') {
                document.getElementById('form-register').classList.remove('hidden');
                icon.className = "w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold mx-auto mb-4";
                icon.innerHTML = "+";
                title.textContent = "Create Account";
                if (subtitle) subtitle.textContent = "Join 10,000+ students on Sahasra";
            } else if (mode === 'admin') {
                document.getElementById('form-admin').classList.remove('hidden');
                icon.className = "w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-amber-400 font-bold mx-auto mb-4";
                icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
                title.textContent = "Admin Secure Access";
                if (subtitle) subtitle.textContent = "Authorised personnel only";
            }
        }

        // ============================================================
        //  ADMIN WIZARD
        // ============================================================



        function wizUpdateStream() {
            const grade = document.getElementById('wiz-grade').value;
            const wrap  = document.getElementById('wiz-stream-wrap');
            wrap.classList.toggle('hidden', !(grade === 'Grade 12' || grade === 'Grade 13'));
        }

        function wizUpdateSubject() {
            const grade   = document.getElementById('wiz-grade').value;
            const sel     = document.getElementById('wiz-subject');
            const gradeNum = grade.replace('Grade ', '');
            let key = gradeNum;

            if (grade === 'Grade 12' || grade === 'Grade 13') {
                key = document.getElementById('wiz-stream').value;
            }

            const subjects = SUBJECTS_BY_LEVEL[key] || SUBJECTS_BY_LEVEL[gradeNum] || [];
            sel.innerHTML = subjects.length
                ? subjects.map(s => `<option value="${s}">${s}</option>`).join('')
                : '<option value="">— No subjects found —</option>';
        }

        function wizToggleTerm() {
            const type = document.getElementById('wiz-paper-type').value;
            const isRequired = (type === 'School Term Papers' || type === 'Provincial Papers');
            const star   = document.getElementById('wiz-term-required-star');
            const badge  = document.getElementById('wiz-term-optional-badge');
            if (star)  star.classList.toggle('hidden', !isRequired);
            if (badge) badge.classList.toggle('hidden', isRequired);
        }

        function wizGoStep(n) {
            for (let i = 1; i <= 4; i++) {
                document.getElementById(`wiz-step-${i}`).classList.toggle('hidden', i !== n);
                const bar = document.getElementById(`wiz-bar-${i}`);
                bar.classList.toggle('bg-blue-600', i <= n);
                bar.classList.toggle('bg-emerald-500', i < n);
                bar.classList.toggle('bg-slate-200', i > n);
            }
            document.getElementById('wiz-step-label').textContent = `Step ${n} of 4`;
            wizState.step = n;
        }

        function wizStep1Next() {
            const grade     = document.getElementById('wiz-grade').value;
            const subject   = document.getElementById('wiz-subject').value;
            const paperType = document.getElementById('wiz-paper-type').value;
            const year      = document.getElementById('wiz-year').value;
            const paperName = document.getElementById('wiz-paper-name').value.trim();

            if (!grade || !subject || !paperType || !year || !paperName) {
                alert('Please fill in all required fields before continuing.');
                return;
            }

            // Term (required only for School Term Papers and Provincial Papers)
            let term = null;
            if (paperType === 'School Term Papers' || paperType === 'Provincial Papers') {
                const termEl = document.querySelector('input[name="wiz-term"]:checked');
                if (!termEl) { alert('Please select a Term (1st, 2nd, or 3rd).'); return; }
                term = termEl.value;
            }

            const stream = (grade === 'Grade 12' || grade === 'Grade 13')
                ? document.getElementById('wiz-stream').value : null;

            const timeLimitVal = parseInt(document.getElementById('wiz-time-limit').value) || null;
            const timeLimit = timeLimitVal && timeLimitVal > 0 ? timeLimitVal : null;
            const shuffleEl = document.querySelector('input[name="wiz-shuffle"]:checked');
            const shuffleQuestions = shuffleEl ? shuffleEl.value === 'random' : false;
            wizState.paperMeta = { grade, stream, subject, paperType, year, term, paperName, timeLimit, shuffleQuestions };
            wizState.questions = [];

            // Update step 2 context label
            const ctx = [grade, stream, subject, paperType, year, term].filter(Boolean).join(' • ');
            document.getElementById('wiz-paper-context').textContent = ctx;
            document.getElementById('wiz-q-count').textContent = '0';
            document.getElementById('wiz-q-list').innerHTML = '';

            wizGoStep(2);
        }

        // ── Image upload handler ──
        function wizHandleImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) { alert('Image too large — max 2 MB.'); event.target.value = ''; return; }
            const reader = new FileReader();
            reader.onload = e => {
                event.target._b64 = e.target.result; // store base64 on the input element
                const preview = document.getElementById('wiz-img-preview');
                const dropZone = document.getElementById('wiz-img-drop-zone');
                preview.src = e.target.result;
                preview.classList.remove('hidden');
                dropZone.classList.add('hidden');
                document.getElementById('wiz-img-clear-btn').classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }

        function wizClearImage() {
            const inp = document.getElementById('wiz-img-input');
            inp._b64 = null;
            inp.value = '';
            document.getElementById('wiz-img-preview').classList.add('hidden');
            document.getElementById('wiz-img-preview').src = '';
            document.getElementById('wiz-img-drop-zone').classList.remove('hidden');
            document.getElementById('wiz-img-clear-btn').classList.add('hidden');
        }

        function wizToggleOptionE() {
            const wrap = document.getElementById('wiz-opt-e-wrap');
            const btn  = document.getElementById('wiz-toggle-e-btn');
            const sel  = document.getElementById('wiz-correct');
            const isHidden = wrap.classList.contains('hidden');
            if (isHidden) {
                wrap.classList.remove('hidden');
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Remove Option E`;
                btn.classList.replace('text-purple-600','text-red-500');
                btn.classList.replace('bg-purple-50','bg-red-50');
                btn.classList.replace('border-purple-200','border-red-200');
                // Add Option E to correct answer dropdown
                if (!sel.querySelector('option[value="4"]')) {
                    const opt = document.createElement('option');
                    opt.value = '4'; opt.textContent = '✅ Option E';
                    sel.appendChild(opt);
                }
            } else {
                wrap.classList.add('hidden');
                document.getElementById('wiz-opt-4').value = '';
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Add Option E`;
                btn.classList.replace('text-red-500','text-purple-600');
                btn.classList.replace('bg-red-50','bg-purple-50');
                btn.classList.replace('border-red-200','border-purple-200');
                // Remove Option E from dropdown
                const optE = sel.querySelector('option[value="4"]');
                if (optE) sel.removeChild(optE);
                if (sel.value === '4') sel.value = '0';
            }
        }

        function wizAddQuestion() {
            const qEl   = document.getElementById('wiz-q-text');
            const qText = qEl.innerHTML.trim().replace(/^<br>|<br>$/gi,'').trim();
            const opts  = [0,1,2,3].map(i => document.getElementById(`wiz-opt-${i}`).value.trim());
            const correct = parseInt(document.getElementById('wiz-correct').value);
            const expl  = document.getElementById('wiz-explanation').value.trim();

            // Include Option E if visible and filled
            const optEWrap = document.getElementById('wiz-opt-e-wrap');
            const optEVal  = document.getElementById('wiz-opt-4').value.trim();
            if (!optEWrap.classList.contains('hidden') && optEVal) {
                opts.push(optEVal);
            }

            if (!qText)               { alert('Please enter the question text.'); return; }
            if (!opts[0] || !opts[1]) { alert('Please fill in at least Option A and Option B.'); return; }

            // Grab image (base64) if uploaded
            const imgData = document.getElementById('wiz-img-input')._b64 || null;

            const q = {
                grade:   wizState.paperMeta.grade,
                stream:  wizState.paperMeta.stream,
                subject: wizState.paperMeta.subject,
                paperType: wizState.paperMeta.paperType,
                year:    wizState.paperMeta.year,
                term:    wizState.paperMeta.term,
                paperName: wizState.paperMeta.paperName,
                q: qText,
                a: opts,
                c: correct,
                e: expl || 'No explanation provided.',
                img: imgData || null
            };

            wizState.questions.push(q);

            // Update counter
            document.getElementById('wiz-q-count').textContent = wizState.questions.length;

            // Append to mini-list
            const list = document.getElementById('wiz-q-list');
            const item = document.createElement('div');
            const correctLetter = String.fromCharCode(65 + correct);
            item.className = 'flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4';
            item.innerHTML = `
                <span class="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">${wizState.questions.length}</span>
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-slate-800 text-sm line-clamp-2 sinhala-text">${qText}</p>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p class="text-xs text-emerald-600 font-bold">Answer: ${correctLetter} — ${opts[correct]}</p>
                        ${opts.length === 5 ? '<span class="text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">5 opts</span>' : ''}
                        ${imgData ? '<span class="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">📷 img</span>' : ''}
                    </div>
                </div>
                <button onclick="wizRemoveQuestion(${wizState.questions.length - 1})" class="text-slate-300 hover:text-red-500 transition shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>`;
            list.appendChild(item);

            // Clear form for next question
            document.getElementById('wiz-q-text').innerHTML = '';
            [0,1,2,3].forEach(i => document.getElementById(`wiz-opt-${i}`).value = '');
            document.getElementById('wiz-opt-4').value = '';
            document.getElementById('wiz-explanation').value = '';
            document.getElementById('wiz-correct').value = '0';
            wizClearImage();
            // Reset Option E state
            const eWrap = document.getElementById('wiz-opt-e-wrap');
            const eBtn  = document.getElementById('wiz-toggle-e-btn');
            if (!eWrap.classList.contains('hidden')) {
                eWrap.classList.add('hidden');
                eBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Add Option E`;
                eBtn.classList.replace('text-red-500','text-purple-600');
                eBtn.classList.replace('bg-red-50','bg-purple-50');
                eBtn.classList.replace('border-red-200','border-purple-200');
                const sel = document.getElementById('wiz-correct');
                const optE = sel.querySelector('option[value="4"]');
                if (optE) sel.removeChild(optE);
            }
            document.getElementById('wiz-q-text').focus();
        }

        function wizRemoveQuestion(idx) {
            wizState.questions.splice(idx, 1);
            document.getElementById('wiz-q-count').textContent = wizState.questions.length;
            // Re-render list
            const list = document.getElementById('wiz-q-list');
            list.innerHTML = '';
            wizState.questions.forEach((q, i) => {
                const cl = String.fromCharCode(65 + q.c);
                const item = document.createElement('div');
                item.className = 'flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4';
                item.innerHTML = `
                    <span class="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">${i+1}</span>
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-slate-800 text-sm truncate">${q.q}</p>
                        <p class="text-xs text-emerald-600 font-bold mt-0.5">Answer: ${cl} — ${q.a[q.c]}</p>
                    </div>
                    <button onclick="wizRemoveQuestion(${i})" class="text-slate-300 hover:text-red-500 transition shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>`;
                list.appendChild(item);
            });
        }

        function wizStep2Next() {
            if (wizState.questions.length === 0) {
                alert('Please add at least one question before continuing.');
                return;
            }
            wizBuildReview();
            wizGoStep(3);
        }

        function wizBuildReview() {
            const m   = wizState.paperMeta;
            const qs  = wizState.questions;
            const rev = document.getElementById('wiz-review-content');

            const metaRow = (label, val) => val
                ? `<div class="flex justify-between text-sm py-2 border-b border-slate-100"><span class="font-bold text-slate-500">${label}</span><span class="font-bold text-slate-800">${val}</span></div>`
                : '';

            rev.innerHTML = `
                <div class="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-4">
                    <h5 class="font-extrabold text-blue-900 mb-3 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Paper Information
                    </h5>
                    ${metaRow('Paper Name', m.paperName)}
                    ${metaRow('Grade', m.grade)}
                    ${metaRow('Stream', m.stream)}
                    ${metaRow('Subject', m.subject)}
                    ${metaRow('Paper Type', m.paperType)}
                    ${metaRow('Year', m.year)}
                    ${metaRow('Term', m.term)}
                    ${metaRow('Time Limit', m.timeLimit ? m.timeLimit + ' minutes' : 'No limit')}
                    ${metaRow('Question Order', m.shuffleQuestions ? '🔀 Random Shuffle' : '📋 Fixed Order (as added)')}
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <h5 class="font-extrabold text-slate-800 mb-3 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        ${qs.length} Question${qs.length !== 1 ? 's' : ''} Ready to Publish
                    </h5>
                    <div class="space-y-2 max-h-56 overflow-y-auto">
                        ${qs.map((q,i) => `
                            <div class="flex items-start gap-3 bg-white rounded-xl p-3 border border-slate-100">
                                <span class="w-6 h-6 rounded bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">${i+1}</span>
                                <div>
                                    <p class="text-sm font-semibold text-slate-800">${q.q}</p>
                                    <p class="text-xs text-emerald-600 font-bold mt-0.5">✅ ${String.fromCharCode(65+q.c)}: ${q.a[q.c]}</p>
                                </div>
                            </div>`).join('')}
                    </div>
                </div>`;
        }

        async function wizPublish() {
            const m  = wizState.paperMeta;
            const qs = wizState.questions;
            const publishBtn = document.querySelector('#wiz-step-3 button[onclick="wizPublish()"]');
            if (publishBtn) { publishBtn.textContent = 'Publishing...'; publishBtn.disabled = true; }

            try {
                // Save paper doc to Firestore
                const paperRef = db.collection('papers').doc();
                const paperId  = paperRef.id;
                await paperRef.set({
                    ...m,
                    id: paperId,
                    questionCount: qs.length,
                    timeLimit: m.timeLimit || null,
                    publishedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Save each question as a separate Firestore document (batch for speed)
                const batch = db.batch();
                qs.forEach(q => {
                    const qRef = db.collection('questions').doc();
                    batch.set(qRef, { ...q, paperId, _fromFirebase: true });
                });
                await batch.commit();

                // Update local state
                QUIZ_DATA.push(...qs.map(q => ({ ...q, paperId, _fromFirebase: true })));
                publishedPapers.unshift({ ...m, id: paperId, questionCount: qs.length, publishedAt: new Date() });

                // Update stats
                document.getElementById('admin-total-q').textContent        = QUIZ_DATA.length;
                document.getElementById('admin-total-papers').textContent   = publishedPapers.length;
                document.getElementById('published-count').textContent      = publishedPapers.length;
                document.getElementById('admin-total-attempts').textContent = studentSubmissions.length;
                renderPublishedPapers();

                document.getElementById('wiz-success-msg').textContent =
                    `"${m.paperName}" (${qs.length} questions) saved to Firebase and published. Students can access it immediately.`;
                wizGoStep(4);
            } catch(e) {
                alert('Failed to publish: ' + e.message + '\nCheck your internet connection and try again.');
            }
            if (publishBtn) { publishBtn.textContent = 'Publish Paper to Database'; publishBtn.disabled = false; }
        }

        function renderPublishedPapers() {
            const list = document.getElementById('published-papers-list');
            if (!list) return;

            if (publishedPapers.length === 0) {
                list.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">No papers published yet.</p>';
                return;
            }

            // Group papers: term-based papers grouped under their term, others under "Other"
            const termOrder = ['First Term', 'Second Term', 'Third Term', '__other__'];
            const groups = {};
            publishedPapers.slice().reverse().forEach(p => {
                const key = (p.term && p.term.trim()) ? p.term : '__other__';
                if (!groups[key]) groups[key] = [];
                groups[key].push(p);
            });

            const termLabels = {
                'First Term':  { label: '1st Term Papers',  color: 'blue',    icon: '📝' },
                'Second Term': { label: '2nd Term Papers',  color: 'emerald',  icon: '📋' },
                'Third Term':  { label: '3rd Term Papers',  color: 'amber',    icon: '📄' },
                '__other__':   { label: 'Other Papers',     color: 'slate',    icon: '📁' },
            };

            let html = '';
            termOrder.forEach(termKey => {
                const papers = groups[termKey];
                if (!papers || papers.length === 0) return;
                const meta = termLabels[termKey] || termLabels['__other__'];
                html += `
                <div class="px-4 pt-3 pb-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-base">${meta.icon}</span>
                        <span class="text-[11px] font-extrabold uppercase tracking-widest text-${meta.color}-700">${meta.label}</span>
                        <span class="ml-auto text-[10px] font-bold bg-${meta.color}-100 text-${meta.color}-700 px-2 py-0.5 rounded-full">${papers.length}</span>
                    </div>
                </div>`;
                papers.forEach(p => {
                    const subs = studentSubmissions.filter(s => s.paperId === p.id);
                    const avgScore = subs.length ? Math.round(subs.reduce((a,b) => a + b.score, 0) / subs.length) : null;
                    const termColors = { 'First Term':'blue', 'Second Term':'emerald', 'Third Term':'amber' };
                    const tc = p.term ? (termColors[p.term] || 'slate') : null;
                    html += `
                    <div class="px-5 py-3 hover:bg-slate-50 transition border-b border-slate-100 last:border-0">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                                <p class="font-bold text-slate-800 text-sm truncate">${p.paperName}</p>
                                <div class="flex items-center gap-2 mt-1 flex-wrap">
                                    <span class="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">${p.grade}</span>
                                    <span class="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">${p.subject}</span>
                                    <span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${p.questionCount} Qs</span>
                                    ${p.shuffleQuestions ? `<span class="text-[10px] font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">🔀 Shuffle</span>` : `<span class="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">📋 Fixed</span>`}
                                    ${p.year ? `<span class="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">${p.year}</span>` : ''}
                                    <span class="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">👥 ${subs.length} done</span>
                                    ${avgScore !== null ? `<span class="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">avg ${avgScore}%</span>` : ''}
                                </div>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <button onclick="editPaper('${p.id}')" title="Edit Quiz"
                                    class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button onclick="viewPaperResults('${p.id}')" title="View Results"
                                    class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                </button>
                                <button onclick="deletePaper('${p.id}')" title="Delete Paper"
                                    class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>`;
                });
            });
            list.innerHTML = html;
        }

        // ============================================================
        //  EDIT QUIZ (Admin)
        // ============================================================
        let editState = { paperId: null, questions: [], firestoreDocIds: {} };

        async function editPaper(paperId) {
            const paper = publishedPapers.find(p => p.id === paperId);
            if (!paper) return;

            // Reset state
            editState = { paperId, questions: [], firestoreDocIds: {} };

            // Populate paper details
            document.getElementById('edit-modal-title').textContent = paper.paperName;
            document.getElementById('edit-paper-name').value = paper.paperName || '';
            document.getElementById('edit-time-limit').value = paper.timeLimit || '';
            document.getElementById('edit-q-count-badge').textContent = '…';

            // Show loading state
            document.getElementById('edit-questions-loading').classList.remove('hidden');
            document.getElementById('edit-questions-list').classList.add('hidden');
            document.getElementById('edit-quiz-modal').classList.remove('hidden');
            document.getElementById('edit-quiz-modal').classList.add('flex');

            // Load questions from Firestore
            try {
                const snap = await db.collection('questions').where('paperId', '==', paperId).get();
                snap.forEach(doc => {
                    const d = doc.data();
                    editState.questions.push({ ...d, _docId: doc.id });
                    editState.firestoreDocIds[doc.id] = true;
                });
                // Fallback to local QUIZ_DATA if Firestore returned nothing
                if (editState.questions.length === 0) {
                    editState.questions = QUIZ_DATA
                        .filter(q => q.paperId === paperId)
                        .map((q, i) => ({ ...q, _docId: q._docId || null }));
                }
            } catch (e) {
                editState.questions = QUIZ_DATA
                    .filter(q => q.paperId === paperId)
                    .map(q => ({ ...q }));
            }

            document.getElementById('edit-q-count-badge').textContent = editState.questions.length + ' questions';
            document.getElementById('edit-questions-loading').classList.add('hidden');
            document.getElementById('edit-questions-list').classList.remove('hidden');
            renderEditQuestions();
        }

        function renderEditQuestions() {
            const list = document.getElementById('edit-questions-list');
            const optLabels = ['A','B','C','D','E'];
            const optColors = ['blue','emerald','amber','rose','purple'];

            list.innerHTML = editState.questions.map((q, qi) => {
                const opts = (q.a || []);
                return `
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3" id="edit-q-block-${qi}">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="w-6 h-6 rounded-lg bg-slate-700 text-white text-xs font-black flex items-center justify-center shrink-0">${qi+1}</span>
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">Question ${qi+1}</span>
                        <button onclick="editDeleteQuestion(${qi})" class="ml-auto text-xs font-bold text-red-400 hover:text-red-600 flex items-center gap-1 transition px-2 py-1 rounded-lg hover:bg-red-50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg> Remove
                        </button>
                    </div>
                    <div>
                        <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Question Text</label>
                        <div contenteditable="true" id="edit-q-text-${qi}"
                             class="sinhala-text w-full min-h-[60px] px-3 py-2.5 bg-white border-2 border-slate-200 focus:border-blue-400 rounded-xl outline-none font-medium text-slate-800 text-sm"
                             style="line-height:1.6;">${q.q || ''}</div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${opts.map((opt, oi) => `
                        <div class="relative">
                            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-${optColors[oi]||'slate'}-100 text-${optColors[oi]||'slate'}-700 text-[10px] font-black flex items-center justify-center">${optLabels[oi]||oi}</span>
                            <input type="text" value="${opt.replace(/"/g,'&quot;')}" id="edit-opt-${qi}-${oi}"
                                   class="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-slate-200 focus:border-blue-400 outline-none font-medium text-sm">
                        </div>`).join('')}
                    </div>
                    <div>
                        <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Correct Answer</label>
                        <select id="edit-correct-${qi}" class="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-emerald-400 outline-none font-bold text-emerald-700 text-sm">
                            ${opts.map((opt, oi) => `<option value="${oi}" ${q.c === oi ? 'selected' : ''}>✅ Option ${optLabels[oi]}: ${opt.substring(0,40)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Explanation</label>
                        <input type="text" id="edit-expl-${qi}" value="${(q.e||'').replace(/"/g,'&quot;')}" placeholder="Why is this the correct answer?"
                               class="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-blue-400 outline-none font-medium text-sm">
                    </div>
                </div>`;
            }).join('');
        }

        function editDeleteQuestion(qi) {
            if (!confirm(`Remove Question ${qi+1}? This will be deleted when you save.`)) return;
            editState.questions.splice(qi, 1);
            document.getElementById('edit-q-count-badge').textContent = editState.questions.length + ' questions';
            renderEditQuestions();
        }

        function closeEditModal() {
            document.getElementById('edit-quiz-modal').classList.add('hidden');
            document.getElementById('edit-quiz-modal').classList.remove('flex');
        }

        async function saveEditedQuiz() {
            const saveBtn = document.getElementById('edit-save-btn');
            const paperId = editState.paperId;
            const paper   = publishedPapers.find(p => p.id === paperId);
            if (!paper) return;

            const newName      = document.getElementById('edit-paper-name').value.trim();
            const newTimeLimit = parseInt(document.getElementById('edit-time-limit').value) || null;

            if (!newName) { alert('Paper name cannot be empty.'); return; }

            // Collect edited question data from DOM
            const updatedQuestions = editState.questions.map((q, qi) => {
                const qTextEl = document.getElementById(`edit-q-text-${qi}`);
                const qText   = qTextEl ? qTextEl.innerHTML.trim() : q.q;
                const opts    = (q.a || []).map((_, oi) => {
                    const el = document.getElementById(`edit-opt-${qi}-${oi}`);
                    return el ? el.value.trim() : _;
                });
                const correct = parseInt(document.getElementById(`edit-correct-${qi}`)?.value ?? q.c);
                const expl    = document.getElementById(`edit-expl-${qi}`)?.value.trim() || q.e || '';
                return { ...q, q: qText, a: opts, c: correct, e: expl };
            });

            saveBtn.textContent = 'Saving…';
            saveBtn.disabled = true;

            try {
                // 1. Update paper document
                await db.collection('papers').doc(paperId).update({
                    paperName: newName,
                    timeLimit: newTimeLimit,
                    questionCount: updatedQuestions.length
                });

                // 2. Delete all old questions, re-write updated ones (batch)
                const oldSnap = await db.collection('questions').where('paperId','==',paperId).get();
                const batch = db.batch();
                oldSnap.forEach(doc => batch.delete(doc.ref));
                updatedQuestions.forEach(q => {
                    const ref = db.collection('questions').doc();
                    const { _docId, ...qClean } = q;
                    batch.set(ref, { ...qClean, paperId, _fromFirebase: true });
                });
                await batch.commit();

                // 3. Update local state
                paper.paperName    = newName;
                paper.timeLimit    = newTimeLimit;
                paper.questionCount = updatedQuestions.length;
                // Update QUIZ_DATA
                for (let i = QUIZ_DATA.length - 1; i >= 0; i--) {
                    if (QUIZ_DATA[i].paperId === paperId) QUIZ_DATA.splice(i, 1);
                }
                updatedQuestions.forEach(q => QUIZ_DATA.push({ ...q, paperId, _fromFirebase: true }));

                renderPublishedPapers();
                closeEditModal();
                alert(`✅ "${newName}" updated successfully with ${updatedQuestions.length} questions.`);
            } catch (e) {
                alert('Save failed: ' + e.message);
            }

            saveBtn.textContent = 'Save Changes';
            saveBtn.disabled = false;
        }

        async function deletePaper(paperId) {
            const paper = publishedPapers.find(p => p.id === paperId);
            if (!paper) return;
            if (!confirm(`Delete "${paper.paperName}"?\n\nThis will permanently remove all ${paper.questionCount} questions from Firebase. This cannot be undone.`)) return;

            try {
                // Delete questions from Firestore (batch)
                const qSnap = await db.collection('questions').where('paperId','==',paperId).get();
                const batch = db.batch();
                qSnap.forEach(doc => batch.delete(doc.ref));
                batch.delete(db.collection('papers').doc(paperId));
                await batch.commit();
            } catch(e) {
                console.warn('Firestore delete error:', e.message);
            }

            // Update local state
            const idx = publishedPapers.findIndex(p => p.id === paperId);
            if (idx !== -1) publishedPapers.splice(idx, 1);
            for (let i = QUIZ_DATA.length - 1; i >= 0; i--) {
                if (QUIZ_DATA[i].paperId === paperId) QUIZ_DATA.splice(i, 1);
            }

            document.getElementById('admin-total-q').textContent        = QUIZ_DATA.length;
            document.getElementById('admin-total-papers').textContent   = publishedPapers.length;
            document.getElementById('published-count').textContent      = publishedPapers.length;
            document.getElementById('admin-total-attempts').textContent = studentSubmissions.length;
            renderPublishedPapers();
        }

        async function viewPaperResults(paperId) {
            const paper = publishedPapers.find(p => p.id === paperId);
            if (!paper) return;

            const modal   = document.getElementById('paper-results-modal');
            const contentEl = document.getElementById('paper-results-content');
            contentEl.innerHTML = '<p class="text-center text-slate-400 py-8">Loading results from Firebase...</p>';
            modal.classList.remove('hidden');

            // Load fresh from Firestore so admin sees all submissions live
            let subs = [];
            try {
                const snap = await db.collection('submissions').where('paperId','==',paperId).get();
                snap.forEach(doc => {
                    const d = doc.data();
                    subs.push({ ...d, submittedAt: d.submittedAt ? d.submittedAt.toDate() : new Date() });
                });
            } catch(e) {
                // fallback to local cache
                subs = studentSubmissions.filter(s => s.paperId === paperId);
            }

            const avgScore   = subs.length ? Math.round(subs.reduce((a,b) => a + b.score, 0) / subs.length) : 0;
            const avgTime    = subs.length ? Math.round(subs.reduce((a,b) => a + b.timeSecs, 0) / subs.length) : 0;
            const highest    = subs.length ? Math.max(...subs.map(s => s.score)) : 0;
            const rankCounts = {A:0, B:0, C:0, S:0, F:0};
            subs.forEach(s => { if (rankCounts[s.rank] !== undefined) rankCounts[s.rank]++; });
            const fmtTime = (sec) => `${Math.floor(sec/60)}m ${sec%60}s`;

            contentEl.innerHTML = `
                <div class="mb-6">
                    <h3 class="text-xl font-extrabold text-slate-900">${paper.paperName}</h3>
                    <p class="text-sm text-slate-500 mt-1">${paper.grade} • ${paper.subject} ${paper.stream ? '• '+paper.stream : ''} ${paper.year ? '• '+paper.year : ''} ${paper.term ? '• '+paper.term : ''}</p>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div class="bg-blue-50 rounded-2xl p-4 text-center">
                        <p class="text-2xl font-black text-blue-600">${subs.length}</p>
                        <p class="text-[10px] font-bold text-blue-400 uppercase mt-1">Students Done</p>
                    </div>
                    <div class="bg-emerald-50 rounded-2xl p-4 text-center">
                        <p class="text-2xl font-black text-emerald-600">${avgScore}%</p>
                        <p class="text-[10px] font-bold text-emerald-400 uppercase mt-1">Avg Score</p>
                    </div>
                    <div class="bg-amber-50 rounded-2xl p-4 text-center">
                        <p class="text-2xl font-black text-amber-600">${highest}%</p>
                        <p class="text-[10px] font-bold text-amber-400 uppercase mt-1">Highest Score</p>
                    </div>
                    <div class="bg-purple-50 rounded-2xl p-4 text-center">
                        <p class="text-2xl font-black text-purple-600">${fmtTime(avgTime)}</p>
                        <p class="text-[10px] font-bold text-purple-400 uppercase mt-1">Avg Time</p>
                    </div>
                </div>
                <div class="bg-slate-50 rounded-2xl p-4 mb-6">
                    <h4 class="text-sm font-extrabold text-slate-700 mb-3">Grade Distribution</h4>
                    <div class="flex gap-3 flex-wrap">
                        ${['A','B','C','S','F'].map(r => {
                            const colors = {A:'emerald',B:'blue',C:'amber',S:'orange',F:'red'};
                            const c = colors[r];
                            return '<div class="flex-1 min-w-[60px] text-center bg-white rounded-xl p-3 border border-slate-100"><p class="text-xl font-black text-'+c+'-500">'+rankCounts[r]+'</p><p class="text-[10px] font-bold text-slate-400 uppercase">Grade '+r+'</p></div>';
                        }).join('')}
                    </div>
                </div>
                ${subs.length === 0 ? '<p class="text-center text-slate-400 text-sm py-6">No students have completed this paper yet.</p>' : `
                <div>
                    <h4 class="text-sm font-extrabold text-slate-700 mb-3">All Submissions (${subs.length})</h4>
                    <div class="overflow-auto max-h-72 rounded-xl border border-slate-200">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-slate-50 border-b border-slate-200 sticky top-0">
                                <tr>
                                    <th class="px-3 py-3 font-bold text-slate-500 text-xs">#</th>
                                    <th class="px-3 py-3 font-bold text-slate-500 text-xs">Student</th>
                                    <th class="px-3 py-3 font-bold text-slate-500 text-xs">Email</th>
                                    <th class="px-3 py-3 font-bold text-slate-500 text-xs">Score</th>
                                    <th class="px-3 py-3 font-bold text-slate-500 text-xs">Correct</th>
                                    <th class="px-3 py-3 font-bold text-slate-500 text-xs">Time</th>
                                    <th class="px-3 py-3 font-bold text-slate-500 text-xs">Rank</th>
                                    <th class="px-3 py-3 font-bold text-slate-500 text-xs">Date</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${subs.map((s, i) => {
                                    const gradeColors = {A:'text-emerald-600',B:'text-blue-600',C:'text-amber-600',S:'text-orange-500',F:'text-red-500'};
                                    const d = s.submittedAt;
                                    const dateStr = d ? (d.getDate()+'/'+(d.getMonth()+1)+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')) : '—';
                                    const studentName  = s.studentName  || '—';
                                    const studentEmail = s.studentEmail || 'Guest';
                                    return '<tr class="hover:bg-slate-50"><td class="px-3 py-3 text-slate-400 font-bold">'+(i+1)+'</td><td class="px-3 py-2"><p class="font-bold text-slate-800 text-xs">'+studentName+'</p><p class="text-[10px] text-slate-400">'+s.studentGrade+'</p></td><td class="px-3 py-2 text-xs text-blue-600 font-medium">'+studentEmail+'</td><td class="px-3 py-2 font-black text-slate-800">'+s.score+'%</td><td class="px-3 py-2 text-slate-600">'+s.correct+'/'+s.total+'</td><td class="px-3 py-2 text-slate-600 font-mono text-xs">'+fmtTime(s.timeSecs)+'</td><td class="px-3 py-2 font-black '+(gradeColors[s.rank] || 'text-slate-800')+'">'+s.rank+'</td><td class="px-3 py-2 text-slate-400 text-xs">'+dateStr+'</td></tr>';
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`}
            `;
        }

        // ============================================================
        //  RICH TEXT EDITOR HELPERS
        // ============================================================
        function rteCmd(cmd, val) {
            const editor = document.getElementById('wiz-q-text');
            editor.focus();
            document.execCommand(cmd, false, val || null);
            rteUpdateToolbar();
            // Update colour bar if foreColor changed
            if (cmd === 'foreColor' && val) {
                document.getElementById('rte-color-bar').style.backgroundColor = val;
            }
        }

        function rteUpdateToolbar() {
            const cmds = ['bold','italic','underline','strikeThrough','superscript','subscript'];
            const titles = {'bold':'Bold','italic':'Italic','underline':'Underline','strikeThrough':'Strikethrough','superscript':'Superscript','subscript':'Subscript'};
            cmds.forEach(cmd => {
                const btn = document.querySelector(`#rte-toolbar button[title="${titles[cmd]}"]`);
                if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
            });
        }

        // ── Math panel toggle ──
        function toggleMathPanel() {
            const panel = document.getElementById('math-panel');
            const btn   = document.getElementById('math-panel-toggle');
            panel.classList.toggle('hidden');
            btn.classList.toggle('bg-violet-200', !panel.classList.contains('hidden'));
        }

        // ── Save and restore caret position in contenteditable ──
        function saveCaretPos(el) {
            const sel = window.getSelection();
            if (!sel.rangeCount) return null;
            const range = sel.getRangeAt(0);
            if (!el.contains(range.commonAncestorContainer)) return null;
            return range.cloneRange();
        }
        function restoreCaretPos(el, savedRange) {
            if (!savedRange) { el.focus(); return; }
            el.focus();
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }

        // ── Insert a LaTeX math snippet into the editor wrapped in $...$ ──
        function insertMath(latex) {
            const editor = document.getElementById('wiz-q-text');
            editor.focus();
            const sel = window.getSelection();
            let range;
            if (sel.rangeCount) {
                range = sel.getRangeAt(0);
                range.deleteContents();
            } else {
                range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false);
            }
            const mathText = document.createTextNode(' \\(' + latex + '\\) ');
            range.insertNode(mathText);
            // Move caret after inserted text
            range.setStartAfter(mathText);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        // ── Wrap selected text in $...$ (inline math) ──
        function wrapMathInline() {
            const editor = document.getElementById('wiz-q-text');
            editor.focus();
            const sel = window.getSelection();
            if (sel.rangeCount && !sel.isCollapsed) {
                const selected = sel.getRangeAt(0).toString();
                document.execCommand('insertText', false, ' \\(' + selected + '\\) ');
            } else {
                document.execCommand('insertText', false, ' \\(  \\) ');
            }
        }

        // ── Wrap selected text in $$...$$ (display math) ──
        function wrapMathDisplay() {
            const editor = document.getElementById('wiz-q-text');
            editor.focus();
            const sel = window.getSelection();
            if (sel.rangeCount && !sel.isCollapsed) {
                const selected = sel.getRangeAt(0).toString();
                document.execCommand('insertText', false, ' \\[' + selected + '\\] ');
            } else {
                document.execCommand('insertText', false, ' \\[  \\] ');
            }
        }

        // ── Trigger MathJax render on any element containing math ──
        function renderMathIn(element) {
            if (window.MathJax && MathJax.typesetPromise) {
                MathJax.typesetPromise([element]).catch(err => console.warn('MathJax error', err));
            }
        }

        // ── Insert math template into a specific answer option field ──
        function insertMathToOption() {
            const latex  = document.getElementById('ans-math-pick').value;
            const target = document.getElementById('ans-target-pick').value;
            if (!latex) { alert('Please pick a math template first.'); return; }
            const field = document.getElementById('wiz-opt-' + target);
            if (!field) return;
            const pos = field.selectionStart ?? field.value.length;
            const before = field.value.slice(0, pos);
            const after  = field.value.slice(pos);
            field.value = before + ' \\(' + latex + '\\) ' + after;
            field.focus();
            const newPos = before.length + latex.length + 7;
            field.setSelectionRange(newPos, newPos);
            // Reset picker
            document.getElementById('ans-math-pick').value = '';
        }

        function wizReset() {
            wizState = { step: 1, questions: [], paperMeta: {} };
            // Reset all wizard fields
            ['wiz-grade','wiz-stream','wiz-subject','wiz-paper-type','wiz-year'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            document.getElementById('wiz-paper-name').value = '';
            const timeLimitEl = document.getElementById('wiz-time-limit');
            if (timeLimitEl) timeLimitEl.value = '';
            // Clear rich text editor
            const qEditor = document.getElementById('wiz-q-text');
            if (qEditor) qEditor.innerHTML = '';
            document.getElementById('wiz-stream-wrap').classList.add('hidden');
            // Reset term indicators (term block is always visible)
            const star  = document.getElementById('wiz-term-required-star');
            const badge = document.getElementById('wiz-term-optional-badge');
            if (star)  star.classList.add('hidden');
            if (badge) badge.classList.remove('hidden');
            document.querySelectorAll('input[name="wiz-term"]').forEach(r => r.checked = false);
            wizGoStep(1);
        }

        function wizViewPublished() {
            // Scroll to the published papers panel
            document.getElementById('published-papers-list').scrollIntoView({ behavior: 'smooth' });
        }

        async function loginAdmin() {
            const email = document.getElementById('admin-email').value.trim();
            const pass  = document.getElementById('admin-pass').value;
            const btn   = document.getElementById('admin-btn');
            const err   = document.getElementById('admin-error');
            err.classList.add('hidden');
            btn.textContent = 'Signing in...';
            btn.disabled = true;

            try {
                // Sign in with Firebase Auth
                const cred = await auth.signInWithEmailAndPassword(email, pass);

                // Check this email is the registered admin
                if (cred.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
                    await auth.signOut();
                    throw new Error('This account does not have admin access.');
                }

                // Success — redirect to Admin Dashboard page
                window.location.href = 'AdminDashboard.html';

            } catch(e) {
                err.textContent = e.code === 'auth/user-not-found'  ? 'No admin account found with this email.' :
                                  e.code === 'auth/wrong-password'  ? 'Wrong password. Please try again.' :
                                  e.code === 'auth/invalid-email'   ? 'Please enter a valid email address.' :
                                  e.code === 'auth/too-many-requests' ? 'Too many attempts. Please wait a minute.' :
                                  e.message || 'Login failed. Please try again.';
                err.classList.remove('hidden');
            }

            btn.textContent = 'Access Admin Dashboard';
            btn.disabled = false;
        }

        function adminLogout() {
            if (confirm('Logout from Admin Dashboard?')) {
                auth.signOut().then(() => {
                    window.location.href = 'index.html';
                });
            }
        }

        // ============================================================
        //  STUDENT GROWTH DASHBOARD
        // ============================================================

        // --- All leaderboard data cached here ---
        let dashLeaderboardAll  = [];
        let dashLeaderboardPage = 10;

        // Called whenever a student navigates to the dashboard
        async function loadDashboard() {
            if (!currentStudent) {
                openModal('login');
                return;
            }

            // Update greeting
            const greetEl = document.getElementById('dash-student-greeting');
            if (greetEl) greetEl.textContent = `Welcome back, ${currentStudent.name} 👋`;

            // Fetch this student's submissions from Firestore
            let mySubmissions = [];
            try {
                const snap = await db.collection('submissions')
                    .where('studentId', '==', currentStudent.uid)
                    .orderBy('submittedAt', 'desc')
                    .get();
                snap.forEach(doc => {
                    const d = doc.data();
                    mySubmissions.push({
                        ...d,
                        submittedAt: d.submittedAt ? d.submittedAt.toDate() : new Date()
                    });
                });
            } catch(e) {
                // Fallback: use in-memory submissions for this session
                mySubmissions = studentSubmissions.filter(s => s.studentId === currentStudent.uid);
            }

            renderQuickStats(mySubmissions);
            renderSubjectCircles(mySubmissions);
            renderTrendChart(mySubmissions);
            renderTopicsToReview(mySubmissions);
            renderBadges(mySubmissions);
            await buildLeaderboardData();
            renderLeaderboard();
        }

        function renderQuickStats(subs) {
            document.getElementById('dash-total-attempts').textContent = subs.length;
            const avg = subs.length ? Math.round(subs.reduce((a,s) => a + s.score, 0) / subs.length) : 0;
            document.getElementById('dash-avg-score').textContent = avg + '%';
            // Points: 10 per correct answer
            const pts = subs.reduce((a,s) => a + (s.correct || 0) * 10, 0);
            document.getElementById('dash-total-points').textContent = pts.toLocaleString();
        }

        // Circular SVG progress bar for each subject
        function renderSubjectCircles(subs) {
            const container = document.getElementById('dash-subject-circles');
            if (!subs.length) {
                container.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">Complete some papers to see your subject performance.</p>';
                return;
            }

            // Group by subject, average scores
            const subjectMap = {};
            subs.forEach(s => {
                if (!s.subject) return;
                if (!subjectMap[s.subject]) subjectMap[s.subject] = { total: 0, count: 0 };
                subjectMap[s.subject].total += s.score;
                subjectMap[s.subject].count++;
            });

            const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
            const subjects = Object.entries(subjectMap).slice(0, 6);

            container.innerHTML = subjects.map(([name, d], i) => {
                const pct = Math.round(d.total / d.count);
                const r = 18, circ = 2 * Math.PI * r;
                const dash = (pct / 100) * circ;
                const color = colors[i % colors.length];
                return `
                <div class="flex items-center gap-3">
                    <svg width="44" height="44" viewBox="0 0 44 44" class="shrink-0">
                        <circle cx="22" cy="22" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="5"/>
                        <circle cx="22" cy="22" r="${r}" fill="none" stroke="${color}" stroke-width="5"
                            stroke-dasharray="${dash.toFixed(1)} ${(circ-dash).toFixed(1)}"
                            stroke-linecap="round" transform="rotate(-90 22 22)" style="transition:stroke-dasharray 1s ease"/>
                        <text x="22" y="26" text-anchor="middle" font-size="9" font-weight="800" fill="${color}">${pct}%</text>
                    </svg>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-slate-800 text-sm truncate">${name}</p>
                        <p class="text-[11px] text-slate-400">${d.count} attempt${d.count > 1 ? 's' : ''}</p>
                    </div>
                    <span class="text-xs font-black px-2 py-0.5 rounded-full ${pct>=75?'bg-emerald-100 text-emerald-700':pct>=50?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}">${pct>=75?'Strong':pct>=50?'Good':'Review'}</span>
                </div>`;
            }).join('');
        }

        // Lightweight SVG line chart (no external library)
        function renderTrendChart(subs) {
            const emptyEl = document.getElementById('dash-trend-empty');
            const canvas  = document.getElementById('dash-trend-chart');
            if (!subs.length) {
                emptyEl.classList.remove('hidden');
                canvas.classList.add('hidden');
                return;
            }
            emptyEl.classList.add('hidden');
            canvas.classList.remove('hidden');

            // Build monthly buckets for last 6 months
            const now = new Date();
            const months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push({
                    label: d.toLocaleString('default', { month: 'short' }),
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    scores: []
                });
            }

            subs.forEach(s => {
                const d = s.submittedAt instanceof Date ? s.submittedAt : new Date();
                months.forEach(m => {
                    if (d.getFullYear() === m.year && d.getMonth() === m.month) m.scores.push(s.score);
                });
            });

            const avgs = months.map(m => m.scores.length ? Math.round(m.scores.reduce((a,b)=>a+b,0)/m.scores.length) : null);

            // Draw simple SVG polyline
            const W = 500, H = 140, padL = 32, padR = 16, padT = 12, padB = 28;
            const pts = months.map((m, i) => {
                const x = padL + (i / (months.length - 1)) * (W - padL - padR);
                const y = avgs[i] !== null ? padT + (1 - avgs[i]/100) * (H - padT - padB) : null;
                return { x, y, label: m.label, val: avgs[i] };
            });

            const lineData = pts.filter(p => p.y !== null);
            const polyline = lineData.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            const areaPoints = lineData.length > 1
                ? `${lineData[0].x.toFixed(1)},${(H-padB).toFixed(1)} ` + lineData.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ` ${lineData[lineData.length-1].x.toFixed(1)},${(H-padB).toFixed(1)}`
                : '';

            const gridLines = [25,50,75,100].map(v => {
                const y = padT + (1 - v/100) * (H - padT - padB);
                return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#f1f5f9" stroke-width="1"/>
                         <text x="${(padL-4).toFixed(0)}" y="${(y+4).toFixed(0)}" text-anchor="end" font-size="8" fill="#94a3b8">${v}</text>`;
            }).join('');

            const xLabels = pts.map(p => `<text x="${p.x.toFixed(1)}" y="${(H-padB+14).toFixed(1)}" text-anchor="middle" font-size="9" fill="#64748b">${p.label}</text>`).join('');

            const dots = lineData.map(p =>
                `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#3b82f6" stroke="white" stroke-width="2"/>
                 <text x="${p.x.toFixed(1)}" y="${(p.y-8).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="bold" fill="#1d4ed8">${p.val}%</text>`
            ).join('');

            canvas.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%">
                <defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.15"/>
                    <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
                </linearGradient></defs>
                ${gridLines}
                ${areaPoints ? `<polygon points="${areaPoints}" fill="url(#trendGrad)"/>` : ''}
                ${lineData.length > 1 ? `<polyline points="${polyline}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
                ${dots}
                ${xLabels}
            </svg>`;
        }

        // Topics to review from wrong answers
        function renderTopicsToReview(subs) {
            const container = document.getElementById('dash-topics-review');
            // Collect wrong questions grouped by subject
            const topicMap = {};

            subs.forEach(s => {
                if (!s.subject) return;
                if (!topicMap[s.subject]) topicMap[s.subject] = { wrong: 0, attempts: 0 };
                topicMap[s.subject].attempts += s.total || 0;
                topicMap[s.subject].wrong    += (s.total || 0) - (s.correct || 0);
            });

            const topics = Object.entries(topicMap)
                .filter(([,v]) => v.wrong > 0)
                .sort((a,b) => b[1].wrong - a[1].wrong)
                .slice(0, 8);

            if (!topics.length) {
                container.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">No mistakes yet — keep practicing!</p>';
                return;
            }

            const priorities = ['High Priority','Medium','Low'];
            container.innerHTML = topics.map(([subj, d], i) => {
                const errRate = Math.round((d.wrong / d.attempts) * 100);
                const pri = errRate >= 50 ? 0 : errRate >= 25 ? 1 : 2;
                const colors = [
                    'bg-red-50 border-red-200 text-red-700',
                    'bg-amber-50 border-amber-200 text-amber-700',
                    'bg-slate-50 border-slate-200 text-slate-600'
                ];
                const badges = ['bg-red-100 text-red-700','bg-amber-100 text-amber-700','bg-slate-100 text-slate-500'];
                return `
                <div class="flex items-center gap-3 p-3 rounded-xl border ${colors[pri]}">
                    <div class="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-sm truncate">${subj}</p>
                        <p class="text-[11px] opacity-70">${d.wrong} wrong out of ${d.attempts} questions</p>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badges[pri]} shrink-0">${priorities[pri]}</span>
                </div>`;
            }).join('');
        }

        // --- Badge Definitions ---
        const BADGES = [
            { id: 'first_paper',   icon: '📄', name: 'First Step',       desc: 'Complete your first paper',          check: (s) => s.length >= 1 },
            { id: 'consistency',   icon: '🔥', name: 'Consistency King', desc: '10+ papers completed',               check: (s) => s.length >= 10 },
            { id: 'math_master',   icon: '📐', name: 'Math Master',      desc: 'Score 80%+ in Mathematics',          check: (s) => s.some(x=>x.subject==='Mathematics'&&x.score>=80) },
            { id: 'science_star',  icon: '🔬', name: 'Science Star',     desc: 'Score 80%+ in Science/Physics/Bio',  check: (s) => s.some(x=>['Science','Physics','Biology','Chemistry'].includes(x.subject)&&x.score>=80) },
            { id: 'perfect_score', icon: '💯', name: 'Perfectionist',    desc: 'Score 100% on any paper',            check: (s) => s.some(x=>x.score===100) },
            { id: 'speedrunner',   icon: '⚡', name: 'Speed Demon',      desc: 'Finish a paper in under 3 minutes',  check: (s) => s.some(x=>(x.timeSecs||999)<180&&x.total>=5) },
            { id: 'top_ranker',    icon: '🏆', name: 'Top 10 National',  desc: 'Reach top 10 on the leaderboard',    check: (s,rank) => rank > 0 && rank <= 10 },
            { id: 'explorer',      icon: '🌍', name: 'Explorer',         desc: 'Attempt 5 different subjects',       check: (s) => new Set(s.map(x=>x.subject).filter(Boolean)).size >= 5 },
        ];

        function renderBadges(subs) {
            const container = document.getElementById('dash-badges');
            const rankEl    = document.getElementById('dash-national-rank');
            const rankNum   = parseInt((rankEl?.textContent || '999').replace(/[^0-9]/g,'')) || 999;

            container.innerHTML = BADGES.map(b => {
                const earned = b.check(subs, rankNum);
                return `
                <div class="flex flex-col items-center gap-2 p-3 rounded-2xl border ${earned ? 'border-purple-200 bg-purple-50' : 'border-slate-100 bg-slate-50 opacity-50'} transition-all">
                    <div class="text-3xl" title="${b.name}">${b.icon}</div>
                    <div class="text-center">
                        <p class="text-[11px] font-extrabold ${earned ? 'text-purple-800' : 'text-slate-500'} leading-tight">${b.name}</p>
                        <p class="text-[10px] ${earned ? 'text-purple-600' : 'text-slate-400'} leading-tight mt-0.5">${b.desc}</p>
                    </div>
                    ${earned ? '<span class="text-[9px] font-black bg-purple-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">Earned!</span>' : '<span class="text-[9px] text-slate-400">Locked</span>'}
                </div>`;
            }).join('');
        }

        // --- Leaderboard (lazy-loaded, regional filter) ---
        async function buildLeaderboardData() {
            dashLeaderboardAll = [];
            try {
                const snap = await db.collection('submissions').get();
                const studentTotals = {};
                snap.forEach(doc => {
                    const d = doc.data();
                    if (!d.studentId || !d.studentName) return;
                    if (!studentTotals[d.studentId]) {
                        studentTotals[d.studentId] = {
                            id: d.studentId, name: d.studentName,
                            grade: d.studentGrade || '—',
                            school: d.studentSchool || '',
                            province: d.province || 'Unknown',
                            points: 0, attempts: 0, totalScore: 0
                        };
                    }
                    studentTotals[d.studentId].points     += (d.correct || 0) * 10;
                    studentTotals[d.studentId].attempts   += 1;
                    studentTotals[d.studentId].totalScore += (d.score || 0);
                });
                dashLeaderboardAll = Object.values(studentTotals)
                    .sort((a,b) => b.points - a.points);

                // Set national rank for current student
                const myIdx = dashLeaderboardAll.findIndex(x => x.id === currentStudent?.uid);
                const rankEl = document.getElementById('dash-national-rank');
                const myRankLbl = document.getElementById('dash-lb-my-rank');
                if (myIdx >= 0) {
                    if (rankEl) rankEl.textContent = `#${myIdx + 1}`;
                    if (myRankLbl) myRankLbl.textContent = `Your rank: #${myIdx + 1}`;
                }
            } catch(e) {
                console.warn('Leaderboard load error:', e.message);
            }
        }

        function renderLeaderboard() {
            const filter = document.getElementById('dash-lb-filter')?.value || 'national';
            const list   = filter === 'national'
                ? dashLeaderboardAll
                : dashLeaderboardAll.filter(x => x.province === filter);

            dashLeaderboardPage = 10;
            const body = document.getElementById('dash-leaderboard-body');
            const loadMore = document.getElementById('dash-lb-load-more');

            if (!list.length) {
                body.innerHTML = '<div class="p-8 text-center text-slate-400 text-sm">No data yet for this region.</div>';
                if (loadMore) loadMore.classList.add('hidden');
                return;
            }

            renderLeaderboardRows(list, 0, dashLeaderboardPage, body, true);
            if (loadMore) loadMore.classList.toggle('hidden', list.length <= dashLeaderboardPage);

            // Highlight current student
            const myIdx = list.findIndex(x => x.id === currentStudent?.uid);
            const myRankLbl = document.getElementById('dash-lb-my-rank');
            if (myRankLbl) myRankLbl.textContent = myIdx >= 0 ? `Your rank: #${myIdx + 1}` : 'Your rank: unranked';
        }

        function renderLeaderboardRows(list, from, to, container, reset) {
            const medals = ['🥇','🥈','🥉'];
            const rows = list.slice(from, to).map((s, i) => {
                const rank   = from + i + 1;
                const isMe   = s.id === currentStudent?.uid;
                const medal  = rank <= 3 ? medals[rank-1] : `<span class="font-black text-slate-400">#${rank}</span>`;
                const avg    = s.attempts ? Math.round(s.totalScore / s.attempts) : 0;
                return `<div class="flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-slate-50'} transition-colors">
                    <div class="w-8 text-center shrink-0 text-base">${medal}</div>
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">${s.name.charAt(0).toUpperCase()}</div>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-slate-800 text-sm truncate">${s.name}${isMe?'<span class="ml-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full">You</span>':''}</p>
                        <p class="text-[11px] text-slate-400 truncate">${s.grade}${s.school?' • '+s.school:''}</p>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="font-black text-blue-600 text-sm">${s.points.toLocaleString()} pts</p>
                        <p class="text-[10px] text-slate-400">${avg}% avg</p>
                    </div>
                </div>`;
            }).join('');

            if (reset) container.innerHTML = rows;
            else       container.insertAdjacentHTML('beforeend', rows);
        }

        function loadMoreLeaderboard() {
            const filter = document.getElementById('dash-lb-filter')?.value || 'national';
            const list   = filter === 'national' ? dashLeaderboardAll : dashLeaderboardAll.filter(x => x.province === filter);
            const body   = document.getElementById('dash-leaderboard-body');
            const btn    = document.getElementById('dash-lb-load-more');
            const prev   = dashLeaderboardPage;
            dashLeaderboardPage += 10;
            renderLeaderboardRows(list, prev, dashLeaderboardPage, body, false);
            if (btn) btn.classList.toggle('hidden', dashLeaderboardPage >= list.length);
        }

        // Hook into navTo: auto-load dashboard when navigating to it
        const _origNavTo = navTo;
        // Override navTo to trigger loadDashboard when visiting 'dashboard'
        (function() {
            const origNavTo = window.navTo;
            window.navTo = function(viewId) {
                origNavTo(viewId);
                if (viewId === 'dashboard') loadDashboard();
            };
        })();

        // Also hook finishQuiz to update points in real-time on the student's Firestore profile
        const _origFinishQuiz = window.finishQuiz;

        // ============================================================
        //  LIVE LEADERBOARD ENGINE  (view-leaderboard)
        // ============================================================

        let lbAllData      = [];   // all aggregated student records
        let lbFiltered     = [];   // after filters applied
        let lbPageSize     = 15;
        let lbCurrentPage  = 0;
        let lbScope        = 'national'; // 'national' | 'province'

        // Called when navigating to leaderboard view
        async function loadLeaderboardPage() {
            // Show loading
            document.getElementById('lb-loading').classList.remove('hidden');
            document.getElementById('lb-table-wrap').classList.add('hidden');
            document.getElementById('lb-empty').classList.add('hidden');
            document.getElementById('lb-podium').classList.add('hidden');

            // Build aggregate data from Firestore submissions
            lbAllData = [];
            try {
                const snap = await db.collection('submissions').get();
                const map  = {};

                snap.forEach(doc => {
                    const d = doc.data();
                    if (!d.studentId || !d.studentName) return;

                    if (!map[d.studentId]) {
                        map[d.studentId] = {
                            id:         d.studentId,
                            name:       d.studentName,
                            grade:      d.studentGrade  || '—',
                            school:     d.studentSchool || '',
                            province:   d.province      || '',
                            points:     0,
                            attempts:   0,
                            totalScore: 0,
                            totalCorrect: 0,
                            totalQs:    0,
                            subjects:   new Set(),
                            lastAt:     null,
                            dates:      []
                        };
                    }
                    const r = map[d.studentId];
                    r.points       += (d.correct || 0) * 10;
                    r.attempts     += 1;
                    r.totalScore   += (d.score   || 0);
                    r.totalCorrect += (d.correct || 0);
                    r.totalQs      += (d.total   || 0);
                    if (d.subject) r.subjects.add(d.subject);
                    const dt = d.submittedAt ? (d.submittedAt.toDate ? d.submittedAt.toDate() : new Date(d.submittedAt)) : null;
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
                // Fallback to in-memory session data
                const map = {};
                studentSubmissions.forEach(d => {
                    if (!d.studentId) return;
                    if (!map[d.studentId]) map[d.studentId] = { id:d.studentId, name:d.studentName||'Student', grade:d.studentGrade||'—', school:d.studentSchool||'', province:'', points:0, attempts:0, totalScore:0, totalCorrect:0, totalQs:0, subjects:new Set(), dates:[] };
                    map[d.studentId].points       += (d.correct||0)*10;
                    map[d.studentId].attempts     += 1;
                    map[d.studentId].totalScore   += d.score||0;
                    map[d.studentId].totalCorrect += d.correct||0;
                    map[d.studentId].totalQs      += d.total||0;
                    if (d.subject) map[d.studentId].subjects.add(d.subject);
                    if (d.submittedAt) map[d.studentId].dates.push(d.submittedAt);
                });
                lbAllData = Object.values(map).map(r => ({
                    ...r, subjects: Array.from(r.subjects),
                    avgScore: r.attempts ? Math.round(r.totalScore/r.attempts):0,
                    accuracy: r.totalQs ? Math.round((r.totalCorrect/r.totalQs)*100):0,
                    streak: calcStreak(r.dates)
                }));
            }

            // Update hero stats
            const totalAttempts = lbAllData.reduce((a,r)=>a+r.attempts,0);
            const globalAvg     = lbAllData.length ? Math.round(lbAllData.reduce((a,r)=>a+r.avgScore,0)/lbAllData.length) : 0;
            document.getElementById('lb-hero-students').textContent = lbAllData.length.toLocaleString();
            document.getElementById('lb-hero-attempts').textContent = totalAttempts.toLocaleString();
            document.getElementById('lb-hero-avg').textContent      = globalAvg + '%';

            // Show/update my card
            lbUpdateMyCard();

            // Apply filters and render
            lbApplyFilters();
        }

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

        function lbSetScope(scope) {
            lbScope = scope;
            document.querySelectorAll('.lb-scope-tab').forEach(t => {
                t.classList.remove('bg-white','text-blue-700','shadow-sm');
                t.classList.add('text-slate-500');
            });
            const active = document.getElementById(`lb-tab-${scope}`);
            if (active) { active.classList.add('bg-white','text-blue-700','shadow-sm'); active.classList.remove('text-slate-500'); }
            const provSel = document.getElementById('lb-province-sel');
            if (provSel) provSel.classList.toggle('hidden', scope !== 'province');
            lbApplyFilters();
        }

        function lbApplyFilters() {
            const grade   = document.getElementById('lb-grade-sel')?.value   || '';
            const subject = document.getElementById('lb-subject-sel')?.value || '';
            const sort    = document.getElementById('lb-sort-sel')?.value    || 'points';
            const province= document.getElementById('lb-province-sel')?.value|| '';

            let list = [...lbAllData];

            // Scope filter
            if (lbScope === 'province' && province) list = list.filter(r => r.province === province);

            // Grade filter
            if (grade) list = list.filter(r => r.grade === grade);

            // Subject filter — filter by students who have attempted that subject
            if (subject) list = list.filter(r => r.subjects.includes(subject));

            // Sort
            if (sort === 'points')   list.sort((a,b) => b.points   - a.points);
            if (sort === 'accuracy') list.sort((a,b) => b.accuracy  - a.accuracy);
            if (sort === 'attempts') list.sort((a,b) => b.attempts  - a.attempts);

            lbFiltered    = list;
            lbCurrentPage = 0;
            lbRenderTable();
            lbUpdateMyCard();
        }

        function lbRenderTable() {
            const loading  = document.getElementById('lb-loading');
            const empty    = document.getElementById('lb-empty');
            const tableWrap= document.getElementById('lb-table-wrap');
            const tbody    = document.getElementById('lb-tbody');
            const podium   = document.getElementById('lb-podium');
            const loadMore = document.getElementById('lb-load-more-btn');
            const countLbl = document.getElementById('lb-count-label');

            loading.classList.add('hidden');

            if (!lbFiltered.length) {
                empty.classList.remove('hidden');
                tableWrap.classList.add('hidden');
                if (podium) podium.classList.add('hidden');
                return;
            }

            empty.classList.add('hidden');
            tableWrap.classList.remove('hidden');

            // Render podium for top 3
            lbRenderPodium(lbFiltered.slice(0, 3));

            // Render card rows
            const end = (lbCurrentPage + 1) * lbPageSize;
            tbody.innerHTML = '';
            lbFiltered.slice(0, end).forEach((s, i) => lbAppendRow(s, i + 1, tbody));

            const shown = Math.min(end, lbFiltered.length);
            if (loadMore) loadMore.classList.toggle('hidden', shown >= lbFiltered.length);
            if (countLbl) countLbl.textContent = `Showing ${shown} of ${lbFiltered.length} students`;
        }

        function lbLoadMore() {
            lbCurrentPage++;
            const end   = (lbCurrentPage + 1) * lbPageSize;
            const tbody = document.getElementById('lb-tbody');
            const from  = lbCurrentPage * lbPageSize;
            lbFiltered.slice(from, end).forEach((s, i) => lbAppendRow(s, from + i + 1, tbody));
            const loadMore = document.getElementById('lb-load-more-btn');
            const countLbl = document.getElementById('lb-count-label');
            const shown = Math.min(end, lbFiltered.length);
            if (loadMore) loadMore.classList.toggle('hidden', shown >= lbFiltered.length);
            if (countLbl) countLbl.textContent = `Showing ${shown} of ${lbFiltered.length} students`;
        }

        function lbAppendRow(s, rank, container) {
            const isMe    = s.id === currentStudent?.uid;
            const medals  = { 1:'🥇', 2:'🥈', 3:'🥉' };
            const rankDisp = medals[rank] || `#${rank}`;
            const rankColor = rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-slate-500' : rank === 3 ? 'text-amber-700' : rank <= 10 ? 'text-blue-700' : 'text-slate-400';

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
                <!-- Rank -->
                <div class="w-8 sm:w-10 text-center shrink-0">
                    <span class="text-base sm:text-lg font-black ${rankColor}">${rankDisp}</span>
                </div>
                <!-- Avatar -->
                <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm">
                    ${s.name.charAt(0).toUpperCase()}
                </div>
                <!-- Info -->
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
                    <!-- Accuracy bar — visible on mobile too -->
                    <div class="flex items-center gap-1.5 mt-1.5">
                        <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                            <div class="h-full rounded-full ${accColor}" style="width:${s.accuracy}%"></div>
                        </div>
                        <span class="text-[11px] font-bold ${accText}">${s.accuracy}%</span>
                        <span class="text-[10px] text-slate-300 hidden sm:inline">• ${s.attempts} paper${s.attempts!==1?'s':''}</span>
                    </div>
                </div>
                <!-- Points -->
                <div class="text-right shrink-0">
                    <p class="font-black text-blue-600 text-sm sm:text-base">${s.points.toLocaleString()}</p>
                    <p class="text-[9px] text-slate-400 uppercase tracking-wide">pts</p>
                    <p class="text-[10px] text-slate-400 sm:hidden">${s.attempts} papers</p>
                </div>
            `;
            container.appendChild(div);
        }

        function lbRenderPodium(top3) {
            const el = document.getElementById('lb-podium');
            if (!top3.length) { el.classList.add('hidden'); return; }
            el.classList.remove('hidden');

            // Order: 2nd | 1st | 3rd  (classic podium arrangement)
            const order  = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
            const medals = ['🥈','🥇','🥉'];
            const labels = ['2nd Place','1st Place','3rd Place'];
            const barH   = ['pb-4 pt-6','pb-6 pt-8','pb-3 pt-5'];         // height via padding
            const barBg  = ['bg-slate-100 border-slate-200','bg-amber-100 border-amber-200','bg-slate-50 border-slate-100'];
            const avatarRing = ['ring-slate-300','ring-amber-400','ring-slate-200'];

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

        function lbUpdateMyCard() {
            const card = document.getElementById('lb-my-card');
            if (!currentStudent || !lbFiltered.length) { if(card) card.classList.add('hidden'); return; }

            const myIdx = lbFiltered.findIndex(x => x.id === currentStudent.uid);
            if (myIdx < 0) { if(card) card.classList.add('hidden'); return; }

            const me = lbFiltered[myIdx];
            card.classList.remove('hidden');
            document.getElementById('lb-my-avatar').textContent = me.name.charAt(0).toUpperCase();
            document.getElementById('lb-my-name').textContent   = me.name;
            document.getElementById('lb-my-meta').textContent   = `${me.grade}${me.school?' • '+me.school:''}${me.province?' • '+me.province:''}`;
            document.getElementById('lb-my-nat-rank').textContent = `#${myIdx + 1}`;
            document.getElementById('lb-my-points').textContent  = me.points.toLocaleString();
            document.getElementById('lb-my-avg').textContent     = me.avgScore + '%';
        }

        // Hook navTo to auto-load leaderboard when visiting it
        (function() {
            const prev = window.navTo;
            window.navTo = function(viewId) {
                prev(viewId);
                if (viewId === 'leaderboard') loadLeaderboardPage();
            };
        })();

        // ============================================================
        //  SMART SEARCH BAR  — Quiz Question Search
        // ============================================================
        (function() {
            let _searchDebounceTimer = null;

            /**
             * Escape special regex chars in a string.
             */
            function escapeRegex(str) {
                return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }

            /**
             * Highlight all occurrences of `term` inside `text` (plain text, HTML-safe).
             * Returns an HTML string.
             */
            function highlight(text, term) {
                if (!term || !text) return text;
                // Strip any existing HTML tags for plain text search, then re-highlight
                const safeText = String(text);
                const regex = new RegExp('(' + escapeRegex(term) + ')', 'gi');
                return safeText.replace(regex, '<mark class="search-highlight">$1</mark>');
            }

            /**
             * Main filter function — called on every keystroke (debounced).
             */
            window.quizSearchFilter = function(rawQuery) {
                clearTimeout(_searchDebounceTimer);
                _searchDebounceTimer = setTimeout(() => _doSearch(rawQuery), 120);
            };

            function _doSearch(rawQuery) {
                const query = rawQuery.trim();
                const clearBtn     = document.getElementById('quiz-search-clear');
                const resultInfo   = document.getElementById('quiz-search-results-info');
                const searchList   = document.getElementById('quiz-search-list');
                const noResults    = document.getElementById('quiz-search-no-results');
                const questionWrap = document.getElementById('quiz-question-wrap');
                const progressWrap = document.getElementById('quiz-progress-wrap');

                // Show / hide clear button
                if (clearBtn) clearBtn.classList.toggle('hidden', !query);

                if (!query) {
                    // Restore normal quiz navigation
                    searchList.classList.add('hidden');
                    noResults.classList.add('hidden');
                    resultInfo.classList.add('hidden');
                    if (questionWrap) questionWrap.classList.remove('hidden');
                    if (progressWrap) progressWrap.classList.remove('hidden');
                    return;
                }

                // Hide normal quiz navigation
                if (questionWrap) questionWrap.classList.add('hidden');
                if (progressWrap) progressWrap.classList.add('hidden');

                // Filter current session questions
                const questions = typeof currentSessionQuestions !== 'undefined' ? currentSessionQuestions : [];
                const regex = new RegExp(escapeRegex(query), 'i');

                const matches = questions.map((q, idx) => ({ q, idx })).filter(({ q }) => {
                    // Search question text
                    if (regex.test(q.q || '')) return true;
                    // Search answer options
                    if (Array.isArray(q.a) && q.a.some(opt => regex.test(opt || ''))) return true;
                    // Search explanation
                    if (regex.test(q.e || '')) return true;
                    return false;
                });

                // Update results info badge
                resultInfo.classList.remove('hidden');
                resultInfo.innerHTML = matches.length > 0
                    ? `<span class="search-match-badge">🔍 ${matches.length} match${matches.length !== 1 ? 'es' : ''}</span>`
                    : `<span class="search-match-badge" style="background:#fee2e2;color:#b91c1c;">No matches</span>`;

                if (matches.length === 0) {
                    searchList.classList.add('hidden');
                    noResults.classList.remove('hidden');
                    return;
                }

                noResults.classList.add('hidden');
                searchList.classList.remove('hidden');

                // Render matched questions
                searchList.innerHTML = '';
                const optionLetters = ['A', 'B', 'C', 'D', 'E'];
                const optionColors  = [
                    'bg-blue-50 border-blue-200 text-blue-800',
                    'bg-emerald-50 border-emerald-200 text-emerald-800',
                    'bg-amber-50 border-amber-200 text-amber-800',
                    'bg-rose-50 border-rose-200 text-rose-800',
                    'bg-purple-50 border-purple-200 text-purple-800'
                ];

                matches.forEach(({ q, idx }) => {
                    const card = document.createElement('div');
                    card.className = 'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-blue-300 transition-all cursor-pointer';

                    // Question number badge + text
                    const questionHtml = highlight(q.q || '', query);

                    // Options HTML
                    const optionsHtml = Array.isArray(q.a) ? q.a.map((opt, oi) => {
                        const isCorrect = oi === q.c;
                        const letter = optionLetters[oi] || String.fromCharCode(65 + oi);
                        const userChose = (typeof state !== 'undefined' && state.userAnswers && state.userAnswers[idx] === oi);
                        const highlightedOpt = highlight(opt || '', query);
                        const borderClass = isCorrect
                            ? 'border-emerald-400 bg-emerald-50'
                            : userChose ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50';
                        return `<div class="flex items-start gap-2 p-2.5 rounded-xl border ${borderClass} text-sm">
                            <span class="w-5 h-5 rounded-md ${optionColors[oi] || ''} border flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">${letter}</span>
                            <span class="flex-1 text-slate-700">${highlightedOpt}</span>
                            ${isCorrect ? '<svg class="shrink-0 text-emerald-500 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                        </div>`;
                    }).join('') : '';

                    // Jump-to-question button
                    card.innerHTML = `
                        <div class="flex items-start justify-between gap-3 mb-3">
                            <div class="flex items-center gap-2">
                                <span class="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0">${idx + 1}</span>
                                <p class="font-bold text-slate-800 text-sm leading-snug">${questionHtml}</p>
                            </div>
                            <button onclick="jumpToQuestion(${idx})"
                                class="shrink-0 flex items-center gap-1 text-[11px] font-extrabold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-xl transition whitespace-nowrap">
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
                                Go to Q
                            </button>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">${optionsHtml}</div>
                        ${q.e ? `<div class="flex gap-2 items-start mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800">
                            <svg class="shrink-0 mt-0.5 text-blue-400" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            <span><strong>Explanation:</strong> ${highlight(q.e || '', query)}</span>
                        </div>` : ''}
                    `;
                    searchList.appendChild(card);
                });

                // Re-render math in the search results
                if (typeof renderMathIn === 'function') renderMathIn(searchList);
            }

            /**
             * Jump to a specific question index and exit search mode.
             */
            window.jumpToQuestion = function(index) {
                clearQuizSearch();
                if (typeof state !== 'undefined') state.currentIndex = index;
                if (typeof renderQuestion === 'function') renderQuestion();
                // Scroll quiz view to top
                const quizView = document.getElementById('view-quiz');
                if (quizView) quizView.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };

            /**
             * Clear the search bar and restore normal quiz navigation.
             */
            window.clearQuizSearch = function() {
                const input = document.getElementById('quiz-search-input');
                if (input) {
                    input.value = '';
                    input.dispatchEvent(new Event('input'));
                }
            };

            /**
             * Reset search bar state when a new quiz starts.
             * Called from startQuiz().
             */
            window.resetQuizSearchBar = function() {
                const input = document.getElementById('quiz-search-input');
                if (input) input.value = '';
                const searchList = document.getElementById('quiz-search-list');
                const noResults  = document.getElementById('quiz-search-no-results');
                const resultInfo = document.getElementById('quiz-search-results-info');
                const clearBtn   = document.getElementById('quiz-search-clear');
                const questionWrap = document.getElementById('quiz-question-wrap');
                const progressWrap = document.getElementById('quiz-progress-wrap');
                if (searchList)   searchList.classList.add('hidden');
                if (noResults)    noResults.classList.add('hidden');
                if (resultInfo)   resultInfo.classList.add('hidden');
                if (clearBtn)     clearBtn.classList.add('hidden');
                if (questionWrap) questionWrap.classList.remove('hidden');
                if (progressWrap) progressWrap.classList.remove('hidden');
            };
        })();

        // ============================================================
        //  GLOBAL SEARCH BAR  — Home page paper search
        // ============================================================
        (function() {
            let _gTimer = null;

            function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

            function hl(text, term) {
                if (!term || !text) return String(text || '');
                return String(text).replace(new RegExp('(' + escRx(term) + ')', 'gi'),
                    '<mark class="search-highlight">$1</mark>');
            }

            window.globalSearchFilter = function(raw) {
                clearTimeout(_gTimer);
                _gTimer = setTimeout(() => _run(raw), 150);
            };

            function _run(raw) {
                const q       = raw.trim();
                const results = document.getElementById('global-search-results');
                const list    = document.getElementById('global-search-list');
                const noRes   = document.getElementById('global-search-no-results');
                const hint    = document.getElementById('global-search-hint');
                const clearBtn= document.getElementById('global-search-clear');

                clearBtn && clearBtn.classList.toggle('hidden', !q);

                if (!q) { results.classList.add('hidden'); return; }

                results.classList.remove('hidden');
                noRes.classList.add('hidden');
                list.innerHTML = '';

                // Search published papers AND quiz question text
                const papers = typeof publishedPapers !== 'undefined' ? publishedPapers : [];
                const rx = new RegExp(escRx(q), 'i');

                // Match papers by name, subject, grade, paper type, year
                const paperMatches = papers.filter(p =>
                    rx.test(p.paperName || '') ||
                    rx.test(p.subject   || '') ||
                    rx.test(p.grade     || '') ||
                    rx.test(p.paperType || '') ||
                    rx.test(String(p.year || ''))
                ).slice(0, 8);

                // Match quiz questions by question text
                const questions = typeof QUIZ_DATA !== 'undefined' ? QUIZ_DATA : [];
                const qMatches = questions.filter(q_ => rx.test(q_.q || '')).slice(0, 5);

                if (paperMatches.length === 0 && qMatches.length === 0) {
                    noRes.classList.remove('hidden');
                    hint && hint.classList.add('hidden');
                    return;
                }

                hint && hint.classList.remove('hidden');

                // Render paper results
                paperMatches.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors';
                    div.innerHTML = `
                        <div class="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-slate-800 text-sm truncate">${hl(p.paperName || 'Untitled', q)}</p>
                            <p class="text-xs text-slate-400 truncate">${hl(p.grade || '', q)} · ${hl(p.subject || '', q)} · ${hl(String(p.year || ''), q)}</p>
                        </div>
                        <span class="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">${p.questionCount || 0}Q</span>`;
                    div.onclick = () => {
                        clearGlobalSearch();
                        // Set all required state fields before launching
                        const gradeNum = (p.grade || '').replace('Grade ', '').trim();
                        state.grade      = gradeNum;
                        state.subject    = p.subject    || '';
                        state.paperType  = p.paperType  || '';
                        state.selectedYear = p.year     || null;
                        state.selectedTerm = p.term     || null;
                        state.stream     = p.stream     || null;
                        if (typeof startPaperById === 'function') startPaperById(p.id);
                    };
                    list.appendChild(div);
                });

                // Render question matches (with a separator if papers also shown)
                if (qMatches.length > 0) {
                    if (paperMatches.length > 0) {
                        const sep = document.createElement('div');
                        sep.className = 'px-4 py-1.5 bg-slate-50 border-y border-slate-100';
                        sep.innerHTML = '<p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Matching Questions</p>';
                        list.appendChild(sep);
                    }
                    qMatches.forEach(q_ => {
                        const div = document.createElement('div');
                        div.className = 'flex items-start gap-3 px-4 py-3 hover:bg-amber-50 cursor-pointer transition-colors';
                        div.innerHTML = `
                            <div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-slate-700 text-xs leading-snug line-clamp-2">${hl(q_.q || '', q)}</p>
                                <p class="text-[10px] text-slate-400 mt-0.5">${q_.grade || ''} · ${q_.subject || ''}</p>
                            </div>`;
                        list.appendChild(div);
                    });
                }

                // Update hint count
                const total = paperMatches.length + qMatches.length;
                hint && (hint.innerHTML = `<p class="text-xs text-slate-400 font-semibold text-center">${total} result${total !== 1 ? 's' : ''} found</p>`);
            }

            window.clearGlobalSearch = function() {
                const inp = document.getElementById('global-search-input');
                if (inp) inp.value = '';
                document.getElementById('global-search-results')?.classList.add('hidden');
                document.getElementById('global-search-clear')?.classList.add('hidden');
            };

            // Close results when clicking outside
            document.addEventListener('click', function(e) {
                const wrap = document.getElementById('grade-section');
                if (wrap && !wrap.contains(e.target)) {
                    document.getElementById('global-search-results')?.classList.add('hidden');
                }
            });
        })();

        // ============================================================
        //  MOBILE NAV (hamburger)
        // ============================================================
        document.addEventListener('DOMContentLoaded', () => {
            const hamburger = document.getElementById('hamburger-btn');
            const mobileMenu = document.createElement('div');
            mobileMenu.id = 'mobile-menu';
            mobileMenu.className = 'fixed inset-0 bg-white z-40 hidden flex-col items-center justify-center gap-8 text-2xl font-bold text-slate-800';
            mobileMenu.innerHTML = `
                <button onclick="document.getElementById('mobile-menu').classList.add('hidden')" class="absolute top-6 right-6 text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <a href="#" onclick="navTo('home'); document.getElementById('mobile-menu').classList.add('hidden')" class="hover:text-blue-600">Home</a>
                <a href="#" onclick="navTo('home'); setTimeout(()=>document.getElementById('grade-section').scrollIntoView({behavior:'smooth'}),300); document.getElementById('mobile-menu').classList.add('hidden')" class="hover:text-blue-600">Subjects</a>
                <a href="#" onclick="navTo('leaderboard'); document.getElementById('mobile-menu').classList.add('hidden')" class="hover:text-blue-600">Leaderboard</a>
                <a href="#" onclick="navTo('about'); document.getElementById('mobile-menu').classList.add('hidden')" class="hover:text-blue-600">About Us</a>
                <div id="mob-guest" class="flex flex-col items-center gap-3">
                    <button onclick="openModal('login'); document.getElementById('mobile-menu').classList.add('hidden')" class="px-8 py-3 bg-blue-600 text-white rounded-full font-bold text-lg">Student Portal</button>
                </div>
                <div id="mob-user" class="hidden flex-col items-center gap-3">
                    <button onclick="navTo('dashboard'); document.getElementById('mobile-menu').classList.add('hidden')" class="px-8 py-3 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-full font-bold text-base">My Dashboard</button>
                    <button onclick="studentLogout(); document.getElementById('mobile-menu').classList.add('hidden')" class="text-sm font-bold text-slate-400 hover:text-red-500">Logout</button>
                </div>`;
            document.body.appendChild(mobileMenu);
            if (hamburger) {
                hamburger.onclick = () => {
                    // Sync login state with mobile menu
                    const isLoggedIn = !document.getElementById('nav-login-btn').classList.contains('hidden') === false
                        || !document.getElementById('nav-user-info').classList.contains('hidden');
                    const mobGuest = document.getElementById('mob-guest');
                    const mobUser  = document.getElementById('mob-user');
                    if (isLoggedIn) {
                        mobGuest.classList.add('hidden');
                        mobUser.classList.remove('hidden');
                        mobUser.classList.add('flex');
                    } else {
                        mobGuest.classList.remove('hidden');
                        mobUser.classList.add('hidden');
                    }
                    mobileMenu.classList.toggle('hidden');
                    if (!mobileMenu.classList.contains('hidden')) mobileMenu.classList.add('flex');
                };
            }
        });