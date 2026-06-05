let currentUser = null;
let userData = null;
let activeVisits = [];

const WORKFLOW_STAGES = [
    { id: 'arrival', name: 'Patient Arrival', icon: 'log-in', description: 'Patient checks in at the clinic' },
    { id: 'triage', name: 'Triage & Vitals', icon: 'activity', description: 'Nurse records vitals and triages patient' },
    { id: 'consultation', name: 'Doctor Consultation', icon: 'stethoscope', description: 'Doctor examines patient' },
    { id: 'diagnosis', name: 'Diagnosis & Plan', icon: 'clipboard-list', description: 'Diagnosis made and treatment plan created' },
    { id: 'treatment', name: 'Treatment', icon: 'pill', description: 'Treatment administered' },
    { id: 'discharge', name: 'Discharge', icon: 'log-out', description: 'Patient discharged with instructions' }
];

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    lucide.createIcons();

    const result = await guardPage();
    if (!result) return;

    currentUser = result.user;
    userData = result.userData;

    populateUserProfile();
    loadPatients();
    loadNurses();
    loadVisits();

    const filterEl = document.getElementById('visitFilter');
    if (filterEl) filterEl.addEventListener('change', loadVisits);
});

function populateUserProfile() {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && userData) nameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
    if (roleEl && userData) roleEl.textContent = userData.role?.replace(/_/g, ' ') || 'Role';
    if (avatarEl && userData) avatarEl.textContent = (userData.firstName?.[0] || 'U').toUpperCase();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('sidebar-hidden');
    if (toggleBtn) toggleBtn.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
    document.body.classList.toggle('sidebar-open');
}

async function loadPatients() {
    const select = document.getElementById('visitPatient');
    if (!select) return;
    try {
        const snapshot = await db.collection('users').where('role', '==', 'student').where('status', '==', 'active').get();
        select.innerHTML = '<option value="">Select patient</option>';
        snapshot.forEach(doc => {
            const u = doc.data();
            select.innerHTML += `<option value="${doc.id}">${u.firstName} ${u.lastName}</option>`;
        });
    } catch (e) {
        console.error('Error loading patients:', e);
    }
}

async function loadNurses() {
    const select = document.getElementById('assignedNurse');
    if (!select) return;
    try {
        const snapshot = await db.collection('users').where('role', '==', 'nurse').where('status', '==', 'active').get();
        select.innerHTML = '<option value="">Not assigned</option>';
        snapshot.forEach(doc => {
            const u = doc.data();
            select.innerHTML += `<option value="${doc.id}">${u.firstName} ${u.lastName}</option>`;
        });
    } catch (e) {
        console.error('Error loading nurses:', e);
    }
}

