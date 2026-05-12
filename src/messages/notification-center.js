let notifications = [];
let unreadCount = 0;
let notifUnsub = null;

document.addEventListener('DOMContentLoaded', async () => {
    const result = await guardPage();
    if (!result) return;
    
    window._notifCurrentUser = result.user;
    window._notifUserData = result.userData;
    
    initTheme();
    subscribeNotifications();
});

function subscribeNotifications() {
    if (notifUnsub) notifUnsub();
    const uid = window._notifCurrentUser?.uid;
    if (!uid) return;
    
    notifUnsub = db.collection('notifications')
        .where('userId', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot((snapshot) => {
            notifications = snapshot.docs;
            unreadCount = notifications.filter(n => !n.data().read).length;
            
            updateNotificationBadge();
            renderNotificationList();
        }, (error) => {
            console.error('Notifications subscription error:', error);
        });
}

function updateNotificationBadge() {
    const dot = document.getElementById('notifDot');
    if (dot) {
        dot.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
}

function renderNotificationList() {
    const list = document.getElementById('notificationList');
    if (!list) return;
    
    if (notifications.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)"><i data-lucide="bell-off" style="width:32px;height:32px;margin-bottom:8px"></i><p>No notifications</p></div>';
        lucide.createIcons();
        return;
    }
    
    list.innerHTML = notifications.map(doc => {
        const n = doc.data();
        const timeAgo = formatNotificationTime(n.createdAt);
        const icon = getNotificationIcon(n.type);
        const isUnread = !n.read ? 'background:var(--primary-50)' : '';
        
        return `
            <div class="notification-item" style="${isUnread}" onclick="markNotificationRead('${doc.id}')">
                <div class="notification-icon"><i data-lucide="${icon}"></i></div>
                <div class="notification-content">
                    <div class="notification-title">${n.title || 'Notification'}</div>
                    <div class="notification-message">${n.message || ''}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

async function markNotificationRead(notifId) {
    try {
        await db.collection('notifications').doc(notifId).update({ read: true });
    } catch (error) {
        console.error('Error marking notification read:', error);
    }
}

function toggleNotifications() {
    document.getElementById('notificationPanel').classList.toggle('active');
    if (document.getElementById('notificationPanel').classList.contains('active')) {
        markAllNotificationsRead();
    }
}

async function markAllNotificationsRead() {
    try {
        const unread = notifications.filter(n => !n.data().read);
        for (const doc of unread) {
            await db.collection('notifications').doc(doc.id).update({ read: true });
        }
    } catch (error) {
        console.error('Error marking all read:', error);
    }
}

function getNotificationIcon(type) {
    const icons = {
        'message': 'message-square',
        'appointment': 'calendar-check',
        'prescription': 'pill',
        'vitals': 'activity',
        'lab_result': 'flask-conical',
        'system': 'info',
        'alert': 'alert-circle'
    };
    return icons[type] || 'bell';
}

function formatNotificationTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('sidebar-open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}
