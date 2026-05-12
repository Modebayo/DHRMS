let currentUser = null;
let userData = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    lucide.createIcons();
    
    const result = await guardPage();
    if (!result) return;
    
    currentUser = result.user;
    userData = result.userData;
    
    loadPatientInfo();
    loadMyRecords();
});

function loadPatientInfo() {
    document.getElementById('patientInfo').innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 16px;">
            <div><strong>Name:</strong> ${userData.firstName} ${userData.lastName}</div>
            <div><strong>Student ID:</strong> ${userData.studentId || 'N/A'}</div>
            <div><strong>Department:</strong> ${userData.department || 'N/A'}</div>
            <div><strong>Level:</strong> ${userData.level || 'N/A'}</div>
            <div><strong>Email:</strong> ${userData.email}</div>
            <div><strong>Phone:</strong> ${userData.phone || 'N/A'}</div>
        </div>
    `;
}

async function loadMyRecords() {
    const tbody = document.getElementById('myRecordsTable');
    
    try {
        const snapshot = await db.collection('health_records')
            .where('patientId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-icon">📋</div><h3>No Records Yet</h3><p>Your medical records will appear here once created by medical staff</p></td></tr>';
            return;
        }
        
        tbody.innerHTML = snapshot.docs.map(doc => {
            const record = doc.data();
            const severityClass = record.severity === 'critical' ? 'danger' : record.severity === 'severe' ? 'warning' : record.severity === 'moderate' ? 'info' : 'success';
            const statusClass = record.status === 'active' ? 'success' : record.status === 'discharged' ? 'info' : 'warning';
            
            return `
                <tr>
                    <td>${formatDate(record.visitDate)}</td>
                    <td>${record.recordType || 'Consultation'}</td>
                    <td>${record.symptoms?.substring(0, 40) || 'N/A'}...</td>
                    <td>${record.diagnosis?.substring(0, 40) || 'Pending'}...</td>
                    <td><span class="badge badge-${severityClass}">${record.severity || 'Normal'}</span></td>
                    <td><span class="badge badge-${statusClass}">${record.status || 'Active'}</span></td>
                </tr>
            `;
        }).join('');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
    } catch (error) {
        console.error('Error loading records:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><h3>Error Loading Records</h3><p>Please try again later</p></td></tr>';
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
