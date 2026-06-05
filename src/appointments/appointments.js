let currentUser = null;
let userData = null;
let selectedDate = null;
let selectedTime = null;
let availableSlots = [];
let appointmentsUnsub = null;

// Auth handled by guardPage() in HTML

function setupDatePicker() {
    const dateInput = document.getElementById('appointmentDate') || document.getElementById('bookDate');
    if (dateInput) {
        // Set min date to today
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        dateInput.value = today;
        
        dateInput.addEventListener('change', () => {
            selectedDate = dateInput.value;
            if (userData.role === 'student') {
                loadAvailableSlots();
            }
        });
    }
}

async function loadDoctors() {
    const doctorSelect = document.getElementById('appointmentDoctor') || document.getElementById('bookDoctor');
    if (!doctorSelect) return;
    
    try {
        const snapshot = await db.collection('users')
            .where('role', '==', 'doctor')
            .where('status', '==', 'active')
            .get();
        
        doctorSelect.innerHTML = '<option value="">Select a doctor</option>';
        snapshot.forEach(doc => {
            const doctor = doc.data();
            doctorSelect.innerHTML += `<option value="${doc.id}">Dr. ${doctor.firstName} ${doctor.lastName} - ${doctor.specialization || 'General'}</option>`;
        });
        
        if (doctorSelect.value) {
            loadAvailableSlots();
        }
        
        doctorSelect.addEventListener('change', loadAvailableSlots);
    } catch (error) {
        console.error('Error loading doctors:', error);
        showToast('Error loading doctors', 'error');
    }
}

async function loadAvailableSlots() {
    const doctorId = document.getElementById('appointmentDoctor')?.value || document.getElementById('bookDoctor')?.value;
    const date = document.getElementById('appointmentDate')?.value || document.getElementById('bookDate')?.value;
    
    if (!doctorId || !date) return;
    
    const timeSelect = document.getElementById('appointmentTime') || document.getElementById('bookTime');
    if (!timeSelect) return;
    
    try {
        // Get doctor's existing appointments for the selected date
        const appointmentsSnapshot = await db.collection('appointments')
            .where('doctorId', '==', doctorId)
            .where('date', '==', date)
            .where('status', 'in', ['pending', 'confirmed'])
            .get();
        
        const bookedTimes = appointmentsSnapshot.docs.map(doc => doc.data().time);
        
        // Define available time slots (9 AM to 4 PM)
        const allSlots = [
            '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
            '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'
        ];
        
        availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));
        
        timeSelect.innerHTML = '<option value="">Select time</option>';
        availableSlots.forEach(slot => {
            const [hour, minute] = slot.split(':');
            const hourInt = parseInt(hour);
            const ampm = hourInt >= 12 ? 'PM' : 'AM';
            const displayHour = hourInt > 12 ? hourInt - 12 : hourInt;
            const displayTime = `${displayHour}:${minute} ${ampm}`;
            timeSelect.innerHTML += `<option value="${slot}">${displayTime}</option>`;
        });
        
        if (availableSlots.length === 0) {
            showToast('No available slots for this date', 'warning');
        }
    } catch (error) {
        console.error('Error loading slots:', error);
    }
}

