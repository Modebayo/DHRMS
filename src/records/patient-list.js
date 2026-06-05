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
    
    loadPatients();
    setupSearch();
});

async function loadPatients() {
    const tbody = document.getElementById('patientsTable');
    if (!tbody) return;
    
    try {
        const snapshot = await db.collection('users').where('role', '==', 'student').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i data-lucide="users" style="width:48px;height:48px;color:var(--gray-300);margin-bottom:16px"></i><h3>No Patients</h3><p>No patients registered yet</p></td></tr>';
            lucide.createIcons();
            return;
        }
        
        const recordsSnapshot = await db.collection('health_records').orderBy('visitDate', 'desc').get();
        
        const patientVisits = {};
        recordsSnapshot.forEach(doc => {
            const data = doc.data();
            if (!patientVisits[data.patientId]) {
                patientVisits[data.patientId] = { count: 0, lastVisit: null };
            }
            patientVisits[data.patientId].count++;
            if (!patientVisits[data.patientId].lastVisit || 
                new Date(data.visitDate) > new Date(patientVisits[data.patientId].lastVisit)) {
                patientVisits[data.patientId].lastVisit = data.visitDate;
            }
        });
        
        tbody.innerHTML = snapshot.docs.map(doc => {
            const patient = doc.data();
            const visitInfo = patientVisits[doc.id] || { count: 0, lastVisit: null };
            const dept = patient.department?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'General';
            
            return `
                <tr>
                    <td><strong>${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}</strong></td>
                    <td>${patient.studentId || 'N/A'}</td>
                    <td>${dept}</td>
                    <td>${patient.phone || 'N/A'}</td>
                    <td>${visitInfo.lastVisit ? formatDate(visitInfo.lastVisit) : 'Never'}</td>
                    <td>${visitInfo.count}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="viewPatientRecords('${doc.id}')"><i data-lucide="file-text" style="width:14px;height:14px"></i></button>
                        <button class="btn btn-sm btn-outline" onclick="viewPatientVitals('${doc.id}')"><i data-lucide="activity" style="width:14px;height:14px"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        
        lucide.createIcons();
        
    } catch (error) {
        console.error('Error loading patients:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><h3>Error Loading Patients</h3></td></tr>';
    }
}

function setupSearch() {
    const search = document.getElementById('searchPatients');
    if (search) {
        search.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('#patientsTable tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    }
}

async function viewPatientRecords(patientId) {
    try {
        const patientDoc = await db.collection('users').doc(patientId).get();
        const patient = patientDoc.exists ? patientDoc.data() : null;
        
        const recordsSnapshot = await db.collection('health_records')
            .where('patientId', '==', patientId)
            .orderBy('visitDate', 'desc')
            .get();
        
        let recordsHtml = '';
        if (recordsSnapshot.empty) {
            recordsHtml = '<p style="text-align:center;color:var(--text-muted)">No health records found</p>';
        } else {
            recordsHtml = recordsSnapshot.docs.map(doc => {
                const record = doc.data();
                const statusClass = record.status === 'active' ? 'success' : record.status === 'discharged' ? 'info' : 'warning';
                return `
                    <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:12px">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                            <strong>${formatDate(record.visitDate)}</strong>
                            <span class="badge badge-${statusClass}">${record.status}</span>
                        </div>
                        <div><strong>Diagnosis:</strong> ${escapeHtml(record.diagnosis) || 'N/A'}</div>
                        <div><strong>Symptoms:</strong> ${escapeHtml(record.symptoms?.substring(0, 100)) || 'N/A'}...</div>
                    </div>
                `;
            }).join('');
        }
        
        document.getElementById('patientRecordsModalContent')?.remove();
        
        const modal = document.createElement('div');
        modal.id = 'patientRecordsModalContent';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-large">
                <div class="modal-header">
                    <h3 class="modal-title">${patient ? `${patient.firstName} ${patient.lastName}'s Records` : 'Patient Records'}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body" style="max-height:60vh;overflow-y:auto">
                    ${recordsHtml}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.classList.add('active');
        lucide.createIcons();
        
    } catch (error) {
        console.error('Error viewing patient records:', error);
        showToast('Error loading patient records', 'error');
    }
}

async function viewPatientVitals(patientId) {
    try {
        const patientDoc = await db.collection('users').doc(patientId).get();
        const patient = patientDoc.exists ? patientDoc.data() : null;
        
        const vitalsSnapshot = await db.collection('vitals')
            .where('patientId', '==', patientId)
            .orderBy('recordedAt', 'desc')
            .get();
        
        let vitalsHtml = '';
        if (vitalsSnapshot.empty) {
            vitalsHtml = '<p style="text-align:center;color:var(--text-muted)">No vitals recorded</p>';
        } else {
            vitalsHtml = vitalsSnapshot.docs.slice(0, 5).map(doc => {
                const v = doc.data();
                return `
                    <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:12px">
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                            <strong>${formatDate(v.recordedAt)}</strong>
                            <span style="color:var(--text-muted)">${v.recordedBy ? 'By medical staff' : ''}</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
                            <div>BP: <strong>${v.bloodPressure || 'N/A'}</strong></div>
                            <div>HR: <strong>${v.heartRate || 'N/A'}</strong> bpm</div>
                            <div>Temp: <strong>${v.temperature || 'N/A'}</strong></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        document.getElementById('patientVitalsModalContent')?.remove();
        
        const modal = document.createElement('div');
        modal.id = 'patientVitalsModalContent';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-large">
                <div class="modal-header">
                    <h3 class="modal-title">${patient ? `${patient.firstName} ${patient.lastName}'s Vitals` : 'Patient Vitals'}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body" style="max-height:60vh;overflow-y:auto">
                    ${vitalsHtml}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.classList.add('active');
        lucide.createIcons();
        
    } catch (error) {
        console.error('Error viewing patient vitals:', error);
        showToast('Error loading patient vitals', 'error');
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function populateUserProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && userData) nameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    if (roleEl && userData) roleEl.textContent = userData.role?.replace(/_/g, ' ') || 'Role';
    if (avatarEl && userData) avatarEl.textContent = (userData.firstName?.[0] || 'U').toUpperCase();
}