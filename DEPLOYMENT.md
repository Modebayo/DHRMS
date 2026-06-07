# DEPLOYMENT GUIDE - Koladaisi University Health Records

## Step 1: Create First Admin Account

### Option A: Use Bootstrap Page (Easiest)
1. Open `src/auth/bootstrap.html` in your browser
2. The form is pre-filled with:
   - Email: `ibrotech974@gmail.com`
   - Password: `Neon10*`
   - Name: ALAGBEDE IBRAHIM MODEBAYO
3. Click "Create Admin Account"
4. You should see "Admin account created! You can now login."

### Option B: Sign Up Normally
1. Go to `src/auth/signup.html`
2. Sign up with any email/password
3. Go to [Firebase Console](https://console.firebase.google.com)
4. Navigate to **Firestore Database** > **users** collection
5. Find your user document
6. Edit the document:
   - Set `role` to `admin`
   - Set `status` to `active`

---

## Step 2: Test Login Flow

### Regular User Login:
1. Open `index.html`
2. Click "Sign In"
3. Use registered email/password

### Admin Login:
1. Open `src/auth/admin-login.html`
2. Login with admin credentials
3. Should redirect to `src/admin/index.html`

### Theme Toggle:
- Click the floating moon/sun button (bottom-right corner)
- Theme persists across all pages

---

## Step 3: Local Testing

### Option A: Python
```bash
cd "C:\Users\HP\Desktop\ALAGBEDE IBRAHIM MODEBAYO FN PROJECT"
python -m http.server 3000
```
Open: http://localhost:3002

### Option B: Node.js
```bash
cd "C:\Users\HP\Desktop\ALAGBEDE IBRAHIM MODEBAYO FN PROJECT"
npm start
```

---

## Step 4: Deploy to Firebase

### Install Firebase CLI (if not installed):
```bash
npm install -g firebase-tools
```

### Login to Firebase:
```bash
firebase login
```

### Deploy Everything:
```bash
cd "C:\Users\HP\Desktop\ALAGBEDE IBRAHIM MODEBAYO FN PROJECT"
firebase deploy
```

### Deploy Only Hosting (faster):
```bash
npm run deploy:hosting
```

### Deploy Only Security Rules:
```bash
npm run deploy:rules
```

---

## Post-Deployment Checklist

- [ ] First admin account created
- [ ] Can login as admin at `/src/auth/admin-login.html`
- [ ] Can login as regular user at `/src/auth/login.html`
- [ ] Theme toggle works (dark/light mode persists)
- [ ] Security rules deployed
- [ ] Test user registration works
- [ ] Test password reset works

---

## Your Firebase Project Info

- **Project ID:** `dhrms-26bb5`
- **Hosting URL:** https://dhrms-26bb5.web.app
- **Firebase Console:** https://console.firebase.google.com/project/dhrms-26bb5

---

## Troubleshooting

**"Firebase not defined" error:**
- Check internet connection
- Verify `firebase-config.js` has correct config

**Can't login:**
- Enable Email/Password auth in Firebase Console
- Check user `status` is `active` in Firestore
- Check user `role` is set correctly

**Theme not persisting:**
- Check `theme.js` is loaded in the page
- Check browser localStorage has `theme` set

**Deployment fails:**
- Run `firebase login` first
- Check `firebase.json` is correct
- Run `firebase init` if needed
