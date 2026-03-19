// admin.js - COMPLETE FIXED VERSION

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication state
    firebase.auth().onAuthStateChanged(handleAuthState);
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // FIXED: Event delegation for logout button (handles dynamically created button)
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
    document.getElementById('addStudentBtn').addEventListener('click', () => openStudentModal());
    document.getElementById('studentForm').addEventListener('submit', handleStudentSubmit);
    
    // FIXED: Event listener for class change in student modal
    const studentClassSelect = document.getElementById('studentClass');
    if (studentClassSelect) {
        studentClassSelect.addEventListener('change', function() {
            updateSemesterOptions();
        });
    }
    
    // Student search and filter
    document.getElementById('studentSearch').addEventListener('input', filterStudents);
    document.getElementById('filterClass').addEventListener('change', filterStudents);
    
    // Assignment modal
    document.getElementById('createAssignmentBtn').addEventListener('click', () => openAssignmentModal());
    document.getElementById('assignmentForm').addEventListener('submit', handleAssignmentSubmit);
    
    // FIXED: Event listener for class change in assignment modal
    const assignmentClassSelect = document.getElementById('assignmentClass');
    if (assignmentClassSelect) {
        assignmentClassSelect.addEventListener('change', function() {
            const classVal = this.value;
            const semesterSelect = document.getElementById('assignmentSemester');
            
            semesterSelect.innerHTML = '';
            
            const semesters = classVal === 'BSc' ? 8 : 2;
            for (let i = 1; i <= semesters; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Semester ${i}`;
                semesterSelect.appendChild(option);
            }
        });
    }
    
    // Attendance
    document.getElementById('attendanceClass').addEventListener('change', updateAttendanceSemester);
    document.getElementById('loadStudents').addEventListener('click', loadAttendanceStudents);
    document.getElementById('saveAttendance').addEventListener('click', saveAttendance);
    document.getElementById('markAllPresent').addEventListener('click', markAllPresent);
    
    // Submission filter
    document.getElementById('filterAssignment').addEventListener('change', loadSubmissions);
    
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
    
    // Check if any admins exist (for first-time setup)
    checkFirstAdmin();
});

// ============================================
// AUTHENTICATION & ADMIN VERIFICATION
// ============================================

// Check if first admin needs to be created
async function checkFirstAdmin() {
    try {
        const snapshot = await db.collection('admins').limit(1).get();
        
        if (snapshot.empty) {
            // No admins found, show setup option
            showFirstTimeSetup();
        }
    } catch (error) {
        console.error('Error checking admins:', error);
    }
}

// Show first-time setup UI
function showFirstTimeSetup() {
    const loginCard = document.querySelector('.login-card');
    if (!loginCard) return;
    
    // Check if setup notice already exists
    if (document.getElementById('firstTimeSetup')) return;
    
    const setupHtml = `
        <div id="firstTimeSetup" class="setup-notice" style="margin-top: 20px; padding: 20px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #1976d2;">
            <h3 style="color: #1976d2; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-rocket"></i> First Time Setup
            </h3>
            <p style="margin-bottom: 15px; color: #555;">No admin users found. Create your first admin account to get started.</p>
            
            <form id="firstAdminForm" style="margin-top: 15px;">
                <div style="margin-bottom: 10px;">
                    <input type="text" id="setupName" placeholder="Full Name" required 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <input type="email" id="setupEmail" placeholder="Email" required 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="password" id="setupPassword" placeholder="Password (min. 6 characters)" required 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="display: flex; gap: 10px;">
                    <button type="submit" style="flex: 1; padding: 10px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-user-plus"></i> Create Admin Account
                    </button>
                </div>
            </form>
            
            <div id="setupMessage" style="margin-top: 10px; display: none;"></div>
        </div>
    `;
    
    loginCard.insertAdjacentHTML('beforeend', setupHtml);
    
    // Add event listener for first admin form
    document.getElementById('firstAdminForm').addEventListener('submit', createFirstAdmin);
}

// Create first admin user
async function createFirstAdmin(e) {
    e.preventDefault();
    
    const name = document.getElementById('setupName').value;
    const email = document.getElementById('setupEmail').value;
    const password = document.getElementById('setupPassword').value;
    const messageDiv = document.getElementById('setupMessage');
    
    // Validation
    if (password.length < 6) {
        showSetupMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        showSetupMessage('Creating admin account...', 'info');
        
        // Create user in Firebase Authentication
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update profile with name
        await user.updateProfile({
            displayName: name
        });
        
        // Add to admins collection
        await db.collection('admins').doc(user.uid).set({
            name: name,
            email: email,
            role: 'superadmin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: 'system'
        });
        
        showSetupMessage('Admin created successfully! Redirecting to dashboard...', 'success');
        
        // Clear and hide setup form
        setTimeout(() => {
            document.getElementById('firstTimeSetup').style.display = 'none';
        }, 2000);
        
    } catch (error) {
        console.error('Error creating admin:', error);
        
        let errorMessage = 'Error creating admin. ';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage += 'Email already exists.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage += 'Password is too weak.';
        } else {
            errorMessage += error.message;
        }
        
        showSetupMessage(errorMessage, 'error');
    }
}

// Helper for setup messages
function showSetupMessage(message, type) {
    const messageDiv = document.getElementById('setupMessage');
    messageDiv.style.display = 'block';
    messageDiv.textContent = message;
    
    // Style based on type
    messageDiv.style.padding = '10px';
    messageDiv.style.borderRadius = '4px';
    
    if (type === 'error') {
        messageDiv.style.background = '#ffebee';
        messageDiv.style.color = '#c62828';
        messageDiv.style.border = '1px solid #ef9a9a';
    } else if (type === 'success') {
        messageDiv.style.background = '#e8f5e8';
        messageDiv.style.color = '#2e7d32';
        messageDiv.style.border = '1px solid #a5d6a7';
    } else {
        messageDiv.style.background = '#e3f2fd';
        messageDiv.style.color = '#1565c0';
        messageDiv.style.border = '1px solid #90caf9';
    }
}

// Auth State Handler (UPDATED with admin verification)
async function handleAuthState(user) {
    const loginSection = document.getElementById('loginSection');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminUserDiv = document.querySelector('.admin-user');
    
    if (user) {
        try {
            // Check if user is an admin
            const adminDoc = await db.collection('admins').doc(user.uid).get();
            
            if (adminDoc.exists) {
                // User is admin - show dashboard
                loginSection.style.display = 'none';
                adminDashboard.style.display = 'block';
                
                // Display admin name if available
                const adminName = adminDoc.data().name;
                if (adminName && adminUserDiv) {
                    adminUserDiv.innerHTML = `
                        <span><i class="fas fa-user-shield"></i> ${adminName}</span>
                        <span style="margin: 0 10px">|</span>
                        <span id="adminEmail">${user.email}</span>
                        <button id="logoutBtn" class="btn-logout">
                            <i class="fas fa-sign-out-alt"></i> Logout
                        </button>
                    `;
                }
                
                // Load dashboard data
                loadDashboardStats();
                loadStudentsList();
                loadAssignmentsList();
                loadSubmissions();
                
                // Update date display
                const dateDisplay = document.getElementById('currentDate');
                if (dateDisplay) {
                    dateDisplay.textContent = new Date().toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                }
            } else {
                // User exists but not in admins collection
                console.log('User not authorized as admin');
                await firebase.auth().signOut();
                showLoginError('You are not authorized as an admin');
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            await firebase.auth().signOut();
            showLoginError('Error verifying admin access');
        }
    } else {
        // User is signed out
        loginSection.style.display = 'flex';
        adminDashboard.style.display = 'none';
    }
}

// Login Handler (UPDATED with better error messages)
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    // Show loading state
    const loginBtn = e.target.querySelector('button[type="submit"]');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Logging in...';
    loginBtn.disabled = true;
    
    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        errorDiv.style.display = 'none';
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.style.display = 'block';
        
        // User-friendly error messages
        switch(error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorDiv.textContent = 'Invalid email or password';
                break;
            case 'auth/too-many-requests':
                errorDiv.textContent = 'Too many failed attempts. Please try again later';
                break;
            case 'auth/network-request-failed':
                errorDiv.textContent = 'Network error. Please check your connection';
                break;
            default:
                errorDiv.textContent = 'Login failed. Please try again';
        }
    } finally {
        // Restore button
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

// Helper function to show login errors
function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// FIXED: Logout Handler
async function handleLogout(e) {
    e.preventDefault();
    
    try {
        // Show loading state on button if possible
        const logoutBtn = e.target.closest ? e.target.closest('#logoutBtn') : e.target;
        if (logoutBtn && logoutBtn.tagName === 'BUTTON') {
            const originalText = logoutBtn.innerHTML;
            logoutBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Logging out...';
            logoutBtn.disabled = true;
            
            await firebase.auth().signOut();
            
            // Reset button (though page will change)
            logoutBtn.innerHTML = originalText;
            logoutBtn.disabled = false;
        } else {
            await firebase.auth().signOut();
        }
        
        // Force redirect to login section
        document.getElementById('loginSection').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
        
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out: ' + error.message);
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
    
    // Reload data for the tab if needed
    if (tabId === 'submissions') {
        loadSubmissions();
    } else if (tabId === 'assignments') {
        loadAssignmentsList();
    }
}

// ============================================
// DASHBOARD STATS
// ============================================

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
        
        // Today's class (count of students with attendance marked today)
        const today = new Date().toISOString().split('T')[0];
        const attendanceSnap = await db.collection('attendance')
            .where('date', '==', today)
            .get();
        document.getElementById('todayClass').textContent = attendanceSnap.size;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============================================
// STUDENT MANAGEMENT - FIXED
// ============================================

// FIXED: openStudentModal function
function openStudentModal(studentData = null) {
    const modal = document.getElementById('studentModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('studentForm');
    
    if (!modal || !title || !form) return;
    
    if (studentData) {
        title.textContent = 'Edit Student';
        document.getElementById('studentId').value = studentData.id;
        document.getElementById('studentName').value = studentData.name;
        document.getElementById('studentClass').value = studentData.class;
        
        // Update semester options based on selected class
        updateSemesterOptions();
        
        // Set semester after options are populated
        setTimeout(() => {
            document.getElementById('studentSemester').value = studentData.semester;
        }, 50);
        
        document.getElementById('studentEmail').value = studentData.email || '';
        document.getElementById('studentPhone').value = studentData.phone || '';
    } else {
        title.textContent = 'Add Student';
        form.reset();
        document.getElementById('studentId').value = '';
        
        // Update semester options (defaults to Class 11)
        updateSemesterOptions();
    }
    
    modal.style.display = 'block';
}

// FIXED: updateSemesterOptions function
function updateSemesterOptions() {
    const classSelect = document.getElementById('studentClass');
    const semesterSelect = document.getElementById('studentSemester');
    
    if (!classSelect || !semesterSelect) return;
    
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
    const studentData = {
        name: document.getElementById('studentName').value,
        class: document.getElementById('studentClass').value,
        semester: document.getElementById('studentSemester').value,
        email: document.getElementById('studentEmail').value,
        phone: document.getElementById('studentPhone').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Validate that semester is selected
    if (!studentData.semester) {
        alert('Please select a semester');
        return;
    }
    
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

// FIXED: loadStudentsList function
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

// KEPT: Student Edit and Delete functions
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

// KEPT: Delete student function
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
                    <button class="btn-icon" onclick="markSingleAttendance(this, 'present')" title="Mark Present">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="btn-icon" onclick="markSingleAttendance(this, 'absent')" title="Mark Absent">
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
    
    if (rows.length === 0) {
        alert('No students to mark attendance for');
        return;
    }
    
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
        alert('Error saving attendance: ' + error.message);
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
            present: firebase.firestore.FieldValue.increment(counts.present),
            absent: firebase.firestore.FieldValue.increment(counts.absent),
            late: firebase.firestore.FieldValue.increment(counts.late),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
    
    await batch.commit();
    
    // Update percentages
    const updateBatch = db.batch();
    studentsSnap.forEach(doc => {
        const summaryRef = db.collection('attendance_summary').doc(doc.id);
        const totalClasses = counts.total;
        const present = counts.present;
        const percentage = totalClasses > 0 ? (present / totalClasses * 100).toFixed(1) : 0;
        
        updateBatch.update(summaryRef, {
            percentage: parseFloat(percentage)
        });
    });
    
    try {
        await updateBatch.commit();
    } catch (error) {
        console.error('Error updating percentages:', error);
    }
}

// ============================================
// SUBMISSIONS MANAGEMENT
// ============================================

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
    if (!select) return;
    
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
        <p><strong>Assignment ID:</strong> ${submission.assignmentId}</p>
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
            alert('Grade saved successfully');
            
        } catch (error) {
            console.error('Error grading submission:', error);
            alert('Error saving grade: ' + error.message);
        }
    };
};

// ============================================
// REPORTS
// ============================================

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
    alert('Attendance report generated');
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
    alert('Marks report generated');
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
    alert('Performance report generated');
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

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Modal helper
function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}
