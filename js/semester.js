// semester.js

// Get class and semester from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const className = urlParams.get('class') || '11';
const semesterValue = urlParams.get('semester') || '1';

// Update page title
document.getElementById('classValue').textContent = className;
document.getElementById('semesterValue').textContent = semesterValue;

// Global variables
let allStudents = [];
let currentStudentId = null;

// Load students on page load
document.addEventListener('DOMContentLoaded', function() {
    loadStudents();
    setupEventListeners();
    loadDashboardStats();
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchStudent').addEventListener('input', function(e) {
        filterStudents(e.target.value);
    });

    // Take attendance button
    document.getElementById('takeAttendance').addEventListener('click', function(e) {
        e.preventDefault();
        takeAttendance();
    });

    // Download list button
    document.getElementById('downloadList').addEventListener('click', function(e) {
        e.preventDefault();
        downloadStudentList();
    });

    // Close modal when clicking X
    document.querySelector('.close-modal').addEventListener('click', function() {
        document.getElementById('studentModal').style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('studentModal');
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Load students from Firestore
async function loadStudents() {
    try {
        console.log('Loading students for class:', className, 'semester:', semesterValue);
        
        // Show loading spinner
        document.querySelector('.loading-spinner').style.display = 'block';
        document.getElementById('noStudents').style.display = 'none';
        
        // Query students based on class and semester
        const studentsRef = db.collection('students');
        const snapshot = await studentsRef
            .where('class', '==', className)
            .where('semester', '==', semesterValue)
            .get();
        
        if (snapshot.empty) {
            console.log('No students found');
            document.querySelector('.loading-spinner').style.display = 'none';
            document.getElementById('noStudents').style.display = 'block';
            document.getElementById('totalStudents').textContent = '0';
            return;
        }
        
        // Clear existing students
        allStudents = [];
        
        // Process each student document
        snapshot.forEach(doc => {
            const studentData = doc.data();
            const student = {
                id: doc.id,
                ...studentData
            };
            allStudents.push(student);
        });
        
        console.log('Loaded students:', allStudents);
        
        // Update total students count
        document.getElementById('totalStudents').textContent = allStudents.length;
        
        // Display students
        displayStudents(allStudents);
        
        // Hide loading spinner
        document.querySelector('.loading-spinner').style.display = 'none';
        
    } catch (error) {
        console.error('Error loading students:', error);
        showError('Failed to load students. Please refresh the page.');
        
        // Hide loading spinner and show error
        document.querySelector('.loading-spinner').style.display = 'none';
        document.getElementById('noStudents').style.display = 'block';
        document.getElementById('noStudents').innerHTML = `
            <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
            <h3>Error Loading Students</h3>
            <p>${error.message}</p>
            <button onclick="loadStudents()" class="btn btn-primary">Try Again</button>
        `;
    }
}

// Display students in grid
function displayStudents(students) {
    const grid = document.getElementById('studentsGrid');
    const noStudents = document.getElementById('noStudents');
    
    if (students.length === 0) {
        grid.innerHTML = '';
        noStudents.style.display = 'block';
        return;
    }
    
    noStudents.style.display = 'none';
    
    let html = '';
    students.forEach(student => {
        // Get initials for avatar
        const initials = getInitials(student.name);
        
        html += `
            <div class="student-card" onclick="showStudentDashboard('${student.id}')">
                <div class="student-avatar" style="background: ${getAvatarColor(student.id)}">
                    ${initials}
                </div>
                <h3>${student.name || 'Unknown'}</h3>
                <div class="student-details">
                    <span><i class="fas fa-id-card"></i> Roll: ${student.rollNumber || 'N/A'}</span>
                    <span><i class="fas fa-envelope"></i> ${student.email || 'No email'}</span>
                    <span><i class="fas fa-phone"></i> ${student.phone || 'No phone'}</span>
                </div>
                <button class="btn-view" onclick="event.stopPropagation(); showStudentDashboard('${student.id}')">
                    <i class="fas fa-chart-line"></i> View Dashboard
                </button>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// Filter students based on search
function filterStudents(searchTerm) {
    if (!searchTerm.trim()) {
        displayStudents(allStudents);
        return;
    }
    
    const filtered = allStudents.filter(student => 
        (student.name && student.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (student.email && student.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (student.rollNumber && student.rollNumber.toString().includes(searchTerm))
    );
    
    displayStudents(filtered);
}

// Get initials from name
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// Generate consistent color based on student ID
function getAvatarColor(id) {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
}

// Show student dashboard modal
async function showStudentDashboard(studentId) {
    try {
        currentStudentId = studentId;
        
        // Show modal with loading
        document.getElementById('studentModal').style.display = 'block';
        document.getElementById('studentDashboard').innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-circle-notch fa-spin"></i>
                <p>Loading student data...</p>
            </div>
        `;
        
        // Fetch student data
        const studentDoc = await db.collection('students').doc(studentId).get();
        
        if (!studentDoc.exists) {
            throw new Error('Student not found');
        }
        
        const studentData = studentDoc.data();
        const studentName = studentData.name || '';
        
        // Fetch submissions for this student
        const submissionsSnapshot = await db.collection('submissions')
            .where('studentId', '==', studentId)
            .orderBy('submittedAt', 'desc')
            .limit(5)
            .get();
        
        // Fetch attendance for this student - USING STUDENT NAME, CLASS, AND SEMESTER
        // This matches the attendance.js approach
        const attendanceSnapshot = await db.collection('attendance')
            .where('studentName', '==', studentName)
            .where('class', '==', className)
            .where('semester', '==', semesterValue)
            .orderBy('date', 'desc')
            .limit(30)
            .get();
        
        // Also try to get from attendance_summary if available (faster)
        let totalClasses = 0;
        let presentClasses = 0;
        let absentClasses = 0;
        let lateClasses = 0;
        
        // Try summary first
        const summaryDoc = await db.collection('attendance_summary').doc(studentId).get();
        
        if (summaryDoc.exists) {
            console.log('Found attendance summary');
            const summary = summaryDoc.data();
            totalClasses = summary.totalClasses || 0;
            presentClasses = summary.present || 0;
            absentClasses = summary.absent || 0;
            lateClasses = summary.late || 0;
        } else if (!attendanceSnapshot.empty) {
            // Calculate from attendance records
            console.log(`Found ${attendanceSnapshot.size} attendance records`);
            
            attendanceSnapshot.forEach(doc => {
                totalClasses++;
                const status = doc.data().status;
                if (status === 'present') presentClasses++;
                else if (status === 'absent') absentClasses++;
                else if (status === 'late') lateClasses++;
            });
        } else {
            console.log('No attendance records found');
        }
        
        const attendancePercentage = totalClasses > 0 
            ? Math.round((presentClasses / totalClasses) * 100) 
            : 0;
        
        // Calculate submission stats
        const totalSubmissions = submissionsSnapshot.size;
        const gradedSubmissions = submissionsSnapshot.docs.filter(doc => doc.data().status === 'graded').length;
        const pendingSubmissions = submissionsSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
        
        // Build dashboard HTML
        let dashboardHtml = `
            <div class="dashboard-header">
                <h2>${studentData.name || 'Student Dashboard'}</h2>
                <p>Roll Number: ${studentData.rollNumber || 'N/A'}</p>
            </div>
            
            <div class="dashboard-stats">
                <div class="stat-item">
                    <i class="fas fa-tasks"></i>
                    <div>
                        <span class="stat-value">${totalSubmissions}</span>
                        <span class="stat-label">Total Submissions</span>
                    </div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-check-circle" style="color: #27ae60;"></i>
                    <div>
                        <span class="stat-value">${gradedSubmissions}</span>
                        <span class="stat-label">Graded</span>
                    </div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-clock" style="color: #f39c12;"></i>
                    <div>
                        <span class="stat-value">${pendingSubmissions}</span>
                        <span class="stat-label">Pending</span>
                    </div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-calendar-check"></i>
                    <div>
                        <span class="stat-value">${attendancePercentage}%</span>
                        <span class="stat-label">Attendance</span>
                    </div>
                </div>
            </div>
            
            <div class="recent-submissions">
                <h3><i class="fas fa-history"></i> Recent Submissions</h3>
        `;
        
        if (submissionsSnapshot.empty) {
            dashboardHtml += `
                <p style="text-align: center; color: #666; padding: 20px;">
                    <i class="fas fa-inbox" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                    No submissions yet
                </p>
            `;
        } else {
            submissionsSnapshot.forEach(doc => {
                const submission = doc.data();
                const date = submission.submittedAt ? submission.submittedAt.toDate() : new Date();
                dashboardHtml += `
                    <div class="submission-item">
                        <span>${submission.assignmentTitle || 'Assignment'}</span>
                        <span class="submission-status ${submission.status || 'pending'}">
                            ${submission.status || 'pending'}
                        </span>
                    </div>
                `;
            });
        }
        
        dashboardHtml += `
            </div>
            
            <div class="attendance-detail">
                <h3><i class="fas fa-calendar-alt"></i> Attendance Summary</h3>
                <div class="attendance-grid">
                    <div class="detail-item">
                        <span class="label">Total Classes</span>
                        <span class="value">${totalClasses}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Present</span>
                        <span class="value">${presentClasses}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Absent</span>
                        <span class="value">${absentClasses}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Late</span>
                        <span class="value">${lateClasses}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Percentage</span>
                        <span class="value">${attendancePercentage}%</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="markAttendance('${studentId}')">
                    <i class="fas fa-check-circle"></i> Mark Attendance
                </button>
                <button class="btn btn-primary" style="background: #27ae60; margin-left: 10px;" 
                        onclick="viewFullReport('${studentId}')">
                    <i class="fas fa-chart-bar"></i> Full Report
                </button>
            </div>
        `;
        
        document.getElementById('studentDashboard').innerHTML = dashboardHtml;
        
    } catch (error) {
        console.error('Error loading student dashboard:', error);
        document.getElementById('studentDashboard').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #e74c3c; margin-bottom: 15px;"></i>
                <h3>Error Loading Dashboard</h3>
                <p>${error.message}</p>
                <button onclick="showStudentDashboard('${studentId}')" class="btn btn-primary" style="margin-top: 15px;">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Load dashboard stats
async function loadDashboardStats() {
    try {
        // Get total students count
        const studentsSnapshot = await db.collection('students')
            .where('class', '==', className)
            .where('semester', '==', semesterValue)
            .get();
        
        document.getElementById('totalStudents').textContent = studentsSnapshot.size;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Take attendance function
function takeAttendance() {
    if (allStudents.length === 0) {
        alert('No students to mark attendance for.');
        return;
    }
    
    // Redirect to attendance page with class and semester
    window.location.href = `attendance.html?class=${className}&semester=${semesterValue}`;
}

// Download student list as CSV
function downloadStudentList() {
    if (allStudents.length === 0) {
        alert('No students to download.');
        return;
    }
    
    // Create CSV content
    let csv = 'Name,Roll Number,Email,Phone\n';
    
    allStudents.forEach(student => {
        csv += `"${student.name || ''}",${student.rollNumber || ''},"${student.email || ''}","${student.phone || ''}"\n`;
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class_${className}_semester_${semesterValue}_students.csv`;
    a.click();
    
    window.URL.revokeObjectURL(url);
}

// Mark attendance for specific student
function markAttendance(studentId) {
    window.location.href = `attendance.html?class=${className}&semester=${semesterValue}&student=${studentId}`;
}

// View full report
function viewFullReport(studentId) {
    // This could open a detailed report page
    alert('Full report feature coming soon!');
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.students-section'));
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}
