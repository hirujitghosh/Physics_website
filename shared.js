/* =========================================================
   shared.js — Physics Learning Space
   Single script used by ALL pages.
   ========================================================= */

/* ---------------------------------------------------------
   1. CONFIGURATION
   --------------------------------------------------------- */
const firebaseConfig = {
    apiKey: "AIzaSyAcXgj5QdroAULf3an5EpB2lz2IV5EIDH0",
    authDomain: "numberonephysicslearningspace.firebaseapp.com",
    projectId: "numberonephysicslearningspace",
    storageBucket: "numberonephysicslearningspace.firebasestorage.app",
    messagingSenderId: "419651034908",
    appId: "1:419651034908:web:63b41cbb435f15359164d9",
    measurementId: "G-ZZLVL3Q326"
};

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzgsk-8tLfMRmllVkzLlia1k9XOGL3phupnwxoSQktAYrPGEc9QWtp7i6AaxZdK0Add/exec";

/* ---------------------------------------------------------
   2. FIREBASE INITIALISATION
   --------------------------------------------------------- */
let db = null;
let auth = null;

if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    if (firebase.auth) auth = firebase.auth();
    console.log('Firebase initialized');
}

/* ---------------------------------------------------------
   2b. SEMESTER RULES
   Class 11 → 1,2    Class 12 → 3,4    BSc → 1..8
   --------------------------------------------------------- */
function getSemesterRange(classValue) {
    if (classValue === '11') return [1, 2];
    if (classValue === '12') return [3, 4];
    if (classValue === 'BSc') return [1, 2, 3, 4, 5, 6, 7, 8];
    return [];
}

function populateSemesterSelect(selectEl, classValue, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    if (placeholder) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = placeholder;
        selectEl.appendChild(opt);
    }
    getSemesterRange(classValue).forEach(sem => {
        const opt = document.createElement('option');
        opt.value = sem;
        opt.textContent = `Semester ${sem}`;
        selectEl.appendChild(opt);
    });
}

/* ---------------------------------------------------------
   3. SHARED UTILITIES
   --------------------------------------------------------- */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
    });
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => (m.style.display = 'none'));
}
window.closeModal = closeAllModals;

