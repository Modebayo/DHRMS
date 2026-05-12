document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) { window.location.href = '../auth/login.html'; return; }
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists || doc.data().role !== 'admin') { window.location.href = '../dashboard/index.html'; return; }
        loadReports();
    });
});

async function loadReports() {
    try {
        const [
            usersSnap, recordsSnap, aptSnap, prescSnap,
            labSnap, vitalsSnap, inventorySnap, logsSnap
        ] = await Promise.all([
            db.collection('users').get(),
            db.collection('health_records').get(),
            db.collection('appointments').get(),
            db.collection('prescriptions').get(),
            db.collection('lab_results').get(),
            db.collection('vitals').get(),
            db.collection('inventory').get(),
            db.collection('activity_logs').get()
        ]);
        
        const totalUsers = usersSnap.size;
        const totalRecords = recordsSnap.size;
        const totalAppointments = aptSnap.size;
        const totalPrescriptions = prescSnap.size;
        const totalLab = labSnap.size;
        const totalVitals = vitalsSnap.size;
        const totalInventory = inventorySnap.size;
        
        document.getElementById('rTotalUsers').textContent = totalUsers;
        document.getElementById('rTotalRecords').textContent = totalRecords;
        document.getElementById('rTotalAppointments').textContent = totalAppointments;
        document.getElementById('rTotalPrescriptions').textContent = totalPrescriptions;
        
        const today = new Date();
        const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const thisMonthLogs = logsSnap.docs.filter(d => {
            const ts = d.data().timestamp;
            if (!ts) return false;
            const date = new Date(ts.toDate());
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === thisMonth;
        }).length;
        document.getElementById('rThisMonth').textContent = thisMonthLogs;
        
        const roles = { student: 0, doctor: 0, nurse: 0, admin: 0 };
        usersSnap.forEach(doc => {
            const role = doc.data().role;
            if (roles[role] !== undefined) roles[role]++;
        });
        
        const roleChart = document.getElementById('roleChart');
        const maxRole = Math.max(...Object.values(roles), 1);
        roleChart.innerHTML = Object.entries(roles).map(([role, count]) => {
            const pct = maxRole > 0 ? (count / maxRole * 100).toFixed(1) : 0;
            return `
                <div style="margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span style="font-weight:500;text-transform:capitalize;">${role}</span>
                        <span style="color:var(--text-muted);">${count} (${(count/totalUsers*100).toFixed(1)}%)</span>
                    </div>
                    <div style="background:var(--bg-tertiary);border-radius:4px;height:24px;overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:var(--primary-500);transition:width 0.5s;"></div>
                    </div>
                </div>
            `;
        }).join('');
        
        const depts = {};
        usersSnap.forEach(doc => {
            const d = doc.data();
            if (d.department && d.department.trim()) {
                depts[d.department] = (depts[d.department] || 0) + 1;
            } else if (d.specialization && d.specialization.trim()) {
                depts[d.specialization] = (depts[d.specialization] || 0) + 1;
            }
        });
        
        const deptChart = document.getElementById('deptChart');
        if (Object.keys(depts).length === 0) {
            deptChart.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">No department data available</p>';
        } else {
            const sortedDepts = Object.entries(depts).sort((a, b) => b[1] - a[1]).slice(0, 10);
            const maxDept = sortedDepts[0]?.[1] || 1;
            deptChart.innerHTML = sortedDepts.map(([dept, count]) => {
                const pct = (count / maxDept * 100).toFixed(1);
                return `
                    <div style="margin-bottom:12px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="font-size:13px;">${escapeHtml(dept)}</span>
                            <span style="color:var(--text-muted);font-size:13px;">${count}</span>
                        </div>
                        <div style="background:var(--bg-tertiary);border-radius:4px;height:18px;overflow:hidden;">
                            <div style="height:100%;width:${pct}%;background:var(--success-500);transition:width 0.5s;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        const statusCounts = { active: 0, pending_approval: 0, suspended: 0 };
        usersSnap.forEach(doc => {
            const s = doc.data().status;
            if (statusCounts[s] !== undefined) statusCounts[s]++;
        });
        
        document.getElementById('statusChart').innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
                <div style="padding:16px;background:var(--success-50);border-radius:var(--radius-md);text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:var(--success-600);">${statusCounts.active}</div>
                    <div style="font-size:12px;color:var(--success-700);">Active</div>
                </div>
                <div style="padding:16px;background:var(--warning-50);border-radius:var(--radius-md);text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:var(--warning-600);">${statusCounts.pending_approval}</div>
                    <div style="font-size:12px;color:var(--warning-700);">Pending</div>
                </div>
                <div style="padding:16px;background:var(--danger-50);border-radius:var(--radius-md);text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:var(--danger-600);">${statusCounts.suspended}</div>
                    <div style="font-size:12px;color:var(--danger-700);">Suspended</div>
                </div>
            </div>
        `;
        
        const aptStatus = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
        aptSnap.forEach(doc => {
            const s = doc.data().status;
            if (aptStatus[s] !== undefined) aptStatus[s]++;
        });
        
        document.getElementById('aptChart').innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:12px;">
                <div style="text-align:center;"><div style="font-weight:600;color:var(--text-muted);">${aptStatus.pending}</div>Pending</div>
                <div style="text-align:center;"><div style="font-weight:600;color:var(--success-600);">${aptStatus.confirmed}</div>Confirmed</div>
                <div style="text-align:center;"><div style="font-weight:600;color:var(--primary-600);">${aptStatus.completed}</div>Completed</div>
                <div style="text-align:center;"><div style="font-weight:600;color:var(--danger-600);">${aptStatus.cancelled}</div>Cancelled</div>
            </div>
        `;
        
        document.getElementById('summaryTable').innerHTML = `
            <tr><td><strong>Total Users</strong></td><td style="font-weight:600;">${totalUsers}</td></tr>
            <tr><td>Active Users</td><td>${statusCounts.active}</td></tr>
            <tr><td>Pending Approval</td><td>${statusCounts.pending_approval}</td></tr>
            <tr><td><strong>Health Records</strong></td><td style="font-weight:600;">${totalRecords}</td></tr>
            <tr><td><strong>Appointments</strong></td><td style="font-weight:600;">${totalAppointments}</td></tr>
            <tr><td><strong>Prescriptions</strong></td><td style="font-weight:600;">${totalPrescriptions}</td></tr>
            <tr><td><strong>Lab Results</strong></td><td style="font-weight:600;">${totalLab}</td></tr>
            <tr><td><strong>Vitals Recorded</strong></td><td style="font-weight:600;">${totalVitals}</td></tr>
            <tr><td><strong>Inventory Items</strong></td><td style="font-weight:600;">${totalInventory}</td></tr>
            <tr><td><strong>Activity Logs</strong></td><td style="font-weight:600;">${logsSnap.size}</td></tr>
        `;
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (error) {
        console.error('Error loading reports:', error);
        showToast('Error loading reports', 'error');
    }
}

function exportReport() {
    const rows = document.querySelectorAll('#summaryTable tr');
    let csv = 'Metric,Value\n';
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 2) {
            csv += `"${cells[0].textContent}",${cells[1].textContent}\n`;
        }
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health_system_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Report exported successfully', 'success');
}