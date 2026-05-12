const PAGE_ROLE_MAP = {
    'dashboard/index': ['student', 'doctor', 'nurse', 'admin'],
    'admin/users': ['admin'],
    'admin/reports': ['admin'],
    'admin/logs': ['admin'],
    'admin/settings': ['admin'],
    'admin/create-user': ['admin'],
    'records/my-records': ['student'],
    'records/my-prescriptions': ['student'],
    'records/my-vitals': ['student'],
    'records/index': ['doctor', 'nurse', 'admin'],
    'records/patient-list': ['doctor', 'nurse', 'admin'],
    'records/prescriptions': ['student', 'doctor', 'nurse', 'admin'],
    'records/lab-results': ['doctor', 'nurse', 'admin'],
    'records/vitals': ['doctor', 'nurse', 'admin'],
    'records/tasks': ['nurse', 'admin'],
    'appointments/index': ['student', 'doctor', 'nurse', 'admin'],
    'appointments/create': ['student', 'doctor', 'nurse', 'admin'],
    'pharmacy/index': ['doctor', 'nurse', 'admin'],
    'pharmacy/inventory': ['doctor', 'nurse', 'admin'],
    'settings/index': ['student', 'doctor', 'nurse', 'admin'],
    'settings/profile-form': ['student', 'doctor', 'nurse', 'admin'],
    'messages/index': ['student', 'doctor', 'nurse', 'admin']
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

                resolve({ user, userData });
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