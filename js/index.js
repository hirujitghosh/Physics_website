// js/index.js - Complete Home Page Functionality

// Google Apps Script Web App URL - REPLACE WITH YOUR DEPLOYED URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzgsk-8tLfMRmllVkzLlia1k9XOGL3phupnwxoSQktAYrPGEc9QWtp7i6AaxZdK0Add/exec';

document.addEventListener('DOMContentLoaded', function() {
    console.log('Home page loaded');
    
    // Load statistics
    loadStats();
    
    // Setup feedback form
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', handleFeedbackSubmit);
    }
    
    // Setup star rating
    setupStarRating();
    
    // Mobile menu toggle
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }
    
    // Semester buttons - already have direct links in HTML
});

// ============================================
// LOAD STATISTICS FROM FIREBASE
// ============================================

async function loadStats() {
    try {
        // Check if Firebase is initialized
        if (typeof db === 'undefined') {
            console.warn('Firebase not initialized, using default stats');
            updateStatsWithDefaults();
            return;
        }
        
        // Load total students count
        const studentsSnapshot = await db.collection('students').get();
        const totalStudents = studentsSnapshot.size;
        
        // Load total assignments count
        const assignmentsSnapshot = await db.collection('assignments')
            .where('status', '==', 'active')
            .get();
        const totalAssignments = assignmentsSnapshot.size;
        
        // Load total classes (attendance records count)
        const attendanceSnapshot = await db.collection('attendance').get();
        const totalClasses = attendanceSnapshot.size;
        
        // Calculate average attendance (simplified)
        let avgAttendance = 92; // Default value
        
        const attendanceSummarySnapshot = await db.collection('attendance_summary').get();
        if (!attendanceSummarySnapshot.empty) {
            let totalPercentage = 0;
            let count = 0;
            attendanceSummarySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.percentage) {
                    totalPercentage += data.percentage;
                    count++;
                }
            });
            if (count > 0) {
                avgAttendance = Math.round(totalPercentage / count);
            }
        }
        
        updateStatsDisplay(totalStudents, totalAssignments, totalClasses, avgAttendance);
        
    } catch (error) {
        console.error('Error loading stats:', error);
        updateStatsWithDefaults();
    }
}

// Helper function to update stats display
function updateStatsDisplay(students, assignments, classes, attendance) {
    const totalStudentsEl = document.getElementById('totalStudents');
    const totalAssignmentsEl = document.getElementById('totalAssignments');
    const totalClassesEl = document.getElementById('totalClasses');
    const avgAttendanceEl = document.getElementById('avgAttendance');
    
    if (totalStudentsEl) totalStudentsEl.textContent = students + '+';
    if (totalAssignmentsEl) totalAssignmentsEl.textContent = assignments + '+';
    if (totalClassesEl) totalClassesEl.textContent = classes + '+';
    if (avgAttendanceEl) avgAttendanceEl.textContent = attendance + '%';
}

// Helper function to set default stats
function updateStatsWithDefaults() {
    updateStatsDisplay(150, 45, 200, 92);
}

// ============================================
// STAR RATING SETUP
// ============================================

function setupStarRating() {
    const stars = document.querySelectorAll('.star-rating i');
    const ratingInput = document.getElementById('feedbackRating');
    
    if (!stars.length) return;
    
    stars.forEach(star => {
        // Hover effect
        star.addEventListener('mouseenter', function() {
            const rating = parseInt(this.dataset.rating);
            highlightStars(rating, false);
        });
        
        // Mouse leave - reset to current rating
        star.addEventListener('mouseleave', function() {
            const currentRating = ratingInput ? parseInt(ratingInput.value) : 0;
            highlightStars(currentRating, true);
        });
        
        // Click to set rating
        star.addEventListener('click', function() {
            const rating = parseInt(this.dataset.rating);
            if (ratingInput) {
                ratingInput.value = rating;
            }
            highlightStars(rating, true);
        });
    });
    
    function highlightStars(rating, permanent = false) {
        stars.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            if (starRating <= rating) {
                star.classList.remove('far');
                star.classList.add('fas');
                if (permanent) {
                    star.classList.add('active');
                }
            } else {
                star.classList.remove('fas', 'active');
                star.classList.add('far');
            }
        });
    }
}

// ============================================
// HANDLE FEEDBACK SUBMISSION
// ============================================

