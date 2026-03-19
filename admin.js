// admin.js
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication state
    firebase.auth().onAuthStateChanged(handleAuthState);
    
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });
    
    // Student modal
    document.getElementById('addStudentBtn').addEventListener('click', () => openStudentModal());
    document.getElementById('studentForm').addEventListener('submit', handleStudentSubmit);
    
    // Student search and filter
    document.getElementById('studentSearch').addEventListener('input', filterStudents);
    document.getElementById('filterClass').addEventListener('change', filterStudents);
    
    // Assignment modal
    document.getElementById('createAssignmentBtn').addEventListener('click', () => openAssignmentModal());
    document.getElementById('assignmentForm').addEventListener('submit', handleAssignmentSubmit);
    
    // Attendance
    document.getElementById('attendanceClass').addEventListener('change', updateAttendanceSemester);
    document.getElementById('loadStudents').addEventListener('click', loadAttendanceStudents);
    document.getElementById('saveAttendance').addEventListener('click', saveAttendance);
    document.getElementById('markAllPresent').addEventListener('click', markAllPresent);
    
    // Submission filter
    document.getElementById('filterAssignment').addEventListener('change', loadSubmissions);
    
    // Set today's date for attendance
    document.getElementById('attendanceDate').valueAsDate = new Date();
    
    // Modal close handlers
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
});

// Auth State Handler
function handleAuthState(user) {
    const loginSection = document.getElementById('loginSection');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminEmail = document.getElementById('adminEmail');
    
    if (user) {
        // User is signed in
        loginSection.style.display = 'none';
        adminDashboard.style.display = 'block';
        adminEmail.textContent = user.email;
        
        // Load dashboard data
        loadDashboardStats();
        loadStudentsList();
        loadAssignmentsList();
        loadSubmissions();
        
    } else {
        // User is signed out
        loginSection.style.display = 'flex';
        adminDashboard.style.display = 'none';
    }
}

// Login Handler
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        errorDiv.style.display = 'none';
    } catch (error) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'Invalid email or password';
    }
}

// Logout Handler
function handleLogout() {
    firebase.auth().signOut();
}

// Tab Switching
function switchTab(e) {
    const tabId = e.target.dataset.tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`${tabId}Tab`).classList.add('active');
}

