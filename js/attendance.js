// js/attendance.js - Complete Attendance Page Functionality

document.addEventListener('DOMContentLoaded', function() {
    console.log('Attendance page loaded');
    
    // Setup class change handler
    const checkClass = document.getElementById('checkClass');
    if (checkClass) {
        checkClass.addEventListener('change', updateSemesterOptions);
    }
    
    // Setup semester change handler
    const checkSemester = document.getElementById('checkSemester');
    if (checkSemester) {
        checkSemester.addEventListener('change', updateStudentOptions);
    }
    
    // Form submission
    const attendanceForm = document.getElementById('attendanceForm');
    if (attendanceForm) {
        attendanceForm.addEventListener('submit', handleAttendanceCheck);
    }
    
    // Download button
    const downloadBtn = document.getElementById('downloadAttendance');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadAttendanceReport);
    }
    
    // Initialize semester options if class is pre-selected
    if (checkClass && checkClass.value) {
        updateSemesterOptions();
    }
});

// Global variable for chart
let attendanceChart = null;

// ============================================
// UPDATE DROPDOWN OPTIONS
// ============================================

function updateSemesterOptions() {
    console.log('Updating semester options');
    const classVal = document.getElementById('checkClass').value;
    const semesterSelect = document.getElementById('checkSemester');
    const studentSelect = document.getElementById('checkStudent');
    
    if (!semesterSelect || !studentSelect) return;
    
    // Clear dropdowns
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';
    studentSelect.innerHTML = '<option value="">Select Student</option>';
    
    if (!classVal) return;
    
    // Determine number of semesters
    const semesters = classVal === 'BSc' ? 8 : 2;
    
    // Add semester options
    for (let i = 1; i <= semesters; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterSelect.appendChild(option);
    }
    
    console.log(`Added ${semesters} semester options for class ${classVal}`);
}

