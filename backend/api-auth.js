const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const { signToken } = require('./middleware');
const { getUserByEmail, getUserById, lookupUserById, createAuthUser, createFirebaseUser, setFirebaseClaims, getDocument, setDocument, updateAuthUser, setResetToken, getUserByResetToken, clearResetToken, getNextSequence } = require('./database');
const { sendResetEmail } = require('./mailer');

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

async function signin(req, res) {
    try {
        const { email, userId, password } = req.body || {};
        if (!password) {
            return res.status(400).json({ error: 'Password required', code: 'auth/missing-credentials' });
        }
        if (!email && !userId) {
            return res.status(400).json({ error: 'Email or ID required', code: 'auth/missing-credentials' });
        }

        let user = null;
        let authRecord = null;

        if (email && !userId) {
            authRecord = await getUserByEmail(email.trim().toLowerCase());
            if (!authRecord) {
                return res.status(401).json({ error: 'Invalid email or password', code: 'auth/user-not-found' });
            }
        } else {
            const profileDoc = await lookupUserById(userId.trim());
            if (!profileDoc) {
                return res.status(401).json({ error: 'No account found with this ID', code: 'auth/user-not-found' });
            }
            if (profileDoc.role === 'admin' || profileDoc.role === 'administrator') {
                return res.status(403).json({ error: 'Admin accounts must use email login', code: 'auth/admin-requires-email' });
            }
            if (!profileDoc.email) {
                return res.status(400).json({ error: 'Account has no email on file. Contact admin.', code: 'auth/no-email' });
            }
            authRecord = await getUserByEmail(profileDoc.email);
            if (!authRecord) {
                return res.status(401).json({ error: 'Invalid ID or password', code: 'auth/user-not-found' });
            }
        }

        const valid = bcrypt.compareSync(password, authRecord.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials', code: 'auth/wrong-password' });
        }

        const token = signToken(authRecord);
        let userDoc = await getDocument('users', authRecord.uid);
        let userData = null;
        if (userDoc) {
            try { userData = JSON.parse(userDoc.data); } catch {}
        }
        if (!userData) {
            userData = { email: authRecord.email, role: authRecord.role };
        }
        userData.lastLogin = new Date().toISOString();
        await setDocument('users', authRecord.uid, userData, true);
        return res.json({
            localId: authRecord.uid,
            email: authRecord.email,
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
        const { email, url } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: 'Email required', code: 'auth/missing-email' });
        }

        const authRecord = await getUserByEmail(email.trim().toLowerCase());
        if (!authRecord) {
            return res.json({ message: 'If the email exists, a reset link has been sent' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = Date.now() + RESET_TOKEN_TTL_MS;
        await setResetToken(authRecord.uid, sha256(token), expiry);

        const baseUrl = (url && url.trim()) || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const resetLink = `${baseUrl.replace(/\/+$/, '')}/src/auth/reset-password.html?mode=resetPassword&oobCode=${token}`;

        try {
            await sendResetEmail(authRecord.email, resetLink);
        } catch (mailErr) {
            console.error('[resetPassword] Email send failed:', mailErr);
        }

        return res.json({ message: 'If the email exists, a reset link has been sent' });
    } catch (err) {
        console.error('[resetPassword] ERROR:', err);
        return res.status(500).json({ error: err.message, code: 'auth/internal-error' });
    }
}

async function verifyResetCode(req, res) {
    try {
        const { oobCode } = req.body || {};
        if (!oobCode) {
            return res.status(400).json({ error: 'Reset code required', code: 'auth/invalid-action-code' });
        }

        const authRecord = await getUserByResetToken(sha256(oobCode));
        if (!authRecord) {
            return res.status(400).json({ error: 'Reset link is invalid', code: 'auth/invalid-action-code' });
        }
        if (!authRecord.resetTokenExpiry || Date.now() > authRecord.resetTokenExpiry) {
            return res.status(400).json({ error: 'Reset link has expired', code: 'auth/expired-action-code' });
        }

        return res.json({ email: authRecord.email });
    } catch (err) {
        console.error('[verifyResetCode] ERROR:', err);
        return res.status(500).json({ error: err.message, code: 'auth/internal-error' });
    }
}

async function confirmResetPassword(req, res) {
    try {
        const { oobCode, newPassword } = req.body || {};
        if (!oobCode || !newPassword) {
            return res.status(400).json({ error: 'Reset code and new password required', code: 'auth/missing-credentials' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters', code: 'auth/weak-password' });
        }

        const authRecord = await getUserByResetToken(sha256(oobCode));
        if (!authRecord) {
            return res.status(400).json({ error: 'Reset link is invalid', code: 'auth/invalid-action-code' });
        }
        if (!authRecord.resetTokenExpiry || Date.now() > authRecord.resetTokenExpiry) {
            return res.status(400).json({ error: 'Reset link has expired', code: 'auth/expired-action-code' });
        }

        await updateAuthUser(authRecord.uid, { password: newPassword });
        await clearResetToken(authRecord.uid);

        try {
            await admin.auth().updateUser(authRecord.uid, { password: newPassword });
        } catch (e) {
            console.warn('[confirmResetPassword] Firebase Auth password update skipped:', e.message);
        }

        return res.json({ message: 'Password reset successful' });
    } catch (err) {
        console.error('[confirmResetPassword] ERROR:', err);
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

async function adminCreateUser(req, res) {
    try {
        const { email, password, role, displayName, profileData } = req.body || {};
        if (!email || !password || !role) {
            return res.status(400).json({ error: 'email, password, and role required' });
        }

        const existing = await getUserByEmail(email.trim().toLowerCase());
        if (existing) {
            return res.status(409).json({ error: 'Email already registered', code: 'auth/email-already-exists' });
        }

        const fbUser = await createFirebaseUser(email, password, displayName || '');
        const uid = fbUser.uid;

        await setFirebaseClaims(uid, { role });

        await createAuthUser(uid, email, password, role);

        if (profileData) {
            if (profileData.studentId) profileData.studentId = String(profileData.studentId).trim().toUpperCase();
            if (profileData.staffId) profileData.staffId = String(profileData.staffId).trim().toUpperCase();
        }
        if (role === 'student' && profileData && profileData.faculty === 'JUPEB' && !(profileData.studentId && profileData.studentId.trim())) {
            const seq = await getNextSequence('jupeb_student');
            profileData.studentId = 'JUPEB/' + String(seq).padStart(3, '0');
        }

        const userData = {
            email: email.trim().toLowerCase(),
            role,
            displayName: displayName || '',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...profileData
        };
        await setDocument('users', uid, userData);

        return res.json({ uid, email: email.trim().toLowerCase(), role });
    } catch (err) {
        console.error('[adminCreateUser] ERROR:', err);
        return res.status(500).json({ error: err.message });
    }
}

async function exchangeToken(req, res) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized', code: 'auth/missing-token' });
        }
        const firebaseToken = header.slice(7);
        const decoded = await admin.auth().verifyIdToken(firebaseToken);
        const user = await getUserById(decoded.uid);
        if (!user) {
            return res.status(404).json({ error: 'User not found in auth system', code: 'auth/user-not-found' });
        }
        const token = signToken(user);
        return res.json({ idToken: token, refreshToken: token, localId: user.uid, email: user.email });
    } catch (err) {
        console.error('[exchangeToken] ERROR:', err.message);
        return res.status(401).json({ error: 'Invalid or expired token', code: 'auth/invalid-token' });
    }
}

async function lookupById(req, res) {
    try {
        const { userId } = req.query || {};
        if (!userId || !userId.trim()) {
            return res.status(400).json({ error: 'userId query parameter required' });
        }
        const profileDoc = await lookupUserById(userId.trim());
        if (!profileDoc) {
            return res.status(404).json({ error: 'No account found with this ID' });
        }
        return res.json({
            uid: profileDoc.uid,
            email: profileDoc.email || null,
            role: profileDoc.role || null,
            displayName: profileDoc.displayName || null,
            status: profileDoc.status || null,
            studentId: profileDoc.studentId || null,
            staffId: profileDoc.staffId || null
        });
    } catch (err) {
        console.error('[lookupById] ERROR:', err);
        return res.status(500).json({ error: err.message });
    }
}

module.exports = { signin, signup, me, refreshToken, resetPassword, verifyResetCode, confirmResetPassword, changePassword, deleteAccount, lookupById, adminCreateUser, exchangeToken };
