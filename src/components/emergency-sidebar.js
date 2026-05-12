// Emergency Sidebar Component
function createEmergencySidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'emergencySidebar';
    sidebar.className = 'emergency-sidebar';
    sidebar.innerHTML = `
        <div class="emergency-header">
            <i data-lucide="alert-triangle"></i>
            <h3>Emergency Services</h3>
            <button onclick="toggleEmergencySidebar()" class="emergency-close">
                <i data-lucide="x"></i>
            </button>
        </div>
        <div class="emergency-content">
            <div class="emergency-section">
                <h4>Immediate Assistance</h4>
                <button class="emergency-btn emergency-call" onclick="callEmergency()">
                    <i data-lucide="phone"></i>
                    <div>
                    <strong>Call Health Center</strong>
                         <span>+234-803-123-4567</span>
                    </div>
                </button>
                <button class="emergency-btn emergency-ambulance" onclick="requestAmbulance()">
                    <i data-lucide="ambulance"></i>
                    <div>
                        <strong>Request Ambulance</strong>
                        <span>Campus ambulance service</span>
                    </div>
                </button>
            </div>
            <div class="emergency-section">
                <h4>Emergency Contacts</h4>
                <div class="emergency-contact">
                    <i data-lucide="hospital"></i>
                    <div>
                        <strong>University Health Center</strong>
                        <span>24/7 Available</span>
                    </div>
                </div>
                <div class="emergency-contact">
                    <i data-lucide="user-check"></i>
                    <div>
                        <strong>On-Duty Doctor</strong>
                        <span>Extension: 1234</span>
                    </div>
                </div>
                <div class="emergency-contact">
                    <i data-lucide="shield-alert"></i>
                    <div>
                        <strong>Campus Security</strong>
                        <span>Extension: 911</span>
                    </div>
                </div>
            </div>
            <div class="emergency-section">
                <h4>Settings</h4>
                <button class="emergency-link theme-toggle-btn" onclick="toggleThemeFromEmergency()">
                    <i data-lucide="moon" id="themeToggleIcon" data-theme-icon></i> 
                    <span id="themeToggleText">Switch to Dark Mode</span>
                </button>
            </div>
            <div class="emergency-section">
                <h4>First Aid Guides</h4>
                <button class="emergency-link" onclick="showFirstAid('cpr')">
                    <i data-lucide="heart-pulse"></i> CPR Instructions
                </button>
                <button class="emergency-link" onclick="showFirstAid('bleeding')">
                    <i data-lucide="bandage"></i> Bleeding Control
                </button>
                <button class="emergency-link" onclick="showFirstAid('burns')">
                    <i data-lucide="flame"></i> Burn Treatment
                </button>
                <button class="emergency-link" onclick="showFirstAid('fracture')">
                    <i data-lucide="bone"></i> Fracture Care
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(sidebar);
    
    const style = document.createElement('style');
    style.textContent = `
        .emergency-sidebar {
            position: fixed;
            top: 0;
            right: -400px;
            width: 360px;
            height: 100vh;
            background: white;
            box-shadow: -4px 0 20px rgba(0,0,0,0.15);
            z-index: 9999;
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .emergency-sidebar.active {
            right: 0;
        }
        .emergency-header {
            background: linear-gradient(135deg, #dc2626, #991b1b);
            color: white;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .emergency-header h3 {
            flex: 1;
            font-size: 16px;
            font-weight: 600;
        }
        .emergency-close {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .emergency-close:hover {
            background: rgba(255,255,255,0.3);
        }
        .emergency-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }
        .emergency-section {
            margin-bottom: 24px;
        }
        .emergency-section h4 {
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 12px;
            letter-spacing: 0.05em;
        }
        .emergency-btn {
            width: 100%;
            padding: 14px 16px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 10px;
            transition: all 0.2s;
            font-family: inherit;
        }
        .emergency-call {
            background: #dc2626;
            color: white;
        }
        .emergency-call:hover {
            background: #991b1b;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }
        .emergency-ambulance {
            background: #ea580c;
            color: white;
        }
        .emergency-ambulance:hover {
            background: #c2410c;
            transform: translateY(-1px);
        }
        .emergency-btn div {
            text-align: left;
        }
        .emergency-btn strong {
            display: block;
            font-size: 14px;
        }
        .emergency-btn span {
            font-size: 12px;
            opacity: 0.9;
        }
        .emergency-contact {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: #f9fafb;
            border-radius: 8px;
            margin-bottom: 8px;
        }
        .emergency-contact i {
            color: #dc2626;
            width: 20px;
            height: 20px;
        }
        .emergency-contact div {
            flex: 1;
        }
        .emergency-contact strong {
            display: block;
            font-size: 13px;
            color: #111827;
        }
        .emergency-contact span {
            font-size: 12px;
            color: #6b7280;
        }
        .emergency-link {
            width: 100%;
            padding: 10px 12px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            font-size: 13px;
            color: #374151;
            transition: all 0.2s;
            font-family: inherit;
        }
        .emergency-link:hover {
            background: #fef2f2;
            border-color: #dc2626;
            color: #dc2626;
        }
        .theme-toggle-btn {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }
        .theme-toggle-btn:hover {
            background: #2563eb;
            border-color: #2563eb;
        }
        .theme-toggle-fab {
            position: fixed;
            bottom: 24px;
            right: 100px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9998;
            transition: all 0.3s;
        }
        .theme-toggle-fab:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
        }
        .theme-toggle-fab i {
            width: 24px;
            height: 24px;
        }
        .emergency-fab {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: linear-gradient(135deg, #dc2626, #991b1b);
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9998;
            transition: all 0.3s;
            animation: pulse-emergency 2s infinite;
        }
        .emergency-fab:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(220, 38, 38, 0.5);
        }
        @keyframes pulse-emergency {
            0%, 100% { box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4); }
            50% { box-shadow: 0 4px 24px rgba(220, 38, 38, 0.6); }
        }
        @media (max-width: 768px) {
            .emergency-sidebar {
                width: 100%;
                right: -100%;
            }
        }
    `;
    document.head.appendChild(style);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleEmergencySidebar() {
    const sidebar = document.getElementById('emergencySidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

function callEmergency() {
    window.location.href = 'tel:+2348031234567';
    showToast('Calling University Health Center...', 'info');
}

function requestAmbulance() {
    if (confirm('Request ambulance to your current location?')) {
        showToast('Ambulance requested. Help is on the way!', 'success');
        logActivity(currentUser?.uid, 'emergency', 'Ambulance requested');
    }
}

function showFirstAid(type) {
    const guides = {
        cpr: '1. Check responsiveness\n2. Call for help\n3. Start chest compressions (100-120/min)\n4. Give rescue breaths\n5. Continue until help arrives',
        bleeding: '1. Apply direct pressure\n2. Elevate the injured area\n3. Apply pressure points if needed\n4. Use tourniquet as last resort',
        burns: '1. Cool the burn with cool water\n2. Remove jewelry/tight items\n3. Cover with sterile dressing\n4. Do NOT use ice or butter',
        fracture: '1. Immobilize the area\n2. Apply ice packs\n3. Do NOT move the person\n4. Wait for medical help'
    };
    alert(`First Aid: ${type.toUpperCase()}\n\n${guides[type]}`);
}

// Add theme toggle FAB to all pages
function addThemeToggleFAB() {
    if (document.getElementById('themeToggleFAB')) return;
    
    const fab = document.createElement('button');
    fab.id = 'themeToggleFAB';
    fab.className = 'theme-toggle-fab';
    fab.innerHTML = '<i data-lucide="sun" id="fabThemeIcon" data-theme-icon></i>';
    fab.onclick = toggleTheme;
    fab.title = 'Toggle Theme';
    document.body.appendChild(fab);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Add emergency FAB to all pages
function addEmergencyFAB() {
    if (document.getElementById('emergencyFAB')) return;
    
    const fab = document.createElement('button');
    fab.id = 'emergencyFAB';
    fab.className = 'emergency-fab';
    fab.innerHTML = '<i data-lucide="alert-triangle" style="width:28px;height:28px"></i>';
    fab.onclick = toggleEmergencySidebar;
    document.body.appendChild(fab);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        createEmergencySidebar();
        addEmergencyFAB();
        addThemeToggleFAB();
    });
} else {
    createEmergencySidebar();
    addEmergencyFAB();
    addThemeToggleFAB();
}

// Theme toggle from emergency sidebar - uses theme.js functions
function toggleThemeFromEmergency() {
    toggleTheme();
}
