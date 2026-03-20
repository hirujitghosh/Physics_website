// js/semester.js - Complete Semester Page Functionality

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
    document.getElementById('classValue').textContent = className;
    document.getElementById('semesterValue').textContent = semester;
    document.getElementById('className').innerHTML = `Class ${className} - Semester ${semester}`;
    
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

async function loadStudentDashboard(student) {
    const dashboard = document.getElementById('studentDashboard');
    
    try {
        // Try to load from attendance_summary first (faster) - like in loadAttendanceData
        const summaryDoc = await db.collection('attendance_summary').doc(student.id).get();
        
        let totalClasses = 0;
        let present = 0;
        let absent = 0;
        let late = 0;
        let percentage = 0;
        
        if (summaryDoc.exists) {
            // Use summary data if available (like attendance.js line 138-150)
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
                // Calculate statistics from records (like attendance.js line 174-187)
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
                            return `
                                <div class="submission-item">
                                    <div class="submission-info">
                                        <span class="assignment-id">Assignment: ${sub.assignmentId}</span>
                                        <span class="submission-date">${date.toLocaleDateString()}</span>
                                    </div>
                                    <div class="submission-status ${sub.marks ? 'graded' : 'pending'}">
                                        ${sub.marks ? `Marks: ${sub.marks}` : 'Pending'}
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
                    <strong>Attendance Percentage: ${percentage}% (Present/Total)</strong>
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
}// ============================================
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

// ============================================
// ADD THESE STYLES TO YOUR CSS IF NOT PRESENT
// ============================================

// You can add these styles to your style.css file
const additionalStyles = `
    .student-card {
        background: white;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        transition: transform 0.3s;
    }
    
    .student-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 5px 20px rgba(0,0,0,0.15);
    }
    
    .student-avatar {
        width: 80px;
        height: 80px;
        background: #3498db;
        border-radius: 50%;
        margin: 0 auto 15px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .avatar-initials {
        color: white;
        font-size: 24px;
        font-weight: bold;
    }
    
    .student-card h3 {
        margin-bottom: 10px;
        color: #333;
    }
    
    .student-details {
        margin-bottom: 15px;
    }
    
    .student-details span {
        display: block;
        font-size: 12px;
        color: #666;
        margin: 5px 0;
    }
    
    .student-details i {
        width: 16px;
        color: #3498db;
        margin-right: 5px;
    }
    
    .btn-view {
        background: #3498db;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.3s;
    }
    
    .btn-view:hover {
        background: #2980b9;
    }
    
    .dashboard-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 15px;
        margin: 20px 0;
    }
    
    .stat-item {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .stat-item i {
        font-size: 24px;
        color: #3498db;
    }
    
    .recent-submissions {
        margin: 20px 0;
    }
    
    .submission-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid #eee;
    }
    
    .submission-item:last-child {
        border-bottom: none;
    }
    
    .submission-status {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
    }
    
    .submission-status.graded {
        background: #d4edda;
        color: #155724;
    }
    
    .submission-status.pending {
        background: #fff3cd;
        color: #856404;
    }
    
    .attendance-detail {
        margin: 20px 0;
    }
    
    .attendance-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-top: 10px;
    }
    
    .detail-item {
        background: #f8f9fa;
        padding: 10px;
        border-radius: 4px;
    }
    
    .detail-item .label {
        color: #666;
        font-size: 12px;
        display: block;
    }
    
    .detail-item .value {
        font-size: 18px;
        font-weight: bold;
        color: #333;
    }
    
    .detail-item .value.present {
        color: #27ae60;
    }
    
    .detail-item .value.absent {
        color: #e74c3c;
    }
    
    .detail-item .value.late {
        color: #f39c12;
    }
    
    .modal-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 20px;
    }
    
    .no-results {
        grid-column: 1 / -1;
        text-align: center;
        padding: 40px;
        color: #999;
    }
`;