async function loadVisits() {
    try {
        const filter = document.getElementById('visitFilter').value;
        const today = new Date().toISOString().split('T')[0];
        let snapshot;

        if (filter === 'active') {
            snapshot = await db.collection('visits')
                .where('status', 'in', ['waiting', 'in-progress'])
                .orderBy('createdAt', 'desc')
                .get();
        } else if (filter === 'completed') {
            snapshot = await db.collection('visits')
                .where('status', '==', 'completed')
                .orderBy('completedAt', 'desc')
                .limit(20)
                .get();
        } else {
            snapshot = await db.collection('visits')
                .where('date', '==', today)
                .orderBy('createdAt', 'desc')
                .get();
        }

        activeVisits = snapshot.docs;

        let waiting = 0, inProgress = 0, completed = 0;
        activeVisits.forEach(doc => {
            const v = doc.data();
            if (v.status === 'waiting') waiting++;
            else if (v.status === 'in-progress') inProgress++;
            else if (v.status === 'completed') completed++;
        });

        setText('totalVisits', activeVisits.length);
        setText('waitingVisits', waiting);
        setText('inProgressVisits', inProgress);
        setText('completedVisits', completed);

        renderActiveVisits();
        renderVisitWorkflows();
    } catch (e) {
        console.error('Error loading visits:', e);
        showToast('Error loading visits. Check Firestore indexes.', 'error');
    }
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function renderActiveVisits() {
    const list = document.getElementById('activeVisitsList');
    if (!list) return;
    const active = activeVisits.filter(doc => doc.data().status !== 'completed');
    if (active.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">No active visits</p>';
        return;
    }
    list.innerHTML = active.slice(0, 5).map(doc => {
        const v = doc.data();
        const statusColor = v.status === 'waiting' ? 'warning' : 'info';
        return `
            <div style="padding:12px;border-bottom:1px solid var(--border-light);cursor:pointer" onclick="viewVisitDetail('${doc.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <strong>${escapeHtml(v.patientName || 'Unknown')}</strong>
                    <span class="badge badge-${statusColor}">${escapeHtml(v.status)}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
                    ${escapeHtml(v.visitType || 'N/A')} &bull; ${escapeHtml(v.currentStage || 'Arrival')}
                </div>
            </div>
        `;
    }).join('');
}

function renderVisitWorkflows() {
    const list = document.getElementById('visitWorkflowList');
    if (!list) return;
    if (activeVisits.length === 0) {
        list.innerHTML = '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:40px">No visits found</p></div>';
        return;
    }
    list.innerHTML = activeVisits.map(doc => renderWorkflowCard(doc.id, doc.data())).join('');
    lucide.createIcons();
}

function renderWorkflowCard(visitId, visit) {
    const currentIndex = WORKFLOW_STAGES.findIndex(s => s.id === visit.currentStage);
    const idx = currentIndex >= 0 ? currentIndex : 0;

    const stages = WORKFLOW_STAGES.map((stage, index) => {
        let stageStatus = 'pending';
        if (index < idx) stageStatus = 'completed';
        else if (index === idx && visit.status !== 'completed') stageStatus = 'active';
        return { ...stage, stageStatus };
    });

    return `
        <div style="background:var(--bg-secondary);border-radius:var(--radius-lg);padding:20px;margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
                <div>
                    <h4 style="margin:0 0 4px 0">${escapeHtml(visit.patientName || 'Unknown')}</h4>
                    <p style="margin:0;font-size:13px;color:var(--text-muted)">${escapeHtml(visit.visitType || 'N/A')} &bull; ${formatDate(visit.date)}</p>
                </div>
                <div style="text-align:right">
                    <span class="badge badge-${visit.status === 'completed' ? 'success' : visit.priority === 'urgent' ? 'danger' : 'primary'}">
                        ${visit.status === 'completed' ? 'Discharged' : escapeHtml(visit.status)}
                    </span>
                    ${visit.priority && visit.priority !== 'normal' ? `<span class="badge badge-${visit.priority === 'critical' ? 'danger' : 'warning'}" style="margin-left:4px">${escapeHtml(visit.priority)}</span>` : ''}
                </div>
            </div>
            <div class="workflow-timeline">
                ${stages.map(stage => `
                    <div class="workflow-step ${stage.stageStatus}" onclick="advanceStage('${visitId}', '${stage.id}')">
                        <div class="step-header">
                            <span class="step-title"><i data-lucide="${stage.icon}" style="width:16px;height:16px;display:inline;margin-right:8px"></i>${stage.name}</span>
                            ${stage.stageStatus === 'active' ? '<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();advanceToNextStage(\'' + visitId + '\')"><i data-lucide="arrow-right" style="width:14px;height:14px"></i> Complete</button>' : ''}
                        </div>
                        <div class="step-description">${stage.description}</div>
                        ${stage.stageStatus === 'completed' && visit.stageData && visit.stageData[stage.id] ? `
                            <div style="font-size:12px;color:var(--success-600);margin-top:8px">
                                <i data-lucide="check" style="width:12px;height:12px"></i> Completed: ${formatTimestamp(visit.stageData[stage.id].completedAt)}
                            </div>
                        ` : ''}
                        ${stage.id === 'treatment' && stage.stageStatus === 'active' ? `
                            <div style="margin-top:8px">
                                <a href="treatment.html?visitId=${visitId}" class="btn btn-sm btn-warning"><i data-lucide="pill" style="width:14px;height:14px"></i> Administer Treatment</a>
                            </div>
                        ` : ''}
                        ${stage.id === 'consultation' && stage.stageStatus === 'active' ? `
                            <div style="margin-top:8px">
                                <a href="add-diagnosis.html?visitId=${visitId}" class="btn btn-sm btn-primary"><i data-lucide="stethoscope" style="width:14px;height:14px"></i> Add Diagnosis</a>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            ${visit.status !== 'completed' ? `
                <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-color);display:flex;gap:8px">
                    <button class="btn btn-sm btn-outline" onclick="viewVisitDetail('${visitId}')"><i data-lucide="eye" style="width:14px;height:14px"></i> View Details</button>
                    <button class="btn btn-sm btn-primary" onclick="openDischargeModal('${visitId}')"><i data-lucide="log-out" style="width:14px;height:14px"></i> Discharge</button>
                </div>
            ` : `
                <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-color)">
                    <button class="btn btn-sm btn-outline" onclick="viewDischargeSummary('${visitId}')"><i data-lucide="file-text" style="width:14px;height:14px"></i> View Discharge Summary</button>
                </div>
            `}
        </div>
    `;
}

