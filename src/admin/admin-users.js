let currentUser = null;
let userData = null;
let allUsersData = [];
let selectedUsers = [];
let usersUnsub = null;

function populateUserProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && userData) nameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    if (roleEl && userData) roleEl.textContent = userData.role?.replace(/_/g, ' ') || 'Role';
    if (avatarEl && userData) avatarEl.textContent = (userData.firstName?.[0] || 'U').toUpperCase();
}

// Auth handled by guardPage() in HTML

function setupSearch() {
    const searchInput = document.getElementById('searchUsers');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            filterUsers(query, document.getElementById('filterRole').value, document.getElementById('filterStatus').value);
        });
    }
}

function setupFilters() {
    document.getElementById('filterRole')?.addEventListener('change', () => {
        const query = document.getElementById('searchUsers')?.value.toLowerCase() || '';
        const role = document.getElementById('filterRole').value;
        const status = document.getElementById('filterStatus').value;
        filterUsers(query, role, status);
    });
    
    document.getElementById('filterStatus')?.addEventListener('change', () => {
        const query = document.getElementById('searchUsers')?.value.toLowerCase() || '';
        const role = document.getElementById('filterRole').value;
        const status = document.getElementById('filterStatus').value;
        filterUsers(query, role, status);
    });
}

function filterUsers(query = '', roleFilter = '', statusFilter = '') {
    const filtered = allUsersData.filter(user => {
        const name = `${user.firstName} ${user.lastName}`.toLowerCase();
        const email = (user.email || '').toLowerCase();
        const matchesQuery = !query || name.includes(query) || email.includes(query);
        const matchesRole = !roleFilter || user.role === roleFilter;
        const matchesStatus = !statusFilter || user.status === statusFilter;
        return matchesQuery && matchesRole && matchesStatus;
    });
    renderUsersTable(filtered);
}

function setupBulkActions() {
    document.getElementById('selectAll')?.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.user-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateBulkActions();
    });
}

function updateBulkActions() {
    const checked = document.querySelectorAll('.user-checkbox:checked');
    selectedUsers = Array.from(checked).map(cb => cb.dataset.id);
    document.getElementById('bulkCount').textContent = selectedUsers.length;
    document.getElementById('bulkActions').style.display = selectedUsers.length > 0 ? 'flex' : 'none';
}

let usersInitialized = false;

