const STAFF_ROLES = ['doctor', 'nurse', 'pharmacist', 'lab_technician', 'records_officer', 'admin', 'administrator'];
const HEARTBEAT_INTERVAL_MS = 60000;
const STALE_THRESHOLD_MS = 120000;

let presenceUserData = null;
let presenceCurrentUser = null;
let heartbeatTimer = null;
let isPresenceActive = false;

function initPresence(user, userData) {
    if (!user || !userData) return;
    if (isPresenceActive) return;

    presenceCurrentUser = user;
    presenceUserData = userData;

    const role = userData.role || '';
    if (role === 'student') {
        ensureStudentNoPresence(user.uid);
        return;
    }

    isPresenceActive = true;
    setOnline(true);
    startHeartbeat();
    setupVisibilityHandler();
    setupUnloadHandler();
}

function stopPresence() {
    if (!isPresenceActive) return;
    isPresenceActive = false;
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    setOnline(false);
    presenceCurrentUser = null;
    presenceUserData = null;
}

async function setOnline(online) {
    if (!presenceCurrentUser || !isPresenceActive) return;
    try {
        await db.collection('users').doc(presenceCurrentUser.uid).update({
            isOnline: online,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('Presence update error:', e);
    }
}

async function heartbeat() {
    if (!presenceCurrentUser || !isPresenceActive) return;
    try {
        await db.collection('users').doc(presenceCurrentUser.uid).update({
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('Heartbeat error:', e);
    }
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
}

function setupVisibilityHandler() {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

function handleVisibilityChange() {
    if (!isPresenceActive) return;
    if (document.hidden) {
        setOnline(false);
    } else {
        setOnline(true);
        startHeartbeat();
    }
}

function setupUnloadHandler() {
    window.removeEventListener('beforeunload', handleUnload);
    window.removeEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
}

function handleUnload() {
    if (!isPresenceActive || !presenceCurrentUser) return;
    const uid = presenceCurrentUser.uid;
    const data = JSON.stringify({ isOnline: false, lastSeen: new Date().toISOString() });
    try {
        navigator.sendBeacon(
            `https://firestore.googleapis.com/v1/projects/${firebase.app().options.projectId}/databases/(default)/documents/users/${uid}`,
            new Blob([data], { type: 'application/json' })
        );
    } catch (e) {
    }
}

function autoInitPresence() {
    if (typeof auth === 'undefined' || typeof db === 'undefined') return;
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
        unsubscribe();
        if (!user || isPresenceActive) return;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) initPresence(user, doc.data());
        } catch (e) {}
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(autoInitPresence, 0));
} else {
    setTimeout(autoInitPresence, 0);
}

async function ensureStudentNoPresence(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists && doc.data().isOnline !== undefined) {
            await db.collection('users').doc(uid).update({
                isOnline: firebase.firestore.FieldValue.delete(),
                isOnDuty: firebase.firestore.FieldValue.delete()
            });
        }
    } catch (e) {
    }
}

async function toggleOnDuty() {
    if (!presenceCurrentUser || !presenceUserData) return;
    const role = presenceUserData.role || '';
    if (role === 'student') return;

    try {
        const doc = await db.collection('users').doc(presenceCurrentUser.uid).get();
        const current = doc.exists ? doc.data().isOnDuty : false;
        const newStatus = !current;
        await db.collection('users').doc(presenceCurrentUser.uid).update({
            isOnDuty: newStatus,
            isOnline: true,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
        return newStatus;
    } catch (e) {
        console.error('Toggle on-duty error:', e);
    }
}

async function getIsOnDuty() {
    if (!presenceCurrentUser) return false;
    try {
        const doc = await db.collection('users').doc(presenceCurrentUser.uid).get();
        return doc.exists ? !!doc.data().isOnDuty : false;
    } catch (e) {
        return false;
    }
}

async function getOnlineStaff(roles = ['doctor', 'nurse']) {
    try {
        const snapshot = await db.collection('users')
            .where('role', 'in', roles)
            .where('isOnline', '==', true)
            .where('isOnDuty', '==', true)
            .get();
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn('Composite index may be missing, falling back to filtered query');
        try {
            const snapshot = await db.collection('users')
                .where('role', 'in', roles)
                .get();
            return snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => s.isOnline && s.isOnDuty);
        } catch (e2) {
            console.error('Error fetching online staff:', e2);
            return [];
        }
    }
}

async function getAllStaffStatus(roles = ['doctor', 'nurse', 'pharmacist', 'lab_technician']) {
    try {
        const snapshot = await db.collection('users')
            .where('role', 'in', roles)
            .get();
        const now = Date.now();
        const THIRTY_MIN = 30 * 60 * 1000;
        return snapshot.docs.map(d => {
            const data = d.data();
            const lastSeenDate = data.lastSeen?.toDate ? data.lastSeen.toDate() : (data.lastSeen ? new Date(data.lastSeen) : null);
            const timeSinceLastSeen = lastSeenDate ? now - lastSeenDate.getTime() : Infinity;

            let availability = 'offline';
            let availabilityLabel = 'Offline';
            let dotColor = 'var(--gray-300)';

            if (data.isOnline && data.isOnDuty) {
                availability = 'available';
                availabilityLabel = 'Available';
                dotColor = 'var(--success-500)';
            } else if (data.isOnline && !data.isOnDuty) {
                availability = 'busy';
                availabilityLabel = 'Busy';
                dotColor = 'var(--warning-500, #f59e0b)';
            } else if (!data.isOnline && timeSinceLastSeen < THIRTY_MIN) {
                availability = 'away';
                availabilityLabel = lastSeenDate ? formatTimeAgo(lastSeenDate) : 'Away';
                dotColor = 'var(--orange-500, #f97316)';
            } else {
                availability = 'offline';
                availabilityLabel = 'Offline';
                dotColor = 'var(--gray-300)';
            }

            return {
                id: d.id,
                ...data,
                availability,
                availabilityLabel,
                dotColor,
                lastSeenDate
            };
        }).sort((a, b) => {
            const order = { available: 0, busy: 1, away: 2, offline: 3 };
            return (order[a.availability] ?? 3) - (order[b.availability] ?? 3);
        });
    } catch (e) {
        console.error('Error fetching all staff status:', e);
        return [];
    }
}

function formatTimeAgo(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

async function getOnlineStatusLabel(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) return { online: false, label: 'Unknown', lastSeen: null };
        const data = doc.data();
        if (data.role === 'student') return { online: false, label: 'Not tracked', lastSeen: null };
        if (data.isOnline) return { online: true, label: 'Online', lastSeen: data.lastSeen };
        if (data.lastSeen) {
            const last = data.lastSeen.toDate ? data.lastSeen.toDate() : new Date(data.lastSeen);
            const diff = Date.now() - last.getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return { online: false, label: 'Just now', lastSeen: data.lastSeen };
            if (mins < 60) return { online: false, label: `${mins}m ago`, lastSeen: data.lastSeen };
            const hours = Math.floor(mins / 60);
            return { online: false, label: `${hours}h ago`, lastSeen: data.lastSeen };
        }
        return { online: false, label: 'Offline', lastSeen: null };
    } catch (e) {
        return { online: false, label: 'Unknown', lastSeen: null };
    }
}
