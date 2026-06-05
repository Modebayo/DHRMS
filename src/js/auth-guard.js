const ADMIN_ROLES = ['administrator', 'admin'];

const PAGE_ROLE_MAP = {
    'dashboard/index': ['student', 'doctor', 'nurse', ...ADMIN_ROLES, 'pharmacist', 'lab_technician', 'records_officer'],
    'admin/users': ADMIN_ROLES,
    'admin/reports': ADMIN_ROLES,
    'admin/logs': ADMIN_ROLES,
    'admin/settings': ADMIN_ROLES,
    'admin/create-user': ADMIN_ROLES,
    'records/my-records': ['student'],
    'records/my-prescriptions': ['student'],
    'records/my-vitals': ['student'],
    'records/index': ['doctor', 'nurse', ...ADMIN_ROLES],
    'records/patient-list': ['doctor', 'nurse', ...ADMIN_ROLES, 'records_officer'],
    'records/prescriptions': ['student', 'doctor', 'nurse', ...ADMIN_ROLES, 'pharmacist'],
    'records/lab-results': ['doctor', 'nurse', ...ADMIN_ROLES, 'lab_technician'],
    'records/lab-requests': ['doctor', 'nurse', ...ADMIN_ROLES, 'lab_technician'],
    'records/vitals': ['doctor', 'nurse', ...ADMIN_ROLES],
    'records/tasks': ['nurse', ...ADMIN_ROLES],
    'records/patients': ['doctor', 'nurse', ...ADMIN_ROLES, 'records_officer', 'pharmacist', 'lab_technician'],
    'records/patient-registration': ['nurse', ...ADMIN_ROLES, 'records_officer'],
    'records/add-consultation': ['doctor', 'nurse', ...ADMIN_ROLES],
    'records/add-diagnosis': ['doctor', ...ADMIN_ROLES],
    'records/my-visits': ['student'],
    'records/treatment': ['doctor', 'nurse', ...ADMIN_ROLES],
    'admin/index': ADMIN_ROLES,
    'records/visit-workflow': ['doctor', 'nurse', ...ADMIN_ROLES],
    'appointments/index': ['student', 'doctor', 'nurse', ...ADMIN_ROLES, 'records_officer'],
    'appointments/create': ['student', 'doctor', 'nurse', ...ADMIN_ROLES, 'records_officer'],
    'pharmacy/index': ['doctor', 'nurse', ...ADMIN_ROLES, 'pharmacist'],
    'pharmacy/inventory': ['doctor', ...ADMIN_ROLES, 'pharmacist'],
    'settings/index': ['student', 'doctor', 'nurse', ...ADMIN_ROLES, 'pharmacist', 'lab_technician', 'records_officer'],
    'settings/profile-form': ['student', 'doctor', 'nurse', ...ADMIN_ROLES, 'pharmacist', 'lab_technician', 'records_officer'],
    'messages/index': ['student', 'doctor', 'nurse', ...ADMIN_ROLES, 'pharmacist', 'lab_technician', 'records_officer'],
    'treatment-requests/create': ['student'],
    'treatment-requests/my-requests': ['student'],
    'treatment-requests/nurse-queue': ['nurse'],
    'treatment-requests/triage': ['nurse'],
    'treatment-requests/doctor-queue': ['doctor'],
    'treatment-requests/review': ['doctor'],
    'treatment-requests/dispense': ['nurse', 'doctor']
};

async function guardPage(allowedRoles = null) {
    return new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            unsubscribe();
            
            if (!user) {
                window.location.href = '../auth/login.html';
                resolve(null);
                return;
            }

            try {
                const doc = await db.collection('users').doc(user.uid).get();
                
                if (!doc.exists) {
                    window.location.href = '../auth/login.html';
                    resolve(null);
                    return;
                }

                const userData = doc.data();
                const userRole = userData.role;

                if (userData.status === 'suspended') {
                    await auth.signOut();
                    window.location.href = '../auth/login.html';
                    resolve(null);
                    return;
                }

                if (userData.status === 'pending_approval') {
                    await auth.signOut();
                    window.location.href = '../auth/pending-approval.html';
                    resolve(null);
                    return;
                }

                if (allowedRoles && !allowedRoles.includes(userRole)) {
                    window.location.href = '../dashboard/index.html';
                    resolve(null);
                    return;
                }

                if (!allowedRoles) {
                    const path = window.location.pathname;
                    let pageKey = null;

                    for (const [key, roles] of Object.entries(PAGE_ROLE_MAP)) {
                        if (path.includes(key)) {
                            pageKey = key;
                            break;
                        }
                    }

                    if (pageKey) {
                        const pageRoles = PAGE_ROLE_MAP[pageKey];
                        if (!pageRoles.includes(userRole)) {
                            window.location.href = '../dashboard/index.html';
                            resolve(null);
                            return;
                        }
                    }
                }

                resolve({ user, userData, isReadOnly: userData.status === 'inactive' });
            } catch (error) {
                console.error('Auth guard error:', error);
                resolve(null);
            }
        });
    });
}

async function checkAuthState() {
    return new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

// =====================================================
// 30-minute inactivity timeout (NFR03)
// =====================================================
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

let inactivityTimer = null;

function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(handleInactivityTimeout, INACTIVITY_TIMEOUT_MS);
}

async function handleInactivityTimeout() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const uid = user.uid;
        await logAuditEvent(uid, 'SESSION_TIMEOUT', '', '', 'Session timed out after 30 minutes of inactivity');
        await auth.signOut();
        showToast('Session timed out due to inactivity. Please log in again.', 'warning');
        setTimeout(() => {
            window.location.href = '../auth/login.html';
        }, 1000);
    } catch (error) {
        console.error('Inactivity timeout error:', error);
    }
}

function initInactivityMonitor() {
    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll', 'click', 'focus'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();
}

function stopInactivityMonitor() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = null;
}

// Auto-initialize on pages that use auth guard
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initInactivityMonitor();
    });
} else {
    initInactivityMonitor();
}