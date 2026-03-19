// homework.js - COMPLETE WORKING VERSION with Apps Script upload

document.addEventListener('DOMContentLoaded', function() {
    console.log('Homework page loaded');
    
    // Load assignments
    loadAssignments();
    
    // Setup filters
    const classFilter = document.getElementById('classFilter');
    const semesterFilter = document.getElementById('semesterFilter');
    const applyFilters = document.getElementById('applyFilters');
    
    if (classFilter) {
        classFilter.addEventListener('change', updateSemesterOptions);
    }
    
    if (applyFilters) {
        applyFilters.addEventListener('click', filterAssignments);
    }
    
    // File upload handling
    setupFileUpload();
    
    // Form submission
    const submissionForm = document.getElementById('submissionForm');
    if (submissionForm) {
        submissionForm.addEventListener('submit', handleSubmission);
    }
    
    // Modal close handlers
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
});

// Global variables
let allAssignments = [];
let selectedFile = null;

// ============================================
// SETUP FILE UPLOAD
// ============================================

function setupFileUpload() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileUpload');
    const removeFileBtn = document.getElementById('removeFile');
    
    if (!fileUploadArea || !fileInput) return;
    
    fileUploadArea.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            validateAndSelectFile(e.target.files[0]);
        }
    });
    
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', removeFile);
    }
}

// ============================================
// LOAD ASSIGNMENTS
// ============================================

async function loadAssignments() {
    const assignmentsGrid = document.getElementById('assignmentsGrid');
    
    if (!assignmentsGrid) return;
    
    try {
        console.log('Loading assignments...');
        
        const snapshot = await db.collection('assignments')
            .where('status', '==', 'active')
            .orderBy('deadline', 'asc')
            .get();
        
        if (snapshot.empty) {
            assignmentsGrid.innerHTML = '<p class="no-data">No assignments available</p>';
            return;
        }
        
        assignmentsGrid.innerHTML = '';
        allAssignments = [];
        
        snapshot.forEach(doc => {
            const assignment = {
                id: doc.id,
                ...doc.data()
            };
            allAssignments.push(assignment);
            assignmentsGrid.appendChild(createAssignmentCard(assignment));
        });
        
        updateSemesterOptions();
        console.log(`Loaded ${allAssignments.length} assignments`);
        
    } catch (error) {
        console.error('Error loading assignments:', error);
        assignmentsGrid.innerHTML = '<p class="error">Error loading assignments. Please refresh.</p>';
    }
}

// ============================================
// CREATE ASSIGNMENT CARD
// ============================================

