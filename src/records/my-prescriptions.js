let currentUser = null;
let userData = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    lucide.createIcons();
    
    const result = await guardPage();
    if (!result) return;
    
    currentUser = result.user;
    userData = result.userData;
    
    loadMyPrescriptions();
});

async function loadMyPrescriptions() {
    const tbody = document.getElementById('myPrescTable');
    
    try {
        const snapshot = await db.collection('prescriptions')
            .where('patientId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-state-icon">💊</div><h3>No Prescriptions</h3><p>Your prescriptions will appear here</p></td></tr>';
            return;
        }
        
        tbody.innerHTML = snapshot.docs.map(doc => {
            const presc = doc.data();
            const statusClass = presc.status === 'active' ? 'success' : presc.status === 'completed' ? 'info' : 'warning';
            
            return `
                <tr>
                    <td><strong>${presc.medication || 'N/A'}</strong></td>
                    <td>${presc.dosage || 'N/A'}</td>
                    <td>${presc.frequency || 'N/A'}</td>
                    <td>${presc.duration || 'N/A'}</td>
                    <td>${presc.doctorName || 'Dr. Not assigned'}</td>
                    <td>${formatDate(presc.createdAt)}</td>
                    <td><span class="badge badge-${statusClass}">${presc.status || 'Pending'}</span></td>
                </tr>
            `;
        }).join('');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
    } catch (error) {
        console.error('Error loading prescriptions:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><h3>Error Loading Prescriptions</h3><p>Please try again later</p></td></tr>';
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
