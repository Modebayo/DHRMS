let currentUser = null;
let userData = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    lucide.createIcons();
    
    const result = await guardPage();
    if (!result) return;
    
    currentUser = result.user;
    userData = result.userData;
    
    loadPatients();
    loadLabResults();
});

async function loadPatients() {
    const select = document.getElementById('labPatient');
    if (!select) return;
    
    try {
        const snapshot = await db.collection('users').where('role', '==', 'student').get();
        select.innerHTML = '<option value="">Select patient</option>';
        snapshot.forEach(doc => {
            const data = doc.data();
            select.innerHTML += `<option value="${doc.id}">${data.firstName} ${data.lastName}</option>`;
        });
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

async function loadLabResults() {
    const tbody = document.getElementById('labTable');
    if (!tbody) return;

    try {
        const snapshot = await db.collection('lab_results').orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i data-lucide="flask-conical" style="width:48px;height:48px;color:var(--gray-300);margin-bottom:16px"></i><h3>No Lab Results</h3><p>Lab results will appear here</p></td></tr>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }
    
        const usersCache = {};
        const userIds = [...new Set(snapshot.docs.map(d => d.data().patientId))];
        
        for (const id of userIds) {
            const uDoc = await db.collection('users').doc(id).get();
            usersCache[id] = uDoc.exists ? uDoc.data() : null;
        }
        
        tbody.innerHTML = snapshot.docs.map(doc => {
            const lab = doc.data();
            const patient = usersCache[lab.patientId];
            const statusClass = lab.status === 'normal' ? 'success' : lab.status === 'abnormal' ? 'warning' : lab.status === 'critical' ? 'danger' : 'info';
            const testName = lab.testType?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
            
            return `
                <tr>
                    <td><strong>${patient ? `${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}` : 'Unknown'}</strong></td>
                    <td>${escapeHtml(testName)}</td>
                    <td>${escapeHtml(lab.result?.substring(0, 40))}...</td>
                    <td>${escapeHtml(lab.notes?.substring(0, 30)) || 'N/A'}...</td>
                    <td>${formatDate(lab.createdAt)}</td>
                    <td><span class="badge badge-${statusClass}">${escapeHtml(lab.status)}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="viewLabResult('${doc.id}')">View</button>
                        ${userData.role === 'nurse' || userData.role === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteLabResult('${doc.id}')">Delete</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
    } catch (error) {
        console.error('Error loading lab results:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><h3>Error Loading Lab Results</h3><p>Please try again</p></td></tr>';
    }
}

function openLabModal() {
    document.getElementById('labForm').reset();
    loadPatients();
    document.getElementById('labModal').classList.add('active');
}

function closeLabModal() {
    document.getElementById('labModal').classList.remove('active');
}

async function saveLabResult() {
    const patientId = document.getElementById('labPatient').value;
    const testType = document.getElementById('labTest').value;
    const result = sanitizeInput(document.getElementById('labResult').value);
    const notes = sanitizeInput(document.getElementById('labNotes').value);
    const status = document.getElementById('labStatus').value;
    
    if (!patientId || !testType || !result) {
        showToast('Please fill all required fields', 'warning');
        return;
    }
    
    try {
        await db.collection('lab_results').add({
            patientId,
            recordedBy: currentUser.uid,
            testType,
            result,
            notes,
            status: status || 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Lab result added successfully', 'success');
        logActivity(currentUser.uid, 'lab-result', 'Added lab result for patient');
        closeLabModal();
        loadLabResults();
    } catch (error) {
        console.error('Error saving lab result:', error);
        showToast('Error saving lab result', 'error');
    }
}

async function viewLabResult(id) {
    try {
        const doc = await db.collection('lab_results').doc(id).get();
        if (!doc.exists) return;
        
        const lab = doc.data();
        const patientDoc = await db.collection('users').doc(lab.patientId).get();
        const patient = patientDoc.exists ? patientDoc.data() : null;
        
        const testName = lab.testType?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
        const statusClass = lab.status === 'normal' ? 'success' : lab.status === 'abnormal' ? 'warning' : lab.status === 'critical' ? 'danger' : 'info';
        
        document.getElementById('viewLabContent').innerHTML = `
            <div style="display:grid;gap:16px">
                <div><strong>Patient:</strong> ${patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}</div>
                <div><strong>Test Type:</strong> ${testName}</div>
                <div><strong>Result:</strong> ${lab.result || 'N/A'}</div>
                <div><strong>Status:</strong> <span class="badge badge-${statusClass}">${lab.status}</span></div>
                <div><strong>Notes:</strong> ${lab.notes || 'None'}</div>
                <div><strong>Date:</strong> ${formatDate(lab.createdAt)}</div>
            </div>
        `;
        document.getElementById('viewLabModal').classList.add('active');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (error) {
        showToast('Error loading lab result details', 'error');
    }
}

async function deleteLabResult(id) {
    if (!confirm('Delete this lab result?')) return;
    try {
        await db.collection('lab_results').doc(id).delete();
        showToast('Lab result deleted', 'success');
        loadLabResults();
    } catch (error) {
        showToast('Error deleting lab result', 'error');
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
