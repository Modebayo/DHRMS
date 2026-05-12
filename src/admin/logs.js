let currentUser = null;
let allLogs = [];
let usersCache = {};
let currentPage = 1;
const logsPerPage = 20;

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) { window.location.href = '../auth/login.html'; return; }
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists || doc.data().role !== 'admin') { window.location.href = '../dashboard/index.html'; return; }
        currentUser = user;
        loadUsers();
        loadLogs();
    });
    
    document.getElementById('filterLogType')?.addEventListener('change', () => filterLogs());
    document.getElementById('filterUser')?.addEventListener('change', () => filterLogs());
});

async function loadUsers() {
    const select = document.getElementById('filterUser');
    const snapshot = await db.collection('users').orderBy('firstName').get();
    snapshot.forEach(doc => {
        const u = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = `${u.firstName} ${u.lastName}`;
        select.appendChild(option);
    });
}

async function loadLogs() {
    try {
        const snapshot = await db.collection('activity_logs').orderBy('timestamp', 'desc').limit(500).get();
        allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const userIds = [...new Set(allLogs.map(l => l.userId))];
        for (const id of userIds) {
            if (!usersCache[id]) {
                const doc = await db.collection('users').doc(id).get();
                usersCache[id] = doc.exists ? doc.data() : null;
            }
        }
        
        updateStats();
        filterLogs();
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

function updateStats() {
    const total = allLogs.length;
    const logins = allLogs.filter(l => l.type === 'login' || l.type === 'admin-login').length;
    const records = allLogs.filter(l => l.type.includes('record')).length;
    const signups = allLogs.filter(l => l.type === 'signup').length;
    
    document.getElementById('totalLogs').textContent = total;
    document.getElementById('loginCount').textContent = logins;
    document.getElementById('recordCount').textContent = records;
    document.getElementById('signupCount').textContent = signups;
}

function filterLogs() {
    const typeFilter = document.getElementById('filterLogType')?.value || '';
    const userFilter = document.getElementById('filterUser')?.value || '';
    
    let filtered = allLogs;
    
    if (typeFilter) {
        filtered = filtered.filter(l => l.type === typeFilter);
    }
    
    if (userFilter) {
        filtered = filtered.filter(l => l.userId === userFilter);
    }
    
    renderLogs(filtered);
}

function renderLogs(logs) {
    const tbody = document.getElementById('logsTable');
    const totalPages = Math.ceil(logs.length / logsPerPage);
    const start = (currentPage - 1) * logsPerPage;
    const pageLogs = logs.slice(start, start + logsPerPage);
    
    if (pageLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>No logs found</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = pageLogs.map(log => {
        const user = usersCache[log.userId];
        const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
        const typeClass = {
            'login': 'success', 'admin-login': 'success', 'logout': 'warning',
            'signup': 'primary', 'record-create': 'info', 'record-update': 'info',
            'appointment-book': 'info', 'admin-action': 'danger',
            'user_update': 'warning', 'user_approve': 'success', 'user_suspend': 'danger', 'user_delete': 'danger',
            'bulk_approve': 'success', 'bulk_suspend': 'danger', 'bulk_delete': 'danger'
        }[log.type] || 'primary';
        
        return `
            <tr>
                <td style="white-space:nowrap;">${formatTimestamp(log.timestamp)}</td>
                <td><strong>${escapeHtml(userName)}</strong></td>
                <td><span class="badge badge-${typeClass}">${log.type.replace(/_/g, ' ')}</span></td>
                <td>${escapeHtml(log.description || '')}</td>
                <td style="font-size:12px;color:var(--text-muted);">${log.ipAddress || 'N/A'}</td>
            </tr>
        `;
    }).join('');
    
    renderPagination(totalPages);
    lucide.createIcons();
}

function renderPagination(totalPages) {
    const container = document.getElementById('pagination');
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    container.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    filterLogs();
}

function exportLogs() {
    let csv = 'Timestamp,User,Type,Description,IP Address\n';
    allLogs.forEach(log => {
        const user = usersCache[log.userId];
        const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
        csv += `"${log.timestamp ? new Date(log.timestamp.toDate()).toISOString() : ''}","${userName}","${log.type}","${log.description || ''}","${log.ipAddress || ''}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Logs exported successfully', 'success');
}