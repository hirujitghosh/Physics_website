// js/homework.js - Complete Homework Page Functionality

document.addEventListener('DOMContentLoaded', function() {
    // Load assignments when page loads
    loadAssignments();
    
    // Setup filters
    const classFilter = document.getElementById('classFilter');
    const semesterFilter = document.getElementById('semesterFilter');
    const statusFilter = document.getElementById('statusFilter');
    const applyFilters = document.getElementById('applyFilters');
    
    if (classFilter) {
        classFilter.addEventListener('change', function() {
            updateSemesterOptions();
        });
    }
    
    if (applyFilters) {
        applyFilters.addEventListener('click', filterAssignments);
    }
    
    // Handle class change in submission form
    const studentClass = document.getElementById('studentClass');
    if (studentClass) {
        studentClass.addEventListener('change', function() {
            updateStudentSemesterOptions();
        });
    }
    
    // Handle submission form
    const submissionForm = document.getElementById('submissionForm');
    if (submissionForm) {
        submissionForm.addEventListener('submit', handleSubmission);
    }
    
    // Modal close handlers
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
});

// Global variables
let allAssignments = [];
let filteredAssignments = [];

// ============================================
// LOAD ASSIGNMENTS FROM FIREBASE
// ============================================

async function loadAssignments() {
    const assignmentsGrid = document.getElementById('assignmentsGrid');
    
    if (!assignmentsGrid) return;
    
    try {
        // Get current date for comparison
        const today = new Date();
        
        // Fetch assignments from Firestore
        const snapshot = await db.collection('assignments')
            .where('status', '==', 'active')
            .orderBy('deadline', 'asc')
            .get();
        
        if (snapshot.empty) {
            assignmentsGrid.innerHTML = '<p class="no-data">No assignments available</p>';
            return;
        }
        
        // Clear loading spinner
        assignmentsGrid.innerHTML = '';
        allAssignments = [];
        
        // Loop through each assignment
        snapshot.forEach(doc => {
            const assignment = {
                id: doc.id,
                ...doc.data()
            };
            allAssignments.push(assignment);
            
            // Create and append assignment card
            const card = createAssignmentCard(assignment);
            assignmentsGrid.appendChild(card);
        });
        
        // Update filtered assignments
        filteredAssignments = [...allAssignments];
        
        // Update semester filter options
        updateSemesterOptions();
        
    } catch (error) {
        console.error('Error loading assignments:', error);
        assignmentsGrid.innerHTML = '<p class="error">Error loading assignments. Please refresh the page.</p>';
    }
}

// ============================================
// CREATE ASSIGNMENT CARD
// ============================================

function createAssignmentCard(assignment) {
    const card = document.createElement('div');
    card.className = 'assignment-card';
    card.dataset.id = assignment.id;
    card.dataset.class = assignment.class;
    card.dataset.semester = assignment.semester;
    
    // Format deadline
    const deadline = assignment.deadline ? new Date(assignment.deadline) : new Date();
    const today = new Date();
    const isOverdue = deadline < today;
    
    // Calculate days left
    const timeDiff = deadline.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    // Format deadline display
    const deadlineStr = deadline.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    card.innerHTML = `
        <div class="assignment-header">
            <h3>${assignment.title || 'Untitled Assignment'}</h3>
            <span class="class-badge">Class ${assignment.class || 'N/A'} - Sem ${assignment.semester || 'N/A'}</span>
        </div>
        
        <p class="assignment-description">${assignment.description || 'No description provided.'}</p>
        
        <div class="assignment-meta">
            <div class="meta-item">
                <i class="fas fa-calendar-alt"></i>
                <span>Deadline: ${deadlineStr}</span>
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
            <a href="${assignment.driveLink || '#'}" target="_blank" class="btn btn-secondary">
                <i class="fas fa-download"></i> Download
            </a>
            <button class="btn btn-primary" onclick="openSubmissionModal('${assignment.id}')">
                <i class="fas fa-upload"></i> Submit
            </button>
        </div>
    `;
    
    return card;
}

// ============================================
// FILTER FUNCTIONS
// ============================================

function updateSemesterOptions() {
    const classFilter = document.getElementById('classFilter');
    const semesterFilter = document.getElementById('semesterFilter');
    
    if (!classFilter || !semesterFilter) return;
    
    const selectedClass = classFilter.value;
    
    // Clear current options
    semesterFilter.innerHTML = '<option value="">All Semesters</option>';
    
    if (!selectedClass) return;
    
    // Determine number of semesters
    const numSemesters = selectedClass === 'BSc' ? 8 : 2;
    
    // Add semester options
    for (let i = 1; i <= numSemesters; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterFilter.appendChild(option);
    }
}

