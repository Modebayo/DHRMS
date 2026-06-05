document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    auth.onAuthStateChanged(async (user) => {
        if (!user) return;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (!doc.exists) { await auth.signOut(); return; }

            const userData = doc.data();
            if (userData.status === 'suspended') {
                showAlert('loginAlert', 'Your account has been suspended. Contact admin.', 'error');
                await auth.signOut(); return;
            }
            if (userData.status === 'pending_approval') {
                showAlert('loginAlert', 'Your account is pending approval.', 'warning');
                await auth.signOut(); return;
            }

            showToast('Already logged in!', 'info');
            redirectUser(userData.role);
        } catch (error) {
            console.error('Auth state error:', error);
        }
    });

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        document.getElementById('emailError').textContent = '';
        document.getElementById('passwordError').textContent = '';
        document.getElementById('loginAlert').style.display = 'none';

        if (!email || !password) {
            showAlert('loginAlert', 'Please fill in all fields', 'error');
            return;
        }

        const loginBtn = document.getElementById('loginBtn');
        loginBtn.querySelector('.btn-text').style.display = 'none';
        loginBtn.querySelector('.spinner').style.display = 'inline-block';
        loginBtn.disabled = true;

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                showAlert('loginAlert', 'Account not found. Contact admin.', 'error');
                await auth.signOut(); return;
            }

            const userData = userDoc.data();

            if (userData.status === 'suspended') {
                showAlert('loginAlert', 'Account suspended.', 'error');
                await auth.signOut(); return;
            }
            if (userData.status === 'pending_approval') {
                showAlert('loginAlert', 'Account pending approval.', 'warning');
                await auth.signOut(); return;
            }

            initUserKeys(user, password).catch(() => {});

            db.collection('users').doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});

            showToast('Login successful!', 'success');
            logActivity(user.uid, 'login', `Logged in as ${userData.role}`).catch(() => {});

            setTimeout(() => redirectUser(userData.role), 800);

        } catch (error) {
            console.error('Login error:', error);
            let message = 'Invalid email or password';
            if (error.code === 'auth/user-not-found') message = 'No account found with this email';
            else if (error.code === 'auth/wrong-password') message = 'Incorrect password';
            else if (error.code === 'auth/too-many-requests') message = 'Too many attempts. Try again later.';
            else if (error.code === 'auth/network-request-failed') message = 'Network error. Check your connection.';
            else if (error.code === 'auth/invalid-email') message = 'Invalid email address format.';
            showAlert('loginAlert', message, 'error');
        } finally {
            const btn = document.getElementById('loginBtn');
            if (btn) {
                const bt = btn.querySelector('.btn-text');
                const sp = btn.querySelector('.spinner');
                if (bt) bt.style.display = 'inline';
                if (sp) sp.style.display = 'none';
                btn.disabled = false;
            }
        }
    });
});

function redirectUser(role) {
    const map = {
        'student': '../dashboard/index.html',
        'doctor': '../dashboard/index.html',
        'nurse': '../dashboard/index.html',
        'pharmacist': '../dashboard/index.html',
        'lab_technician': '../dashboard/index.html',
        'records_officer': '../dashboard/index.html',
        'admin': '../dashboard/index.html',
        'administrator': '../dashboard/index.html'
    };
    window.location.href = map[role] || '../dashboard/index.html';
}

async function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            await auth.signOut();
            showAlert('loginAlert', 'Google account not registered.', 'error');
            return;
        }

        const userData = userDoc.data();
        if (userData.status === 'suspended') {
            await auth.signOut();
            showAlert('loginAlert', 'Account suspended.', 'error');
            return;
        }
        if (userData.status === 'pending_approval') {
            await auth.signOut();
            showAlert('loginAlert', 'Account pending approval.', 'warning');
            return;
        }

        showToast('Login successful!', 'success');
        logActivity(user.uid, 'login', `Logged in via Google as ${userData.role}`).catch(() => {});
        setTimeout(() => redirectUser(userData.role), 500);

    } catch (error) {
        console.error('Google login error:', error);
        showAlert('loginAlert', 'Google login failed: ' + error.message, 'error');
    }
}