function subscribeAppointments() {
    if (appointmentsUnsub) appointmentsUnsub();
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;
    
    let queryRef;
    if (userData.role === 'student') {
        queryRef = db.collection('appointments')
            .where('patientId', '==', currentUser.uid)
            .orderBy('date', 'asc');
    } else if (userData.role === 'doctor') {
        queryRef = db.collection('appointments')
            .where('doctorId', '==', currentUser.uid)
            .orderBy('date', 'asc');
    } else {
        queryRef = db.collection('appointments')
            .orderBy('date', 'asc');
    }
    
    appointmentsUnsub = queryRef.onSnapshot(async (snapshot) => {
        try {
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i data-lucide="calendar-x" style="width:48px;height:48px;color:var(--gray-300);margin-bottom:16px"></i><h3>No Appointments</h3><p>Book your first appointment</p></td></tr>';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                updateStats(snapshot);
                return;
            }
            
            const userIds = new Set();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.patientId) userIds.add(data.patientId);
                if (data.doctorId) userIds.add(data.doctorId);
            });
            
            const usersCache = {};
            for (const id of userIds) {
                const userDoc = await db.collection('users').doc(id).get();
                usersCache[id] = userDoc.exists ? userDoc.data() : null;
            }
            
            updateStats(snapshot);
            
            tbody.innerHTML = snapshot.docs.map(doc => {
                const apt = doc.data();
                const patient = usersCache[apt.patientId];
                const doctor = usersCache[apt.doctorId];
                
                const statusClass = apt.status === 'confirmed' ? 'success' : 
                               apt.status === 'pending' ? 'warning' : 
                               apt.status === 'cancelled' ? 'danger' :
                               apt.status === 'completed' ? 'info' : 'primary';
                
                return `
                    <tr>
                        <td>${patient ? `${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}` : 'N/A'}</td>
                        <td>${doctor ? `Dr. ${escapeHtml(doctor.firstName)} ${escapeHtml(doctor.lastName)}` : 'N/A'}</td>
                        <td>${formatDate(apt.date)}</td>
                        <td>${apt.time || 'N/A'}</td>
                        <td><span class="badge badge-${statusClass}">${apt.status}</span></td>
                        <td>${apt.type || 'consultation'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline" onclick="viewAppointment('${doc.id}')"><i data-lucide="eye" style="width:14px;height:14px"></i></button>
                            ${apt.status === 'pending' ? `<button class="btn btn-sm btn-danger" onclick="cancelAppointment('${doc.id}')"><i data-lucide="x" style="width:14px;height:14px"></i></button>` : ''}
                            ${userData.role === 'doctor' && apt.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="confirmAppointment('${doc.id}')">Confirm</button>` : ''}
                            ${apt.status === 'confirmed' ? `<button class="btn btn-sm btn-primary" onclick="completeAppointment('${doc.id}')"><i data-lucide="check" style="width:14px;height:14px"></i> Complete</button>` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
            
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (error) {
            console.error('Error loading appointments:', error);
        }
    }, (error) => {
        console.error('Appointments subscription error:', error);
    });
}

function updateStats(query) {
    const total = query ? query.size : 0;
    const pending = query ? query.docs.filter(d => d.data().status === 'pending').length : 0;
    const confirmed = query ? query.docs.filter(d => d.data().status === 'confirmed').length : 0;
    const completed = query ? query.docs.filter(d => d.data().status === 'completed').length : 0;
    const cancelled = query ? query.docs.filter(d => d.data().status === 'cancelled').length : 0;
    
    const totalEl = document.getElementById('totalAppointments');
    const pendingEl = document.getElementById('pendingAppointments');
    const confirmedEl = document.getElementById('confirmedAppointments');
    const completedEl = document.getElementById('completedAppointments');
    const cancelledEl = document.getElementById('cancelledAppointments');
    
    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (confirmedEl) confirmedEl.textContent = confirmed;
    if (completedEl) completedEl.textContent = completed;
    if (cancelledEl) cancelledEl.textContent = cancelled;
}

