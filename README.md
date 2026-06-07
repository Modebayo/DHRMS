# Digital Health Records Management System
## Koladeisi University

A complete web-based health records management system built with HTML, CSS, JavaScript, and Firebase.

---

## Features

### Authentication & Security
- User registration with role selection (Student, Doctor, Nurse, Admin)
- Login/logout with session management
- Email verification
- Password reset / forgot password
- Google OAuth sign-in
- Role-based access control
- Activity logging for compliance

### Role-Based Dashboards
- **Student**: View personal records, book appointments, track prescriptions
- **Doctor**: Manage patients, create records, issue prescriptions, view lab results
- **Nurse**: Record vitals, manage tasks, view appointments
- **Admin**: User management, system settings, reports & analytics, activity logs

### Health Records Core
- Patient record CRUD (Create, Read, Update, Delete)
- Medical history tracking
- Diagnosis & treatment logs
- Severity classification (Mild, Moderate, Severe, Critical)
- Record search & filtering
- CSV export functionality

### Appointments
- Online appointment booking
- Doctor selection with specialization
- Time slot selection
- Status management (Pending, Confirmed, Completed, Cancelled)
- Appointment filtering

### Pharmacy Module
- Prescription creation by doctors
- Medication dispensing workflow
- Drug inventory management
- Stock level tracking (Low/Medium/Good)
- Expiry date monitoring

### Lab Results
- Lab test result entry
- Multiple test types (Blood Count, Urinalysis, Malaria, etc.)
- Result classification (Normal, Abnormal, Critical, Pending)

### Vitals Tracking
- Blood pressure recording
- Temperature monitoring
- Heart rate tracking
- SpO2 measurement
- Weight tracking
- Automatic BP classification

### Administration
- User management (approve, suspend, edit roles)
- System settings configuration
- Reports & analytics with charts
- Activity logs for audit trail
- Data export & backup

---

## Firebase Setup

### Step 1: Create Firebase Project
1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Enter project name (e.g., "koladeisi-health-records")
4. Follow the setup wizard

### Step 2: Enable Authentication
1. Go to Authentication > Sign-in method
2. Enable **Email/Password**
3. Enable **Google** (optional)
4. Save

### Step 3: Create Firestore Database
1. Go to Firestore Database
2. Click "Create database"
3. Start in **test mode** (we'll add security rules later)
4. Choose a location closest to you

### Step 4: Enable Storage
1. Go to Storage
2. Click "Get started"
3. Start in **test mode**

### Step 5: Get Configuration
1. Go to Project Settings (gear icon)
2. Under "Your apps", click the web icon (</>)
3. Register the app with a nickname
4. Copy the `firebaseConfig` object

### Step 6: Update Config File
Open `src/js/firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### Step 7: Firestore Security Rules
Go to Firestore > Rules and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    match /health_records/{recordId} {
      allow read, write: if request.auth != null;
    }
    
    match /appointments/{aptId} {
      allow read, write: if request.auth != null;
    }
    
    match /prescriptions/{prescId} {
      allow read, write: if request.auth != null;
    }
    
    match /lab_results/{resultId} {
      allow read, write: if request.auth != null;
    }
    
    match /vitals/{vitalId} {
      allow read, write: if request.auth != null;
    }
    
    match /inventory/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'doctor'];
    }
    
    match /activity_logs/{logId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    match /notifications/{notifId} {
      allow read, write: if request.auth != null;
    }
    
    match /settings/{settingId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

---

## Project Structure

```
ALAGBEDE IBRAHIM MODEBAYO FN PROJECT/
├── index.html                          # Landing page
├── src/
│   ├── auth/
│   │   ├── login.html                  # Login page
│   │   ├── signup.html                 # Registration page
│   │   ├── forgot-password.html        # Password reset
│   │   ├── verify-email.html           # Email verification
│   │   └── pending-approval.html       # Staff approval pending
│   ├── css/
│   │   ├── main.css                    # Core styles
│   │   ├── auth.css                    # Auth page styles
│   │   ├── dashboard.css               # Dashboard layout
│   │   ├── records.css                 # Records & components
│   │   └── components.css              # Charts & bars
│   ├── js/
│   │   ├── firebase-config.js          # Firebase initialization
│   │   ├── auth.js                     # Auth utilities
│   │   ├── login.js                    # Login logic
│   │   ├── signup.js                   # Signup logic
│   │   ├── reset-password.js           # Password reset logic
│   │   └── dashboard.js                # Dashboard logic
│   ├── dashboard/
│   │   └── index.html                  # Role-based dashboard
│   ├── records/
│   │   ├── index.html                  # Health records list
│   │   ├── records.js                  # Records CRUD logic
│   │   ├── patient-list.html           # Doctor's patients
│   │   ├── patient-list.js
│   │   ├── prescriptions.html          # Prescriptions list
│   │   ├── prescriptions.js
│   │   ├── lab-results.html            # Lab results
│   │   ├── lab-results.js
│   │   ├── vitals.html                 # Vitals tracking
│   │   ├── vitals.js
│   │   ├── my-records.html             # Student's records
│   │   └── my-records.js
│   ├── appointments/
│   │   ├── index.html                  # Appointments list
│   │   ├── appointments.js
│   │   ├── create.html                 # Book appointment
│   │   └── create-appointment.js
│   ├── pharmacy/
│   │   ├── index.html                  # Pharmacy/prescriptions
│   │   ├── pharmacy.js
│   │   ├── inventory.html              # Drug inventory
│   │   └── inventory.js
│   ├── admin/
│   │   ├── users.html                  # User management
│   │   ├── admin-users.js
│   │   ├── reports.html                # Reports & analytics
│   │   ├── reports.js
│   │   ├── logs.html                   # Activity logs
│   │   ├── logs.js
│   │   └── settings.html               # System settings
│   │   └── admin-settings.js
│   └── settings/
│       ├── index.html                  # User settings
│       └── settings.js
└── assets/
    └── images/
```

---

## Running the Project

### Option 1: Live Server (VS Code)
1. Open the project folder in VS Code
2. Install "Live Server" extension
3. Right-click `index.html` > "Open with Live Server"

### Option 2: Python
```bash
cd "ALAGBEDE IBRAHIM MODEBAYO FN PROJECT"
python -m http.server 3002
```
Then open http://localhost:3002

### Option 3: Node.js
```bash
npx serve
```

---

## Default User Roles

| Role | Access Level |
|------|-------------|
| Student | View own records, book appointments, view prescriptions |
| Doctor | Full medical access, create records, prescriptions, lab results |
| Nurse | Record vitals, view appointments, manage tasks |
| Admin | Full system access, user management, settings, reports |

---

## Technologies Used

- **HTML5** - Structure
- **CSS3** - Styling with CSS variables, Grid, Flexbox
- **JavaScript (ES6+)** - Application logic
- **Firebase Authentication** - User management
- **Firestore** - NoSQL database
- **Firebase Storage** - File uploads (avatars)

---

## Security Features

- Input sanitization to prevent XSS
- Password strength validation
- Role-based route guards
- Activity logging for audit trails
- Firebase security rules
- Session management

---

## Future Enhancements

- Real-time notifications with Firebase Cloud Messaging
- AI-powered health chatbot integration
- SMS notifications for appointments
- Telemedicine/video consultation
- Mobile app version
- Advanced analytics with Chart.js
- Bulk user import
- Appointment calendar view
- Prescription PDF generation

---

## Credits

**Project**: Digital Health Records Management System  
**Institution**: Koladeisi University  
**Built by**: Alagbede Ibrahim Modebayo
