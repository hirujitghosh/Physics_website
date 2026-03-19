// homework.js - Complete with PDF upload functionality

document.addEventListener('DOMContentLoaded', function() {
    console.log('Homework page loaded');
    
    // Load assignments when page loads
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
    
    // Handle student selection change
    const studentSelect = document.getElementById('studentSelect');
    if (studentSelect) {
        studentSelect.addEventListener('change', validateForm);
    }
    
    // File upload handling
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileUpload');
    const removeFileBtn = document.getElementById('removeFile');
    
    if (fileUploadArea && fileInput) {
        fileUploadArea.addEventListener('click', () => fileInput.click());
        
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.style.background = '#e3f2fd';
        });
        
        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.style.background = '#f8f9fa';
        });
        
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.style.background = '#f8f9fa';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }
    
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', removeFile);
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
let selectedFile = null;
let studentsCache = {};

// ============================================
// LOAD ASSIGNMENTS FROM FIREBASE
// ============================================

async function loadAssignments() {
    const assignmentsGrid = document.getElementById('assignmentsGrid');
    
    if (!assignmentsGrid) return;
    
    try {
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
            
            const card = createAssignmentCard(assignment);
            assignmentsGrid.appendChild(card);
        });
        
        filteredAssignments = [...allAssignments];
        updateSemesterOptions();
        
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
    card.dataset.class = assignment.class;
    card.dataset.semester = assignment.semester;
    
    const deadline = assignment.deadline ? new Date(assignment.deadline) : new Date();
    const today = new Date();
    const isOverdue = deadline < today;
    
    const daysLeft = Math.ceil((deadline - today) / (1000 * 3600 * 24));
    const deadlineStr = deadline.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    card.innerHTML = `
        <div class="assignment-header">
            <h3>${assignment.title || 'Untitled Assignment'}</h3>
            <span class="class-badge">Class ${assignment.class || 'N/A'} - Sem ${assignment.semester || 'N/A'}</span>
        </div>
        <p>${assignment.description || 'No description provided.'}</p>
        <div class="assignment-meta">
            <span><i class="fas fa-calendar-alt"></i> Deadline: ${deadlineStr}</span>
            <span><i class="fas fa-clock"></i> ${isOverdue ? 'Overdue' : `${daysLeft} days left`}</span>
            <span><i class="fas fa-star"></i> Marks: ${assignment.totalMarks || 'N/A'}</span>
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
    const assignmentsGrid = document.getElementById('assignmentsGrid');
    
    if (!assignmentsGrid) return;
    
    filteredAssignments = allAssignments.filter(assignment => {
        if (classFilter && assignment.class !== classFilter) return false;
        if (semesterFilter && assignment.semester != semesterFilter) return false;
        return true;
    });
    
    assignmentsGrid.innerHTML = '';
    
    if (filteredAssignments.length === 0) {
        assignmentsGrid.innerHTML = '<p class="no-data">No assignments match your filters</p>';
        return;
    }
    
    filteredAssignments.forEach(assignment => {
        assignmentsGrid.appendChild(createAssignmentCard(assignment));
    });
}

// ============================================
// STUDENT LOADING
// ============================================

async function loadStudentsForClass(classVal, semesterVal) {
    const cacheKey = `${classVal}_${semesterVal}`;
    
    if (studentsCache[cacheKey]) {
        return studentsCache[cacheKey];
    }
    
    try {
        const snapshot = await db.collection('students')
            .where('class', '==', classVal)
            .where('semester', '==', semesterVal)
            .orderBy('name')
            .get();
        
        const students = [];
        snapshot.forEach(doc => {
            students.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        studentsCache[cacheKey] = students;
        return students;
        
    } catch (error) {
        console.error('Error loading students:', error);
        return [];
    }
}

// ============================================
// SUBMISSION MODAL FUNCTIONS
// ============================================

window.openSubmissionModal = async function(assignmentId) {
    const modal = document.getElementById('submissionModal');
    const assignment = allAssignments.find(a => a.id === assignmentId);
    
    if (!modal || !assignment) return;
    
    // Store assignment info
    document.getElementById('assignmentId').value = assignmentId;
    document.getElementById('assignmentClass').value = assignment.class;
    document.getElementById('assignmentSemester').value = assignment.semester;
    
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
    
    // Load students for this class/semester
    const students = await loadStudentsForClass(assignment.class, assignment.semester);
    const studentSelect = document.getElementById('studentSelect');
    
    studentSelect.innerHTML = '<option value="">-- Select your name --</option>';
    
    if (students.length === 0) {
        studentSelect.innerHTML = '<option value="">No students found in this class</option>';
    } else {
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = student.name;
            studentSelect.appendChild(option);
        });
    }
    
    // Reset form
    resetForm();
    
    // Show modal
    modal.style.display = 'block';
}

function resetForm() {
    document.getElementById('submissionForm').reset();
    document.getElementById('submissionForm').style.display = 'block';
    document.getElementById('submissionSuccess').style.display = 'none';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('progressBar').style.display = 'none';
    document.getElementById('submitBtn').disabled = true;
    selectedFile = null;
}

function handleFileSelect(file) {
    // Validate file type
    if (file.type !== 'application/pdf') {
        alert('Please select a PDF file only.');
        return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB.');
        return;
    }
    
    selectedFile = file;
    
    // Update UI
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function validateForm() {
    const studentSelected = document.getElementById('studentSelect').value;
    const fileSelected = selectedFile !== null;
    const submitBtn = document.getElementById('submitBtn');
    
    submitBtn.disabled = !(studentSelected && fileSelected);
}

// ============================================
// HANDLE SUBMISSION
// ============================================

async function handleSubmission(e) {
    e.preventDefault();
    
    const assignmentId = document.getElementById('assignmentId').value;
    const studentId = document.getElementById('studentSelect').value;
    const comments = document.getElementById('comments').value;
    
    // Get student details
    const studentDoc = await db.collection('students').doc(studentId).get();
    const student = studentDoc.data();
    
    if (!student) {
        alert('Student not found');
        return;
    }
    
    // Show progress bar
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    progressBar.style.display = 'block';
    progressFill.style.width = '0%';
    progressFill.textContent = '0%';
    
    // Disable submit button
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Uploading...';
    
    try {
        // Step 1: Upload file to Google Drive via Apps Script
        progressFill.style.width = '30%';
        progressFill.textContent = '30%';
        
        const formData = new FormData();
        formData.append('action', 'uploadAssignment');
        formData.append('assignmentId', assignmentId);
        formData.append('studentName', student.name);
        formData.append('studentClass', student.class);
        formData.append('studentSemester', student.semester);
        formData.append('file', selectedFile);
        formData.append('comments', comments);
        
        // Upload to Apps Script
        const uploadResponse = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: formData
        });
        
        const uploadResult = await uploadResponse.json();
        
        if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Upload failed');
        }
        
        progressFill.style.width = '70%';
        progressFill.textContent = '70%';
        
        // Step 2: Save to Firestore
        const submissionData = {
            assignmentId: assignmentId,
            studentId: studentId,
            studentName: student.name,
            studentClass: student.class,
            studentSemester: student.semester,
            fileId: uploadResult.fileId,
            fileUrl: uploadResult.fileUrl,
            fileName: uploadResult.fileName,
            fileSize: selectedFile.size,
            comments: comments || '',
            status: 'submitted',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('submissions').add(submissionData);
        
        progressFill.style.width = '100%';
        progressFill.textContent = '100%';
        
        // Show success message
        setTimeout(() => {
            document.getElementById('submissionForm').style.display = 'none';
            document.getElementById('submissionSuccess').style.display = 'block';
            progressBar.style.display = 'none';
        }, 500);
        
    } catch (error) {
        console.error('Error submitting assignment:', error);
        alert('Error submitting assignment: ' + error.message);
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Submit Assignment';
        progressBar.style.display = 'none';
    }
}

// ============================================
// MODAL HELPER
// ============================================

window.closeModal = function() {
    const modal = document.getElementById('submissionModal');
    if (modal) {
        modal.style.display = 'none';
        resetForm();
    }
}

// Add event listener for student select change
document.getElementById('studentSelect')?.addEventListener('change', validateForm);
