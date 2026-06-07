const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const APP_CONFIG = {
    version: '1.0.0',
    encryptionSalt: 'KUdhrms2026v1',
    hkdfInfo: 'ku-health-records-encryption-v1',
    bcryptRounds: 12,
    apiBase: ''
};