function createAssignmentCard(assignment) {
    const card = document.createElement('div');
    card.className = 'assignment-card';
    card.dataset.id = assignment.id;
    
    const deadline = assignment.deadline ? new Date(assignment.deadline) : new Date();
    const today = new Date();
    const isOverdue = deadline < today;
    const daysLeft = Math.ceil((deadline - today) / (1000 * 3600 * 24));
    
    card.innerHTML = `
        <div class="assignment-header">
            <h3>${assignment.title || 'Untitled'}</h3>
            <span class="class-badge">Class ${assignment.class || 'N/A'} - Sem ${assignment.semester || 'N/A'}</span>
        </div>
        <p>${assignment.description || 'No description'}</p>
        <div class="assignment-meta">
            <span><i class="fas fa-calendar-alt"></i> Deadline: ${deadline.toLocaleDateString()}</span>
            <span><i class="fas fa-clock"></i> ${isOverdue ? 'Overdue' : daysLeft + ' days left'}</span>
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
    
    semesterFilter.innerHTML = '<option value="">All Semesters</option>';
    
    if (!classFilter.value) return;
    
    const numSemesters = classFilter.value === 'BSc' ? 8 : 2;
    for (let i = 1; i <= numSemesters; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterFilter.appendChild(option);
    }
}

function filterAssignments() {
    const classFilter = document.getElementById('classFilter')?.value;
    const semesterFilter = document.getElementById('semesterFilter')?.value;
    const grid = document.getElementById('assignmentsGrid');
    
    if (!grid) return;
    
    const filtered = allAssignments.filter(a => {
        if (classFilter && a.class !== classFilter) return false;
        if (semesterFilter && a.semester != semesterFilter) return false;
        return true;
    });
    
    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p class="no-data">No assignments match filters</p>';
    } else {
        filtered.forEach(a => grid.appendChild(createAssignmentCard(a)));
    }
}

// ============================================
// OPEN SUBMISSION MODAL
// ============================================

window.openSubmissionModal = async function(assignmentId) {
    console.log('Opening modal for assignment:', assignmentId);
    
    const modal = document.getElementById('submissionModal');
    const assignment = allAssignments.find(a => a.id === assignmentId);
    
    if (!modal || !assignment) {
        console.error('Modal or assignment not found');
        return;
    }
    
    // Store assignment info
    document.getElementById('assignmentId').value = assignmentId;
    document.getElementById('assignmentClass').value = assignment.class;
    document.getElementById('assignmentSemester').value = assignment.semester;
    
    // Show assignment details
    document.getElementById('assignmentDetails').innerHTML = `
        <h3>${assignment.title}</h3>
        <p><strong>Class:</strong> ${assignment.class} - Semester ${assignment.semester}</p>
        <p><strong>Deadline:</strong> ${new Date(assignment.deadline).toLocaleDateString()}</p>
    `;
    
    // Load students
    const studentSelect = document.getElementById('studentSelect');
    studentSelect.innerHTML = '<option value="">Loading students...</option>';
    studentSelect.disabled = true;
    
    const students = await loadStudents(assignment.class, assignment.semester);
    
    studentSelect.innerHTML = '<option value="">-- Select your name --</option>';
    studentSelect.disabled = false;
    
    if (students.length === 0) {
        studentSelect.innerHTML = '<option value="">No students found</option>';
    } else {
        students.forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = s.name;
            studentSelect.appendChild(option);
        });
    }
    
    // Reset and show modal
    resetForm();
    modal.style.display = 'block';
}

// ============================================
// LOAD STUDENTS
// ============================================

async function loadStudents(classVal, semesterVal) {
    console.log(`Loading students for class ${classVal}, sem ${semesterVal}`);
    
    try {
        const snapshot = await db.collection('students')
            .where('class', '==', classVal)
            .where('semester', '==', semesterVal)
            .orderBy('name')
            .get();
        
        console.log(`Found ${snapshot.size} students`);
        
        const students = [];
        snapshot.forEach(doc => {
            students.push({
                id: doc.id,
                name: doc.data().name
            });
        });
        
        return students;
        
    } catch (error) {
        console.error('Error loading students:', error);
        return [];
    }
}

// ============================================
// FILE HANDLING
// ============================================

function validateAndSelectFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Please select a PDF file only.');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB.');
        return;
    }
    
    selectedFile = file;
    
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatBytes(file.size);
    document.getElementById('fileInfo').style.display = 'flex';
    document.getElementById('fileUploadArea').style.display = 'none';
    
    validateForm();
}

function removeFile() {
    selectedFile = null;
    document.getElementById('fileUpload').value = '';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('fileUploadArea').style.display = 'block';
    validateForm();
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function validateForm() {
    const studentSelected = document.getElementById('studentSelect').value;
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = !(studentSelected && selectedFile);
}

// ============================================
// HANDLE SUBMISSION - WITH APPS SCRIPT UPLOAD
// ============================================

async function handleSubmission(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('studentSelect').value;
    const assignmentId = document.getElementById('assignmentId').value;
    const comments = document.getElementById('comments').value;
    
    if (!studentId || !selectedFile) {
        alert('Please select your name and a file');
        return;
    }
    
    // Show progress
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    progressBar.style.display = 'block';
    progressFill.style.width = '10%';
    progressFill.textContent = '10%';
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Uploading...';
    
    try {
        // Get student info
        const studentDoc = await db.collection('students').doc(studentId).get();
        const student = studentDoc.data();
        
        progressFill.style.width = '20%';
        progressFill.textContent = '20%';
        
        // Create FormData for Apps Script
        const formData = new FormData();
        formData.append('assignmentId', assignmentId);
        formData.append('studentName', student.name);
        formData.append('studentClass', student.class);
        formData.append('studentSemester', student.semester);
        formData.append('comments', comments || '');
        formData.append('file', selectedFile);
        
        // Log what we're sending
        console.log('Sending to Apps Script:');
        console.log('Student:', student.name);
        console.log('File:', selectedFile.name);
        console.log('File size:', selectedFile.size);
        
        progressFill.style.width = '30%';
        progressFill.textContent = '30%';
        
        // Send to Apps Script
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: formData
        });
        
        progressFill.style.width = '60%';
        progressFill.textContent = '60%';
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Get the response
        const result = await response.json();
        console.log('Apps Script response:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Upload failed');
        }
        
        progressFill.style.width = '80%';
        progressFill.textContent = '80%';
        
        // Save to Firestore
        const submissionData = {
            assignmentId: assignmentId,
            studentId: studentId,
            studentName: student.name,
            studentClass: student.class,
            studentSemester: student.semester,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileUrl: result.fileUrl || '',
            fileId: result.fileId || '',
            comments: comments || '',
            status: 'submitted',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('submissions').add(submissionData);
        
        progressFill.style.width = '100%';
        progressFill.textContent = '100%';
        
        // Show success
        setTimeout(() => {
            document.getElementById('submissionForm').style.display = 'none';
            document.getElementById('submissionSuccess').style.display = 'block';
            progressBar.style.display = 'none';
        }, 500);
        
    } catch (error) {
        console.error('Submission error:', error);
        alert('Error submitting assignment: ' + error.message);
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Submit Assignment';
        progressBar.style.display = 'none';
    }
}

// ============================================
// MODAL HELPER
// ============================================

function resetForm() {
    document.getElementById('submissionForm').reset();
    document.getElementById('submissionForm').style.display = 'block';
    document.getElementById('submissionSuccess').style.display = 'none';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('fileUploadArea').style.display = 'block';
    document.getElementById('progressBar').style.display = 'none';
    document.getElementById('submitBtn').disabled = true;
    selectedFile = null;
}

window.closeModal = function() {
    const modal = document.getElementById('submissionModal');
    if (modal) {
        modal.style.display = 'none';
        resetForm();
    }
}

// Add student select listener
document.getElementById('studentSelect')?.addEventListener('change', validateForm);
