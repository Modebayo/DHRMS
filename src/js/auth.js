function togglePassword() {
    const passwordInput = document.getElementById('password');
    const icon = document.querySelector('.toggle-password i');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
    } else {
        passwordInput.type = 'password';
        if (icon) icon.setAttribute('data-lucide', 'eye');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[0-9]/.test(password) && 
           /[!@#$%^&*(),.?":{}|<>]/.test(password);
}

function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container') || createToastContainer();
    const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i data-lucide="${icons[type] || icons.info}"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getInitials(firstName, lastName) {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
}

function setButtonLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    
    if (loading) {
        btn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (spinner) spinner.style.display = 'inline-block';
    } else {
        btn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
    }
}

function showAlert(elementId, message, type = 'error') {
    const alert = document.getElementById(elementId);
    if (!alert) return;
    alert.textContent = message;
    alert.className = `alert alert-${type}`;
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

function checkAuth() {
    return new Promise((resolve) => {
        auth.onAuthStateChanged((user) => {
            if (user) {
                db.collection('users').doc(user.uid).get().then((doc) => {
                    if (doc.exists) {
                        resolve({ user, userData: doc.data() });
                    } else {
                        resolve({ user, userData: null });
                    }
                });
            } else {
                resolve({ user: null, userData: null });
            }
        });
    });
}

async function logout() {
    if (!confirm('Are you sure you want to log out?')) return;
    try {
        if (typeof KeyManager !== 'undefined' && KeyManager.clearSession) {
            KeyManager.clearSession();
        }
        const user = auth.currentUser;
        const uid = user ? user.uid : null;
        await auth.signOut();
        if (uid) {
            logActivity(uid, 'logout', 'User logged out');
        }
        window.location.href = '../auth/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    }
}

async function initUserKeys(user, password) {
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Key init timeout')), 15000));
        await Promise.race([KeyManager.initKeys(user, password), timeout]);
        return true;
    } catch (error) {
        console.error('Key initialization error:', error);
        return false;
    }
}

async function logActivity(userId, type, description) {
    try {
        let ipAddress = 'N/A';
        try {
            const resp = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
            const data = await resp.json();
            ipAddress = data.ip;
        } catch (e) {}

        await db.collection('audit_logs').add({
            userId,
            actionType: type,
            collectionName: '',
            documentId: '',
            description,
            ipAddress,
            userAgent: navigator.userAgent,
            actionTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('activity_logs').add({
            userId,
            type,
            description,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            ipAddress,
            userAgent: navigator.userAgent
        });
    } catch (error) {
        console.error('Activity log error:', error);
    }
}

async function logAuditEvent(userId, actionType, collectionName, documentId, description) {
    try {
        let ipAddress = 'N/A';
        try {
            const resp = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
            const data = await resp.json();
            ipAddress = data.ip;
        } catch (e) {}

        await db.collection('audit_logs').add({
            userId,
            actionType,
            collectionName,
            documentId,
            description: description || '',
            ipAddress,
            userAgent: navigator.userAgent,
            actionTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Audit log error:', error);
    }
}
