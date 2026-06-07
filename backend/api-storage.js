const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const subPath = req.body.path || 'misc';
        const dir = path.join(UPLOAD_DIR, subPath);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        cb(null, uuidv4() + ext);
    }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function uploadFile(req, res) {
    if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
    }
    const fullPath = req.body.path
        ? path.join(req.body.path, req.file.filename).replace(/\\/g, '/')
        : req.file.filename;
    return res.json({
        metadata: {
            name: req.file.filename,
            fullPath: fullPath,
            size: req.file.size,
            contentType: req.file.mimetype,
            originalName: req.file.originalname
        },
        downloadURL: `/api/storage/${fullPath}`
    });
}

function serveFile(req, res) {
    let reqPath = req.path || '';
    if (reqPath.startsWith('/')) reqPath = reqPath.slice(1);
    if (!reqPath) {
        return res.status(400).json({ error: 'Path required' });
    }
    const absolute = path.normalize(path.join(UPLOAD_DIR, reqPath));
    if (!absolute.startsWith(UPLOAD_DIR)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (!fs.existsSync(absolute)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(absolute);
}

module.exports = { uploadFile, serveFile, upload };