function showNotification(message, type = 'info') {
    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        document.body.appendChild(container);
    }
    const note = document.createElement('div');
    note.className = `notification ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    note.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(note);
    setTimeout(() => {
        note.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => note.remove(), 300);
    }, 4000);
}

function setupMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => navMenu.classList.toggle('active'));
    }
}

/* ---------------------------------------------------------
   4. HOME PAGE
   --------------------------------------------------------- */
function initHomePage() {
    console.log('Home page loaded');
    loadHomeStats();
}

async function loadHomeStats() {
    try {
        if (typeof db === 'undefined' || !db) { updateStatsDisplay(150, 45, 200, 92); return; }
        const [studentsSnap, assignmentsSnap, attendanceSnap, summarySnap] = await Promise.all([
            db.collection('students').get(),
            db.collection('assignments').where('status', '==', 'active').get(),
            db.collection('attendance').get(),
            db.collection('attendance_summary').get()
        ]);
        let avgAttendance = 92;
        if (!summarySnap.empty) {
            let total = 0, count = 0;
            summarySnap.forEach(doc => {
                const d = doc.data();
                if (d.percentage) { total += d.percentage; count++; }
            });
            if (count) avgAttendance = Math.round(total / count);
        }
        updateStatsDisplay(studentsSnap.size, assignmentsSnap.size, attendanceSnap.size, avgAttendance);
    } catch (e) {
        console.error('Stats error:', e);
        updateStatsDisplay(150, 45, 200, 92);
    }
}

function updateStatsDisplay(s, a, c, at) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('totalStudents', s + '+');
    set('totalAssignments', a + '+');
    set('totalClasses', c + '+');
    set('avgAttendance', at + '%');
}

/* ---------------------------------------------------------
   4b. FEEDBACK PAGE  (anonymous)
   --------------------------------------------------------- */
function initFeedbackPage() {
    console.log('Feedback page loaded');
    setupStarRating();
    setupCharCounters();
    document.getElementById('anonymousFeedbackForm')?.addEventListener('submit', handleAnonymousFeedback);
}

function setupStarRating() {
    const stars = document.querySelectorAll('.star-rating i');
    const ratingInput = document.getElementById('fbRating');
    if (!stars.length || !ratingInput) return;

    const highlight = (rating) => {
        stars.forEach(s => {
            const r = parseInt(s.dataset.rating);
            s.classList.toggle('fas', r <= rating);
            s.classList.toggle('far', r > rating);
            s.classList.toggle('active', r <= rating);
        });
    };

    stars.forEach(star => {
        star.addEventListener('mouseenter', () => highlight(parseInt(star.dataset.rating)));
        star.addEventListener('mouseleave', () => highlight(parseInt(ratingInput.value) || 0));
        star.addEventListener('click', () => {
            const r = parseInt(star.dataset.rating);
            ratingInput.value = r;
            highlight(r);
        });
    });
}

function setupCharCounters() {
    document.querySelectorAll('textarea[data-max]').forEach(ta => {
        const max = parseInt(ta.dataset.max);
        const counter = document.getElementById(ta.id + 'Count');
        const update = () => { if (counter) counter.textContent = `${ta.value.length}/${max}`; };
        ta.addEventListener('input', () => {
            if (ta.value.length > max) ta.value = ta.value.substring(0, max);
            update();
        });
        update();
    });
}

async function handleAnonymousFeedback(e) {
    e.preventDefault();

    const payload = {
        rating: parseInt(document.getElementById('fbRating').value) || 0,
        materials: document.getElementById('fbMaterials').value,
        explanations: document.getElementById('fbExplanations').value,
        assignments: document.getElementById('fbAssignments').value,
        attendanceSystem: document.getElementById('fbAttendance').value,
        overall: document.getElementById('fbOverall').value,
        liked: document.getElementById('fbLiked').value.trim(),
        improvements: document.getElementById('fbImprovements').value.trim(),
        topics: document.getElementById('fbTopics').value.trim(),
        recommend: document.getElementById('fbRecommend').value
    };

    // Validation
    if (!payload.rating) { showFeedbackMsg('Please give an overall star rating.', 'error'); return; }
    if (!payload.materials) { showFeedbackMsg('Please rate the study materials.', 'error'); return; }
    if (!payload.explanations) { showFeedbackMsg('Please rate the explanations clarity.', 'error'); return; }
    if (!payload.assignments) { showFeedbackMsg('Please rate the assignments.', 'error'); return; }
    if (!payload.attendanceSystem) { showFeedbackMsg('Please rate the attendance system.', 'error'); return; }
    if (!payload.overall) { showFeedbackMsg('Please give your overall experience.', 'error'); return; }
    if (!payload.recommend) { showFeedbackMsg('Please answer the recommendation question.', 'error'); return; }

    const btn = document.getElementById('feedbackSubmitBtn');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        // Save to Firebase (anonymous — no name/class)
        if (db) {
            try {
                await db.collection('feedback').add({
                    ...payload,
                    submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    anonymous: true
                });
                console.log('Feedback saved to Firebase');
            } catch (err) {
                console.warn('Firebase feedback failed:', err);
            }
        }

        // Send to Apps Script (backup)
        try {
            const fd = new FormData();
            Object.entries(payload).forEach(([k, v]) => fd.append(k, v ?? ''));
            fd.append('anonymous', 'true');
            fd.append('submittedAt', new Date().toISOString());

            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                body: fd,
                mode: 'no-cors'
            });
            console.log('Feedback sent to Apps Script');
        } catch (err) {
            console.warn('Apps Script feedback failed:', err);
        }

        // Show success screen
        document.getElementById('anonymousFeedbackForm').style.display = 'none';
        document.getElementById('feedbackSuccess').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        console.error('Feedback error:', err);
        showFeedbackMsg('Something went wrong. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

function showFeedbackMsg(message, type) {
    let div = document.getElementById('feedbackFormMessage');
    if (!div) return;
    div.textContent = message;
    div.className = `form-message ${type}`;
    div.style.display = 'block';
    setTimeout(() => { div.style.display = 'none'; }, 5000);
}

window.resetFeedbackForm = function () {
    const form = document.getElementById('anonymousFeedbackForm');
    const success = document.getElementById('feedbackSuccess');
    if (form) { form.reset(); form.style.display = 'block'; }
    if (success) success.style.display = 'none';
    document.getElementById('fbRating').value = '0';
    document.querySelectorAll('.star-rating i').forEach(s => {
        s.classList.remove('fas', 'active'); s.classList.add('far');
    });
    document.querySelectorAll('textarea[data-max]').forEach(ta => {
        const counter = document.getElementById(ta.id + 'Count');
        if (counter) counter.textContent = `0/${ta.dataset.max}`;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* ---------------------------------------------------------
   5. SEMESTER PAGE
   --------------------------------------------------------- */
let allStudents = [];

function initSemesterPage() {
    const params = new URLSearchParams(window.location.search);
    const className = params.get('class');
    const semester = params.get('sem');

    if (!className || !semester) { window.location.href = 'index.html'; return; }

    const cVal = document.getElementById('classValue');
    const sVal = document.getElementById('semesterValue');
    if (cVal) cVal.textContent = className;
    if (sVal) sVal.textContent = semester;

    loadSemesterStudents(className, semester);

    document.getElementById('searchStudent')?.addEventListener('input', e => filterStudents(e.target.value));

    document.getElementById('downloadList')?.addEventListener('click', e => {
        e.preventDefault();
        downloadStudentList();
    });

    document.querySelector('.close-modal')?.addEventListener('click', closeAllModals);
    window.addEventListener('click', e => { if (e.target.classList.contains('modal')) closeAllModals(); });
}

async function loadSemesterStudents(className, semester) {
    const grid = document.getElementById('studentsGrid');
    const noStudents = document.getElementById('noStudents');
    const totalSpan = document.getElementById('totalStudents');
    if (!grid) return;

    try {
        const snap = await db.collection('students')
            .where('class', '==', className)
            .where('semester', '==', semester)
            .orderBy('name')
            .get();

        if (snap.empty) {
            grid.style.display = 'none';
            if (noStudents) noStudents.style.display = 'block';
            if (totalSpan) totalSpan.textContent = '0';
            return;
        }

        grid.innerHTML = '';
        grid.style.display = 'grid';
        if (noStudents) noStudents.style.display = 'none';
        allStudents = [];

        snap.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            allStudents.push(student);
            grid.appendChild(createStudentCard(student));
        });

        if (totalSpan) totalSpan.textContent = snap.size;
    } catch (err) {
        console.error('Load students error:', err);
        grid.innerHTML = '<p class="error">Error loading students.</p>';
    }
}

function createStudentCard(student) {
    const card = document.createElement('div');
    card.className = 'student-card';
    card.dataset.studentName = (student.name || '').toLowerCase();

    const initials = (student.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);

    card.innerHTML = `
        <div class="student-avatar">${initials}</div>
        <h3>${student.name || ''}</h3>
        <p class="student-details">
            <span><i class="fas fa-envelope"></i> ${student.email || 'No email'}</span>
            <span><i class="fas fa-phone"></i> ${student.phone || 'No phone'}</span>
        </p>
        <button class="btn-view" onclick="viewStudentDashboard('${student.id}')">
            <i class="fas fa-chart-line"></i> View Dashboard
        </button>`;
    return card;
}

function filterStudents(term) {
    const q = term.toLowerCase();
    document.querySelectorAll('.student-card').forEach(c => {
        c.style.display = c.dataset.studentName.includes(q) ? 'block' : 'none';
    });
}

window.viewStudentDashboard = async function (studentId) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;
    const modal = document.getElementById('studentModal');
    const dash = document.getElementById('studentDashboard');
    if (!modal || !dash) return;
    modal.style.display = 'block';
    dash.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>';

    try {
        const [summaryDoc, submissionsSnap] = await Promise.all([
            db.collection('attendance_summary').doc(student.id).get(),
            db.collection('submissions')
                .where('studentName', '==', student.name)
                .where('studentClass', '==', student.class)
                .where('studentSemester', '==', student.semester)
                .orderBy('submittedAt', 'desc').limit(5).get()
        ]);

        let totalClasses = 0, present = 0, absent = 0, late = 0;

        if (summaryDoc.exists) {
            const s = summaryDoc.data();
            totalClasses = s.totalClasses || 0;
            present = s.present || 0;
            absent = s.absent || 0;
            late = s.late || 0;
        } else {
            const attSnap = await db.collection('attendance')
                .where('studentName', '==', student.name)
                .where('class', '==', student.class)
                .where('semester', '==', student.semester).get();
            attSnap.forEach(doc => {
                totalClasses++;
                const st = doc.data().status;
                if (st === 'present') present++;
                else if (st === 'absent') absent++;
                else if (st === 'late') late++;
            });
        }

        const percentage = totalClasses > 0 ? ((present / totalClasses) * 100).toFixed(1) : 0;
        const submissions = [];
        submissionsSnap.forEach(d => submissions.push({ id: d.id, ...d.data() }));

        const graded = submissions.filter(s => s.marks !== null && s.marks !== undefined);
        const avgMarks = graded.length ? (graded.reduce((sum, s) => sum + s.marks, 0) / graded.length).toFixed(1) : 'N/A';

        dash.innerHTML = `
            <div class="dashboard-header">
                <h2>${student.name}'s Dashboard</h2>
                <p>Class ${student.class} - Semester ${student.semester}</p>
            </div>
            <div class="dashboard-stats">
                <div class="stat-item"><i class="fas fa-calendar-check"></i>
                    <div><span class="stat-value">${percentage}%</span><span class="stat-label">Attendance</span></div>
                </div>
                <div class="stat-item"><i class="fas fa-tasks"></i>
                    <div><span class="stat-value">${submissions.length}</span><span class="stat-label">Submissions</span></div>
                </div>
                <div class="stat-item"><i class="fas fa-star"></i>
                    <div><span class="stat-value">${avgMarks}</span><span class="stat-label">Avg Marks</span></div>
                </div>
            </div>
            <div class="recent-submissions">
                <h3>Recent Submissions</h3>
                ${submissions.length ? submissions.map(sub => {
                    const d = sub.submittedAt?.toDate?.() || new Date();
                    return `<div class="submission-item">
                        <div class="submission-info">
                            <span class="assignment-id">Assignment: ${sub.assignmentId || 'N/A'}</span>
                            <span class="submission-date">${d.toLocaleDateString()}</span>
                        </div>
                        <span class="submission-status ${sub.marks ? 'graded' : 'pending'}">${sub.marks ? `Marks: ${sub.marks}` : 'Pending'}</span>
                    </div>`;
                }).join('') : '<p>No submissions yet</p>'}
            </div>
            <div class="attendance-detail">
                <h3>Attendance Details</h3>
                <div class="attendance-grid">
                    <div class="detail-item"><span class="label">Total Classes:</span><span class="value">${totalClasses}</span></div>
                    <div class="detail-item"><span class="label">Present:</span><span class="value present">${present}</span></div>
                    <div class="detail-item"><span class="label">Absent:</span><span class="value absent">${absent}</span></div>
                    <div class="detail-item"><span class="label">Late:</span><span class="value late">${late}</span></div>
                </div>
                <div style="margin-top:10px;padding:8px;background:#e8f4fd;border-radius:4px;text-align:center;">
                    <strong>Attendance: ${percentage}%</strong>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="closeModal()">Close</button>
            </div>`;
    } catch (err) {
        console.error(err);
        dash.innerHTML = '<p class="error">Error loading student data</p>';
    }
};

function downloadStudentList() {
    if (!allStudents.length) { alert('No students to download'); return; }
    const cls = document.getElementById('classValue')?.textContent || '';
    const sem = document.getElementById('semesterValue')?.textContent || '';
    let csv = 'Name,Email,Phone,Class,Semester\n';
    allStudents.forEach(s => {
        csv += `${s.name},${s.email || ''},${s.phone || ''},${s.class},${s.semester}\n`;
    });
    downloadCSV(csv, `class-${cls}-sem-${sem}-students.csv`);
}

/* ---------------------------------------------------------
   6. HOMEWORK PAGE
   --------------------------------------------------------- */
let allAssignments = [];
let selectedFile = null;

function initHomeworkPage() {
    console.log('Homework page loaded');
    loadAssignments();
    document.getElementById('classFilter')?.addEventListener('change', updateHomeworkSemesterOptions);
    document.getElementById('applyFilters')?.addEventListener('click', filterAssignments);
    setupFileUpload();
    document.getElementById('submissionForm')?.addEventListener('submit', handleSubmission);
    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', closeAllModals));
    window.addEventListener('click', e => { if (e.target.classList.contains('modal')) closeAllModals(); });
    document.getElementById('studentSelect')?.addEventListener('change', validateSubmissionForm);
}

async function loadAssignments() {
    const grid = document.getElementById('assignmentsGrid');
    if (!grid) return;
    try {
        const snap = await db.collection('assignments')
            .where('status', '==', 'active')
            .orderBy('deadline', 'asc').get();

        if (snap.empty) { grid.innerHTML = '<p class="no-data">No assignments available</p>'; return; }
        grid.innerHTML = '';
        allAssignments = [];
        snap.forEach(doc => {
            const a = { id: doc.id, ...doc.data() };
            allAssignments.push(a);
            grid.appendChild(createAssignmentCard(a));
        });
        updateHomeworkSemesterOptions();
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p class="error">Error loading assignments</p>';
    }
}

function createAssignmentCard(a) {
    const card = document.createElement('div');
    card.className = 'assignment-card';
    const dl = a.deadline ? new Date(a.deadline) : new Date();
    const overdue = dl < new Date();
    const daysLeft = Math.ceil((dl - new Date()) / (1000 * 60 * 60 * 24));

    card.innerHTML = `
        <div class="assignment-header">
            <h3>${a.title || 'Untitled'}</h3>
            <span class="class-badge">Class ${a.class} - Sem ${a.semester}</span>
        </div>
        <p>${a.description || ''}</p>
        <div class="assignment-meta">
            <span><i class="fas fa-calendar-alt"></i> Deadline: ${dl.toLocaleDateString()}</span>
            <span><i class="fas fa-clock"></i> ${overdue ? 'Overdue' : daysLeft + ' days left'}</span>
        </div>
        <div class="assignment-actions">
            <a href="${a.driveLink || '#'}" target="_blank" class="btn btn-secondary"><i class="fas fa-download"></i> Download</a>
            <button class="btn btn-primary" onclick="openSubmissionModal('${a.id}')"><i class="fas fa-upload"></i> Submit</button>
        </div>`;
    return card;
}

function updateHomeworkSemesterOptions() {
    const cls = document.getElementById('classFilter')?.value;
    const sel = document.getElementById('semesterFilter');
    if (!sel) return;
    populateSemesterSelect(sel, cls, 'All Semesters');
}

function filterAssignments() {
    const c = document.getElementById('classFilter')?.value;
    const s = document.getElementById('semesterFilter')?.value;
    const grid = document.getElementById('assignmentsGrid');
    if (!grid) return;
    const filtered = allAssignments.filter(a => (!c || a.class === c) && (!s || a.semester == s));
    grid.innerHTML = filtered.length ? '' : '<p class="no-data">No assignments match filters</p>';
    filtered.forEach(a => grid.appendChild(createAssignmentCard(a)));
}

window.openSubmissionModal = async function (id) {
    const modal = document.getElementById('submissionModal');
    const a = allAssignments.find(x => x.id === id);
    if (!modal || !a) return;

    document.getElementById('assignmentId').value = id;
    document.getElementById('assignmentClass').value = a.class;
    document.getElementById('assignmentSemester').value = a.semester;
    document.getElementById('assignmentDetails').innerHTML = `
        <h3>${a.title}</h3>
        <p><strong>Class:</strong> ${a.class} - Semester ${a.semester}</p>
        <p><strong>Deadline:</strong> ${new Date(a.deadline).toLocaleDateString()}</p>`;

    const sel = document.getElementById('studentSelect');
    sel.innerHTML = '<option>Loading...</option>';
    sel.disabled = true;

    try {
        const snap = await db.collection('students')
            .where('class', '==', a.class)
            .where('semester', '==', a.semester)
            .orderBy('name').get();
        sel.innerHTML = '<option value="">-- Select your name --</option>';
        snap.forEach(d => sel.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
        if (snap.empty) sel.innerHTML = '<option value="">No students found</option>';
    } catch (err) {
        console.error(err);
        sel.innerHTML = '<option value="">Error loading students</option>';
    }
    sel.disabled = false;

    resetSubmissionForm();
    modal.style.display = 'block';
};

function setupFileUpload() {
    const area = document.getElementById('fileUploadArea');
    const input = document.getElementById('fileUpload');
    const removeBtn = document.getElementById('removeFile');
    if (!area || !input) return;
    area.addEventListener('click', () => input.click());
    input.addEventListener('change', e => { if (e.target.files[0]) validateAndSelectFile(e.target.files[0]); });
    removeBtn?.addEventListener('click', () => {
        selectedFile = null;
        input.value = '';
        document.getElementById('fileInfo').style.display = 'none';
        area.style.display = 'block';
        validateSubmissionForm();
    });
}

function validateAndSelectFile(file) {
    if (file.type !== 'application/pdf') { alert('Please select a PDF file only.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File size must be under 10MB.'); return; }
    selectedFile = file;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatBytes(file.size);
    document.getElementById('fileInfo').style.display = 'flex';
    document.getElementById('fileUploadArea').style.display = 'none';
    validateSubmissionForm();
}

function validateSubmissionForm() {
    const s = document.getElementById('studentSelect')?.value;
    const btn = document.getElementById('submitBtn');
    if (btn) btn.disabled = !(s && selectedFile);
}

async function handleSubmission(e) {
    e.preventDefault();
    const studentId = document.getElementById('studentSelect').value;
    const assignmentId = document.getElementById('assignmentId').value;
    const comments = document.getElementById('comments').value;

    if (!studentId || !selectedFile) { alert('Please select your name and a file'); return; }

    const btn = document.getElementById('submitBtn');
    const bar = document.getElementById('progressBar');
    const fill = document.getElementById('progressFill');
    btn.disabled = true;
    btn.innerHTML = 'Uploading...';
    bar.style.display = 'block';

    try {
        const studentDoc = await db.collection('students').doc(studentId).get();
        const student = studentDoc.data();
        fill.style.width = '30%'; fill.textContent = 'Preparing...';

        const base64 = await toBase64(selectedFile);
        fill.style.width = '60%'; fill.textContent = 'Uploading...';

        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                file: base64.split(',')[1],
                fileName: selectedFile.name,
                contentType: selectedFile.type,
                assignmentId, studentName: student.name,
                studentClass: student.class, studentSemester: student.semester,
                comments: comments || ''
            })
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message || 'Upload failed');

        fill.style.width = '100%'; fill.textContent = 'Done';
        document.getElementById('submissionForm').style.display = 'none';
        document.getElementById('submissionSuccess').style.display = 'block';
    } catch (err) {
        alert('Upload failed: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = 'Submit Assignment';
        bar.style.display = 'none';
    }
}

function resetSubmissionForm() {
    const f = document.getElementById('submissionForm');
    if (f) { f.reset(); f.style.display = 'block'; }
    document.getElementById('submissionSuccess').style.display = 'none';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('fileUploadArea').style.display = 'block';
    document.getElementById('progressBar').style.display = 'none';
    document.getElementById('submitBtn').disabled = true;
    selectedFile = null;
}

/* ---------------------------------------------------------
   7. ATTENDANCE PAGE
   --------------------------------------------------------- */
let attendanceChart = null;

function initAttendancePage() {
    console.log('Attendance page loaded');
    document.getElementById('checkClass')?.addEventListener('change', updateAttendanceSemesters);
    document.getElementById('checkSemester')?.addEventListener('change', updateAttendanceStudents);
    document.getElementById('attendanceForm')?.addEventListener('submit', handleAttendanceCheck);
    document.getElementById('downloadAttendance')?.addEventListener('click', downloadAttendanceReport);
}

function updateAttendanceSemesters() {
    const cls = document.getElementById('checkClass')?.value;
    const semSel = document.getElementById('checkSemester');
    const studSel = document.getElementById('checkStudent');
    populateSemesterSelect(semSel, cls, 'Select Semester');
    if (studSel) studSel.innerHTML = '<option value="">Select Student</option>';
}

async function updateAttendanceStudents() {
    const cls = document.getElementById('checkClass')?.value;
    const sem = document.getElementById('checkSemester')?.value;
    const sel = document.getElementById('checkStudent');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Student</option>';
    if (!cls || !sem) return;
    try {
        const snap = await db.collection('students')
            .where('class', '==', cls).where('semester', '==', sem)
            .orderBy('name').get();
        if (snap.empty) { sel.innerHTML = '<option value="">No students found</option>'; return; }
        snap.forEach(d => sel.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
    } catch (err) {
        console.error(err);
        sel.innerHTML = '<option value="">Error loading</option>';
    }
}

async function handleAttendanceCheck(e) {
    e.preventDefault();
    const sel = document.getElementById('checkStudent');
    const studentId = sel.value;
    const studentName = sel.selectedOptions[0]?.textContent || '';
    const cls = document.getElementById('checkClass').value;
    const sem = document.getElementById('checkSemester').value;
    if (!studentId) return;

    document.getElementById('studentNameDisplay').textContent = studentName;
    const res = document.getElementById('attendanceResults');
    const noData = document.getElementById('noData');
    res.style.display = 'none'; noData.style.display = 'none';

    try {
        const summaryDoc = await db.collection('attendance_summary').doc(studentId).get();
        let totalClasses = 0, present = 0, absent = 0, late = 0;

        if (summaryDoc.exists) {
            const s = summaryDoc.data();
            totalClasses = s.totalClasses || 0; present = s.present || 0;
            absent = s.absent || 0; late = s.late || 0;
        } else {
            const snap = await db.collection('attendance')
                .where('studentName', '==', studentName)
                .where('class', '==', cls).where('semester', '==', sem).get();
            if (snap.empty) { noData.style.display = 'block'; return; }
            snap.forEach(doc => {
                totalClasses++;
                const st = doc.data().status;
                if (st === 'present') present++;
                else if (st === 'absent') absent++;
                else if (st === 'late') late++;
            });
        }

        const pct = totalClasses > 0 ? ((present / totalClasses) * 100).toFixed(1) : 0;
        document.getElementById('totalClasses').textContent = totalClasses;
        document.getElementById('presentCount').textContent = present;
        document.getElementById('absentCount').textContent = absent;
        document.getElementById('lateCount').textContent = late;
        document.getElementById('attendancePercent').textContent = pct + '%';

        await loadAttendanceHistory(studentName, cls, sem);
        res.style.display = 'block';
    } catch (err) {
        console.error(err);
        alert('Error loading attendance');
    }
}

async function loadAttendanceHistory(name, cls, sem) {
    const tbody = document.getElementById('attendanceHistory');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
    try {
        const snap = await db.collection('attendance')
            .where('studentName', '==', name)
            .where('class', '==', cls).where('semester', '==', sem)
            .orderBy('date', 'desc').limit(30).get();
        if (snap.empty) { tbody.innerHTML = '<tr><td colspan="2">No records</td></tr>'; return; }
        tbody.innerHTML = '';
        snap.forEach(d => {
            const rec = d.data();
            const dt = rec.date ? new Date(rec.date) : new Date();
            tbody.innerHTML += `<tr><td>${dt.toLocaleDateString()}</td><td><span class="status-badge ${rec.status}">${rec.status}</span></td></tr>`;
        });
        await loadAttendanceChart(name, cls, sem);
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="2">Error loading</td></tr>';
    }
}

async function loadAttendanceChart(name, cls, sem) {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx || typeof Chart === 'undefined') return;
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        const from = sixMonthsAgo.toISOString().split('T')[0];

        const snap = await db.collection('attendance')
            .where('studentName', '==', name)
            .where('class', '==', cls).where('semester', '==', sem)
            .where('date', '>=', from).get();

        const monthly = {};
        const labels = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
            labels.push(key);
            monthly[key] = { present: 0, total: 0 };
        }

        snap.forEach(doc => {
            const r = doc.data();
            const d = new Date(r.date);
            const k = `${d.getMonth() + 1}/${d.getFullYear()}`;
            if (monthly[k]) {
                monthly[k].total++;
                if (r.status === 'present') monthly[k].present++;
            }
        });

        const data = labels.map(k => monthly[k].total ? ((monthly[k].present / monthly[k].total) * 100).toFixed(1) : 0);
        if (attendanceChart) attendanceChart.destroy();

        attendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Attendance %', data,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52,152,219,0.1)',
                    tension: 0.4, fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
        });
    } catch (err) { console.error(err); }
}

function downloadAttendanceReport() {
    const name = document.getElementById('studentNameDisplay').textContent;
    const rows = [];
    document.querySelectorAll('#attendanceHistory tr').forEach(r => {
        const c = r.querySelectorAll('td');
        if (c.length === 2 && c[0].textContent !== 'Loading...') rows.push([c[0].textContent, c[1].textContent]);
    });
    if (!rows.length) { alert('No data to download'); return; }
    let csv = 'Date,Status\n' + rows.map(r => r.join(',')).join('\n');
    downloadCSV(csv, `${name.replace(/\s+/g, '_')}_attendance.csv`);
}

/* ---------------------------------------------------------
   8. ADMIN PAGE
   --------------------------------------------------------- */
let allFeedback = [];   // ← REQUIRED: feedback array

function initAdminPage() {
    if (typeof auth === 'undefined' || !auth) return;

    auth.onAuthStateChanged(handleAuthState);

    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);

    document.addEventListener('click', e => {
        if (e.target.closest && e.target.closest('#logoutBtn')) {
            e.preventDefault(); handleLogout();
        }
    });

    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', switchTab));

    document.getElementById('addStudentBtn')?.addEventListener('click', () => openStudentModal());
    document.getElementById('studentForm')?.addEventListener('submit', handleStudentSubmit);
    document.getElementById('studentClass')?.addEventListener('change', updateStudentSemesterOptions);

    document.getElementById('studentSearch')?.addEventListener('input', filterStudentsTable);
    document.getElementById('filterClass')?.addEventListener('change', filterStudentsTable);

    document.getElementById('createAssignmentBtn')?.addEventListener('click', openAssignmentModal);
    document.getElementById('assignmentForm')?.addEventListener('submit', handleAssignmentSubmit);
    document.getElementById('assignmentClass')?.addEventListener('change', function () {
        populateSemesterSelect(document.getElementById('assignmentSemester'), this.value);
    });

    document.getElementById('attendanceClass')?.addEventListener('change', updateAttendanceAdminSemester);
    document.getElementById('loadStudents')?.addEventListener('click', loadAttendanceStudents);
    document.getElementById('saveAttendance')?.addEventListener('click', saveAttendance);
    document.getElementById('markAllPresent')?.addEventListener('click', markAllPresent);

    document.getElementById('filterAssignment')?.addEventListener('change', loadSubmissions);

    /* Feedback tab wiring */
    document.getElementById('feedbackSearch')?.addEventListener('input', renderFeedbackList);
    document.getElementById('feedbackRatingFilter')?.addEventListener('change', renderFeedbackList);
    document.getElementById('feedbackSort')?.addEventListener('change', renderFeedbackList);
    document.getElementById('exportFeedbackBtn')?.addEventListener('click', exportFeedbackCSV);

    const dateIn = document.getElementById('attendanceDate');
    if (dateIn) dateIn.valueAsDate = new Date();

    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', closeAllModals));
    window.addEventListener('click', e => { if (e.target.classList.contains('modal')) closeAllModals(); });
}

async function handleAuthState(user) {
    const loginSec = document.getElementById('loginSection');
    const dash = document.getElementById('adminDashboard');
    const adminUserDiv = document.querySelector('.admin-user');

    if (user) {
        try {
            const adminDoc = await db.collection('admins').doc(user.uid).get();
            if (adminDoc.exists) {
                loginSec.style.display = 'none';
                dash.style.display = 'block';
                const adminName = adminDoc.data().name;
                if (adminUserDiv) {
                    adminUserDiv.innerHTML = `
                        <span><i class="fas fa-user-shield"></i> ${adminName || user.email}</span>
                        <span style="margin:0 10px">|</span>
                        <span id="adminEmail">${user.email}</span>
                        <button id="logoutBtn" class="btn-logout"><i class="fas fa-sign-out-alt"></i> Logout</button>`;
                }
                loadDashboardStats();
                loadStudentsList();
                loadAssignmentsList();
                loadSubmissions();
                const dateDisp = document.getElementById('currentDate');
                if (dateDisp) dateDisp.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            } else {
                await auth.signOut();
                showLoginError('You are not authorized as admin');
            }
        } catch (err) {
            console.error(err);
            await auth.signOut();
            showLoginError('Error verifying admin access');
        }
    } else {
        loginSec.style.display = 'flex';
        dash.style.display = 'none';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pw = document.getElementById('password').value;
    const errDiv = document.getElementById('loginError');
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Logging in...';
    btn.disabled = true;
    try {
        await auth.signInWithEmailAndPassword(email, pw);
    } catch (err) {
        if (errDiv) {
            errDiv.style.display = 'block';
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password')
                errDiv.textContent = 'Invalid email or password';
            else if (err.code === 'auth/too-many-requests') errDiv.textContent = 'Too many attempts';
            else errDiv.textContent = 'Login failed';
        }
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
}

async function handleLogout() {
    try { await auth.signOut(); } catch (e) { alert('Error logging out'); }
}

function showLoginError(msg) {
    const d = document.getElementById('loginError');
    if (d) { d.textContent = msg; d.style.display = 'block'; }
}

function switchTab(e) {
    const tabId = e.target.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(`${tabId}Tab`)?.classList.add('active');

    // Lazy-load feedback when its tab is opened
    if (tabId === 'feedback') loadFeedbackList();
}

/* ---------------------------------------------------------
   8b. FEEDBACK VIEWER (ADMIN)
   --------------------------------------------------------- */
async function loadFeedbackList() {
    const list = document.getElementById('feedbackList');
    if (!list) return;

    list.innerHTML = '<p class="no-data">Loading feedback...</p>';

    try {
        // NO orderBy — fetch ALL docs, sort client-side
        // (orderBy excludes docs missing the field)
        const snap = await db.collection('feedback').get();

        console.log('Feedback docs fetched:', snap.size);

        allFeedback = [];
        snap.forEach(doc => {
            allFeedback.push({ id: doc.id, ...doc.data() });
        });

        // Normalize date field
        allFeedback.forEach(f => {
            f._date = extractDate(f);
        });

        // Sort newest first
        allFeedback.sort((a, b) => (b._date || 0) - (a._date || 0));

        updateFeedbackSummary();
        renderFeedbackList();

    } catch (err) {
        console.error('Load feedback error:', err);
        if (err.code === 'permission-denied') {
            list.innerHTML = '<p class="error">Permission denied — check Firestore rules. You must be logged in as admin.</p>';
        } else {
            list.innerHTML = '<p class="error">Error loading feedback: ' + err.message + '</p>';
        }
    }
}

function updateFeedbackSummary() {
    const total = allFeedback.length;
    const avgEl = document.getElementById('fbAvgRating');
    const totEl = document.getElementById('fbTotalCount');
    const recEl = document.getElementById('fbRecommendPct');

    if (totEl) totEl.textContent = total;

    if (total === 0) {
        if (avgEl) avgEl.textContent = '—';
        if (recEl) recEl.textContent = '—';
        return;
    }

    const rated = allFeedback.filter(f => typeof f.rating === 'number' && f.rating > 0);
    const avg = rated.length ? (rated.reduce((s, f) => s + f.rating, 0) / rated.length).toFixed(1) : '—';
    if (avgEl) avgEl.textContent = avg;

    const recYes = allFeedback.filter(f => f.recommend === 'Yes').length;
    if (recEl) recEl.textContent = Math.round((recYes / total) * 100) + '%';
}

function renderFeedbackList() {
    const list = document.getElementById('feedbackList');
    if (!list) return;

    const search = (document.getElementById('feedbackSearch')?.value || '').toLowerCase();
    const ratingFilter = document.getElementById('feedbackRatingFilter')?.value || '';
    const sort = document.getElementById('feedbackSort')?.value || 'newest';

    let items = allFeedback.filter(f => {
        if (ratingFilter && String(f.rating) !== ratingFilter) return false;
        if (search) {
            const hay = [f.liked, f.improvements, f.topics, f.overall, f.materials, f.explanations]
                .filter(Boolean).join(' ').toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    items = items.sort((a, b) => {
        if (sort === 'newest')  return (b._date || 0) - (a._date || 0);
        if (sort === 'oldest')  return (a._date || 0) - (b._date || 0);
        if (sort === 'highest') return (b.rating || 0) - (a.rating || 0);
        if (sort === 'lowest')  return (a.rating || 0) - (b.rating || 0);
        return 0;
    });

    if (items.length === 0) {
        list.innerHTML = '<p class="no-data">No feedback matches your filters.</p>';
        return;
    }

    list.innerHTML = items.map(buildFeedbackItemHTML).join('');
}

/* Robust date extraction — handles all the ways a date can be stored */
function extractDate(f) {
    const v = f.submittedAt ?? f.timestamp ?? f.createdAt ?? f.date;
    if (!v) return null;

    // Firestore Timestamp
    if (typeof v.toDate === 'function') {
        const d = v.toDate();
        return isNaN(d) ? null : d;
    }
    // ISO string / Date
    const d = new Date(v);
    return isNaN(d) ? null : d;
}

/* Build one feedback card */
function buildFeedbackItemHTML(f) {
    const dateStr = f._date
        ? f._date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Unknown date';

    const stars = [1, 2, 3, 4, 5].map(n =>
        `<i class="${n <= (f.rating || 0) ? 'fas' : 'far'} fa-star"></i>`
    ).join('');

    let borderClass = '';
    if (f.rating >= 4) borderClass = 'rating-high';
    else if (f.rating === 3) borderClass = 'rating-mid';
    else if (f.rating > 0) borderClass = 'rating-low';

    const goodVals = ['Excellent', 'Very Clear', 'Very Helpful', 'Amazing', 'Yes'];
    const badVals = ['Poor', 'Unclear', 'Not Helpful', 'Needs Improvement', 'No'];
    const chipClass = v => {
        if (!v) return 'fb-chip';
        if (goodVals.includes(v)) return 'fb-chip good';
        if (badVals.includes(v)) return 'fb-chip bad';
        return 'fb-chip warn';
    };

    const chips = [
        f.materials && `<span class="${chipClass(f.materials)}">📚 ${f.materials}</span>`,
        f.explanations && `<span class="${chipClass(f.explanations)}">🎓 ${f.explanations}</span>`,
        f.assignments && `<span class="${chipClass(f.assignments)}">📝 ${f.assignments}</span>`,
        f.attendanceSystem && `<span class="${chipClass(f.attendanceSystem)}">📅 ${f.attendanceSystem}</span>`,
        f.overall && `<span class="${chipClass(f.overall)}">⭐ ${f.overall}</span>`,
        f.recommend && `<span class="${chipClass(f.recommend)}">${f.recommend === 'Yes' ? '👍' : f.recommend === 'No' ? '👎' : '🤔'} ${f.recommend}</span>`
    ].filter(Boolean).join('');

    const block = (label, val) =>
        val ? `<div class="fb-text-block"><strong>${label}</strong><p>${escapeHTML(val)}</p></div>` : '';

    return `
        <div class="feedback-item ${borderClass}">
            <div class="fb-item-header">
                <span class="fb-item-stars">${stars} <span style="color:#666;font-size:.85rem;margin-left:.3rem">(${f.rating || 0}/5)</span></span>
                <span class="fb-item-date"><i class="far fa-clock"></i> ${dateStr}</span>
            </div>
            ${chips ? `<div class="fb-chips">${chips}</div>` : ''}
            ${block('💚 What they liked', f.liked)}
            ${block('🔧 Could improve', f.improvements)}
            ${block('📖 Topics needing help', f.topics)}
        </div>`;
}

/* Escape HTML to prevent XSS from user text */
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* Export feedback to CSV */
function exportFeedbackCSV() {
    if (!allFeedback.length) { alert('No feedback to export'); return; }

    const headers = [
        'Date', 'Rating', 'Materials', 'Explanations', 'Assignments',
        'Attendance System', 'Overall', 'Recommend',
        'Liked Most', 'Could Improve', 'Topics Needed'
    ];
    let csv = headers.join(',') + '\n';

    allFeedback.forEach(f => {
        const row = [
            f._date ? f._date.toLocaleString('en-IN') : '',
            f.rating || '',
            f.materials || '',
            f.explanations || '',
            f.assignments || '',
            f.attendanceSystem || '',
            f.overall || '',
            f.recommend || '',
            f.liked || '',
            f.improvements || '',
            f.topics || ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        csv += row + '\n';
    });

    downloadCSV(csv, `feedback-export-${new Date().toISOString().split('T')[0]}.csv`);
}

async function loadDashboardStats() {
    try {
        const [s, a, p, t] = await Promise.all([
            db.collection('students').get(),
            db.collection('assignments').get(),
            db.collection('submissions').where('status', '==', 'submitted').get(),
            db.collection('attendance').where('date', '==', new Date().toISOString().split('T')[0]).get()
        ]);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('totalStudents', s.size); set('totalAssignments', a.size);
        set('pendingSubmissions', p.size); set('todayClass', t.size);
    } catch (e) { console.error(e); }
}

async function loadStudentsList() {
    const tbody = document.getElementById('studentsList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    try {
        const snap = await db.collection('students').orderBy('name').get();
        if (snap.empty) { tbody.innerHTML = '<tr><td colspan="6" class="text-center">No students</td></tr>'; return; }
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const s = doc.data();
            tbody.innerHTML += `
                <tr data-id="${doc.id}">
                    <td>${s.name || ''}</td>
                    <td>${s.class || ''}</td>
                    <td>${s.semester || ''}</td>
                    <td>${s.email || '-'}</td>
                    <td>${s.phone || '-'}</td>
                    <td class="action-btns">
                        <button class="btn-icon edit" onclick="editStudent('${doc.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete" onclick="deleteStudent('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error(e); tbody.innerHTML = '<tr><td colspan="6" class="error">Error</td></tr>'; }
}

