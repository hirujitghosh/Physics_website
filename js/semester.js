// js/semester.js - Complete Semester Page Functionality
// CORRECTED VERSION with proper attendance calculation

document.addEventListener('DOMContentLoaded', function() {
    console.log('Semester page loaded');
    
    // Get class and semester from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const className = urlParams.get('class');
    const semester = urlParams.get('sem');
    
    console.log('Class:', className, 'Semester:', semester);
    
    if (!className || !semester) {
        console.log('No class/semester specified, redirecting to home');
        window.location.href = 'index.html';
        return;
    }
    
    // Display class info
    const classValueEl = document.getElementById('classValue');
    const semesterValueEl = document.getElementById('semesterValue');
    const classNameEl = document.getElementById('className');
    
    if (classValueEl) classValueEl.textContent = className;
    if (semesterValueEl) semesterValueEl.textContent = semester;
    if (classNameEl) classNameEl.innerHTML = `Class ${className} - Semester ${semester}`;
    
    // Load students
    loadStudents(className, semester);
    
    // Setup search
    const searchInput = document.getElementById('searchStudent');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            filterStudents(e.target.value);
        });
    }
    
    // Setup attendance button
    const attendanceBtn = document.getElementById('takeAttendance');
    if (attendanceBtn) {
        attendanceBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = `admin.html?tab=attendance&class=${className}&semester=${semester}`;
        });
    }
    
    // Setup download button
    const downloadBtn = document.getElementById('downloadList');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            downloadStudentList();
        });
    }
    
    // Modal close
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
});

// Global variables
let allStudents = [];

// ============================================
// LOAD STUDENTS FROM FIREBASE
// ============================================

async function loadStudents(className, semester) {
    const studentsGrid = document.getElementById('studentsGrid');
    const noStudents = document.getElementById('noStudents');
    const totalSpan = document.getElementById('totalStudents');
    
    if (!studentsGrid || !noStudents) return;
    
    try {
        console.log(`Loading students for class ${className}, semester ${semester}`);
        
        // Query Firestore for students
        const snapshot = await db.collection('students')
            .where('class', '==', className)
            .where('semester', '==', semester)
            .orderBy('name')
            .get();
        
        console.log(`Found ${snapshot.size} students`);
        
        if (snapshot.empty) {
            // No students found
            studentsGrid.style.display = 'none';
            noStudents.style.display = 'block';
            if (totalSpan) totalSpan.textContent = '0';
            return;
        }
        
        // Clear loading spinner
        studentsGrid.innerHTML = '';
        studentsGrid.style.display = 'grid';
        noStudents.style.display = 'none';
        
        allStudents = [];
        
        // Create student cards
        snapshot.forEach(doc => {
            const student = {
                id: doc.id,
                ...doc.data()
            };
            allStudents.push(student);
            
            const card = createStudentCard(student);
            studentsGrid.appendChild(card);
        });
        
        // Update total count
        if (totalSpan) totalSpan.textContent = snapshot.size;
        
    } catch (error) {
        console.error('Error loading students:', error);
        studentsGrid.innerHTML = '<p class="error">Error loading students. Please refresh the page.</p>';
    }
}

// ============================================
// CREATE STUDENT CARD
// ============================================

function createStudentCard(student) {
    const card = document.createElement('div');
    card.className = 'student-card';
    card.dataset.studentId = student.id;
    card.dataset.studentName = student.name.toLowerCase();
    
    // Get initials for avatar
    const initials = student.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    
    card.innerHTML = `
        <div class="student-avatar">
            <span class="avatar-initials">${initials}</span>
        </div>
        <h3>${student.name}</h3>
        <p class="student-details">
            <span><i class="fas fa-envelope"></i> ${student.email || 'No email'}</span>
            <span><i class="fas fa-phone"></i> ${student.phone || 'No phone'}</span>
        </p>
        <button class="btn-view" onclick="viewStudentDashboard('${student.id}')">
            <i class="fas fa-chart-line"></i> View Dashboard
        </button>
    `;
    
    return card;
}

