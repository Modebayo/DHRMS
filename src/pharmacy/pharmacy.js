let currentUser = null;
let userData = null;
let prescUnsub = null;

// Auth handled by guardPage() in HTML

function setupPrescriptionSearch() {
    const search = document.getElementById('searchPrescriptions');
    if (search) {
        search.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('#prescriptionsTable tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    }
}

async function loadPatients() {
    const select = document.getElementById('prescPatient');
    const snapshot = await db.collection('users').where('role', '==', 'student').get();
    
    snapshot.forEach(doc => {
        const data = doc.data();
        select.innerHTML += `<option value="${doc.id}">${data.firstName} ${data.lastName}</option>`;
    });
}

function subscribePrescriptions() {
    if (prescUnsub) prescUnsub();
    const tbody = document.getElementById('prescriptionsTable');
    if (!tbody) return;
    
    let queryRef;
    if (userData.role === 'student') {
        queryRef = db.collection('prescriptions').where('patientId', '==', currentUser.uid).orderBy('createdAt', 'desc');
    } else if (userData.role === 'doctor') {
        queryRef = db.collection('prescriptions').where('doctorId', '==', currentUser.uid).orderBy('createdAt', 'desc');
    } else {
        queryRef = db.collection('prescriptions').orderBy('createdAt', 'desc');
    }
    
    prescUnsub = queryRef.onSnapshot(async (snapshot) => {
        try {
            let pending = 0, dispensed = 0;
            
            const usersCache = {};
            const userIds = new Set();
            snapshot.docs.forEach(d => {
                const data = d.data();
                if (data.patientId) userIds.add(data.patientId);
                if (data.doctorId) userIds.add(data.doctorId);
            });
            
            for (const id of userIds) {
                const uDoc = await db.collection('users').doc(id).get();
                usersCache[id] = uDoc.exists ? uDoc.data() : null;
            }
            
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i data-lucide="pill" style="width:48px;height:48px;color:var(--gray-300);margin-bottom:16px"></i><h3>No Prescriptions</h3><p>Create your first prescription</p></td></tr>';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            } else {
                tbody.innerHTML = snapshot.docs.map(doc => {
                    const presc = doc.data();
                    const patient = usersCache[presc.patientId];
                    const doctor = usersCache[presc.doctorId];
                    const dispenser = usersCache[presc.dispensedBy];
                    
                    if (presc.status === 'pending') pending++;
                    if (presc.status === 'dispensed') dispensed++;
                    
                    const statusClass = presc.status === 'dispensed' ? 'success' : presc.status === 'pending' ? 'warning' : 'danger';
                    
                    let actions = '';
                    if (presc.status === 'pending' && (userData.role === 'pharmacist' || userData.role === 'admin' || userData.role === 'administrator')) {
                        actions = `<button class="btn btn-sm btn-success" onclick="dispense('${doc.id}')"><i data-lucide="package-check" style="width:14px;height:14px"></i> Dispense</button>`;
                    }
                    
                    const routeLabel = presc.route ? presc.route.charAt(0).toUpperCase() + presc.route.slice(1) : '-';
                    const dispensedInfo = presc.status === 'dispensed' && dispenser
                        ? `<small style="color:var(--gray-400);display:block;font-size:11px">by ${escapeHtml(dispenser.firstName)} ${escapeHtml(dispenser.lastName)}</small>`
                        : '';
                    
                    return `
                         <tr>
                             <td>${patient ? `${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}` : 'N/A'}</td>
                             <td>${escapeHtml(presc.medication)}</td>
                             <td>${escapeHtml(presc.dosage)}</td>
                             <td>${routeLabel}</td>
                             <td>${escapeHtml(presc.frequency?.replace(/-/g, ' '))}</td>
                             <td>${escapeHtml(presc.duration)}</td>
                             <td>${doctor ? `Dr. ${escapeHtml(doctor.firstName)} ${escapeHtml(doctor.lastName)}` : 'N/A'}</td>
                             <td><span class="badge badge-${statusClass}">${escapeHtml(presc.status)}</span>${dispensedInfo}</td>
                             <td>${actions}</td>
                         </tr>
                    `;
                }).join('');
            }
            
            document.getElementById('totalPrescriptions').textContent = snapshot.size;
            document.getElementById('dispensedCount').textContent = dispensed;
            document.getElementById('pendingCount').textContent = pending;
            
            const inventorySnap = await db.collection('inventory').where('quantity', '<=', 10).get();
            document.getElementById('lowStockCount').textContent = inventorySnap.size;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (error) {
            console.error('Error loading prescriptions:', error);
        }
    }, (error) => {
        console.error('Prescriptions subscription error:', error);
    });
}

function openPrescriptionModal() {
    document.getElementById('prescriptionForm').reset();
    document.getElementById('prescriptionModal').classList.add('active');
}

function closePrescriptionModal() {
    document.getElementById('prescriptionModal').classList.remove('active');
}

async function savePrescription() {
    const medication = document.getElementById('medication').value;
    const dosage = sanitizeInput(document.getElementById('dosage').value);
    const frequency = document.getElementById('frequency').value;
    const duration = sanitizeInput(document.getElementById('duration').value);
    const route = document.getElementById('route').value;
    const notes = sanitizeInput(document.getElementById('prescNotes').value);
    
    let patientId = currentUser.uid;
    if (userData.role !== 'student') {
        patientId = document.getElementById('prescPatient').value;
    }
    
    if (!medication || !dosage || !frequency || !duration) {
        showToast('Please fill all required fields', 'warning');
        return;
    }
    
    try {
        const prescData = {
            patientId,
            doctorId: currentUser.uid,
            medication,
            dosage,
            frequency,
            duration,
            route: route || 'oral',
            notes,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const params = new URLSearchParams(window.location.search);
        const consultationRef = params.get('consultation');
        if (consultationRef) {
            prescData.consultationRef = consultationRef;
        }
        
        await db.collection('prescriptions').add(prescData);
        showToast('Prescription created', 'success');
        closePrescriptionModal();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error creating prescription', 'error');
    }
}

async function dispense(id) {
    try {
        await db.collection('prescriptions').doc(id).update({
            status: 'dispensed',
            dispensedBy: currentUser.uid,
            dispensedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await logActivity(currentUser.uid, 'prescription-dispense', 'Dispensed prescription: ' + id);
        showToast('Medication dispensed', 'success');
    } catch (error) {
        showToast('Error dispensing', 'error');
    }
}

function populateUserProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && userData) nameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    if (roleEl && userData) roleEl.textContent = userData.role?.replace(/_/g, ' ') || 'Role';
    if (avatarEl && userData) avatarEl.textContent = (userData.firstName?.[0] || 'U').toUpperCase();
}