function filterStudentsTable() {
    const q = document.getElementById('studentSearch')?.value.toLowerCase() || '';
    const c = document.getElementById('filterClass')?.value || '';
    document.querySelectorAll('#studentsList tr').forEach(r => {
        const name = r.cells[0]?.textContent.toLowerCase() || '';
        const cls = r.cells[1]?.textContent || '';
        r.style.display = (name.includes(q) && (!c || cls === c)) ? '' : 'none';
    });
}

function openStudentModal(data = null) {
    const modal = document.getElementById('studentModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('studentForm');
    if (!modal) return;
    form.reset();
    document.getElementById('studentId').value = '';
    if (data) {
        title.textContent = 'Edit Student';
        document.getElementById('studentId').value = data.id;
        document.getElementById('studentName').value = data.name || '';
        document.getElementById('studentClass').value = data.class || '11';
        updateStudentSemesterOptions();
        setTimeout(() => { document.getElementById('studentSemester').value = data.semester || 1; }, 30);
        document.getElementById('studentEmail').value = data.email || '';
        document.getElementById('studentPhone').value = data.phone || '';
    } else {
        title.textContent = 'Add Student';
        document.getElementById('studentClass').value = '11';
        updateStudentSemesterOptions();
    }
    modal.style.display = 'block';
}

function updateStudentSemesterOptions() {
    const cls = document.getElementById('studentClass')?.value;
    const sel = document.getElementById('studentSemester');
    populateSemesterSelect(sel, cls);
}

async function handleStudentSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('studentId').value;
    const name = document.getElementById('studentName').value;
    const cls = document.getElementById('studentClass').value;
    const sem = document.getElementById('studentSemester').value;
    const email = document.getElementById('studentEmail').value;
    const phone = document.getElementById('studentPhone').value;
    if (!name || !cls || !sem) { alert('Please fill required fields'); return; }

    const data = { name, class: cls, semester: sem, email: email || '', phone: phone || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    try {
        if (id) await db.collection('students').doc(id).update(data);
        else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('students').add(data); }
        closeAllModals();
        loadStudentsList();
        loadDashboardStats();
        showNotification('Student saved', 'success');
    } catch (err) { alert('Error: ' + err.message); }
}

