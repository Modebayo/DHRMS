let userData = null;

function populateUserProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && userData) nameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    if (roleEl && userData) roleEl.textContent = userData.role?.replace(/_/g, ' ') || 'Role';
    if (avatarEl && userData) avatarEl.textContent = (userData.firstName?.[0] || 'U').toUpperCase();
}

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

// ========== Backup ==========

async function createBackup() {
    const btn = document.getElementById('createBackupBtn');
    const status = document.getElementById('backupStatus');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="display:inline-block"></span> Creating...';
    if (status) status.textContent = 'Creating backup...';
    try {
        const token = getAuthToken();
        const res = await fetch('/api/backup/create', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        const data = await res.json();
        if (status) status.textContent = 'Backup created: ' + data.filename + ' (' + data.sizeLabel + ')';
        showToast('Backup created successfully', 'success');
        loadBackupList();
    } catch (err) {
        showToast('Backup failed: ' + err.message, 'error');
        if (status) status.textContent = 'Failed: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="download"></i> Create Backup';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function loadBackupList() {
    const container = document.getElementById('backupList');
    if (!container) return;
    try {
        const token = getAuthToken();
        const res = await fetch('/api/backup/list', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('Failed to load backups');
        const list = await res.json();
        if (list.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">No backups yet</div>';
            return;
        }
        container.innerHTML = '<table class="backup-table"><thead><tr><th>Filename</th><th>Size</th><th>Date</th><th>Actions</th></tr></thead><tbody>' +
            list.map(b => '<tr><td>' + b.filename + '</td><td>' + b.sizeLabel + '</td><td>' + formatDate(b.createdAt) + '</td><td class="backup-actions">' +
                '<button class="btn btn-sm" onclick="downloadBackup(\'' + b.filename + '\')" title="Download"><i data-lucide="download" style="width:14px;height:14px;"></i></button>' +
                '<button class="btn btn-sm btn-danger" onclick="confirmDeleteBackup(\'' + b.filename + '\')" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>' +
                '<button class="btn btn-sm btn-warning" onclick="confirmRestoreBackup(\'' + b.filename + '\')" title="Restore"><i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i></button>' +
                '</td></tr>').join('') +
            '</tbody></table>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--color-error);">Error loading backups</div>';
    }
}

function downloadBackup(filename) {
    const token = getAuthToken();
    const a = document.createElement('a');
    a.href = '/api/backup/download/' + encodeURIComponent(filename);
    a.download = filename;
    a.style.display = 'none';
    const handler = function (e) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', a.href);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.responseType = 'blob';
        xhr.onload = function () {
            const url = window.URL.createObjectURL(xhr.response);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        };
        xhr.send();
    };
    handler();
}

function confirmDeleteBackup(filename) {
    if (!confirm('Delete backup "' + filename + '"? This cannot be undone.')) return;
    deleteBackup(filename);
}

async function deleteBackup(filename) {
    try {
        const token = getAuthToken();
        const res = await fetch('/api/backup/' + encodeURIComponent(filename), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        showToast('Backup deleted', 'success');
        loadBackupList();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

function confirmRestoreBackup(filename) {
    const modal = document.getElementById('restoreModal');
    const msg = document.getElementById('restoreMessage');
    const confirmBtn = document.getElementById('restoreConfirmBtn');
    if (!modal || !msg || !confirmBtn) return;
    msg.textContent = 'Restore from "' + filename + '"? A pre-restore snapshot will be created automatically. The server will need to be restarted after restore.';
    confirmBtn.onclick = function () { restoreBackup(filename); };
    modal.style.display = 'flex';
}

function cancelRestore() {
    const modal = document.getElementById('restoreModal');
    if (modal) modal.style.display = 'none';
}

async function restoreBackup(filename) {
    const modal = document.getElementById('restoreModal');
    const confirmBtn = document.getElementById('restoreConfirmBtn');
    if (modal) modal.style.display = 'none';
    if (confirmBtn) confirmBtn.disabled = true;
    try {
        const token = getAuthToken();
        const res = await fetch('/api/backup/restore', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        showToast('Backup restored successfully. Restarting server recommended.', 'success');
        loadBackupList();
    } catch (err) {
        showToast('Restore failed: ' + err.message, 'error');
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
    }
}

function getAuthToken() {
    try { return sessionStorage.getItem('ku_dhrms_jwt') || ''; } catch { return ''; }
}

function formatDate(iso) {
    if (!iso) return 'N/A';
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch { return iso; }
}
