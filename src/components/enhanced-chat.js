// Enhanced Chatbox with AI-like responses
const chatResponses = {
    greetings: [
        "Hello! I'm your health assistant. How can I help you today?",
        "Hi there! I'm here to help with health-related queries.",
        "Welcome! I can help you with appointments, records, and general health info."
    ],
    appointments: [
        "To book an appointment, go to Appointments > Book New. You can select your preferred doctor and time slot.",
        "You can view your upcoming appointments on the dashboard or in the Appointments section.",
        "Need to reschedule? Go to Appointments, find your booking, and click 'Reschedule'."
    ],
    records: [
        "Your health records are available in the Records section. Students can only view their own records.",
        "Medical staff can create and update patient records. Go to Records > Create New.",
        "Vital signs are tracked separately. Check the Vitals section for blood pressure, heart rate, etc."
    ],
    prescriptions: [
        "Prescriptions are issued by doctors. Check the Pharmacy section to view your medications.",
        "To dispense a prescription, go to Pharmacy > Pending Prescriptions.",
        "Always follow the dosage instructions. If you have side effects, contact your doctor immediately."
    ],
    emergency: [
        "For medical emergencies, call the Health Center at +234-XXX-XXX-XXXX immediately!",
        "If it's a life-threatening emergency, dial 911 or use the Emergency Sidebar (red button).",
        "For ambulance services, use the Emergency Sidebar or call +234-XXX-XXX-XXXX."
    ],
    vitals: [
        "Vitals include blood pressure, heart rate, temperature, weight, and SpO2.",
        "Nurses record vitals regularly. You can view your vitals history in the Vitals section.",
        "Normal BP is around 120/80. Contact your doctor if your readings are consistently high."
    ],
    general: [
        "I'm here to help! You can ask about appointments, records, prescriptions, or health tips.",
        "Need help navigating the system? Check the sidebar menu for all available features.",
        "Remember to keep your contact information updated in Settings > Profile."
    ],
    fallbacks: [
        "I'm not sure I understand. Could you rephrase that?",
        "I'm still learning. Please ask about appointments, records, prescriptions, or emergency info.",
        "For complex medical advice, please consult with your doctor directly."
    ]
};

function getChatResponse(message) {
    const msg = message.toLowerCase();
    
    if (msg.match(/hi|hello|hey|good morning|good afternoon/)) {
        return getRandomResponse(chatResponses.greetings);
    }
    if (msg.match(/appointment|book|schedule|reschedule/)) {
        return getRandomResponse(chatResponses.appointments);
    }
    if (msg.match(/record|history|medical|health record/)) {
        return getRandomResponse(chatResponses.records);
    }
    if (msg.match(/prescription|medication|drug|pill|medicine/)) {
        return getRandomResponse(chatResponses.prescriptions);
    }
    if (msg.match(/emergency|urgent|help|ambulance|accident/)) {
        return getRandomResponse(chatResponses.emergency);
    }
    if (msg.match(/vital|blood pressure|heart rate|temperature|weight|spo2/)) {
        return getRandomResponse(chatResponses.vitals);
    }
    if (msg.match(/help|how|what|where|navigate/)) {
        return getRandomResponse(chatResponses.general);
    }
    
    return getRandomResponse(chatResponses.fallbacks);
}

function getRandomResponse(responses) {
    return responses[Math.floor(Math.random() * responses.length)];
}

// Enhanced sendMessage function
function sendEnhancedMessage() {
    const input = document.getElementById('chatInput');
    const messages = document.getElementById('chatMessages');
    
    if (!input.value.trim()) return;
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.textContent = input.value;
    messages.appendChild(userMsg);
    
    const userMessage = input.value;
    input.value = '';
    
    // Show typing indicator
    const typing = document.createElement('div');
    typing.className = 'chat-message bot';
    typing.innerHTML = '<i data-lucide="loader-2" style="width:16px;height:16px" class="spin"></i> Typing...';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Simulate AI response delay
    setTimeout(() => {
        typing.remove();
        
        const botMsg = document.createElement('div');
        botMsg.className = 'chat-message bot';
        botMsg.textContent = getChatResponse(userMessage);
        messages.appendChild(botMsg);
        
        messages.scrollTop = messages.scrollHeight;
    }, 1000 + Math.random() * 1000);
}

// Quick chat suggestions
function showChatSuggestions() {
    const messages = document.getElementById('chatMessages');
    if (!messages) return;
    
    const suggestions = document.createElement('div');
    suggestions.className = 'chat-suggestions';
    suggestions.innerHTML = `
        <div style="padding: 10px; text-align: center;">
            <small style="color: var(--text-muted);">Quick questions:</small><br>
            <button class="btn btn-sm btn-ghost" onclick="quickChat('How do I book an appointment?')">Book Appointment</button>
            <button class="btn btn-sm btn-ghost" onclick="quickChat('Where are my prescriptions?')">View Prescriptions</button>
            <button class="btn btn-sm btn-ghost" onclick="quickChat('What is emergency number?')">Emergency Info</button>
        </div>
    `;
    messages.appendChild(suggestions);
}

function quickChat(message) {
    document.getElementById('chatInput').value = message;
    sendEnhancedMessage();
}

// Add chat styles
const chatStyle = document.createElement('style');
chatStyle.textContent = `
    .chat-suggestions {
        padding: 10px;
        text-align: center;
        border-top: 1px solid var(--border-light);
    }
    .chat-suggestions .btn {
        margin: 4px;
        font-size: 12px;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .spin {
        animation: spin 1s linear infinite;
    }
`;
document.head.appendChild(chatStyle);
