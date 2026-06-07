# SETUP GUIDE - Koladaisi University Health Records System

## Quick Start (5 Minutes)

### Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add Project"
3. Name it: `ku-health-records` (or any name)
4. Disable Google Analytics (optional)
5. Click "Create Project"

### Step 2: Enable Firebase Services

**Authentication:**
1. Go to Authentication > Sign-in method
2. Enable "Email/Password"
3. Enable "Google" (optional)
4. Save

**Firestore Database:**
1. Go to Firestore Database
2. Click "Create Database"
3. Start in **test mode** (we'll deploy rules later)
4. Choose location: closest to Nigeria (europe-west or us-central)

**Storage:**
1. Go to Storage
2. Click "Get Started"
3. Start in **test mode**

### Step 3: Get Firebase Config

1. Go to Project Settings (gear icon)
2. Scroll to "Your apps"
3. Click the web icon (</>)
4. Register app name: "KU Health Records"
5. Copy the config object

### Step 4: Update Config File

Open `src/js/firebase-config.js` and replace:

```javascript
const firebaseConfig = {
    apiKey: "PASTE_YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### Step 5: Run Locally

**Option A - Using Python:**
```
cd "C:\Users\HP\Desktop\ALAGBEDE IBRAHIM MODEBAYO FN PROJECT"
python -m http.server 3002
```
Then open: http://localhost:3002

**Option B - Using Node.js:**
```
npm install
npm start
```

**Option C - Direct:**
Just double-click `index.html`

### Step 6: Deploy Security Rules (Recommended)

Install Firebase CLI:
```
npm install -g firebase-tools
```

Login:
```
firebase login
```

Deploy rules:
```
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

### Step 7: Create First Admin User

1. Sign up as a regular user
2. Go to Firebase Console > Firestore
3. Find the user document
4. Change `role` to `admin`
5. Change `status` to `active`

## Default Test Accounts

After setup, create these test users:

**Admin:**
- Email: admin@koladeisi.edu
- Role: Admin
- Status: active

**Doctor:**
- Email: doctor@koladeisi.edu
- Role: Doctor
- Specialization: General Practice
- Status: active (approve from admin panel)

**Nurse:**
- Email: nurse@koladeisi.edu
- Role: Nurse
- Status: active (approve from admin panel)

**Student:**
- Email: student@koladeisi.edu
- Role: Student
- Student ID: KU/2024/001
- Department: Computer Science
- Level: 300

## Troubleshooting

**"Firebase not defined" error:**
- Make sure the CDN scripts load properly
- Check internet connection

**Permission denied errors:**
- Deploy security rules
- Verify user role in Firestore

**Data not showing:**
- Check Firestore is created
- Verify Firebase config is correct

**Can't login:**
- Enable Email/Password auth in Firebase Console
- Verify email is correct

## Production Deployment

1. Run: `firebase deploy`
2. Your app will be live at: `https://YOUR_PROJECT.web.app`

## Support

For issues, check:
1. Firebase Console logs
2. Browser console (F12)
3. Firestore security rules
