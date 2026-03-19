// homework.js
document.addEventListener('DOMContentLoaded', function() {
    loadAssignments();
    
    // Setup filters
    document.getElementById('classFilter').addEventListener('change', filterAssignments);
    document.getElementById('semesterFilter').addEventListener('change', filterAssignments);
    document.getElementById('statusFilter').addEventListener('change', filterAssignments);
    document.getElementById('applyFilters').addEventListener('click', filterAssignments);
    
    // Update semester options when class changes
    document.getElementById('classFilter').addEventListener('change', updateSemesterOptions);
    document.getElementById('studentClass').addEventListener('change', updateStudentSemesterOptions);
    
    // Modal close handlers
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
    
    // Submission form handler
    document.getElementById('submissionForm').addEventListener('submit', handleSubmission);
});

let allAssignments = [];
let filteredAssignments = [];

function loadAssignments() {
    const assignmentsGrid = document.getElementById('assignmentsGrid');
    
    db.collection('assignments')
        .where('status', '==', 'active')
        .orderBy('deadline', 'asc')
        .get()
        .then((snapshot) => {
            assignmentsGrid.innerHTML = '';
            allAssignments = [];
            
            if (snapshot.empty) {
                assignmentsGrid.innerHTML = '<p class="no-data">No assignments available</p>';
                return;
            }
            
            snapshot.forEach(doc => {
                const assignment = {
                    id: doc.id,
                    ...doc.data()
                };
                allAssignments.push(assignment);
            });
            
            filteredAssignments = [...allAssignments];
            displayAssignments(filteredAssignments);
        })
        .catch(error => {
            console.error('Error loading assignments:', error);
            assignmentsGrid.innerHTML = '<p class="error">Error loading assignments</p>';
        });
}

function displayAssignments(assignments) {
    const assignmentsGrid = document.getElementById('assignmentsGrid');
    assignmentsGrid.innerHTML = '';
    
    assignments.forEach(assignment => {
        assignmentsGrid.appendChild(createAssignmentCard(assignment));
    });
}

function createAssignmentCard(assignment) {
    const card = document.createElement('div');
    card.className = 'assignment-card';
    card.dataset.assignmentId = assignment.id;
    
    const deadline = new Date(assignment.deadline);
    const today = new Date();
    const isOverdue = deadline < today;
    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    
    card.innerHTML = `
        <div class="assignment-header">
            <h3>${assignment.title}</h3>
            <span class="class-badge">Class ${assignment.class} - Sem ${assignment.semester}</span>
        </div>
        
        <p class="assignment-description">${assignment.description}</p>
        
        <div class="assignment-meta">
            <div class="meta-item">
                <i class="fas fa-calendar-alt"></i>
                <span>Deadline: ${deadline.toLocaleDateString()}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-clock"></i>
                <span class="${isOverdue ? 'overdue' : ''}">
                    ${isOverdue ? 'Overdue' : `${daysLeft} days left`}
                </span>
            </div>
            <div class="meta-item">
                <i class="fas fa-star"></i>
                <span>Total Marks: ${assignment.totalMarks || 'N/A'}</span>
            </div>
        </div>
        
        <div class="assignment-actions">
            <a href="${assignment.driveLink}" target="_blank" class="btn btn-secondary">
                <i class="fas fa-download"></i> Download
            </a>
            <button class="btn btn-primary" onclick="openSubmissionModal('${assignment.id}')">
                <i class="fas fa-upload"></i> Submit
            </button>
        </div>
    `;
    
    return card;
}

function updateSemesterOptions() {
    const classFilter = document.getElementById('classFilter').value;
    const semesterSelect = document.getElementById('semesterFilter');
    
    semesterSelect.innerHTML = '<option value="">All Semesters</option>';
    
    if (!classFilter) return;
    
    const semesters = classFilter === 'BSc' ? 8 : 2;
    for (let i = 1; i <= semesters; i++) {
        semesterSelect.innerHTML += `<option value="${i}">Semester ${i}</option>`;
    }
}

