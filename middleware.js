const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = '24h';
const { getUserById } = require('./database');

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

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', code: 'auth/missing-token' });
    }
    const token = header.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
        return res.status(401).json({ error: 'Token expired or invalid', code: 'auth/invalid-token' });
    }
    const user = getUserById(payload.sub);
    if (!user) {
        return res.status(401).json({ error: 'User not found', code: 'auth/user-not-found' });
    }
    req.user = user;
    req.userData = { uid: user.uid, email: user.email, role: user.role };
    next();
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