async function updateStudentOptions() {
    console.log('Updating student options');
    const classVal = document.getElementById('checkClass').value;
    const semesterVal = document.getElementById('checkSemester').value;
    const studentSelect = document.getElementById('checkStudent');
    
    if (!studentSelect) return;
    
    // Clear student dropdown
    studentSelect.innerHTML = '<option value="">Select Student</option>';
    
    if (!classVal || !semesterVal) return;
    
    try {
        // Load students from Firebase
        const snapshot = await db.collection('students')
            .where('class', '==', classVal)
            .where('semester', '==', semesterVal)
            .orderBy('name')
            .get();
        
        console.log(`Found ${snapshot.size} students`);
        
        if (snapshot.empty) {
            studentSelect.innerHTML = '<option value="">No students found</option>';
            return;
        }
        
        // Add student options
        snapshot.forEach(doc => {
            const student = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = student.name;
            option.dataset.name = student.name;
            studentSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading students:', error);
        studentSelect.innerHTML = '<option value="">Error loading students</option>';
    }
}

// ============================================
// HANDLE ATTENDANCE CHECK
// ============================================

async function handleAttendanceCheck(e) {
    e.preventDefault();
    
    console.log('Checking attendance...');
    
    const studentId = document.getElementById('checkStudent').value;
    const studentSelect = document.getElementById('checkStudent');
    const studentName = studentSelect.selectedOptions[0]?.textContent || '';
    const classVal = document.getElementById('checkClass').value;
    const semesterVal = document.getElementById('checkSemester').value;
    
    if (!studentId) {
        alert('Please select a student');
        return;
    }
    
    console.log(`Checking attendance for: ${studentName} (${studentId})`);
    
    // Update display name
    document.getElementById('studentNameDisplay').textContent = studentName;
    
    // Load attendance data
    await loadAttendanceData(studentId, studentName, classVal, semesterVal);
}

// ============================================
// LOAD ATTENDANCE DATA
// ============================================

async function loadAttendanceData(studentId, studentName, classVal, semesterVal) {
    console.log('Loading attendance data...');
    
    const resultsDiv = document.getElementById('attendanceResults');
    const noDataDiv = document.getElementById('noData');
    
    try {
        // Try to load from attendance_summary first (faster)
        const summaryDoc = await db.collection('attendance_summary').doc(studentId).get();
        
        if (summaryDoc.exists) {
            console.log('Found attendance summary');
            const summary = summaryDoc.data();
            
            // Update stats
            document.getElementById('totalClasses').textContent = summary.totalClasses || 0;
            document.getElementById('presentCount').textContent = summary.present || 0;
            document.getElementById('absentCount').textContent = summary.absent || 0;
            document.getElementById('lateCount').textContent = summary.late || 0;
            
            const percent = summary.percentage || 
                (summary.totalClasses > 0 ? ((summary.present / summary.totalClasses) * 100).toFixed(1) : 0);
            document.getElementById('attendancePercent').textContent = percent + '%';
            
            // Load detailed history
            await loadAttendanceHistory(studentName, classVal, semesterVal);
            
            // Show results
            resultsDiv.style.display = 'block';
            noDataDiv.style.display = 'none';
            
        } else {
            // If no summary, try to load from attendance records
            console.log('No summary found, checking attendance records');
            await loadAttendanceFromRecords(studentName, classVal, semesterVal);
        }
        
    } catch (error) {
        console.error('Error loading attendance:', error);
        alert('Error loading attendance data');
    }
}

async function loadAttendanceFromRecords(studentName, classVal, semesterVal) {
    console.log('Loading attendance from records...');
    
    const resultsDiv = document.getElementById('attendanceResults');
    const noDataDiv = document.getElementById('noData');
    
    try {
        // Query attendance records
        const snapshot = await db.collection('attendance')
            .where('studentName', '==', studentName)
            .where('class', '==', classVal)
            .where('semester', '==', semesterVal)
            .orderBy('date', 'desc')
            .get();
        
        console.log(`Found ${snapshot.size} attendance records`);
        
        if (snapshot.empty) {
            resultsDiv.style.display = 'none';
            noDataDiv.style.display = 'block';
            return;
        }
        
        // Calculate statistics
        let total = 0;
        let present = 0;
        let absent = 0;
        let late = 0;
        
        snapshot.forEach(doc => {
            total++;
            const status = doc.data().status;
            if (status === 'present') present++;
            else if (status === 'absent') absent++;
            else if (status === 'late') late++;
        });
        
        const percent = total > 0 ? ((present / total) * 100).toFixed(1) : 0;
        
        // Update stats
        document.getElementById('totalClasses').textContent = total;
        document.getElementById('presentCount').textContent = present;
        document.getElementById('absentCount').textContent = absent;
        document.getElementById('lateCount').textContent = late;
        document.getElementById('attendancePercent').textContent = percent + '%';
        
        // Load history
        await loadAttendanceHistory(studentName, classVal, semesterVal);
        
        // Show results
        resultsDiv.style.display = 'block';
        noDataDiv.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading attendance records:', error);
        throw error;
    }
}

async function loadAttendanceHistory(studentName, classVal, semesterVal) {
    console.log('Loading attendance history...');
    
    const tbody = document.getElementById('attendanceHistory');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
    
    try {
        // Get last 30 days of attendance
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const snapshot = await db.collection('attendance')
            .where('studentName', '==', studentName)
            .where('class', '==', classVal)
            .where('semester', '==', semesterVal)
            .orderBy('date', 'desc')
            .limit(30)
            .get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="2">No attendance records found</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        
        snapshot.forEach(doc => {
            const record = doc.data();
            const date = record.date ? new Date(record.date) : new Date();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date.toLocaleDateString()}</td>
                <td><span class="status-badge ${record.status}">${record.status}</span></td>
            `;
            tbody.appendChild(row);
        });
        
        // Load chart data
        await loadMonthlyChart(studentName, classVal, semesterVal);
        
    } catch (error) {
        console.error('Error loading attendance history:', error);
        tbody.innerHTML = '<tr><td colspan="2">Error loading history</td></tr>';
    }
}

async function loadMonthlyChart(studentName, classVal, semesterVal) {
    console.log('Loading monthly chart...');
    
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;
    
    try {
        // Get last 6 months of attendance
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        
        const snapshot = await db.collection('attendance')
            .where('studentName', '==', studentName)
            .where('class', '==', classVal)
            .where('semester', '==', semesterVal)
            .where('date', '>=', sixMonthsAgo.toISOString().split('T')[0])
            .get();
        
        // Process data by month
        const monthlyData = {};
        const months = [];
        
        // Initialize last 6 months
        for (let i = 0; i < 6; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthYear = `${d.getMonth() + 1}/${d.getFullYear()}`;
            months.unshift(monthYear);
            monthlyData[monthYear] = { present: 0, total: 0 };
        }
        
        // Count attendance by month
        snapshot.forEach(doc => {
            const record = doc.data();
            const date = new Date(record.date);
            const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
            
            if (monthlyData[monthYear]) {
                monthlyData[monthYear].total++;
                if (record.status === 'present') {
                    monthlyData[monthYear].present++;
                }
            }
        });
        
        // Calculate percentages
        const percentages = months.map(month => {
            const data = monthlyData[month];
            return data.total > 0 ? ((data.present / data.total) * 100).toFixed(1) : 0;
        });
        
        // Create or update chart
        if (attendanceChart) {
            attendanceChart.destroy();
        }
        
        attendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Attendance %',
                    data: percentages,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Percentage'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + '%';
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading chart:', error);
    }
}

// ============================================
// DOWNLOAD ATTENDANCE REPORT
// ============================================

function downloadAttendanceReport() {
    console.log('Downloading attendance report...');
    
    const studentName = document.getElementById('studentNameDisplay').textContent;
    const rows = [];
    
    // Get table data
    document.querySelectorAll('#attendanceHistory tr').forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length === 2) {
            rows.push([cols[0].textContent, cols[1].textContent]);
        }
    });
    
    if (rows.length === 0 || (rows.length === 1 && rows[0][0] === 'No attendance records found')) {
        alert('No attendance data to download');
        return;
    }
    
    // Create CSV
    let csv = 'Date,Status\n';
    rows.forEach(row => {
        if (row[0] !== 'No attendance records found') {
            csv += row.join(',') + '\n';
        }
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${studentName.replace(/\s+/g, '_')}_attendance.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    console.log('Report downloaded');
}

// ============================================
// ADD THESE STYLES TO YOUR CSS IF NOT PRESENT
// ============================================

const attendanceStyles = `
    .attendance-checker {
        padding: 40px 0;
        background: #f5f5f5;
    }
    
    .checker-card {
        background: white;
        border-radius: 8px;
        padding: 30px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        max-width: 800px;
        margin: 0 auto;
    }
    
    .checker-card h2 {
        color: #333;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .attendance-form .form-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 20px;
    }
    
    .attendance-results {
        padding: 40px 0;
    }
    
    .results-card {
        background: white;
        border-radius: 8px;
        padding: 30px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .results-card h2 {
        color: #333;
        margin-bottom: 30px;
        text-align: center;
    }
    
    .attendance-stats {
        display: flex;
        align-items: center;
        gap: 40px;
        margin-bottom: 40px;
        flex-wrap: wrap;
        justify-content: center;
    }
    
    .stat-circle {
        text-align: center;
    }
    
    .circle-progress {
        width: 150px;
        height: 150px;
        border-radius: 50%;
        background: #3498db;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: bold;
        color: white;
        margin-bottom: 10px;
        box-shadow: 0 4px 10px rgba(52,152,219,0.3);
    }
    
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
        flex: 1;
    }
    
    .stat-box {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
    }
    
    .stat-box.present {
        border-left: 4px solid #27ae60;
    }
    
    .stat-box.absent {
        border-left: 4px solid #e74c3c;
    }
    
    .stat-box.late {
        border-left: 4px solid #f39c12;
    }
    
    .stat-value {
        display: block;
        font-size: 28px;
        font-weight: bold;
        color: #333;
    }
    
    .stat-label {
        color: #666;
        font-size: 14px;
    }
    
    .attendance-history {
        margin: 30px 0;
    }
    
    .attendance-history h3 {
        color: #333;
        margin-bottom: 15px;
    }
    
    .attendance-chart {
        margin: 30px 0;
        height: 300px;
    }
    
    .attendance-actions {
        display: flex;
        justify-content: center;
        margin-top: 30px;
    }
    
    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
    }
    
    .status-badge.present {
        background: #d4edda;
        color: #155724;
    }
    
    .status-badge.absent {
        background: #f8d7da;
        color: #721c24;
    }
    
    .status-badge.late {
        background: #fff3cd;
        color: #856404;
    }
    
    .no-data {
        text-align: center;
        padding: 60px 0;
    }
    
    .no-data i {
        font-size: 64px;
        color: #ccc;
        margin-bottom: 20px;
    }
    
    .no-data h3 {
        color: #666;
        margin-bottom: 10px;
    }
    
    .no-data p {
        color: #999;
    }
    
    @media (max-width: 768px) {
        .attendance-stats {
            flex-direction: column;
            gap: 20px;
        }
        
        .attendance-form .form-row {
            grid-template-columns: 1fr;
        }
        
        .stats-grid {
            width: 100%;
        }
    }
`;

// Add styles if they don't exist
if (!document.getElementById('attendance-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'attendance-styles';
    styleSheet.textContent = attendanceStyles;
    document.head.appendChild(styleSheet);
}