function advanceStage(visitId, stageId) {
    viewVisitDetail(visitId);
}

async function advanceToNextStage(visitId) {
    try {
        const doc = await db.collection('visits').doc(visitId).get();
        if (!doc.exists) return;

        const visit = doc.data();
        const currentIndex = WORKFLOW_STAGES.findIndex(s => s.id === visit.currentStage);
        const nextStage = WORKFLOW_STAGES[currentIndex + 1];

        if (!nextStage) {
            openDischargeModal(visitId);
            return;
        }

        const updates = {
            currentStage: nextStage.id,
            status: nextStage.id === 'consultation' || nextStage.id === 'diagnosis' || nextStage.id === 'triage' ? 'in-progress' : 'waiting',
            [`stageData.${visit.currentStage}`]: {
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                completedBy: currentUser.uid
            }
        };

        await db.collection('visits').doc(visitId).update(updates);
        await notifyStageTransition(visitId, visit, nextStage);
        showToast(`${nextStage.name} started`, 'success');
        loadVisits();
    } catch (e) {
        console.error('Error advancing stage:', e);
        showToast('Error advancing stage', 'error');
    }
}

async function notifyStageTransition(visitId, visit, nextStage) {
    try {
        let message = '';
        if (nextStage.id === 'triage') message = `Patient ${visit.patientName} is waiting for triage. Please record vitals.`;
        else if (nextStage.id === 'consultation') message = `Patient ${visit.patientName} is ready for consultation.`;
        else if (nextStage.id === 'diagnosis') message = `Consultation completed for ${visit.patientName}. Please create diagnosis.`;
        else if (nextStage.id === 'treatment') message = `Treatment plan ready for ${visit.patientName}.`;

        if (message) {
            const targetRole = nextStage.id === 'triage' ? 'nurse' : 'doctor';
            const snapshot = await db.collection('users').where('role', '==', targetRole).where('status', '==', 'active').get();
            const batch = [];
            snapshot.forEach(uDoc => {
                batch.push(db.collection('notifications').add({
                    userId: uDoc.id,
                    type: 'workflow',
                    title: `Visit Update: ${nextStage.name}`,
                    message: message,
                    read: false,
                    visitId: visitId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }));
            });
            await Promise.all(batch);
        }
    } catch (e) {
        console.error('Error sending notifications:', e);
    }
}

function openNewVisitModal() {
    const form = document.getElementById('newVisitForm');
    if (form) form.reset();
    loadPatients();
    loadNurses();
    const modal = document.getElementById('newVisitModal');
    if (modal) modal.classList.add('active');
}

function closeNewVisitModal() {
    const modal = document.getElementById('newVisitModal');
    if (modal) modal.classList.remove('active');
}

