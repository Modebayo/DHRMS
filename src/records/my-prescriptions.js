let currentUser = null;
let userData = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    lucide.createIcons();
    
    const result = await guardPage();
    if (!result) return;
    
    currentUser = result.user;
    userData = result.userData;
    populateUserProfile();
    
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
            const statusClass = presc.status === 'dispensed' ? 'success' : presc.status === 'pending' ? 'warning' : 'info';
            const statusLabel = presc.status ? presc.status.charAt(0).toUpperCase() + presc.status.slice(1) : 'Pending';
            
            return `
                <tr>
                    <td><strong>${presc.medication || 'N/A'}</strong></td>
                    <td>${presc.dosage || 'N/A'}</td>
                    <td>${presc.frequency || 'N/A'}</td>
                    <td>${presc.duration || 'N/A'}</td>
                    <td>${presc.doctorName || 'Dr. Not assigned'}</td>
                    <td>${formatDate(presc.createdAt)}</td>
                    <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
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

function populateUserProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && userData) nameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    if (roleEl && userData) roleEl.textContent = userData.role?.replace(/_/g, ' ') || 'Role';
    if (avatarEl && userData) avatarEl.textContent = (userData.firstName?.[0] || 'U').toUpperCase();
}
