const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { signToken } = require('./middleware');
const { getUserByEmail, getUserById, createAuthUser, getDocument, setDocument } = require('./database');

const BCRYPT_ROUNDS = 12;

async function signin(req, res) {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required', code: 'auth/missing-credentials' });
        }
        const user = await getUserByEmail(email.trim().toLowerCase());
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password', code: 'auth/user-not-found' });
        }
        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password', code: 'auth/wrong-password' });
        }
        const token = signToken(user);
        let userDoc = await getDocument('users', user.uid);
        let userData = null;
        if (userDoc) {
            try { userData = JSON.parse(userDoc.data); } catch {}
        }
        if (!userData) {
            userData = { email: user.email, role: user.role };
        }
        userData.lastLogin = new Date().toISOString();
        await setDocument('users', user.uid, userData, true);
        return res.json({
            localId: user.uid,
            email: user.email,
            idToken: token,
            refreshToken: token,
            registered: true,
            user: userData
        });
    } catch (err) {
        console.error('[signin] ERROR:', err);
        return res.status(500).json({ error: err.message, code: 'auth/internal-error' });
    }
}

async function signup(req, res) {
    try {
        const { email, password, displayName, role } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required', code: 'auth/missing-credentials' });
        }
        const existing = await getUserByEmail(email.trim().toLowerCase());
        if (existing) {
            return res.status(409).json({ error: 'Email already registered', code: 'auth/email-already-exists' });
        }
        const uid = uuidv4();
        const userRole = role || 'student';
        await createAuthUser(uid, email.trim().toLowerCase(), password, userRole);
        const userData = {
            uid,
            email: email.trim().toLowerCase(),
            role: userRole,
            displayName: displayName || '',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await setDocument('users', uid, userData);
        const token = signToken({ uid, email: email.trim().toLowerCase(), role: userRole });
        return res.json({
            localId: uid,
            email: email.trim().toLowerCase(),
            idToken: token,
            refreshToken: token,
            user: userData
        });
    } catch (err) {
        console.error('[signup] ERROR:', err);
        return res.status(500).json({ error: err.message, code: 'auth/internal-error' });
    }
}

async function me(req, res) {
    try {
        const user = await getUserById(req.user.uid);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'auth/user-not-found' });
        }
        let userDoc = await getDocument('users', user.uid);
        let userData = null;
        if (userDoc) {
            try { userData = JSON.parse(userDoc.data); } catch {}
        }
        if (!userData) {
            userData = { email: user.email, role: user.role };
        }
        return res.json({
            uid: user.uid,
            email: user.email,
            role: user.role,
            user: userData
        });
    } catch (err) {
        console.error('[me] ERROR:', err);
        return res.status(500).json({ error: err.message, code: 'auth/internal-error' });
    }
}

function refreshToken(req, res) {
    const { refreshToken: token } = req.body || {};
    if (!token) {
        return res.status(400).json({ error: 'Refresh token required', code: 'auth/missing-token' });
    }
    const { verifyToken } = require('./middleware');
    const payload = verifyToken(token);
    if (!payload) {
        return res.status(401).json({ error: 'Invalid token', code: 'auth/invalid-token' });
    }
    getUserById(payload.sub).then(user => {
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'auth/user-not-found' });
        }
        const newToken = signToken(user);
        return res.json({ idToken: newToken, refreshToken: newToken });
    }).catch(err => {
        console.error('[refreshToken] ERROR:', err);
        return res.status(500).json({ error: err.message, code: 'auth/internal-error' });
    });
}

async function resetPassword(req, res) {
    try {
        const { email } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: 'Email required', code: 'auth/missing-email' });
        }
        await getUserByEmail(email.trim().toLowerCase());
        return res.status(200).json({ message: 'If the email exists, a reset link would be sent' });
    } catch (err) {
        console.error('[resetPassword] ERROR:', err);
        return res.status(500).json({ error: err.message, code: 'auth/internal-error' });
    }
}

async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required', code: 'auth/missing-credentials' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters', code: 'auth/weak-password' });
        }
        const user = await getUserById(req.user.uid);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'auth/user-not-found' });
        }
        const valid = bcrypt.compareSync(currentPassword, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Current password is incorrect', code: 'auth/wrong-password' });
        }
        const { updateAuthUser } = require('./database');
        await updateAuthUser(user.uid, { password: newPassword });
        return res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('[changePassword] ERROR:', err);
        return res.status(500).json({ error: err.message, code: 'auth/internal-error' });
    }
}

async function deleteAccount(req, res) {
    try {
        const user = await getUserById(req.user.uid);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'auth/user-not-found' });
        }
        const { deleteAuthUser, deleteDocument } = require('./database');
        await deleteDocument('users', user.uid);
        await deleteAuthUser(user.uid);
        return res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error('[deleteAccount] ERROR:', err);
        return res.status(500).json({ error: err.message, code: 'auth/internal-error' });
    }
}

module.exports = { signin, signup, me, refreshToken, resetPassword, changePassword, deleteAccount };
