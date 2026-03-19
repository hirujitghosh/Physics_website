// student-dashboard.js
document.addEventListener('DOMContentLoaded', function() {
    // Get student data from URL or session
    const studentData = getStudentData();
    if (!studentData) {
        window.location.href = 'index.html';
        return;
    }
    
    loadStudentDashboard(studentData);
});

function getStudentData() {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    const studentName = urlParams.get('name');
    const studentClass = urlParams.get('class');
    const studentSemester = urlParams.get('sem');
    
    if (studentId && studentName && studentClass && studentSemester) {
        return {
            id: studentId,
            name: decodeURIComponent(studentName),
            class: studentClass,
            semester: studentSemester
        };
    }
    
    // Check session storage (for demo purposes)
    const sessionData = sessionStorage.getItem('studentData');
    if (sessionData) {
        return JSON.parse(sessionData);
    }
    
    return null;
}

async function loadStudentDashboard(student) {
    // Display student info
    document.getElementById('studentName').textContent = student.name;
    document.getElementById('studentClassValue').textContent = student.class;
    document.getElementById('studentSemesterValue').textContent = student.semester;
    
    try {
        // Load all dashboard data in parallel
        const [attendance, submissions, assignments] = await Promise.all([
            loadAttendanceData(student),
            loadSubmissionsData(student),
            loadAssignmentsData(student)
        ]);
        
        // Update stats
        updateStats(attendance, submissions);
        
        // Load recent activity
        loadRecentActivity(submissions);
        
        // Load current assignments
        loadCurrentAssignments(assignments, submissions);
        
        // Load graded assignments
        loadGradedAssignments(submissions);
        
        // Update attendance circle
        updateAttendanceCircle(attendance.percentage || 0);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showError('Error loading dashboard data');
    }
}

async function loadAttendanceData(student) {
    try {
        const doc = await db.collection('attendance_summary').doc(student.id).get();
        
        if (doc.exists) {
            const data = doc.data();
            return {
                percentage: data.percentage || 0,
                totalClasses: data.totalClasses || 0,
                present: data.present || 0,
                absent: data.absent || 0,
                late: data.late || 0
            };
        } else {
            // Try to calculate from attendance records
            return await calculateAttendanceFromRecords(student);
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        return { percentage: 0, totalClasses: 0, present: 0, absent: 0, late: 0 };
    }
}

async function calculateAttendanceFromRecords(student) {
    const snapshot = await db.collection('attendance')
        .where('studentName', '==', student.name)
        .where('class', '==', student.class)
        .where('semester', '==', student.semester)
        .get();
    
    if (snapshot.empty) {
        return { percentage: 0, totalClasses: 0, present: 0, absent: 0, late: 0 };
    }
    
    let present = 0;
    let absent = 0;
    let late = 0;
    
    snapshot.forEach(doc => {
        const status = doc.data().status;
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'late') late++;
    });
    
    const total = present + absent + late;
    const percentage = total > 0 ? ((present + late) / total * 100).toFixed(1) : 0;
    
    return {
        percentage: parseFloat(percentage),
        totalClasses: total,
        present: present,
        absent: absent,
        late: late
    };
}

async function loadSubmissionsData(student) {
    const snapshot = await db.collection('submissions')
        .where('studentName', '==', student.name)
        .where('studentClass', '==', student.class)
        .where('studentSemester', '==', student.semester)
        .orderBy('submittedAt', 'desc')
        .get();
    
    const submissions = [];
    snapshot.forEach(doc => {
        submissions.push({
            id: doc.id,
            ...doc.data()
        });
    });
    
    return submissions;
}

async function loadAssignmentsData(student) {
    const snapshot = await db.collection('assignments')
        .where('class', '==', student.class)
        .where('semester', '==', student.semester)
        .where('status', '==', 'active')
        .orderBy('deadline', 'asc')
        .get();
    
    const assignments = [];
    snapshot.forEach(doc => {
        assignments.push({
            id: doc.id,
            ...doc.data()
        });
    });
    
    return assignments;
}

