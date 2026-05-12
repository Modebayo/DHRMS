document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let userData = null;
    
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = '../auth/login.html';
            return;
        }
        
        currentUser = user;
        const doc = await db.collection('users').doc(user.uid).get();
        
        if (!doc.exists) {
            window.location.href = '../auth/login.html';
            return;
        }
        
        userData = doc.data();
        initializeDashboard();
    });
    
    async function initializeDashboard() {
        document.getElementById('welcomeName').textContent = userData.firstName;
        document.title = `${userData.role.charAt(0).toUpperCase() + userData.role.slice(1)} Dashboard - KU Health Records`;
        
        const role = userData.role;
        const level = userData.level || 'basic';
        
        if (role === 'doctor') {
            document.getElementById('doctorNav').style.display = 'block';
            loadDoctorDashboard();
        } else if (role === 'nurse') {
            loadNurseDashboard();
        } else if (role === 'admin') {
            document.getElementById('adminNav').style.display = 'block';
            loadAdminDashboard();
        } else if (role === 'student') {
            loadStudentDashboard();
        }
        
        if (role === 'doctor' || role === 'admin') {
            document.getElementById('pharmacyNav').style.display = 'block';
        }
        
        loadRecentActivity();
        loadNotifications();
        loadDashboardAppointments();
        setupSearch();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    async function loadDoctorDashboard() {
        const statsGrid = document.getElementById('statsGrid');
        const today = new Date().toISOString().split('T')[0];
        
        const appointmentsSnapshot = await db.collection('appointments')
            .where('doctorId', '==', currentUser.uid)
            .where('date', '>=', today)
            .get();
        
        const patientsSnapshot = await db.collection('users')
            .where('doctorId', '==', currentUser.uid)
            .get();
        
        const prescriptionsSnapshot = await db.collection('prescriptions')
            .where('doctorId', '==', currentUser.uid)
            .get();
        
        const totalAppointments = appointmentsSnapshot.docs.length;
        const totalPatients = patientsSnapshot.docs.length;
        const totalPrescriptions = prescriptionsSnapshot.docs.length;
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon blue"><i data-lucide="users"></i></div>
                </div>
                <div class="stat-value">${totalPatients}</div>
                <div class="stat-label">My Patients</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon green"><i data-lucide="calendar-check"></i></div>
                </div>
                <div class="stat-value">${totalAppointments}</div>
                <div class="stat-label">Today's Appointments</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon orange"><i data-lucide="pill"></i></div>
                </div>
                <div class="stat-value">${totalPrescriptions}</div>
                <div class="stat-label">Prescriptions Issued</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon red"><i data-lucide="stethoscope"></i></div>
                </div>
                <div class="stat-value">${userData.specialization || 'General'}</div>
                <div class="stat-label">Specialization</div>
            </div>
        `;
        
        loadQuickActions([
            { icon: 'calendar-plus', label: 'New Appointment', link: '../appointments/create.html' },
            { icon: 'file-plus', label: 'Add Record', link: '../records/index.html' },
            { icon: 'pill', label: 'New Prescription', link: '../records/prescriptions.html' },
            { icon: 'users', label: 'Patient List', link: '../records/patient-list.html' }
        ]);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    async function loadNurseDashboard() {
        const statsGrid = document.getElementById('statsGrid');
        const today = new Date().toISOString().split('T')[0];
        
        const vitalsToday = await db.collection('vitals')
            .where('date', '>=', today)
            .get();
        
        const tasksPending = await db.collection('tasks')
            .where('status', '==', 'pending')
            .get();
        
        const appointmentsToday = await db.collection('appointments')
            .where('date', '>=', today)
            .get();
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon blue"><i data-lucide="activity"></i></div></div>
                <div class="stat-value">${vitalsToday.docs.length}</div>
                <div class="stat-label">Vitals Recorded Today</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon green"><i data-lucide="check-circle"></i></div></div>
                <div class="stat-value">${tasksPending.docs.length}</div>
                <div class="stat-label">Pending Tasks</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon orange"><i data-lucide="calendar-days"></i></div></div>
                <div class="stat-value">${appointmentsToday.docs.length}</div>
                <div class="stat-label">Appointments Today</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon red"><i data-lucide="building-2"></i></div></div>
                <div class="stat-value">On Duty</div>
                <div class="stat-label">Current Status</div>
            </div>
        `;
        
        loadQuickActions([
            { icon: 'clipboard-list', label: 'Record Vitals', link: '../records/vitals.html' },
            { icon: 'calendar-days', label: 'View Appointments', link: '../appointments/index.html' },
            { icon: 'file-text', label: 'Patient Records', link: '../records/index.html' },
            { icon: 'list-todo', label: 'My Tasks', link: '../records/tasks.html' }
        ]);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    async function loadAdminDashboard() {
        const statsGrid = document.getElementById('statsGrid');
        
        const usersSnapshot = await db.collection('users').get();
        const students = usersSnapshot.docs.filter(d => d.data().role === 'student').length;
        const doctors = usersSnapshot.docs.filter(d => d.data().role === 'doctor').length;
        const nurses = usersSnapshot.docs.filter(d => d.data().role === 'nurse').length;
        
        const recordsSnapshot = await db.collection('health_records').get();
        const appointmentsSnapshot = await db.collection('appointments').get();
        
        const pendingUsers = usersSnapshot.docs.filter(d => d.data().status === 'pending_approval').length;
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon blue"><i data-lucide="users"></i></div></div>
                <div class="stat-value">${usersSnapshot.docs.length}</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon green"><i data-lucide="graduation-cap"></i></div></div>
                <div class="stat-value">${students}</div>
                <div class="stat-label">Students</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon orange"><i data-lucide="stethoscope"></i></div></div>
                <div class="stat-value">${doctors + nurses}</div>
                <div class="stat-label">Medical Staff</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon red"><i data-lucide="hourglass"></i></div></div>
                <div class="stat-value">${pendingUsers}</div>
                <div class="stat-label">Pending Approvals</div>
            </div>
        `;
        
        loadQuickActions([
            { icon: 'users', label: 'Manage Users', link: '../admin/users.html' },
            { icon: 'bar-chart-3', label: 'View Reports', link: '../admin/reports.html' },
            { icon: 'settings', label: 'Settings', link: '../admin/settings.html' },
            { icon: 'clipboard-list', label: 'Activity Logs', link: '../admin/logs.html' }
        ]);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    async function loadStudentDashboard() {
        const statsGrid = document.getElementById('statsGrid');
        
        const recordsSnapshot = await db.collection('health_records')
            .where('patientId', '==', currentUser.uid)
            .get();
        
        const appointmentsSnapshot = await db.collection('appointments')
            .where('patientId', '==', currentUser.uid)
            .where('status', 'in', ['scheduled', 'pending'])
            .get();
        
        const prescriptionsSnapshot = await db.collection('prescriptions')
            .where('patientId', '==', currentUser.uid)
            .get();
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon blue"><i data-lucide="file-text"></i></div></div>
                <div class="stat-value">${recordsSnapshot.docs.length}</div>
                <div class="stat-label">Medical Records</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon green"><i data-lucide="calendar-days"></i></div></div>
                <div class="stat-value">${appointmentsSnapshot.docs.length}</div>
                <div class="stat-label">Upcoming Appointments</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon orange"><i data-lucide="pill"></i></div></div>
                <div class="stat-value">${prescriptionsSnapshot.docs.length}</div>
                <div class="stat-label">Prescriptions</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><div class="stat-icon red"><i data-lucide="graduation-cap"></i></div></div>
                <div class="stat-value">${userData.level || 'N/A'}</div>
                <div class="stat-label">Academic Level</div>
            </div>
        `;
        
        loadQuickActions([
            { icon: 'calendar-plus', label: 'Book Appointment', link: '../appointments/create.html' },
            { icon: 'file-text', label: 'My Records', link: '../records/my-records.html' },
            { icon: 'pill', label: 'Prescriptions', link: '../records/my-prescriptions.html' },
            { icon: 'settings-2', label: 'Settings', link: '../settings/index.html' }
        ]);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    async function loadRecentActivity() {
        const activityList = document.getElementById('activityList');
        
        let query = db.collection('activity_logs')
            .where('userId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc')
            .limit(5);
        
        if (userData.role === 'admin') {
            query = db.collection('activity_logs')
                .orderBy('timestamp', 'desc')
                .limit(10);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            activityList.innerHTML = '<li class="activity-item"><div class="empty-state"><p>No recent activity</p></div></li>';
            return;
        }
        
        activityList.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `
                <li class="activity-item">
                    <div class="activity-avatar"><i data-lucide="${getActivityIcon(data.type)}"></i></div>
                    <div class="activity-content">
                        <div class="activity-text">${data.description}</div>
                        <div class="activity-time">${formatTimestamp(data.timestamp)}</div>
                    </div>
                </li>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    function loadQuickActions(actions) {
        const container = document.getElementById('quickActions');
        container.innerHTML = actions.map(action => `
            <a href="${action.link}" class="quick-action-btn">
                <i data-lucide="${action.icon}"></i>
                <span class="quick-action-label">${action.label}</span>
            </a>
        `).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    function getActivityIcon(type) {
        const icons = {
            login: 'log-in',
            signup: 'user-plus',
            'record-create': 'file-plus',
            'record-update': 'file-edit',
            'appointment-book': 'calendar-plus',
            'prescription-create': 'pill',
            logout: 'log-out'
        };
        return icons[type] || 'file-text';
    }
    
    async function loadDashboardAppointments() {
        const table = document.getElementById('appointmentsTable');
        if (!table) return;

        const today = new Date().toISOString().split('T')[0];
        let query;

        if (userData.role === 'student') {
            query = db.collection('appointments')
                .where('patientId', '==', currentUser.uid)
                .where('date', '>=', today)
                .orderBy('date')
                .limit(5);
        } else if (userData.role === 'doctor') {
            query = db.collection('appointments')
                .where('doctorId', '==', currentUser.uid)
                .where('date', '>=', today)
                .orderBy('date')
                .limit(5);
        } else {
            query = db.collection('appointments')
                .where('date', '>=', today)
                .orderBy('date')
                .limit(5);
        }

        const snapshot = await query.get();
        const tbody = table.querySelector('tbody') || table;

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>No upcoming appointments</p></td></tr>';
            return;
        }

        const userIds = new Set();
        snapshot.docs.forEach(d => {
            const data = d.data();
            if (data.patientId) userIds.add(data.patientId);
            if (data.doctorId) userIds.add(data.doctorId);
        });

        const usersCache = {};
        for (const id of userIds) {
            const uDoc = await db.collection('users').doc(id).get();
            usersCache[id] = uDoc.exists ? uDoc.data() : null;
        }

        tbody.innerHTML = snapshot.docs.map(doc => {
            const apt = doc.data();
            const patient = usersCache[apt.patientId];
            const doctor = usersCache[apt.doctorId];
            const statusClass = apt.status === 'confirmed' ? 'success' : apt.status === 'pending' ? 'warning' : apt.status === 'cancelled' ? 'danger' : 'info';

            return `
                <tr>
                    <td>${patient ? `${patient.firstName} ${patient.lastName}` : 'N/A'}</td>
                    <td>${formatDate(apt.date)}</td>
                    <td>${apt.time || 'N/A'}</td>
                    <td><span class="badge badge-${statusClass}">${apt.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="viewAppointment('${doc.id}')"><i data-lucide="eye" style="width:14px;height:14px"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    async function loadNotifications() {
        const notifList = document.getElementById('notificationList');
        const notifDot = document.getElementById('notifDot');
        
        const snapshot = await db.collection('notifications')
            .where('userId', '==', currentUser.uid)
            .where('read', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        if (snapshot.empty) {
            notifList.innerHTML = '<div class="empty-state"><p>No notifications</p></div>';
            notifDot.style.display = 'none';
            return;
        }
        
        notifDot.style.display = 'block';
        
        notifList.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `
                <div class="notification-item unread" onclick="markNotificationRead('${doc.id}')">
                    <div class="notification-title">${data.title}</div>
                    <div class="notification-desc">${data.message}</div>
                    <div class="notification-time">${formatTimestamp(data.createdAt)}</div>
                </div>
            `;
        }).join('');
    }
    
    function setupSearch() {
        const searchInput = document.getElementById('globalSearch');
        let searchTimeout;
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performGlobalSearch(e.target.value);
            }, 500);
        });
    }
    
    async function performGlobalSearch(query) {
        if (!query || query.length < 2) return;
        
        try {
            const patientsSnapshot = await db.collection('users')
                .where('role', '==', 'student')
                .get();
            
            const results = patientsSnapshot.docs.filter(doc => {
                const data = doc.data();
                const name = `${data.firstName} ${data.lastName}`.toLowerCase();
                const email = data.email.toLowerCase();
                const search = query.toLowerCase();
                return name.includes(search) || email.includes(search) || (data.studentId && data.studentId.toLowerCase().includes(search));
            });
            
            console.log('Search results:', results);
        } catch (error) {
            console.error('Search error:', error);
        }
    }
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function toggleNotifications() {
    document.getElementById('notificationPanel').classList.toggle('active');
}