async function startVisit() {
    const patientId = document.getElementById('visitPatient').value;
    const visitType = document.getElementById('visitType').value;
    const priority = document.getElementById('visitPriority').value;
    const complaint = document.getElementById('chiefComplaint').value;
    const nurseId = document.getElementById('assignedNurse').value;

    if (!patientId || !visitType) {
        showToast('Please select patient and visit type', 'warning');
        return;
    }

    try {
        const patientDoc = await db.collection('users').doc(patientId).get();
        if (!patientDoc.exists) {
            showToast('Patient not found', 'error');
            return;
        }
        const patient = patientDoc.data();

        await db.collection('visits').add({
            patientId: patientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            visitType: visitType,
            priority: priority || 'normal',
            chiefComplaint: complaint || '',
            assignedNurse: nurseId || '',
            currentStage: 'arrival',
            status: 'waiting',
            date: new Date().toISOString().split('T')[0],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            stageData: {
                arrival: {
                    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    completedBy: currentUser.uid
                }
            }
        });

        showToast('Visit started successfully', 'success');
        logActivity(currentUser.uid, 'visit-start', `Started visit for ${patient.firstName} ${patient.lastName}`);
        closeNewVisitModal();
        loadVisits();
    } catch (e) {
        console.error('Error starting visit:', e);
        showToast('Error starting visit', 'error');
    }
}

function openDischargeModal(visitId) {
    document.getElementById('dischargeVisitId').value = visitId;
    const form = document.getElementById('dischargeForm');
    if (form) form.reset();
    const modal = document.getElementById('dischargeModal');
    if (modal) modal.classList.add('active');
}

function closeDischargeModal() {
    const modal = document.getElementById('dischargeModal');
    if (modal) modal.classList.remove('active');
}