function updateStats(attendance, submissions) {
    document.getElementById('attendancePercent').textContent = attendance.percentage + '%';
    document.getElementById('totalAssignments').textContent = submissions.length;
    
    const completed = submissions.filter(s => s.status === 'graded').length;
    document.getElementById('completedAssignments').textContent = completed;
    
    const gradedSubmissions = submissions.filter(s => s.marks !== null && s.marks !== undefined);
    const avgMarks = gradedSubmissions.length > 0
        ? (gradedSubmissions.reduce((sum, s) => sum + s.marks, 0) / gradedSubmissions.length).toFixed(1)
        : 'N/A';
    document.getElementById('avgMarks').textContent = avgMarks;
    
    // Update attendance details
    document.getElementById('totalClasses').textContent = attendance.totalClasses;
    document.getElementById('presentCount').textContent = attendance.present;
    document.getElementById('absentCount').textContent = attendance.absent;
}

function updateAttendanceCircle(percentage) {
    const circle = document.getElementById('attendanceCircle');
    if (circle) {
        circle.style.background = `conic-gradient(var(--secondary-color) ${percentage * 3.6}deg, #f0f0f0 0deg)`;
    }
    document.getElementById('circlePercent').textContent = percentage + '%';
}

function loadRecentActivity(submissions) {
    const container = document.getElementById('recentActivity');
    
    if (submissions.length === 0) {
        container.innerHTML = '<p class="no-activity">No recent activity</p>';
        return;
    }
    
    container.innerHTML = '';
    
    submissions.slice(0, 5).forEach(sub => {
        const date = sub.submittedAt?.toDate?.() || new Date();
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-icon ${sub.status}">
                <i class="fas ${sub.status === 'graded' ? 'fa-star' : 'fa-clock'}"></i>
            </div>
            <div class="activity-details">
                <p><strong>Assignment submitted</strong></p>
                <p class="activity-meta">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</p>
                ${sub.status === 'graded' ? `<p class="activity-meta">Marks: ${sub.marks}</p>` : ''}
            </div>
            <span class="activity-status ${sub.status}">${sub.status}</span>
        `;
        container.appendChild(item);
    });
}

function loadCurrentAssignments(assignments, submissions) {
    const container = document.getElementById('currentAssignments');
    
    // Filter out assignments that have been submitted
    const submittedIds = new Set(submissions.map(s => s.assignmentId));
    const pendingAssignments = assignments.filter(a => !submittedIds.has(a.id));
    
    if (pendingAssignments.length === 0) {
        container.innerHTML = '<p class="no-data">No pending assignments</p>';
        return;
    }
    
    container.innerHTML = '';
    
    pendingAssignments.slice(0, 3).forEach(assignment => {
        const deadline = new Date(assignment.deadline);
        const today = new Date();
        const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
        const isUrgent = daysLeft <= 2 && daysLeft > 0;
        
        const card = document.createElement('div');
        card.className = 'assignment-item';
        card.innerHTML = `
            <div class="assignment-header">
                <h4>${assignment.title}</h4>
                <span class="deadline-badge ${isUrgent ? 'urgent' : ''}">
                    ${daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}
                </span>
            </div>
            <p class="assignment-desc">${assignment.description.substring(0, 100)}...</p>
            <div class="assignment-footer">
                <span><i class="fas fa-calendar"></i> Deadline: ${deadline.toLocaleDateString()}</span>
                <a href="homework.html" class="btn-submit">Submit <i class="fas fa-arrow-right"></i></a>
            </div>
        `;
        container.appendChild(card);
    });
    
    if (pendingAssignments.length > 3) {
        container.innerHTML += `
            <div class="view-more">
                <a href="homework.html">View all ${pendingAssignments.length} assignments</a>
            </div>
        `;
    }
}

function loadGradedAssignments(submissions) {
    const container = document.getElementById('gradedAssignments');
    
    const graded = submissions.filter(s => s.status === 'graded');
    
    if (graded.length === 0) {
        container.innerHTML = '<p class="no-data">No graded assignments yet</p>';
        return;
    }
    
    container.innerHTML = '';
    
    graded.slice(0, 5).forEach(sub => {
        const item = document.createElement('div');
        item.className = 'graded-item';
        item.innerHTML = `
            <div class="graded-info">
                <p class="assignment-title">Assignment ${sub.assignmentId}</p>
                <p class="submission-date">Submitted: ${sub.submittedAt?.toDate?.().toLocaleDateString() || 'N/A'}</p>
            </div>
            <div class="graded-marks">
                <span class="marks">${sub.marks}</span>
                ${sub.feedback ? `<span class="feedback-icon" title="${sub.feedback}"><i class="fas fa-comment"></i></span>` : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

function showError(message) {
    // You can implement a toast or alert
    console.error(message);
    alert(message);
}