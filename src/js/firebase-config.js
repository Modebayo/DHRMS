const firebaseConfig = {
    apiKey: "AIzaSyD88be8i2tGLFqL8ylj3rLLX91UTm7m7sc",
    authDomain: "dhrms-26bb5.firebaseapp.com",
    databaseURL: "https://dhrms-26bb5-default-rtdb.firebaseio.com",
    projectId: "dhrms-26bb5",
    storageBucket: "dhrms-26bb5.firebasestorage.app",
    messagingSenderId: "751930556279",
    appId: "1:751930556279:web:aacf70bee3ed31dec12b72"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const APP_CONFIG = {
    version: '1.0.0',
    encryptionSalt: 'KUdhrms2026v1',
    hkdfInfo: 'ku-health-records-encryption-v1',
    bcryptRounds: 12
};
