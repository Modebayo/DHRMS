let currentUser = null;
let userData = null;

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) { window.location.href = '../auth/login.html'; return; }
        currentUser = user;
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists) { window.location.href = '../auth/login.html'; return; }
        userData = doc.data();
        
        document.getElementById('bookDate').min = new Date().toISOString().split('T')[0];
        loadDoctors();
    });
    
    document.getElementById('bookAppointmentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const doctorId = document.getElementById('bookDoctor').value;
        const date = document.getElementById('bookDate').value;
        const time = document.getElementById('bookTime').value;
        const type = document.getElementById('bookType').value;
        const reason = sanitizeInput(document.getElementById('bookReason').value);
        
        if (!doctorId || !date || !time || !type) {
            showToast('Please fill all required fields', 'warning');
            return;
        }
        
        try {
            await db.collection('appointments').add({
                patientId: currentUser.uid,
                doctorId,
                date,
                time,
                type,
                notes: reason,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await logActivity(currentUser.uid, 'appointment-book', `Appointment booked with doctor ${doctorId}`);
            
            showToast('Appointment booked successfully!', 'success');
            setTimeout(() => window.location.href = 'index.html', 1500);
        } catch (error) {
            console.error('Error:', error);
            showToast('Error booking appointment', 'error');
        }
    });
});

async function loadDoctors() {
    const select = document.getElementById('bookDoctor');
    const snapshot = await db.collection('users').where('role', '==', 'doctor').get();
    
    if (snapshot.empty) {
        select.innerHTML = '<option value="">No doctors available</option>';
        return;
    }
    
    snapshot.forEach(doc => {
        const data = doc.data();
        select.innerHTML += `<option value="${doc.id}">Dr. ${data.firstName} ${data.lastName} - ${data.specialization || 'General'}</option>`;
    });
}
