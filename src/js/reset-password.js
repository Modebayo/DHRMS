document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('resetForm');
    
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        document.getElementById('emailError').textContent = '';
        document.getElementById('resetAlert').style.display = 'none';
        
        if (!validateEmail(email)) {
            document.getElementById('emailError').textContent = 'Please enter a valid email';
            return;
        }
        
        setButtonLoading('resetBtn', true);
        
        try {
            await auth.sendPasswordResetEmail(email);
            
            const alert = document.getElementById('resetAlert');
            alert.textContent = 'Password reset link sent! Check your email.';
            alert.className = 'alert alert-success';
            alert.style.display = 'block';
            
        } catch (error) {
            let message = 'Failed to send reset email';
            if (error.code === 'auth/user-not-found') {
                message = 'No account found with this email';
            }
            
            const alert = document.getElementById('resetAlert');
            alert.textContent = message;
            alert.className = 'alert alert-error';
            alert.style.display = 'block';
        } finally {
            setButtonLoading('resetBtn', false);
        }
    });
});
