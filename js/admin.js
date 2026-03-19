// admin.js - COMPLETE FIXED VERSION

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication state
    firebase.auth().onAuthStateChanged(handleAuthState);
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout button - using event delegation
    document.addEventListener('click', function(e) {
        if (e.target.closest && e.target.closest('#logoutBtn')) {
            e.preventDefault();
            handleLogout(e);
        }
    });
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });
    
    // Student modal
    const addStudentBtn = document.getElementById('addStudentBtn');
    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', function() {
            openStudentModal();
        });
    }
    
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
        studentForm.addEventListener('submit', handleStudentSubmit);
    }
    
    // FIXED: Add event listener for class change in student modal
    const studentClassSelect = document.getElementById('studentClass');
    if (studentClassSelect) {
        studentClassSelect.addEventListener('change', function() {
            updateSemesterOptions();
        });
    }
    
    // Student search and filter
    const studentSearch = document.getElementById('studentSearch');
    if (studentSearch) {
        studentSearch.addEventListener('input', filterStudents);
    }
    
    const filterClass = document.getElementById('filterClass');
    if (filterClass) {
        filterClass.addEventListener('change', filterStudents);
    }
    
    // Assignment modal
    const createAssignmentBtn = document.getElementById('createAssignmentBtn');
    if (createAssignmentBtn) {
        createAssignmentBtn.addEventListener('click', () => openAssignmentModal());
    }
    
    const assignmentForm = document.getElementById('assignmentForm');
    if (assignmentForm) {
        assignmentForm.addEventListener('submit', handleAssignmentSubmit);
    }
    
    // FIXED: Add event listener for assignment class change
    const assignmentClassSelect = document.getElementById('assignmentClass');
    if (assignmentClassSelect) {
        assignmentClassSelect.addEventListener('change', function() {
            const classVal = this.value;
            const semesterSelect = document.getElementById('assignmentSemester');
            if (semesterSelect) {
                semesterSelect.innerHTML = '';
                const semesters = classVal === 'BSc' ? 8 : 2;
                for (let i = 1; i <= semesters; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = `Semester ${i}`;
                    semesterSelect.appendChild(option);
                }
            }
        });
    }
    
    // Attendance
    const attendanceClass = document.getElementById('attendanceClass');
    if (attendanceClass) {
        attendanceClass.addEventListener('change', updateAttendanceSemester);
    }
    
    const loadStudentsBtn = document.getElementById('loadStudents');
    if (loadStudentsBtn) {
        loadStudentsBtn.addEventListener('click', loadAttendanceStudents);
    }
    
    const saveAttendanceBtn = document.getElementById('saveAttendance');
    if (saveAttendanceBtn) {
        saveAttendanceBtn.addEventListener('click', saveAttendance);
    }
    
    const markAllPresentBtn = document.getElementById('markAllPresent');
    if (markAllPresentBtn) {
        markAllPresentBtn.addEventListener('click', markAllPresent);
    }
    
    // Submission filter
    const filterAssignment = document.getElementById('filterAssignment');
    if (filterAssignment) {
        filterAssignment.addEventListener('change', loadSubmissions);
    }
    
    // Set today's date for attendance
    const attendanceDate = document.getElementById('attendanceDate');
    if (attendanceDate) {
        attendanceDate.valueAsDate = new Date();
    }
    
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

// ============================================
// AUTHENTICATION
// ============================================

