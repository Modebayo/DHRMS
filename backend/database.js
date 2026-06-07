const admin = require('firebase-admin');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const BCRYPT_ROUNDS = 12;

function initFirebase() {
    if (admin.apps.length) return;
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT;
    const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (base64) {
        const sa = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
        admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else if (envPath) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
        const fallback = path.join(__dirname, '..', 'service-account.json');
        if (fs.existsSync(fallback)) {
            const sa = JSON.parse(fs.readFileSync(fallback, 'utf8'));
            admin.initializeApp({ credential: admin.credential.cert(sa) });
        } else {
            console.warn('[Firebase] No credentials found. Set FIREBASE_SERVICE_ACCOUNT env var.');
            admin.initializeApp();
        }
    }
    console.log('[Firebase] Admin SDK initialized');
}

initFirebase();

function getFirestore() {
    return admin.firestore();
}

async function getUserByEmail(email) {
    const snap = await getFirestore().collection('_auth_').where('email', '==', email.toLowerCase()).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { uid: doc.id, ...doc.data() };
}

async function getUserById(uid) {
    const doc = await getFirestore().collection('_auth_').doc(uid).get();
    if (!doc.exists) return null;
    return { uid: doc.id, ...doc.data() };
}

async function createAuthUser(uid, email, password, role) {
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    await getFirestore().collection('_auth_').doc(uid).set({
        email: email.toLowerCase(),
        password_hash: hash,
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
    return { uid, email, role };
}

async function updateAuthUser(uid, updates) {
    const data = {};
    if (updates.email) data.email = updates.email.toLowerCase();
    if (updates.password) data.password_hash = bcrypt.hashSync(updates.password, BCRYPT_ROUNDS);
    if (updates.role) data.role = updates.role;
    data.updated_at = new Date().toISOString();
    await getFirestore().collection('_auth_').doc(uid).update(data);
}

async function deleteAuthUser(uid) {
    await getFirestore().collection('_auth_').doc(uid).delete();
}

async function getDocument(collection, docId) {
    const doc = await getFirestore().collection(collection).doc(docId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
        id: doc.id,
        exists: true,
        data: JSON.stringify(data),
        created_at: data.createdAt || null,
        updated_at: data.updatedAt || null
    };
}

async function addDocument(collection, data) {
    const now = new Date().toISOString();
    if (data && typeof data === 'object') {
        if (!data.createdAt) data.createdAt = now;
        if (!data.updatedAt) data.updatedAt = now;
    }
    const ref = await getFirestore().collection(collection).add(data);
    return ref.id;
}

async function setDocument(collection, docId, data, merge = false) {
    const now = new Date().toISOString();
    if (data && typeof data === 'object') {
        if (!data.createdAt && !merge) data.createdAt = now;
        if (!data.updatedAt) data.updatedAt = now;
    }
    if (merge) {
        await getFirestore().collection(collection).doc(docId).set(data, { merge: true });
    } else {
        await getFirestore().collection(collection).doc(docId).set(data);
    }
}

async function updateDocument(collection, docId, updates) {
    const processed = {};
    for (const [key, val] of Object.entries(updates)) {
        if (val && typeof val === 'object') {
            if (val.__serverTimestamp) {
                processed[key] = new Date().toISOString();
            } else if (val.__increment !== undefined) {
                processed[key] = admin.firestore.FieldValue.increment(val.__increment);
            } else if (val.__arrayUnion !== undefined) {
                processed[key] = admin.firestore.FieldValue.arrayUnion(...val.__arrayUnion);
            } else if (val.__arrayRemove !== undefined) {
                processed[key] = admin.firestore.FieldValue.arrayRemove(...val.__arrayRemove);
            } else if (val.__delete) {
                processed[key] = admin.firestore.FieldValue.delete();
            } else {
                processed[key] = val;
            }
        } else {
            processed[key] = val;
        }
    }
    processed.updatedAt = new Date().toISOString();
    try {
        await getFirestore().collection(collection).doc(docId).update(processed);
        return true;
    } catch {
        return false;
    }
}

async function deleteDocument(collection, docId) {
    await getFirestore().collection(collection).doc(docId).delete();
}

async function queryDocuments(collection, filters = [], orderBy = [], limit = null, offset = null) {
    let query = getFirestore().collection(collection);
    const ops = { '==': '==', '!=': '!=', '<': '<', '<=': '<=', '>': '>', '>=': '>=', 'array-contains': 'array-contains' };
    for (const f of filters) {
        const op = ops[f.op];
        if (op) query = query.where(f.field, op, f.value);
    }
    for (const ob of orderBy) {
        const dir = (ob.dir || 'asc').toUpperCase() === 'DESC' ? 'desc' : 'asc';
        query = query.orderBy(ob.field, dir);
    }
    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);
    const snap = await query.get();
    const docs = [];
    snap.forEach(doc => {
        const data = doc.data();
        docs.push({
            id: doc.id,
            exists: true,
            data,
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null
        });
    });
    return docs;
}

async function seedAdmin() {
    const email = 'admin@koladaisi.edu.ng';
    const password = 'Neon10*';
    const uid = crypto.randomUUID();
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    const existing = await getUserByEmail(email);
    if (existing) {
        const newHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
        await getFirestore().collection('_auth_').doc(existing.uid).update({
            email,
            password_hash: newHash,
            updated_at: new Date().toISOString()
        });
        console.log('Admin password updated to: ' + password);
        return { uid: existing.uid, email, password };
    }
    await getFirestore().collection('_auth_').doc(uid).set({
        email,
        password_hash: hash,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
    await getFirestore().collection('users').doc(uid).set({
        email,
        role: 'admin',
        displayName: 'System Admin',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    return { uid, email, password };
}

async function getNextSequence(name) {
    const fsDb = getFirestore();
    const doc = await fsDb.collection('_sequences_').doc(name).get();
    if (doc.exists) {
        const newVal = (doc.data().value || 0) + 1;
        await fsDb.collection('_sequences_').doc(name).update({ value: newVal });
        return newVal;
    }
    await fsDb.collection('_sequences_').doc(name).set({ value: 1 });
    return 1;
}

function generatePassword(length = 16) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pw = '';
    for (let i = 0; i < length; i++) pw += chars[crypto.randomInt(chars.length)];
    return pw;
}

module.exports = {
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
    generatePassword
};