async function bookAppointment() {
    const doctorId = document.getElementById('appointmentDoctor')?.value || document.getElementById('bookDoctor')?.value;
    const date = document.getElementById('appointmentDate')?.value || document.getElementById('bookDate')?.value;
    const time = document.getElementById('appointmentTime')?.value || document.getElementById('bookTime')?.value;
    const type = document.getElementById('appointmentType')?.value || document.getElementById('bookType')?.value;
    const reason = sanitizeInput(document.getElementById('appointmentReason')?.value || document.getElementById('bookReason')?.value || '');
    
    if (!doctorId || !date || !time) {
        showToast('Please fill all required fields', 'warning');
        return;
    }
    
    const patientId = userData.role === 'student' ? currentUser.uid : 
                      document.getElementById('appointmentPatient')?.value;
    
    if (!patientId) {
        showToast('Please select a patient', 'warning');
        return;
    }
    
    try {
        await db.collection('appointments').add({
            patientId,
            doctorId,
            date,
            time,
            type: type || 'consultation',
            reason,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Appointment booked successfully!', 'success');
        logActivity(currentUser.uid, 'appointment-book', `Booked appointment for ${date} at ${time}`);
        
        // Redirect or reset form
        if (userData.role === 'student') {
            setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        } else {
            closeAppointmentModal();
        }
    } catch (error) {
        console.error('Error booking appointment:', error);
        showToast('Error booking appointment', 'error');
    }
}

async function confirmAppointment(id) {
    if (!confirm('Confirm this appointment?')) return;
    
    try {
        await db.collection('appointments').doc(id).update({
            status: 'confirmed',
            confirmedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await logActivity(currentUser.uid, 'appointment-confirm', 'Confirmed appointment');
        showToast('Appointment confirmed', 'success');
    } catch (error) {
        showToast('Error confirming appointment', 'error');
    }
}

async function completeAppointment(id) {
    if (!confirm('Mark this appointment as completed?')) return;
    
    try {
        await db.collection('appointments').doc(id).update({
            status: 'completed',
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await logActivity(currentUser.uid, 'appointment-complete', 'Completed appointment');
        showToast('Appointment completed', 'success');
    } catch (error) {
        showToast('Error completing appointment', 'error');
    }
}

async function cancelAppointment(id) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    
    try {
        await db.collection('appointments').doc(id).update({
            status: 'cancelled',
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Appointment cancelled', 'success');
        logActivity(currentUser.uid, 'appointment-cancel', 'Cancelled appointment');
    } catch (error) {
        showToast('Error cancelling appointment', 'error');
    }
}

async function viewAppointment(id) {
    try {
        const doc = await db.collection('appointments').doc(id).get();
        if (!doc.exists) return;
        
        const apt = doc.data();
        const patientDoc = await db.collection('users').doc(apt.patientId).get();
        const doctorDoc = await db.collection('users').doc(apt.doctorId).get();
        
        const patient = patientDoc.exists ? patientDoc.data() : null;
        const doctor = doctorDoc.exists ? doctorDoc.data() : null;
        
        const content = document.getElementById('appointmentDetails') || document.getElementById('viewAppointmentContent');
        if (content) {
            content.innerHTML = `
                <div style="display:grid;gap:16px">
                    <div><strong>Patient:</strong> ${patient ? `${patient.firstName} ${patient.lastName}` : 'N/A'}</div>
                    <div><strong>Doctor:</strong> ${doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'N/A'}</div>
                    <div><strong>Date:</strong> ${formatDate(apt.date)}</div>
                    <div><strong>Time:</strong> ${apt.time || 'N/A'}</div>
                    <div><strong>Type:</strong> ${apt.type || 'Consultation'}</div>
                    <div><strong>Status:</strong> <span class="badge badge-${apt.status === 'confirmed' ? 'success' : apt.status === 'pending' ? 'warning' : 'danger'}">${apt.status}</span></div>
                    <div><strong>Reason:</strong> ${apt.reason || 'Not specified'}</div>
                </div>
            `;
            
            const modal = document.getElementById('appointmentModal') || document.getElementById('viewAppointmentModal');
            if (modal) modal.classList.add('active');
        }
    } catch (error) {
        showToast('Error loading appointment details', 'error');
    }
}

function setupFilters() {
    const statusFilter = document.getElementById('filterAppointmentStatus');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            const status = statusFilter.value;
            document.querySelectorAll('#appointmentsTableBody tr').forEach(row => {
                if (!status) { row.style.display = ''; return; }
                const statusCell = row.cells[4];
                if (statusCell && statusCell.textContent.trim() === status) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }
}

function openCreateAppointment() {
    loadDoctors();
    const modal = document.getElementById('appointmentModal');
    if (modal) modal.classList.add('active');
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    if (modal) modal.classList.remove('active');
}

// Update appointment badge in sidebar
async function updateAppointmentBadge() {
    try {
        const snapshot = await db.collection('appointments')
            .where('status', '==', 'pending')
            .get();
        
        const badge = document.getElementById('appointmentBadge');
        if (badge) {
            badge.textContent = snapshot.size;
            badge.style.display = snapshot.size > 0 ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Error updating badge:', error);
    }
}

// Call on load
setTimeout(updateAppointmentBadge, 1000);

function populateUserProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && userData) nameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    if (roleEl && userData) roleEl.textContent = userData.role?.replace(/_/g, ' ') || 'Role';
    if (avatarEl && userData) avatarEl.textContent = (userData.firstName?.[0] || 'U').toUpperCase();
}
