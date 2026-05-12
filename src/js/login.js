document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    initTheme();
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                if (!doc.exists) {
                    await auth.signOut();
                    return;
                }
                
                const userData = doc.data();
                
                if (userData.status === 'suspended') {
                    showAlert('loginAlert', 'Your account has been suspended. Contact admin.', 'error');
                    await auth.signOut();
                    return;
                }
                
                await db.collection('users').doc(user.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                showToast('Login successful!', 'success');
                await logActivity(user.uid, 'login', `Logged in as ${userData.role}`);
                
                const redirects = {
                    'student': '../dashboard/index.html',
                    'doctor': '../dashboard/index.html',
                    'nurse': '../dashboard/index.html',
                    'admin': '../dashboard/index.html'
                };
                
                setTimeout(() => {
                    window.location.href = redirects[userData.role] || '../dashboard/index.html';
                }, 1000);
                
            } catch (error) {
                console.error('Auth state error:', error);
            }
        }
    });
    
    loginForm.addEventListener('submit', async (e) => {
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
                    showAlert('loginAlert', 'Account not found in system. Please contact admin.', 'error');
                    await auth.signOut();
                    return;
                }
                
                const userData = userDoc.data();
                
                if (userData.status === 'suspended') {
                    showAlert('loginAlert', 'Your account has been suspended. Contact admin.', 'error');
                    await auth.signOut();
                    return;
                }
                
                const keysReady = await initUserKeys(user, password);
                if (!keysReady) {
                    console.warn('Encryption keys not initialized');
                }
                
                await db.collection('users').doc(user.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                showToast('Login successful!', 'success');
                await logActivity(user.uid, 'login', `Logged in as ${userData.role}`);
                
                const redirects = {
                    'student': '../dashboard/index.html',
                    'doctor': '../dashboard/index.html',
                    'nurse': '../dashboard/index.html',
                    'admin': '../dashboard/index.html'
                };
                
                setTimeout(() => {
                    window.location.href = redirects[userData.role] || '../dashboard/index.html';
                }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            
            let message = 'Invalid email or password';
            if (error.code === 'auth/user-not-found') {
                message = 'No account found with this email';
            } else if (error.code === 'auth/wrong-password') {
                message = 'Incorrect password';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Too many attempts. Try again later';
            } else if (error.code === 'auth/network-request-failed') {
                message = 'Network error. Check your connection';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Invalid email address format';
            }
            
            showAlert('loginAlert', message, 'error');
        } finally {
            loginBtn.querySelector('.btn-text').style.display = 'inline';
            loginBtn.querySelector('.spinner').style.display = 'none';
            loginBtn.disabled = false;
        }
    });
});

async function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            await auth.signOut();
            showAlert('loginAlert', 'Google account not registered. Please contact admin.', 'error');
            return;
        }
        
        const userData = userDoc.data();
        
        if (userData.status === 'suspended') {
            await auth.signOut();
            showAlert('loginAlert', 'Your account has been suspended.', 'error');
            return;
        }
        
        if (userData.publicKey && userData.encryptedPrivateKey) {
            await KeyManager.initKeys(user, '');
        } else {
            console.warn('Google login user has no encryption keys set up by admin');
        }
        
        showToast('Login successful!', 'success');
        await logActivity(user.uid, 'login', `Logged in via Google as ${userData.role}`);
        
        const redirects = {
            'student': '../dashboard/index.html',
            'doctor': '../dashboard/index.html',
            'nurse': '../dashboard/index.html',
            'admin': '../dashboard/index.html'
        };
        
        setTimeout(() => {
            window.location.href = redirects[userData.role] || '../dashboard/index.html';
        }, 1000);
        
    } catch (error) {
        console.error('Google login error:', error);
        showAlert('loginAlert', 'Google login failed: ' + error.message, 'error');
    }
}