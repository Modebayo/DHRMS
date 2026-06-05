const KeyManager = (() => {
    let currentUser = null;
    let cachedPrivateKey = null;
    let cachedUserId = null;
    let sharedKeyCache = new Map();
    let publicKeyCache = new Map();

    function isReady() {
        return cachedPrivateKey !== null;
    }

    async function getKeySecret(user, password) {
        if (password && password.length > 0) return password;
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists) throw new Error('User document not found');
        let secret = doc.data().keySecret;
        if (!secret) {
            secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            await db.collection('users').doc(user.uid).update({ keySecret: secret });
        }
        return secret;
    }

    async function initKeys(user, password) {
        if (!user) throw new Error('User required');
        currentUser = user;
        cachedUserId = user.uid;

        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists) throw new Error('User document not found');

        const userData = doc.data();
        const effectiveSecret = await getKeySecret(user, password);

        if (userData.publicKey && userData.encryptedPrivateKey) {
            await loadExistingKeys(userData.encryptedPrivateKey, effectiveSecret);
        } else {
            await createAndStoreKeys(effectiveSecret);
        }
    }

    async function loadExistingKeys(encryptedPrivKey, password) {
        const privKeyJwk = await Encryption.decryptPrivateKey(encryptedPrivKey, password);
        cachedPrivateKey = await Encryption.importPrivateKey(privKeyJwk);
    }

    async function createAndStoreKeys(password) {
        const keyPair = await Encryption.generateKeyPair();
        const pubKeyJwk = await Encryption.exportPublicKey(keyPair.publicKey);
        const privKeyJwk = await Encryption.exportPrivateKey(keyPair.privateKey);
        const encryptedPrivKey = await Encryption.encryptPrivateKey(privKeyJwk, password);

        await db.collection('users').doc(currentUser.uid).update({
            publicKey: pubKeyJwk,
            encryptedPrivateKey: encryptedPrivKey,
            keysVersion: 1,
            keysCreatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        cachedPrivateKey = keyPair.privateKey;
    }

    async function reEncryptPrivateKey(oldPassword, newPassword) {
        if (!cachedPrivateKey) throw new Error('Keys not loaded');
        const privKeyJwk = await Encryption.exportPrivateKey(cachedPrivateKey);
        const encryptedPrivKey = await Encryption.encryptPrivateKey(privKeyJwk, newPassword);

        await db.collection('users').doc(currentUser.uid).update({
            encryptedPrivateKey: encryptedPrivKey
        });
    }

    async function getPublicKey(userId) {
        if (publicKeyCache.has(userId)) return publicKeyCache.get(userId);
        const pubKey = await Encryption.getPublicKeyFromUser(userId);
        publicKeyCache.set(userId, pubKey);
        return pubKey;
    }

    async function getSharedKey(partnerUserId) {
        if (sharedKeyCache.has(partnerUserId)) return sharedKeyCache.get(partnerUserId);
        if (!cachedPrivateKey) throw new Error('Keys not loaded. Call initKeys first.');

        const partnerPubKey = await getPublicKey(partnerUserId);
        const aesKey = await Encryption.deriveSharedKey(cachedPrivateKey, partnerPubKey);
        sharedKeyCache.set(partnerUserId, aesKey);
        return aesKey;
    }

    async function encryptForUser(plaintext, partnerUserId) {
        const aesKey = await getSharedKey(partnerUserId);
        return await Encryption.encrypt(plaintext, aesKey);
    }

    async function decryptFromUser(encryptedData, partnerUserId) {
        const aesKey = await getSharedKey(partnerUserId);
        return await Encryption.decrypt(encryptedData, aesKey);
    }

    function clearSession() {
        cachedPrivateKey = null;
        cachedUserId = null;
        currentUser = null;
        sharedKeyCache.clear();
        publicKeyCache.clear();
    }

    function getUserId() {
        return cachedUserId;
    }

    return {
        isReady,
        initKeys,
        reEncryptPrivateKey,
        getSharedKey,
        encryptForUser,
        decryptFromUser,
        clearSession,
        getUserId,
        getPublicKey
    };
})();
