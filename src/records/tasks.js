let currentUser = null;
let userData = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    lucide.createIcons();
    
    const result = await guardPage();
    if (!result) return;
    
    currentUser = result.user;
    userData = result.userData;
    
    loadPatients();
    loadTasks();
    setupTaskFilter();
});

function setupTaskFilter() {
    document.getElementById('filterTaskStatus')?.addEventListener('change', function() {
        const status = this.value;
        document.querySelectorAll('#tasksTable tr').forEach(row => {
            if (!status) { row.style.display = ''; return; }
            const cell = row.cells[5];
            if (cell && cell.textContent.trim().toLowerCase().replace(' ', '-') === status) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

async function loadPatients() {
    const select = document.getElementById('taskPatient');
    if (!select) return;
    
    try {
        const snapshot = await db.collection('users').where('role', '==', 'student').get();
        select.innerHTML = '<option value="">None</option>';
        snapshot.forEach(doc => {
            const data = doc.data();
            select.innerHTML += `<option value="${doc.id}">${data.firstName} ${data.lastName}</option>`;
        });
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

async function loadTasks() {
    const tbody = document.getElementById('tasksTable');
    if (!tbody) return;

    try {
        const snapshot = await db.collection('tasks').orderBy('createdAt', 'desc').get();
        
        let pending = 0, inProgress = 0, completed = 0;
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i data-lucide="list-todo" style="width:48px;height:48px;color:var(--gray-300);margin-bottom:16px"></i><h3>No Tasks</h3><p>Add your first task</p></td></tr>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            const usersCache = {};
            const userIds = new Set();
            snapshot.docs.forEach(d => {
                const data = d.data();
                if (data.patientId) userIds.add(data.patientId);
                if (data.assignedBy) userIds.add(data.assignedBy);
            });
            
            for (const id of userIds) {
                const uDoc = await db.collection('users').doc(id).get();
                usersCache[id] = uDoc.exists ? uDoc.data() : null;
            }
            
            tbody.innerHTML = snapshot.docs.map(doc => {
                const task = doc.data();
                const patient = usersCache[task.patientId];
                const assignedBy = usersCache[task.assignedBy];
                
                if (task.status === 'pending') pending++;
                else if (task.status === 'in-progress') inProgress++;
                else if (task.status === 'completed') completed++;
                
                const priorityClass = task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : task.priority === 'medium' ? 'info' : 'success';
                const statusClass = task.status === 'completed' ? 'success' : task.status === 'in-progress' ? 'primary' : 'warning';
                
                let actions = '';
                if (task.status === 'pending') {
                    actions = `<button class="btn btn-sm btn-primary" onclick="updateTaskStatus('${doc.id}', 'in-progress')">Start</button>`;
                } else if (task.status === 'in-progress') {
                    actions = `<button class="btn btn-sm btn-success" onclick="updateTaskStatus('${doc.id}', 'completed')">Complete</button>`;
                }
                actions += ` <button class="btn btn-sm btn-danger" onclick="deleteTask('${doc.id}')">Delete</button>`;
                
                return `
                    <tr>
                        <td>${escapeHtml(task.description)}</td>
                        <td><span class="badge badge-${priorityClass}">${escapeHtml(task.priority)}</span></td>
                        <td>${patient ? `${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}` : '-'}</td>
                        <td>${assignedBy ? `${escapeHtml(assignedBy.firstName)} ${escapeHtml(assignedBy.lastName)}` : '-'}</td>
                        <td>${task.dueDate ? formatDate(task.dueDate) : '-'}</td>
                        <td><span class="badge badge-${statusClass}">${escapeHtml(task.status)}</span></td>
                        <td>${actions}</td>
                    </tr>
                `;
            }).join('');
        }
        
        document.getElementById('pendingTasks').textContent = pending;
        document.getElementById('inProgressTasks').textContent = inProgress;
        document.getElementById('completedTasks').textContent = completed;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
    } catch (error) {
        console.error('Error loading tasks:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><h3>Error Loading Tasks</h3><p>Please try again</p></td></tr>';
    }
}

function openTaskModal() {
    document.getElementById('taskForm').reset();
    loadPatients();
    document.getElementById('taskModal').classList.add('active');
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
}

async function saveTask() {
    const description = sanitizeInput(document.getElementById('taskDescription').value);
    const priority = document.getElementById('taskPriority').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const patientId = document.getElementById('taskPatient').value;
    
    if (!description) {
        showToast('Please enter a task description', 'warning');
        return;
    }
    
    try {
        await db.collection('tasks').add({
            description,
            priority,
            dueDate: dueDate || null,
            patientId: patientId || null,
            assignedBy: currentUser.uid,
            assignedTo: currentUser.uid,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Task added successfully', 'success');
        logActivity(currentUser.uid, 'task-create', 'Created new task');
        closeTaskModal();
        loadTasks();
    } catch (error) {
        console.error('Error adding task:', error);
        showToast('Error adding task', 'error');
    }
}

async function updateTaskStatus(id, status) {
    try {
        const statusText = status === 'in-progress' ? 'started' : 'completed';
        await db.collection('tasks').doc(id).update({ status });
        showToast(`Task ${statusText}`, 'success');
        loadTasks();
    } catch (error) {
        console.error('Error updating task:', error);
        showToast('Error updating task', 'error');
    }
}

async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    try {
        await db.collection('tasks').doc(id).delete();
        showToast('Task deleted', 'success');
        loadTasks();
    } catch (error) {
        console.error('Error deleting task:', error);
        showToast('Error deleting task', 'error');
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