// Dashboard Stats
async function loadDashboardStats() {
    try {
        // Total students
        const studentsSnap = await db.collection('students').get();
        document.getElementById('totalStudents').textContent = studentsSnap.size;
        
        // Total assignments
        const assignmentsSnap = await db.collection('assignments').get();
        document.getElementById('totalAssignments').textContent = assignmentsSnap.size;
        
        // Pending submissions
        const submissionsSnap = await db.collection('submissions')
            .where('status', '==', 'submitted')
            .get();
        document.getElementById('pendingSubmissions').textContent = submissionsSnap.size;
        
        // Today's class (count of classes with attendance marked today)
        const today = new Date().toISOString().split('T')[0];
        const attendanceSnap = await db.collection('attendance')
            .where('date', '==', today)
            .get();
        document.getElementById('todayClass').textContent = attendanceSnap.size;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Student Management
async function loadStudentsList() {
    const tbody = document.getElementById('studentsList');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    
    try {
        const snapshot = await db.collection('students').orderBy('name').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No students found</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const student = doc.data();
            const row = document.createElement('tr');
            row.dataset.id = doc.id;
            row.innerHTML = `
                <td>${student.name}</td>
                <td>${student.class}</td>
                <td>${student.semester}</td>
                <td>${student.email || '-'}</td>
                <td>${student.phone || '-'}</td>
                <td class="action-btns">
                    <button class="btn-icon edit" onclick="editStudent('${doc.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteStudent('${doc.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading students:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="error">Error loading students</td></tr>';
    }
}

function filterStudents() {
    const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
    const classFilter = document.getElementById('filterClass').value;
    
    const rows = document.querySelectorAll('#studentsList tr');
    
    rows.forEach(row => {
        const name = row.cells[0]?.textContent.toLowerCase() || '';
        const studentClass = row.cells[1]?.textContent || '';
        
        const matchesSearch = name.includes(searchTerm);
        const matchesClass = !classFilter || studentClass === classFilter;
        
        row.style.display = matchesSearch && matchesClass ? '' : 'none';
    });
}

function openStudentModal(studentData = null) {
    const modal = document.getElementById('studentModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('studentForm');
    
    if (studentData) {
        title.textContent = 'Edit Student';
        document.getElementById('studentId').value = studentData.id;
        document.getElementById('studentName').value = studentData.name;
        document.getElementById('studentClass').value = studentData.class;
        document.getElementById('studentSemester').value = studentData.semester;
        document.getElementById('studentEmail').value = studentData.email || '';
        document.getElementById('studentPhone').value = studentData.phone || '';
    } else {
        title.textContent = 'Add Student';
        form.reset();
        document.getElementById('studentId').value = '';
    }
    
    // Update semester options based on class
    updateSemesterOptions(studentData?.class);
    
    modal.style.display = 'block';
}

function updateSemesterOptions(selectedClass = '11') {
    const classSelect = document.getElementById('studentClass');
    const semesterSelect = document.getElementById('studentSemester');
    
    semesterSelect.innerHTML = '';
    
    const semesters = classSelect.value === 'BSc' ? 8 : 2;
    for (let i = 1; i <= semesters; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterSelect.appendChild(option);
    }
}

async function handleStudentSubmit(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('studentId').value;
    const studentData = {
        name: document.getElementById('studentName').value,
        class: document.getElementById('studentClass').value,
        semester: document.getElementById('studentSemester').value,
        email: document.getElementById('studentEmail').value,
        phone: document.getElementById('studentPhone').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (studentId) {
            // Update existing student
            await db.collection('students').doc(studentId).update(studentData);
        } else {
            // Add new student
            studentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('students').add(studentData);
        }
        
        closeModal();
        loadStudentsList();
        loadDashboardStats();
        
    } catch (error) {
        console.error('Error saving student:', error);
        alert('Error saving student');
    }
}

window.editStudent = async function(studentId) {
    try {
        const doc = await db.collection('students').doc(studentId).get();
        if (doc.exists) {
            openStudentModal({ id: doc.id, ...doc.data() });
        }
    } catch (error) {
        console.error('Error loading student:', error);
    }
};

window.deleteStudent = async function(studentId) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    try {
        await db.collection('students').doc(studentId).delete();
        loadStudentsList();
        loadDashboardStats();
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('Error deleting student');
    }
};

// Assignment Management
async function loadAssignmentsList() {
    const container = document.getElementById('assignmentsList');
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i></div>';
    
    try {
        const snapshot = await db.collection('assignments')
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="no-data">No assignments created yet</p>';
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const assignment = doc.data();
            const card = document.createElement('div');
            card.className = 'assignment-card admin';
            card.innerHTML = `
                <div class="assignment-header">
                    <h3>${assignment.title}</h3>
                    <span class="class-badge">Class ${assignment.class} - Sem ${assignment.semester}</span>
                </div>
                <p>${assignment.description}</p>
                <div class="assignment-meta">
                    <span><i class="fas fa-calendar"></i> Deadline: ${new Date(assignment.deadline).toLocaleDateString()}</span>
                    <span><i class="fas fa-star"></i> Marks: ${assignment.totalMarks || 'N/A'}</span>
                </div>
                <div class="assignment-actions">
                    <a href="${assignment.driveLink}" target="_blank" class="btn btn-secondary btn-sm">
                        <i class="fas fa-external-link-alt"></i> View
                    </a>
                    <button class="btn btn-danger btn-sm" onclick="deleteAssignment('${doc.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
        
        // Update assignment filter in submissions tab
        updateAssignmentFilter();
        
    } catch (error) {
        console.error('Error loading assignments:', error);
        container.innerHTML = '<p class="error">Error loading assignments</p>';
    }
}

function openAssignmentModal() {
    document.getElementById('assignmentModal').style.display = 'block';
    document.getElementById('assignmentForm').reset();
}

async function handleAssignmentSubmit(e) {
    e.preventDefault();
    
    const assignmentData = {
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
        await db.collection('assignments').add(assignmentData);
        closeModal();
        loadAssignmentsList();
        loadDashboardStats();
    } catch (error) {
        console.error('Error creating assignment:', error);
        alert('Error creating assignment');
    }
}

window.deleteAssignment = async function(assignmentId) {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    
    try {
        await db.collection('assignments').doc(assignmentId).delete();
        loadAssignmentsList();
    } catch (error) {
        console.error('Error deleting assignment:', error);
    }
};

// Attendance Management
function updateAttendanceSemester() {
    const classVal = document.getElementById('attendanceClass').value;
    const semesterSelect = document.getElementById('attendanceSemester');
    
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';
    
    if (!classVal) return;
    
    const semesters = classVal === 'BSc' ? 8 : 2;
    for (let i = 1; i <= semesters; i++) {
        semesterSelect.innerHTML += `<option value="${i}">Semester ${i}</option>`;
    }
}

async function loadAttendanceStudents() {
    const classVal = document.getElementById('attendanceClass').value;
    const semesterVal = document.getElementById('attendanceSemester').value;
    const date = document.getElementById('attendanceDate').value;
    
    if (!classVal || !semesterVal || !date) {
        alert('Please select class, semester, and date');
        return;
    }
    
    const tbody = document.getElementById('attendanceList');
    const container = document.getElementById('attendanceTableContainer');
    
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Loading...</td></tr>';
    container.style.display = 'block';
    
    try {
        // Load students
        const studentsSnap = await db.collection('students')
            .where('class', '==', classVal)
            .where('semester', '==', semesterVal)
            .get();
        
        if (studentsSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">No students found</td></tr>';
            return;
        }
        
        // Load existing attendance for this date
        const attendanceSnap = await db.collection('attendance')
            .where('date', '==', date)
            .where('class', '==', classVal)
            .where('semester', '==', semesterVal)
            .get();
        
        const attendanceMap = new Map();
        attendanceSnap.forEach(doc => {
            const data = doc.data();
            attendanceMap.set(data.studentName, data.status);
        });
        
        tbody.innerHTML = '';
        studentsSnap.forEach(doc => {
            const student = doc.data();
            const existingStatus = attendanceMap.get(student.name) || 'present';
            
            const row = document.createElement('tr');
            row.dataset.studentName = student.name;
            row.innerHTML = `
                <td>${student.name}</td>
                <td>
                    <select class="attendance-status" data-student="${student.name}">
                        <option value="present" ${existingStatus === 'present' ? 'selected' : ''}>Present</option>
                        <option value="absent" ${existingStatus === 'absent' ? 'selected' : ''}>Absent</option>
                        <option value="late" ${existingStatus === 'late' ? 'selected' : ''}>Late</option>
                    </select>
                </td>
                <td>
                    <button class="btn-icon" onclick="markSingleAttendance(this, 'present')">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="btn-icon" onclick="markSingleAttendance(this, 'absent')">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading attendance students:', error);
        tbody.innerHTML = '<tr><td colspan="3" class="error">Error loading students</td></tr>';
    }
}

window.markSingleAttendance = function(btn, status) {
    const row = btn.closest('tr');
    const select = row.querySelector('.attendance-status');
    select.value = status;
};

function markAllPresent() {
    document.querySelectorAll('.attendance-status').forEach(select => {
        select.value = 'present';
    });
}

async function saveAttendance() {
    const classVal = document.getElementById('attendanceClass').value;
    const semesterVal = document.getElementById('attendanceSemester').value;
    const date = document.getElementById('attendanceDate').value;
    
    if (!classVal || !semesterVal || !date) return;
    
    const batch = db.batch();
    const rows = document.querySelectorAll('#attendanceList tr');
    
    // Track attendance counts for summary
    const attendanceCounts = {
        present: 0,
        absent: 0,
        late: 0,
        total: rows.length
    };
    
    rows.forEach(row => {
        const studentName = row.dataset.studentName;
        const status = row.querySelector('.attendance-status').value;
        
        // Update counts
        attendanceCounts[status]++;
        
        // Create attendance record
        const attendanceRef = db.collection('attendance').doc();
        batch.set(attendanceRef, {
            date: date,
            class: classVal,
            semester: semesterVal,
            studentName: studentName,
            status: status,
            markedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    
    try {
        await batch.commit();
        
        // Update attendance summaries for each student
        await updateAttendanceSummaries(classVal, semesterVal, attendanceCounts);
        
        alert('Attendance saved successfully!');
        
    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('Error saving attendance');
    }
}

async function updateAttendanceSummaries(classVal, semesterVal, counts) {
    // Get all students in this class/semester
    const studentsSnap = await db.collection('students')
        .where('class', '==', classVal)
        .where('semester', '==', semesterVal)
        .get();
    
    const batch = db.batch();
    
    studentsSnap.forEach(doc => {
        const summaryRef = db.collection('attendance_summary').doc(doc.id);
        
        // Get current summary or create new one
        batch.set(summaryRef, {
            studentId: doc.id,
            studentName: doc.data().name,
            class: classVal,
            semester: semesterVal,
            totalClasses: firebase.firestore.FieldValue.increment(1),
            present: firebase.firestore.FieldValue.increment(counts.present / counts.total || 0),
            absent: firebase.firestore.FieldValue.increment(counts.absent / counts.total || 0),
            late: firebase.firestore.FieldValue.increment(counts.late / counts.total || 0),
            percentage: firebase.firestore.FieldValue.increment(0) // Calculate based on individual student
        }, { merge: true });
    });
    
    await batch.commit();
}

// Submissions Management
async function loadSubmissions() {
    const filter = document.getElementById('filterAssignment').value;
    const grid = document.getElementById('submissionsGrid');
    
    grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i></div>';
    
    try {
        let query = db.collection('submissions').orderBy('submittedAt', 'desc');
        
        if (filter) {
            query = query.where('assignmentId', '==', filter);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            grid.innerHTML = '<p class="no-data">No submissions found</p>';
            return;
        }
        
        grid.innerHTML = '';
        snapshot.forEach(doc => {
            const submission = doc.data();
            const card = createSubmissionCard(doc.id, submission);
            grid.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading submissions:', error);
        grid.innerHTML = '<p class="error">Error loading submissions</p>';
    }
}

function createSubmissionCard(id, submission) {
    const card = document.createElement('div');
    card.className = 'submission-card';
    card.dataset.id = id;
    
    const submittedDate = submission.submittedAt?.toDate?.() || new Date();
    
    card.innerHTML = `
        <div class="submission-header">
            <h3>${submission.studentName}</h3>
            <span class="status-badge ${submission.status}">${submission.status}</span>
        </div>
        
        <div class="submission-details">
            <p><i class="fas fa-book"></i> Assignment: ${submission.assignmentId}</p>
            <p><i class="fas fa-calendar"></i> Submitted: ${submittedDate.toLocaleDateString()}</p>
            <p><i class="fas fa-star"></i> Marks: ${submission.marks || 'Not graded'}</p>
        </div>
        
        <a href="${submission.driveLink}" target="_blank" class="submission-link">
            <i class="fab fa-google-drive"></i> View Submission
        </a>
        
        <div class="submission-actions">
            <button class="btn btn-primary btn-sm" onclick="openGradeModal('${id}')">
                <i class="fas fa-star"></i> Grade
            </button>
        </div>
    `;
    
    return card;
}

async function updateAssignmentFilter() {
    const select = document.getElementById('filterAssignment');
    select.innerHTML = '<option value="">All Assignments</option>';
    
    const snapshot = await db.collection('assignments').get();
    snapshot.forEach(doc => {
        const assignment = doc.data();
        select.innerHTML += `<option value="${doc.id}">${assignment.title}</option>`;
    });
}

window.openGradeModal = async function(submissionId) {
    const modal = document.getElementById('gradeModal');
    const doc = await db.collection('submissions').doc(submissionId).get();
    
    if (!doc.exists) return;
    
    const submission = doc.data();
    
    document.getElementById('gradeSubmissionId').value = submissionId;
    document.getElementById('obtainedMarks').value = submission.marks || '';
    document.getElementById('gradeFeedback').value = submission.feedback || '';
    
    document.getElementById('submissionInfo').innerHTML = `
        <p><strong>Student:</strong> ${submission.studentName}</p>
        <p><strong>Assignment:</strong> ${submission.assignmentId}</p>
        <p><strong>Submitted:</strong> ${submission.submittedAt?.toDate?.().toLocaleDateString()}</p>
    `;
    
    modal.style.display = 'block';
    
    // Setup grade form
    document.getElementById('gradeForm').onsubmit = async function(e) {
        e.preventDefault();
        
        const marks = parseFloat(document.getElementById('obtainedMarks').value);
        const feedback = document.getElementById('gradeFeedback').value;
        
        try {
            await db.collection('submissions').doc(submissionId).update({
                marks: marks,
                feedback: feedback,
                status: 'graded',
                gradedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            closeModal();
            loadSubmissions();
            
        } catch (error) {
            console.error('Error grading submission:', error);
            alert('Error saving grade');
        }
    };
};

// Reports
window.generateReport = function(type) {
    switch(type) {
        case 'attendance':
            generateAttendanceReport();
            break;
        case 'marks':
            generateMarksReport();
            break;
        case 'performance':
            generatePerformanceReport();
            break;
    }
};

async function generateAttendanceReport() {
    const snapshot = await db.collection('attendance_summary').get();
    
    let csv = 'Student Name,Class,Semester,Total Classes,Present,Absent,Late,Percentage\n';
    
    snapshot.forEach(doc => {
        const data = doc.data();
        csv += `${data.studentName},${data.class},${data.semester},${data.totalClasses || 0},${data.present || 0},${data.absent || 0},${data.late || 0},${data.percentage || 0}%\n`;
    });
    
    downloadCSV(csv, 'attendance-report.csv');
}

async function generateMarksReport() {
    const snapshot = await db.collection('submissions')
        .where('status', '==', 'graded')
        .get();
    
    let csv = 'Student Name,Assignment ID,Marks,Feedback,Submitted Date\n';
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.submittedAt?.toDate?.().toLocaleDateString() || '';
        csv += `${data.studentName},${data.assignmentId},${data.marks},${data.feedback || ''},${date}\n`;
    });
    
    downloadCSV(csv, 'marks-report.csv');
}

async function generatePerformanceReport() {
    // Get all students
    const studentsSnap = await db.collection('students').get();
    
    let csv = 'Student Name,Class,Semester,Attendance %,Assignments Submitted,Average Marks\n';
    
    for (const doc of studentsSnap.docs) {
        const student = doc.data();
        
        // Get attendance
        const attendanceDoc = await db.collection('attendance_summary').doc(doc.id).get();
        const attendance = attendanceDoc.exists ? attendanceDoc.data().percentage || 0 : 0;
        
        // Get submissions
        const submissionsSnap = await db.collection('submissions')
            .where('studentName', '==', student.name)
            .where('status', '==', 'graded')
            .get();
        
        const submissionsCount = submissionsSnap.size;
        
        // Calculate average marks
        let avgMarks = 0;
        if (submissionsCount > 0) {
            let totalMarks = 0;
            submissionsSnap.forEach(sub => {
                totalMarks += sub.data().marks || 0;
            });
            avgMarks = (totalMarks / submissionsCount).toFixed(1);
        }
        
        csv += `${student.name},${student.class},${student.semester},${attendance}%,${submissionsCount},${avgMarks}\n`;
    }
    
    downloadCSV(csv, 'performance-report.csv');
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

// Modal helper
function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}