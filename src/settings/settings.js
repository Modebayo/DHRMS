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
    
    loadSettings();
});

function getInitials(firstName, lastName) {
    const f = firstName?.charAt(0) || '';
    const l = lastName?.charAt(0) || '';
    return (f + l).toUpperCase() || 'KU';
}

function loadSettings() {
    document.getElementById('firstName').value = userData.firstName || '';
    document.getElementById('lastName').value = userData.lastName || '';
    document.getElementById('email').value = userData.email || '';
    document.getElementById('phone').value = userData.phone || '';
    document.getElementById('profileAvatar').textContent = getInitials(userData.firstName, userData.lastName);
    
    if (userData.notificationPrefs) {
        document.getElementById('notifEmail').checked = userData.notificationPrefs.emailNotifications !== false;
        document.getElementById('notifAppointments').checked = userData.notificationPrefs.appointmentReminders !== false;
        document.getElementById('notifPrescriptions').checked = userData.notificationPrefs.prescriptionAlerts === true;
    }
}

async function updateProfile() {
    const firstName = sanitizeInput(document.getElementById('firstName').value);
    const lastName = sanitizeInput(document.getElementById('lastName').value);
    const phone = sanitizeInput(document.getElementById('phone').value);
    
    if (!firstName || !lastName) {
        showToast('First and last name are required', 'warning');
        return;
    }
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            firstName,
            lastName,
            phone
        });
        showToast('Profile updated successfully', 'success');
        document.getElementById('profileAvatar').textContent = getInitials(firstName, lastName);
        logActivity(currentUser.uid, 'profile-update', 'Updated profile information');
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Error updating profile', 'error');
    }
}

async function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;
    
    if (!current || !newPass || !confirmPass) {
        showToast('All fields are required', 'warning');
        return;
    }
    
    if (newPass !== confirmPass) {
        showToast('Passwords do not match', 'warning');
        return;
    }
    
    if (newPass.length < 8) {
        showToast('Password must be at least 8 characters', 'warning');
        return;
    }
    
    try {
        const token = getAuthToken();
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: current, newPassword: newPass })
        });
        if (!res.ok) {
            const err = await res.json();
            throw { code: err.code || 'auth/unknown', message: err.error };
        }
        
        try {
            await KeyManager.reEncryptPrivateKey(current, newPass);
        } catch (keyError) {
            console.warn('Could not re-encrypt keys, user may need to re-login:', keyError);
        }
        
        showToast('Password updated successfully', 'success');
        document.getElementById('passwordForm').reset();
        logActivity(currentUser.uid, 'password-change', 'Changed password');
    } catch (error) {
        let msg = 'Error updating password';
        if (error.code === 'auth/wrong-password') msg = 'Current password is incorrect';
        if (error.code === 'auth/weak-password') msg = 'Password is too weak';
        showToast(msg, 'error');
    }
}

async function saveNotificationPrefs() {
    const prefs = {
        emailNotifications: document.getElementById('notifEmail').checked,
        appointmentReminders: document.getElementById('notifAppointments').checked,
        prescriptionAlerts: document.getElementById('notifPrescriptions').checked
    };
    
    try {
        await db.collection('users').doc(currentUser.uid).update({ notificationPrefs: prefs });
        showToast('Notification preferences saved', 'success');
    } catch (error) {
        console.error('Error saving preferences:', error);
        showToast('Error saving preferences', 'error');
    }
}

async function deleteAccount() {
    if (!confirm('Are you sure? This action cannot be undone.')) return;
    
    const confirmInput = prompt('Type DELETE to confirm account deletion:');
    if (confirmInput !== 'DELETE') {
        showToast('Account deletion cancelled', 'info');
        return;
    }
    
    try {
        await db.collection('users').doc(currentUser.uid).delete();
        const token = getAuthToken();
        await fetch('/api/auth/delete-account', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        });
        showToast('Account deleted', 'success');
        setTimeout(() => {
            window.location.href = '../auth/login.html';
        }, 1500);
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast('Error deleting account', 'error');
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

document.getElementById('avatarUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
        showToast('File too large. Max 2MB allowed', 'warning');
        return;
    }
    
    try {
        const ref = storage.ref(`avatars/${currentUser.uid}`);
        await ref.put(file);
        const url = await ref.getDownloadURL();
        await db.collection('users').doc(currentUser.uid).update({ avatarUrl: url });
        
        const avatarEl = document.getElementById('profileAvatar');
        avatarEl.style.backgroundImage = `url(${url})`;
        avatarEl.textContent = '';
        
        showToast('Profile photo updated', 'success');
    } catch (error) {
        console.error('Error uploading photo:', error);
        showToast('Error uploading photo', 'error');
    }
});

function getAuthToken() {
    try { return sessionStorage.getItem('ku_dhrms_jwt') || ''; } catch { return ''; }
}