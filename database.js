const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const BCRYPT_ROUNDS = 12;

let db = null;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initSchema();
    }
    return db;
}

function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            uid TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'student',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

        CREATE TABLE IF NOT EXISTS documents (
            collection TEXT NOT NULL,
            doc_id TEXT NOT NULL,
            data TEXT NOT NULL DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (collection, doc_id)
        );
        CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection);

        CREATE TABLE IF NOT EXISTS sequences (
            name TEXT PRIMARY KEY,
            value INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS uploads (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            original_name TEXT,
            mime_type TEXT,
            size INTEGER,
            uploaded_by TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
    `);
}

function generatePassword(length = 16) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pw = '';
    for (let i = 0; i < length; i++) {
        pw += chars[crypto.randomInt(chars.length)];
    }
    return pw;
}

function seedAdmin() {
    getDb();
    const existing = db.prepare('SELECT uid FROM users WHERE role = ? LIMIT 1').get('admin');
    const email = 'admin@koladaisi.edu.ng';
    const password = 'Neon10*';
    if (existing) {
        const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
        db.prepare('UPDATE users SET password_hash = ?, email = ? WHERE uid = ?').run(hash, email, existing.uid);
        console.log('Admin password updated to: ' + password);
        return { uid: existing.uid, email, password };
    }

    const uid = crypto.randomUUID();
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

    const insertUser = db.prepare('INSERT INTO users (uid, email, password_hash, role) VALUES (?, ?, ?, ?)');
    const insertDoc = db.prepare('INSERT INTO documents (collection, doc_id, data) VALUES (?, ?, ?)');

    const userData = JSON.stringify({
        email,
        role: 'admin',
        displayName: 'System Admin',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    const transaction = db.transaction(() => {
        insertUser.run(uid, email, hash, 'admin');
        insertDoc.run('users', uid, userData);
    });
    transaction();

    return { uid, email, password };
}

function getUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(uid) {
    return db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
}

function createAuthUser(uid, email, password, role) {
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    db.prepare('INSERT INTO users (uid, email, password_hash, role) VALUES (?, ?, ?, ?)').run(uid, email, hash, role);
    return { uid, email, role };
}

function updateAuthUser(uid, updates) {
    const sets = [];
    const params = [];
    if (updates.email) { sets.push('email = ?'); params.push(updates.email); }
    if (updates.password) { sets.push('password_hash = ?'); params.push(bcrypt.hashSync(updates.password, BCRYPT_ROUNDS)); }
    if (updates.role) { sets.push('role = ?'); params.push(updates.role); }
    if (sets.length === 0) return;
    sets.push('updated_at = datetime(\'now\')');
    params.push(uid);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE uid = ?`).run(...params);
}

function deleteAuthUser(uid) {
    db.prepare('DELETE FROM users WHERE uid = ?').run(uid);
}

// Document CRUD

function getDocument(collection, docId) {
    return db.prepare('SELECT * FROM documents WHERE collection = ? AND doc_id = ?').get(collection, docId);
}

function addDocument(collection, data) {
    const docId = crypto.randomUUID();
    const now = new Date().toISOString();
    if (data && typeof data === 'object') {
        if (!data.createdAt) data.createdAt = now;
        if (!data.updatedAt) data.updatedAt = now;
    }
    db.prepare('INSERT INTO documents (collection, doc_id, data) VALUES (?, ?, ?)').run(collection, docId, JSON.stringify(data || {}));
    return docId;
}

function setDocument(collection, docId, data, merge = false) {
    const now = new Date().toISOString();
    if (merge) {
        const existing = getDocument(collection, docId);
        if (existing) {
            let existingData = {};
            try { existingData = JSON.parse(existing.data); } catch {}
            Object.assign(existingData, data);
            if (!data.createdAt && existingData.createdAt) data.createdAt = existingData.createdAt;
            if (!data.updatedAt) data.updatedAt = now;
            db.prepare('UPDATE documents SET data = ?, updated_at = ? WHERE collection = ? AND doc_id = ?').run(JSON.stringify(existingData), now, collection, docId);
            return;
        }
    }
    if (data && typeof data === 'object') {
        if (!data.createdAt) data.createdAt = now;
        if (!data.updatedAt) data.updatedAt = now;
    }
    db.prepare('INSERT OR REPLACE INTO documents (collection, doc_id, data, created_at, updated_at) VALUES (?, ?, ?, COALESCE((SELECT created_at FROM documents WHERE collection = ? AND doc_id = ?), ?), ?)')
        .run(collection, docId, JSON.stringify(data || {}), collection, docId, now, now);
}