async function completeDischarge() {
    const visitId = document.getElementById('dischargeVisitId').value;
    const diagnosis = document.getElementById('finalDiagnosis').value;
    const treatment = document.getElementById('treatmentSummary').value;
    const prescription = document.getElementById('dischargePrescription').value;
    const followUp = document.getElementById('followUpRequired').value;
    const instructions = document.getElementById('specialInstructions').value;

    const conditions = [];
    if (document.getElementById('condition-stable')?.checked) conditions.push('Stable');
    if (document.getElementById('condition-improved')?.checked) conditions.push('Improved');
    if (document.getElementById('condition-recovered')?.checked) conditions.push('Recovered');
    if (document.getElementById('condition-referred')?.checked) conditions.push('Referred');

    if (!diagnosis) {
        showToast('Final diagnosis is required', 'warning');
        return;
    }

    try {
        const visitDoc = await db.collection('visits').doc(visitId).get();
        if (!visitDoc.exists) return;
        const visit = visitDoc.data();

        await db.collection('visits').doc(visitId).update({
            status: 'completed',
            currentStage: 'discharge',
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            dischargeData: {
                diagnosis,
                treatmentSummary: treatment,
                prescription,
                followUpRequired: followUp,
                specialInstructions: instructions,
                conditions,
                dischargedBy: currentUser.uid
            }
        });

        if (prescription) {
            await db.collection('prescriptions').add({
                patientId: visit.patientId,
                patientName: visit.patientName,
                medication: prescription,
                prescribedBy: currentUser.uid,
                status: 'pending',
                visitId: visitId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        if (followUp !== 'no') {
            const followUpDate = new Date();
            if (followUp === '1-week') followUpDate.setDate(followUpDate.getDate() + 7);
            else if (followUp === '2-weeks') followUpDate.setDate(followUpDate.getDate() + 14);
            else if (followUp === '1-month') followUpDate.setMonth(followUpDate.getMonth() + 1);

            await db.collection('appointments').add({
                patientId: visit.patientId,
                patientName: visit.patientName,
                type: 'follow-up',
                reason: `Follow-up: ${diagnosis}`,
                date: followUpDate.toISOString().split('T')[0],
                status: 'pending',
                visitId: visitId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        await db.collection('notifications').add({
            userId: visit.patientId,
            type: 'discharge',
            title: 'Visit Completed',
            message: `Your visit has been completed. ${followUp !== 'no' ? 'A follow-up appointment has been scheduled.' : 'No follow-up needed.'}`,
            visitId: visitId,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Patient discharged successfully', 'success');
        logActivity(currentUser.uid, 'patient-discharge', `Discharged patient: ${visit.patientName}`);
        closeDischargeModal();
        loadVisits();
    } catch (e) {
        console.error('Error discharging patient:', e);
        showToast('Error completing discharge', 'error');
    }
}

async function viewVisitDetail(visitId) {
    try {
        const doc = await db.collection('visits').doc(visitId).get();
        if (!doc.exists) return;

        const visit = doc.data();
        const patientDoc = await db.collection('users').doc(visit.patientId).get();
        const patient = patientDoc.exists ? patientDoc.data() : null;

        setText('workflowDetailTitle', `Visit: ${visit.patientName || 'Unknown'}`);

        const body = document.getElementById('workflowDetailBody');
        if (!body) return;

        body.innerHTML = `
            <div class="visit-summary">
                <h4><i data-lucide="user" style="width:16px;height:16px;display:inline;margin-right:8px"></i>Patient Information</h4>
                <div class="summary-grid">
                    <div class="summary-item"><label>Name</label><span>${escapeHtml(visit.patientName)}</span></div>
                    <div class="summary-item"><label>Student ID</label><span>${escapeHtml(patient?.studentId) || 'N/A'}</span></div>
                    <div class="summary-item"><label>Department</label><span>${escapeHtml(patient?.department) || 'N/A'}</span></div>
                    <div class="summary-item"><label>Contact</label><span>${escapeHtml(patient?.phone) || 'N/A'}</span></div>
                </div>
            </div>
            <div class="visit-summary">
                <h4><i data-lucide="clipboard" style="width:16px;height:16px;display:inline;margin-right:8px"></i>Visit Information</h4>
                <div class="summary-grid">
                    <div class="summary-item"><label>Visit Type</label><span>${escapeHtml(visit.visitType)}</span></div>
                    <div class="summary-item"><label>Priority</label><span class="badge badge-${visit.priority === 'critical' ? 'danger' : visit.priority === 'urgent' ? 'warning' : 'primary'}">${escapeHtml(visit.priority)}</span></div>
                    <div class="summary-item"><label>Status</label><span>${escapeHtml(visit.status)}</span></div>
                    <div class="summary-item"><label>Current Stage</label><span>${escapeHtml(visit.currentStage)}</span></div>
                </div>
                <div style="margin-top:12px">
                    <label style="font-size:12px;color:var(--text-muted)">Chief Complaint</label>
                    <p>${escapeHtml(visit.chiefComplaint) || 'Not specified'}</p>
                </div>
            </div>
            ${visit.vitals ? `
                <div class="visit-summary">
                    <h4><i data-lucide="activity" style="width:16px;height:16px;display:inline;margin-right:8px"></i>Vitals Recorded</h4>
                    <div class="summary-grid">
                        <div class="summary-item"><label>Temperature</label><span>${escapeHtml(visit.vitals.temperature) || 'N/A'} &deg;C</span></div>
                        <div class="summary-item"><label>Pulse</label><span>${escapeHtml(visit.vitals.pulse) || 'N/A'} bpm</span></div>
                        <div class="summary-item"><label>BP</label><span>${escapeHtml(visit.vitals.bpSystolic) || 'N/A'}/${escapeHtml(visit.vitals.bpDiastolic) || 'N/A'}</span></div>
                        <div class="summary-item"><label>SpO2</label><span>${escapeHtml(visit.vitals.spo2) || 'N/A'} %</span></div>
                    </div>
                </div>
            ` : ''}
        `;

        document.getElementById('workflowDetailModal').classList.add('active');
        lucide.createIcons();
    } catch (e) {
        console.error('Error viewing visit detail:', e);
        showToast('Error loading visit details', 'error');
    }
}

async function viewDischargeSummary(visitId) {
    try {
        const doc = await db.collection('visits').doc(visitId).get();
        if (!doc.exists) return;

        const visit = doc.data();
        if (!visit.dischargeData) {
            showToast('No discharge data found', 'error');
            return;
        }

        const dd = visit.dischargeData;

        setText('workflowDetailTitle', `Discharge Summary: ${visit.patientName}`);

        const body = document.getElementById('workflowDetailBody');
        if (!body) return;

        body.innerHTML = `
            <div style="text-align:center;margin-bottom:24px">
                <h2 style="color:var(--success-600);margin-bottom:8px"><i data-lucide="check-circle" style="width:48px;height:48px"></i></h2>
                <h3 style="margin:0">Visit Completed</h3>
                <p style="color:var(--text-muted);margin:4px 0 0">Completed on ${formatDate(dd.completedAt)}</p>
            </div>
            <div class="visit-summary">
                <h4><i data-lucide="clipboard-list" style="width:16px;height:16px;display:inline;margin-right:8px"></i>Final Diagnosis</h4>
                <p style="font-size:16px;font-weight:500">${escapeHtml(dd.diagnosis)}</p>
            </div>
            <div class="visit-summary">
                <h4><i data-lucide="pill" style="width:16px;height:16px;display:inline;margin-right:8px"></i>Treatment &amp; Prescription</h4>
                <p>${escapeHtml(dd.treatmentSummary) || 'Standard treatment provided'}</p>
                ${dd.prescription ? `<div style="background:var(--primary-50);padding:12px;border-radius:var(--radius-md);margin-top:8px"><strong>Prescription:</strong> ${escapeHtml(dd.prescription)}</div>` : ''}
            </div>
            <div class="visit-summary">
                <h4><i data-lucide="heart" style="width:16px;height:16px;display:inline;margin-right:8px"></i>Condition at Discharge</h4>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    ${(dd.conditions || []).map(c => `<span class="badge badge-success">${escapeHtml(c)}</span>`).join('')}
                </div>
            </div>
            ${dd.followUpRequired && dd.followUpRequired !== 'no' ? `
                <div class="visit-summary" style="border-color:var(--warning-300);background:var(--warning-50)">
                    <h4><i data-lucide="calendar" style="width:16px;height:16px;display:inline;margin-right:8px"></i>Follow-up Required</h4>
                    <p>${dd.followUpRequired === '1-week' ? '1 Week' : dd.followUpRequired === '2-weeks' ? '2 Weeks' : dd.followUpRequired === '1-month' ? '1 Month' : 'As Needed'}</p>
                </div>
            ` : ''}
            ${dd.specialInstructions ? `
                <div class="visit-summary">
                    <h4><i data-lucide="info" style="width:16px;height:16px;display:inline;margin-right:8px"></i>Special Instructions</h4>
                    <p>${escapeHtml(dd.specialInstructions)}</p>
                </div>
            ` : ''}
            <div style="margin-top:20px;text-align:center">
                <button class="btn btn-outline" onclick="printDischargeSummary('${visitId}')"><i data-lucide="printer" style="width:16px;height:16px"></i> Print Summary</button>
                <button class="btn btn-primary" onclick="sendDischargeSummary('${visitId}')"><i data-lucide="send" style="width:16px;height:16px"></i> Send to Patient</button>
            </div>
        `;

        document.getElementById('workflowDetailModal').classList.add('active');
        lucide.createIcons();
    } catch (e) {
        console.error('Error viewing discharge summary:', e);
        showToast('Error loading discharge summary', 'error');
    }
}

function printDischargeSummary(visitId) {
    const content = document.getElementById('workflowDetailBody')?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
        <html><head><title>Discharge Summary</title>
        <style>body{font-family:Arial;padding:20px}.visit-summary{background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:16px}h4{margin-top:0}</style>
        </head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
}

async function sendDischargeSummary(visitId) {
    try {
        const doc = await db.collection('visits').doc(visitId).get();
        if (!doc.exists) return;
        const visit = doc.data();

        await db.collection('messages').add({
            participants: [currentUser.uid, visit.patientId].sort(),
            subject: 'Visit Discharge Summary',
            lastMessage: 'Your visit summary has been sent. Please check your records.',
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('notifications').add({
            userId: visit.patientId,
            type: 'discharge',
            title: 'Discharge Summary Available',
            message: 'Your visit summary is now available. Please check your records.',
            visitId: visitId,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Summary sent to patient', 'success');
    } catch (e) {
        console.error('Error sending summary:', e);
        showToast('Error sending summary', 'error');
    }
}

function closeWorkflowDetail() {
    document.getElementById('workflowDetailModal')?.classList.remove('active');
}

function showToast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
    const toast = document.createElement('div');
    toast.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px 20px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 24px rgba(0,0,0,0.15);animation:slideIn 0.3s ease;font-size:14px';
    toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}" style="width:18px;height:18px;color:var(--${type === 'error' ? 'danger' : type}-600);flex-shrink:0"></i><span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 4000);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTimestamp(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