function updateStudentSemesterOptions() {
    const studentClass = document.getElementById('studentClass');
    const semesterSelect = document.getElementById('studentSemester');
    
    if (!studentClass || !semesterSelect) return;
    
    const selectedClass = studentClass.value;
    
    // Clear current options
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';
    
    if (!selectedClass) return;
    
    // Determine number of semesters
    const numSemesters = selectedClass === 'BSc' ? 8 : 2;
    
    // Add semester options
    for (let i = 1; i <= numSemesters; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterSelect.appendChild(option);
    }
}

function filterAssignments() {
    const classFilter = document.getElementById('classFilter')?.value;
    const semesterFilter = document.getElementById('semesterFilter')?.value;
    const statusFilter = document.getElementById('statusFilter')?.value;
    const assignmentsGrid = document.getElementById('assignmentsGrid');
    
    if (!assignmentsGrid) return;
    
    // Filter assignments
    filteredAssignments = allAssignments.filter(assignment => {
        // Class filter
        if (classFilter && assignment.class !== classFilter) return false;
        
        // Semester filter
        if (semesterFilter && assignment.semester != semesterFilter) return false;
        
        // Status filter
        if (statusFilter && statusFilter !== 'all') {
            const deadline = new Date(assignment.deadline);
            const today = new Date();
            
            switch(statusFilter) {
                case 'pending':
                    // Not submitted and not overdue (simplified)
                    return deadline >= today;
                case 'submitted':
                    // This would require checking submissions
                    // For now, just return false
                    return false;
                case 'graded':
                    return false;
            }
        }
        
        return true;
    });
    
    // Clear and repopulate grid
    assignmentsGrid.innerHTML = '';
    
    if (filteredAssignments.length === 0) {
        assignmentsGrid.innerHTML = '<p class="no-data">No assignments match your filters</p>';
        return;
    }
    
    filteredAssignments.forEach(assignment => {
        const card = createAssignmentCard(assignment);
        assignmentsGrid.appendChild(card);
    });
}

// ============================================
// SUBMISSION MODAL FUNCTIONS
// ============================================

window.openSubmissionModal = function(assignmentId) {
    const modal = document.getElementById('submissionModal');
    const assignment = allAssignments.find(a => a.id === assignmentId);
    
    if (!modal || !assignment) return;
    
    // Store assignment ID
    document.getElementById('assignmentId').value = assignmentId;
    
    // Display assignment details
    const detailsDiv = document.getElementById('assignmentDetails');
    const deadline = assignment.deadline ? new Date(assignment.deadline) : new Date();
    
    detailsDiv.innerHTML = `
        <h3>${assignment.title}</h3>
        <p>${assignment.description}</p>
        <p><strong>Class:</strong> ${assignment.class} - Semester ${assignment.semester}</p>
        <p><strong>Deadline:</strong> ${deadline.toLocaleDateString()}</p>
        <p><strong>Total Marks:</strong> ${assignment.totalMarks || 'N/A'}</p>
    `;
    
    // Reset form
    document.getElementById('submissionForm').reset();
    document.getElementById('submissionForm').style.display = 'block';
    document.getElementById('submissionSuccess').style.display = 'none';
    
    // Update semester options based on default class
    updateStudentSemesterOptions();
    
    // Show modal
    modal.style.display = 'block';
}

async function handleSubmission(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const assignmentId = document.getElementById('assignmentId').value;
    const studentName = document.getElementById('studentName').value;
    const studentClass = document.getElementById('studentClass').value;
    const studentSemester = document.getElementById('studentSemester').value;
    const driveLink = document.getElementById('driveLink').value;
    const comments = document.getElementById('comments').value;
    
    // Validate form
    if (!studentName || !studentClass || !studentSemester || !driveLink) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Validate Google Drive link
    if (!driveLink.includes('drive.google.com')) {
        alert('Please enter a valid Google Drive link');
        return;
    }
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting...';
    
    try {
        // Create submission object
        const submissionData = {
            assignmentId: assignmentId,
            studentName: studentName,
            studentClass: studentClass,
            studentSemester: studentSemester,
            driveLink: driveLink,
            comments: comments || '',
            status: 'submitted',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Save to Firebase
        await db.collection('submissions').add(submissionData);
        
        // Show success message
        document.getElementById('submissionForm').style.display = 'none';
        document.getElementById('submissionSuccess').style.display = 'block';
        
        // Optional: Send to Apps Script for backup
        try {
            await fetch('YOUR_APPS_SCRIPT_URL', {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'submitAssignment',
                    ...submissionData
                })
            });
        } catch (e) {
            console.log('Apps Script backup failed (optional)');
        }
        
    } catch (error) {
        console.error('Error submitting assignment:', error);
        alert('Error submitting assignment. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Submit Assignment';
    }
}

