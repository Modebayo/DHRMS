let currentUser = null;
let userData = null;
let editingDrugId = null;
let inventoryUnsub = null;

// Auth handled by guardPage() in HTML

function setupInventorySearch() {
    const search = document.getElementById('searchInventory');
    if (search) {
        search.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('#inventoryTable tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    }
}

function subscribeInventory() {
    if (inventoryUnsub) inventoryUnsub();
    const tbody = document.getElementById('inventoryTable');
    if (!tbody) return;
    
    let lowStockAlertShown = false;

    inventoryUnsub = db.collection('inventory').orderBy('name').onSnapshot((snapshot) => {
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i data-lucide="package" style="width:48px;height:48px;color:var(--gray-300);margin-bottom:16px"></i><h3>No Inventory</h3><p>Add medications to inventory</p></td></tr>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }
        
        let lowCount = 0;
        
        tbody.innerHTML = snapshot.docs.map(doc => {
            const drug = doc.data();
            const stockLevel = drug.quantity <= 10 ? 'danger' : drug.quantity <= 50 ? 'warning' : 'success';
            const stockLabel = drug.quantity <= 10 ? 'Low' : drug.quantity <= 50 ? 'Medium' : 'Good';
            
            if (drug.quantity <= 10) lowCount++;
            
            return `
                <tr>
                    <td><strong>${drug.name}</strong></td>
                    <td>${drug.category}</td>
                    <td>${drug.quantity}</td>
                    <td>${drug.unit}</td>
                    <td>${formatDate(drug.expiry)}</td>
                    <td><span class="badge badge-${stockLevel}">${stockLabel}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="editDrug('${doc.id}')"><i data-lucide="pencil" style="width:14px;height:14px"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteDrug('${doc.id}')"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();

        if (lowCount > 0 && !lowStockAlertShown) {
            lowStockAlertShown = true;
            showToast('⚠ ' + lowCount + ' ' + (lowCount === 1 ? 'item' : 'items') + ' low in stock. Please reorder.', 'warning');
        }
    }, (error) => {
        console.error('Inventory subscription error:', error);
    });
}

function openDrugModal() {
    editingDrugId = null;
    document.getElementById('drugForm').reset();
    document.getElementById('drugModal').classList.add('active');
}

function closeDrugModal() {
    document.getElementById('drugModal').classList.remove('active');
}

async function saveDrug() {
    const name = sanitizeInput(document.getElementById('drugName').value);
    const category = document.getElementById('drugCategory').value;
    const quantity = parseInt(document.getElementById('drugQuantity').value);
    const unit = document.getElementById('drugUnit').value;
    const expiry = document.getElementById('drugExpiry').value;
    
    if (!name || !category || isNaN(quantity) || !expiry) {
        showToast('Please fill all fields', 'warning');
        return;
    }
    
    try {
        const drugData = { name, category, quantity, unit, expiry, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        
        if (editingDrugId) {
            await db.collection('inventory').doc(editingDrugId).update(drugData);
            showToast('Medication updated', 'success');
        } else {
            drugData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('inventory').add(drugData);
            showToast('Medication added', 'success');
        }
        
        closeDrugModal();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error saving medication', 'error');
    }
}

async function editDrug(id) {
    const doc = await db.collection('inventory').doc(id).get();
    if (!doc.exists) return;
    
    const drug = doc.data();
    editingDrugId = id;
    
    document.getElementById('drugName').value = drug.name;
    document.getElementById('drugCategory').value = drug.category;
    document.getElementById('drugQuantity').value = drug.quantity;
    document.getElementById('drugUnit').value = drug.unit;
    document.getElementById('drugExpiry').value = drug.expiry;
    
    document.getElementById('drugModal').classList.add('active');
}

async function deleteDrug(id) {
    if (!confirm('Delete this medication?')) return;
    
    try {
        await db.collection('inventory').doc(id).delete();
        showToast('Medication deleted', 'success');
    } catch (error) {
        showToast('Error deleting', 'error');
    }
}

function populateUserProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && userData) nameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    if (roleEl && userData) roleEl.textContent = userData.role?.replace(/_/g, ' ') || 'Role';
    if (avatarEl && userData) avatarEl.textContent = (userData.firstName?.[0] || 'U').toUpperCase();
}
