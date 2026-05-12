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
    loadVitals();
});

async function loadPatients() {
    const select = document.getElementById('vitalsPatient');
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

async function loadVitals() {
    const tbody = document.getElementById('vitalsTable');
    if (!tbody) return;

    try {
        const snapshot = await db.collection('vitals').orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i data-lucide="heart-pulse" style="width:48px;height:48px;color:var(--gray-300);margin-bottom:16px"></i><h3>No Vitals Recorded</h3><p>Record your first vitals</p></td></tr>';
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
            const vitals = doc.data();
            const patient = usersCache[vitals.patientId];
            const patientName = patient ? `${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}` : 'Unknown';
            
            const bp = vitals.bpSystolic && vitals.bpDiastolic ? `${vitals.bpSystolic}/${vitals.bpDiastolic}` : 'N/A';
            const bpStatus = vitals.bpSystolic > 140 || vitals.bpDiastolic > 90 ? 'danger' : 'success';
            
            const tempStatus = vitals.temperature > 37.5 || vitals.temperature < 35.5 ? 'warning' : 'success';
            
            const planPreview = vitals.plan ? (vitals.plan.length > 30 ? vitals.plan.substring(0, 30) + '...' : vitals.plan) : 'N/A';
            
            return `
                <tr>
                    <td><strong>${patientName}</strong></td>
                    <td>${formatDate(vitals.date)}</td>
                    <td><span class="badge badge-${tempStatus}">${vitals.temperature ? vitals.temperature + '°C' : 'N/A'}</span></td>
                    <td>${vitals.pulse ? vitals.pulse + '' : 'N/A'}</td>
                    <td>${vitals.respiration ? vitals.respiration + '' : 'N/A'}</td>
                    <td><span class="badge badge-${bpStatus}">${bp}</span></td>
                    <td>${vitals.spo2 ? vitals.spo2 + '%' : 'N/A'}</td>
                    <td style="max-width:150px;font-size:12px">${escapeHtml(planPreview)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="viewVitals('${doc.id}')">View</button>
                        ${userData.role === 'nurse' || userData.role === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteVitals('${doc.id}')">Delete</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
    } catch (error) {
        console.error('Error loading vitals:', error);
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><h3>Error Loading Vitals</h3><p>Please try again later</p></td></tr>';
    }
}

function openVitalsModal() {
    document.getElementById('vitalsForm').reset();
    loadPatients();
    document.getElementById('vitalsModal').classList.add('active');
}

function closeVitalsModal() {
    document.getElementById('vitalsModal').classList.remove('active');
}

async function saveVitals() {
    const patientId = document.getElementById('vitalsPatient').value;
    const temperature = document.getElementById('temperature').value;
    const pulse = document.getElementById('pulse').value;
    const respiration = document.getElementById('respiration').value;
    const bpSystolic = document.getElementById('bpSystolic').value;
    const bpDiastolic = document.getElementById('bpDiastolic').value;
    const spo2 = document.getElementById('spo2').value;
    const plan = sanitizeInput(document.getElementById('plan').value);
    
    if (!patientId) {
        showToast('Please select a patient', 'warning');
        return;
    }
    
    try {
        const vitalsData = {
            patientId,
            recordedBy: currentUser.uid,
            date: new Date().toISOString().split('T')[0],
            temperature: temperature ? parseFloat(temperature) : null,
            pulse: pulse ? parseInt(pulse) : null,
            respiration: respiration ? parseInt(respiration) : null,
            bpSystolic: bpSystolic ? parseInt(bpSystolic) : null,
            bpDiastolic: bpDiastolic ? parseInt(bpDiastolic) : null,
            spo2: spo2 ? parseInt(spo2) : null,
            plan: plan,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const vitalsRef = await db.collection('vitals').add(vitalsData);
        
        const activeVisit = await db.collection('visits')
            .where('patientId', '==', patientId)
            .where('status', 'in', ['waiting', 'in-progress'])
            .limit(1)
            .get();
        
        if (!activeVisit.empty) {
            const visitDoc = activeVisit.docs[0];
            await db.collection('visits').doc(visitDoc.id).update({
                vitals: vitalsData,
                [`stageData.triage`]: {
                    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    completedBy: currentUser.uid,
                    vitalsId: vitalsRef.id
                },
                currentStage: 'consultation',
                status: 'in-progress'
            });
            
            const visitData = visitDoc.data();
            await db.collection('notifications').add({
                userId: visitData.patientId,
                type: 'vitals',
                title: 'Vitals Recorded',
                message: 'Your vitals have been recorded. Please proceed to consultation.',
                visitId: visitDoc.id,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        showToast('Vitals recorded successfully', 'success');
        logActivity(currentUser.uid, 'vitals-create', 'Recorded patient vitals');
        closeVitalsModal();
        loadVitals();
    } catch (error) {
        console.error('Error saving vitals:', error);
        showToast('Error recording vitals', 'error');
    }
}

async function viewVitals(id) {
    try {
        const doc = await db.collection('vitals').doc(id).get();
        if (!doc.exists) return;
        
        const vitals = doc.data();
        const patientDoc = await db.collection('users').doc(vitals.patientId).get();
        const patient = patientDoc.exists ? patientDoc.data() : null;
        
        document.getElementById('viewVitalsContent').innerHTML = `
            <div style="display:grid;gap:16px">
                <div><strong>Patient:</strong> ${patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}</div>
                <div><strong>Date:</strong> ${formatDate(vitals.date)}</div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
                    <div><strong>Temperature:</strong> ${vitals.temperature ? `${vitals.temperature}°C` : 'N/A'}</div>
                    <div><strong>Pulse:</strong> ${vitals.pulse ? `${vitals.pulse} bpm` : 'N/A'}</div>
                    <div><strong>Respiration:</strong> ${vitals.respiration ? `${vitals.respiration} /min` : 'N/A'}</div>
                    <div><strong>SpO2:</strong> ${vitals.spo2 ? `${vitals.spo2}%` : 'N/A'}</div>
                </div>
                <div><strong>Blood Pressure:</strong> ${vitals.bpSystolic ? `${vitals.bpSystolic}/${vitals.bpDiastolic} mmHg` : 'N/A'}</div>
                <div><strong>Plan:</strong> ${vitals.plan || 'None'}</div>
            </div>
        `;
        document.getElementById('viewVitalsModal').classList.add('active');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (error) {
        showToast('Error loading vitals details', 'error');
    }
}

async function deleteVitals(id) {
    if (!confirm('Delete this vitals record?')) return;
    try {
        await db.collection('vitals').doc(id).delete();
        showToast('Vitals deleted', 'success');
        loadVitals();
    } catch (error) {
        showToast('Error deleting vitals', 'error');
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}