function updateStudentSemesterOptions() {
    const studentClass = document.getElementById('studentClass').value;
    const semesterSelect = document.getElementById('studentSemester');
    
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';
    
    if (!studentClass) return;
    
    const semesters = studentClass === 'BSc' ? 8 : 2;
    for (let i = 1; i <= semesters; i++) {
        semesterSelect.innerHTML += `<option value="${i}">Semester ${i}</option>`;
    }
}

function filterAssignments() {
    const classFilter = document.getElementById('classFilter').value;
    const semesterFilter = document.getElementById('semesterFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredAssignments = allAssignments.filter(assignment => {
        // Class filter
        if (classFilter && assignment.class !== classFilter) return false;
        
        // Semester filter
        if (semesterFilter && assignment.semester !== semesterFilter) return false;
        
        // Status filter
        if (statusFilter !== 'all') {
            const deadline = new Date(assignment.deadline);
            const today = new Date();
            
            switch(statusFilter) {
                case 'pending':
                    if (deadline < today) return false;
                    break;
                case 'submitted':
                    // Check if user has submitted (simplified - in real app, check against submissions)
                    return false;
                case 'graded':
                    return false;
            }
        }
        
        return true;
    });
    
    displayAssignments(filteredAssignments);
}

function openSubmissionModal(assignmentId) {
    const modal = document.getElementById('submissionModal');
    const assignment = allAssignments.find(a => a.id === assignmentId);
    
    if (!assignment) return;
    
    document.getElementById('assignmentId').value = assignmentId;
    
    // Display assignment details
    const detailsDiv = document.getElementById('assignmentDetails');
    const deadline = new Date(assignment.deadline);
    detailsDiv.innerHTML = `
        <h3>${assignment.title}</h3>
        <p>${assignment.description}</p>
        <p><strong>Deadline:</strong> ${deadline.toLocaleDateString()}</p>
        <p><strong>Total Marks:</strong> ${assignment.totalMarks || 'N/A'}</p>
    `;
    
    // Reset form
    document.getElementById('submissionForm').reset();
    document.getElementById('submissionForm').style.display = 'block';
    document.getElementById('submissionSuccess').style.display = 'none';
    document.getElementById('submitBtn').disabled = false;
    
    modal.style.display = 'block';
}

async function handleSubmission(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting...';
    
    const submissionData = {
        assignmentId: document.getElementById('assignmentId').value,
        studentName: document.getElementById('studentName').value,
        studentClass: document.getElementById('studentClass').value,
        studentSemester: document.getElementById('studentSemester').value,
        driveLink: document.getElementById('driveLink').value,
        comments: document.getElementById('comments').value,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'submitted',
        marks: null
    };
    
    try {
        // First validate Drive link with Apps Script
        const validationResult = await validateDriveLink(submissionData.driveLink);
        
        if (!validationResult.valid) {
            throw new Error('Invalid or inaccessible Google Drive link');
        }
        
        // Save to Firebase
        await db.collection('submissions').add(submissionData);
        
        // Show success message
        document.getElementById('submissionForm').style.display = 'none';
        document.getElementById('submissionSuccess').style.display = 'block';
        
        // Send to Apps Script for backup
        await sendToAppsScript(submissionData);
        
    } catch (error) {
        alert('Error submitting assignment: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Submit Assignment';
    }
}

async function validateDriveLink(driveLink) {
    try {
        // Extract file ID from link
        const fileId = extractFileId(driveLink);
        
        // Call Apps Script to validate
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'getDriveFileInfo',
                driveLink: driveLink
            })
        });
        
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

function extractFileId(link) {
    const patterns = [
        /\/d\/([a-zA-Z0-9_-]+)/,
        /id=([a-zA-Z0-9_-]+)/,
        /\/file\/d\/([a-zA-Z0-9_-]+)/
    ];
    
    for (let pattern of patterns) {
        const match = link.match(pattern);
        if (match) return match[1];
    }
    throw new Error('Invalid Google Drive link format');
}

async function sendToAppsScript(data) {
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'submitAssignment',
                ...data
            })
        });
    } catch (error) {
        console.error('Apps Script backup failed:', error);
    }
}

function closeModal() {
    document.getElementById('submissionModal').style.display = 'none';
}