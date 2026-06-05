const path = require('path');
const fs = require('fs');
const { ZipArchive } = require('archiver');
const unzipper = require('unzipper');

const ROOT = __dirname;
const BACKUP_DIR = path.join(ROOT, 'backups');
const DB_PATH = path.join(ROOT, 'database.sqlite');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const CONFIG_FILES = ['firebase.json', 'firestore.rules', 'storage.rules', 'package.json'];

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function getTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function getMetadata() {
    const stats = {};
    if (fs.existsSync(DB_PATH)) stats.database = fs.statSync(DB_PATH).size;
    const uploads = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
    stats.uploadCount = uploads.length;
    stats.uploadSize = uploads.reduce((sum, f) => {
        try { return sum + fs.statSync(path.join(UPLOADS_DIR, f)).size; } catch { return sum; }
    }, 0);
    return stats;
}

async function createBackup() {
    const timestamp = getTimestamp();
    const filename = `backup_${timestamp}.zip`;
    const filepath = path.join(BACKUP_DIR, filename);
    const snapshotPath = path.join(ROOT, `_db_snapshot_${timestamp}.sqlite`);

    const { getDb } = require('./database');
    const db = getDb();

    db.exec(`VACUUM INTO '${snapshotPath.replace(/\\/g, '\\\\')}'`);

    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(filepath);
        const archive = new ZipArchive();

        output.on('close', () => {
            try { if (fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath); } catch {}
            const size = fs.statSync(filepath).size;
            resolve({ filename, path: filepath, size, sizeLabel: formatSize(size), timestamp });
        });

        archive.on('error', (err) => {
            try { if (fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath); } catch {}
            try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch {}
            reject(err);
        });

        archive.pipe(output);

        archive.file(snapshotPath, { name: 'database.sqlite' });

        if (fs.existsSync(UPLOADS_DIR)) {
            const uploadFiles = fs.readdirSync(UPLOADS_DIR);
            for (const f of uploadFiles) {
                const fpath = path.join(UPLOADS_DIR, f);
                if (fs.statSync(fpath).isFile()) {
                    archive.file(fpath, { name: `uploads/${f}` });
                }
            }
        }

        for (const cf of CONFIG_FILES) {
            const cfPath = path.join(ROOT, cf);
            if (fs.existsSync(cfPath)) {
                archive.file(cfPath, { name: `config/${cf}` });
            }
        }

        const manifest = {
            createdAt: new Date().toISOString(),
            version: '1.0.0',
            project: 'KU-Health-Records',
            files: getMetadata()
        };
        archive.append(JSON.stringify(manifest, null, 2), { name: 'backup-manifest.json' });

        archive.finalize();
    });
}

async function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.zip')).sort().reverse();
    return files.map(f => {
        const fpath = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(fpath);
        return {
            filename: f,
            path: fpath,
            size: stat.size,
            sizeLabel: formatSize(stat.size),
            createdAt: stat.mtime.toISOString()
        };
    });
}

async function deleteBackup(filename) {
    const fpath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(fpath)) throw new Error('Backup not found');
    if (!filename.endsWith('.zip') || !filename.startsWith('backup_')) throw new Error('Invalid backup file');
    fs.unlinkSync(fpath);
    return { deleted: filename };
}

async function restoreBackup(filename) {
    const fpath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(fpath)) throw new Error('Backup file not found');

    await createBackup();

    const directory = await unzipper.Open.file(fpath);

    for (const file of directory.files) {
        const content = await file.buffer();
        if (file.path === 'database.sqlite') {
            fs.writeFileSync(DB_PATH, content);
        } else if (file.path.startsWith('uploads/')) {
            const target = path.join(UPLOADS_DIR, file.path.slice(8));
            if (file.type === 'Directory') {
                if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
            } else {
                if (!fs.existsSync(path.dirname(target))) fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.writeFileSync(target, content);
            }
        } else if (file.path.startsWith('config/')) {
            const target = path.join(ROOT, file.path.slice(7));
            fs.writeFileSync(target, content);
        }
    }

    const { getDb } = require('./database');
    const db = getDb();
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');

    return { restored: filename };
}

if (require.main === module) {
    const cmd = process.argv[2];
    (async () => {
        try {
            switch (cmd) {
                case 'create': {
                    const result = await createBackup();
                    console.log(`Backup created: ${result.filename} (${result.sizeLabel})`);
                    break;
                }
                case 'list': {
                    const list = await listBackups();
                    if (list.length === 0) {
                        console.log('No backups found.');
                    } else {
                        console.log('Available backups:');
                        list.forEach(b => console.log(`  ${b.filename}  ${b.sizeLabel}  ${b.createdAt}`));
                    }
                    break;
                }
                case 'restore': {
                    const file = process.argv[3];
                    if (!file) { console.error('Usage: node backup.js restore <filename>'); process.exit(1); }
                    const result = await restoreBackup(file);
                    console.log(`Restored from: ${result.restored}`);
                    break;
                }
                case 'delete': {
                    const file = process.argv[3];
                    if (!file) { console.error('Usage: node backup.js delete <filename>'); process.exit(1); }
                    await deleteBackup(file);
                    console.log(`Deleted: ${file}`);
                    break;
                }
                default:
                    console.log('Usage: node backup.js <create|list|restore|delete> [filename]');
            }
        } catch (err) {
            console.error('Error:', err.message);
            process.exit(1);
        }
    })();
}

module.exports = { createBackup, listBackups, deleteBackup, restoreBackup, BACKUP_DIR };