// ============================================
// MODAL HELPER
// ============================================

window.closeModal = function() {
    const modal = document.getElementById('submissionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ============================================
// ADD THESE STYLES TO YOUR CSS IF NOT PRESENT
// ============================================

// These styles should be added to your style.css or admin.css
const additionalStyles = `
    .assignment-card {
        background: white;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: transform 0.3s;
    }
    
    .assignment-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .assignment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        flex-wrap: wrap;
        gap: 10px;
    }
    
    .assignment-header h3 {
        margin: 0;
        color: #333;
    }
    
    .class-badge {
        background: #e3f2fd;
        color: #1976d2;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
    }
    
    .assignment-description {
        color: #666;
        margin-bottom: 15px;
        line-height: 1.5;
    }
    
    .assignment-meta {
        display: flex;
        gap: 20px;
        margin-bottom: 15px;
        color: #666;
        font-size: 14px;
        flex-wrap: wrap;
    }
    
    .meta-item {
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .meta-item i {
        color: #1976d2;
    }
    
    .overdue {
        color: #f44336;
        font-weight: 600;
    }
    
    .assignment-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    }
    
    .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        text-decoration: none;
    }
    
    .btn-primary {
        background: #1976d2;
        color: white;
    }
    
    .btn-primary:hover {
        background: #1565c0;
    }
    
    .btn-secondary {
        background: #f5f5f5;
        color: #333;
        border: 1px solid #ddd;
    }
    
    .btn-secondary:hover {
        background: #e0e0e0;
    }
    
    .filter-section {
        padding: 20px 0;
        background: #f5f5f5;
    }
    
    .filter-controls {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
    }
    
    .filter-select {
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        min-width: 150px;
    }
    
    .assignments-grid {
        padding: 20px 0;
    }
    
    .loading-spinner {
        text-align: center;
        padding: 40px;
        color: #666;
    }
    
    .loading-spinner i {
        font-size: 40px;
        margin-bottom: 10px;
        color: #1976d2;
    }
    
    .no-data {
        text-align: center;
        padding: 40px;
        color: #999;
    }
    
    .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        overflow-y: auto;
    }
    
    .modal-content {
        background: white;
        margin: 50px auto;
        padding: 20px;
        border-radius: 8px;
        max-width: 600px;
        position: relative;
    }
    
    .large-modal {
        max-width: 800px;
    }
    
    .close-modal {
        position: absolute;
        right: 20px;
        top: 15px;
        font-size: 24px;
        cursor: pointer;
        color: #999;
    }
    
    .close-modal:hover {
        color: #333;
    }
    
    .assignment-details {
        background: #f5f5f5;
        padding: 15px;
        border-radius: 4px;
        margin: 15px 0;
    }
    
    .submission-form {
        margin-top: 20px;
    }
    
    .form-group {
        margin-bottom: 15px;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
    }
    
    .form-group input,
    .form-group select,
    .form-group textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }
    
    .form-text {
        font-size: 12px;
        color: #666;
        margin-top: 5px;
        display: block;
    }
    
    .drive-instructions {
        background: #e3f2fd;
        padding: 15px;
        border-radius: 4px;
        margin: 15px 0;
    }
    
    .drive-instructions h4 {
        margin-bottom: 10px;
        color: #1976d2;
    }
    
    .drive-instructions ol {
        margin-left: 20px;
        color: #666;
    }
    
    .drive-instructions li {
        margin: 5px 0;
    }
    
    .form-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
    }
    
    .success-message {
        text-align: center;
        padding: 30px;
    }
    
    .success-message i {
        font-size: 48px;
        color: #4caf50;
        margin-bottom: 15px;
    }
    
    @media (max-width: 768px) {
        .filter-controls {
            flex-direction: column;
            align-items: stretch;
        }
        
        .assignment-header {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .assignment-meta {
            flex-direction: column;
            gap: 10px;
        }
        
        .assignment-actions {
            flex-direction: column;
        }
        
        .modal-content {
            margin: 20px;
        }
    }
`;

// Add styles if they don't exist
if (!document.getElementById('homework-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'homework-styles';
    styleSheet.textContent = additionalStyles;
    document.head.appendChild(styleSheet);
}
