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
    loadPrescriptions();
});

async function loadPatients() {
    const select = document.getElementById('prescPatient');
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

async function loadPrescriptions() {
    const tbody = document.getElementById('prescTable');
    if (!tbody) return;

    try {
        const snapshot = await db.collection('prescriptions').orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i data-lucide="pill" style="width:48px;height:48px;color:var(--gray-300);margin-bottom:16px"></i><h3>No Prescriptions</h3><p>Create your first prescription</p></td></tr>';
            lucide.createIcons();
            return;
        }
        
        const usersCache = {};
        const userIds = new Set();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.patientId) userIds.add(data.patientId);
            if (data.doctorId) userIds.add(data.doctorId);
        });
        
        for (const id of userIds) {
            const uDoc = await db.collection('users').doc(id).get();
            usersCache[id] = uDoc.exists ? uDoc.data() : null;
        }
        
        tbody.innerHTML = snapshot.docs.map(doc => {
            const presc = doc.data();
            const patient = usersCache[presc.patientId];
            const doctor = usersCache[presc.doctorId];
            
            const statusClass = presc.status === 'dispensed' ? 'success' : 
                               presc.status === 'pending' ? 'warning' : 'danger';
            
            return `
                <tr>
                    <td>${patient ? `${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}` : 'N/A'}</td>
                    <td>${escapeHtml(presc.medication)}</td>
                    <td>${escapeHtml(presc.dosage)}</td>
                    <td>${escapeHtml(presc.frequency?.replace(/-/g, ' '))}</td>
                    <td>${escapeHtml(presc.duration)}</td>
                    <td>${formatTimestamp(presc.createdAt)}</td>
                    <td><span class="badge badge-${statusClass}">${escapeHtml(presc.status)}</span></td>
                </tr>
            `;
        }).join('');
        
        lucide.createIcons();
        
    } catch (error) {
        console.error('Error loading prescriptions:', error);
        showToast('Error loading prescriptions', 'error');
    }
}

function openPrescModal() {
    document.getElementById('prescForm').reset();
    loadPatients();
    document.getElementById('prescModal').classList.add('active');
}

function closePrescModal() {
    document.getElementById('prescModal').classList.remove('active');
}

async function savePrescription() {
    const patientId = document.getElementById('prescPatient').value;
    const medication = sanitizeInput(document.getElementById('prescMedication').value);
    const dosage = sanitizeInput(document.getElementById('prescDosage').value);
    const frequency = document.getElementById('prescFreq').value;
    const duration = sanitizeInput(document.getElementById('prescDuration').value);
    const instructions = sanitizeInput(document.getElementById('prescInstructions').value);
    
    if (!patientId || !medication || !dosage || !duration) {
        showToast('Please fill all required fields', 'warning');
        return;
    }
    
    try {
        await db.collection('prescriptions').add({
            patientId,
            doctorId: currentUser.uid,
            medication,
            dosage,
            frequency,
            duration,
            notes: instructions,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Prescription created successfully', 'success');
        logActivity(currentUser.uid, 'prescription-create', `Created prescription for patient`);
        closePrescModal();
        loadPrescriptions();
        
    } catch (error) {
        console.error('Error creating prescription:', error);
        showToast('Error creating prescription', 'error');
    }
}