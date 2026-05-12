# Testing Checklist - Koladeisi University Health Records System

## Login & Authentication
- [ ] Admin login at `/src/auth/login.html`
  - Email: admin@dhrms.com
  - Password: Admin123@2024
- [ ] Student login
- [ ] Doctor login
- [ ] Forgot password flow
- [ ] Logout functionality

## Dashboard (All Roles)
- [ ] Stats cards load correctly
- [ ] Recent activity shows
- [ ] Quick actions work
- [ ] Role-based views (students see different content than admin)

## Health Records
- [ ] Create new record (Doctor/Nurse/Admin only)
- [ ] View existing records
- [ ] Edit records
- [ ] Delete records (Admin only)
- [ ] Search functionality
- [ ] Filter by department/status

## Patient List (Doctor view)
- [ ] List all patients
- [ ] View patient records
- [ ] View patient vitals

## Appointments
- [ ] Book appointment
- [ ] View appointments
- [ ] Cancel appointment
- [ ] Filter by status
- [ ] Time slot availability

## Lab Results
- [ ] Add lab result
- [ ] View lab results
- [ ] Delete lab results

## Vitals
- [ ] Record vitals
- [ ] View vitals history

## Prescriptions
- [ ] Create prescription
- [ ] View prescriptions
- [ ] Dispense medication (Pharmacy)

## Inventory
- [ ] Add medication
- [ ] Edit medication
- [ ] Delete medication
- [ ] View stock levels

## Tasks
- [ ] Create task
- [ ] Start task
- [ ] Complete task
- [ ] Delete task
- [ ] Filter by status

## Settings
- [ ] Update profile
- [ ] Change password
- [ ] Notification preferences
- [ ] Delete account

## Admin Panel
- [ ] User management - Create user
- [ ] User management - Edit user
- [ ] User management - Suspend user
- [ ] User management - Delete user
- [ ] Bulk actions (approve, suspend, delete)
- [ ] View activity logs

## Mobile Responsiveness
- [ ] Sidebar toggle works on mobile
- [ ] Tables scroll horizontally
- [ ] Forms are usable on mobile
- [ ] Bottom navigation works

## Theme
- [ ] Light/dark mode toggle works
- [ ] Theme persists across pages

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@dhrms.com | Admin123@2024 |
| Student | student@test.com | Test123@ |
| Doctor | doctor@test.com | Test123@ |
| Nurse | nurse@test.com | Test123@ |

## Test Scenarios

### Scenario 1: Student Books Appointment
1. Login as student
2. Go to Appointments
3. Click "New Appointment"
4. Select doctor and date
5. Book appointment
6. Verify in table

### Scenario 2: Doctor Creates Prescription
1. Login as doctor
2. Go to Prescriptions
3. Click "New Prescription"
4. Select patient
5. Enter medication details
6. Save and verify

### Scenario 3: Admin Manages Users
1. Login as admin
2. Go to Admin > Users
3. Click "Create User"
4. Fill form and submit
5. Verify user appears in list

### Scenario 4: Nurse Records Vitals
1. Login as nurse
2. Go to Vitals
3. Click "Record Vitals"
4. Enter patient vitals
5. Save and verify

---

## Known Issues to Verify Fixed
- [ ] Sidebar toggle button works on all pages
- [ ] Theme toggle persists across sessions
- [ ] No duplicate code in JS files
- [ ] All HTML has proper structure (no extra `</div>`)
- [ ] Mobile view is usable

## Deploy Commands
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
firebase deploy
```