async function handleFeedbackSubmit(e) {
    e.preventDefault();
    
    // Get form elements
    const nameInput = document.getElementById('feedbackName');
    const classSelect = document.getElementById('feedbackClass');
    const messageInput = document.getElementById('feedbackMessage');
    const ratingInput = document.getElementById('feedbackRating');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Get values
    const name = nameInput?.value.trim();
    const studentClass = classSelect?.value;
    const message = messageInput?.value.trim();
    const rating = ratingInput ? parseInt(ratingInput.value) : getRatingFromStars();
    
    // Validation
    if (!name || !studentClass || !message) {
        showFormMessage('Please fill in all fields', 'error');
        return;
    }
    
    if (rating === 0 || isNaN(rating)) {
        showFormMessage('Please select a rating', 'error');
        return;
    }
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    try {
        // Try Firebase first (if available)
        if (typeof db !== 'undefined' && firebase) {
            try {
                const feedbackData = {
                    name: name,
                    class: studentClass,
                    message: message,
                    rating: rating,
                    submittedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('feedback').add(feedbackData);
                console.log('Feedback saved to Firebase');
                
                // Also try Apps Script as backup
                await submitToAppsScript(name, studentClass, rating, message);
                
                showFormMessage('Thank you for your feedback!', 'success');
                resetFeedbackForm(nameInput, classSelect, messageInput, ratingInput);
                return;
            } catch (firebaseError) {
                console.error('Firebase error:', firebaseError);
                // Fall back to Apps Script only
            }
        }
        
        // Use Apps Script only
        const result = await submitToAppsScript(name, studentClass, rating, message);
        
        if (result.success) {
            showFormMessage('Thank you for your feedback!', 'success');
            resetFeedbackForm(nameInput, classSelect, messageInput, ratingInput);
        } else {
            throw new Error(result.message || 'Unknown error');
        }
        
    } catch (error) {
        console.error('Error submitting feedback:', error);
        showFormMessage('Failed to submit feedback. Please try again.', 'error');
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ============================================
// APPS SCRIPT INTEGRATION
// ============================================

async function submitToAppsScript(name, studentClass, rating, message) {
    try {
        // Create form data
        const formData = new FormData();
        formData.append('name', name);
        formData.append('class', studentClass);
        formData.append('rating', rating);
        formData.append('feedback', message);
        
        // Send to Apps Script
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: formData,
            mode: 'no-cors' // This helps with CORS issues but limits response handling
        });
        
        // Since we're using no-cors, we can't read the response
        // Assume success if no error thrown
        return { success: true };
        
    } catch (error) {
        console.error('Apps Script submission error:', error);
        return { success: false, message: error.message };
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get rating from stars if no hidden input
function getRatingFromStars() {
    const activeStars = document.querySelectorAll('.star-rating i.fas');
    return activeStars.length;
}

// Show form message
function showFormMessage(message, type) {
    // Check if message div exists, if not create it
    let messageDiv = document.getElementById('feedbackFormMessage');
    
    if (!messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'feedbackFormMessage';
        messageDiv.className = 'form-message';
        
        const form = document.getElementById('feedbackForm');
        const submitBtn = form.querySelector('button[type="submit"]');
        form.insertBefore(messageDiv, submitBtn);
    }
    
    messageDiv.textContent = message;
    messageDiv.className = `form-message ${type}`;
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        if (messageDiv) {
            messageDiv.textContent = '';
            messageDiv.className = 'form-message';
        }
    }, 5000);
}

// Reset feedback form
function resetFeedbackForm(nameInput, classSelect, messageInput, ratingInput) {
    // Reset inputs
    if (nameInput) nameInput.value = '';
    if (classSelect) classSelect.value = '';
    if (messageInput) messageInput.value = '';
    if (ratingInput) ratingInput.value = '0';
    
    // Reset stars
    document.querySelectorAll('.star-rating i').forEach(star => {
        star.classList.remove('fas', 'active');
        star.classList.add('far');
    });
}

// ============================================
// ALTERNATIVE: Direct Google Forms Integration
// ============================================

// If you prefer using Google Forms directly instead of Apps Script
function submitToGoogleForms(name, studentClass, rating, message) {
    // Replace with your Google Form's action URL
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse';
    
    // Create a hidden iframe to submit the form
    const iframe = document.createElement('iframe');
    iframe.name = 'hidden_iframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Create a hidden form
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = GOOGLE_FORM_URL;
    form.target = 'hidden_iframe';
    form.style.display = 'none';
    
    // Add form fields (update entry IDs based on your Google Form)
    const fields = {
        'entry.123456789': name,      // Replace with your entry IDs
        'entry.987654321': studentClass,
        'entry.456789123': rating,
        'entry.789123456': message
    };
    
    for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }
    
    document.body.appendChild(form);
    form.submit();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(form);
        document.body.removeChild(iframe);
    }, 1000);
    
    return { success: true };
}

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL ACCESS
// ============================================

// Make functions available globally if needed
window.submitFeedback = handleFeedbackSubmit;
window.loadStats = loadStats;
