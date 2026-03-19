// homework.js - Fixed version with Google Drive upload via Apps Script

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
    
    // Student select listener
    const studentSelect = document.getElementById('studentSelect');
    if (studentSelect) {
        studentSelect.addEventListener('change', validateForm);
    }
});

// Global variables
let allAssignments = [];
let selectedFile = null;

// Google Apps Script URL - UPDATE THIS WITH YOUR DEPLOYED URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWM5idEuQgww_TvCk7sp0uhLOsttGnbPQ-mHECT-LeZVyA2HfMgRRqZYmxRiswWX_R/exec";

// ============================================
// SETUP FILE UPLOAD
// ============================================

function setupFileUpload() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileUpload');
    const removeFileBtn = document.getElementById('removeFile');
    
    if (!fileUploadArea || !fileInput) return;
    
    // Click on area triggers file input
    fileUploadArea.addEventListener('click', () => fileInput.click());
    
    // Drag and drop functionality
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.style.background = '#e3f2fd';
        fileUploadArea.style.borderColor = '#2980b9';
    });
    
    fileUploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileUploadArea.style.background = '#f8f9fa';
        fileUploadArea.style.borderColor = '#3498db';
    });
    
    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.style.background = '#f8f9fa';
        fileUploadArea.style.borderColor = '#3498db';
        
        if (e.dataTransfer.files.length > 0) {
            validateAndSelectFile(e.dataTransfer.files[0]);
        }
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            validateAndSelectFile(e.target.files[0]);
        }
    });
    
    // Remove file button
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
    
    const numSemesters = classFilter.value === 'BSc' ? 6 : 2;
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
    
    // Convert semester to number for comparison
    const classVal = assignment.class;
    const semesterVal = parseInt(assignment.semester);
    
    console.log(`Loading students for class: ${classVal}, semester: ${semesterVal}`);
    
    const students = await loadStudents(classVal, semesterVal);
    
    studentSelect.innerHTML = '<option value="">-- Select your name --</option>';
    studentSelect.disabled = false;
    
    if (students.length === 0) {
        studentSelect.innerHTML = '<option value="">No students found for this class/semester</option>';
        console.log('No students found');
    } else {
        console.log(`Found ${students.length} students`);
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
        // Convert semesterVal to number if it's a string
        const semNumber = typeof semesterVal === 'string' ? parseInt(semesterVal) : semesterVal;
        
        console.log('Query parameters:', {
            class: classVal,
            semester: semNumber,
            classType: typeof classVal,
            semesterType: typeof semNumber
        });
        
        const snapshot = await db.collection('students')
            .where('class', '==', classVal)
            .where('semester', '==', semNumber)
            .orderBy('name')
            .get();
        
        console.log(`Query returned ${snapshot.size} students`);
        
        const students = [];
        snapshot.forEach(doc => {
            students.push({
                id: doc.id,
                name: doc.data().name || 'Unknown'
            });
        });
        
        return students;
        
    } catch (error) {
        console.error('Error loading students:', error);
        
        if (error.code === 'failed-precondition') {
            alert('Please create the required index in Firebase Console. Check console for details.');
        }
        
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
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
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
// HANDLE SUBMISSION - WITH GOOGLE DRIVE UPLOAD
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
    
    // Get UI elements
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const submitBtn = document.getElementById('submitBtn');
    const form = document.getElementById('submissionForm');
    const successDiv = document.getElementById('submissionSuccess');
    
    // Show progress
    progressBar.style.display = 'block';
    progressFill.style.width = '10%';
    progressFill.textContent = '10%';
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting...';
    
    try {
        // Step 1: Get student info
        progressFill.style.width = '20%';
        progressFill.textContent = '20%';
        
        console.log('Fetching student with ID:', studentId);
        const studentDoc = await db.collection('students').doc(studentId).get();
        
        if (!studentDoc.exists) {
            throw new Error('Student not found with ID: ' + studentId);
        }
        
        const student = studentDoc.data();
        console.log('Student found:', student);
        
        // Step 2: Convert file to base64 for Apps Script
        progressFill.style.width = '30%';
        progressFill.textContent = '30%';
        
        const base64Data = await fileToBase64(selectedFile);
        
        progressFill.style.width = '50%';
        progressFill.textContent = '50%';
        
        // Step 3: Prepare data for Apps Script
        const timestamp = Date.now();
        const safeStudentName = student.name.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${safeStudentName}_${assignmentId}_${timestamp}.pdf`;
        
        const payload = {
            fileName: fileName,
            fileType: selectedFile.type,
            fileData: base64Data,
            studentName: student.name,
            studentId: studentId,
            studentClass: student.class,
            studentSemester: student.semester,
            assignmentId: assignmentId,
            comments: comments,
            timestamp: timestamp
        };
        
        console.log('Sending to Apps Script...');
        
        // Step 4: Send to Apps Script
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // This is important for CORS
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        progressFill.style.width = '80%';
        progressFill.textContent = '80%';
        
        // Note: With no-cors, we can't read the response
        // We'll assume it worked and save to Firestore
        
        // Step 5: Save submission data to Firestore
        const submissionData = {
            assignmentId: assignmentId,
            studentId: studentId,
            studentName: student.name,
            studentClass: student.class,
            studentSemester: student.semester,
            fileName: selectedFile.name,
            storedFileName: fileName,
            fileSize: selectedFile.size,
            comments: comments || '',
            status: 'submitted',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            driveFolder: `Assignments/${assignmentId}` // Optional: store folder info
        };
        
        console.log('Saving submission to Firestore:', submissionData);
        await db.collection('submissions').add(submissionData);
        
        progressFill.style.width = '100%';
        progressFill.textContent = '100%';
        
        // Step 6: Show success message
        setTimeout(() => {
            form.style.display = 'none';
            successDiv.style.display = 'block';
            progressBar.style.display = 'none';
            
            // Clear the selected file
            selectedFile = null;
            
            console.log('Submission complete! File sent to Google Drive');
        }, 500);
        
    } catch (error) {
        console.error('Submission error:', error);
        
        alert('Error submitting assignment: ' + error.message);
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Submit Assignment';
        progressBar.style.display = 'none';
        
        // Reset progress
        progressFill.style.width = '0%';
        progressFill.textContent = '0%';
    }
}

// ============================================
// HELPER: Convert File to Base64
// ============================================

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// ============================================
// MODAL HELPER FUNCTIONS
// ============================================

function resetForm() {
    const form = document.getElementById('submissionForm');
    const successDiv = document.getElementById('submissionSuccess');
    const fileInfo = document.getElementById('fileInfo');
    const fileUploadArea = document.getElementById('fileUploadArea');
    const progressBar = document.getElementById('progressBar');
    const submitBtn = document.getElementById('submitBtn');
    const progressFill = document.getElementById('progressFill');
    const fileInput = document.getElementById('fileUpload');
    
    if (form) form.style.display = 'block';
    if (successDiv) successDiv.style.display = 'none';
    if (fileInfo) fileInfo.style.display = 'none';
    if (fileUploadArea) fileUploadArea.style.display = 'block';
    if (progressBar) progressBar.style.display = 'none';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Submit Assignment';
    }
    if (progressFill) {
        progressFill.style.width = '0%';
        progressFill.textContent = '0%';
    }
    
    // Clear file input
    if (fileInput) {
        fileInput.value = '';
    }
    
    selectedFile = null;
}

window.closeModal = function() {
    const modal = document.getElementById('submissionModal');
    if (modal) {
        modal.style.display = 'none';
        resetForm();
    }
}
