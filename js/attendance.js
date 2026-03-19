// attendance.js
document.addEventListener('DOMContentLoaded', function() {
    // Setup class change handler
    document.getElementById('checkClass').addEventListener('change', updateSemesterOptions);
    document.getElementById('checkSemester').addEventListener('change', updateStudentOptions);
    
    // Form submission
    document.getElementById('attendanceForm').addEventListener('submit', handleAttendanceCheck);
    
    // Download button
    document.getElementById('downloadAttendance').addEventListener('click', downloadAttendanceReport);
    
    // Initialize semester options
    updateSemesterOptions();
});

let attendanceChart = null;

function updateSemesterOptions() {
    const classVal = document.getElementById('checkClass').value;
    const semesterSelect = document.getElementById('checkSemester');
    
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';
    document.getElementById('checkStudent').innerHTML = '<option value="">Select Student</option>';
    
    if (!classVal) return;
    
    const semesters = classVal === 'BSc' ? 8 : 2;
    for (let i = 1; i <= semesters; i++) {
        semesterSelect.innerHTML += `<option value="${i}">Semester ${i}</option>`;
    }
}

function updateStudentOptions() {
    const classVal = document.getElementById('checkClass').value;
    const semesterVal = document.getElementById('checkSemester').value;
    const studentSelect = document.getElementById('checkStudent');
    
    studentSelect.innerHTML = '<option value="">Select Student</option>';
    
    if (!classVal || !semesterVal) return;
    
    db.collection('students')
        .where('class', '==', classVal)
        .where('semester', '==', semesterVal)
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                const student = doc.data();
                studentSelect.innerHTML += `<option value="${doc.id}">${student.name}</option>`;
            });
        })
        .catch(error => {
            console.error('Error loading students:', error);
        });
}

function handleAttendanceCheck(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('checkStudent').value;
    const studentName = document.getElementById('checkStudent').selectedOptions[0].text;
    const classVal = document.getElementById('checkClass').value;
    const semesterVal = document.getElementById('checkSemester').value;
    
    if (!studentId) {
        alert('Please select a student');
        return;
    }
    
    document.getElementById('studentNameDisplay').textContent = studentName;
    
    loadAttendanceData(studentId, studentName, classVal, semesterVal);
}

async function loadAttendanceData(studentId, studentName, classVal, semesterVal) {
    try {
        // Load attendance summary
        const summaryDoc = await db.collection('attendance_summary').doc(studentId).get();
        
        if (!summaryDoc.exists) {
            document.getElementById('attendanceResults').style.display = 'none';
            document.getElementById('noData').style.display = 'block';
            return;
        }
        
        const summary = summaryDoc.data();
        
        // Update stats
        document.getElementById('totalClasses').textContent = summary.totalClasses || 0;
        document.getElementById('presentCount').textContent = summary.present || 0;
        document.getElementById('absentCount').textContent = summary.absent || 0;
        document.getElementById('lateCount').textContent = summary.late || 0;
        
        const percent = summary.percentage || 0;
        document.getElementById('attendancePercent').textContent = percent + '%';
        
        // Update circle progress
        updateProgressCircle(percent);
        
        // Load attendance history
        await loadAttendanceHistory(studentId);
        
        // Load monthly chart data
        await loadMonthlyChart(studentId);
        
        // Show results
        document.getElementById('attendanceResults').style.display = 'block';
        document.getElementById('noData').style.display = 'none';
        
    } catch (error) {
        console.error('Error loading attendance:', error);
        alert('Error loading attendance data');
    }
}

function updateProgressCircle(percent) {
    const circle = document.getElementById('attendanceCircle');
    if (circle) {
        circle.style.background = `conic-gradient(var(--secondary-color) ${percent * 3.6}deg, #f0f0f0 0deg)`;
    }
}

async function loadAttendanceHistory(studentId) {
    const tbody = document.getElementById('attendanceHistory');
    tbody.innerHTML = '';
    
    const snapshot = await db.collection('attendance')
        .where('studentName', '==', studentId) // Note: You might want to use studentId instead
        .orderBy('date', 'desc')
        .limit(30)
        .get();
    
    if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="2">No attendance records found</td></tr>';
        return;
    }
    
    snapshot.forEach(doc => {
        const record = doc.data();
        const date = record.date.toDate ? record.date.toDate() : new Date(record.date);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${date.toLocaleDateString()}</td>
            <td><span class="status-badge ${record.status}">${record.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

async function loadMonthlyChart(studentId) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    // Get last 6 months of attendance
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    
    const snapshot = await db.collection('attendance')
        .where('studentName', '==', studentId)
        .where('date', '>=', sixMonthsAgo)
        .get();
    
    // Process data by month
    const monthlyData = {};
    const months = [];
    
    snapshot.forEach(doc => {
        const record = doc.data();
        const date = record.date.toDate ? record.date.toDate() : new Date(record.date);
        const monthYear = `${date.getMonth()+1}/${date.getFullYear()}`;
        
        if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = { present: 0, total: 0 };
            months.push(monthYear);
        }
        
        monthlyData[monthYear].total++;
        if (record.status === 'present') {
            monthlyData[monthYear].present++;
        }
    });
    
    // Prepare chart data
    const percentages = months.map(month => {
        const data = monthlyData[month];
        return data.total > 0 ? (data.present / data.total * 100).toFixed(1) : 0;
    });
    
    // Destroy existing chart
    if (attendanceChart) {
        attendanceChart.destroy();
    }
    
    // Create new chart
    attendanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Attendance %',
                data: percentages,
                borderColor: 'var(--secondary-color)',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Percentage'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function downloadAttendanceReport() {
    const studentName = document.getElementById('studentNameDisplay').textContent;
    const rows = [];
    
    // Get table data
    document.querySelectorAll('#attendanceHistory tr').forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length === 2) {
            rows.push([cols[0].textContent, cols[1].textContent]);
        }
    });
    
    if (rows.length === 0) return;
    
    // Create CSV
    let csv = 'Date,Status\n';
    rows.forEach(row => {
        csv += row.join(',') + '\n';
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${studentName}-attendance.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}