// Auth State Handler
async function handleAuthState(user) {
    const loginSection = document.getElementById('loginSection');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminEmail = document.getElementById('adminEmail');
    
    if (user) {
        try {
            // Check if user is admin
            const adminDoc = await db.collection('admins').doc(user.uid).get();
            
            if (adminDoc.exists) {
                // User is admin
                loginSection.style.display = 'none';
                adminDashboard.style.display = 'block';
                if (adminEmail) {
                    adminEmail.textContent = user.email;
                }
                
                // Load dashboard data
                loadDashboardStats();
                loadStudentsList();
                loadAssignmentsList();
                loadSubmissions();
            } else {
                // Not an admin
                await firebase.auth().signOut();
                showLoginError('You are not authorized as an admin');
            }
        } catch (error) {
            console.error('Error checking admin:', error);
            await firebase.auth().signOut();
            showLoginError('Error verifying admin access');
        }
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
    const loginBtn = e.target.querySelector('button[type="submit"]');
    
    if (!loginBtn) return;
    
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Logging in...';
    loginBtn.disabled = true;
    
    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        if (errorDiv) errorDiv.style.display = 'none';
    } catch (error) {
        console.error('Login error:', error);
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'Invalid email or password';
        }
    } finally {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

// Logout Handler
async function handleLogout(e) {
    e.preventDefault();
    try {
        await firebase.auth().signOut();
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out');
    }
}

// Helper for login errors
function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// ============================================
// TAB SWITCHING
// ============================================

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

// ============================================
// DASHBOARD STATS
// ============================================

async function loadDashboardStats() {
    try {
        // Total students
        const studentsSnap = await db.collection('students').get();
        const totalStudents = document.getElementById('totalStudents');
        if (totalStudents) totalStudents.textContent = studentsSnap.size;
        
        // Total assignments
        const assignmentsSnap = await db.collection('assignments').get();
        const totalAssignments = document.getElementById('totalAssignments');
        if (totalAssignments) totalAssignments.textContent = assignmentsSnap.size;
        
        // Pending submissions
        const submissionsSnap = await db.collection('submissions')
            .where('status', '==', 'submitted')
            .get();
        const pendingSubmissions = document.getElementById('pendingSubmissions');
        if (pendingSubmissions) pendingSubmissions.textContent = submissionsSnap.size;
        
        // Today's class
        const today = new Date().toISOString().split('T')[0];
        const attendanceSnap = await db.collection('attendance')
            .where('date', '==', today)
            .get();
        const todayClass = document.getElementById('todayClass');
        if (todayClass) todayClass.textContent = attendanceSnap.size;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============================================
// STUDENT MANAGEMENT - FIXED
// ============================================

async function loadStudentsList() {
    const tbody = document.getElementById('studentsList');
    if (!tbody) return;
    
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
                <td>${student.name || ''}</td>
                <td>${student.class || ''}</td>
                <td>${student.semester || ''}</td>
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
    const searchTerm = document.getElementById('studentSearch')?.value.toLowerCase() || '';
    const classFilter = document.getElementById('filterClass')?.value || '';
    
    const rows = document.querySelectorAll('#studentsList tr');
    
    rows.forEach(row => {
        const name = row.cells[0]?.textContent.toLowerCase() || '';
        const studentClass = row.cells[1]?.textContent || '';
        
        const matchesSearch = name.includes(searchTerm);
        const matchesClass = !classFilter || studentClass === classFilter;
        
        row.style.display = matchesSearch && matchesClass ? '' : 'none';
    });
}

// FIXED: openStudentModal function
function openStudentModal(studentData = null) {
    const modal = document.getElementById('studentModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('studentForm');
    
    if (!modal || !title || !form) {
        console.error('Modal elements not found');
        return;
    }
    
    // Reset form
    form.reset();
    document.getElementById('studentId').value = '';
    
    if (studentData) {
        title.textContent = 'Edit Student';
        document.getElementById('studentId').value = studentData.id || '';
        document.getElementById('studentName').value = studentData.name || '';
        document.getElementById('studentClass').value = studentData.class || '11';
        
        // Update semester options first
        updateSemesterOptions();
        
        // Then set the semester value after a tiny delay to ensure options are loaded
        setTimeout(() => {
            const semesterSelect = document.getElementById('studentSemester');
            if (semesterSelect && studentData.semester) {
                semesterSelect.value = studentData.semester;
            }
        }, 50);
        
        document.getElementById('studentEmail').value = studentData.email || '';
        document.getElementById('studentPhone').value = studentData.phone || '';
    } else {
        title.textContent = 'Add Student';
        document.getElementById('studentId').value = '';
        document.getElementById('studentClass').value = '11';
        updateSemesterOptions();
    }
    
    modal.style.display = 'block';
}

// FIXED: updateSemesterOptions function
function updateSemesterOptions() {
    const classSelect = document.getElementById('studentClass');
    const semesterSelect = document.getElementById('studentSemester');
    
    if (!classSelect || !semesterSelect) {
        console.error('Class or semester select not found');
        return;
    }
    
    // Clear existing options
    semesterSelect.innerHTML = '';
    
    // Get selected class value
    const selectedClass = classSelect.value;
    
    // Determine number of semesters based on class
    let semesters = 2; // default for Class 11 and 12
    if (selectedClass === 'BSc') {
        semesters = 8;
    }
    
    // Populate semester options
    for (let i = 1; i <= semesters; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterSelect.appendChild(option);
    }
    
    console.log(`Updated semester options for class ${selectedClass}: ${semesters} semesters`);
}

// FIXED: handleStudentSubmit function
async function handleStudentSubmit(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('studentId').value;
    const studentName = document.getElementById('studentName').value;
    const studentClass = document.getElementById('studentClass').value;
    const studentSemester = document.getElementById('studentSemester').value;
    const studentEmail = document.getElementById('studentEmail').value;
    const studentPhone = document.getElementById('studentPhone').value;
    
    // Validate required fields
    if (!studentName || !studentClass || !studentSemester) {
        alert('Please fill in all required fields');
        return;
    }
    
    const studentData = {
        name: studentName,
        class: studentClass,
        semester: studentSemester,
        email: studentEmail || '',
        phone: studentPhone || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (studentId) {
            // Update existing student
            await db.collection('students').doc(studentId).update(studentData);
            alert('Student updated successfully');
        } else {
            // Add new student
            studentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('students').add(studentData);
            alert('Student added successfully');
        }
        
        closeModal();
        loadStudentsList();
        loadDashboardStats();
        
    } catch (error) {
        console.error('Error saving student:', error);
        alert('Error saving student: ' + error.message);
    }
}

// Student Edit and Delete functions
window.editStudent = async function(studentId) {
    try {
        const doc = await db.collection('students').doc(studentId).get();
        if (doc.exists) {
            openStudentModal({ id: doc.id, ...doc.data() });
        }
    } catch (error) {
        console.error('Error loading student:', error);
        alert('Error loading student');
    }
};

window.deleteStudent = async function(studentId) {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) return;
    
    try {
        await db.collection('students').doc(studentId).delete();
        loadStudentsList();
        loadDashboardStats();
        alert('Student deleted successfully');
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('Error deleting student: ' + error.message);
    }
};

// ============================================
// ASSIGNMENT MANAGEMENT
// ============================================

async function loadAssignmentsList() {
    const container = document.getElementById('assignmentsList');
    if (!container) return;
    
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
                    <h3>${assignment.title || ''}</h3>
                    <span class="class-badge">Class ${assignment.class || ''} - Sem ${assignment.semester || ''}</span>
                </div>
                <p>${assignment.description || ''}</p>
                <div class="assignment-meta">
                    <span><i class="fas fa-calendar"></i> Deadline: ${assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : 'N/A'}</span>
                    <span><i class="fas fa-star"></i> Marks: ${assignment.totalMarks || 'N/A'}</span>
                </div>
                <div class="assignment-actions">
                    <a href="${assignment.driveLink || '#'}" target="_blank" class="btn btn-secondary btn-sm">
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
    const modal = document.getElementById('assignmentModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('assignmentForm').reset();
    }
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
        alert('Assignment created successfully');
    } catch (error) {
        console.error('Error creating assignment:', error);
        alert('Error creating assignment: ' + error.message);
    }
}

window.deleteAssignment = async function(assignmentId) {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    
    try {
        await db.collection('assignments').doc(assignmentId).delete();
        loadAssignmentsList();
        alert('Assignment deleted successfully');
    } catch (error) {
        console.error('Error deleting assignment:', error);
        alert('Error deleting assignment: ' + error.message);
    }
};

// ============================================
// ATTENDANCE MANAGEMENT
// ============================================

function updateAttendanceSemester() {
    const classVal = document.getElementById('attendanceClass')?.value;
    const semesterSelect = document.getElementById('attendanceSemester');
    
    if (!semesterSelect) return;
    
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';
    
    if (!classVal) return;
    
    const semesters = classVal === 'BSc' ? 8 : 2;
    for (let i = 1; i <= semesters; i++) {
        semesterSelect.innerHTML += `<option value="${i}">Semester ${i}</option>`;
    }
}

// Continue with other functions (attendance, submissions, reports)...
// [Previous functions remain the same]

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Modal helper
function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}
