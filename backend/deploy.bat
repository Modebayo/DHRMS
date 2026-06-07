@echo off
echo Checking Firebase CLI...
where firebase >nul 2>&1
if errorlevel 1 (
    echo Firebase CLI not found. Installing...
    call npm install -g firebase-tools
)

echo Logging in to Firebase...
call firebase login

echo Deploying Firestore and Storage rules...
call firebase deploy --only firestore:rules,firestore:indexes,storage:rules

echo Deploying hosting...
call firebase deploy --only hosting

echo Deployment complete!
pause