window.editStudent = async function (id) {
    const d = await db.collection('students').doc(id).get();
    if (d.exists) openStudentModal({ id: d.id, ...d.data() });
};

window.deleteStudent = async function (id) {
    if (!confirm('Delete this student?')) return;
    try {
        await db.collection('students').doc(id).delete();
        loadStudentsList(); loadDashboardStats();
        showNotification('Deleted', 'success');
    } catch (e) { alert(e.message); }
};

async function loadAssignmentsList() {
    const c = document.getElementById('assignmentsList');
    if (!c) return;
    c.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i></div>';
    try {
        const snap = await db.collection('assignments').orderBy('createdAt', 'desc').get();
        if (snap.empty) { c.innerHTML = '<p class="no-data">No assignments</p>'; return; }
        c.innerHTML = '';
        snap.forEach(doc => {
            const a = doc.data();
            c.innerHTML += `
                <div class="assignment-card admin">
                    <div class="assignment-header">
                        <h3>${a.title || ''}</h3>
                        <span class="class-badge">Class ${a.class} - Sem ${a.semester}</span>
                    </div>
                    <p>${a.description || ''}</p>
                    <div class="assignment-meta">
                        <span><i class="fas fa-calendar"></i> ${a.deadline ? new Date(a.deadline).toLocaleDateString() : 'N/A'}</span>
                        <span><i class="fas fa-star"></i> Marks: ${a.totalMarks || 'N/A'}</span>
                    </div>
                    <div class="assignment-actions">
                        <a href="${a.driveLink || '#'}" target="_blank" class="btn btn-secondary btn-sm"><i class="fas fa-external-link-alt"></i></a>
                        <button class="btn btn-danger btn-sm" onclick="deleteAssignment('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
        updateAssignmentFilter();
    } catch (e) { console.error(e); c.innerHTML = '<p class="error">Error</p>'; }
}

function openAssignmentModal() {
    const m = document.getElementById('assignmentModal');
    if (m) {
        m.style.display = 'block';
        document.getElementById('assignmentForm').reset();
        updateAssignmentSemesterOptions();
    }
}

function updateAssignmentSemesterOptions() {
    const cls = document.getElementById('assignmentClass')?.value || '11';
    populateSemesterSelect(document.getElementById('assignmentSemester'), cls);
}

async function handleAssignmentSubmit(e) {
    e.preventDefault();
    const data = {
        title: document.getElementById('assignmentTitle').value,
        description: document.getElementById('assignmentDesc').value,
        class: document.getElementById('assignmentClass').value,
        semester: document.getElementById('assignmentSemester').value,
        deadline: document.getElementById('assignmentDeadline').value,
        driveLink: document.getElementById('assignmentDriveLink').value,
        totalMarks: parseInt(document.getElementById('totalMarks').value) || null,
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        await db.collection('assignments').add(data);
        closeAllModals(); loadAssignmentsList(); loadDashboardStats();
        showNotification('Assignment created', 'success');
    } catch (err) { alert(err.message); }
}

window.deleteAssignment = async function (id) {
    if (!confirm('Delete this assignment?')) return;
    try {
        await db.collection('assignments').doc(id).delete();
        loadAssignmentsList();
        showNotification('Deleted', 'success');
    } catch (e) { alert(e.message); }
};

function updateAttendanceAdminSemester() {
    const c = document.getElementById('attendanceClass')?.value;
    const sel = document.getElementById('attendanceSemester');
    populateSemesterSelect(sel, c, 'Select Semester');
}

async function loadAttendanceStudents() {
    const c = document.getElementById('attendanceClass')?.value;
    const s = document.getElementById('attendanceSemester')?.value;
    const d = document.getElementById('attendanceDate')?.value;
    if (!c || !s || !d) { alert('Select class, semester and date'); return; }

    const tbody = document.getElementById('attendanceList');
    const cont = document.getElementById('attendanceTableContainer');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Loading...</td></tr>';
    cont.style.display = 'block';

    try {
        const [studSnap, attSnap] = await Promise.all([
            db.collection('students').where('class', '==', c).where('semester', '==', s).get(),
            db.collection('attendance').where('date', '==', d).where('class', '==', c).where('semester', '==', s).get()
        ]);
        if (studSnap.empty) { tbody.innerHTML = '<tr><td colspan="3" class="text-center">No students</td></tr>'; return; }

        const map = new Map();
        attSnap.forEach(doc => map.set(doc.data().studentName, doc.data().status));

        tbody.innerHTML = '';
        studSnap.forEach(doc => {
            const st = doc.data();
            const cur = map.get(st.name) || 'present';
            tbody.innerHTML += `
                <tr data-student-name="${st.name}">
                    <td>${st.name}</td>
                    <td>
                        <select class="attendance-status">
                            <option value="present" ${cur === 'present' ? 'selected' : ''}>Present</option>
                            <option value="absent" ${cur === 'absent' ? 'selected' : ''}>Absent</option>
                            <option value="late" ${cur === 'late' ? 'selected' : ''}>Late</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn-icon" onclick="markSingleAttendance(this,'present')"><i class="fas fa-check-circle"></i></button>
                        <button class="btn-icon" onclick="markSingleAttendance(this,'absent')"><i class="fas fa-times-circle"></i></button>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error(e); tbody.innerHTML = '<tr><td colspan="3">Error</td></tr>'; }
}

window.markSingleAttendance = function (btn, status) {
    const sel = btn.closest('tr').querySelector('.attendance-status');
    if (sel) sel.value = status;
};

function markAllPresent() {
    document.querySelectorAll('.attendance-status').forEach(s => s.value = 'present');
}

async function saveAttendance() {
    const c = document.getElementById('attendanceClass')?.value;
    const s = document.getElementById('attendanceSemester')?.value;
    const d = document.getElementById('attendanceDate')?.value;
    if (!c || !s || !d) { alert('Missing fields'); return; }

    const rows = document.querySelectorAll('#attendanceList tr');
    if (!rows.length) { alert('No students'); return; }

    const batch = db.batch();
    rows.forEach(r => {
        const name = r.dataset.studentName;
        const status = r.querySelector('.attendance-status').value;
        batch.set(db.collection('attendance').doc(), {
            date: d, class: c, semester: s, studentName: name, status,
            markedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    });

    try {
        await batch.commit();
        showNotification('Attendance saved', 'success');
    } catch (e) { alert(e.message); }
}

async function loadSubmissions() {
    const f = document.getElementById('filterAssignment')?.value;
    const g = document.getElementById('submissionsGrid');
    if (!g) return;
    g.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i></div>';
    try {
        let q = db.collection('submissions').orderBy('submittedAt', 'desc');
        if (f) q = q.where('assignmentId', '==', f);
        const snap = await q.get();
        if (snap.empty) { g.innerHTML = '<p class="no-data">No submissions</p>'; return; }
        g.innerHTML = '';
        snap.forEach(doc => {
            const s = doc.data();
            const dt = s.submittedAt?.toDate?.() || new Date();
            g.innerHTML += `
                <div class="submission-card">
                    <div class="submission-header">
                        <h3>${s.studentName || ''}</h3>
                        <span class="status-badge ${s.status || ''}">${s.status || 'submitted'}</span>
                    </div>
                    <div class="submission-details">
                        <p><i class="fas fa-book"></i> ${s.assignmentId || ''}</p>
                        <p><i class="fas fa-calendar"></i> ${dt.toLocaleDateString()}</p>
                        <p><i class="fas fa-star"></i> ${s.marks || 'Not graded'}</p>
                    </div>
                    <a href="${s.driveLink || '#'}" target="_blank" class="submission-link"><i class="fab fa-google-drive"></i> View</a>
                    <div class="submission-actions">
                        <button class="btn btn-primary btn-sm" onclick="openGradeModal('${doc.id}')"><i class="fas fa-star"></i> Grade</button>
                    </div>
                </div>`;
        });
    } catch (e) { console.error(e); g.innerHTML = '<p class="error">Error</p>'; }
}

async function updateAssignmentFilter() {
    const sel = document.getElementById('filterAssignment');
    if (!sel) return;
    sel.innerHTML = '<option value="">All Assignments</option>';
    const snap = await db.collection('assignments').get();
    snap.forEach(doc => sel.innerHTML += `<option value="${doc.id}">${doc.data().title || ''}</option>`);
}

window.openGradeModal = async function (id) {
    const m = document.getElementById('gradeModal');
    const d = await db.collection('submissions').doc(id).get();
    if (!d.exists) return;
    const s = d.data();
    document.getElementById('gradeSubmissionId').value = id;
    document.getElementById('obtainedMarks').value = s.marks || '';
    document.getElementById('gradeFeedback').value = s.feedback || '';
    document.getElementById('submissionInfo').innerHTML = `
        <p><strong>Student:</strong> ${s.studentName || ''}</p>
        <p><strong>Assignment:</strong> ${s.assignmentId || ''}</p>`;
    m.style.display = 'block';
    document.getElementById('gradeForm').onsubmit = async function (e) {
        e.preventDefault();
        const marks = parseFloat(document.getElementById('obtainedMarks').value);
        const fb = document.getElementById('gradeFeedback').value;
        try {
            await db.collection('submissions').doc(id).update({
                marks, feedback: fb, status: 'graded',
                gradedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            closeAllModals(); loadSubmissions();
            showNotification('Grade saved', 'success');
        } catch (err) { alert(err.message); }
    };
};

window.generateReport = function (type) {
    if (type === 'attendance') generateAttendanceReport();
    else if (type === 'marks') generateMarksReport();
    else if (type === 'performance') generatePerformanceReport();
};

async function generateAttendanceReport() {
    const snap = await db.collection('attendance_summary').get();
    let csv = 'Student Name,Class,Semester,Total,Present,Absent,Late,Percentage\n';
    snap.forEach(doc => {
        const d = doc.data();
        csv += `${d.studentName || ''},${d.class || ''},${d.semester || ''},${d.totalClasses || 0},${d.present || 0},${d.absent || 0},${d.late || 0},${d.percentage || 0}%\n`;
    });
    downloadCSV(csv, 'attendance-report.csv');
}

async function generateMarksReport() {
    const snap = await db.collection('submissions').where('status', '==', 'graded').get();
    let csv = 'Student,Assignment,Marks,Feedback,Date\n';
    snap.forEach(doc => {
        const d = doc.data();
        csv += `${d.studentName || ''},${d.assignmentId || ''},${d.marks || ''},${d.feedback || ''},${d.submittedAt?.toDate?.().toLocaleDateString() || ''}\n`;
    });
    downloadCSV(csv, 'marks-report.csv');
}

async function generatePerformanceReport() {
    const studentsSnap = await db.collection('students').get();
    let csv = 'Name,Class,Semester,Attendance %,Submissions,Avg Marks\n';
    for (const doc of studentsSnap.docs) {
        const s = doc.data();
        const attDoc = await db.collection('attendance_summary').doc(doc.id).get();
        const att = attDoc.exists ? attDoc.data().percentage || 0 : 0;
        const subSnap = await db.collection('submissions').where('studentName', '==', s.name).where('status', '==', 'graded').get();
        let avg = 0, count = subSnap.size;
        if (count) {
            let t = 0;
            subSnap.forEach(d => t += d.data().marks || 0);
            avg = (t / count).toFixed(1);
        }
        csv += `${s.name || ''},${s.class || ''},${s.semester || ''},${att}%,${count},${avg}\n`;
    }
    downloadCSV(csv, 'performance-report.csv');
}

/* ---------------------------------------------------------
   9. INITIALISATION DISPATCHER
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    setupMobileMenu();

    const page = document.body.dataset.page;
    switch (page) {
        case 'home':       initHomePage(); break;
        case 'feedback':   initFeedbackPage(); break;
        case 'semester':   initSemesterPage(); break;
        case 'homework':   initHomeworkPage(); break;
        case 'attendance': initAttendancePage(); break;
        case 'admin':      initAdminPage(); break;
        default: console.log('No page init for:', page);
    }
});