function updateDocument(collection, docId, updates) {
    const existing = getDocument(collection, docId);
    if (!existing) return false;
    let data = {};
    try { data = JSON.parse(existing.data); } catch {}
    for (const [key, val] of Object.entries(updates)) {
        if (val && typeof val === 'object' && val.__serverTimestamp) {
            data[key] = new Date().toISOString();
        } else if (val && typeof val === 'object' && val.__increment !== undefined) {
            data[key] = (data[key] || 0) + val.__increment;
        } else if (val && typeof val === 'object' && val.__arrayUnion !== undefined) {
            if (!Array.isArray(data[key])) data[key] = [];
            for (const item of val.__arrayUnion) {
                if (!data[key].includes(item)) data[key].push(item);
            }
        } else if (val && typeof val === 'object' && val.__arrayRemove !== undefined) {
            if (Array.isArray(data[key])) {
                data[key] = data[key].filter(x => !val.__arrayRemove.includes(x));
            }
        } else if (val && typeof val === 'object' && val.__delete) {
            delete data[key];
        } else {
            data[key] = val;
        }
    }
    data.updatedAt = new Date().toISOString();
    db.prepare('UPDATE documents SET data = ?, updated_at = ? WHERE collection = ? AND doc_id = ?').run(JSON.stringify(data), data.updatedAt, collection, docId);
    return true;
}

function deleteDocument(collection, docId) {
    return db.prepare('DELETE FROM documents WHERE collection = ? AND doc_id = ?').run(collection, docId);
}

function queryDocuments(collection, filters = [], orderBy = [], limit = null, offset = null) {
    let sql = 'SELECT * FROM documents WHERE collection = ?';
    const params = [collection];

    const safeJsonExtract = (field) => {
        const parts = field.split('.');
        const path = '$' + parts.map(p => `."${p}"`).join('');
        return `json_extract(data, '${path}')`;
    };

    const FILTER_OPS = {
        '==': (field) => ({ sql: `${safeJsonExtract(field)} = ?`, transform: (v) => v === null ? '' : String(v) }),
        '!=': (field) => ({ sql: `${safeJsonExtract(field)} != ?`, transform: (v) => String(v) }),
        '<': (field) => ({ sql: `CAST(${safeJsonExtract(field)} AS TEXT) < ?` }),
        '<=': (field) => ({ sql: `CAST(${safeJsonExtract(field)} AS TEXT) <= ?` }),
        '>': (field) => ({ sql: `CAST(${safeJsonExtract(field)} AS TEXT) > ?` }),
        '>=': (field) => ({ sql: `CAST(${safeJsonExtract(field)} AS TEXT) >= ?` }),
        'array-contains': (field) => ({ sql: `${safeJsonExtract(field)} LIKE ?`, transform: (v) => `%"${String(v)}"%` }),
    };

    for (const f of filters) {
        const handler = FILTER_OPS[f.op];
        if (!handler) continue;
        const { sql: clause, transform } = handler(f.field);
        sql += ` AND ${clause}`;
        params.push(transform ? transform(f.value) : String(f.value));
    }

    for (const ob of orderBy) {
        const dir = (ob.dir || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        sql += ` ORDER BY CAST(${safeJsonExtract(ob.field)} AS TEXT) ${dir}`;
    }

    if (limit) sql += ` LIMIT ?`;
    if (limit) params.push(limit);
    if (offset) sql += ` OFFSET ?`;
    if (offset) params.push(offset);

    const rows = db.prepare(sql).all(...params);
    return rows.map(r => ({
        id: r.doc_id,
        exists: true,
        data: (() => { try { return JSON.parse(r.data); } catch { return {}; } })(),
        createdAt: r.created_at,
        updatedAt: r.updated_at
    }));
}

function getNextSequence(name) {
    const result = db.prepare('UPDATE sequences SET value = value + 1 WHERE name = ? RETURNING value').get(name);
    if (result) return result.value;
    db.prepare('INSERT INTO sequences (name, value) VALUES (?, 1)').run(name);
    return 1;
}

function parseDocData(row) {
    if (!row) return null;
    try {
        const data = JSON.parse(row.data);
        return {
            id: row.doc_id,
            exists: true,
            data: () => data,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch {
        return null;
    }
}

module.exports = {
    getDb,
    seedAdmin,
    getUserByEmail,
    getUserById,
    createAuthUser,
    updateAuthUser,
    deleteAuthUser,
    getDocument,
    addDocument,
    setDocument,
    updateDocument,
    deleteDocument,
    queryDocuments,
    getNextSequence,
    parseDocData,
    generatePassword
};
