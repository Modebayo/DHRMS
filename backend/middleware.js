const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { getUserById } = require('./database');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    const secretFile = path.join(__dirname, '.jwt_secret');
    try {
        JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
    } catch {
        JWT_SECRET = crypto.randomBytes(64).toString('hex');
        try { fs.writeFileSync(secretFile, JWT_SECRET, 'utf8'); } catch {}
    }
}
const JWT_EXPIRY = '24h';

function signToken(user) {
    return jwt.sign(
        { sub: user.uid, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

async function authMiddleware(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized', code: 'auth/missing-token' });
        }
        const token = header.slice(7);
        const payload = verifyToken(token);
        if (!payload) {
            return res.status(401).json({ error: 'Token expired or invalid', code: 'auth/invalid-token' });
        }
        const user = await getUserById(payload.sub);
        if (!user) {
            return res.status(401).json({ error: 'User not found', code: 'auth/user-not-found' });
        }
        req.user = user;
        req.userData = { uid: user.uid, email: user.email, role: user.role };
        next();
    } catch (err) {
        console.error('[authMiddleware] ERROR:', err);
        return res.status(500).json({ error: 'Internal error', code: 'auth/internal-error' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden', code: 'auth/insufficient-permissions' });
        }
        next();
    };
}

function optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        const token = header.slice(7);
        const payload = verifyToken(token);
        if (payload) {
            const user = getUserById(payload.sub);
            if (user) {
                req.user = user;
                req.userData = { uid: user.uid, email: user.email, role: user.role };
            }
        }
    }
    next();
}

module.exports = {
    JWT_SECRET,
    signToken,
    verifyToken,
    authMiddleware,
    requireRole,
    optionalAuth
};