// ============================================
// FILTER STUDENTS BY SEARCH
// ============================================

function filterStudents(searchTerm) {
    const cards = document.querySelectorAll('.student-card');
    const searchLower = searchTerm.toLowerCase();
    
    cards.forEach(card => {
        const name = card.dataset.studentName;
        if (name.includes(searchLower)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
    
    // Show/hide no results message
    const visibleCards = document.querySelectorAll('.student-card[style="display: block"]').length;
    const noResultsMsg = document.getElementById('noSearchResults');
    
    if (visibleCards === 0 && cards.length > 0) {
        if (!noResultsMsg) {
            const msg = document.createElement('div');
            msg.id = 'noSearchResults';
            msg.className = 'no-results';
            msg.innerHTML = '<p>No students match your search</p>';
            document.querySelector('.students-grid').appendChild(msg);
        }
    } else {
        if (noResultsMsg) noResultsMsg.remove();
    }
}

// ============================================
// VIEW STUDENT DASHBOARD
// ============================================

window.viewStudentDashboard = async function(studentId) {
    console.log('Viewing dashboard for student:', studentId);
    
    const student = allStudents.find(s => s.id === studentId);
    if (!student) {
        console.error('Student not found');
        return;
    }
    
    const modal = document.getElementById('studentModal');
    const dashboard = document.getElementById('studentDashboard');
    
    if (!modal || !dashboard) return;
    
    // Show modal with loading
    modal.style.display = 'block';
    dashboard.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> Loading student data...</div>';
    
    try {
        // Load student data
        await loadStudentDashboard(student);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        dashboard.innerHTML = '<p class="error">Error loading student dashboard</p>';
    }
}

// ============================================
// LOAD STUDENT DASHBOARD - FIXED ATTENDANCE CALCULATION
// ============================================

async function loadStudentDashboard(student) {
    const dashboard = document.getElementById('studentDashboard');
    
    try {
        // Try to load from attendance_summary first (faster) - like in attendance.js
        const summaryDoc = await db.collection('attendance_summary').doc(student.id).get();
        
        let totalClasses = 0;
        let present = 0;
        let absent = 0;
        let late = 0;
        let percentage = 0;
        
        if (summaryDoc.exists) {
            // Use summary data if available (like attendance.js)
            console.log('Found attendance summary for student');
            const summary = summaryDoc.data();
            totalClasses = summary.totalClasses || 0;
            present = summary.present || 0;
            absent = summary.absent || 0;
            late = summary.late || 0;
            
            // Calculate percentage the same way as attendance.js (present/total)
            percentage = totalClasses > 0 ? ((present / totalClasses) * 100).toFixed(1) : 0;
            
        } else {
            // If no summary, load from attendance records (like loadAttendanceFromRecords)
            console.log('No summary found, loading from attendance records');
            
            const snapshot = await db.collection('attendance')
                .where('studentName', '==', student.name)
                .where('class', '==', student.class)
                .where('semester', '==', student.semester)
                .get();
            
            console.log(`Found ${snapshot.size} attendance records`);
            
            if (!snapshot.empty) {
                // Calculate statistics from records (like attendance.js)
                snapshot.forEach(doc => {
                    const record = doc.data();
                    totalClasses++;
                    
                    switch(record.status) {
                        case 'present':
                            present++;
                            break;
                        case 'absent':
                            absent++;
                            break;
                        case 'late':
                            late++;
                            break;
                    }
                });
                
                // Calculate percentage exactly like attendance.js (present/total)
                percentage = totalClasses > 0 ? ((present / totalClasses) * 100).toFixed(1) : 0;
            }
        }
        
        // Load submissions
        const submissionsSnapshot = await db.collection('submissions')
            .where('studentName', '==', student.name)
            .where('studentClass', '==', student.class)
            .where('studentSemester', '==', student.semester)
            .orderBy('submittedAt', 'desc')
            .limit(5)
            .get();
        
        const submissions = [];
        submissionsSnapshot.forEach(doc => {
            submissions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Calculate average marks
        const gradedSubmissions = submissions.filter(s => s.marks !== undefined && s.marks !== null);
        const avgMarks = gradedSubmissions.length > 0
            ? (gradedSubmissions.reduce((sum, s) => sum + s.marks, 0) / gradedSubmissions.length).toFixed(1)
            : 'N/A';
        
        // Build dashboard HTML
        dashboard.innerHTML = `
            <div class="dashboard-header">
                <h2>${student.name}'s Dashboard</h2>
                <p>Class ${student.class} - Semester ${student.semester}</p>
            </div>
            
            <div class="dashboard-stats">
                <div class="stat-item">
                    <i class="fas fa-calendar-check"></i>
                    <div>
                        <span class="stat-value">${percentage}%</span>
                        <span class="stat-label">Attendance</span>
                    </div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-tasks"></i>
                    <div>
                        <span class="stat-value">${submissions.length}</span>
                        <span class="stat-label">Submissions</span>
                    </div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-star"></i>
                    <div>
                        <span class="stat-value">${avgMarks}</span>
                        <span class="stat-label">Avg Marks</span>
                    </div>
                </div>
            </div>
            
            <div class="recent-submissions">
                <h3>Recent Submissions</h3>
                ${submissions.length > 0 ? `
                    <div class="submission-list">
                        ${submissions.map(sub => {
                            const date = sub.submittedAt?.toDate?.() || new Date();
                            const assignmentId = sub.assignmentId || 'Unknown';
                            const marks = sub.marks;
                            return `
                                <div class="submission-item">
                                    <div class="submission-info">
                                        <span class="assignment-id">Assignment: ${assignmentId}</span>
                                        <span class="submission-date">${date.toLocaleDateString()}</span>
                                    </div>
                                    <div class="submission-status ${marks ? 'graded' : 'pending'}">
                                        ${marks ? `Marks: ${marks}` : 'Pending'}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : '<p>No submissions yet</p>'}
            </div>
            
            <div class="attendance-detail">
                <h3>Attendance Details</h3>
                <div class="attendance-grid">
                    <div class="detail-item">
                        <span class="label">Total Classes:</span>
                        <span class="value">${totalClasses}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Present:</span>
                        <span class="value present">${present}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Absent:</span>
                        <span class="value absent">${absent}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Late:</span>
                        <span class="value late">${late}</span>
                    </div>
                </div>
                <div style="margin-top: 10px; padding: 8px; background: #e8f4fd; border-radius: 4px; text-align: center;">
                    <strong>Attendance Percentage: ${percentage}% (Present/Total Classes)</strong>
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="closeModal()">Close</button>
            </div>
        `;
        
    } catch (error) {
        console.error('Error building dashboard:', error);
        dashboard.innerHTML = '<p class="error">Error loading student data</p>';
    }
}

// ============================================
// DOWNLOAD STUDENT LIST AS CSV
// ============================================

function downloadStudentList() {
    if (allStudents.length === 0) {
        alert('No students to download');
        return;
    }
    
    const className = document.getElementById('classValue').textContent;
    const semester = document.getElementById('semesterValue').textContent;
    
    // Create CSV header
    let csv = 'Name,Email,Phone,Class,Semester\n';
    
    // Add student data
    allStudents.forEach(student => {
        csv += `${student.name},${student.email || ''},${student.phone || ''},${student.class},${student.semester}\n`;
    });
    
    // Download file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class-${className}-semester-${semester}-students.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    console.log('Student list downloaded');
}

// ============================================
// MODAL HELPER
// ============================================

function closeModal() {
    const modal = document.getElementById('studentModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
