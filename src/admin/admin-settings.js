document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) { window.location.href = '../auth/login.html'; return; }
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists || doc.data().role !== 'admin') { window.location.href = '../dashboard/index.html'; return; }
        loadSettings();
    });
});

async function loadSettings() {
    const doc = await db.collection('settings').doc('general').get();
    if (doc.exists) {
        const s = doc.data();
        if (s.institutionName) document.getElementById('institutionName').value = s.institutionName;
        if (s.healthCenterName) document.getElementById('healthCenterName').value = s.healthCenterName;
        if (s.contactEmail) document.getElementById('contactEmail').value = s.contactEmail;
        if (s.contactPhone) document.getElementById('contactPhone').value = s.contactPhone;
    }
}

async function saveGeneralSettings() {
    const settings = {
        institutionName: sanitizeInput(document.getElementById('institutionName').value),
        healthCenterName: sanitizeInput(document.getElementById('healthCenterName').value),
        contactEmail: sanitizeInput(document.getElementById('contactEmail').value),
        contactPhone: sanitizeInput(document.getElementById('contactPhone').value),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection('settings').doc('general').set(settings, { merge: true });
        showToast('Settings saved', 'success');
    } catch (error) {
        showToast('Error saving settings', 'error');
    }
}

async function saveSecuritySettings() {
    const settings = {
        emailVerification: document.getElementById('emailVerification').checked,
        approvalRequired: document.getElementById('approvalRequired').checked,
        sessionTimeout: document.getElementById('sessionTimeout').checked,
        timeoutDuration: parseInt(document.getElementById('timeoutDuration').value),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection('settings').doc('security').set(settings, { merge: true });
        showToast('Security settings saved', 'success');
    } catch (error) {
        showToast('Error saving', 'error');
    }
}

async function exportAllData() {
    const collections = ['users', 'health_records', 'appointments', 'prescriptions', 'inventory', 'activity_logs'];
    let csv = '';
    
    for (const col of collections) {
        csv += `\n=== ${col.toUpperCase()} ===\n`;
        const snap = await db.collection(col).get();
        snap.forEach(doc => {
            csv += JSON.stringify({ id: doc.id, ...doc.data() }) + '\n';
        });
    }
    
    const blob = new Blob([csv], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health_system_backup_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Data exported', 'success');
}

function clearCache() {
    if (!confirm('Clear all cached data?')) return;
    if (window.caches) {
        caches.keys().then(names => names.forEach(n => caches.delete(n)));
    }
    localStorage.clear();
    showToast('Cache cleared. Reload the page.', 'success');
}
