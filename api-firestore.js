const { getDocument, addDocument, setDocument, updateDocument, deleteDocument, queryDocuments } = require('./database');

function getDoc(req, res) {
    const { collection, id } = req.params;
    const doc = getDocument(collection, id);
    if (!doc) {
        return res.json({ exists: false, id });
    }
    try {
        const data = JSON.parse(doc.data);
        return res.json({
            exists: true,
            id: doc.doc_id,
            data: data,
            createdAt: doc.created_at,
            updatedAt: doc.updated_at
        });
    } catch {
        return res.json({ exists: false, id });
    }
}

function addDoc(req, res) {
    const { collection } = req.params;
    const body = req.body || {};
    const data = body.data || body;
    const processed = processFieldValues(data);
    const docId = addDocument(collection, processed);
    return res.json({ id: docId, name: `${collection}/${docId}` });
}

function setDoc(req, res) {
    const { collection, id } = req.params;
    const body = req.body || {};
    const data = body.data || body;
    const merge = body.merge === true;
    const processed = processFieldValues(data);
    setDocument(collection, id, processed, merge);
    return res.json({ id, name: `${collection}/${id}` });
}

function updateDoc(req, res) {
    const { collection, id } = req.params;
    const body = req.body || {};
    const data = body.data || body;
    const processed = processFieldValues(data);
    const result = updateDocument(collection, id, processed);
    if (!result) {
        return res.status(404).json({ error: 'Document not found' });
    }
    return res.json({ id, name: `${collection}/${id}` });
}

function deleteDoc(req, res) {
    const { collection, id } = req.params;
    deleteDocument(collection, id);
    return res.json({ id, name: `${collection}/${id}` });
}

function query(req, res) {
    const { collection } = req.params;
    const body = req.body || {};
    const filters = body.filters || [];
    const orderBy = body.orderBy || [];
    const limit = body.limit || null;
    const offset = body.offset || null;
    const docs = queryDocuments(collection, filters, orderBy, limit, offset);
    return res.json({
        documents: docs,
        size: docs.length,
        empty: docs.length === 0
    });
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
