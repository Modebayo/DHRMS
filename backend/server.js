const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { seedAdmin } = require('./database');
const { authMiddleware, requireRole } = require('./middleware');
const authRoutes = require('./api-auth');
const firestoreRoutes = require('./api-firestore');
const storageRoutes = require('./api-storage');
const backup = require('./backup');

const PORT = parseInt(process.env.PORT, 10) || 3002;
const ROOT = path.join(__dirname, '..');

const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

app.post('/api/auth/signin', authRoutes.signin);
app.post('/api/auth/signup', authRoutes.signup);
app.get('/api/auth/me', authMiddleware, authRoutes.me);
app.post('/api/auth/refresh', authRoutes.refreshToken);
app.post('/api/auth/reset-password', authRoutes.resetPassword);
app.post('/api/auth/change-password', authMiddleware, authRoutes.changePassword);
app.post('/api/auth/delete-account', authMiddleware, authRoutes.deleteAccount);

app.get('/api/fs/:collection/:id', authMiddleware, firestoreRoutes.getDoc);
app.post('/api/fs/:collection', authMiddleware, firestoreRoutes.addDoc);
app.put('/api/fs/:collection/:id', authMiddleware, firestoreRoutes.setDoc);
app.patch('/api/fs/:collection/:id', authMiddleware, firestoreRoutes.updateDoc);
app.delete('/api/fs/:collection/:id', authMiddleware, firestoreRoutes.deleteDoc);
app.post('/api/fs/:collection/query', authMiddleware, firestoreRoutes.query);

app.post('/api/storage/upload', authMiddleware, storageRoutes.upload.single('file'), storageRoutes.uploadFile);
app.use('/api/storage', storageRoutes.serveFile);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/backup/create', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const result = await backup.createBackup();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/backup/list', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const list = await backup.listBackups();
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/backup/download/:filename', authMiddleware, requireRole('admin'), (req, res) => {
    const filename = req.params.filename;
    if (!filename.endsWith('.zip') || !filename.startsWith('backup_')) {
        return res.status(400).json({ error: 'Invalid backup file' });
    }
    const fpath = path.join(backup.BACKUP_DIR, filename);
    if (!fs.existsSync(fpath)) {
        return res.status(404).json({ error: 'Backup not found' });
    }
    res.download(fpath, filename);
});

app.delete('/api/backup/:filename', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const result = await backup.deleteBackup(req.params.filename);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/backup/restore', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const { filename } = req.body || {};
        if (!filename) return res.status(400).json({ error: 'Filename required' });
        const result = await backup.restoreBackup(filename);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

app.use(express.static(ROOT, {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath);
        if (ext === '.html') {
            res.setHeader('Cache-Control', 'no-store, must-revalidate');
        } else if (MIME_TYPES[ext]) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    const htmlPath = path.join(ROOT, req.path, 'index.html');
    if (fs.existsSync(htmlPath)) {
        return res.sendFile(htmlPath);
    }
    const notFoundPath = path.join(ROOT, '404.html');
    if (fs.existsSync(notFoundPath)) {
        return res.status(404).sendFile(notFoundPath);
    }
    res.status(404).send('Not found');
});

(async () => {
    try {
        const admin = await seedAdmin();
        if (admin) {
            const credsPath = path.join(ROOT, 'admin-credentials.txt');
            const creds = `Admin account created successfully!\nEmail:    ${admin.email}\nPassword: ${admin.password}\nURL:      http://localhost:${PORT}/src/auth/login.html\n\nIMPORTANT: Save this password. It will not be shown again.\n`;
            fs.writeFileSync(credsPath, creds);
            console.log('='.repeat(50));
            console.log(' ADMIN ACCOUNT CREATED');
            console.log('='.repeat(50));
            console.log(` Email:    ${admin.email}`);
            console.log(` Password: ${admin.password}`);
            console.log('='.repeat(50));
            console.log(` Credentials saved to: admin-credentials.txt`);
            console.log('='.repeat(50));
        } else {
            console.log('Admin account already exists — skipping seed.');
        }

        app.listen(PORT, () => {
            console.log(`DHRMS server running at http://localhost:${PORT}`);
            console.log('Firestore backend — no SQLite dependency');
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
})();
