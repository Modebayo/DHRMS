let currentUser = null;
let userData = null;
let recordsUnsub = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    lucide.createIcons();
    
    const result = await guardPage();
    if (!result) return;
    
    currentUser = result.user;
    userData = result.userData;
    if (userData.status === 'inactive') {
        window.location.href = '../dashboard/index.html';
        return;
    }
    populateUserProfile();
    
    updateNavigation();
    setupFilters();
    setupSearch();
    loadPatients();
    subscribeRecords();
});

function updateNavigation() {
    const role = userData.role;
    
    if (role === 'doctor' || role === 'nurse' || role === 'records_officer') {
        document.getElementById('doctorNav').style.display = 'block';
    }

    if (role === 'admin' || role === 'administrator') {
        document.getElementById('doctorNav').style.display = 'block';
        document.getElementById('adminNav').style.display = 'block';
    }
}

async function loadPatients() {
    const select = document.getElementById('patientSelect');
    if (!select) return;
    
    try {
        const snapshot = await db.collection('users').where('role', '==', 'student').get();
        select.innerHTML = '<option value="">Select patient</option>';
        snapshot.forEach(doc => {
            const data = doc.data();
            select.innerHTML += `<option value="${doc.id}">${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</option>`;
        });
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

function subscribeRecords() {
    if (recordsUnsub) recordsUnsub();
    const tbody = document.getElementById('recordsTableBody');
    if (!tbody) return;
    
    recordsUnsub = db.collection('health_records').orderBy('visitDate', 'desc')
        .onSnapshot(async (snapshot) => {
            try {
                if (snapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i data-lucide="file-text" style="width:48px;height:48px;color:var(--gray-300);margin-bottom:16px"></i><h3>No Records</h3><p>Create your first health record</p></td></tr>';
                    lucide.createIcons();
                    return;
                }
                
                const usersCache = {};
                const userIds = new Set();
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.patientId) userIds.add(data.patientId);
                    if (data.recordedBy) userIds.add(data.recordedBy);
                });
                
                for (const id of userIds) {
                    const uDoc = await db.collection('users').doc(id).get();
                    usersCache[id] = uDoc.exists ? uDoc.data() : null;
                }
                
                tbody.innerHTML = snapshot.docs.map(doc => {
                    const record = doc.data();
                    const patient = usersCache[record.patientId];
                    
                    const statusClass = record.status === 'active' ? 'success' : 
                                       record.status === 'discharged' ? 'info' : 
                                       record.status === 'referral' ? 'warning' : 'success';
                    
                    const encIcon = record.encryptedData ? ' <i data-lucide="lock" style="width:12px;height:12px;color:var(--success-600);display:inline;vertical-align:middle" title="Encrypted"></i>' : '';
                    const diagDisplay = record.encryptedData ? '<em style="color:var(--text-muted)">Encrypted</em>' : (escapeHtml(record.diagnosis?.substring(0, 30)) || 'N/A') + '...';
                    return `
                        <tr>
                            <td>${patient ? `${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}` : 'Unknown'}${encIcon}</td>
                            <td>${patient?.studentId || 'N/A'}</td>
                            <td>${formatDepartment(patient?.department)}</td>
                            <td>${formatDate(record.visitDate)}</td>
                            <td>${diagDisplay}</td>
                            <td><span class="badge badge-${statusClass}">${escapeHtml(record.status || 'active')}</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="viewRecord('${doc.id}')"><i data-lucide="eye" style="width:14px;height:14px"></i></button>
                                ${userData.role === 'nurse' || userData.role === 'admin' ? `
                                    <button class="btn btn-sm btn-outline" onclick="editRecord('${doc.id}')"><i data-lucide="pencil" style="width:14px;height:14px"></i></button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteRecord('${doc.id}')"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
                                ` : ''}
                            </td>
                        </tr>
                    `;
                }).join('');
                
                lucide.createIcons();
                
            } catch (error) {
                console.error('Error loading records:', error);
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><h3>Error Loading Records</h3><p>Please try again</p></td></tr>';
            }
        }, (error) => {
            console.error('Records subscription error:', error);
        });
}

