document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const studentFields = document.getElementById('studentFields');
    const staffFields = document.getElementById('staffFields');
    const roleSelect = document.getElementById('role');
    const doctorFields = document.getElementById('doctorFields');
    
    let currentTab = 'student';
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            
            if (currentTab === 'student') {
                studentFields.style.display = 'block';
                staffFields.style.display = 'none';
            } else {
                studentFields.style.display = 'none';
                staffFields.style.display = 'block';
            }
        });
    });
    
    if (roleSelect) {
        roleSelect.addEventListener('change', () => {
            doctorFields.style.display = roleSelect.value === 'doctor' ? 'block' : 'none';
        });
    }
    
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        clearErrors();
        
        const firstName = sanitizeInput(document.getElementById('firstName').value.trim());
        const lastName = sanitizeInput(document.getElementById('lastName').value.trim());
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const phone = sanitizeInput(document.getElementById('phone').value.trim());
        
        let errors = [];
        
        if (!firstName) errors.push({ field: 'firstName', message: 'First name is required' });
        if (!lastName) errors.push({ field: 'lastName', message: 'Last name is required' });
        if (!validateEmail(email)) errors.push({ field: 'email', message: 'Please enter a valid email' });
        if (!validatePassword(password)) errors.push({ field: 'password', message: 'Password does not meet requirements' });
        if (password !== confirmPassword) errors.push({ field: 'confirmPassword', message: 'Passwords do not match' });
        
        const userData = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: password,
            confirmPassword: confirmPassword,
            phone: phone,
            role: currentTab === 'student' ? 'student' : 'staff'
        };
        
        if (currentTab === 'student') {
            const studentId = sanitizeInput(document.getElementById('studentId').value.trim());
            const department = document.getElementById('department').value;
            const level = document.getElementById('level').value;
            
            if (!studentId) errors.push({ field: 'studentId', message: 'Student ID is required' });
            
            userData.studentId = studentId;
            userData.department = department;
            userData.level = level;
            userData.role = 'student';
        } else {
            const role = document.getElementById('role').value;
            const staffId = sanitizeInput(document.getElementById('staffId').value.trim());
            
            if (!role) errors.push({ field: 'role', message: 'Role is required' });
            if (!staffId) errors.push({ field: 'staffId', message: 'Staff ID is required' });
            
            userData.role = role;
            userData.staffId = staffId;
            
            if (role === 'doctor') {
                userData.specialization = document.getElementById('specialization').value;
                userData.licenseNumber = sanitizeInput(document.getElementById('licenseNumber').value.trim());
            }
        }
        
        if (!document.getElementById('terms').checked) {
            errors.push({ field: 'terms', message: 'You must agree to the terms' });
        }
        
        if (errors.length > 0) {
            errors.forEach(err => {
                showError(err.field, err.message);
            });
            return;
        }
        
        setButtonLoading('signupBtn', true);
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            await user.updateProfile({
                displayName: `${firstName} ${lastName}`
            });
            
            await user.sendEmailVerification();
            
            const userDoc = {
                firstName: firstName,
                lastName: lastName,
                email: email,
                phone: phone || '',
                role: userData.role,
                status: currentTab === 'student' ? 'active' : 'pending_approval',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                emailVerified: false
            };
            
            if (currentTab === 'student') {
                userDoc.studentId = userData.studentId;
                userDoc.department = userData.department || '';
                userDoc.level = userData.level || '';
            } else {
                userDoc.staffId = userData.staffId;
                userDoc.specialization = userData.specialization || '';
                userDoc.licenseNumber = userData.licenseNumber || '';
            }
            
            await db.collection('users').doc(user.uid).set(userDoc);
            
            await logActivity(user.uid, 'signup', 'New user registered');
            
            if (currentTab === 'student') {
                showAlert('signupAlert', 'Account created! Please check your email to verify your account.', 'success');
                setTimeout(() => { window.location.href = 'verify-email.html'; }, 2000);
            } else {
                showAlert('signupAlert', 'Account created! Please wait for admin approval.', 'success');
                setTimeout(() => { window.location.href = 'pending-approval.html'; }, 2000);
            }
            
        } catch (error) {
            console.error('Signup error:', error);
            let message = 'Registration failed';
            
            if (error.code === 'auth/email-already-in-use') {
                message = 'This email is already registered';
            } else if (error.code === 'auth/weak-password') {
                message = 'Password is too weak';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Invalid email format';
            }
            
            showAlert('signupAlert', message, 'error');
        } finally {
            setButtonLoading('signupBtn', false);
        }
    });
    
    function clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    }
});
