const { getDocument, addDocument, setDocument, updateDocument, deleteDocument, queryDocuments } = require('./database');

async function getDoc(req, res) {
    try {
        const { collection, id } = req.params;
        const doc = await getDocument(collection, id);
        if (!doc) return res.json({ exists: false, id });
        let data;
        try { data = JSON.parse(doc.data); } catch { return res.json({ exists: false, id }); }
        return res.json({
            exists: true,
            id: doc.id,
            data,
            createdAt: doc.created_at,
            updatedAt: doc.updated_at
        });
    } catch (err) {
        console.error('[getDoc] ERROR:', err);
        return res.status(500).json({ error: err.message });
    }
}

async function addDoc(req, res) {
    try {
        const { collection } = req.params;
        const body = req.body || {};
        const data = body.data || body;
        const processed = processFieldValues(data);
        const docId = await addDocument(collection, processed);
        return res.json({ id: docId, name: `${collection}/${docId}` });
    } catch (err) {
        console.error('[addDoc] ERROR:', err);
        return res.status(500).json({ error: err.message });
    }
}

async function setDoc(req, res) {
    try {
        const { collection, id } = req.params;
        const body = req.body || {};
        const data = body.data || body;
        const merge = body.merge === true;
        const processed = processFieldValues(data);
        await setDocument(collection, id, processed, merge);
        return res.json({ id, name: `${collection}/${id}` });
    } catch (err) {
        console.error('[setDoc] ERROR:', err);
        return res.status(500).json({ error: err.message });
    }
}

async function updateDoc(req, res) {
    try {
        const { collection, id } = req.params;
        const body = req.body || {};
        const data = body.data || body;
        const processed = processFieldValues(data);
        const result = await updateDocument(collection, id, processed);
        if (!result) return res.status(404).json({ error: 'Document not found' });
        return res.json({ id, name: `${collection}/${id}` });
    } catch (err) {
        console.error('[updateDoc] ERROR:', err);
        return res.status(500).json({ error: err.message });
    }
}

async function deleteDoc(req, res) {
    try {
        const { collection, id } = req.params;
        await deleteDocument(collection, id);
        return res.json({ id, name: `${collection}/${id}` });
    } catch (err) {
        console.error('[deleteDoc] ERROR:', err);
        return res.status(500).json({ error: err.message });
    }
}

async function query(req, res) {
    try {
        const { collection } = req.params;
        const body = req.body || {};
        const filters = body.filters || [];
        const orderBy = body.orderBy || [];
        const limit = body.limit || null;
        const offset = body.offset || null;
        const docs = await queryDocuments(collection, filters, orderBy, limit, offset);
        return res.json({ documents: docs, size: docs.length, empty: docs.length === 0 });
    } catch (err) {
        console.error('[query] ERROR:', err);
        return res.status(500).json({ error: err.message });
    }
}

function processFieldValues(data) {
    if (!data || typeof data !== 'object') return data;
    const result = {};
    for (const [key, val] of Object.entries(data)) {
        if (val && typeof val === 'object') {
            if (val.__serverTimestamp) {
                result[key] = new Date().toISOString();
            } else if (val.__increment !== undefined) {
                result[key] = val.__increment;
            } else if (val.__delete) {
                continue;
            } else if (val.__arrayUnion !== undefined) {
                result[key] = val.__arrayUnion;
            } else if (val.__arrayRemove !== undefined) {
                result[key] = [];
            } else {
                result[key] = val;
            }
        } else {
            result[key] = val;
        }
    }
    return result;
}

module.exports = { getDoc, addDoc, setDoc, updateDoc, deleteDoc, query };