function formatDepartment(dept) {
    if (!dept) return 'General';
    return dept.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function setupSearch() {
    const search = document.getElementById('searchRecords');
    if (search) {
        search.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('#recordsTableBody tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    }
}

function setupFilters() {
    const deptFilter = document.getElementById('filterDepartment');
    const statusFilter = document.getElementById('filterStatus');
    
    const applyFilters = () => {
        const dept = deptFilter?.value || '';
        const status = statusFilter?.value || '';
        
        document.querySelectorAll('#recordsTableBody tr').forEach(row => {
            const cells = row.cells;
            const rowDept = cells[2]?.textContent.toLowerCase() || '';
            const rowStatus = cells[5]?.textContent.toLowerCase() || '';
            
            const deptMatch = !dept || rowDept.includes(dept.toLowerCase());
            const statusMatch = !status || rowStatus.includes(status.toLowerCase());
            
            row.style.display = (deptMatch && statusMatch) ? '' : 'none';
        });
    };
    
    deptFilter?.addEventListener('change', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);
}

let editingRecordId = null;

function openCreateRecordModal() {
    editingRecordId = null;
    document.getElementById('recordForm').reset();
    document.getElementById('modalTitle').textContent = 'Create Health Record';
    loadPatients();
    document.getElementById('recordModal').classList.add('active');
}

function closeModal() {
    document.getElementById('recordModal').classList.remove('active');
}

function closeViewModal() {
    document.getElementById('viewRecordModal').classList.remove('active');
}

async function encryptSensitiveData(recordData, patientId) {
    const sensitive = {
        symptoms: recordData.symptoms,
        diagnosis: recordData.diagnosis,
        treatment: recordData.treatment,
        notes: recordData.notes
    };
    const encrypted = await KeyManager.encryptForUser(sensitive, patientId);
    return {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        encryptedBy: currentUser.uid
    };
}

async function decryptSensitiveData(record, viewerId) {
    if (!record.encryptedData) return null;
    if (!viewerId) viewerId = currentUser.uid;
    try {
        let decrypted;
        if (viewerId === record.encryptedData.encryptedBy) {
            const aesKey = await KeyManager.getSharedKey(record.patientId);
            decrypted = await Encryption.decrypt(record.encryptedData, aesKey);
        } else {
            decrypted = await KeyManager.decryptFromUser(record.encryptedData, record.encryptedData.encryptedBy);
        }
        return decrypted;
    } catch (e) {
        console.warn('Decryption failed, trying fallback:', e);
        return null;
    }
}

async function saveRecord() {
    const patientId = document.getElementById('patientSelect').value;
    const visitDate = document.getElementById('visitDate').value;
    const recordType = document.getElementById('recordType').value;
    const symptoms = sanitizeInput(document.getElementById('symptoms').value);
    const diagnosis = sanitizeInput(document.getElementById('diagnosis').value);
    const treatment = sanitizeInput(document.getElementById('treatment').value);
    const severity = document.getElementById('severity').value;
    const status = document.getElementById('status').value;
    const notes = sanitizeInput(document.getElementById('notes').value);
    
    if (!patientId || !visitDate || !recordType || !symptoms || !diagnosis) {
        showToast('Please fill all required fields', 'warning');
        return;
    }
    
    try {
        const recordData = {
            patientId,
            recordedBy: currentUser.uid,
            visitDate,
            recordType,
            severity: severity || 'moderate',
            status: status || 'active',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (KeyManager.isReady()) {
            recordData.encryptedData = await encryptSensitiveData({
                symptoms, diagnosis, treatment, notes
            }, patientId);
        } else {
            recordData.symptoms = symptoms;
            recordData.diagnosis = diagnosis;
            recordData.treatment = treatment;
            recordData.notes = notes;
        }
        
        if (editingRecordId) {
            await db.collection('health_records').doc(editingRecordId).update(recordData);
            showToast('Record updated successfully', 'success');
        } else {
            recordData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('health_records').add(recordData);
            showToast('Record created successfully', 'success');
            logActivity(currentUser.uid, 'record-create', 'Created new health record');
        }
        
        closeModal();
        
    } catch (error) {
        console.error('Error saving record:', error);
        showToast('Error saving record', 'error');
    }
}

async function viewRecord(id) {
    try {
        const doc = await db.collection('health_records').doc(id).get();
        if (!doc.exists) return;
        
        const record = doc.data();
        const patientDoc = await db.collection('users').doc(record.patientId).get();
        const patient = patientDoc.exists ? patientDoc.data() : null;
        
        let decrypted = null;
        if (record.encryptedData) {
            decrypted = await decryptSensitiveData(record);
        }
        
        const symptoms = decrypted?.symptoms || record.symptoms || 'None';
        const diagnosis = decrypted?.diagnosis || record.diagnosis || 'None';
        const treatment = decrypted?.treatment || record.treatment || 'None';
        const notes = decrypted?.notes || record.notes || 'None';
        
        const lockIcon = record.encryptedData ? '<i data-lucide="lock" style="width:14px;height:14px;color:var(--success-600);display:inline;vertical-align:middle;margin-left:4px" title="End-to-end encrypted"></i>' : '';
        
        document.getElementById('recordDetails').innerHTML = `
            <div style="display:grid;gap:16px">
                <div class="detail-grid">
                    <div><strong>Patient:</strong></div><div>${patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'} ${lockIcon}</div>
                    <div><strong>Student ID:</strong></div><div>${patient?.studentId || 'N/A'}</div>
                    <div><strong>Department:</strong></div><div>${formatDepartment(patient?.department)}</div>
                </div>
                <hr style="border:none;border-top:1px solid var(--border-color);margin:8px 0">
                <div class="detail-grid">
                    <div><strong>Visit Date:</strong></div><div>${formatDate(record.visitDate)}</div>
                    <div><strong>Record Type:</strong></div><div>${formatRecordType(record.recordType)}</div>
                    <div><strong>Severity:</strong></div><div><span class="badge badge-${getSeverityClass(record.severity)}">${escapeHtml(record.severity || 'moderate')}</span></div>
                    <div><strong>Status:</strong></div><div><span class="badge badge-${getStatusClass(record.status)}">${escapeHtml(record.status || 'active')}</span></div>
                </div>
                <hr style="border:none;border-top:1px solid var(--border-color);margin:8px 0">
                <div><strong>Symptoms:</strong></div><div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md)">${escapeHtml(symptoms)}</div>
                <div><strong>Diagnosis:</strong></div><div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md)">${escapeHtml(diagnosis)}</div>
                <div><strong>Treatment:</strong></div><div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md)">${escapeHtml(treatment)}</div>
                <div><strong>Notes:</strong></div><div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md)">${escapeHtml(notes)}</div>
            </div>
        `;
        
        document.getElementById('viewRecordModal').classList.add('active');
        lucide.createIcons();
        
    } catch (error) {
        console.error('Error viewing record:', error);
        showToast('Error loading record details', 'error');
    }
}

function formatRecordType(type) {
    if (!type) return 'Consultation';
    return type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getSeverityClass(severity) {
    return severity === 'critical' ? 'danger' : 
           severity === 'severe' ? 'warning' : 
           severity === 'moderate' ? 'info' : 'success';
}

function getStatusClass(status) {
    return status === 'active' ? 'success' : 
           status === 'referral' ? 'warning' : 'info';
}

async function editRecord(id) {
    try {
        const doc = await db.collection('health_records').doc(id).get();
        if (!doc.exists) return;
        
        const record = doc.data();
        editingRecordId = id;
        
        let decrypted = null;
        if (record.encryptedData) {
            decrypted = await decryptSensitiveData(record);
        }
        
        document.getElementById('modalTitle').textContent = 'Edit Health Record';
        document.getElementById('patientSelect').value = record.patientId;
        document.getElementById('visitDate').value = record.visitDate;
        document.getElementById('recordType').value = record.recordType;
        document.getElementById('symptoms').value = decrypted?.symptoms || record.symptoms || '';
        document.getElementById('diagnosis').value = decrypted?.diagnosis || record.diagnosis || '';
        document.getElementById('treatment').value = decrypted?.treatment || record.treatment || '';
        document.getElementById('severity').value = record.severity || 'moderate';
        document.getElementById('status').value = record.status || 'active';
        document.getElementById('notes').value = decrypted?.notes || record.notes || '';
        
        document.getElementById('recordModal').classList.add('active');
        
    } catch (error) {
        console.error('Error editing record:', error);
        showToast('Error loading record', 'error');
    }
}

async function deleteRecord(id) {
    if (!confirm('Delete this health record? This cannot be undone.')) return;
    
    try {
        await db.collection('health_records').doc(id).delete();
        showToast('Record deleted', 'success');
        logActivity(currentUser.uid, 'record-delete', 'Deleted health record');
    } catch (error) {
        console.error('Error deleting record:', error);
        showToast('Error deleting record', 'error');
    }
}

function printRecord() {
    const content = document.getElementById('recordDetails').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Health Record - Print</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .detail-grid { display: grid; grid-template-columns: 150px 1fr; gap: 8px; }
                hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
            </style>
        </head>
        <body>
            <h2>Health Record</h2>
            ${content}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

async function exportRecords() {
    showToast('Preparing export...', 'info');

    try {
        const snapshot = await db.collection('health_records')
            .orderBy('visitDate', 'desc')
            .get();

        if (snapshot.empty) {
            showToast('No records to export', 'warning');
            return;
        }

        const userIds = new Set();
        snapshot.docs.forEach(doc => {
            const d = doc.data();
            if (d.patientId) userIds.add(d.patientId);
            if (d.recordedBy) userIds.add(d.recordedBy);
        });

        const usersCache = {};
        for (const id of userIds) {
            const uDoc = await db.collection('users').doc(id).get();
            usersCache[id] = uDoc.exists ? uDoc.data() : null;
        }

        const rows = [['Patient', 'Student ID', 'Department', 'Visit Date', 'Record Type', 'Severity', 'Status', 'Symptoms', 'Diagnosis', 'Treatment', 'Notes', 'Recorded By']];

        for (const doc of snapshot.docs) {
            const r = doc.data();
            const patient = usersCache[r.patientId];
            const recorder = usersCache[r.recordedBy];

            let symptoms = r.encryptedData ? '[Encrypted]' : (r.symptoms || '');
            let diagnosis = r.encryptedData ? '[Encrypted]' : (r.diagnosis || '');
            let treatment = r.encryptedData ? '[Encrypted]' : (r.treatment || '');
            let notes = r.encryptedData ? '[Encrypted]' : (r.notes || '');

            rows.push([
                patient ? `${patient.firstName || ''} ${patient.lastName || ''}` : 'Unknown',
                patient?.studentId || 'N/A',
                formatDepartment(patient?.department),
                r.visitDate || 'N/A',
                formatRecordType(r.recordType),
                r.severity || 'moderate',
                r.status || 'active',
                symptoms,
                diagnosis,
                treatment,
                notes,
                recorder ? `${recorder.firstName || ''} ${recorder.lastName || ''}` : 'N/A'
            ]);
        }

        let csv = '';
        rows.forEach(row => {
            csv += row.map(cell => {
                const s = String(cell || '');
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }).join(',') + '\n';
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `health_records_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`Exported ${rows.length - 1} records successfully`, 'success');
        logActivity(currentUser.uid, 'export', `Exported ${rows.length - 1} health records`);
    } catch (error) {
        console.error('Export error:', error);
        showToast('Error exporting records: ' + error.message, 'error');
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

function populateUserProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && userData) nameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    if (roleEl && userData) roleEl.textContent = userData.role?.replace(/_/g, ' ') || 'Role';
    if (avatarEl && userData) avatarEl.textContent = (userData.firstName?.[0] || 'U').toUpperCase();
}