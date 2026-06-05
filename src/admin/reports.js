let currentUser = null;
let userData = null;

function populateUserProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && userData) nameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    if (roleEl && userData) roleEl.textContent = userData.role?.replace(/_/g, ' ') || 'Role';
    if (avatarEl && userData) avatarEl.textContent = (userData.firstName?.[0] || 'U').toUpperCase();
}

// Auth handled by guardPage() in HTML


function setupReportTabListeners() {
    const tabs = document.querySelectorAll('.report-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.report-panel').forEach(p => p.classList.remove('active'));
            const panel = document.getElementById(tab.dataset.report);
            if (panel) panel.classList.add('active');
        });
    });

    document.getElementById('generateAttendance')?.addEventListener('click', generateAttendanceReport);
    document.getElementById('generateDiagnosis')?.addEventListener('click', generateDiagnosisReport);
    document.getElementById('generatePrescriptionUtil')?.addEventListener('click', generatePrescriptionUtilReport);
    document.getElementById('generateLabUtil')?.addEventListener('click', generateLabUtilReport);
    document.getElementById('generateAppointmentAttendance')?.addEventListener('click', generateAppointmentAttendanceReport);

    document.querySelectorAll('.export-report-btn').forEach(btn => {
        btn.addEventListener('click', exportActiveReport);
    });
}

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

        const roles = { student: 0, doctor: 0, nurse: 0, admin: 0, pharmacist: 0, lab_technician: 0, records_officer: 0 };
        usersSnap.forEach(doc => {
            const role = doc.data().role;
            if (roles[role] !== undefined) roles[role]++;
        });

        const roleChart = document.getElementById('roleChart');
        const maxRole = Math.max(...Object.values(roles), 1);
        roleChart.innerHTML = Object.entries(roles).filter(([_, count]) => count > 0).map(([role, count]) => {
            const pct = maxRole > 0 ? (count / maxRole * 100).toFixed(1) : 0;
            return `
                <div style="margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span style="font-weight:500;text-transform:capitalize;">${escapeHtml(role.replace(/_/g, ' '))}</span>
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

function getDateRange(prefix) {
    const fromEl = document.getElementById(prefix + 'DateFrom');
    const toEl = document.getElementById(prefix + 'DateTo');
    const fromVal = fromEl?.value;
    const toVal = toEl?.value;
    return {
        from: fromVal ? new Date(fromVal + 'T00:00:00') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: toVal ? new Date(toVal + 'T23:59:59') : new Date()
    };
}

function isInRange(date, range) {
    if (!date) return false;
    const d = date.toDate ? date.toDate() : new Date(date);
    return d >= range.from && d <= range.to;
}

function escapeCsv(val) {
    if (val == null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

async function generateAttendanceReport() {
    const range = getDateRange('report');
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">Loading...</td></tr>';

    try {
        const [healthRecordsSnap, appointmentsSnap, consultationsSnap] = await Promise.all([
            db.collection('health_records').get(),
            db.collection('appointments').get(),
            db.collection('consultations').get()
        ]);

        const dailyMap = {};

        healthRecordsSnap.forEach(doc => {
            const d = doc.data();
            if (isInRange(d.createdAt, range)) {
                const key = d.createdAt.toDate().toISOString().split('T')[0];
                if (!dailyMap[key]) dailyMap[key] = { date: key, records: 0, appointments: 0, consultations: 0 };
                dailyMap[key].records++;
            }
        });

        appointmentsSnap.forEach(doc => {
            const d = doc.data();
            if (isInRange(d.date, range)) {
                const key = d.date.toDate().toISOString().split('T')[0];
                if (!dailyMap[key]) dailyMap[key] = { date: key, records: 0, appointments: 0, consultations: 0 };
                dailyMap[key].appointments++;
            }
        });

        consultationsSnap.forEach(doc => {
            const d = doc.data();
            if (isInRange(d.createdAt, range)) {
                const key = d.createdAt.toDate().toISOString().split('T')[0];
                if (!dailyMap[key]) dailyMap[key] = { date: key, records: 0, appointments: 0, consultations: 0 };
                dailyMap[key].consultations++;
            }
        });

        const sorted = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        let totalVisits = 0;

        tbody.innerHTML = sorted.map(row => {
            totalVisits += row.records + row.appointments + row.consultations;
            return `<tr><td>${row.date}</td><td>${row.records}</td><td>${row.appointments}</td><td>${row.consultations}</td></tr>`;
        }).join('') || '<tr><td colspan="4" class="empty-state">No data for selected period</td></tr>';

        document.getElementById('attendanceTotal').textContent = totalVisits;
        window._activeReportData = { type: 'attendance', data: sorted, totalVisits };
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--danger-500);">Error loading report</td></tr>';
    }
}

async function generateDiagnosisReport() {
    const range = getDateRange('diag');
    const tbody = document.getElementById('diagnosisTableBody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;">Loading...</td></tr>';

    try {
        const [healthRecordsSnap, consultationsSnap] = await Promise.all([
            db.collection('health_records').get(),
            db.collection('consultations').get()
        ]);

        const diagMap = {};

        healthRecordsSnap.forEach(doc => {
            const d = doc.data();
            if (isInRange(d.createdAt, range)) {
                const diagnosis = d.diagnosis || d.assessment || '';
                if (diagnosis.trim()) {
                    diagMap[diagnosis] = (diagMap[diagnosis] || 0) + 1;
                }
            }
        });

        consultationsSnap.forEach(doc => {
            const d = doc.data();
            if (isInRange(d.createdAt, range)) {
                ['provisionalDiagnosis', 'confirmedDiagnosis', 'differentialDiagnosis'].forEach(field => {
                    const diag = d[field] || '';
                    if (diag.trim()) {
                        diagMap[diag] = (diagMap[diag] || 0) + 1;
                    }
                });
            }
        });

        const sorted = Object.entries(diagMap).sort((a, b) => b[1] - a[1]);
        const totalDiag = sorted.reduce((sum, [_, count]) => sum + count, 0);

        tbody.innerHTML = sorted.map(([diag, count], i) => {
            const pct = ((count / totalDiag) * 100).toFixed(1);
            return `<tr><td>${i + 1}</td><td>${escapeHtml(diag)}</td><td>${count} (${pct}%)</td></tr>`;
        }).join('') || '<tr><td colspan="3" class="empty-state">No diagnosis data for selected period</td></tr>';

        window._activeReportData = { type: 'diagnosis', data: sorted, totalDiag };
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--danger-500);">Error loading report</td></tr>';
    }
}

async function generatePrescriptionUtilReport() {
    const range = getDateRange('presc');
    const tbody = document.getElementById('prescriptionUtilTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">Loading...</td></tr>';

    try {
        const prescSnap = await db.collection('prescriptions').get();
        const medMap = {};

        prescSnap.forEach(doc => {
            const d = doc.data();
            if (isInRange(d.createdAt, range)) {
                const med = d.medication || '';
                if (med.trim()) {
                    if (!medMap[med]) medMap[med] = { count: 0, dispensed: 0 };
                    medMap[med].count++;
                    if (d.status === 'dispensed') medMap[med].dispensed++;
                }
            }
        });

        const sorted = Object.entries(medMap).sort((a, b) => b[1].count - a[1].count);
        const totalPresc = sorted.reduce((sum, [_, v]) => sum + v.count, 0);

        tbody.innerHTML = sorted.map(([med, v], i) => {
            const pct = ((v.count / totalPresc) * 100).toFixed(1);
            return `<tr><td>${i + 1}</td><td>${escapeHtml(med)}</td><td>${v.count}</td><td>${v.dispensed} (${((v.dispensed / v.count) * 100).toFixed(0)}%)</td></tr>`;
        }).join('') || '<tr><td colspan="4" class="empty-state">No prescription data for selected period</td></tr>';

        window._activeReportData = { type: 'prescription-util', data: sorted, totalPresc };
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--danger-500);">Error loading report</td></tr>';
    }
}

async function generateLabUtilReport() {
    const range = getDateRange('lab');
    const tbody = document.getElementById('labUtilTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">Loading...</td></tr>';

    try {
        const [labResultsSnap, labRequestsSnap] = await Promise.all([
            db.collection('lab_results').get(),
            db.collection('lab_requests').get()
        ]);

        const testMap = {};
        let totalResults = 0, totalPending = 0;

        labRequestsSnap.forEach(doc => {
            const d = doc.data();
            if (isInRange(d.createdAt, range)) {
                const testType = d.testType || d.testName || d.type || '';
                if (testType.trim()) {
                    if (!testMap[testType]) testMap[testType] = { requested: 0, resulted: 0 };
                    testMap[testType].requested++;
                    if (d.status === 'resulted') testMap[testType].resulted++;
                    totalResults++;
                    if (d.status === 'pending') totalPending++;
                }
            }
        });

        labResultsSnap.forEach(doc => {
            const d = doc.data();
            if (isInRange(d.createdAt, range)) {
                const testType = d.testType || d.testName || d.type || '';
                if (testType.trim() && !testMap[testType]) {
                    testMap[testType] = { requested: 0, resulted: 1 };
                } else if (testType.trim() && testMap[testType]) {
                    testMap[testType].resulted = Math.max(testMap[testType].resulted, testMap[testType].requested + 1);
                }
            }
        });

        const sorted = Object.entries(testMap).sort((a, b) => b[1].requested - a[1].requested);
        const total = sorted.reduce((sum, [_, v]) => sum + v.requested, 0);

        tbody.innerHTML = sorted.map(([test, v], i) => {
            return `<tr><td>${i + 1}</td><td>${escapeHtml(test)}</td><td>${v.requested}</td><td>${v.resulted} (${v.requested > 0 ? ((v.resulted / v.requested) * 100).toFixed(0) : 0}%)</td></tr>`;
        }).join('') || '<tr><td colspan="4" class="empty-state">No lab data for selected period</td></tr>';

        window._activeReportData = { type: 'lab-util', data: sorted, total, totalResults, totalPending };
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--danger-500);">Error loading report</td></tr>';
    }
}

async function generateAppointmentAttendanceReport() {
    const range = getDateRange('apt');
    const tbody = document.getElementById('appointmentAttTableBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Loading...</td></tr>';

    try {
        const aptSnap = await db.collection('appointments').get();
        const usersSnap = await db.collection('users').get();
        const userMap = {};
        usersSnap.forEach(d => { userMap[d.id] = d.data(); });

        const dayMap = {};
        let totalShowed = 0, totalNoShow = 0;

        aptSnap.forEach(doc => {
            const d = doc.data();
            if (isInRange(d.date, range)) {
                const key = d.date.toDate().toISOString().split('T')[0];
                if (!dayMap[key]) dayMap[key] = { date: key, total: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 };
                dayMap[key].total++;
                if (d.status === 'confirmed') dayMap[key].confirmed++;
                else if (d.status === 'completed') { dayMap[key].completed++; totalShowed++; }
                else if (d.status === 'cancelled') { dayMap[key].cancelled++; totalNoShow++; }
                else dayMap[key].noShow++;
            }
        });

        const sorted = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
        const grandTotal = sorted.reduce((s, r) => s + r.total, 0);
        const totalAttended = sorted.reduce((s, r) => s + r.completed, 0);

        tbody.innerHTML = sorted.map(row => {
            const showRate = row.total > 0 ? ((row.completed / row.total) * 100).toFixed(1) : '0.0';
            return `<tr><td>${row.date}</td><td>${row.total}</td><td>${row.completed}</td><td>${row.cancelled + row.noShow}</td><td>${showRate}%</td></tr>`;
        }).join('') || '<tr><td colspan="5" class="empty-state">No appointment data for selected period</td></tr>';

        document.getElementById('aptAttTotal').textContent = grandTotal;
        document.getElementById('aptAttShowed').textContent = totalAttended;
        document.getElementById('aptAttNoShow').textContent = grandTotal - totalAttended;
        document.getElementById('aptAttRate').textContent = grandTotal > 0 ? ((totalAttended / grandTotal) * 100).toFixed(1) + '%' : '0%';

        window._activeReportData = { type: 'appointment-att', data: sorted, grandTotal, totalAttended };
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--danger-500);">Error loading report</td></tr>';
    }
}

function exportActiveReport() {
    const data = window._activeReportData;
    if (!data || !data.data || data.data.length === 0) {
        showToast('No report data to export', 'warning');
        return;
    }

    let csv = '';
    switch (data.type) {
        case 'attendance':
            csv = 'Date,Health Records,Appointments,Consultations\n';
            data.data.forEach(r => { csv += `${r.date},${r.records},${r.appointments},${r.consultations}\n`; });
            break;
        case 'diagnosis':
            csv = 'Rank,Diagnosis,Count (%)\n';
            data.data.forEach(([diag, count], i) => { csv += `${i + 1},${escapeCsv(diag)},${count}\n`; });
            break;
        case 'prescription-util':
            csv = 'Rank,Medication,Prescribed,Dispensed (%)\n';
            data.data.forEach(([med, v], i) => {
                const pct = v.count > 0 ? ((v.dispensed / v.count) * 100).toFixed(0) : '0';
                csv += `${i + 1},${escapeCsv(med)},${v.count},${v.dispensed} (${pct}%)\n`;
            });
            break;
        case 'lab-util':
            csv = 'Rank,Test Type,Requested,Resulted (%)\n';
            data.data.forEach(([test, v], i) => {
                const pct = v.requested > 0 ? ((v.resulted / v.requested) * 100).toFixed(0) : '0';
                csv += `${i + 1},${escapeCsv(test)},${v.requested},${v.resulted} (${pct}%)\n`;
            });
            break;
        case 'appointment-att':
            csv = 'Date,Total,Attended,No-Show,Attendance Rate\n';
            data.data.forEach(r => {
                const rate = r.total > 0 ? ((r.completed / r.total) * 100).toFixed(1) : '0.0';
                csv += `${r.date},${r.total},${r.completed},${r.cancelled + r.noShow},${rate}%\n`;
            });
            break;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.type}_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Report exported', 'success');
}

function exportOverviewReport() {
    const rows = document.querySelectorAll('#summaryTable tr');
    let csv = 'Metric,Value\n';
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 2) {
            csv += `${escapeCsv(cells[0].textContent)},${cells[1].textContent}\n`;
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_overview_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Overview exported', 'success');
}
