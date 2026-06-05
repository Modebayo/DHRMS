const CRYPTO_SALT = 'KUdhrms2026v1';
const HKDF_INFO = 'ku-health-records-encryption-v1';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const BCRYPT_ROUNDS = 12;

const Encryption = (() => {

    function strToBuf(str) {
        return new TextEncoder().encode(str);
    }

    function bufToStr(buf) {
        return new TextDecoder().decode(buf);
    }

    function bufToBase64(buf) {
        return btoa(String.fromCharCode(...new Uint8Array(buf)));
    }

    function base64ToBuf(b64) {
        return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    }

    function bufToHex(buf) {
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function concatBuf(a, b) {
        const a8 = new Uint8Array(a);
        const b8 = new Uint8Array(b);
        const result = new Uint8Array(a8.length + b8.length);
        result.set(a8, 0);
        result.set(b8, a8.length);
        return result.buffer;
    }

    async function generateKeyPair() {
        const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits']
        );
        return keyPair;
    }

    async function exportPublicKey(publicKey) {
        const jwk = await crypto.subtle.exportKey('jwk', publicKey);
        return { x: jwk.x, y: jwk.y };
    }

    async function importPublicKey(jwkData) {
        return await crypto.subtle.importKey(
            'jwk',
            { kty: 'EC', crv: 'P-256', x: jwkData.x, y: jwkData.y, ext: true },
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        );
    }

    async function exportPrivateKey(privateKey) {
        const jwk = await crypto.subtle.exportKey('jwk', privateKey);
        return { d: jwk.d, x: jwk.x, y: jwk.y };
    }

    async function importPrivateKey(jwkData) {
        return await crypto.subtle.importKey(
            'jwk',
            { kty: 'EC', crv: 'P-256', d: jwkData.d, x: jwkData.x, y: jwkData.y, ext: true },
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            ['deriveKey', 'deriveBits']
        );
    }

    async function deriveSharedKey(privateKey, publicKey) {
        const sharedBits = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: publicKey },
            privateKey,
            256
        );
        return await deriveAesKey(sharedBits);
    }

    async function deriveAesKey(sharedBits) {
        const salt = strToBuf(CRYPTO_SALT);
        const info = strToBuf(HKDF_INFO);
        const key = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
        return await crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt: salt,
                info: info
            },
            key,
            { name: 'AES-GCM', length: AES_KEY_LENGTH },
            true,
            ['encrypt', 'decrypt']
        );
    }

    async function encrypt(plaintext, aesKey) {
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const encoded = strToBuf(JSON.stringify(plaintext));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            encoded
        );
        return {
            ciphertext: bufToBase64(ciphertext),
            iv: bufToBase64(iv)
        };
    }

    async function decrypt(encryptedData, aesKey) {
        const ciphertext = base64ToBuf(encryptedData.ciphertext);
        const iv = base64ToBuf(encryptedData.iv);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            ciphertext
        );
        return JSON.parse(bufToStr(decrypted));
    }

    async function derivePasswordKey(password) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password + CRYPTO_SALT);
        const hashBuffer = await crypto.subtle.digest('SHA-256', passwordBuffer);
        return await crypto.subtle.importKey('raw', hashBuffer, 'HKDF', false, ['deriveKey']);
    }

    async function encryptPrivateKey(privKeyJwk, password) {
        const pwKey = await derivePasswordKey(password);
        const aesKey = await crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt: strToBuf('ku-privkey-enc-' + CRYPTO_SALT),
                info: strToBuf('encrypted-private-key-v1')
            },
            pwKey,
            { name: 'AES-GCM', length: AES_KEY_LENGTH },
            true,
            ['encrypt', 'decrypt']
        );
        const json = JSON.stringify(privKeyJwk);
        const encoded = strToBuf(json);
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            encoded
        );
        return {
            ciphertext: bufToBase64(ciphertext),
            iv: bufToBase64(iv)
        };
    }

    async function decryptPrivateKey(encryptedData, password) {
        const pwKey = await derivePasswordKey(password);
        const aesKey = await crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt: strToBuf('ku-privkey-enc-' + CRYPTO_SALT),
                info: strToBuf('encrypted-private-key-v1')
            },
            pwKey,
            { name: 'AES-GCM', length: AES_KEY_LENGTH },
            true,
            ['encrypt', 'decrypt']
        );
        const ciphertext = base64ToBuf(encryptedData.ciphertext);
        const iv = base64ToBuf(encryptedData.iv);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            ciphertext
        );
        return JSON.parse(bufToStr(decrypted));
    }

    async function getPublicKeyFromUser(userId) {
        const doc = await db.collection('users').doc(userId).get();
        if (!doc.exists) throw new Error('User not found');
        const data = doc.data();
        if (!data.publicKey) throw new Error('User has no public key');
        return await importPublicKey(data.publicKey);
    }

    // =====================================================
    // Document-specified Field-Level Encryption API
    // AES-256-GCM with random IV per operation
    // Returns base64(IV + cipherText) format per spec
    // =====================================================

    const FIELD_KEY_NAME = 'ku-dhrms-field-encryption-key';

    async function getFieldEncryptionKey() {
        let key = sessionStorage.getItem(FIELD_KEY_NAME);
        if (key) return key;

        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) throw new Error('User not found');

        const userData = userDoc.data();
        key = userData.fieldEncryptionKey || null;

        if (!key) {
            key = await generateFieldKey();
            await db.collection('users').doc(user.uid).update({
                fieldEncryptionKey: key
            });
        }

        sessionStorage.setItem(FIELD_KEY_NAME, key);
        return key;
    }

    async function generateFieldKey() {
        const key = crypto.getRandomValues(new Uint8Array(32));
        return bufToBase64(key.buffer);
    }

    async function encryptField(plaintext) {
        if (!plaintext && plaintext !== '') return null;
        const keyB64 = await getFieldEncryptionKey();
        const keyBuf = base64ToBuf(keyB64);
        const aesKey = await crypto.subtle.importKey(
            'raw', keyBuf,
            { name: 'AES-GCM', length: 256 },
            false, ['encrypt']
        );
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(String(plaintext));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            encoded
        );
        const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
        combined.set(iv, 0);
        combined.set(new Uint8Array(ciphertext), iv.length);
        return bufToBase64(combined.buffer);
    }

    async function decryptField(cipherB64) {
        if (!cipherB64) return null;
        const keyB64 = await getFieldEncryptionKey();
        const keyBuf = base64ToBuf(keyB64);
        const aesKey = await crypto.subtle.importKey(
            'raw', keyBuf,
            { name: 'AES-GCM', length: 256 },
            false, ['decrypt']
        );
        const combined = new Uint8Array(base64ToBuf(cipherB64));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            ciphertext
        );
        return new TextDecoder().decode(decrypted);
    }

    async function encryptPatientFields(data) {
        const sensitiveFields = [
            'surname', 'firstname', 'dob', 'bloodGroup', 'genotype',
            'phone', 'email', 'address', 'emergencyName', 'emergencyPhone',
            'emergencyAddress', 'existingConditions', 'allergies'
        ];
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            if (sensitiveFields.includes(key) && value) {
                result[key + '_enc'] = await encryptField(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    async function decryptPatientFields(data) {
        const sensitiveFields = [
            'surname_enc', 'firstname_enc', 'dob_enc', 'bloodGroup_enc', 'genotype_enc',
            'phone_enc', 'email_enc', 'address_enc', 'emergencyName_enc', 'emergencyPhone_enc'
        ];
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            if (sensitiveFields.includes(key)) {
                const plainKey = key.replace('_enc', '');
                const decrypted = await decryptField(value);
                result[plainKey] = decrypted !== null ? decrypted : '[encrypted]';
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    return {
        generateKeyPair,
        exportPublicKey,
        exportPrivateKey,
        importPublicKey,
        importPrivateKey,
        deriveSharedKey,
        encrypt,
        decrypt,
        encryptPrivateKey,
        decryptPrivateKey,
        getPublicKeyFromUser,
        base64ToBuf,
        bufToBase64,
        encryptField,
        decryptField,
        encryptPatientFields,
        decryptPatientFields,
        getFieldEncryptionKey
    };
})();