function subscribeUsers() {
    const tbody = document.getElementById('usersTable');
    if (!tbody) return;

    if (usersUnsub) usersUnsub();
    usersInitialized = false;

    usersUnsub = db.collection('users').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        allUsersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        let students = 0, doctors = 0, nurses = 0, admins = 0, pending = 0, suspended = 0, active = 0, inactive = 0;
        
        allUsersData.forEach(user => {
            if (user.role === 'student') students++;
            else if (user.role === 'doctor') doctors++;
            else if (user.role === 'nurse') nurses++;
            else if (user.role === 'admin') admins++;
            
            if (user.status === 'pending_approval') pending++;
            else if (user.status === 'suspended') suspended++;
            else if (user.status === 'active') active++;
            else if (user.status === 'inactive') inactive++;
        });
        
        document.getElementById('totalUsers').textContent = snapshot.size;
        document.getElementById('totalStudents').textContent = students;
        document.getElementById('totalStaff').textContent = (doctors + nurses + admins);
        document.getElementById('pendingApproval').textContent = pending;
        document.getElementById('activeUsers').textContent = active;
        document.getElementById('suspendedUsers').textContent = suspended;
        document.getElementById('inactiveUsers').textContent = inactive;
        
        renderUsersTable(allUsersData);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        if (!usersInitialized) {
            usersInitialized = true;
            if (typeof applyUrlFilters === 'function') applyUrlFilters();
        }
    }, error => {
        console.error('Error loading users:', error);
        showToast('Error loading users', 'error');
    });
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTable');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><p>No users found</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        const statusClass = user.status === 'active' ? 'success' : user.status === 'suspended' ? 'danger' : user.status === 'inactive' ? 'secondary' : 'warning';
        const userId = user.studentId || user.staffId || 'N/A';
        const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase();
        
        return `
            <tr>
                <td>
                    <input type="checkbox" class="user-checkbox" data-id="${user.id}" onclick="updateBulkActions()">
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-500);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">
                            ${initials}
                        </div>
                        <strong>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</strong>
                    </div>
                </td>
                <td>${escapeHtml(user.email)}</td>
                <td><span class="badge badge-primary">${escapeHtml(user.role)}</span></td>
                <td>${escapeHtml(userId)}</td>
                <td><span class="badge badge-${statusClass}">${user.status === 'pending_approval' ? 'Pending' : user.status}</span></td>
                <td>${formatTimestamp(user.createdAt)}</td>
                <td>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-sm btn-ghost" onclick="viewUser('${user.id}')" title="View"><i data-lucide="eye" style="width:14px;height:14px"></i></button>
                        <button class="btn btn-sm btn-ghost" onclick="openEditUser('${user.id}')" title="Edit"><i data-lucide="pencil" style="width:14px;height:14px"></i></button>
                        ${user.status === 'pending_approval' ? `<button class="btn btn-sm btn-success" onclick="approveUser('${user.id}')" title="Approve"><i data-lucide="check" style="width:14px;height:14px"></i></button><button class="btn btn-sm btn-danger" onclick="rejectUser('${user.id}')" title="Reject"><i data-lucide="x" style="width:14px;height:14px"></i></button>` : ''}
                        ${user.status === 'active' ? `<button class="btn btn-sm btn-ghost" onclick="markInactive('${user.id}')" title="Mark Inactive"><i data-lucide="pause-circle" style="width:14px;height:14px"></i></button>` : ''}
                        ${user.status === 'inactive' ? `<button class="btn btn-sm btn-success" onclick="activateUser('${user.id}')" title="Activate"><i data-lucide="play-circle" style="width:14px;height:14px"></i></button>` : ''}
                        ${user.status !== 'suspended' && user.status !== 'inactive' ? `<button class="btn btn-sm btn-warning" onclick="suspendUser('${user.id}')" title="Suspend"><i data-lucide="ban" style="width:14px;height:14px"></i></button>` : ''}
                        ${user.status === 'suspended' ? `<button class="btn btn-sm btn-success" onclick="activateUser('${user.id}')" title="Activate"><i data-lucide="check-circle" style="width:14px;height:14px"></i></button>` : ''}
                        ${user.id !== currentUser.uid ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    lucide.createIcons();
}

window.openCreateModal = function() {
    document.getElementById('createUserForm').reset();
    document.getElementById('createAlert').style.display = 'none';
    toggleRoleFields();
    document.getElementById('createModal').classList.add('active');
};

window.closeCreateModal = function() {
    document.getElementById('createModal').classList.remove('active');
};

window.toggleRoleFields = function() {
    const role = document.getElementById('createRole').value;
    document.getElementById('createStudentFields').style.display = role === 'student' ? 'block' : 'none';
    document.getElementById('createStaffFields').style.display = (role === 'doctor' || role === 'nurse' || role === 'admin') ? 'block' : 'none';
};

window.createUser = async function() {
    const firstName = document.getElementById('createFirstName').value.trim();
    const lastName = document.getElementById('createLastName').value.trim();
    const email = document.getElementById('createEmail').value.trim();
    const password = document.getElementById('createPassword').value;
    const confirmPassword = document.getElementById('createConfirmPassword').value;
    const role = document.getElementById('createRole').value;
    
    document.getElementById('createAlert').style.display = 'none';
    
    if (!firstName || !lastName || !email || !password) {
        showAlert('createAlert', 'Please fill in all required fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showAlert('createAlert', 'Passwords do not match', 'error');
        return;
    }
    
    if (!validatePassword(password)) {
        showAlert('createAlert', 'Password must be 8+ chars with uppercase, number, special char', 'error');
        return;
    }
    
    const btn = document.getElementById('createUserBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating...';
    
    try {
        const userCredential = await auth.adminCreateUser(email, password, role, firstName + ' ' + lastName);
        const user = userCredential.user;
        
        const userData = {
            firstName,
            lastName,
            email,
            role,
            status: role === 'student' ? 'active' : 'pending_approval',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            emailVerified: false
        };
        
        if (role === 'student') {
            userData.studentId = document.getElementById('createStudentId').value || '';
            userData.department = document.getElementById('createDepartment').value || '';
            userData.level = document.getElementById('createLevel').value || '';
        } else {
            userData.staffId = document.getElementById('createStaffId').value || '';
            userData.specialization = document.getElementById('createSpecialization').value || '';
        }
        
        await db.collection('users').doc(user.uid).set(userData);
        
        showToast('User created successfully!', 'success');
        closeCreateModal();
        
    } catch (error) {
        let msg = 'Error creating user';
        if (error.code === 'auth/email-already-in-use') msg = 'Email already registered';
        showAlert('createAlert', msg, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="user-plus" style="width:16px;height:16px"></i> Create User';
        lucide.createIcons();
    }
};

window.openEditUser = async function(id) {
    document.getElementById('editUserId').value = id;
    const doc = await db.collection('users').doc(id).get();
    if (doc.exists) {
        const user = doc.data();
        document.getElementById('editFirstName').value = user.firstName || '';
        document.getElementById('editLastName').value = user.lastName || '';
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editRole').value = user.role || 'student';
        document.getElementById('editStatus').value = user.status || 'pending_approval';
        document.getElementById('editStudentId').value = user.studentId || '';
        document.getElementById('editStaffId').value = user.staffId || '';
        document.getElementById('editDepartment').value = user.department || '';
        document.getElementById('editSpecialization').value = user.specialization || '';
        toggleEditRoleFields();
    }
    document.getElementById('userModal').classList.add('active');
};

window.closeUserModal = function() {
    document.getElementById('userModal').classList.remove('active');
};

window.toggleEditRoleFields = function() {
    const role = document.getElementById('editRole').value;
    document.getElementById('editStudentFields').style.display = role === 'student' ? 'block' : 'none';
    document.getElementById('editStaffFields').style.display = (role === 'doctor' || role === 'nurse' || role === 'admin') ? 'block' : 'none';
};

window.updateUser = async function() {
    const id = document.getElementById('editUserId').value;
    const firstName = document.getElementById('editFirstName').value.trim();
    const lastName = document.getElementById('editLastName').value.trim();
    const role = document.getElementById('editRole').value;
    const status = document.getElementById('editStatus').value;
    
    if (!firstName || !lastName) {
        showToast('First and last name are required', 'error');
        return;
    }
    
    try {
        const updates = { firstName, lastName, role, status };
        
        if (role === 'student') {
            updates.studentId = document.getElementById('editStudentId').value || '';
            updates.department = document.getElementById('editDepartment').value || '';
        } else {
            updates.staffId = document.getElementById('editStaffId').value || '';
            updates.specialization = document.getElementById('editSpecialization').value || '';
        }
        
        await db.collection('users').doc(id).update(updates);
        await logActivity(currentUser.uid, 'user_update', `Updated user: ${firstName} ${lastName}`);
        showToast('User updated successfully', 'success');
        closeUserModal();
    } catch (error) {
        showToast('Error updating user', 'error');
    }
};

window.viewUser = async function(id) {
    const doc = await db.collection('users').doc(id).get();
    if (!doc.exists) return;
    
    const user = doc.data();
    const statusClass = user.status === 'active' ? 'success' : user.status === 'suspended' ? 'danger' : user.status === 'inactive' ? 'secondary' : 'warning';
    const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase();
    
    const profileHTML = `
        <div style="text-align:center;margin-bottom:24px;">
            <div style="width:80px;height:80px;border-radius:50%;background:var(--primary-500);color:white;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;margin:0 auto 12px;">${initials}</div>
            <h3 style="font-size:20px;margin-bottom:4px;">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</h3>
            <span class="badge badge-${statusClass}">${user.status}</span>
        </div>
        <div style="display:grid;gap:12px;">
            <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);">
                <label style="font-size:12px;color:var(--text-muted);">Email</label>
                <p style="margin:4px 0 0;font-weight:500;">${escapeHtml(user.email)}</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);">
                    <label style="font-size:12px;color:var(--text-muted);">Role</label>
                    <p style="margin:4px 0 0;font-weight:500;text-transform:capitalize;">${escapeHtml(user.role)}</p>
                </div>
                <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);">
                    <label style="font-size:12px;color:var(--text-muted);">ID</label>
                    <p style="margin:4px 0 0;font-weight:500;">${escapeHtml(user.studentId || user.staffId || 'N/A')}</p>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);">
                    <label style="font-size:12px;color:var(--text-muted);">Department</label>
                    <p style="margin:4px 0 0;font-weight:500;">${escapeHtml(user.department || user.specialization || 'N/A')}</p>
                </div>
                <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);">
                    <label style="font-size:12px;color:var(--text-muted);">Level</label>
                    <p style="margin:4px 0 0;font-weight:500;">${escapeHtml(user.level || 'N/A')}</p>
                </div>
            </div>
            <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);">
                <label style="font-size:12px;color:var(--text-muted);">Created</label>
                <p style="margin:4px 0 0;font-weight:500;">${formatDate(user.createdAt)}</p>
            </div>
        </div>
    `;
    
    document.getElementById('viewUserContent').innerHTML = profileHTML;
    document.getElementById('viewUserModal').classList.add('active');
    lucide.createIcons();
};

function applyUrlFilters() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status) {
        const statusSelect = document.getElementById('filterStatus');
        if (statusSelect) {
            statusSelect.value = status;
            const query = document.getElementById('searchUsers')?.value.toLowerCase() || '';
            const role = document.getElementById('filterRole').value;
            filterUsers(query, role, status);
        }
    }
}

window.closeViewModal = function() {
    document.getElementById('viewUserModal').classList.remove('active');
};

window.approveUser = async function(id) {
    try {
        await db.collection('users').doc(id).update({ status: 'active' });
        await logActivity(currentUser.uid, 'user_approve', `Approved user: ${id}`);
        showToast('User approved', 'success');
    } catch (error) {
        showToast('Error approving user', 'error');
    }
};

window.rejectUser = async function(id) {
    if (!confirm('Reject this user? This will delete their account.')) return;
    try {
        await db.collection('users').doc(id).delete();
        await logActivity(currentUser.uid, 'user_reject', `Rejected user: ${id}`);
        showToast('User rejected and removed', 'success');
    } catch (error) {
        showToast('Error rejecting user', 'error');
    }
};

window.activateUser = async function(id) {
    try {
        await db.collection('users').doc(id).update({ status: 'active' });
        showToast('User activated', 'success');
    } catch (error) {
        showToast('Error activating user', 'error');
    }
};

window.markInactive = async function(id) {
    if (!confirm('Mark this user as inactive? They will have read-only access.')) return;
    try {
        await db.collection('users').doc(id).update({ status: 'inactive' });
        await logActivity(currentUser.uid, 'user_deactivate', `Marked user inactive: ${id}`);
        showToast('User marked inactive', 'success');
    } catch (error) {
        showToast('Error marking user inactive', 'error');
    }
};

window.suspendUser = function(id) {
    if (!confirm('Are you sure you want to suspend this user?')) return;
    db.collection('users').doc(id).update({ status: 'suspended' }).then(async () => {
        await logActivity(currentUser.uid, 'user_suspend', `Suspended user: ${id}`);
        showToast('User suspended', 'success');
    }).catch(() => showToast('Error suspending user', 'error'));
};

window.deleteUser = function(id) {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone!')) return;
    db.collection('users').doc(id).delete().then(async () => {
        await logActivity(currentUser.uid, 'user_delete', `Deleted user: ${id}`);
        showToast('User deleted', 'success');
    }).catch(() => showToast('Error deleting user', 'error'));
};

window.rejectUser = async function(id) {
    if (!confirm('Reject this user? The user account will be deleted.')) return;
    try {
        await db.collection('users').doc(id).delete();
        await logActivity(currentUser.uid, 'user_reject', `Rejected user: ${id}`);
        showToast('User rejected and removed', 'success');
    } catch (error) {
        showToast('Error rejecting user', 'error');
    }
};

window.bulkApprove = async function() {
    for (const id of selectedUsers) {
        await db.collection('users').doc(id).update({ status: 'active' });
    }
    await logActivity(currentUser.uid, 'bulk_approve', `Approved ${selectedUsers.length} users`);
    showToast(`${selectedUsers.length} users approved`, 'success');
    selectedUsers = [];
    updateBulkActions();
};

window.bulkSuspend = async function() {
    for (const id of selectedUsers) {
        await db.collection('users').doc(id).update({ status: 'suspended' });
    }
    await logActivity(currentUser.uid, 'bulk_suspend', `Suspended ${selectedUsers.length} users`);
    showToast(`${selectedUsers.length} users suspended`, 'success');
    selectedUsers = [];
    updateBulkActions();
};

window.bulkDelete = async function() {
    if (!confirm(`Delete ${selectedUsers.length} users? This cannot be undone!`)) return;
    for (const id of selectedUsers) {
        await db.collection('users').doc(id).delete();
    }
    await logActivity(currentUser.uid, 'bulk_delete', `Deleted ${selectedUsers.length} users`);
    showToast(`${selectedUsers.length} users deleted`, 'success');
    selectedUsers = [];
    updateBulkActions();
};