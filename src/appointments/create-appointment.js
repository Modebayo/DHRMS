document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) { window.location.href = '../auth/login.html'; return; }
        loadDoctors();
        
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('bookDate').setAttribute('min', today);
    });
    
    document.getElementById('bookForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const doctorId = document.getElementById('bookDoctor').value;
        const date = document.getElementById('bookDate').value;
        const time = document.getElementById('bookTime').value;
        const type = document.getElementById('bookType').value;
        const notes = sanitizeInput(document.getElementById('bookNotes').value);
        
        if (!doctorId || !date || !time || !type) {
            showToast('Fill all required fields', 'warning');
            return;
        }
        
        try {
            await db.collection('appointments').add({
                patientId: auth.currentUser.uid,
                doctorId, date, time, type, notes,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await logActivity(auth.currentUser.uid, 'appointment-book', 'Booked new appointment');
            
            showToast('Appointment booked!', 'success');
            setTimeout(() => window.location.href = 'index.html', 1500);
        } catch (e) {
            showToast('Error booking appointment', 'error');
        }
    });
});

async function loadDoctors() {
    const snap = await db.collection('users').where('role', '==', 'doctor').get();
    const select = document.getElementById('bookDoctor');
    snap.forEach(doc => {
        const d = doc.data();
        select.innerHTML += `<option value="${doc.id}">Dr. ${d.firstName} ${d.lastName} - ${d.specialization || 'General'}</option>`;
    });
}