function toggleChat() {
    const widget = document.getElementById('chatWidget');
    widget.style.display = widget.style.display === 'none' ? 'flex' : 'none';
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const messages = document.getElementById('chatMessages');
    
    if (!input.value.trim()) return;
    
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.textContent = input.value;
    messages.appendChild(userMsg);
    
    setTimeout(() => {
        const botMsg = document.createElement('div');
        botMsg.className = 'chat-message bot';
        botMsg.textContent = 'I can help with health records inquiries. For specific medical advice, please consult your doctor.';
        messages.appendChild(botMsg);
        messages.scrollTop = messages.scrollHeight;
    }, 1000);
    
    input.value = '';
    messages.scrollTop = messages.scrollHeight;
}

async function markNotificationRead(id) {
    try {
        await db.collection('notifications').doc(id).update({ read: true });
        loadNotifications();
    } catch (error) {
        console.error('Error marking notification:', error);
    }
}

async function viewAppointment(id) {
    const doc = await db.collection('appointments').doc(id).get();
    if (!doc.exists) return;
    
    const apt = doc.data();
    const patientDoc = await db.collection('users').doc(apt.patientId).get();
    const doctorDoc = await db.collection('users').doc(apt.doctorId).get();
    const patient = patientDoc.exists ? patientDoc.data() : null;
    const doctor = doctorDoc.exists ? doctorDoc.data() : null;
    
    const content = document.getElementById('viewAppointmentContent');
    if (content) {
        content.innerHTML = `
            <div style="display:grid;gap:16px">
                <div><strong>Patient:</strong> ${patient ? `${patient.firstName} ${patient.lastName}` : 'N/A'}</div>
                <div><strong>Doctor:</strong> ${doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'N/A'}</div>
                <div><strong>Date:</strong> ${formatDate(apt.date)}</div>
                <div><strong>Time:</strong> ${apt.time || 'N/A'}</div>
                <div><strong>Type:</strong> ${apt.type}</div>
                <div><strong>Status:</strong> <span class="badge badge-${apt.status === 'confirmed' ? 'success' : apt.status === 'pending' ? 'warning' : apt.status === 'cancelled' ? 'danger' : 'info'}">${apt.status}</span></div>
                <div><strong>Notes:</strong> ${apt.notes || 'None'}</div>
            </div>
        `;
        document.getElementById('viewAppointmentModal').classList.add('active');
    } else {
        alert(`Appointment: ${apt.type}\nPatient: ${patient ? `${patient.firstName} ${patient.lastName}` : 'N/A'}\nDoctor: ${doctor ? `Dr. ${doctor.firstName}` : 'N/A'}\nDate: ${formatDate(apt.date)}\nTime: ${apt.time || 'N/A'}\nStatus: ${apt.status}\nNotes: ${apt.notes || 'None'}`);
    }
}
